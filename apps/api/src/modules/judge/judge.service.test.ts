import { Verdict } from '@yato/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../../common/crypto.js';
import { UnauthorizedError } from '../../common/errors.js';
import type { JudgeTaskMessage } from '../../messaging/commands.js';
import type { MessageBroker } from '../../messaging/message-broker.js';
import type { StorageService } from '../../storage/storage.service.js';
import { localEvents, localJudgeQueue } from '../../testing/fixtures.js';
import type { ProblemRepository } from '../problem/problem.repository.js';
import type { SubmissionBusEvent } from '../submission/submission.events.js';
import type { SubmissionRepository } from '../submission/submission.repository.js';
import type { JudgeRepository, JudgeRow } from './judge.repository.js';
import { JudgeService } from './judge.service.js';

/** In-memory stand-ins for the queue and the tables `fetch` touches. */
function setup(waiting: { id: number; language: string }[], checker = '') {
  const events = localEvents();
  const {
    queue: judgeQueue,
    tasks: queue,
    announced,
  } = localJudgeQueue(waiting.map(({ id }) => ({ submissionId: id })));
  const rows = new Map<
    number,
    { id: number; language: string; problemId: number; code: string; verdict: number; judgeId: number | null }
  >(waiting.map((s) => [s.id, { ...s, problemId: 1, code: '', verdict: Verdict.WAIT, judgeId: null }]));
  const seen: { judgeId: number; languages?: readonly string[] }[] = [];
  /** Runs inside `claim`, after the row was claimed: lets a test act at that moment. */
  const hooks: { afterClaim: () => void } = { afterClaim: () => undefined };

  const submissions = {
    claim: async (id: number, judgeId: number, languages?: readonly string[]) => {
      const row = rows.get(id);
      if (!row || row.verdict !== Verdict.WAIT || (languages && !languages.includes(row.language))) return undefined;
      Object.assign(row, { verdict: Verdict.JUDGING, judgeId });
      hooks.afterClaim();
      return row;
    },
    waitingLanguage: async (id: number) => {
      const row = rows.get(id);
      return row?.verdict === Verdict.WAIT ? row.language : undefined;
    },
    release: async (id: number, judgeId: number) => {
      const row = rows.get(id);
      if (row?.verdict !== Verdict.JUDGING || row.judgeId !== judgeId) return false;
      Object.assign(row, { verdict: Verdict.WAIT, judgeId: null });
      return true;
    },
    findById: async (id: number) => rows.get(id),
  } as unknown as SubmissionRepository;
  const judges = {
    touch: async (judgeId: number, languages?: readonly string[]) => void seen.push({ judgeId, languages }),
  } as unknown as JudgeRepository;
  const problems = {
    findById: async () => ({ problem: { timeLimitMs: 1000, memoryLimitKb: 65536, checker } }),
    listTestcases: async () => [],
  } as unknown as ProblemRepository;

  const service = new JudgeService(
    judges,
    submissions,
    problems,
    {} as StorageService,
    {} as MessageBroker,
    events,
    judgeQueue,
  );
  /** A new submission, written and queued as the write-queue consumer does. */
  const submit = async (id: number, language: string, { announce = true } = {}) => {
    rows.set(id, { id, language, problemId: 1, code: '', verdict: Verdict.WAIT, judgeId: null });
    if (announce) await judgeQueue.push(id, language);
    else queue.push({ submissionId: id });
  };
  return { service, queue, seen, events, rows, submit, judgeQueue, announced, hooks };
}

const judge = { id: 7 } as JudgeRow;
const ids = (queue: JudgeTaskMessage[]) => queue.map((t) => t.submissionId);

describe('JudgeService.fetch and checkers', () => {
  it('sends no checker for problems that compare with the expected output', async () => {
    const { service } = setup([{ id: 1, language: 'cpp' }]);
    expect((await service.fetch(judge)).task?.checker).toBeNull();
  });

  it("sends a problem's checker with the hash of its source, which judges cache it under", async () => {
    const source = '#include "testlib.h"\nint main() {}\n';
    const { service } = setup([{ id: 1, language: 'cpp' }], source);
    expect((await service.fetch(judge)).task?.checker).toEqual({ sha256: sha256(source), source });
  });
});

describe('JudgeService.fetch', () => {
  it('hands out the oldest submission when the judge does not list languages', async () => {
    const { service, queue } = setup([
      { id: 1, language: 'clang-cpp23' },
      { id: 2, language: 'cpp' },
    ]);
    expect((await service.fetch(judge)).task?.submissionId).toBe(1);
    expect(ids(queue)).toEqual([2]);
  });

  it('skips submissions in languages the judge cannot run and keeps them queued', async () => {
    const { service, queue, seen } = setup([
      { id: 1, language: 'clang-cpp23' },
      { id: 2, language: 'clang-cpp17' },
      { id: 3, language: 'cpp' },
    ]);
    expect((await service.fetch(judge, ['c', 'cpp'])).task?.submissionId).toBe(3);
    expect(ids(queue)).toEqual([1, 2]);
    expect(seen).toEqual([{ judgeId: 7, languages: ['c', 'cpp'] }]);
  });

  it('stops after one pass over a queue with nothing it can run, losing no task', async () => {
    const { service, queue } = setup([
      { id: 1, language: 'clang-cpp23' },
      { id: 2, language: 'clang-cpp17' },
    ]);
    expect((await service.fetch(judge, ['cpp'])).task).toBeNull();
    expect(ids(queue).sort()).toEqual([1, 2]);
  });

  it('drops tasks for submissions that are no longer waiting', async () => {
    const { service, queue } = setup([{ id: 1, language: 'cpp' }]);
    await service.fetch(judge, ['cpp']);
    queue.push({ submissionId: 1 }); // duplicate task
    expect((await service.fetch(judge, ['cpp'])).task).toBeNull();
    expect(queue).toEqual([]);
  });
});

describe('JudgeService.fetch, waiting (long polling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Starts a fetch and reports whether, and when, it has answered. */
  function start(promise: Promise<{ task: { submissionId: number } | null }>) {
    const began = Date.now();
    const state = { answered: false, afterMs: -1 };
    const done = promise.then((value) => {
      Object.assign(state, { answered: true, afterMs: Date.now() - began });
      return value;
    });
    return { state, done };
  }

  it('hands out a submission queued while the judge waits, as soon as it is queued', async () => {
    const { service, submit } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 20 }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetch.state.answered).toBe(false);
    await submit(5, 'cpp');
    await vi.advanceTimersByTimeAsync(0);
    expect((await fetch.done).task?.submissionId).toBe(5);
    expect(fetch.state.afterMs).toBe(1500);
  });

  it('answers empty once the wait is over', async () => {
    const { service } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 12 }));
    await vi.advanceTimersByTimeAsync(11_999);
    expect(fetch.state.answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await fetch.done).toEqual({ task: null });
  });

  it('answers at once without waitSec, as before', async () => {
    const { service } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp']));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch.state).toEqual({ answered: true, afterMs: 0 });
  });

  it('is not woken by submissions in languages its judge cannot run', async () => {
    const { service, submit, rows } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 20 }));
    await submit(6, 'py3');
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetch.state.answered).toBe(false);
    // Its next look at the queue skips the Python submission and keeps waiting.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch.state.answered).toBe(false);
    expect(rows.get(6)?.verdict).toBe(Verdict.WAIT);
    await submit(7, 'cpp');
    await vi.advanceTimersByTimeAsync(0);
    expect((await fetch.done).task?.submissionId).toBe(7);
  });

  it('announces a skipped submission only to judges that can run it, so judges cannot wake each other in turn', async () => {
    const { service, submit, announced } = setup([]);
    await submit(6, 'py3');
    expect((await service.fetch(judge, ['cpp'])).task).toBeNull();
    expect(announced.every((key) => key === 'judge.queued.py3')).toBe(true);
  });

  it('still finds a submission whose announcement was lost, at its next look', async () => {
    const { service, submit } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 20 }));
    await vi.advanceTimersByTimeAsync(1000);
    await submit(8, 'cpp', { announce: false });
    await vi.advanceTimersByTimeAsync(3999);
    expect(fetch.state.answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await fetch.done).task?.submissionId).toBe(8);
    expect(fetch.state.afterMs).toBe(5000);
  });

  it('stops waiting when the judge hangs up, and claims nothing for it afterwards', async () => {
    const { service, submit, rows } = setup([]);
    const hangUp = new AbortController();
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 20, signal: hangUp.signal }));
    await vi.advanceTimersByTimeAsync(1000);
    hangUp.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(await fetch.done).toEqual({ task: null });
    await submit(9, 'cpp');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rows.get(9)?.verdict).toBe(Verdict.WAIT);
  });

  it('gives a submission back when the judge hung up while it was being claimed', async () => {
    const { service, rows, queue, hooks } = setup([{ id: 4, language: 'cpp' }]);
    const hangUp = new AbortController();
    hooks.afterClaim = () => hangUp.abort();
    expect(await service.fetch(judge, ['cpp'], { waitSec: 20, signal: hangUp.signal })).toEqual({ task: null });
    expect(rows.get(4)).toMatchObject({ verdict: Verdict.WAIT, judgeId: null });
    expect(ids(queue)).toEqual([4]);
  });

  it('answers at once when the API shuts down, and does not wait afterwards', async () => {
    const { service, judgeQueue } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 20 }));
    await vi.advanceTimersByTimeAsync(1000);
    judgeQueue.beforeApplicationShutdown();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch.state).toEqual({ answered: true, afterMs: 1000 });
    const late = start(service.fetch(judge, ['cpp'], { waitSec: 20 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(late.state).toEqual({ answered: true, afterMs: 0 });
  });

  it('holds a fetch 30 seconds at most', async () => {
    const { service } = setup([]);
    const fetch = start(service.fetch(judge, undefined, { waitSec: 3600 }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetch.state).toEqual({ answered: true, afterMs: 30_000 });
  });

  it('keeps a waiting judge marked as seen, so the admin page shows it online', async () => {
    const { service, seen } = setup([]);
    const fetch = start(service.fetch(judge, ['cpp'], { waitSec: 30 }));
    await vi.advanceTimersByTimeAsync(30_000);
    await fetch.done;
    // At 0, 10, 20 and 30 seconds; the admin page calls a judge offline after 30.
    expect(seen).toHaveLength(4);
  });
});

describe('JudgeService.progress', () => {
  const result = { testcaseId: 4, ordinal: 0, verdict: Verdict.AC, timeMs: 3, memoryKb: 10, score: 1, message: '' };
  const heard = (events: ReturnType<typeof localEvents>, id: number) => {
    const log: SubmissionBusEvent[] = [];
    events.listen(id, (event) => log.push(event));
    return log;
  };

  it('tells watchers a submission was claimed, then each testcase its judge finishes', async () => {
    const { service, events } = setup([{ id: 1, language: 'cpp' }]);
    const log = heard(events, 1);
    await service.fetch(judge);
    await service.progress(judge, { submissionId: 1, total: 3, result });
    expect(log).toEqual([{ kind: 'changed' }, { kind: 'progress', total: 3, result }]);
  });

  it('ignores progress from a judge that does not hold the claim', async () => {
    const { service, events } = setup([{ id: 1, language: 'cpp' }]);
    const log = heard(events, 1);
    // Not claimed yet.
    await service.progress(judge, { submissionId: 1, total: 3, result });
    await service.fetch(judge);
    // Claimed, by another judge.
    await service.progress({ id: 8 } as JudgeRow, { submissionId: 1, total: 3, result });
    await service.progress(judge, { submissionId: 99, total: 3, result });
    expect(log).toEqual([{ kind: 'changed' }]);
  });
});

describe('JudgeService.authenticate', () => {
  const service = (judge?: { id: number; enabled: boolean }) =>
    new JudgeService(
      { findByTokenHash: async () => judge } as unknown as JudgeRepository,
      {} as SubmissionRepository,
      {} as ProblemRepository,
      {} as StorageService,
      {} as MessageBroker,
      localEvents(),
      localJudgeQueue().queue,
    );

  it('accepts an enabled judge and refuses unknown, disabled or missing tokens', async () => {
    await expect(service({ id: 1, enabled: true }).authenticate('token')).resolves.toMatchObject({ id: 1 });
    await expect(service({ id: 1, enabled: false }).authenticate('token')).rejects.toThrow(UnauthorizedError);
    await expect(service(undefined).authenticate('token')).rejects.toThrow(UnauthorizedError);
    await expect(service({ id: 1, enabled: true }).authenticate(undefined)).rejects.toThrow(UnauthorizedError);
  });
});

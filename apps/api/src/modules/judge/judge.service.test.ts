import { Verdict } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../common/crypto.js';
import { UnauthorizedError } from '../../common/errors.js';
import type { JudgeTaskMessage } from '../../messaging/commands.js';
import type { MessageBroker } from '../../messaging/message-broker.js';
import type { StorageService } from '../../storage/storage.service.js';
import { localEvents } from '../../testing/fixtures.js';
import type { ProblemRepository } from '../problem/problem.repository.js';
import type { SubmissionBusEvent } from '../submission/submission.events.js';
import type { SubmissionRepository } from '../submission/submission.repository.js';
import type { JudgeRepository, JudgeRow } from './judge.repository.js';
import { JudgeService } from './judge.service.js';

/** In-memory stand-ins for the queue and the tables `fetch` touches. */
function setup(waiting: { id: number; language: string }[], checker = '') {
  const events = localEvents();
  const queue: JudgeTaskMessage[] = waiting.map(({ id }) => ({ submissionId: id }));
  const rows = new Map(waiting.map((s) => [s.id, { ...s, problemId: 1, code: '', verdict: Verdict.WAIT as number }]));
  const seen: { judgeId: number; languages?: readonly string[] }[] = [];

  const broker = {
    pull: async () => queue.shift(),
    publish: async (_queue: string, task: JudgeTaskMessage) => void queue.push(task),
  } as unknown as MessageBroker;
  const submissions = {
    claim: async (id: number, _judge: number, languages?: readonly string[]) => {
      const row = rows.get(id);
      if (!row || row.verdict !== Verdict.WAIT || (languages && !languages.includes(row.language))) return undefined;
      row.verdict = Verdict.JUDGING;
      return row;
    },
    isWaiting: async (id: number) => rows.get(id)?.verdict === Verdict.WAIT,
  } as unknown as SubmissionRepository;
  const judges = {
    touch: async (judgeId: number, languages?: readonly string[]) => void seen.push({ judgeId, languages }),
  } as unknown as JudgeRepository;
  const problems = {
    findById: async () => ({ problem: { timeLimitMs: 1000, memoryLimitKb: 65536, checker } }),
    listTestcases: async () => [],
  } as unknown as ProblemRepository;

  const submissionsWithLookup = {
    ...submissions,
    findById: async (id: number) => {
      const row = rows.get(id);
      return row && { ...row, judgeId: row.verdict === Verdict.JUDGING ? judge.id : null };
    },
  } as unknown as SubmissionRepository;
  const service = new JudgeService(judges, submissionsWithLookup, problems, {} as StorageService, broker, events);
  return { service, queue, seen, events };
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
    );

  it('accepts an enabled judge and refuses unknown, disabled or missing tokens', async () => {
    await expect(service({ id: 1, enabled: true }).authenticate('token')).resolves.toMatchObject({ id: 1 });
    await expect(service({ id: 1, enabled: false }).authenticate('token')).rejects.toThrow(UnauthorizedError);
    await expect(service(undefined).authenticate('token')).rejects.toThrow(UnauthorizedError);
    await expect(service({ id: 1, enabled: true }).authenticate(undefined)).rejects.toThrow(UnauthorizedError);
  });
});

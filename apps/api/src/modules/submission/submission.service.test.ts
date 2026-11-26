import { AccessLevel, LANGUAGES, Language, UserLevel, Verdict } from '@yato/contract';
import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../common/errors.js';
import { config } from '../../config.js';
import type { MessageBroker } from '../../messaging/message-broker.js';
import { Queue } from '../../messaging/message-broker.js';
import { actor, admin, fake, guest, localEvents, user } from '../../testing/fixtures.js';
import type { ContestRepository } from '../contest/contest.repository.js';
import type { ProblemRepository } from '../problem/problem.repository.js';
import type { ProblemService } from '../problem/problem.service.js';
import type { SubmissionFilter, SubmissionRepository } from './submission.repository.js';
import { SubmissionService, submitIntervalSec, tooSoonMessage } from './submission.service.js';

const owner = { id: admin.id, username: admin.username, level: admin.level };
const summary = {
  id: 5,
  problemId: 3,
  problemTitle: 'A + B',
  userId: user.id,
  username: user.username,
  language: Language.CPP,
  verdict: Verdict.AC,
  score: 100,
  timeMs: 1,
  memoryKb: 1,
  createdAt: new Date(0),
};
const row = {
  ...summary,
  code: 'int main(){}',
  compileMessage: 'warning: x',
  comment: '',
  results: [],
  judgedAt: null,
};

const contestStart = new Date('2026-12-01T00:00:00Z');
const contestEnd = new Date('2026-12-01T05:00:00Z');

/**
 * `readable`: whether the viewer may read the problem, as ProblemService
 * decides it (the owner's rules, or a contest the viewer takes part in);
 * `languages`: what it allows them to submit in; `cooldowns`: those of
 * the running contests a submission would count for.
 */
function service(
  problem: { contentAccess: number; codeviewAccess: number },
  canSubmit = true,
  readable = problem.contentAccess === AccessLevel.OPEN,
  languages: readonly Language[] = LANGUAGES,
  cooldowns: readonly (number | null)[] = [],
) {
  const published: [string, unknown][] = [];
  const filters: SubmissionFilter[] = [];
  // The submission slot, as the users table would keep it (one user here).
  const slot = {
    last: undefined as Date | undefined,
    takes: 0,
    releases: 0,
    queueDown: false,
    /** Waits the next publish should go through first; one that throws fails it. */
    publishWaits: [] as (() => Promise<void>)[],
  };
  const submissions = new SubmissionService(
    fake<SubmissionRepository>({
      takeSubmitSlot: async (_userId: number, at: Date, intervalMs: number) => {
        slot.takes++;
        const previous = slot.last;
        if (intervalMs > 0 && previous && at.getTime() - previous.getTime() < intervalMs) {
          return { taken: false, previous };
        }
        // As the database does: at least 1 ms after the slot before.
        slot.last = new Date(Math.max(at.getTime(), (previous?.getTime() ?? Number.NEGATIVE_INFINITY) + 1));
        return { taken: true, slot: slot.last, previous: previous ?? null };
      },
      releaseSubmitSlot: async (_userId: number, taken: Date, previous: Date | null) => {
        slot.releases++;
        if (slot.last?.getTime() === taken.getTime()) slot.last = previous ?? undefined;
      },
      findSummary: async () => summary,
      findById: async () => row,
      reserveId: async () => 77,
      requeue: async () => [5, 6],
      list: async (_actor: unknown, filter: SubmissionFilter) => {
        filters.push(filter);
        return { rows: [summary], total: 1 };
      },
    }),
    fake<ProblemRepository>({ findById: async () => ({ problem, owner }) }),
    fake<ProblemService>({
      access: async () => {
        if (!readable) throw new ForbiddenError('You may not view this problem');
        return { canSubmit, languages, cooldowns };
      },
    }),
    fake<ContestRepository>({
      findById: async (id: number) =>
        id === 9 ? { contest: { startAt: contestStart, endAt: contestEnd, languages: [Language.CPP] } } : undefined,
      listProblems: async () => [{ problemId: 3 }, { problemId: 4 }],
    }),
    fake<MessageBroker>({
      publish: async (queue: string, message: unknown) => {
        await slot.publishWaits.shift()?.();
        if (slot.queueDown) throw new ServiceUnavailableError('The message queue is unavailable');
        published.push([queue, message]);
      },
    }),
    localEvents(),
  );
  return { submissions, published, filters, slot };
}
const publicCode = { contentAccess: AccessLevel.OPEN, codeviewAccess: AccessLevel.OPEN };
const privateCode = { contentAccess: AccessLevel.OPEN, codeviewAccess: AccessLevel.HIDDEN };

describe('SubmissionService.create', () => {
  it('reserves an id and queues the insert instead of writing it', async () => {
    const { submissions, published } = service(publicCode);
    await expect(
      submissions.create(user, { problemId: 3, language: Language.PYTHON3, code: 'print(1)' }),
    ).resolves.toEqual({ id: 77 });
    expect(published).toEqual([
      [
        Queue.WRITES,
        expect.objectContaining({ type: 'submission.create', id: 77, userId: user.id, language: Language.PYTHON3 }),
      ],
    ]);
  });

  it('needs a user account and an open problem', async () => {
    const input = { problemId: 3, language: Language.C, code: 'x' };
    await expect(service(publicCode).submissions.create(guest, input)).rejects.toThrow(UnauthorizedError);
    await expect(service(publicCode, false).submissions.create(user, input)).rejects.toThrow(ForbiddenError);
  });

  it("refuses a language the participant's running contest does not allow, and names the allowed ones", async () => {
    const { submissions, published } = service(publicCode, true, true, [Language.CPP, Language.CPP23]);
    await expect(
      submissions.create(user, { problemId: 3, language: Language.PYTHON3, code: 'print(1)' }),
    ).rejects.toThrow(new ForbiddenError('Your contest does not allow Python 3 for this problem; use C++17, C++23'));
    expect(published).toEqual([]);
    await expect(
      submissions.create(user, { problemId: 3, language: Language.CPP23, code: 'int main(){}' }),
    ).resolves.toEqual({ id: 77 });
  });
});

describe('SubmissionService.create rate limit', () => {
  const input = { problemId: 3, language: Language.CPP, code: 'int main(){}' };

  it('lets a user submit once a minute, and says how long to wait', async () => {
    const { submissions, published } = service(publicCode);
    await expect(submissions.create(user, input)).resolves.toEqual({ id: 77 });
    const refused = submissions.create(user, input);
    await expect(refused).rejects.toThrow(TooManyRequestsError);
    await expect(refused).rejects.toThrow(/You can submit once a minute\. Try again in (59|60) seconds\./);
    expect(published).toHaveLength(1);
  });

  it('only counts submissions that would be accepted', async () => {
    const closed = service(publicCode, false);
    await expect(closed.submissions.create(user, input)).rejects.toThrow(ForbiddenError);
    expect(closed.slot.takes).toBe(0);
    const wrongLanguage = service(publicCode, true, true, [Language.PYTHON3]);
    await expect(wrongLanguage.submissions.create(user, input)).rejects.toThrow(/does not allow/);
    expect(wrongLanguage.slot.takes).toBe(0);
  });

  it('gives the slot back when the submission could not be queued, so a retry need not wait', async () => {
    const { submissions, published, slot } = service(publicCode);
    slot.queueDown = true;
    await expect(submissions.create(user, input)).rejects.toThrow(ServiceUnavailableError);
    expect(slot.releases).toBe(1);
    slot.queueDown = false;
    await expect(submissions.create(user, input)).resolves.toEqual({ id: 77 });
    expect(published).toHaveLength(1);
  });

  it('exempts administrators, who test problems', async () => {
    const { submissions, published, slot } = service(publicCode);
    await submissions.create(admin, input);
    await submissions.create(admin, input);
    expect(published).toHaveLength(2);
    expect(slot.takes).toBe(0);
  });

  it("follows the cooldown of the running contest the submission counts for, not the site's", async () => {
    const none = service(publicCode, true, true, LANGUAGES, [0]);
    await none.submissions.create(user, input);
    await none.submissions.create(user, input);
    expect(none.published).toHaveLength(2);
    // Even without a wait the slot is taken: the next submission elsewhere is timed from it.
    expect(none.slot.last).toBeDefined();

    const long = service(publicCode, true, true, LANGUAGES, [120]);
    await long.submissions.create(user, input);
    await expect(long.submissions.create(user, input)).rejects.toThrow(
      /^You can submit once every 120 seconds\. Try again in (119|120) seconds\.$/,
    );

    const inherits = service(publicCode, true, true, LANGUAGES, [null]);
    await inherits.submissions.create(user, input);
    await expect(inherits.submissions.create(user, input)).rejects.toThrow(/once a minute/);
  });

  it('restores the previous slot exactly when a submission cannot be queued', async () => {
    const { submissions, slot } = service(publicCode, true, true, LANGUAGES, [0]);
    const previous = new Date(Date.now() - 10_000);
    slot.last = previous;
    slot.queueDown = true;
    await expect(submissions.create(user, input)).rejects.toThrow(ServiceUnavailableError);
    // Not cleared: a submission elsewhere must still wait from 10 seconds ago.
    expect(slot.last).toBe(previous);
  });

  it("never gives back another request's slot, even one taken in the same millisecond", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-26T03:00:00.000Z'));
      const { submissions, slot } = service(publicCode, true, true, LANGUAGES, [0]);
      const previous = new Date('2026-11-26T02:59:00.000Z');
      slot.last = previous;
      // A takes the slot, then waits on the queue, which fails it later.
      let failA: (error: Error) => void = () => undefined;
      slot.publishWaits.push(() => new Promise<void>((_, reject) => (failA = reject)));
      const a = submissions.create(user, input);
      // Event-loop turns only: vi.waitFor would move the fake clock on.
      while (slot.takes < 1) await new Promise((resolve) => setImmediate(resolve));
      // B, in the same millisecond, is queued.
      await expect(submissions.create(user, input)).resolves.toEqual({ id: 77 });
      const bSlot = slot.last;
      failA(new ServiceUnavailableError('The message queue is unavailable'));
      await expect(a).rejects.toThrow(ServiceUnavailableError);
      // A's give-back does not touch B's slot: the next wait still counts from B.
      expect(slot.last).toBe(bSlot);
      expect(bSlot?.getTime()).toBe(new Date('2026-11-26T03:00:00.001Z').getTime());
    } finally {
      vi.useRealTimers();
    }
  });

  it('is off with SUBMIT_INTERVAL_SEC=0', async () => {
    const saved = config.submitIntervalSec;
    config.submitIntervalSec = 0;
    try {
      const { submissions, published } = service(publicCode);
      await submissions.create(user, input);
      await submissions.create(user, input);
      expect(published).toHaveLength(2);
    } finally {
      config.submitIntervalSec = saved;
    }
  });
});

describe('submitIntervalSec', () => {
  it("uses the site's default outside contests and for contests that keep it", () => {
    expect(submitIntervalSec([], 60)).toBe(60);
    expect(submitIntervalSec([null], 60)).toBe(60);
  });

  it('lets a contest set its own, shorter or longer; the longest of several running ones holds', () => {
    expect(submitIntervalSec([0], 60)).toBe(0);
    expect(submitIntervalSec([300], 60)).toBe(300);
    expect(submitIntervalSec([300, 0], 60)).toBe(300);
    expect(submitIntervalSec([30, null], 60)).toBe(60);
  });
});

describe('tooSoonMessage', () => {
  const previous = new Date('2026-11-25T12:00:00Z');
  const later = (ms: number) => new Date(previous.getTime() + ms);

  it('rounds the wait up to whole seconds, never below one', () => {
    expect(tooSoonMessage(previous, later(15_000), 60)).toBe('You can submit once a minute. Try again in 45 seconds.');
    expect(tooSoonMessage(previous, later(59_500), 60)).toBe('You can submit once a minute. Try again in 1 second.');
    expect(tooSoonMessage(previous, later(60_000), 60)).toBe('You can submit once a minute. Try again in 1 second.');
  });

  it('names other intervals in seconds', () => {
    expect(tooSoonMessage(previous, later(0), 30)).toBe(
      'You can submit once every 30 seconds. Try again in 30 seconds.',
    );
  });
});

describe('SubmissionService.get', () => {
  const stranger = actor(30);

  it('shows the author everything', async () => {
    const own = await service(privateCode).submissions.get(user, 5);
    expect(own).toMatchObject({ code: row.code, compileMessage: row.compileMessage, canRejudge: false });
  });

  it('shows others the code only when the problem publishes it, never the compiler output', async () => {
    expect(await service(privateCode).submissions.get(stranger, 5)).toMatchObject({ code: null, compileMessage: '' });
    expect(await service(publicCode).submissions.get(stranger, 5)).toMatchObject({
      code: row.code,
      compileMessage: '',
    });
  });

  it('hides submissions to problems the viewer may not see', async () => {
    const hidden = { contentAccess: AccessLevel.HIDDEN, codeviewAccess: AccessLevel.OPEN };
    await expect(service(hidden).submissions.get(stranger, 5)).rejects.toThrow('You may not view this submission');
    await expect(service(hidden).submissions.get(admin, 5)).resolves.toMatchObject({ canRejudge: true });
  });

  it('links results to testdata only for those who may edit the problem, a stricter rule than rejudging', async () => {
    const hidden = { contentAccess: AccessLevel.HIDDEN, codeviewAccess: AccessLevel.OPEN };
    const peer = actor(31, UserLevel.ADMIN);
    // The problem's owner is an administrator too; a peer may not see their hidden problem.
    expect(await service(hidden).submissions.get(admin, 5)).toMatchObject({
      canRejudge: true,
      canInspectTestdata: true,
    });
    expect(await service(hidden).submissions.get(peer, 5)).toMatchObject({
      canRejudge: true,
      canInspectTestdata: false,
    });
    expect(await service(publicCode).submissions.get(peer, 5)).toMatchObject({ canInspectTestdata: true });
    expect(await service(publicCode).submissions.get(user, 5)).toMatchObject({ canInspectTestdata: false });
  });

  it("shows contest participants each other's results (the scoreboard links them), but not the code", async () => {
    const contestOnly = { contentAccess: AccessLevel.HIDDEN, codeviewAccess: AccessLevel.HIDDEN };
    const seen = await service(contestOnly, true, true).submissions.get(stranger, 5);
    expect(seen).toMatchObject({ verdict: summary.verdict, code: null, compileMessage: '' });
  });
});

describe('SubmissionService.rejudgeProblem', () => {
  it('queues every reset submission for the judges', async () => {
    const { submissions, published } = service(publicCode);
    await expect(submissions.rejudgeProblem(admin, 3)).resolves.toEqual({ count: 2 });
    expect(published).toEqual([
      [Queue.JUDGE, { submissionId: 5 }],
      [Queue.JUDGE, { submissionId: 6 }],
    ]);
    await expect(submissions.rejudgeProblem(user, 3)).rejects.toThrow(ForbiddenError);
  });
});

describe('SubmissionService.list', () => {
  it('narrows to a contest: its problems, while it ran, in its languages — like its scoreboard', async () => {
    const { submissions, filters } = service(publicCode);
    await submissions.list(user, { page: 1, pageSize: 20, username: 'alice', contestId: 9 });
    expect(filters).toEqual([
      {
        username: 'alice',
        within: { problemIds: [3, 4], from: contestStart, to: contestEnd, languages: [Language.CPP] },
      },
    ]);
  });

  it('lists without a contest filter as before, and reports an unknown contest', async () => {
    const { submissions, filters } = service(publicCode);
    await submissions.list(user, { page: 1, pageSize: 20, problemId: 3 });
    expect(filters).toEqual([{ problemId: 3, within: undefined }]);
    await expect(submissions.list(user, { page: 1, pageSize: 20, contestId: 404 })).rejects.toThrow(NotFoundError);
  });
});

describe('SubmissionService.watch', () => {
  const result = (testcaseId: number, ordinal: number) => ({
    testcaseId,
    ordinal,
    verdict: Verdict.AC as number,
    timeMs: 1,
    memoryKb: 1,
    score: 1,
    message: '',
  });

  /** A submission whose stored state the test changes, as a judge and the write queue would. */
  function watched(verdict: number, readable = true) {
    const state = { ...row, verdict, results: [] as ReturnType<typeof result>[], judgedAt: null as Date | null };
    const access = { readable };
    const events = localEvents();
    const submissions = new SubmissionService(
      fake<SubmissionRepository>({
        findSummary: async () => ({ ...summary, verdict: state.verdict }),
        findById: async () => ({ ...state }),
      }),
      fake<ProblemRepository>({ findById: async () => ({ problem: publicCode, owner }) }),
      fake<ProblemService>({
        access: async () => {
          if (!access.readable) throw new ForbiddenError('You may not view this problem');
          return { canSubmit: true };
        },
      }),
      fake<ContestRepository>({}),
      fake<MessageBroker>({}),
      events,
    );
    const judged = () => {
      Object.assign(state, { verdict: Verdict.AC, results: [result(11, 0), result(12, 1)], judgedAt: new Date(1000) });
    };
    return { submissions, events, state, access, judged };
  }

  it('sends the finished submission once and ends', async () => {
    const { submissions } = watched(Verdict.AC);
    const seen = [];
    for await (const event of submissions.watch(user, 5)) seen.push(event);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: 'snapshot', submission: { id: 5, verdict: Verdict.AC } });
  });

  it('follows a run: claimed, each testcase, then the stored result', async () => {
    const { submissions, events, state, judged } = watched(Verdict.WAIT);
    const stream = submissions.watch(user, 5);
    expect((await stream.next()).value).toMatchObject({ type: 'snapshot', submission: { verdict: Verdict.WAIT } });

    state.verdict = Verdict.JUDGING;
    events.changed(5);
    expect((await stream.next()).value).toMatchObject({ type: 'snapshot', submission: { verdict: Verdict.JUDGING } });

    events.progress(5, 2, result(11, 0));
    events.progress(5, 2, result(12, 1));
    expect((await stream.next()).value).toEqual({ type: 'progress', total: 2, result: result(11, 0) });
    expect((await stream.next()).value).toEqual({ type: 'progress', total: 2, result: result(12, 1) });

    judged();
    events.changed(5);
    const last = (await stream.next()).value;
    expect(last).toMatchObject({ type: 'snapshot', submission: { verdict: Verdict.AC } });
    expect(last).toMatchObject({ submission: { results: [result(11, 0), result(12, 1)] } });
    expect((await stream.next()).done).toBe(true);
  });

  it('shows a viewer who arrives mid-run the testcases already done', async () => {
    const { submissions, events } = watched(Verdict.JUDGING);
    events.progress(5, 3, result(11, 0));
    const stream = submissions.watch(user, 5);
    expect((await stream.next()).value).toMatchObject({ type: 'snapshot' });
    expect((await stream.next()).value).toEqual({ type: 'progress', total: 3, result: result(11, 0) });
    await stream.return(undefined);
  });

  it('finds the result by itself when the event about it was lost', async () => {
    const { submissions, judged } = watched(Verdict.JUDGING);
    const stream = submissions.watch(user, 5, undefined, 5);
    await stream.next();
    judged(); // and nobody announces it
    expect((await stream.next()).value).toMatchObject({ type: 'snapshot', submission: { verdict: Verdict.AC } });
    expect((await stream.next()).done).toBe(true);
  });

  it('refuses viewers who may not see the submission, also once the stream runs', async () => {
    const stranger = actor(30);
    await expect(watched(Verdict.WAIT, false).submissions.watch(stranger, 5).next()).rejects.toThrow(ForbiddenError);

    const { submissions, events, access } = watched(Verdict.WAIT);
    const stream = submissions.watch(stranger, 5);
    await stream.next();
    access.readable = false;
    events.changed(5);
    await expect(stream.next()).rejects.toThrow(ForbiddenError);
  });

  it('stops listening when the viewer leaves', async () => {
    const { submissions, events } = watched(Verdict.WAIT);
    const leave = new AbortController();
    const stream = submissions.watch(user, 5, leave.signal);
    await stream.next();
    const ended = stream.next();
    leave.abort();
    expect((await ended).done).toBe(true);

    // Nobody is left to hear this.
    const heard: unknown[] = [];
    events.listen(6, (event) => heard.push(event));
    events.changed(5);
    expect(heard).toEqual([]);
    expect((events as unknown as { listeners: Map<number, unknown> }).listeners.has(5)).toBe(false);
  });
});

import { Injectable } from '@nestjs/common';
import { AccessLevel, type Language, languageName, Verdict } from '@yato/contract';
import { type Actor, isAdmin, requireAdmin, requireUser } from '../../common/actor.js';
import { ForbiddenError, NotFoundError, TooManyRequestsError } from '../../common/errors.js';
import { type PageInput, pageOf } from '../../common/pagination.js';
import { config } from '../../config.js';
import type { JudgeTaskMessage, WriteCommand } from '../../messaging/commands.js';
import { MessageBroker, Queue } from '../../messaging/message-broker.js';
import { ContestRepository } from '../contest/contest.repository.js';
import { ProblemRepository } from '../problem/problem.repository.js';
import { mayEdit, ProblemService } from '../problem/problem.service.js';
import { Mailbox, type SubmissionBusEvent, SubmissionEvents } from './submission.events.js';
import { type SubmissionFilter, SubmissionRepository } from './submission.repository.js';

/**
 * How long a stream waits for an event before reading the submission again
 * itself: events are best effort, the database is not.
 */
const WATCH_RECHECK_MS = 10_000;

const isPending = (verdict: Verdict) => verdict === Verdict.WAIT || verdict === Verdict.JUDGING;

/**
 * Why a submission made at `now` is refused, when the previous one was at
 * `previous` and users may submit once every `intervalSec` seconds.
 */
/**
 * Seconds a user must wait between submissions: the longest cooldown of the
 * running contests a submission counts for (`cooldowns`, null where one
 * keeps the site's default), or the site's default where there is none.
 */
export function submitIntervalSec(cooldowns: readonly (number | null)[], siteDefaultSec: number): number {
  if (cooldowns.length === 0) return siteDefaultSec;
  return Math.max(...cooldowns.map((cooldown) => cooldown ?? siteDefaultSec));
}

export function tooSoonMessage(previous: Date, now: Date, intervalSec: number): string {
  const wait = Math.max(1, Math.ceil((previous.getTime() + intervalSec * 1000 - now.getTime()) / 1000));
  const rate = intervalSec === 60 ? 'once a minute' : `once every ${intervalSec} seconds`;
  return `You can submit ${rate}. Try again in ${wait} second${wait === 1 ? '' : 's'}.`;
}

type SummaryRow = NonNullable<Awaited<ReturnType<SubmissionRepository['findSummary']>>>;

function toSummary(row: SummaryRow) {
  return {
    id: row.id,
    problem: { id: row.problemId, title: row.problemTitle },
    user: { id: row.userId, username: row.username },
    language: row.language as Language,
    verdict: row.verdict as Verdict,
    score: row.score,
    timeMs: row.timeMs,
    memoryKb: row.memoryKb,
    createdAt: row.createdAt.toISOString(),
  };
}

const asResult = <T extends { verdict: number }>(result: T) => ({ ...result, verdict: result.verdict as Verdict });

@Injectable()
export class SubmissionService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly problems: ProblemRepository,
    private readonly problemService: ProblemService,
    private readonly contests: ContestRepository,
    private readonly broker: MessageBroker,
    private readonly events: SubmissionEvents,
  ) {}

  /**
   * Accepts a submission; a judge machine picks it up asynchronously. Users
   * may submit once every `SUBMIT_INTERVAL_SEC` seconds, or as often as the
   * running contests the submission counts for allow (`submitIntervalSec`);
   * administrators, who test problems, are exempt.
   */
  async create(actor: Actor, input: { problemId: number; language: Language; code: string }): Promise<{ id: number }> {
    requireUser(actor);
    const { canSubmit, languages, cooldowns } = await this.problemService.access(actor, input.problemId);
    if (!canSubmit) throw new ForbiddenError('Submissions are closed for this problem');
    if (!languages.includes(input.language)) {
      throw new ForbiddenError(
        `Your contest does not allow ${languageName(input.language)} for this problem; use ${languages.map(languageName).join(', ')}`,
      );
    }
    // Only a submission that would be accepted takes the user's slot. It is
    // taken even without a wait, so the next one is timed from this one.
    const now = new Date();
    const interval = submitIntervalSec(cooldowns, config.submitIntervalSec);
    const slot = isAdmin(actor) ? null : await this.submissions.takeSubmitSlot(actor.id, now, interval * 1000);
    if (slot && !slot.taken) throw new TooManyRequestsError(tooSoonMessage(slot.previous, now, interval));
    try {
      // Reserve the id, queue the insert, answer. The row appears as soon as
      // the write-queue consumer gets to it (normally within milliseconds).
      const id = await this.submissions.reserveId();
      await this.broker.publish(Queue.WRITES, {
        type: 'submission.create',
        id,
        userId: actor.id,
        createdAt: now.toISOString(),
        ...input,
      } satisfies WriteCommand);
      return { id };
    } catch (error) {
      // Nothing was queued ("safe to retry"): a retry must not have to wait.
      // Should that fail too, the original error is still the one to report.
      if (slot?.taken) {
        await this.submissions.releaseSubmitSlot(actor.id, slot.slot, slot.previous).catch(() => undefined);
      }
      throw error;
    }
  }

  async list(actor: Actor, input: PageInput & Omit<SubmissionFilter, 'within'> & { contestId?: number }) {
    const { contestId, page, pageSize, ...filter } = input;
    const within = contestId === undefined ? undefined : await this.contestWindow(contestId);
    const { rows, total } = await this.submissions.list(actor, { ...filter, within }, { page, pageSize });
    return pageOf(rows.map(toSummary), total, { page, pageSize });
  }

  /**
   * What counts for a contest: its problems, during `[startAt, endAt)`, in
   * the languages it allows, as on its scoreboard.
   */
  private async contestWindow(contestId: number): Promise<NonNullable<SubmissionFilter['within']>> {
    const found = await this.contests.findById(contestId);
    if (!found) throw new NotFoundError('Contest');
    const problems = await this.contests.listProblems(contestId);
    const { startAt, endAt, languages } = found.contest;
    return { problemIds: problems.map((p) => p.problemId), from: startAt, to: endAt, languages };
  }

  async get(actor: Actor, id: number) {
    const [summary, row] = await Promise.all([this.submissions.findSummary(id), this.submissions.findById(id)]);
    if (!summary || !row) throw new NotFoundError('Submission');
    const found = await this.problems.findById(row.problemId);
    if (!found) throw new NotFoundError('Problem');

    const own = actor.id === row.userId;
    const admin = isAdmin(actor);
    // Whoever may read the problem — contest participants included — may see
    // how others did on it (the scoreboard links here); the code has its own rule.
    if (!own && !admin) {
      await this.problemService.access(actor, row.problemId).catch((error: unknown) => {
        throw error instanceof ForbiddenError ? new ForbiddenError('You may not view this submission') : error;
      });
    }
    const canReadCode = own || admin || found.problem.codeviewAccess === AccessLevel.OPEN;

    return {
      ...toSummary(summary),
      code: canReadCode ? row.code : null,
      compileMessage: own || admin ? row.compileMessage : '',
      comment: row.comment,
      results: row.results.map(asResult),
      judgedAt: row.judgedAt?.toISOString() ?? null,
      canRejudge: admin,
      canInspectTestdata: mayEdit(actor, found),
    };
  }

  /**
   * Follows one submission while it is judged: its current state, then each
   * testcase as a judge finishes it and the state again whenever it changes,
   * until it has a verdict. Every state is read with `get`, so the viewer
   * sees exactly what the page would show, and loses the stream with the
   * right to see the submission.
   *
   * `recheckMs` is how long to go without an event before looking for
   * itself; `signal` ends the stream when the viewer leaves.
   */
  async *watch(actor: Actor, id: number, signal?: AbortSignal, recheckMs = WATCH_RECHECK_MS) {
    const inbox = new Mailbox<SubmissionBusEvent>();
    // Listen first, then read: nothing that happens in between is missed.
    const stop = this.events.listen(id, (event) => inbox.push(event));
    try {
      let submission = await this.get(actor, id);
      yield { type: 'snapshot' as const, submission };

      // Testcases finished before this viewer arrived. One that is also still
      // in the inbox arrives twice, with the same content.
      const known = submission.verdict === Verdict.JUDGING ? this.events.progressOf(id) : undefined;
      for (const result of known?.results ?? []) {
        yield { type: 'progress' as const, total: known?.total ?? 0, result: asResult(result) };
      }

      while (isPending(submission.verdict) && !signal?.aborted) {
        const event = await inbox.next(recheckMs, signal);
        if (signal?.aborted) return;
        if (event?.kind === 'progress') {
          yield { type: 'progress' as const, total: event.total, result: asResult(event.result) };
          continue;
        }
        const current = await this.get(actor, id);
        // Nothing heard and nothing new: keep waiting quietly.
        if (!event && current.verdict === submission.verdict && current.judgedAt === submission.judgedAt) continue;
        submission = current;
        yield { type: 'snapshot' as const, submission };
      }
    } finally {
      stop();
    }
  }

  async rejudge(actor: Actor, id: number): Promise<void> {
    requireAdmin(actor);
    const ids = await this.submissions.requeue({ id });
    if (ids.length === 0) throw new NotFoundError('Submission');
    await this.enqueue(ids);
  }

  async rejudgeProblem(actor: Actor, problemId: number): Promise<{ count: number }> {
    requireAdmin(actor);
    const ids = await this.submissions.requeue({ problemId });
    await this.enqueue(ids);
    return { count: ids.length };
  }

  private async enqueue(ids: number[]): Promise<void> {
    for (const submissionId of ids) {
      await this.broker.publish(Queue.JUDGE, { submissionId } satisfies JudgeTaskMessage);
      this.events.changed(submissionId);
    }
  }

  async setComment(actor: Actor, id: number, comment: string, verdict?: Verdict): Promise<void> {
    requireAdmin(actor);
    if (!(await this.submissions.findById(id))) throw new NotFoundError('Submission');
    await this.submissions.review(id, comment, verdict);
    this.events.changed(id);
  }
}

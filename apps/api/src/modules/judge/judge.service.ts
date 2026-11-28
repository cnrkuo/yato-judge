import { Injectable } from '@nestjs/common';
import { type Language, Verdict } from '@yato/contract';
import { sha256 } from '../../common/crypto.js';
import { NotFoundError, UnauthorizedError } from '../../common/errors.js';
import type { WriteCommand } from '../../messaging/commands.js';
import { JudgeQueue } from '../../messaging/judge-queue.js';
import { MessageBroker, Queue } from '../../messaging/message-broker.js';
import { StorageService } from '../../storage/storage.service.js';
import { ProblemRepository } from '../problem/problem.repository.js';
import type { JudgeReport } from '../submission/judging.js';
import { SubmissionEvents } from '../submission/submission.events.js';
import { SubmissionRepository, type SubmissionRow } from '../submission/submission.repository.js';
import { JudgeRepository, type JudgeRow } from './judge.repository.js';

/** Upper bound on outdated tasks skipped by one look at the queue. */
const MAX_SKIPPED_TASKS = 50;

/** Longest a fetch is held open for a judge, whatever it asks for. */
export const MAX_FETCH_WAIT_SEC = 30;
/**
 * A waiting fetch looks at the queue again this often even without an
 * announcement: announcements are best effort (a broker reconnect drops them).
 */
const RECHECK_MS = 5_000;
/** How often a waiting judge is marked as seen; the admin page calls it offline after 30 s. */
const TOUCH_EVERY_MS = 10_000;

export interface FetchOptions {
  /**
   * Seconds to hold the request open while no submission is waiting (long
   * polling), capped at `MAX_FETCH_WAIT_SEC`. 0 answers at once.
   */
  waitSec?: number;
  /** Aborts when the judge hangs up; the fetch then stops and claims nothing. */
  signal?: AbortSignal;
}

/**
 * Server side of the judge-machine protocol: hands out queued submissions,
 * serves testdata and queues the judges' reports (which
 * `SubmissionResultService` turns into verdicts and scores).
 */
@Injectable()
export class JudgeService {
  constructor(
    private readonly judges: JudgeRepository,
    private readonly submissions: SubmissionRepository,
    private readonly problems: ProblemRepository,
    private readonly storage: StorageService,
    private readonly broker: MessageBroker,
    private readonly events: SubmissionEvents,
    private readonly queue: JudgeQueue,
  ) {}

  /** Judge machines authenticate with their own token, not a user session. */
  async authenticate(token: string | undefined): Promise<JudgeRow> {
    const judge = token ? await this.judges.findByTokenHash(sha256(token)) : undefined;
    if (!judge?.enabled) throw new UnauthorizedError('Invalid judge token');
    return judge;
  }

  /**
   * Hands the next queued submission to a judge, or `{ task: null }`.
   *
   * With `waitSec`, an empty queue does not answer at once: the request is
   * held until a submission the judge can run is queued (announced on the
   * events exchange by `JudgeQueue`), the time is up, the judge hangs up or
   * the API shuts down. Judges thus pick up work as soon as it arrives
   * without asking every second.
   *
   * A judge that lists its `languages` only gets submissions in those.
   */
  async fetch(judge: JudgeRow, languages?: readonly string[], { waitSec = 0, signal }: FetchOptions = {}) {
    const deadline = Date.now() + Math.min(Math.max(waitSec, 0), MAX_FETCH_WAIT_SEC) * 1000;
    let touchedAt = Number.NEGATIVE_INFINITY;
    for (;;) {
      if (signal?.aborted) return { task: null };
      if (Date.now() - touchedAt >= TOUCH_EVERY_MS) {
        await this.judges.touch(judge.id, languages);
        touchedAt = Date.now();
      }
      // Listen before looking, so a task queued in between is not missed.
      const doorbell = this.queue.listen(languages);
      try {
        const submission = await this.claimNext(judge, languages);
        if (submission) {
          // The judge hung up while the claim was being made: nobody would
          // judge it before the claim times out, so give it back now.
          if (signal?.aborted) {
            await this.giveBack(submission, judge);
            return { task: null };
          }
          this.events.changed(submission.id);
          return { task: await this.taskOf(submission) };
        }
        const left = deadline - Date.now();
        if (left <= 0 || this.queue.closed) return { task: null };
        await doorbell.wait(Math.min(left, RECHECK_MS), signal);
      } finally {
        doorbell.stop();
      }
    }
  }

  /**
   * Claims the next queued submission the judge can run. Tasks come from
   * RabbitMQ; the claim in the database makes sure a duplicate or outdated
   * task (for a submission that is no longer waiting) is skipped rather than
   * judged twice.
   *
   * A task in a language the judge cannot run goes back to the end of the
   * queue, announced for judges that have the toolchain, so a fleet can mix
   * machines with different compilers.
   */
  private async claimNext(judge: JudgeRow, languages?: readonly string[]): Promise<SubmissionRow | undefined> {
    const deferred = new Set<number>();
    for (let skipped = 0; skipped < MAX_SKIPPED_TASKS; skipped++) {
      const task = await this.queue.pull();
      if (!task) return undefined;
      const submission = await this.submissions.claim(task.submissionId, judge.id, languages);
      if (submission) return submission;
      if (!languages) continue;
      const language = await this.submissions.waitingLanguage(task.submissionId);
      if (language === undefined) continue;
      // Waiting, but in a language this judge cannot run.
      await this.queue.push(task.submissionId, language);
      // Seen it before: the queue has gone round once with nothing for us.
      if (deferred.has(task.submissionId)) return undefined;
      deferred.add(task.submissionId);
    }
    return undefined;
  }

  private async giveBack(submission: SubmissionRow, judge: JudgeRow): Promise<void> {
    if (await this.submissions.release(submission.id, judge.id)) {
      await this.queue.push(submission.id, submission.language);
    }
  }

  private async taskOf(submission: SubmissionRow) {
    const [found, testcases] = await Promise.all([
      this.problems.findById(submission.problemId),
      this.problems.listTestcases(submission.problemId),
    ]);
    if (!found) throw new NotFoundError('Problem');
    return {
      submissionId: submission.id,
      problemId: submission.problemId,
      language: submission.language as Language,
      code: submission.code,
      timeLimitMs: found.problem.timeLimitMs,
      memoryLimitKb: found.problem.memoryLimitKb,
      testcases: testcases.map(({ id, ordinal, inputSha256, outputSha256 }) => ({
        id,
        ordinal,
        inputSha256,
        outputSha256,
      })),
      checker: found.problem.checker ? { sha256: sha256(found.problem.checker), source: found.problem.checker } : null,
    };
  }

  async testdata(testcaseId: number, kind: 'input' | 'output'): Promise<File> {
    const testcase = await this.problems.findTestcase(testcaseId);
    if (!testcase) throw new NotFoundError('Testcase');
    const hash = kind === 'input' ? testcase.inputSha256 : testcase.outputSha256;
    const data = await this.storage.get(StorageService.testdataKey(testcase.problemId, hash));
    return new File([new Uint8Array(data)], `${testcase.id}.${kind}`, { type: 'application/octet-stream' });
  }

  /**
   * Passes one finished testcase on to whoever is watching the submission.
   * Only the judge the submission is currently claimed by is listened to;
   * anything else (a judge that was timed out, a rejudged submission) is
   * dropped without complaint.
   */
  async progress(
    judge: JudgeRow,
    input: { submissionId: number; total: number; result: JudgeReport['results'][number] & { ordinal: number } },
  ): Promise<void> {
    const submission = await this.submissions.findById(input.submissionId);
    if (submission?.judgeId !== judge.id || submission.verdict !== Verdict.JUDGING) return;
    this.events.progress(submission.id, input.total, input.result);
  }

  /**
   * Accepts a judge's report. The result is not written here: it is queued,
   * and the write-queue consumer stores it. Once this returns the report is
   * durable, so the judge can move on.
   */
  async report(judge: JudgeRow, report: JudgeReport): Promise<void> {
    await this.broker.publish(Queue.WRITES, {
      type: 'submission.result',
      judgeId: judge.id,
      report,
    } satisfies WriteCommand);
  }
}

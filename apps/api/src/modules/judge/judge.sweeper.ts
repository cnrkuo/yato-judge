import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { config } from '../../config.js';
import { JudgeQueue } from '../../messaging/judge-queue.js';
import { SubmissionEvents } from '../submission/submission.events.js';
import { SubmissionRepository } from '../submission/submission.repository.js';

const SWEEP_INTERVAL_MS = 30_000;
/** A waiting submission younger than this may simply still be in flight. */
const ORPHAN_GRACE_MS = 60_000;

/**
 * Keeps the judge queue and the database in agreement.
 *
 * - A submission stuck in "Judging" past `JUDGE_TIMEOUT_SEC` lost its judge:
 *   it goes back to waiting and is queued again.
 * - When the judge queue is empty yet submissions are still waiting, their
 *   tasks were lost (broker reset, crash between two steps): queue them again.
 *   Checking for an empty queue first keeps duplicates from piling up while
 *   no judge is connected.
 */
@Injectable()
export class JudgeSweeper implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JudgeSweeper.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly queue: JudgeQueue,
    private readonly submissions: SubmissionRepository,
    private readonly events: SubmissionEvents,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    try {
      const stale = await this.submissions.releaseStale(new Date(Date.now() - config.judgeTimeoutSec * 1000));
      for (const id of stale) this.events.changed(id);
      let orphans: number[] = [];
      if ((await this.queue.depth()) === 0) {
        orphans = await this.submissions.waitingIds(new Date(Date.now() - ORPHAN_GRACE_MS), 1000);
      }
      const ids = [...new Set([...stale, ...orphans])].sort((a, b) => a - b);
      for (const submissionId of ids) {
        await this.queue.push(submissionId);
      }
      if (ids.length > 0) this.logger.warn(`Re-queued ${ids.length} submission(s) for judging`);
    } catch (error) {
      this.logger.warn(`Sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

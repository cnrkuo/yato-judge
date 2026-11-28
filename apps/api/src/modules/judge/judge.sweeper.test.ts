import { describe, expect, it } from 'vitest';
import type { JudgeQueue } from '../../messaging/judge-queue.js';
import { fake, localEvents } from '../../testing/fixtures.js';
import type { SubmissionRepository } from '../submission/submission.repository.js';
import { JudgeSweeper } from './judge.sweeper.js';

function setup(queueDepth: number, stale: number[], waiting: number[]) {
  const published: unknown[] = [];
  const sweeper = new JudgeSweeper(
    fake<JudgeQueue>({
      depth: async () => queueDepth,
      // Without the language at hand: every waiting judge is woken.
      push: async (submissionId: number, language?: string) => void published.push([submissionId, language]),
    }),
    fake<SubmissionRepository>({ releaseStale: async () => stale, waitingIds: async () => waiting }),
    localEvents(),
  );
  return { sweeper, published };
}

describe('JudgeSweeper.sweep', () => {
  it('requeues submissions whose judge went silent', async () => {
    const { sweeper, published } = setup(3, [8], [1, 2]);
    await sweeper.sweep();
    // The queue still holds tasks, so waiting submissions are not orphans.
    expect(published).toEqual([[8, undefined]]);
  });

  it('requeues waiting submissions once the queue is empty, each once, oldest first', async () => {
    const { sweeper, published } = setup(0, [5], [5, 2]);
    await sweeper.sweep();
    expect(published).toEqual([
      [2, undefined],
      [5, undefined],
    ]);
  });

  it('survives a broker or database outage', async () => {
    const sweeper = new JudgeSweeper(
      fake<JudgeQueue>({}),
      fake<SubmissionRepository>({
        releaseStale: async () => {
          throw new Error('connection refused');
        },
      }),
      localEvents(),
    );
    await expect(sweeper.sweep()).resolves.toBeUndefined();
  });
});

import { Injectable } from '@nestjs/common';
import type { createSubmissionInput } from '@yato/shared/contracts';
import * as R from 'remeda';
import type { InferOutput } from 'valibot';

import { JudgeResultEvent } from '$/queue/queue.events.js';
import { QueuePublisher } from '$/queue/queue.publisher.js';
import { SubmissionsRepository } from './submissions.repository.js';

export type CreateSubmissionInput = InferOutput<typeof createSubmissionInput>;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly repo: SubmissionsRepository,
    private readonly queuePublisher: QueuePublisher,
  ) {}

  async createSubmission(input: CreateSubmissionInput) {
    const created = await this.repo.create({ ...input });
    const payload = R.pick(created, ['id', 'problemId', 'language']);
    await this.queuePublisher.publishSubmissionCreated(payload);

    return created;
  }

  async getById(id: number) {
    return this.repo.getById(id);
  }

  async applyJudgeResult(event: JudgeResultEvent) {
    return this.repo.updateResult(event.submissionId, {
      state: event.state,
      verdict: event.verdict,
      runtimeMs: event.runtimeMs ?? null,
      peakMemoryKb: event.memoryKb ?? null,
      resultMeta: event.meta,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq, not } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { type Submission, type SubmissionInsert, submissions } from '@/db/schema.js';
import { InjectDatabase } from '@/providers/database.provider.js';

@Injectable()
export class SubmissionsRepository {
  constructor(
    @InjectDatabase()
    private readonly db: NodePgDatabase,
  ) {}

  async create(input: SubmissionInsert) {
    return this.db
      .insert(submissions)
      .values(input)
      .returning()
      .then(([row]) => row);
  }

  async getById(id: number) {
    return this.db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .then(([row]) => row);
  }

  async updateResult(
    submissionId: number,
    update: Pick<Submission, 'state' | 'verdict' | 'runtimeMs' | 'peakMemoryKb' | 'resultMeta'>,
  ) {
    return this.db
      .update(submissions)
      .set({ ...update })
      .where(and(eq(submissions.id, submissionId), not(eq(submissions.state, 'DONE'))))
      .returning()
      .then(([row]) => row);
  }
}

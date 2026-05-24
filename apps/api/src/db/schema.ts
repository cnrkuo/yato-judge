import {
  bigint,
  bigserial,
  boolean,
  // index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  // primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  handle: varchar('handle', { length: 64 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  rating: integer('rating').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const problems = pgTable('problems', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  title: text('title').notNull(),
  statement: text('statement').notNull(),
  timeLimitMs: integer('time_limit_ms').notNull().default(1000),
  memoryLimitKb: integer('memory_limit_kb').notNull().default(262144),
  isPublic: boolean('is_public').default(false).notNull(),
  createdBy: bigint('created_by', { mode: 'number' })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // updatedAt: timestamp('updated_at', { withTimezone: true })
  //   .defaultNow()
  //   .$onUpdateFn(() => sql`now()`) // orm-level updating
  //   .notNull(),
});

export const submissionStates = pgEnum('submission_states', [
  'ENQUEUED',
  'FETCHED',
  'COMPILING',
  'RUNNING',
  'AGGREGATING',
  'DONE',
]);

export const submissionVerdicts = pgEnum('submission_verdicts', [
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'RUNTIME_ERROR_SIGNAL_TERMINATED',
  'COMPILE_ERROR',
  'INTERNAL_ERROR',
]);

export const submissions = pgTable(
  'submissions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    problemId: bigint('problem_id', { mode: 'number' })
      .references(() => problems.id, { onDelete: 'cascade' })
      .notNull(),
    // contestId: bigint('contest_id', { mode: 'number' }).references(() => contests.id),
    language: text('language').notNull(),
    sourceCode: text('source_code').notNull(),
    state: submissionStates('state').notNull().default('ENQUEUED'),
    verdict: submissionVerdicts('verdict'),
    score: integer('score').default(0),
    runtimeMs: integer('runtime_ms'),
    peakMemoryKb: integer('peak_memory_kb'),
    resultMeta: jsonb('result_meta'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    judgedAt: timestamp('judged_at', { withTimezone: true }),
  },
  // (t) => [
  //   index('idx_submissions_user_time').on(t.userId, t.submittedAt),
  //   index('idx_submissions_contest').on(t.contestId),
  //   index('idx_submissions_problem').on(t.problemId),
  //   index('idx_submissions_verdict')
  //     .on(t.verdict)
  //     .where(sql`state IN ('ENQUEUED', 'FETCHED', 'COMPILING', 'RUNNING', 'AGGREGATING')`),
  //   index('idx_submissions_problem_verdict').on(t.problemId, t.verdict),
  //   index('idx_submissions_user_problem').on(t.userId, t.problemId),
  // ],
);

// export const testcases = pgTable(
//   'testcases',
//   {
//     id: bigserial('id', { mode: 'number' }).primaryKey(),
//     problemId: bigint('problem_id', { mode: 'number' })
//       .references(() => problems.id, { onDelete: 'cascade' })
//       .notNull(),
//     order: integer('order').notNull().default(0),
//     isSample: boolean('is_sample').default(false).notNull(),
//     scoreWeight: integer('score_weight').default(0).notNull(),
//     inputUrl: text('input_url'),
//     outputUrl: text('output_url'),
//     inputText: text('input_text'),
//     outputText: text('output_text'),
//   },
//   (t) => [index('idx_testcases_problem').on(t.problemId)],
// );

// export const contests = pgTable('contests', {
//   id: bigserial('id', { mode: 'number' }).primaryKey(),
//   title: text('title').notNull(),
//   description: text('description'),
//   startTime: timestamp('start_time', { withTimezone: true }).notNull(),
//   endTime: timestamp('end_time', { withTimezone: true }).notNull(),
//   isPublic: boolean('is_public').default(false).notNull(),
//   createdBy: bigint('created_by', { mode: 'number' })
//     .references(() => users.id)
//     .notNull(),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
// });
//
// export const contestProblems = pgTable(
//   'contest_problems',
//   {
//     contestId: bigint('contest_id', { mode: 'number' })
//       .references(() => contests.id, { onDelete: 'cascade' })
//       .notNull(),
//     problemId: bigint('problem_id', { mode: 'number' })
//       .references(() => problems.id, { onDelete: 'cascade' })
//       .notNull(),
//     label: varchar('label', { length: 8 }).notNull(),
//   },
//   (t) => [primaryKey({ columns: [t.contestId, t.problemId] })],
// );
//
// export const contestParticipants = pgTable(
//   'contest_participants',
//   {
//     contestId: bigint('contest_id', { mode: 'number' })
//       .references(() => contests.id, { onDelete: 'cascade' })
//       .notNull(),
//     userId: bigint('user_id', { mode: 'number' })
//       .references(() => users.id, { onDelete: 'cascade' })
//       .notNull(),
//     isVirtual: boolean('is_virtual').default(false).notNull(),
//     registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
//   },
//   (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
// );

export type Submission = typeof submissions.$inferSelect;
export type SubmissionInsert = typeof submissions.$inferInsert;

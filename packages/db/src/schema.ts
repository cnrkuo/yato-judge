import { sql } from "drizzle-orm"
import { bigint, bigserial, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  handle: varchar("handle", { length: 64 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  rating: bigint("rating", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
})

export const problems = pgTable("problems", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  timeLimitMs: integer("time_limit_ms").notNull(),
  memoryLimit: bigint("memory_limit", { mode: "number" }).notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
})

export const submissions = pgTable(
  "submissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    problemId: integer("problem_id").notNull(),
    contestId: integer("contest_id"),
    language: text("language").notNull(),
    sourceCode: text("source_code").notNull(),
    status: text("status").notNull().default("Q"),
    score: integer("score").default(0),
    totalTimeMs: integer("total_time_ms"),
    totalMemoryKb: integer("total_memory_kb"),
    verdictDetail: jsonb("verdict_detail"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    judgedAt: timestamp("judged_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_submissions_user_time").on(t.userId, t.submittedAt),
    index("idx_submissions_contest").on(t.contestId),
    index("idx_submissions_problem").on(t.problemId),
    index("idx_submissions_status").on(t.status),
  ],
)

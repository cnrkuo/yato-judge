import * as v from 'valibot';

export const submissionCreatedEventSchema = v.object({
  id: v.number(),
  problemId: v.number(),
  language: v.string(),
});

export type SubmissionCreatedEvent = v.InferOutput<typeof submissionCreatedEventSchema>;

export const judgeResultEventSchema = v.object({
  submissionId: v.number(),
  state: v.picklist(['ENQUEUED', 'FETCHED', 'COMPILING', 'RUNNING', 'AGGREGATING', 'DONE']),
  verdict: v.picklist([
    'ACCEPTED',
    'WRONG_ANSWER',
    'TIME_LIMIT_EXCEEDED',
    'MEMORY_LIMIT_EXCEEDED',
    'RUNTIME_ERROR',
    'RUNTIME_ERROR_SIGNAL_TERMINATED',
    'COMPILE_ERROR',
    'INTERNAL_ERROR',
  ]),
  runtimeMs: v.optional(v.number()),
  memoryKb: v.optional(v.number()),
  meta: v.optional(v.unknown()),
});

export type JudgeResultEvent = v.InferOutput<typeof judgeResultEventSchema>;

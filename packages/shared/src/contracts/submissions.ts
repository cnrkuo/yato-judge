import { oc, populateContractRouterPaths } from '@orpc/contract';
import * as v from 'valibot';

export const createSubmissionInput = v.object({
  userId: v.number(),
  problemId: v.number(),
  language: v.picklist(['cpp']),
  sourceCode: v.string(),
});

export const getSubmissionInput = v.object({
  id: v.number(),
});

export const submissionOutput = v.object({
  id: v.number(),
  state: v.picklist(['ENQUEUED', 'FETCHED', 'COMPILING', 'RUNNING', 'AGGREGATING', 'DONE']),
  verdict: v.nullable(
    v.picklist([
      'ACCEPTED',
      'WRONG_ANSWER',
      'TIME_LIMIT_EXCEEDED',
      'MEMORY_LIMIT_EXCEEDED',
      'RUNTIME_ERROR',
      'RUNTIME_ERROR_SIGNAL_TERMINATED',
      'COMPILE_ERROR',
      'INTERNAL_ERROR',
    ]),
  ),
  runtimeMs: v.nullable(v.number()),
  peakMemoryKb: v.nullable(v.number()),
});

const contract = oc.router({
  create: oc.input(createSubmissionInput).output(submissionOutput),
  getById: oc.input(getSubmissionInput).output(submissionOutput),
});

export const submissions = populateContractRouterPaths(contract);

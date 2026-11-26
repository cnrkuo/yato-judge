import { Injectable } from '@nestjs/common';
import { AccessLevel, type Language, ScoreMode, type Verdict } from '@yato/contract';
import { type Actor, isAdmin, isUser, requireAdmin, satisfies } from '../../common/actor.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import { type PageInput, pageOf } from '../../common/pagination.js';
import { ContestRepository } from '../contest/contest.repository.js';
import { contestGrant, NO_GRANT } from '../contest/grants.js';
import { SubmissionRepository } from '../submission/submission.repository.js';
import { type ProblemPatch, ProblemRepository, type ProblemWithOwner } from './problem.repository.js';

/**
 * Whether the actor may edit a problem (statement, testdata, attachments)
 * and read what only editors see, like its testdata: an administrator
 * who may also see the problem.
 */
export const mayEdit = (actor: Actor, { problem, owner }: ProblemWithOwner): boolean =>
  isAdmin(actor) && satisfies(actor, owner, problem.contentAccess);

export interface ProblemAccess extends ProblemWithOwner {
  canEdit: boolean;
  canSubmit: boolean;
  /** Languages the actor may submit in (see `contestGrant`). */
  languages: readonly Language[];
  /** Cooldowns of the running contests a submission would count for (see `contestGrant`). */
  cooldowns: readonly (number | null)[];
}

@Injectable()
export class ProblemService {
  constructor(
    private readonly problems: ProblemRepository,
    private readonly submissions: SubmissionRepository,
    private readonly contests: ContestRepository,
  ) {}

  /**
   * Loads a problem and works out what the actor may do with it.
   * Throws when the actor may not even read the statement.
   */
  async access(actor: Actor, id: number): Promise<ProblemAccess> {
    const found = await this.problems.findById(id);
    if (!found) throw new NotFoundError('Problem');
    const { problem, owner } = found;

    const direct = satisfies(actor, owner, problem.contentAccess);
    const canEdit = mayEdit(actor, found);
    // Contests matter when the direct rules do not let the actor read the
    // problem, and for anyone who may submit: a running contest can open
    // submissions, and can restrict their languages even where the problem
    // is open to all.
    const needGrant = !direct || isUser(actor);
    const now = new Date();
    const grant = needGrant ? contestGrant(await this.contests.entriesFor(actor.id, id, now), now) : NO_GRANT;
    if (!direct && !grant.read) throw new ForbiddenError('You may not view this problem');

    const { languages } = grant;
    const canSubmit =
      isUser(actor) && (canEdit || (direct && problem.submitOpen) || grant.submit) && languages.length > 0;
    return { problem, owner, canEdit, canSubmit, languages, cooldowns: grant.cooldowns };
  }

  /** Loads a problem the actor may edit (`mayEdit`), or throws. */
  async editable(actor: Actor, id: number): Promise<ProblemWithOwner> {
    requireAdmin(actor);
    const found = await this.problems.findById(id);
    if (!found) throw new NotFoundError('Problem');
    if (!mayEdit(actor, found)) throw new ForbiddenError('You may not edit this problem');
    return found;
  }

  async list(actor: Actor, input: PageInput & { search?: string }) {
    const { rows, total } = await this.problems.listVisible(actor, input, input.search);
    const ids = rows.map((row) => row.id);
    const [counters, best] = await Promise.all([
      this.submissions.countersFor(ids),
      this.submissions.bestVerdicts(actor.id, ids),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      contentAccess: row.contentAccess as AccessLevel,
      submissions: counters.get(row.id)?.submissions ?? 0,
      accepted: counters.get(row.id)?.accepted ?? 0,
      acceptedUsers: counters.get(row.id)?.acceptedUsers ?? 0,
      myVerdict: (best.get(row.id) ?? null) as Verdict | null,
    }));
    return pageOf(items, total, input);
  }

  async get(actor: Actor, id: number) {
    const { problem, owner, canEdit, canSubmit, languages } = await this.access(actor, id);
    return {
      id: problem.id,
      owner: { id: owner.id, username: owner.username },
      title: problem.title,
      content: problem.content,
      contentAccess: problem.contentAccess as AccessLevel,
      submitOpen: problem.submitOpen,
      codeviewAccess: problem.codeviewAccess as AccessLevel,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitKb: problem.memoryLimitKb,
      scoreMode: problem.scoreMode as ScoreMode,
      scoreGroups: problem.scoreGroups,
      hasChecker: problem.checker !== '',
      languages: [...languages],
      // Contestants could read the expected answers' logic out of it.
      checker: canEdit ? problem.checker : '',
      testcaseCount: await this.problems.countTestcases(id),
      createdAt: problem.createdAt.toISOString(),
      updatedAt: problem.updatedAt.toISOString(),
      canEdit,
      canSubmit,
    };
  }

  /** New problems start hidden and closed, like a draft. */
  async create(actor: Actor, title: string): Promise<{ id: number }> {
    requireAdmin(actor);
    const id = await this.problems.create(actor.id, {
      title,
      contentAccess: AccessLevel.HIDDEN,
      codeviewAccess: AccessLevel.HIDDEN,
    });
    return { id };
  }

  async update(actor: Actor, id: number, patch: ProblemPatch): Promise<void> {
    const { problem } = await this.editable(actor, id);
    const mode = patch.scoreMode ?? problem.scoreMode;
    const groups = patch.scoreGroups ?? problem.scoreGroups;
    if (mode === ScoreMode.GROUP_MIN && groups.length === 0) {
      throw new BadRequestError('Group-min scoring needs at least one score group');
    }
    await this.problems.update(id, patch);
  }

  async stats(actor: Actor, id: number) {
    await this.access(actor, id);
    const [verdicts, fastest] = await Promise.all([
      this.submissions.verdictHistogram(id),
      this.submissions.fastestAccepted(id, 20),
    ]);
    return {
      verdicts: verdicts.map((row) => ({ verdict: row.verdict as Verdict, count: row.count })),
      fastest: fastest.map((row) => ({
        submissionId: row.id,
        user: { id: row.userId, username: row.username },
        timeMs: row.timeMs,
        memoryKb: row.memoryKb,
        language: row.language as Language,
      })),
    };
  }
}

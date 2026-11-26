import { AccessLevel, ContestProblemState, LANGUAGES, Language, UserLevel } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../common/errors.js';
import { actor, admin, fake, guest, root, user } from '../../testing/fixtures.js';
import type { ContestRepository } from '../contest/contest.repository.js';
import type { ContestEntry } from '../contest/grants.js';
import type { SubmissionRepository } from '../submission/submission.repository.js';
import type { ProblemRepository } from './problem.repository.js';
import { ProblemService } from './problem.service.js';

const owner = { id: admin.id, username: admin.username, level: admin.level };
const problem = (contentAccess: number, submitOpen: boolean) => ({ id: 7, contentAccess, submitOpen });
const running: ContestEntry = {
  endAt: new Date(Date.now() + 3_600_000),
  problemState: ContestProblemState.NORMAL,
  languages: [],
  submitCooldownSec: null,
};

function service(found: ReturnType<typeof problem> | undefined, entries?: ContestEntry[]) {
  const problems = fake<ProblemRepository>({ findById: async () => (found ? { problem: found, owner } : undefined) });
  // Without `entries` the contest repository must not be consulted at all:
  // guests and accounts that may not submit never need it for a visible problem.
  const contests = fake<ContestRepository>(entries ? { entriesFor: async () => entries } : {});
  return new ProblemService(problems, fake<SubmissionRepository>({}), contests);
}

describe('ProblemService.access', () => {
  it('opens a public, open problem to everyone, but only users may submit', async () => {
    await expect(service(problem(AccessLevel.OPEN, true)).access(guest, 7)).resolves.toMatchObject({
      canSubmit: false,
      canEdit: false,
    });
    await expect(service(problem(AccessLevel.OPEN, true), []).access(user, 7)).resolves.toMatchObject({
      canSubmit: true,
      canEdit: false,
      languages: LANGUAGES,
    });
  });

  it('keeps unverified and banned accounts from submitting', async () => {
    const open = service(problem(AccessLevel.OPEN, true));
    await expect(open.access(actor(9, UserLevel.UNVERIFIED), 7)).resolves.toMatchObject({ canSubmit: false });
  });

  it('closes submissions to a public problem unless a contest opens them', async () => {
    await expect(service(problem(AccessLevel.OPEN, false), []).access(user, 7)).resolves.toMatchObject({
      canSubmit: false,
    });
    await expect(service(problem(AccessLevel.OPEN, false), [running]).access(user, 7)).resolves.toMatchObject({
      canSubmit: true,
    });
  });

  it('hides a hidden problem from users who are not in a contest with it', async () => {
    await expect(service(problem(AccessLevel.HIDDEN, false), []).access(user, 7)).rejects.toThrow(ForbiddenError);
  });

  it('shows a hidden problem to contest participants, who may submit while the contest runs', async () => {
    await expect(service(problem(AccessLevel.HIDDEN, false), [running]).access(user, 7)).resolves.toMatchObject({
      canSubmit: true,
      canEdit: false,
    });
  });

  it('lets the owner and higher ranks edit a hidden problem, but not a peer', async () => {
    await expect(service(problem(AccessLevel.HIDDEN, false), []).access(admin, 7)).resolves.toMatchObject({
      canEdit: true,
      canSubmit: true,
    });
    await expect(service(problem(AccessLevel.HIDDEN, false), []).access(root, 7)).resolves.toMatchObject({
      canEdit: true,
    });
    const peer = actor(5, UserLevel.ADMIN);
    await expect(service(problem(AccessLevel.HIDDEN, false), []).access(peer, 7)).rejects.toThrow(ForbiddenError);
  });

  it("limits a running contest's participants to its languages, even on a problem open to all", async () => {
    const restricted = { ...running, languages: [Language.CPP23, Language.CPP] };
    await expect(service(problem(AccessLevel.OPEN, true), [restricted]).access(user, 7)).resolves.toMatchObject({
      canSubmit: true,
      languages: [Language.CPP, Language.CPP23],
    });
  });

  it('passes on the submission cooldowns of the running contests', async () => {
    await expect(
      service(problem(AccessLevel.OPEN, true), [{ ...running, submitCooldownSec: 15 }]).access(user, 7),
    ).resolves.toMatchObject({ cooldowns: [15] });
  });

  it('closes submissions when the running contests have no language in common', async () => {
    const entries = [
      { ...running, languages: [Language.C] },
      { ...running, languages: [Language.PYTHON3] },
    ];
    await expect(service(problem(AccessLevel.OPEN, true), entries).access(user, 7)).resolves.toMatchObject({
      canSubmit: false,
      languages: [],
    });
  });

  it('reports a missing problem', async () => {
    await expect(service(undefined).access(user, 7)).rejects.toThrow(NotFoundError);
  });
});

describe('ProblemService.editable', () => {
  it('takes an administrator who can see the problem', async () => {
    await expect(service(problem(AccessLevel.OPEN, true)).editable(user, 7)).rejects.toThrow(ForbiddenError);
    await expect(service(problem(AccessLevel.HIDDEN, true)).editable(actor(5, UserLevel.ADMIN), 7)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(service(problem(AccessLevel.HIDDEN, true)).editable(admin, 7)).resolves.toBeDefined();
  });
});

describe('ProblemService.get', () => {
  const withChecker = (checker: string, entries: ContestEntry[] = []) => {
    const found = { ...problem(AccessLevel.OPEN, true), checker, createdAt: new Date(), updatedAt: new Date() };
    const problems = fake<ProblemRepository>({
      findById: async () => ({ problem: found, owner }),
      countTestcases: async () => 0,
    });
    const contests = fake<ContestRepository>({ entriesFor: async () => entries });
    return new ProblemService(problems, fake<SubmissionRepository>({}), contests);
  };

  it('tells everyone a problem has a checker, but shows its source to editors only', async () => {
    const service = withChecker('int main() {}');
    expect(await service.get(user, 7)).toMatchObject({ hasChecker: true, checker: '', canEdit: false });
    expect(await service.get(admin, 7)).toMatchObject({ hasChecker: true, checker: 'int main() {}', canEdit: true });
  });

  it('reports no checker for problems without one', async () => {
    expect(await withChecker('').get(admin, 7)).toMatchObject({ hasChecker: false, checker: '' });
  });

  it('lists the languages the viewer may submit in', async () => {
    expect(await withChecker('').get(user, 7)).toMatchObject({ languages: LANGUAGES });
    const restricted = withChecker('', [{ ...running, languages: [Language.PYTHON3] }]);
    expect(await restricted.get(user, 7)).toMatchObject({ languages: [Language.PYTHON3] });
  });
});

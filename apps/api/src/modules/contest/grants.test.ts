import { ContestProblemState, LANGUAGES, Language } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { type ContestEntry, contestGrant, NO_GRANT } from './grants.js';

const now = new Date('2026-05-01T12:00:00Z');
const running = new Date('2026-05-01T15:00:00Z');
const ended = new Date('2026-05-01T09:00:00Z');

const entry = (endAt: Date, overrides: Partial<ContestEntry> = {}): ContestEntry => ({
  endAt,
  problemState: ContestProblemState.NORMAL,
  languages: [],
  submitCooldownSec: null,
  ...overrides,
});

describe('contestGrant', () => {
  it('grants nothing without a contest, and restricts no language', () => {
    expect(contestGrant([], now)).toEqual(NO_GRANT);
    expect(NO_GRANT.languages).toEqual(LANGUAGES);
  });

  it('lets participants read and submit while the contest runs', () => {
    expect(contestGrant([entry(running)], now)).toEqual({
      read: true,
      submit: true,
      languages: LANGUAGES,
      cooldowns: [null],
    });
  });

  it('keeps the statement readable but closes submissions once the contest ended', () => {
    expect(contestGrant([entry(ended)], now)).toMatchObject({ read: true, submit: false });
  });

  it('never opens submissions for a read-only contest problem', () => {
    expect(contestGrant([entry(running, { problemState: ContestProblemState.READONLY })], now).submit).toBe(false);
  });

  it('is generous across contests: any running one opens submissions', () => {
    expect(contestGrant([entry(ended), entry(running)], now).submit).toBe(true);
  });
});

describe('contestGrant languages', () => {
  it("narrows submissions to a running contest's languages, in menu order", () => {
    const grant = contestGrant([entry(running, { languages: [Language.PYTHON3, Language.CPP] })], now);
    expect(grant.languages).toEqual([Language.CPP, Language.PYTHON3]);
  });

  it('allows any language when the contest lists none', () => {
    expect(contestGrant([entry(running, { languages: [] })], now).languages).toEqual(LANGUAGES);
  });

  it('stops restricting once the contest has ended', () => {
    expect(contestGrant([entry(ended, { languages: [Language.C] })], now).languages).toEqual(LANGUAGES);
  });

  it('restricts a read-only problem too: submissions from elsewhere still count on its scoreboard', () => {
    const readonly = entry(running, { problemState: ContestProblemState.READONLY, languages: [Language.C] });
    expect(contestGrant([readonly], now).languages).toEqual([Language.C]);
  });

  it('is strict across contests: a submission must suit every running one, as it counts for all', () => {
    const entries = [
      entry(running, { languages: [Language.C, Language.CPP] }),
      entry(running, { languages: [Language.CPP, Language.CPP23] }),
      entry(running, { languages: [] }),
      entry(ended, { languages: [Language.PYTHON3] }),
    ];
    expect(contestGrant(entries, now).languages).toEqual([Language.CPP]);
    const disjoint = [entry(running, { languages: [Language.C] }), entry(running, { languages: [Language.PYTHON3] })];
    expect(contestGrant(disjoint, now).languages).toEqual([]);
  });
});

describe('contestGrant cooldowns', () => {
  it('reports the submission cooldown of each running contest, not of finished ones', () => {
    const entries = [
      entry(running, { submitCooldownSec: 30 }),
      entry(running, { submitCooldownSec: null }),
      entry(ended, { submitCooldownSec: 300 }),
    ];
    expect(contestGrant(entries, now).cooldowns).toEqual([30, null]);
  });
});

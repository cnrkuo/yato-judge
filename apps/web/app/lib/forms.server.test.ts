import { ContestProblemState, ContestStyle, LANGUAGES, Language, RegisterType } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { parseBoardForm } from './board-form.server';
import { parseContestForm, stateWord } from './contest-form.server';

/** A list stands for a field sent several times, like checked boxes sharing a name. */
const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
};
const times = { startAt: '2026-03-01T08:00', endAt: '2026-03-01T13:00' };
/** What the contest form sends when no box was unchecked. */
const allLanguages = { languages: [...LANGUAGES] };

describe('parseContestForm', () => {
  it('reads problems as "<tag> <id> [hidden|readonly]" and minutes as seconds', () => {
    const result = parseContestForm(
      form({
        ...times,
        ...allLanguages,
        title: 'Cup',
        style: 'ioi',
        registerType: String(RegisterType.PASSWORD),
        freezeMin: '60',
        problems: 'A 1\nB 2 readonly\n\nC 3 HIDDEN',
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        style: ContestStyle.IOI,
        registerType: RegisterType.PASSWORD,
        freezeSec: 3600,
        penaltySec: 0,
        languages: [],
        startAt: '2026-03-01T00:00:00.000Z',
        problems: [
          { tag: 'A', problemId: 1, state: ContestProblemState.NORMAL },
          { tag: 'B', problemId: 2, state: ContestProblemState.READONLY },
          { tag: 'C', problemId: 3, state: ContestProblemState.HIDDEN },
        ],
      },
    });
  });

  it('explains malformed input instead of guessing', () => {
    expect(parseContestForm(form({ ...times, ...allLanguages, problems: 'A one' }))).toMatchObject({ ok: false });
    expect(parseContestForm(form({ ...times, ...allLanguages, problems: 'A 1 secret' }))).toMatchObject({ ok: false });
    expect(parseContestForm(form({ ...allLanguages, startAt: '', endAt: '', problems: '' }))).toMatchObject({
      ok: false,
    });
  });

  it('reads the checked languages, in menu order; every one checked means any language', () => {
    const some = parseContestForm(form({ ...times, languages: ['py3', 'cpp', 'cobol'] }));
    expect(some).toMatchObject({ ok: true, value: { languages: [Language.CPP, Language.PYTHON3] } });
    expect(parseContestForm(form({ ...times, ...allLanguages }))).toMatchObject({ ok: true, value: { languages: [] } });
  });

  it('refuses a contest that allows no language at all', () => {
    expect(parseContestForm(form({ ...times }))).toEqual({ ok: false, error: 'Allow at least one language' });
    expect(parseContestForm(form({ ...times, languages: 'cobol' }))).toMatchObject({ ok: false });
  });

  it('writes problem states back in the same words', () => {
    expect(stateWord(ContestProblemState.READONLY)).toBe('readonly');
  });
});

describe('parseBoardForm', () => {
  it('reads users by id and problems with optional notes', () => {
    const result = parseBoardForm(
      form({ ...times, users: '1, 2\n3', problems: '10 warm-up task\n11', allowJoin: 'on' }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        userIds: [1, 2, 3],
        allowJoin: true,
        problems: [
          { problemId: 10, note: 'warm-up task' },
          { problemId: 11, note: '' },
        ],
      },
    });
  });

  it('rejects users or problems that are not numeric ids', () => {
    expect(parseBoardForm(form({ ...times, users: 'alice' }))).toMatchObject({ ok: false });
    expect(parseBoardForm(form({ ...times, problems: 'first-problem' }))).toMatchObject({ ok: false });
  });
});

import { ContestProblemState, LANGUAGES, type Language } from '@yato/contract';

/** A contest that lists a problem and that a user takes part in. */
export interface ContestEntry {
  endAt: Date;
  /** How the contest lists the problem (`ContestProblemState`). */
  problemState: number;
  /** Language ids the contest allows; empty when it allows any. */
  languages: readonly string[];
}

export interface ContestGrant {
  read: boolean;
  submit: boolean;
  /** Languages a submission to the problem may use. */
  languages: readonly Language[];
}

export const NO_GRANT: ContestGrant = { read: false, submit: false, languages: LANGUAGES };

/**
 * What the user's running or finished contests allow on a problem that may
 * be hidden from the public: reading it once the contest has started, and
 * submitting while it runs unless the contest made the problem read-only.
 * `entries` only holds contests that have started, list the problem
 * visibly and have the user as a participant.
 *
 * Languages are the other way round. A submission counts for every running
 * contest that lists the problem, whichever page it came from, so it must
 * use a language each of them allows. Contests that have ended no longer
 * restrict anything.
 */
export function contestGrant(entries: readonly ContestEntry[], now: Date): ContestGrant {
  const running = entries.filter((entry) => now < entry.endAt);
  return {
    read: entries.length > 0,
    submit: running.some((entry) => entry.problemState === ContestProblemState.NORMAL),
    languages: LANGUAGES.filter((language) =>
      running.every((entry) => entry.languages.length === 0 || entry.languages.includes(language)),
    ),
  };
}

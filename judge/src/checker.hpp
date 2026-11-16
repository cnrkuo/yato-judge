#pragma once

#include <string>
#include <string_view>

#include "common.hpp"

namespace judge::checker {

struct Outcome {
  Verdict verdict = Verdict::WrongAnswer;
  /** Fraction of the testcase's score awarded, 0..1. */
  double score = 0.0;
  std::string message;
};

/**
 * Default checker, comparing the contestant's output with the expected one.
 *
 * - Accepted: identical after dropping trailing whitespace on every line
 *   and trailing blank lines.
 * - Presentation Error: the whitespace-separated tokens match but the
 *   layout differs.
 * - Wrong Answer otherwise; the message names the first differing line
 *   without revealing the expected content.
 */
Outcome compare(std::string_view expected, std::string_view actual);

/** Reads both files and delegates to compare(). */
Outcome compare_files(const std::string& expected_path, const std::string& actual_path);

/**
 * Reads the result of a problem's own checker, run as
 * `checker <input> <output> <answer>`: its exit status and what it wrote to
 * stderr. Follows testlib.h's conventions, which plain checkers can imitate:
 *
 * | exit | stderr starts with        | outcome                             |
 * | ---- | ------------------------- | ----------------------------------- |
 * | 0    | `ok`                      | Accepted                            |
 * | 1    | `wrong answer`            | Wrong Answer                        |
 * | 2, 4 | `wrong output format`     | Presentation Error                  |
 * | 8    | `unexpected eof`          | Wrong Answer                        |
 * | 7    | `points X`                | X of the testcase's score, 0..1     |
 * | any  | `partially correct (N)`   | N/200 of the testcase's score       |
 * | 3    | `FAIL`                    | Judge Error: the checker gave up    |
 *
 * A full score is Accepted, anything less Wrong Answer. Every other exit
 * status is a Judge Error. The rest of stderr becomes the message.
 */
Outcome interpret(int exit_code, std::string_view report);

}  // namespace judge::checker

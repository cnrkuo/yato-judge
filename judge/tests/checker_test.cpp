#include <doctest.h>

#include "checker.hpp"
#include "support.hpp"

using judge::Verdict;
using judge::checker::compare;
using judge::checker::compare_files;
using judge::checker::interpret;

TEST_CASE("the checker accepts output that matches line by line") {
  CHECK(compare("1 2\n3\n", "1 2\n3\n").verdict == Verdict::Accepted);
  CHECK(compare("", "").verdict == Verdict::Accepted);
  CHECK(compare("1\n", "1\n").score == 1.0);
}

TEST_CASE("the checker ignores trailing whitespace, CRLF and trailing blank lines") {
  CHECK(compare("1 2\n3\n", "1 2  \r\n3").verdict == Verdict::Accepted);
  CHECK(compare("1 2\n3\n", "1 2\n3\n\n\n").verdict == Verdict::Accepted);
}

TEST_CASE("the checker calls the right tokens in the wrong layout a presentation error") {
  CHECK(compare("1 2\n3\n", "1\n2\n3\n").verdict == Verdict::PresentationError);
  CHECK(compare("1 2\n", " 1 2\n").verdict == Verdict::PresentationError);
  CHECK(compare("1 2\n", " 1 2\n").score == 0.0);
}

TEST_CASE("the checker says where wrong output differs") {
  CHECK(compare("1 2\n3\n", "1 2\n4\n").message == "Line 2 differs");
  CHECK(compare("1\n2\n", "1\n").message == "Output ends early: expected 2 lines, got 1");
  CHECK(compare("1\n", "1\n2\n").message == "Extra output after line 1");
  CHECK(compare("abc", "ABC").verdict == Verdict::WrongAnswer);
}

TEST_CASE("comparing files reports unreadable files as a judge error") {
  const auto dir = judge::testing::fresh_dir("checker");
  judge::testing::write_file(dir / "expected", "42\n");
  judge::testing::write_file(dir / "actual", "42\n");
  CHECK(compare_files((dir / "expected").string(), (dir / "actual").string()).verdict == Verdict::Accepted);
  CHECK(compare_files((dir / "missing").string(), (dir / "actual").string()).verdict == Verdict::JudgeError);
  CHECK(compare_files((dir / "expected").string(), (dir / "missing").string()).verdict == Verdict::JudgeError);
}

TEST_CASE("a testlib checker's verdict comes from its exit status") {
  CHECK(interpret(0, "ok 3 numbers\n").verdict == Verdict::Accepted);
  CHECK(interpret(0, "ok 3 numbers\n").score == 1.0);
  CHECK(interpret(0, "ok 3 numbers\n").message == "3 numbers");
  CHECK(interpret(1, "wrong answer 1st numbers differ").verdict == Verdict::WrongAnswer);
  CHECK(interpret(1, "wrong answer 1st numbers differ").message == "1st numbers differ");
  CHECK(interpret(2, "wrong output format Extra information in the output file").verdict == Verdict::PresentationError);
  CHECK(interpret(4, "wrong output format dirt").verdict == Verdict::PresentationError);
  CHECK(interpret(8, "unexpected eof").verdict == Verdict::WrongAnswer);
  CHECK(interpret(8, "unexpected eof").message.empty());
}

TEST_CASE("a checker that gives up or exits strangely is a judge error") {
  CHECK(interpret(3, "FAIL the jury's answer is wrong").verdict == Verdict::JudgeError);
  CHECK(interpret(3, "FAIL the jury's answer is wrong").message == "The checker failed: the jury's answer is wrong");
  CHECK(interpret(42, "").verdict == Verdict::JudgeError);
  CHECK(interpret(7, "seven without points").verdict == Verdict::JudgeError);
}

TEST_CASE("partial scores are read from the checker's report") {
  CHECK(interpret(7, "points 0.25 a quarter").verdict == Verdict::WrongAnswer);
  CHECK(interpret(7, "points 0.25 a quarter").score == 0.25);
  CHECK(interpret(7, "points 0.25 a quarter").message == "a quarter");
  CHECK(interpret(7, "points 1").verdict == Verdict::Accepted);
  // Out-of-range scores are clamped rather than trusted.
  CHECK(interpret(7, "points 40").score == 1.0);
  CHECK(interpret(7, "points -3").score == 0.0);
  CHECK(interpret(7, "points many").verdict == Verdict::JudgeError);
  CHECK(interpret(7, "points nan").verdict == Verdict::JudgeError);

  // testlib exits with the bare N for _pc(N), so the status means nothing here.
  CHECK(interpret(100, "partially correct (100) halfway").score == 0.5);
  CHECK(interpret(100, "partially correct (100) halfway").verdict == Verdict::WrongAnswer);
  CHECK(interpret(200, "partially correct (200)").verdict == Verdict::Accepted);
  CHECK(interpret(1, "partially correct (oops").verdict == Verdict::JudgeError);
}

TEST_CASE("checkers written without testlib only need the exit statuses") {
  CHECK(interpret(0, "").verdict == Verdict::Accepted);
  CHECK(interpret(1, "off by one").message == "off by one");
  // A label is only a label when it stands alone.
  CHECK(interpret(0, "okay then").message == "okay then");
}

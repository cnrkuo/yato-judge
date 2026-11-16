#include "checker.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <string>
#include <vector>

namespace judge::checker {
namespace {

bool is_space(char c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\v' || c == '\f';
}

/** Lines without their trailing whitespace, minus trailing blank lines. */
std::vector<std::string_view> normalized_lines(std::string_view text) {
  std::vector<std::string_view> lines;
  std::size_t begin = 0;
  while (begin <= text.size()) {
    std::size_t end = text.find('\n', begin);
    if (end == std::string_view::npos) end = text.size();
    std::string_view line = text.substr(begin, end - begin);
    while (!line.empty() && is_space(line.back())) line.remove_suffix(1);
    lines.push_back(line);
    begin = end + 1;
  }
  while (!lines.empty() && lines.back().empty()) lines.pop_back();
  return lines;
}

/** Advances to the next whitespace-separated token; empty at end of input. */
std::string_view next_token(std::string_view text, std::size_t& position) {
  while (position < text.size() && is_space(text[position])) ++position;
  const std::size_t begin = position;
  while (position < text.size() && !is_space(text[position])) ++position;
  return text.substr(begin, position - begin);
}

bool same_tokens(std::string_view a, std::string_view b) {
  std::size_t pa = 0;
  std::size_t pb = 0;
  for (;;) {
    const std::string_view ta = next_token(a, pa);
    const std::string_view tb = next_token(b, pb);
    if (ta != tb) return false;
    if (ta.empty()) return true;
  }
}

std::string_view trimmed(std::string_view text) {
  while (!text.empty() && is_space(text.front())) text.remove_prefix(1);
  while (!text.empty() && is_space(text.back())) text.remove_suffix(1);
  return text;
}

/** Drops `prefix` from the front of `text`; false when it is not there. */
bool consume(std::string_view& text, std::string_view prefix) {
  if (text.substr(0, prefix.size()) != prefix) return false;
  text.remove_prefix(prefix.size());
  return true;
}

/** Parses a leading decimal number off `text`; nothing when there is none or it is not finite. */
std::optional<double> consume_number(std::string_view& text) {
  const std::string copy(text.substr(0, 64));
  char* end = nullptr;
  const double value = std::strtod(copy.c_str(), &end);
  if (end == copy.c_str() || !std::isfinite(value)) return std::nullopt;
  text.remove_prefix(static_cast<std::size_t>(end - copy.c_str()));
  return value;
}

Outcome partial(double fraction, std::string_view message) {
  const double score = std::clamp(fraction, 0.0, 1.0);
  return {score >= 1.0 ? Verdict::Accepted : Verdict::WrongAnswer, score, std::string(trimmed(message))};
}

}  // namespace

Outcome interpret(int exit_code, std::string_view report) {
  std::string_view text = trimmed(report);

  // Scores travel in the text; testlib's exit status for "partially correct"
  // is the bare N, which collides with the statuses below.
  if (std::string_view rest = text; consume(rest, "points ")) {
    const auto points = consume_number(rest);
    if (!points) return {Verdict::JudgeError, 0.0, "The checker reported points without a number"};
    return partial(*points, rest);
  }
  if (std::string_view rest = text; consume(rest, "partially correct (")) {
    const auto units = consume_number(rest);
    if (!units || !consume(rest, ")")) {
      return {Verdict::JudgeError, 0.0, "The checker reported a malformed partial score"};
    }
    return partial(*units / 200.0, rest);
  }

  // testlib's label says nothing the verdict does not.
  for (const std::string_view label : {"ok", "wrong answer", "wrong output format", "unexpected eof", "FAIL"}) {
    if (std::string_view rest = text; consume(rest, label) && (rest.empty() || is_space(rest.front()))) {
      text = trimmed(rest);
      break;
    }
  }
  const std::string message(text);
  switch (exit_code) {
    case 0:
      return {Verdict::Accepted, 1.0, message};
    case 1:
    case 8:
      return {Verdict::WrongAnswer, 0.0, message};
    case 2:
    case 4:
      return {Verdict::PresentationError, 0.0, message};
    case 3:
      return {Verdict::JudgeError, 0.0, "The checker failed: " + message};
    case 7:
      return {Verdict::JudgeError, 0.0, "The checker reported points without a number"};
    default:
      return {Verdict::JudgeError, 0.0, format("The checker exited with unexpected status %d", exit_code)};
  }
}

Outcome compare(std::string_view expected, std::string_view actual) {
  const auto want = normalized_lines(expected);
  const auto got = normalized_lines(actual);
  if (want == got) return {Verdict::Accepted, 1.0, ""};
  if (same_tokens(expected, actual)) {
    return {Verdict::PresentationError, 0.0, "Tokens match but whitespace or line breaks differ"};
  }
  std::size_t line = 0;
  while (line < want.size() && line < got.size() && want[line] == got[line]) ++line;
  std::string message;
  if (line >= got.size()) {
    message = format("Output ends early: expected %zu lines, got %zu", want.size(), got.size());
  } else if (line >= want.size()) {
    message = format("Extra output after line %zu", want.size());
  } else {
    message = format("Line %zu differs", line + 1);
  }
  return {Verdict::WrongAnswer, 0.0, message};
}

Outcome compare_files(const std::string& expected_path, const std::string& actual_path) {
  const auto expected = read_file(expected_path);
  if (!expected) return {Verdict::JudgeError, 0.0, "Cannot read the expected output"};
  const auto actual = read_file(actual_path);
  if (!actual) return {Verdict::JudgeError, 0.0, "Cannot read the program output"};
  return compare(*expected, *actual);
}

}  // namespace judge::checker

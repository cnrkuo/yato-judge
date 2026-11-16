#include <doctest.h>

#include "api_client.hpp"
#include "config.hpp"
#include "runner.hpp"
#include "support.hpp"

namespace fs = std::filesystem;
using judge::Report;
using judge::Task;
using judge::Verdict;

namespace {

/**
 * A runner whose testdata is already in the cache, so it never needs the
 * API: the client points at a port nothing listens on.
 */
struct Bench {
  judge::Config config;
  judge::ApiClient api{"http://127.0.0.1:9", "unused"};
  judge::Runner runner{config, api};
  int next_hash = 0;

  explicit Bench(const std::string& name) {
    const fs::path root = judge::testing::fresh_dir(name);
    config.languages = judge::default_languages();
    config.work_dir = (root / "work").string();
    config.cache_dir = (root / "cache").string();
    config.testlib_path = judge::testing::testlib_path();
    fs::create_directories(config.work_dir);
    fs::create_directories(config.cache_dir);
    fs::permissions(config.work_dir, fs::perms::owner_all | fs::perms::group_exec | fs::perms::others_exec);
    // As private as the judge keeps it (main.cpp).
    fs::permissions(config.cache_dir, fs::perms::owner_all);
  }

  /** Puts `content` into the cache under a made-up content hash and returns that hash. */
  std::string cached(const std::string& content) {
    const std::string hash = judge::format("%064x", ++next_hash);
    judge::testing::write_file(fs::path(config.cache_dir) / hash, content);
    return hash;
  }

  Task task(const std::string& language, const std::string& code,
            const std::vector<std::pair<std::string, std::string>>& cases) {
    Task task{.submission_id = 1,
              .problem_id = 1,
              .language = language,
              .code = code,
              .time_limit_ms = 1000,
              .memory_limit_kb = 262144,
              .testcases = {},
              .checker = {}};
    for (const auto& [input, output] : cases) {
      task.testcases.push_back({.id = static_cast<int>(task.testcases.size()) + 1,
                                .ordinal = static_cast<int>(task.testcases.size()),
                                .input_sha256 = cached(input),
                                .output_sha256 = cached(output)});
    }
    return task;
  }
};

const std::vector<std::pair<std::string, std::string>> kSums = {{"1 2\n", "3\n"}, {"5 -5\n", "0\n"}};

/** Made-up content hashes for checkers; the runner only uses them as cache keys. */
judge::CheckerSource checker(int id, const std::string& source) {
  return {.sha256 = judge::format("%064x", 0xc0de00 + id), .source = source};
}

/**
 * The input is N; any two positive integers that add up to N are right, so
 * no single expected output exists. Scores half for a right sum with a zero.
 */
const char* const kSplitChecker = R"(#include "testlib.h"
int main(int argc, char* argv[]) {
  registerTestlibCmd(argc, argv);
  const int n = inf.readInt();
  const int a = ouf.readInt(0, n, "a");
  const int b = ouf.readInt(0, n, "b");
  if (a + b != n) quitf(_wa, "%d + %d is not %d", a, b, n);
  if (a == 0 || b == 0) quitp(0.5, "a part is zero");
  if (ans.readInt() != n) quitf(_fail, "the answer file is wrong");
  quitf(_ok, "%d = %d + %d", n, a, b);
}
)";

}  // namespace

TEST_CASE("the runner judges every testcase of a correct solution as accepted") {
  Bench bench("runner-ac");
  const Report report = bench.runner.judge(bench.task("py3", "print(sum(map(int, input().split())))", kSums));
  CHECK_FALSE(report.verdict.has_value());
  REQUIRE(report.results.size() == 2);
  for (const auto& result : report.results) {
    CHECK(result.verdict == Verdict::Accepted);
    CHECK(result.score == 1.0);
  }
  CHECK(report.results[1].testcase_id == 2);
}

TEST_CASE("the runner gives each testcase its own verdict") {
  Bench bench("runner-mixed");
  // Right on the first testcase only.
  const Report report = bench.runner.judge(bench.task("py3", "print(3)", kSums));
  REQUIRE(report.results.size() == 2);
  CHECK(report.results[0].verdict == Verdict::Accepted);
  CHECK(report.results[1].verdict == Verdict::WrongAnswer);
  CHECK(report.results[1].message == "Line 1 differs");
}

TEST_CASE("the runner turns runtime failures into verdicts") {
  Bench bench("runner-failures");
  const Report crashed = bench.runner.judge(bench.task("py3", "raise SystemExit(3)", {{"", ""}}));
  CHECK(crashed.results.at(0).verdict == Verdict::RuntimeError);

  const Report slow = bench.runner.judge(bench.task("py3", "while True: pass", {{"", ""}}));
  CHECK(slow.results.at(0).verdict == Verdict::TimeLimitExceeded);
  CHECK(slow.results.at(0).time_ms == 1000);  // capped at the limit
}

TEST_CASE("the runner reports memory-limit kills as such") {
  if (!judge::testing::sandbox_settings().memory_cgroup) {
    MESSAGE("skipped: no memory cgroup (run the tests as root)");
    return;
  }
  Bench bench("runner-mle");
  Task task = bench.task("py3", "b = bytearray(300 * 1024 * 1024)", {{"", ""}});
  task.memory_limit_kb = 65536;
  CHECK(bench.runner.judge(task).results.at(0).verdict == Verdict::MemoryLimitExceeded);
}

TEST_CASE("the runner reports compile errors with the compiler's message") {
  Bench bench("runner-ce");
  const Report report = bench.runner.judge(bench.task("c", "int main(void) { return undefined_name; }", kSums));
  CHECK(report.verdict == Verdict::CompileError);
  CHECK(report.compile_message.find("undefined_name") != std::string::npos);
  CHECK(report.results.empty());
}

TEST_CASE("the runner refuses languages this judge does not have") {
  Bench bench("runner-language");
  const Report report = bench.runner.judge(bench.task("cobol", "DISPLAY 'HI'.", kSums));
  CHECK(report.verdict == Verdict::JudgeError);
  CHECK(report.compile_message.find("cobol") != std::string::npos);
}

TEST_CASE("the runner only trusts content hashes as cache file names") {
  Bench bench("runner-hash");
  Task task = bench.task("py3", "print(3)", kSums);
  task.testcases[0].input_sha256 = "../../etc/passwd";
  CHECK_THROWS_AS(bench.runner.judge(task), judge::ApiError);
}

TEST_CASE("the toolchain check finds working and broken languages") {
  Bench bench("runner-toolchain");
  CHECK_FALSE(bench.runner.check_toolchain("py3").has_value());
  CHECK_FALSE(bench.runner.check_toolchain("c").has_value());
  CHECK(bench.runner.check_toolchain("cobol") == "not configured");

  bench.config.languages["broken"] = {
      "main.cpp", {"/usr/bin/g++", "-nostdinc++", "-o", "main", "main.cpp"}, {"./main"}};
  const auto problem = bench.runner.check_toolchain("broken");
  CHECK(problem.value_or("").find("iostream") != std::string::npos);
}

TEST_CASE("a testlib checker accepts any right answer and explains wrong ones") {
  Bench bench("runner-checker");
  // Expected outputs hold N, which a plain comparison would never accept.
  Task task =
      bench.task("py3", "n = int(input())\nprint(3, n - 3)", {{"10\n", "10\n"}, {"3\n", "3\n"}, {"2\n", "2\n"}});
  task.checker = checker(1, kSplitChecker);
  const Report report = bench.runner.judge(task);
  CHECK_FALSE(report.verdict.has_value());
  REQUIRE(report.results.size() == 3);

  CHECK(report.results[0].verdict == Verdict::Accepted);
  CHECK(report.results[0].score == 1.0);
  CHECK(report.results[0].message == "10 = 3 + 7");

  CHECK(report.results[1].verdict == Verdict::WrongAnswer);
  CHECK(report.results[1].score == 0.5);
  CHECK(report.results[1].message == "a part is zero");

  // -1 is outside the range the checker reads.
  CHECK(report.results[2].verdict == Verdict::WrongAnswer);
  CHECK(report.results[2].score == 0.0);
  CHECK(report.results[2].message.find("violates the range") != std::string::npos);
}

TEST_CASE("a checker is not consulted for runs that failed") {
  Bench bench("runner-checker-re");
  Task task = bench.task("py3", "print(1, 1)\nraise SystemExit(3)", {{"2\n", "2\n"}});
  task.checker = checker(1, kSplitChecker);
  CHECK(bench.runner.judge(task).results.at(0).verdict == Verdict::RuntimeError);
}

TEST_CASE("a compiled checker is cached under its content hash") {
  Bench bench("runner-checker-cache");
  Task task = bench.task("py3", "print(1, 1)", {{"2\n", "2\n"}});
  task.checker = checker(1, kSplitChecker);
  CHECK(bench.runner.judge(task).results.at(0).verdict == Verdict::Accepted);

  int cached = 0;
  for (const auto& entry : fs::directory_iterator(bench.config.cache_dir)) {
    cached += entry.path().filename().string().starts_with("checker-" + task.checker->sha256) ? 1 : 0;
  }
  CHECK(cached == 1);

  // Same hash: the binary is reused, the source not even looked at.
  task.checker->source = "this does not compile";
  CHECK(bench.runner.judge(task).results.at(0).verdict == Verdict::Accepted);

  // Another compiler command is another cache entry.
  bench.config.checker_compile.insert(bench.config.checker_compile.begin() + 1, "-DNDEBUG");
  CHECK(bench.runner.judge(task).verdict == Verdict::JudgeError);
}

TEST_CASE("a checker that does not compile is a judge error, with the compiler's message") {
  Bench bench("runner-checker-ce");
  Task task = bench.task("py3", "print(1, 1)", {{"2\n", "2\n"}});
  task.checker = checker(2, "#include \"testlib.h\"\nint main() { return undefined_name; }\n");
  const Report report = bench.runner.judge(task);
  CHECK(report.verdict == Verdict::JudgeError);
  CHECK(report.compile_message.find("checker does not compile") != std::string::npos);
  CHECK(report.compile_message.find("undefined_name") != std::string::npos);
  CHECK(report.results.empty());

  // Without testlib.h the message says what this judge is missing.
  bench.config.testlib_path = "/nonexistent/testlib.h";
  CHECK(bench.runner.judge(task).compile_message.find("no testlib.h") != std::string::npos);
}

TEST_CASE("a checker that fails, crashes or hangs is a judge error for that testcase") {
  Bench bench("runner-checker-je");
  Task task = bench.task("py3", "print(1, 1)", {{"2\n", "3\n"}});
  // The answer file disagrees with the input, which the checker reports with _fail.
  task.checker = checker(1, kSplitChecker);
  const Report failed = bench.runner.judge(task);
  CHECK(failed.results.at(0).verdict == Verdict::JudgeError);
  CHECK(failed.results.at(0).message == "The checker failed: the answer file is wrong");

  task.checker = checker(3, "#include <cstdlib>\nint main() { std::abort(); }\n");
  const Report crashed = bench.runner.judge(task);
  CHECK(crashed.results.at(0).verdict == Verdict::JudgeError);
  CHECK(crashed.results.at(0).message.find("killed by signal") != std::string::npos);

  bench.config.checker_time_ms = 500;
  task.checker = checker(4, "int main() { for (;;) {} }\n");
  const Report hung = bench.runner.judge(task);
  CHECK(hung.results.at(0).verdict == Verdict::JudgeError);
  CHECK(hung.results.at(0).message == "The checker ran out of time");
}

TEST_CASE("a checker sees its three files and nothing else of the judge") {
  Bench bench("runner-checker-jail");
  Task task = bench.task("py3", "print('out')", {{"in\n", "ans\n"}});
  // No testlib: exit statuses alone are enough. Fails unless the files hold
  // what they should, are read-only, and the submission's box is absent.
  task.checker = checker(5, R"(#include <cstdio>
#include <fstream>
#include <string>
static std::string slurp(const char* path) {
  std::ifstream file(path);
  std::string text;
  std::getline(file, text);
  return text;
}
int main(int argc, char* argv[]) {
  if (argc != 4) return 3;
  if (slurp(argv[1]) != "in" || slurp(argv[2]) != "out" || slurp(argv[3]) != "ans") return 3;
  if (std::ofstream(argv[2], std::ios::app).is_open()) return 3;
  if (std::ifstream("main.py").is_open() || std::ifstream("../box/main.py").is_open()) return 3;
  if (std::ofstream("scratch").is_open()) return 3;
  std::fputs("checked without testlib", stderr);
  return 0;
}
)");
  const Report report = bench.runner.judge(task);
  CHECK(report.results.at(0).verdict == Verdict::Accepted);
  CHECK(report.results.at(0).message == "checked without testlib");
}

TEST_CASE("a checker's content hash is only trusted when it is one") {
  Bench bench("runner-checker-hash");
  Task task = bench.task("py3", "print(1, 1)", {{"2\n", "2\n"}});
  task.checker = judge::CheckerSource{.sha256 = "../../etc/passwd", .source = kSplitChecker};
  CHECK_THROWS_AS(bench.runner.judge(task), judge::ApiError);
}

TEST_CASE("the runner announces each testcase as it finishes") {
  Bench bench("runner-progress");
  std::vector<std::pair<int, Verdict>> seen;
  const Report report = bench.runner.judge(bench.task("py3", "print(3)", kSums),
                                           [&](const judge::Testcase& testcase, const judge::TestResult& result) {
                                             CHECK(result.testcase_id == testcase.id);
                                             seen.emplace_back(testcase.ordinal, result.verdict);
                                           });
  CHECK(seen == std::vector<std::pair<int, Verdict>>{{0, Verdict::Accepted}, {1, Verdict::WrongAnswer}});
  CHECK(report.results.size() == 2);

  // Nothing ran, nothing to announce.
  seen.clear();
  bench.runner.judge(
      bench.task("c", "int main(void) { return undefined_name; }", kSums),
      [&](const judge::Testcase&, const judge::TestResult&) { seen.emplace_back(0, Verdict::Accepted); });
  CHECK(seen.empty());
}

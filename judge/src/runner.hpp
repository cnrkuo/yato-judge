#pragma once

#include <filesystem>
#include <functional>
#include <optional>
#include <string>
#include <variant>

#include "api_client.hpp"
#include "checker.hpp"
#include "config.hpp"
#include "sandbox.hpp"

namespace judge {

/**
 * Judges one task: materialises the source, compiles it, runs it against
 * every testcase inside the sandbox and checks the output.
 *
 * Task layout under `work_dir`:
 *   <task>/box/   source and binary; the program's (read-only) cwd
 *   <task>/io/    captured output; never visible to the program
 *
 *   <task>/checker/   the checker's (read-only) cwd, when the problem has one
 *
 * A problem's own checker is compiled once and kept in the cache. It runs in
 * a jail of its own after each testcase and sees only that testcase's input,
 * the program's output and the expected output.
 */
class Runner {
 public:
  Runner(const Config& config, ApiClient& api) : config_(config), api_(api) {}

  /** Called after each testcase with its result, while the rest still run. */
  using Progress = std::function<void(const Testcase&, const TestResult&)>;

  /** Never throws for problems with the submission; those become verdicts. */
  Report judge(const Task& task, const Progress& progress = {});

  /**
   * Compiles and runs a hello-world program in `language` inside the
   * sandbox. Returns why the toolchain does not work, or nothing when it
   * does. Languages whose source extension it has no sample for are assumed
   * to work.
   */
  std::optional<std::string> check_toolchain(const std::string& language);

 private:
  struct Failure {
    Verdict verdict;
    std::string message;
  };
  /**
   * Creates `<root>/box` and `<root>/io`, saves the source and compiles it.
   * `header`, when it names a file, is copied into the box first.
   */
  std::optional<Failure> build(const LanguageSpec& spec, const std::string& code, const std::filesystem::path& root,
                               const std::filesystem::path& header = {});
  [[nodiscard]] sandbox::RunSpec base_spec(const std::filesystem::path& root) const;

  /** Returns the cached path of a testdata blob, downloading it on a miss. */
  std::string testdata(const Testcase& testcase, bool input);

  /** Returns the cached path of the compiled checker, building it on a miss. */
  std::variant<std::string, Failure> compiled_checker(const CheckerSource& checker);
  /** Runs the checker in `box`, which holds its binary, on one testcase. */
  [[nodiscard]] checker::Outcome run_checker(const std::filesystem::path& box, const std::filesystem::path& log_path,
                                             const std::string& input_path, const std::string& output_path,
                                             const std::string& expected_path) const;

  const Config& config_;
  ApiClient& api_;
};

}  // namespace judge

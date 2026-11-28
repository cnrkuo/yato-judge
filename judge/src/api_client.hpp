#pragma once

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

#include "common.hpp"

namespace httplib {
class Client;
}

namespace judge {

struct Testcase {
  int id = 0;
  int ordinal = 0;
  std::string input_sha256;
  std::string output_sha256;
};

/** A problem's own checker; see `checker::interpret` for how its runs are read. */
struct CheckerSource {
  /** Hash of `source`, computed by the API; names the compiled checker in the cache. */
  std::string sha256;
  /** C++, normally written with testlib.h. */
  std::string source;
};

/** One submission to judge, as handed out by `POST /judge/fetch`. */
struct Task {
  int submission_id = 0;
  int problem_id = 0;
  std::string language;
  std::string code;
  std::int64_t time_limit_ms = 0;
  std::int64_t memory_limit_kb = 0;
  std::vector<Testcase> testcases;
  /** Unset for problems judged by comparing with the expected output. */
  std::optional<CheckerSource> checker;
};

struct TestResult {
  int testcase_id = 0;
  Verdict verdict = Verdict::JudgeError;
  std::int64_t time_ms = 0;
  std::int64_t memory_kb = 0;
  double score = 0.0;
  std::string message;
};

/** Sent back with `POST /judge/report`. */
struct Report {
  int submission_id = 0;
  /** Set when the run never reached the testcases (compile/judge error). */
  std::optional<Verdict> verdict;
  std::string compile_message;
  std::vector<TestResult> results;
};

class ApiError : public std::runtime_error {
  using std::runtime_error::runtime_error;
};

/**
 * Client for the `judge.*` procedures of the API contract
 * (packages/contract/src/contract.ts). All calls are JSON POSTs
 * authenticated with the judge's bearer token and throw ApiError on failure.
 */
class ApiClient {
 public:
  /**
   * `fetch_wait_sec` is how long the API may hold one fetch open while no
   * submission is waiting (long polling); 0 asks without waiting.
   */
  ApiClient(const std::string& base_url, const std::string& token, int fetch_wait_sec = 0);
  ~ApiClient();
  ApiClient(const ApiClient&) = delete;
  ApiClient& operator=(const ApiClient&) = delete;

  /**
   * Claims the next queued submission in one of `languages`, if any. When
   * long polling, the API answers as soon as one is queued, or empty once
   * `fetch_wait_sec` is up.
   */
  std::optional<Task> fetch(const std::vector<std::string>& languages);
  /**
   * Makes the fetch in progress, and every later one, fail with ApiError at
   * once, so a judge that is stopping need not wait out a long poll. Never
   * interrupts the other calls: a report in flight still gets through.
   * Async-signal-safe (atomics and shutdown(2) only): a signal handler may
   * call it.
   */
  void cancel_fetches() noexcept;
  /** Downloads one testcase file ("input" or "output") to `destination`. */
  void download_testdata(int testcase_id, const std::string& kind, const std::string& destination);
  /**
   * Tells the API one testcase of a running submission is done (`ordinal` of
   * `total`), for the pages watching it. Nothing depends on it arriving.
   */
  void progress(int submission_id, int ordinal, int total, const TestResult& result);
  void report(const Report& report);

 private:
  std::string post(const std::string& procedure, const std::string& body);

  std::unique_ptr<httplib::Client> http_;
  std::string base_path_;
  int fetch_wait_sec_ = 0;
  /** The socket of the connection to the API, as last opened. */
  std::atomic<int> socket_{-1};
  std::atomic<bool> fetching_{false};
  std::atomic<bool> cancelled_{false};
  static_assert(std::atomic<int>::is_always_lock_free && std::atomic<bool>::is_always_lock_free,
                "cancel_fetches() must be async-signal-safe");
};

}  // namespace judge

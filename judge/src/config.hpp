#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace judge {

/** How to build and run submissions written in one language. */
struct LanguageSpec {
  /** File name the submitted code is saved as. */
  std::string source;
  /** Empty when the language needs no build step. */
  std::vector<std::string> compile;
  std::vector<std::string> run;
};

struct Config {
  std::string api_url = "http://127.0.0.1:3001";
  std::string token;
  /** Scratch space; one sub-directory per task, removed afterwards. */
  std::string work_dir = "/var/lib/yato-judge/work";
  /** Content-addressed testdata cache. */
  std::string cache_dir = "/var/lib/yato-judge/cache";
  /**
   * Long polling: how long the API may hold a fetch open while no submission
   * is waiting (it holds one 30 s at most), answering as soon as one is
   * queued. 0 asks without waiting, every `poll_interval_ms`.
   */
  int fetch_wait_sec = 25;
  /**
   * Least time between two fetches that found nothing: the polling interval
   * when `fetch_wait_sec` is 0, or with an API too old to hold a fetch.
   */
  int poll_interval_ms = 1000;

  /** Identity submissions run as when the judge itself runs as root. */
  unsigned run_uid = 65534;
  unsigned run_gid = 65534;
  /** The nsjail binary that every compilation and run goes through. */
  std::string nsjail_path = "nsjail";
  /**
   * Enforce memory limits with a cgroup when the system allows it (root and
   * a writable cgroup filesystem); otherwise only an address-space rlimit.
   */
  bool memory_cgroup = true;
  /** Where the cgroup filesystem is mounted. */
  std::string cgroup_root = "/sys/fs/cgroup";

  std::int64_t output_limit_kb = 65536;
  std::int64_t compile_time_ms = 15000;
  std::int64_t compile_memory_kb = 2097152;
  int max_processes = 64;

  /**
   * Builds a problem's checker from `checker.cpp` into `checker`. A copy of
   * testlib.h sits next to the source, so `#include "testlib.h"` works.
   */
  std::vector<std::string> checker_compile = {"/usr/bin/g++", "-std=c++20", "-O2", "-o", "checker", "checker.cpp"};
  /** testlib.h handed to checkers; without it only checkers that do not include it build. */
  std::string testlib_path = "/usr/local/share/yato-judge/testlib.h";
  /** Limits for one checker run. */
  std::int64_t checker_time_ms = 10000;
  std::int64_t checker_memory_kb = 1048576;

  /** Keyed by the language ids of the API contract ("c", "cpp", "cpp23", "py3"). */
  std::map<std::string, LanguageSpec> languages;
};

/** Languages available out of the box; config files may override or extend them. */
std::map<std::string, LanguageSpec> default_languages();

/**
 * Loads a JSON config file. `YATO_API_URL` and `YATO_JUDGE_TOKEN` in the
 * environment take precedence over the file. Throws std::runtime_error on
 * malformed or incomplete configuration.
 */
Config load_config(const std::string& path);

}  // namespace judge

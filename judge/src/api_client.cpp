#include "api_client.hpp"

#include <algorithm>
#include <cstdio>
#include <fstream>

#include <sys/socket.h>

#include <httplib.h>
#include <nlohmann/json.hpp>

namespace judge {
namespace {

using nlohmann::json;

/** Cuts `text` to at most `limit` bytes without splitting a UTF-8 sequence. */
std::string truncated(const std::string& text, std::size_t limit) {
  if (text.size() <= limit) return text;
  std::size_t end = limit;
  while (end > 0 && (static_cast<unsigned char>(text[end]) & 0xC0) == 0x80) --end;
  return text.substr(0, end) + "\n[truncated]";
}

/** Invalid UTF-8 (e.g. from compiler output) is replaced, never fatal. */
std::string dump(const json& value) {
  return value.dump(-1, ' ', false, json::error_handler_t::replace);
}

}  // namespace

ApiClient::ApiClient(const std::string& base_url, const std::string& token, int fetch_wait_sec)
    : fetch_wait_sec_(std::max(fetch_wait_sec, 0)) {
  // Split "scheme://host[:port]/optional/prefix" into origin and path prefix.
  const std::size_t scheme_end = base_url.find("://");
  if (scheme_end == std::string::npos) throw ApiError("api_url must start with http:// or https://");
  const std::size_t path_start = base_url.find('/', scheme_end + 3);
  const std::string origin = base_url.substr(0, path_start);
  base_path_ = path_start == std::string::npos ? "" : base_url.substr(path_start);

  http_ = std::make_unique<httplib::Client>(origin);
  if (!http_->is_valid()) throw ApiError("cannot create an HTTP client for " + origin + " (HTTPS needs OpenSSL)");
  http_->set_bearer_token_auth(token);
  http_->set_connection_timeout(10);
  // A held fetch must outlast its wait, with room for a slow network.
  http_->set_read_timeout(std::max(60, fetch_wait_sec_ + 30));
  http_->set_write_timeout(60);
  http_->set_keep_alive(true);
  // Remember each connection's socket, so cancel_fetches() can shut it.
  http_->set_socket_options([this](socket_t sock) {
    httplib::default_socket_options(sock);
    socket_.store(sock);
  });
}

ApiClient::~ApiClient() = default;

std::string ApiClient::post(const std::string& procedure, const std::string& body) {
  const std::string path = base_path_ + procedure;
  auto response = http_->Post(path, body, "application/json");
  if (!response) throw ApiError("POST " + path + " failed: " + httplib::to_string(response.error()));
  if (response->status < 200 || response->status >= 300) {
    throw ApiError(
        format("POST %s returned HTTP %d: %s", path.c_str(), response->status, truncated(response->body, 300).c_str()));
  }
  return std::move(response->body);
}

void ApiClient::cancel_fetches() noexcept {
  cancelled_.store(true);
  if (!fetching_.load()) return;
  // The blocked read sees the connection end and the request fails.
  if (const int sock = socket_.load(); sock >= 0) ::shutdown(sock, SHUT_RDWR);
}

std::optional<Task> ApiClient::fetch(const std::vector<std::string>& languages) {
  json request = {{"languages", languages}};
  if (fetch_wait_sec_ > 0) request["waitSec"] = fetch_wait_sec_;
  struct Fetching {
    std::atomic<bool>& flag;
    explicit Fetching(std::atomic<bool>& fetching) : flag(fetching) { flag.store(true); }
    Fetching(const Fetching&) = delete;
    Fetching& operator=(const Fetching&) = delete;
    ~Fetching() { flag.store(false); }
  } const fetching(fetching_);
  // Checked only now that `fetching_` is set: a cancel in between is not lost.
  if (cancelled_.load()) throw ApiError("fetch cancelled");
  try {
    const json reply = json::parse(post("/judge/fetch", dump(request)));
    const json& item = reply.at("task");
    if (item.is_null()) return std::nullopt;

    Task task;
    item.at("submissionId").get_to(task.submission_id);
    item.at("problemId").get_to(task.problem_id);
    item.at("language").get_to(task.language);
    item.at("code").get_to(task.code);
    item.at("timeLimitMs").get_to(task.time_limit_ms);
    item.at("memoryLimitKb").get_to(task.memory_limit_kb);
    for (const json& entry : item.at("testcases")) {
      Testcase testcase;
      entry.at("id").get_to(testcase.id);
      entry.at("ordinal").get_to(testcase.ordinal);
      entry.at("inputSha256").get_to(testcase.input_sha256);
      entry.at("outputSha256").get_to(testcase.output_sha256);
      task.testcases.push_back(std::move(testcase));
    }
    // Older APIs do not send the field at all.
    if (const auto checker = item.find("checker"); checker != item.end() && !checker->is_null()) {
      CheckerSource source;
      checker->at("sha256").get_to(source.sha256);
      checker->at("source").get_to(source.source);
      task.checker = std::move(source);
    }
    return task;
  } catch (const json::exception& error) {
    throw ApiError(std::string("malformed /judge/fetch response: ") + error.what());
  }
}

void ApiClient::download_testdata(int testcase_id, const std::string& kind, const std::string& destination) {
  const std::string data = post("/judge/testdata", dump({{"testcaseId", testcase_id}, {"kind", kind}}));
  // Write-then-rename so a crash never leaves a truncated file in the cache.
  const std::string partial = destination + ".part";
  {
    std::ofstream file(partial, std::ios::binary | std::ios::trunc);
    file.write(data.data(), static_cast<std::streamsize>(data.size()));
    if (!file.flush()) throw ApiError("cannot write " + partial);
  }
  if (std::rename(partial.c_str(), destination.c_str()) != 0) throw ApiError("cannot move testdata into the cache");
}

namespace {

json to_json(const TestResult& result) {
  return {
      {"testcaseId", result.testcase_id},
      {"verdict", static_cast<int>(result.verdict)},
      {"timeMs", result.time_ms},
      {"memoryKb", result.memory_kb},
      {"score", result.score},
      {"message", truncated(result.message, 1000)},
  };
}

}  // namespace

void ApiClient::progress(int submission_id, int ordinal, int total, const TestResult& result) {
  json entry = to_json(result);
  entry["ordinal"] = ordinal;
  post("/judge/progress", dump({{"submissionId", submission_id}, {"total", total}, {"result", std::move(entry)}}));
}

void ApiClient::report(const Report& report) {
  json body = {
      {"submissionId", report.submission_id},
      {"compileMessage", truncated(report.compile_message, 16000)},
      {"results", json::array()},
  };
  if (report.verdict) body["verdict"] = static_cast<int>(*report.verdict);
  for (const TestResult& result : report.results) {
    body["results"].push_back(to_json(result));
  }
  post("/judge/report", dump(body));
}

}  // namespace judge

#include <doctest.h>

#include <atomic>
#include <chrono>
#include <string>
#include <thread>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "api_client.hpp"

using namespace std::chrono_literals;

namespace {

/** A stand-in for the API on a free loopback port, served from its own thread. */
class FakeApi {
 public:
  FakeApi() : port_(server_.bind_to_any_port("127.0.0.1")) {
    thread_ = std::thread([this] { server_.listen_after_bind(); });
    server_.wait_until_ready();
  }
  FakeApi(const FakeApi&) = delete;
  FakeApi& operator=(const FakeApi&) = delete;
  ~FakeApi() {
    server_.stop();
    thread_.join();
  }

  httplib::Server& server() { return server_; }
  std::string url() const { return "http://127.0.0.1:" + std::to_string(port_); }

 private:
  httplib::Server server_;
  int port_;
  std::thread thread_;
};

constexpr const char* kNoTask = R"({"task":null})";

}  // namespace

TEST_CASE("a long-polling fetch asks the API to wait, and sends the judge's languages") {
  FakeApi api;
  std::string sent;
  api.server().Post("/judge/fetch", [&](const httplib::Request& request, httplib::Response& response) {
    sent = request.body;
    response.set_content(kNoTask, "application/json");
  });
  judge::ApiClient client(api.url(), "token", 25);
  CHECK_FALSE(client.fetch({"cpp", "py3"}).has_value());
  const auto body = nlohmann::json::parse(sent);
  CHECK(body.at("waitSec") == 25);
  CHECK(body.at("languages") == nlohmann::json{"cpp", "py3"});
}

TEST_CASE("without long polling a fetch asks for an answer at once") {
  FakeApi api;
  std::string sent;
  api.server().Post("/judge/fetch", [&](const httplib::Request& request, httplib::Response& response) {
    sent = request.body;
    response.set_content(kNoTask, "application/json");
  });
  judge::ApiClient client(api.url(), "token", 0);
  CHECK_FALSE(client.fetch({"cpp"}).has_value());
  CHECK_FALSE(nlohmann::json::parse(sent).contains("waitSec"));
}

TEST_CASE("cancelling cuts a held fetch short, and later fetches fail at once") {
  FakeApi api;
  std::atomic<bool> release{false};
  api.server().Post("/judge/fetch", [&](const httplib::Request& /*request*/, httplib::Response& response) {
    // Held like a long poll: up to 5 s with nothing to hand out.
    for (int i = 0; i < 100 && !release.load(); ++i) std::this_thread::sleep_for(50ms);
    response.set_content(kNoTask, "application/json");
  });
  judge::ApiClient client(api.url(), "token", 25);
  // In the daemon the SIGTERM handler calls it; here another thread does.
  std::thread canceller([&client] {
    std::this_thread::sleep_for(200ms);
    client.cancel_fetches();
  });
  const auto started = std::chrono::steady_clock::now();
  CHECK_THROWS_AS(client.fetch({"cpp"}), judge::ApiError);
  CHECK(std::chrono::steady_clock::now() - started < 2s);
  canceller.join();

  const auto again = std::chrono::steady_clock::now();
  CHECK_THROWS_AS(client.fetch({"cpp"}), judge::ApiError);
  CHECK(std::chrono::steady_clock::now() - again < 100ms);
  release = true;
}

TEST_CASE("cancelling fetches leaves other calls alone") {
  FakeApi api;
  int reports = 0;
  api.server().Post("/judge/report", [&](const httplib::Request& /*request*/, httplib::Response& response) {
    ++reports;
    response.set_content(R"({"ok":true})", "application/json");
  });
  judge::ApiClient client(api.url(), "token", 25);
  client.cancel_fetches();
  client.report(judge::Report{7, std::nullopt, "", {}});
  CHECK(reports == 1);
}

// cancel_fetches() may run while cpp-httplib has created a connection's
// socket but not yet connected it; shutdown(2) then reports ENOTCONN. The
// client relies on the socket being marked anyway, so the request fails as
// soon as it is sent instead of waiting out a long poll.
TEST_CASE("a socket shut before it connects fails the request at once") {
  const int server = ::socket(AF_INET, SOCK_STREAM, 0);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  socklen_t length = sizeof address;
  REQUIRE(::bind(server, reinterpret_cast<sockaddr*>(&address), sizeof address) == 0);
  REQUIRE(::listen(server, 1) == 0);
  REQUIRE(::getsockname(server, reinterpret_cast<sockaddr*>(&address), &length) == 0);

  const int sock = ::socket(AF_INET, SOCK_STREAM, 0);
  ::shutdown(sock, SHUT_RDWR);
  REQUIRE(::connect(sock, reinterpret_cast<const sockaddr*>(&address), sizeof address) == 0);
  const char request[] = "POST /judge/fetch HTTP/1.1\r\n\r\n";
  CHECK(::send(sock, request, sizeof request - 1, MSG_NOSIGNAL) < 0);
  pollfd readable{sock, POLLIN, 0};
  CHECK(::poll(&readable, 1, 1000) == 1);  // at once, not after the timeout
  char byte = 0;
  CHECK(::recv(sock, &byte, 1, 0) == 0);
  ::close(sock);
  ::close(server);
}

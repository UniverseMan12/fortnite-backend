#pragma once
#include <atomic>
#include <mutex>
#include <string>
class UNetDriver;
namespace BotLobby {
    inline std::atomic<int> Requested{0}, Alive{0};
    inline std::mutex StatusMutex;
    inline std::string Status = "Bots are off. Choose 1-10 before Start server.";
    inline void Report(const std::string& value) { std::lock_guard<std::mutex> lock(StatusMutex); Status = value; }
    inline std::string ReadStatus() { std::lock_guard<std::mutex> lock(StatusMutex); return Status; }
    void Tick(UNetDriver* driver);
}

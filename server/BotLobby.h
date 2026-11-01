#pragma once
#include <atomic>
#include <mutex>
#include <string>
class UNetDriver;
namespace BotLobby {
    inline std::atomic<int> Requested{99}, Alive{0}, Moving{0}, Shooting{0};
    inline std::mutex StatusMutex;
    inline std::string Status = "Fill match: up to 99 bots, 100 participants including human players.";
    inline void Report(const std::string& value) { std::lock_guard<std::mutex> lock(StatusMutex); Status = value; }
    inline std::string ReadStatus() { std::lock_guard<std::mutex> lock(StatusMutex); return Status; }
    void Tick(UNetDriver* driver);
}

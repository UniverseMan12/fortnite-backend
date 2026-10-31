#pragma once
#include <atomic>
#include <mutex>
#include <string>
class AFortPlayerController;
class UFortItemDefinition;
class UNetDriver;
namespace InfinityShowdown {
    inline std::atomic<bool> Enabled(false);
    inline std::mutex InfoMutex;
    inline std::string Info = "Waiting for the Battle Bus. Every player has 10 respawns.";
    inline void Report(const std::string& value) { std::lock_guard<std::mutex> lock(InfoMutex); Info = value; }
    inline std::string ReadInfo() { std::lock_guard<std::mutex> lock(InfoMutex); return Info; }
    bool OnDeath(AFortPlayerController* controller);
    void Tick(UNetDriver* driver);
    void GadgetApplied(AFortPlayerController* controller, UFortItemDefinition* definition, bool success);
}

#pragma once
#include <atomic>
#include <mutex>
#include <string>
class UNetDriver;
class AFortPlayerController;
class AFortPlayerControllerAthena;

namespace LocalTools {
    enum Action { None, Respawn, Heal, Loot, Kit, Materials, Ammo, ClearBuilds };
    inline std::atomic<int> Pending(None);
    inline std::atomic<bool> PracticeRespawn(true), InfiniteAmmo(false), InfiniteMaterials(false);
    inline std::mutex StatusMutex;
    inline std::string Status = "Join your local match to use these tools.";
    inline void Report(const std::string& message) {
        std::lock_guard<std::mutex> guard(StatusMutex); Status = message;
    }
    inline std::string ReadStatus() {
        std::lock_guard<std::mutex> guard(StatusMutex); return Status;
    }
    inline void Queue(Action action) {
        int expected = None;
        if (Pending.compare_exchange_strong(expected, action)) Report("Waiting for the game...");
        else Report("An action is already waiting.");
    }
    bool IsLocal(AFortPlayerController* controller);
    bool OnDeath(AFortPlayerController* controller);
    void Tick(UNetDriver* driver);
    void Execute(AFortPlayerControllerAthena* controller, Action action);
}

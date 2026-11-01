#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <random>
#include <cmath>

// Engine-independent rules. A life token identifies a pawn, not a death callback.
namespace InfinityRules {
    constexpr int RespawnLimit = 10;
    constexpr double SelectionDelay = 20.0;
    constexpr float ArenaRadius = 15000.f;
    constexpr float RespawnHeight = 20000.f;
    inline float LargerArena(float previous) {
        const float enlarged = std::isfinite(previous) ? previous * 1.35f : 0.f;
        return enlarged > ArenaRadius ? enlarged : ArenaRadius;
    }
    constexpr float BusSpeed = 1500.f;
    constexpr float BusDropStart = 1.f, BusDropEnd = 17.f, BusFlightEnd = 23.f;
    inline bool CanLeaveBus(bool configured, bool arenaReady, bool inAircraft, double elapsed) {
        // Native end-of-route ejection must still work after the drop window.
        return configured && arenaReady && inAircraft && std::isfinite(elapsed) && elapsed >= BusDropStart;
    }
    struct ZoneLifecycle {
        int stage = 0;
        bool Initialize(bool afterAircraft, bool indicatorReady) {
            const int requested = afterAircraft ? 2 : 1;
            if (!indicatorReady || stage >= requested) return false;
            stage = requested; return true;
        }
    };
    struct FixedArena {
        float radius = 0;
        float Capture(float nativeRadius) {
            if (radius == 0) radius = LargerArena(nativeRadius);
            return radius;
        }
    };
    struct Landing {
        uint64_t pawn = 0;
        double landedAt = -1;
        bool Ready(uint64_t life, bool grounded, double now) {
            if (pawn != life) { pawn = life; landedAt = -1; }
            if (grounded && landedAt < 0) landedAt = now;
            return grounded && landedAt >= 0 && now >= landedAt + SelectionDelay;
        }
    };
    struct Lives {
        int remaining = RespawnLimit;
        bool pending = false, eliminated = false;
        uint64_t lastDeath = 0;
        enum Result { Duplicate, Respawn, Eliminate };
        Result Die(uint64_t life) {
            if (eliminated || pending || life == lastDeath) return Duplicate;
            lastDeath = life;
            if (remaining == 0) { eliminated = true; return Eliminate; }
            --remaining; pending = true; return Respawn;
        }
        void Spawned() { pending = false; }
        void Disconnect() { pending = false; eliminated = true; }
    };
    struct Selection {
        double availableAt = 0;
        // Surviving players may have completed their landing delay already.
        // Losing Thanos starts a separate, shared cooldown for the whole pool.
        void Wait(double now) { availableAt = now + SelectionDelay; }
        template<class Generator>
        std::string Choose(const std::vector<std::string>& eligible, Generator& random, double now) const {
            if (now < availableAt || eligible.empty()) return {};
            // Every eligible player has the same chance, including the previous Thanos.
            return eligible[std::uniform_int_distribution<size_t>(0, eligible.size() - 1)(random)];
        }
    };
}

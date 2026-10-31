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
    inline float LargerArena(float previous) {
        const float enlarged = std::isfinite(previous) ? previous * 1.35f : 0.f;
        return enlarged > ArenaRadius ? enlarged : ArenaRadius;
    }
    constexpr float BusSpeed = 1500.f;
    constexpr float BusDropStart = 1.f, BusDropEnd = 17.f, BusFlightEnd = 23.f;
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
    template<class Generator>
    std::string Choose(const std::vector<std::string>& eligible, const std::string& previous, Generator& random) {
        std::vector<std::string> candidates;
        for (const auto& id : eligible) if (id != previous) candidates.push_back(id);
        // A role never returns immediately to the player who just lost it.
        if (candidates.empty()) return {};
        return candidates[std::uniform_int_distribution<size_t>(0, candidates.size() - 1)(random)];
    }
}

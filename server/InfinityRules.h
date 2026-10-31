#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <random>

// Engine-independent rules. A life token identifies a pawn, not a death callback.
namespace InfinityRules {
    constexpr int RespawnLimit = 10;
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

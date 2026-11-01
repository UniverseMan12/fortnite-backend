#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <random>
#include <cmath>

// Engine-independent rules. A life token identifies a pawn, not a death callback.
namespace InfinityRules {
    constexpr int RespawnLimit = 10;
    constexpr double GauntletDelay = 20.0;
    constexpr float ThanosHealth = 500.f, ThanosShield = 200.f;
    enum class GauntletPhase { Waiting, Falling, Available, Held };
    struct GauntletCycle {
        GauntletPhase phase = GauntletPhase::Waiting;
        double due = -1;
        void Schedule(double now, double delay) { phase = GauntletPhase::Waiting; due = now + delay; }
        bool Due(double now) const { return phase == GauntletPhase::Waiting && due >= 0 && now >= due; }
        void Spawned(bool falling) { phase = falling ? GauntletPhase::Falling : GauntletPhase::Available; }
        void Landed() { if (phase == GauntletPhase::Falling) phase = GauntletPhase::Available; }
        bool Claim() { if (phase != GauntletPhase::Available) return false; phase = GauntletPhase::Held; return true; }
    };
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
}

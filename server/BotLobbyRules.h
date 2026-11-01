#pragma once
#include <cmath>
namespace BotLobbyRules {
    constexpr int MatchSize = 100, Limit = MatchSize - 1;
    inline int Count(int requested, bool showdown) { return showdown ? 0 : requested < 0 ? 0 : requested > Limit ? Limit : requested; }
    inline int Population(int requested, int humans, bool showdown) {
        const int available = humans >= MatchSize ? 0 : MatchSize - (humans < 1 ? 1 : humans);
        const int desired = Count(requested, showdown);
        return desired < available ? desired : available;
    }
    inline bool Enemy(int ownTeam, int otherTeam, bool self, bool alive, bool inAircraft) {
        return !self && alive && !inAircraft && ownTeam != otherTeam;
    }
    inline double JumpTime(double start, double end, double fraction) {
        if (!std::isfinite(start) || !std::isfinite(end) || end <= start) return -1;
        if (!std::isfinite(fraction)) fraction = .5;
        fraction = fraction < .03 ? .03 : fraction > .97 ? .97 : fraction;
        return start + (end - start) * fraction;
    }
    inline bool CanJump(bool inAircraft, bool locked, double now, double planned, double end) {
        return inAircraft && !locked && planned >= 0 && now >= planned && now <= end;
    }
    enum class Stage { Warmup, Bus, Air, Ground, Dead };
    inline bool ShouldPlan(double now, double next) { return now >= next; }
    inline bool CanFight(bool alive, bool targetAlive, bool visible, float distance) {
        return alive && targetAlive && visible && std::isfinite(distance) && distance > 0 && distance <= 8000;
    }
    struct Burst {
        bool firing = false;
        double stopAt = 0, nextAt = 0;
        enum Action { None, Start, Stop };
        Action Tick(bool allowed, double now) {
            if (firing && (!allowed || now >= stopAt)) { firing = false; nextAt = now + 1.2; return Stop; }
            if (!firing && allowed && now >= nextAt) { firing = true; stopAt = now + .35; return Start; }
            return None;
        }
    };
}

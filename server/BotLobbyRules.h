#pragma once
#include <cmath>
namespace BotLobbyRules {
    constexpr int Limit = 10;
    inline int Count(int requested, bool showdown) { return showdown ? 0 : requested < 0 ? 0 : requested > Limit ? Limit : requested; }
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

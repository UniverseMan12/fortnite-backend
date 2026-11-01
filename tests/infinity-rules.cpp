#include "InfinityRules.h"
#include <cassert>
#include <iostream>
#include <set>
int main() {
    using namespace InfinityRules;
    GauntletCycle gauntlet;
    assert(!gauntlet.Due(100) && !gauntlet.Claim());
    gauntlet.Schedule(100,GauntletDelay);
    assert(!gauntlet.Due(119.99) && gauntlet.Due(120));
    gauntlet.Spawned(true);
    assert(!gauntlet.Due(999) && !gauntlet.Claim()); // Can't take it while falling or spawn a second one.
    gauntlet.Landed(); assert(gauntlet.Claim());
    assert(!gauntlet.Claim()); // A second simultaneous pickup cannot create another Thanos.
    gauntlet.Landed(); assert(gauntlet.phase == GauntletPhase::Held);
    gauntlet.Schedule(130,0); assert(gauntlet.Due(130)); // Death/disconnect drops immediately.
    gauntlet.Spawned(false); assert(gauntlet.Claim()); // The former holder can compete for it too.
    assert(BusSpeed > 0 && BusDropStart < BusDropEnd && BusDropEnd < BusFlightEnd);
    assert((BusDropEnd - BusDropStart) * BusSpeed < ArenaRadius * 2);
    assert(!CanLeaveBus(false, true, true, 5));
    assert(!CanLeaveBus(true, false, true, 5)); // No exit into an uninitialized arena.
    assert(!CanLeaveBus(true, true, false, 5)); // Repeated RPC after exiting.
    assert(!CanLeaveBus(true, true, true, -1));
    assert(!CanLeaveBus(true, true, true, BusDropStart - .01));
    assert(CanLeaveBus(true, true, true, BusDropStart));
    assert(CanLeaveBus(true, true, true, BusDropEnd));
    assert(CanLeaveBus(true, true, true, BusFlightEnd)); // Forced native ejection.
    assert(!CanLeaveBus(true, true, true, NAN));
    ZoneLifecycle zone;
    assert(!zone.Initialize(false, false)); // Never advance without an indicator.
    assert(zone.Initialize(false, true)); // Aircraft preview.
    assert(!zone.Initialize(false, true)); // No repeated storm alerts.
    assert(!zone.Initialize(true, false));
    assert(zone.Initialize(true, true)); // Complete initialization after the bus.
    assert(!zone.Initialize(true, true));
    assert(!zone.Initialize(false, true)); // Do not return to preview.
    FixedArena arena;
    assert(arena.Capture(10000) == 15000);
    assert(arena.Capture(15000) == 15000); // Repairs must not grow the arena.
    assert(arena.Capture(80000) == 15000); // Native post-bus reset is ignored.
    assert(LargerArena(20000) == 27000);
    assert(LargerArena(8000) == 15000);
    assert(LargerArena(-1) == 15000);
    Lives a,b;
    assert(a.Die(100) == Lives::Respawn);
    assert(a.remaining == 9 && a.pending);
    assert(a.Die(100) == Lives::Duplicate && a.remaining == 9);
    assert(a.Die(101) == Lives::Duplicate && a.remaining == 9); // retry must not spend another life
    assert(b.remaining == 10); // player budgets are independent
    a.Spawned();
    assert(a.Die(100) == Lives::Duplicate); // late notification from old pawn
    for(uint64_t i=101;i<=109;++i) {assert(a.Die(i)==Lives::Respawn);a.Spawned();}
    assert(a.remaining==0 && !a.eliminated); // tenth respawn is playable
    assert(a.Die(110)==Lives::Eliminate && a.eliminated);
    assert(a.Die(110)==Lives::Duplicate && a.remaining==0);
    assert(b.Die(200)==Lives::Respawn && b.remaining==9);
    b.Disconnect(); assert(b.eliminated && !b.pending && b.remaining==9);
    std::cout << "PASS: gauntlet landing/claim exclusivity, death/disconnect re-drop, bus timing, arena lifecycle, 10 respawns and duplicate-death protection.\n";
}

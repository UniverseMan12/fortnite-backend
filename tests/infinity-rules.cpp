#include "InfinityRules.h"
#include <cassert>
#include <iostream>
#include <set>
int main() {
    using namespace InfinityRules;
    Landing landing;
    assert(!landing.Ready(1, false, 100)); // Skydiving must not start the timer.
    assert(!landing.Ready(1, true, 140));
    assert(!landing.Ready(1, true, 159.99));
    assert(!landing.Ready(1, false, 160)); // No midair transformation after a jump.
    assert(landing.Ready(1, true, 161)); // Jumping does not reset the first landing.
    assert(!landing.Ready(2, true, 180)); // New pawn/life gets a fresh delay.
    assert(landing.Ready(2, true, 200));
    assert(BusSpeed > 0 && BusDropStart < BusDropEnd && BusDropEnd < BusFlightEnd);
    assert((BusDropEnd - BusDropStart) * BusSpeed < ArenaRadius * 2);
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
    std::mt19937 random(42); std::set<std::string> selected;
    for(int i=0;i<1000;++i) {auto chosen=Choose({"a","b","c"},"b",random);assert(chosen!="b" && !chosen.empty()); selected.insert(chosen);}
    assert(selected==std::set<std::string>({"a","c"}));
    assert(Choose({},"",random).empty());
    assert(Choose({"a"},"a",random).empty());
    assert(Choose({"a"},"a",random,true)=="a");
    assert(Choose({"a","b"},"a",random,true)=="b");
    assert(Choose({},"a",random,true).empty());
    assert(Choose({"a"},"",random)=="a");
    std::cout << "PASS: landing delay, airborne exclusion, new-life delay, bus timing, 10 respawns, independent budgets, duplicate deaths, failed-spawn retries, disconnect forfeits and random role rotation.\n";
}

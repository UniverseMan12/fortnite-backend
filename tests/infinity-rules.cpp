#include "InfinityRules.h"
#include <cassert>
#include <iostream>
#include <set>
int main() {
    using namespace InfinityRules;
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
    assert(Choose({"a"},"",random)=="a");
    std::cout << "PASS: 10 respawns plus initial life, independent budgets, duplicate deaths, failed-spawn retries, disconnect forfeits and random role rotation.\n";
}

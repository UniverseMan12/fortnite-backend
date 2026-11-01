#include "BotLobbyRules.h"
#include <cassert>
int main() {
    using namespace BotLobbyRules;
    assert(Count(5,true)==0 && Count(100,true)==0);
    assert(Count(-1,false)==0 && Count(5,false)==5 && Count(100,false)==10);
    assert(!CanFight(true,true,false,100)); // Never shoot through a wall.
    assert(!CanFight(false,true,true,100) && !CanFight(true,false,true,100));
    assert(!CanFight(true,true,true,NAN) && !CanFight(true,true,true,8001));
    assert(CanFight(true,true,true,8000));
    Burst burst;
    assert(burst.Tick(false,0)==Burst::None);
    assert(burst.Tick(true,0)==Burst::Start);
    assert(burst.Tick(true,.1)==Burst::None);
    assert(burst.Tick(false,.2)==Burst::Stop); // Target death / loss of sight stops an active burst.
    assert(burst.Tick(true,1.39)==Burst::None);
    assert(burst.Tick(true,1.4)==Burst::Start);
    assert(burst.Tick(true,1.76)==Burst::Stop);
}

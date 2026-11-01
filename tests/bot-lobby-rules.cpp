#include "BotLobbyRules.h"
#include <cassert>
int main() {
    using namespace BotLobbyRules;
    assert(Count(5,true)==0 && Count(100,true)==0);
    assert(Count(-1,false)==0 && Count(5,false)==5 && Count(100,false)==99);
    assert(Population(99,1,false)==99 && Population(99,2,false)==98);
    assert(Population(99,100,false)==0 && Population(99,101,false)==0);
    assert(Population(99,0,false)==99 && Population(3,2,false)==3);
    assert(Population(99,1,true)==0 && Population(-1,1,false)==0);
    assert(Enemy(2,3,false,true,false)); // A bot and a human obey the same team rules.
    assert(!Enemy(2,2,false,true,false) && !Enemy(2,3,true,true,false));
    assert(!Enemy(2,3,false,false,false) && !Enemy(2,3,false,true,true));
    assert(JumpTime(10,40,0)>10 && JumpTime(10,40,1)<40);
    assert(JumpTime(10,40,.2)<JumpTime(10,40,.8));
    assert(JumpTime(10,10,.5)==-1 && JumpTime(NAN,40,.5)==-1);
    assert(!CanJump(true,true,20,15,40) && !CanJump(true,false,14,15,40));
    assert(!CanJump(false,false,20,15,40) && !CanJump(true,false,41,15,40));
    assert(CanJump(true,false,20,15,40));
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

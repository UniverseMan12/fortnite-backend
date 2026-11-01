// Included after LocalTools.inl and InfinityShowdown.inl in NetDriver.cpp.
// All Unreal objects are touched on the game thread, never from the Reboot UI.
#include "BotLobby.h"
#include "BotLobbyRules.h"
#include "bots.h"
#include <random>
#include <map>
#include <algorithm>
namespace BotLobby {
    using Ref = LocalTools::TrackedObject;
    using Stage = BotLobbyRules::Stage;
    struct Bot {
        Ref controller, pawn, target;
        BotLobbyRules::Burst burst;
        Stage stage = Stage::Warmup;
        FVector destination{}, input{}, lastLocation{};
        std::vector<FVector> path;
        size_t pathIndex = 0;
        double planAt = 0, pathAt = 0, jumpAt = 0, stopJumpAt = 0, sampleAt = 0, wanderAt = 0, retryAt = 0;
        double busJumpAt = -1;
        int id = 0, lastAmmo = -1, stalls = 0;
        bool moved = false, fired = false, ready = false, fireWarning = false;
    };
    static std::vector<Bot> Active;
    static std::vector<FVector> WarmupPoints, LandingPoints;
    static Ref World, Driver;
    static int NextId = 0, Failures = 0, RequestedForRound = -1;
    static double NextSpawn = 0, NextStatus = 0, NextPopulation = 0;
    static bool Faulted = false, LocationsLoaded = false, PopulationClosed = false;
    static int PathBudget = 0;
    static std::mt19937 Random(std::random_device{}());
    static float Rand(float min, float max) { return std::uniform_real_distribution<float>(min,max)(Random); }
    static float FlatDistance(FVector a, FVector b) { const float x=a.X-b.X,y=a.Y-b.Y; return std::sqrt(x*x+y*y); }
    static FVector Direction(FVector from, FVector to) {
        const float distance=FlatDistance(from,to);
        return distance > 1 ? FVector((to.X-from.X)/distance,(to.Y-from.Y)/distance,0) : FVector(0,0,0);
    }
    // Parameter layouts come from this running build, not offsets from another SDK.
    struct Call {
        UObject* object; UFunction* fn; std::vector<uint8_t> bytes; bool valid;
        Call(UObject* target, const char* name) : object(target), fn(target ? target->FindFunction(name) : nullptr), valid(fn != nullptr) {
            if (fn) bytes.resize(fn->GetPropertiesSize(),0);
        }
        template<class T> void Set(const char* name, const T& value) {
            const int offset=fn ? fn->GetOffsetFunc(name) : -1;
            if (offset<0 || size_t(offset)+sizeof(T)>bytes.size()) { valid=false; return; }
            memcpy(bytes.data()+offset,&value,sizeof(T));
        }
        template<class T> T Get(const char* name="ReturnValue") {
            T value{}; const int offset=fn ? fn->GetOffsetFunc(name) : -1;
            if(valid && offset>=0 && size_t(offset)+sizeof(T)<=bytes.size()) memcpy(&value,bytes.data()+offset,sizeof(T));
            return value;
        }
        bool Run() { if (!valid) return false; object->ProcessEvent(fn,bytes.data()); return true; }
        bool Result() { return Get<bool>(); }
    };
    template<class T> static bool Put(UObject* object, const char* name, const T& value) {
        const int offset=object ? object->GetOffset(name,false) : -1;
        if(offset<0) return false; object->Get<T>(offset)=value; return true;
    }
    template<class T> static T Read(UObject* object, const char* name, T fallback={}) {
        const int offset=object ? object->GetOffset(name,false) : -1;
        return offset<0 ? fallback : object->Get<T>(offset);
    }
    static bool Flag(UObject* object, const char* name, bool value) {
        const int offset=object ? object->GetOffset(name,false) : -1;
        auto property=object ? object->GetProperty(name,false) : nullptr;
        if(offset<0 || !property) return false;
        object->SetBitfieldValue(offset,GetFieldMask(property),value); return true;
    }
    static bool FlagValue(UObject* object, const char* name, bool fallback) {
        const int offset=object ? object->GetOffset(name,false) : -1;
        auto property=object ? object->GetProperty(name,false) : nullptr;
        return offset<0 || !property ? fallback : object->ReadBitfieldValue(offset,GetFieldMask(property));
    }
    static bool Living(AFortPlayerPawn* pawn) { return pawn && !pawn->IsActorBeingDestroyed() && pawn->GetHealth()>0 && !pawn->IsDBNO(); }
    static void Fail(const char* reason) { Faulted=true; Report(reason); LOG_ERROR(LogDev,"Bot lobby: {}",reason); }
    static bool ConfigurePawn(AFortPlayerControllerAthena* controller, AFortPlayerPawn* pawn, bool air) {
        // No LocalPlayer/NetConnection exists for a bot. Otherwise CharacterMovement
        // waits for client moves which never arrive on this server-only controller.
        if (!Put(controller,"bIsLocalPlayerController",true)) return false;
        Put(pawn,"RemoteRole",ENetRole::ROLE_SimulatedProxy);
        Put(controller,"AcknowledgedPawn",static_cast<APawn*>(pawn));
        Call reset(controller,"ResetIgnoreMoveInput"); if(!reset.Run()) return false;
        auto movement=Read<UObject*>(pawn,"CharacterMovement"); if(!movement) return false;
        Flag(movement,"bRunPhysicsWithNoController",true);
        Call enable(movement,"SetComponentTickEnabled"); enable.Set("bEnabled",true); if(!enable.Run()) return false;
        // Preserve Fortnite's custom skydiving mode on an already airborne pawn.
        if(!air || Read<uint8_t>(movement,"MovementMode")==0) {
            Call mode(movement,"SetMovementMode"); mode.Set<uint8_t>("NewMovementMode",air ? 3 : 1); mode.Set<uint8_t>("NewCustomMode",0);
            if(!mode.Run()) return false;
        }
        if(air && !Read<bool>(pawn,"bIsSkydiving")) {
            Call skydive(pawn,"BeginSkydiving"); skydive.Set("bFromBus",true); if(!skydive.Run()) return false;
        }
        Call view(controller,"SetViewTargetWithBlend"); view.Set<AActor*>("NewViewTarget",pawn);
        view.Set("BlendTime",0.f); view.Set<uint8_t>("BlendFunc",0); view.Set("BlendExp",0.f); view.Set("bLockOutgoing",false); view.Run();
        Call local(pawn,"IsLocallyControlled");
        if(!local.Run() || !local.Result()) return false;
        pawn->ForceNetUpdate(); return true;
    }
    static bool Fire(AFortPlayerControllerAthena* controller, AFortPlayerPawn* pawn, bool on) {
        auto weapon=pawn->GetCurrentWeapon();
        auto state=Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        auto asc=state ? state->GetAbilitySystemComponent() : nullptr;
        const auto handle=Read<FGameplayAbilitySpecHandle>(weapon,"PrimaryAbilitySpecHandle");
        auto spec=asc && handle.Handle ? asc->FindAbilitySpecFromHandle(handle) : nullptr;
        const int inputOffset=FindOffsetStruct("/Script/GameplayAbilities.GameplayAbilitySpec","InputPressed",false);
        if(spec && inputOffset>=0) SetBitfield(reinterpret_cast<PlaceholderBitfield*>(reinterpret_cast<uint8_t*>(spec)+inputOffset),1,on);
        Call call(pawn,on ? "PawnStartFire" : "PawnStopFire"); call.Set<uint8_t>("FireModeNum",0);
        if(!call.Run()) return false;
        if(!on) { if(weapon) { Call release(weapon,"ServerReleaseWeaponPrimaryAbility"); release.Run(); } return true; }
        // Supply authority-side ability activation if PawnStartFire did not activate
        // the weapon. Never activate a second instance of an already active spec.
        const int activeOffset=FindOffsetStruct("/Script/GameplayAbilities.GameplayAbilitySpec","ActiveCount",false);
        if(!spec || activeOffset<0) return false;
        if(*(reinterpret_cast<uint8_t*>(spec)+activeOffset)>0) return true;
        auto prediction=FPredictionKey::GetStruct(); if(!prediction) return false;
        UObject* instance=nullptr;
        if(prediction->GetPropertiesSize()==sizeof(PadHex10) && UAbilitySystemComponent::InternalTryActivateAbilityOriginal)
            return UAbilitySystemComponent::InternalTryActivateAbilityOriginal(asc,handle,PadHex10{},&instance,nullptr,nullptr);
        if(prediction->GetPropertiesSize()==sizeof(PadHex18) && UAbilitySystemComponent::InternalTryActivateAbilityOriginal2)
            return UAbilitySystemComponent::InternalTryActivateAbilityOriginal2(asc,handle,PadHex18{},&instance,nullptr,nullptr);
        return false;
    }
    static bool Visible(AFortPlayerControllerAthena* controller, AFortPlayerPawn* target) {
        auto pawn=controller->GetMyFortPawn(); if(!pawn) return false;
        FVector eye=pawn->GetActorLocation(); eye.Z+=65;
        Call call(controller,"LineOfSightTo"); call.Set<AActor*>("Other",target);
        call.Set("ViewPoint",eye); call.Set("bAlternateChecks",false);
        return call.Run() && call.Result();
    }
    static void Aim(AFortPlayerControllerAthena* controller,FVector from,FVector to,float spread=0) {
        const float flat=FlatDistance(from,to); if(flat<1) return;
        FRotator rotation{float(std::atan2(to.Z-from.Z,flat)*57.29578),float(std::atan2(to.Y-from.Y,to.X-from.X)*57.29578)+spread,0};
        Call aim(controller,"SetControlRotation"); aim.Set("NewRotation",rotation); aim.Run();
    }
    static void LoadLocations() {
        auto warmupClass=FindObject<UClass>(L"/Script/FortniteGame.FortPlayerStartWarmup");
        if(!warmupClass) return;
        auto starts=UGameplayStatics::GetAllActorsOfClass(GetWorld(),warmupClass);
        for(int i=0;i<starts.Num();++i) if(starts.at(i)) WarmupPoints.push_back(starts.at(i)->GetActorLocation());
        starts.Free(); if(WarmupPoints.empty()) return;
        auto containerClass=FindObject<UClass>(L"/Script/FortniteGame.BuildingContainer");
        if(!containerClass) return;
        auto containers=UGameplayStatics::GetAllActorsOfClass(GetWorld(),containerClass);
        // One anchor per map cell spreads destinations over the actual loaded island.
        std::map<std::pair<int,int>,FVector> cells;
        for(int i=0;i<containers.Num();++i) if(containers.at(i)) {
            auto p=containers.at(i)->GetActorLocation(); bool warmup=false;
            for(const auto& w:WarmupPoints) if(FlatDistance(p,w)<18000) { warmup=true; break; }
            if(!warmup) cells.emplace(std::make_pair(int(std::floor(p.X/9000)),int(std::floor(p.Y/9000))),p);
        }
        containers.Free();
        for(auto& cell:cells) LandingPoints.push_back(cell.second);
        std::shuffle(LandingPoints.begin(),LandingPoints.end(),Random);
        LocationsLoaded=!LandingPoints.empty();
        LOG_INFO(LogDev,"Bot lobby: {} warmup starts, {} distributed landing cells.",WarmupPoints.size(),LandingPoints.size());
    }
    static int FreeTeam(AFortGameModeAthena* mode, AFortPlayerControllerAthena* except=nullptr) {
        bool used[102]{};
        auto& players=mode->GetAlivePlayers();
        for(int i=0;i<players.Num();++i) if(players.at(i) && players.at(i)!=except) {
            auto state=Cast<AFortPlayerStateAthena>(players.at(i)->GetPlayerState());
            if(state && state->GetTeamIndex()<102) used[state->GetTeamIndex()]=true;
        }
        for(int i=101;i>=2;--i) if(!used[i]) return i;
        return -1;
    }
    static void SetTeam(AFortGameStateAthena* game,AFortPlayerStateAthena* state,int team) {
        state->GetTeamIndex()=uint8_t(team);
        if(state->GetOffset("SquadId",false)>=0) state->GetSquadId()=team-NumToSubtractFromSquadId;
        Call notify(state,"OnRep_TeamIndex"); notify.Run(); game->AddPlayerStateToGameMemberInfo(state); state->ForceNetUpdate();
    }
    static bool Equip(AFortPlayerControllerAthena* controller,AFortPlayerPawn* pawn) {
        auto rifle=FindObject<UFortWeaponItemDefinition>("WID_Assault_Auto_Athena_R_Ore_T03",nullptr,ANY_PACKAGE);
        auto ammo=FindObject<UFortItemDefinition>("AthenaAmmoDataBulletsMedium",nullptr,ANY_PACKAGE);
        auto inventory=controller->GetWorldInventory(); if(!rifle || !ammo || !inventory) return false;
        auto item=inventory->FindItemInstance(rifle);
        if(!item) {
            inventory->AddItem(rifle,nullptr,1,rifle->GetClipSize()); inventory->AddItem(ammo,nullptr,999); inventory->Update();
            item=inventory->FindItemInstance(rifle);
        }
        if(!item) return false;
        AFortPlayerController::ServerExecuteInventoryItemHook(controller,item->GetItemEntry()->GetItemGuid());
        return pawn->GetCurrentWeapon() && pawn->GetCurrentWeapon()->GetWeaponData()==rifle;
    }
    static bool Spawn(AFortGameModeAthena* mode,AFortGameStateAthena* game,FVector location) {
        auto pawnClass=FindObject<UClass>(L"/Game/Athena/PlayerPawn_Athena.PlayerPawn_Athena_C");
        const int team=FreeTeam(mode); if(!pawnClass || team<0) return false;
        auto controller=GetWorld()->SpawnActor<AFortPlayerControllerAthena>(AFortPlayerControllerAthena::StaticClass());
        if(!controller) return false;
        Ref controllerRef(controller),pawnRef;
        auto abort=[&]() {
            if(auto current=Cast<AFortPlayerControllerAthena>(controllerRef.Get())) {
                if(auto inventory=current->GetWorldInventory()) inventory->K2_DestroyActor();
                current->K2_DestroyActor();
            }
            if(auto current=Cast<AActor>(pawnRef.Get())) current->K2_DestroyActor();
            return false;
        };
        auto state=Cast<AFortPlayerStateAthena>(controller->GetPlayerState()); if(!state) return abort();
        Put(controller,"bIsLocalPlayerController",true);
        Put(controller,"bHasServerFinishedLoading",true); Put(controller,"bHasClientFinishedLoading",true);
        Flag(controller,"bReadyToStartMatch",true); Flag(state,"bHasStartedPlaying",true); state->SetIsBot(true);
        FTransform transform{}; transform.Translation=location; transform.Rotation=FRotator{0,0,0}.Quaternion(); transform.Scale3D=FVector(1,1,1);
        auto pawn=GetWorld()->SpawnActor<AFortPlayerPawnAthena>(pawnClass,transform,CreateSpawnParameters(ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn));
        if(!pawn) return abort(); pawnRef=Ref(pawn);
        controller->Possess(pawn); pawn->SetOwner(controller);
        for(auto name:{"PawnStartFire","PawnStopFire","AddMovementInput"}) if(!pawn->FindFunction(name)) return abort();
        if(!ConfigurePawn(controller,pawn,false)) return abort();
        std::wstring name=L"NovaBot_"+std::to_wstring(++NextId); controller->ServerChangeName(name.c_str()); state->OnRep_PlayerName();
        PlayerBot setup; setup.Controller=controller; setup.Pawn=pawn; setup.PlayerState=state; setup.SetupInventory();
        if(!controllerRef.Get() || !pawnRef.Get() || controller->IsActorBeingDestroyed() || pawn->IsActorBeingDestroyed()) return abort();
        auto abilities=GetPlayerAbilitySet(); auto asc=state->GetAbilitySystemComponent(); if(!abilities || !asc) return abort();
        abilities->GiveToAbilitySystem(asc); setup.PickRandomLoadout(); setup.ApplyCosmeticLoadout();
        if(!Equip(controller,pawn)) return abort();
        pawn->SetMaxHealth(100); pawn->SetHealth(100); pawn->SetCanBeDamaged(false);
        SetTeam(game,state,team); mode->GetAlivePlayers().Add(controller); ++game->GetPlayersLeft(); game->OnRep_PlayersLeft();
        Bot bot; bot.controller=controllerRef; bot.pawn=pawnRef; bot.id=NextId;
        bot.destination=WarmupPoints[NextId%WarmupPoints.size()]; bot.lastLocation=pawn->GetActorLocation(); bot.ready=true;
        Active.push_back(bot); pawn->ForceNetUpdate(); return true;
    }
    static void RemoveWarmupBot(AFortGameModeAthena* mode,AFortGameStateAthena* game,Bot& bot) {
        auto controller=Cast<AFortPlayerControllerAthena>(bot.controller.Get());
        auto pawn=Cast<AFortPlayerPawn>(bot.pawn.Get());
        if(controller && pawn) Fire(controller,pawn,false);
        auto& alive=mode->GetAlivePlayers();
        for(int i=alive.Num()-1;i>=0;--i) if(alive.at(i)==controller) { alive.Remove(i); if(game->GetPlayersLeft()>0) --game->GetPlayersLeft(); }
        if(pawn) pawn->K2_DestroyActor();
        if(controller) { if(auto inventory=controller->GetWorldInventory()) inventory->K2_DestroyActor(); controller->K2_DestroyActor(); }
        game->OnRep_PlayersLeft();
    }
    static AActor* Aircraft(AFortGameStateAthena* game) {
        const int offset=game->GetOffset("Aircrafts",false);
        if(offset>=0) { auto& aircraft=game->Get<TArray<AActor*>>(offset); return aircraft.Num()>0 ? aircraft.at(0) : nullptr; }
        return Read<AActor*>(game,"Aircraft");
    }
    static double PlanJump(AActor* aircraft,FVector destination,int id) {
        const double start=Read<float>(aircraft,"DropStartTime"),end=Read<float>(aircraft,"DropEndTime");
        double fraction=double((id*37)%100)/100;
        const int flightOffset=aircraft->GetOffset("FlightInfo",false);
        const int originOffset=FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo","FlightStartLocation",false);
        const int rotationOffset=FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo","FlightStartRotation",false);
        const int speedOffset=FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo","FlightSpeed",false);
        if(flightOffset>=0 && originOffset>=0 && rotationOffset>=0 && speedOffset>=0 && end>start) {
            auto bytes=aircraft->GetPtr<uint8_t>(flightOffset);
            auto origin=*reinterpret_cast<FVector*>(bytes+originOffset);
            auto rotation=*reinterpret_cast<FRotator*>(bytes+rotationOffset);
            const float speed=*reinterpret_cast<float*>(bytes+speedOffset);
            if(speed>1) {
                const float yaw=rotation.Yaw*.0174532925f;
                const double along=(destination.X-origin.X)*std::cos(yaw)+(destination.Y-origin.Y)*std::sin(yaw);
                const double nearest=Read<float>(aircraft,"FlightStartTime")+along/speed;
                fraction=(nearest-start)/(end-start);
            }
        }
        return BotLobbyRules::JumpTime(start,end,fraction);
    }
    static void PathTo(Bot& bot,AFortPlayerPawn* pawn,FVector destination,double now) {
        if(now<bot.pathAt || PathBudget<=0) return;
        --PathBudget; bot.pathAt=now+2.5+Rand(0,.5f); bot.path.clear(); bot.pathIndex=0;
        auto library=FindObject<UObject>(L"/Script/Engine.Default__NavigationSystem");
        if(!library) library=FindObject<UObject>(L"/Script/NavigationSystem.Default__NavigationSystemV1");
        if(!library) return;
        Call find(library,"FindPathToLocationSynchronously"); find.Set<UObject*>("WorldContextObject",GetWorld());
        find.Set("PathStart",pawn->GetActorLocation()); find.Set("PathEnd",destination); find.Set<UObject*>("PathfindingContext",pawn);
        if(!find.Run()) return; auto path=find.Get<UObject*>(); if(!path) return;
        const int offset=path->GetOffset("PathPoints",false); if(offset<0) return;
        auto& points=path->Get<TArray<FVector>>(offset);
        if(points.Num()>1 && points.Num()<256) for(int i=1;i<points.Num();++i) bot.path.push_back(points.at(i));
    }
    struct Candidate { AFortPlayerPawn* pawn; int team; };
    static bool StormDestination(AFortGameModeAthena* mode,FVector from,FVector& goal) {
        auto zone=mode->GetSafeZoneIndicator(); if(!zone) return false;
        const float radius=Read<float>(zone,"NextRadius"); auto center=Read<FVector>(zone,"NextCenter");
        if(!std::isfinite(radius) || radius<100 || FlatDistance(from,center)<radius*.82f) return false;
        goal=center; goal.Z=from.Z; return true;
    }
    static void Plan(Bot& bot,AFortPlayerControllerAthena* controller,AFortPlayerPawn* pawn,
                     AFortGameModeAthena* mode,const std::vector<Candidate>& candidates,double now) {
        bot.planAt=now+.25+Rand(0,.10f);
        const auto from=pawn->GetActorLocation();
        if(bot.stage==Stage::Air) {
            // Long cross-map destinations require deploying before the automatic low
            // altitude opening. Use the real parachute action, never teleport a landing.
            const float height=from.Z-bot.destination.Z;
            if(height>2500 && FlatDistance(from,bot.destination)>height*1.2f && !Read<bool>(pawn,"bIsParachuteOpen") && now>=bot.jumpAt) {
                Call open(pawn,"OnOpenParachute"); open.Run(); bot.jumpAt=now+1;
            }
            bot.input=Direction(from,bot.destination); Aim(controller,from,bot.destination); return;
        }
        auto state=Cast<AFortPlayerStateAthena>(controller->GetPlayerState()); if(!state) return;
        AFortPlayerPawn* target=nullptr; float best=16000;
        // Same team/visibility rules for bot and human opponents.
        std::vector<std::pair<float,AFortPlayerPawn*>> nearby;
        if(bot.stage==Stage::Ground) for(const auto& candidate:candidates) {
            if(!BotLobbyRules::Enemy(state->GetTeamIndex(),candidate.team,candidate.pawn==pawn,Living(candidate.pawn),false)) continue;
            const float distance=FlatDistance(from,candidate.pawn->GetActorLocation());
            if(distance<16000) nearby.emplace_back(distance,candidate.pawn);
        }
        std::sort(nearby.begin(),nearby.end(),[](const auto& a,const auto& b){return a.first<b.first;});
        bool visible=false;
        for(size_t i=0;i<nearby.size() && i<3;++i) if(Visible(controller,nearby[i].second)) { target=nearby[i].second; best=nearby[i].first; visible=true; break; }
        if(!target && !nearby.empty()) { target=nearby.front().second; best=nearby.front().first; }
        if(bot.target.Get()!=target && bot.burst.firing) { Fire(controller,pawn,false); bot.burst.firing=false; }
        bot.target=Ref(target);
        FVector goal=bot.destination;
        const bool retreat=bot.stage==Stage::Ground && StormDestination(mode,from,goal);
        if(!retreat && target) goal=target->GetActorLocation();
        else if(!retreat && (now>=bot.wanderAt || FlatDistance(from,goal)<300)) {
            if(bot.stage==Stage::Warmup) goal=WarmupPoints[std::uniform_int_distribution<size_t>(0,WarmupPoints.size()-1)(Random)];
            else { const float angle=Rand(0,6.2831853f); goal=from; goal.X+=std::cos(angle)*3000; goal.Y+=std::sin(angle)*3000; }
            bot.destination=goal; bot.wanderAt=now+10;
        }
        if(target) Aim(controller,from,target->GetActorLocation(),Rand(-3,3)); else Aim(controller,from,goal);
        const bool allowed=BotLobbyRules::CanFight(bot.stage==Stage::Ground,!retreat && target,visible,best);
        const auto action=bot.burst.Tick(allowed,now);
        if(action==BotLobbyRules::Burst::Stop) Fire(controller,pawn,false);
        if(action==BotLobbyRules::Burst::Start) {
            auto weapon=pawn->GetCurrentWeapon();
            if(weapon && weapon->GetAmmoCount()<=0) { Call reload(weapon,"Reload"); reload.Run(); bot.burst.firing=false; bot.burst.nextAt=now+3; }
            else if(!Fire(controller,pawn,true)) {
                Fire(controller,pawn,false); bot.burst.firing=false; bot.burst.nextAt=now+2;
                if(!bot.fireWarning) {
                    LOG_WARN(LogDev,"Bot lobby: NovaBot_{} native rifle activation rejected (ammo {}, handle {}).",bot.id,
                        weapon ? weapon->GetAmmoCount() : -1,Read<FGameplayAbilitySpecHandle>(weapon,"PrimaryAbilitySpecHandle").Handle);
                    bot.fireWarning=true;
                }
            }
        }
        PathTo(bot,pawn,goal,now);
        while(bot.pathIndex<bot.path.size() && FlatDistance(from,bot.path[bot.pathIndex])<180) ++bot.pathIndex;
        const auto waypoint=bot.pathIndex<bot.path.size() ? bot.path[bot.pathIndex] : goal;
        bot.input=Direction(from,waypoint);
        if(visible && best<1800 && !retreat) { auto toward=Direction(from,goal); const float side=(bot.id%2) ? 1.f : -1.f; bot.input=FVector(-toward.Y*side,toward.X*side,0); }
        if(bot.stalls>1 && now>=bot.jumpAt) {
            // Fallback when navmesh is absent or a path is blocked; keep engine collision.
            const float side=(bot.id%2) ? 1.f : -1.f; bot.input=FVector(-bot.input.Y*side,bot.input.X*side,0);
            Call jump(pawn,"Jump"); jump.Run(); bot.stopJumpAt=now+.2; bot.jumpAt=now+2; bot.pathAt=0;
        }
    }
    void Tick(UNetDriver* driver) {
        if(!driver || !Globals::bStartedListening) return;
        auto world=GetWorld(); if(!world) return;
        if(World.Get()!=world || Driver.Get()!=driver) {
            World=Ref(world); Driver=Ref(driver); Active.clear(); WarmupPoints.clear(); LandingPoints.clear();
            NextId=Failures=0; RequestedForRound=-1; NextSpawn=NextStatus=NextPopulation=0;
            Faulted=LocationsLoaded=PopulationClosed=false; Alive.store(0); Moving.store(0); Shooting.store(0);
        }
        auto game=Cast<AFortGameStateAthena>(world->GetGameState()); auto mode=Cast<AFortGameModeAthena>(world->GetGameMode());
        if(!game || !mode) return;
        if(RequestedForRound<0) RequestedForRound=BotLobbyRules::Count(Requested.load(),InfinityShowdown::Enabled.load());
        if(!RequestedForRound || InfinityShowdown::Enabled.load()) return;
        const double now=game->GetServerWorldTimeSeconds(); const auto phase=game->GetGamePhase();
        const bool warmup=phase==EAthenaGamePhase::Warmup;
        if(phase>=EAthenaGamePhase::Aircraft) PopulationClosed=true;
        std::vector<AFortPlayerControllerAthena*> humans;
        std::vector<Candidate> candidates;
        auto& connections=driver->GetClientConnections();
        for(int i=0;i<connections.Num();++i) {
            auto connection=connections.at(i); if(!connection) continue;
            auto controller=Cast<AFortPlayerControllerAthena>(connection->GetPlayerController()); if(!controller) continue;
            humans.push_back(controller);
            auto pawn=Cast<AFortPlayerPawn>(controller->GetMyFortPawn()); auto state=Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
            if(Living(pawn) && state && !state->IsInAircraft()) candidates.push_back({pawn,state->GetTeamIndex()});
        }
        const int desired=BotLobbyRules::Population(RequestedForRound,int(humans.size()),false);
        if(warmup && !Faulted && !PopulationClosed && !humans.empty()) {
            if(now>=NextPopulation) {
                NextPopulation=now+1;
                if(!LocationsLoaded) { WarmupPoints.clear(); LandingPoints.clear(); LoadLocations(); }
                while(int(Active.size())>desired) { RemoveWarmupBot(mode,game,Active.back()); Active.pop_back(); }
                for(auto& bot:Active) {
                    auto controller=Cast<AFortPlayerControllerAthena>(bot.controller.Get());
                    auto state=controller ? Cast<AFortPlayerStateAthena>(controller->GetPlayerState()) : nullptr; if(!state) continue;
                    for(auto human:humans) {
                        auto humanState=Cast<AFortPlayerStateAthena>(human->GetPlayerState());
                        if(humanState && state->GetTeamIndex()==humanState->GetTeamIndex()) { const int team=FreeTeam(mode,controller); if(team>=0) SetTeam(game,state,team); }
                    }
                }
            }
            if(LocationsLoaded && int(Active.size())<desired && now>=NextSpawn) {
                NextSpawn=now+.1;
                for(int batch=0;batch<2 && int(Active.size())<desired;++batch) {
                    auto location=WarmupPoints[NextId%WarmupPoints.size()]; location.X+=Rand(-160,160); location.Y+=Rand(-160,160); location.Z+=80;
                    if(!Spawn(mode,game,location) && ++Failures>=3) { Fail("Bot setup failed: local control, inventory or ability is unavailable. See server log."); break; }
                }
            }
        }
        auto aircraft=Aircraft(game); PathBudget=2;
        // Refresh pawn references before selecting targets: the bus replaces pawns.
        for(auto& bot:Active) {
            auto controller=Cast<AFortPlayerControllerAthena>(bot.controller.Get());
            auto state=controller ? Cast<AFortPlayerStateAthena>(controller->GetPlayerState()) : nullptr;
            if(!controller || !state) { bot.stage=Stage::Dead; continue; }
            if(bot.stage==Stage::Dead) continue;
            auto pawn=Cast<AFortPlayerPawn>(controller->GetMyFortPawn());
            if(state->IsInAircraft()) {
                if(bot.stage!=Stage::Bus) {
                    if(auto old=Cast<AFortPlayerPawn>(bot.pawn.Get())) Fire(controller,old,false);
                    bot.burst={}; bot.stage=Stage::Bus; bot.input={}; bot.ready=false; bot.path.clear(); bot.moved=false;
                    if(!LandingPoints.empty()) bot.destination=LandingPoints[(bot.id-1)%LandingPoints.size()];
                }
                if(aircraft && !Faulted) {
                    if(bot.busJumpAt<0) bot.busJumpAt=PlanJump(aircraft,bot.destination,bot.id);
                    const double end=Read<float>(aircraft,"DropEndTime");
                    if(now>=bot.retryAt && BotLobbyRules::CanJump(true,FlagValue(game,"bAircraftIsLocked",true),now,bot.busJumpAt,end)) {
                        Aim(controller,aircraft->GetActorLocation(),bot.destination);
                        AFortPlayerController::ServerAttemptAircraftJumpHook(controller,controller->GetControlRotation()); bot.retryAt=now+1;
                    }
                }
                continue;
            }
            // A missing warmup pawn in the aircraft transition is not an elimination.
            if(!Living(pawn)) {
                if((phase==EAthenaGamePhase::Aircraft && bot.stage==Stage::Warmup) || bot.stage==Stage::Bus) continue;
                if(pawn && bot.burst.firing) Fire(controller,pawn,false);
                bot.stage=Stage::Dead; bot.input={}; continue;
            }
            if(bot.pawn.Get()!=pawn || !bot.ready) {
                bot.pawn=Ref(pawn); bot.lastLocation=pawn->GetActorLocation(); bot.lastAmmo=-1; bot.sampleAt=now+1; bot.stalls=0;
                const bool air=phase>=EAthenaGamePhase::Aircraft;
                bot.ready=ConfigurePawn(controller,pawn,air);
                if(!bot.ready) { Fail("Bot pawn lost server control after the bus transition."); continue; }
                if(air) { bot.stage=Stage::Air; pawn->SetCanBeDamaged(true); }
                if(!Equip(controller,pawn)) { Fail("Bot rifle could not be restored after leaving the bus."); continue; }
            }
            if(bot.stage==Stage::Bus) { bot.stage=Stage::Air; pawn->SetCanBeDamaged(true); }
            if(bot.stage==Stage::Air && InfinityShowdown::OnGround(pawn)) { bot.stage=Stage::Ground; bot.pathAt=0; bot.planAt=0; }
            if(bot.stage==Stage::Warmup && phase>=EAthenaGamePhase::SafeZones) { bot.stage=InfinityShowdown::OnGround(pawn) ? Stage::Ground : Stage::Air; pawn->SetCanBeDamaged(true); }
            if(bot.stage==Stage::Ground) candidates.push_back({pawn,state->GetTeamIndex()});
        }
        int alive=0,moving=0,shooting=0;
        for(auto& bot:Active) {
            if(bot.stage==Stage::Dead) continue;
            ++alive;
            auto controller=Cast<AFortPlayerControllerAthena>(bot.controller.Get()); auto pawn=Cast<AFortPlayerPawn>(bot.pawn.Get());
            if(!controller || !Living(pawn) || bot.stage==Stage::Bus || !bot.ready) continue;
            if(Faulted || phase>=EAthenaGamePhase::EndGame) {
                if(bot.burst.firing) Fire(controller,pawn,false); bot.burst={}; bot.input={}; continue;
            }
            if(bot.burst.firing && (now>=bot.burst.stopAt || !Living(Cast<AFortPlayerPawn>(bot.target.Get())))) {
                Fire(controller,pawn,false); bot.burst.Tick(false,now);
            }
            if(BotLobbyRules::ShouldPlan(now,bot.planAt)) Plan(bot,controller,pawn,mode,candidates,now);
            if(bot.stopJumpAt>0 && now>=bot.stopJumpAt) { Call stop(pawn,"StopJumping"); stop.Run(); bot.stopJumpAt=0; }
            // Input is consumed each engine frame. Only expensive planning is throttled.
            Call move(pawn,"AddMovementInput"); move.Set("WorldDirection",bot.input); move.Set("ScaleValue",1.f); move.Set("bForce",true);
            if(!move.Run()) { Fail("Bot movement input function is unavailable."); break; }
            if(now>=bot.sampleAt) {
                const auto position=pawn->GetActorLocation(); const float delta=FlatDistance(position,bot.lastLocation);
                if(delta>40) { if(bot.stage!=Stage::Air) bot.moved=true; bot.stalls=0; } else if(bot.input.X!=0 || bot.input.Y!=0) ++bot.stalls;
                bot.lastLocation=position; bot.sampleAt=now+1;
            }
            if(auto weapon=pawn->GetCurrentWeapon()) {
                const int ammo=weapon->GetAmmoCount(); if(bot.lastAmmo>=0 && ammo<bot.lastAmmo) bot.fired=true; bot.lastAmmo=ammo;
            }
            moving+=bot.moved; shooting+=bot.fired;
        }
        Alive.store(alive); Moving.store(moving); Shooting.store(shooting);
        if(!Faulted && now>=NextStatus) {
            NextStatus=now+2;
            const std::string status=warmup ? (!LocationsLoaded ? "Waiting for island spawn/landing locations." : "Warmup bots: "+std::to_string(Active.size())+" / "+std::to_string(desired)+". Start Bus when ready.") :
                "Bots: "+std::to_string(alive)+" alive; observed moving "+std::to_string(moving)+", fired "+std::to_string(shooting)+". Eliminations are permanent.";
            Report(status); LOG_INFO(LogDev,"Bot lobby: {}",status);
        }
    }
}

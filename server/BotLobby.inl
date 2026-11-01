// Included after LocalTools.inl and InfinityShowdown.inl in NetDriver.cpp.
// All actor creation, movement and combat calls execute on the game thread.
#include "BotLobby.h"
#include "BotLobbyRules.h"
#include "bots.h"
#include <random>
namespace BotLobby {
    using Ref = LocalTools::TrackedObject;
    struct Bot { Ref controller, pawn; BotLobbyRules::Burst burst; double jumpAt = 0; };
    static std::vector<Bot> Active;
    static Ref World, Driver;
    static int Spawned = 0, Failures = 0, RequestedForRound = -1;
    static double NextTick = 0, NextSpawn = 0;
    static bool Faulted = false;
    static std::mt19937 Random(std::random_device{}());
    // Reflected parameter layouts are checked before touching the parameter buffer.
    struct Call {
        UObject* object; UFunction* fn; std::vector<uint8_t> bytes; bool valid;
        Call(UObject* target, const char* name) : object(target), fn(target ? target->FindFunction(name) : nullptr), valid(fn != nullptr) {
            if (fn) bytes.resize(fn->GetPropertiesSize(), 0);
        }
        template<class T> void Set(const char* name, const T& value) {
            int offset = fn ? fn->GetOffsetFunc(name) : -1;
            if (offset < 0 || size_t(offset) + sizeof(T) > bytes.size()) { valid = false; return; }
            memcpy(bytes.data() + offset, &value, sizeof(T));
        }
        bool Run() { if (!valid) return false; object->ProcessEvent(fn, bytes.data()); return true; }
        bool Result() { int offset = fn ? fn->GetOffsetFunc("ReturnValue") : -1; return valid && offset >= 0 && size_t(offset) < bytes.size() && bytes[offset]; }
    };
    static bool Living(AFortPlayerPawn* pawn) { return pawn && !pawn->IsActorBeingDestroyed() && pawn->GetHealth() > 0 && !pawn->IsDBNO(); }
    static bool Fire(AFortPlayerPawn* pawn, bool on) {
        Call call(pawn, on ? "PawnStartFire" : "PawnStopFire"); call.Set<uint8_t>("FireModeNum", 0); return call.Run();
    }
    static bool Visible(AFortPlayerControllerAthena* controller, AFortPlayerPawn* target) {
        auto pawn = controller->GetMyFortPawn(); if (!pawn) return false;
        FVector eye = pawn->GetActorLocation(); eye.Z += 65;
        Call call(controller, "LineOfSightTo"); call.Set<AActor*>("Other", target);
        call.Set("ViewPoint", eye); call.Set("bAlternateChecks", false);
        return call.Run() && call.Result();
    }
    static bool Spawn(AFortGameModeAthena* mode, AFortGameStateAthena* game, FVector location) {
        auto controllerClass = AFortPlayerControllerAthena::StaticClass();
        auto pawnClass = FindObject<UClass>(L"/Game/Athena/PlayerPawn_Athena.PlayerPawn_Athena_C");
        auto rifle = FindObject<UFortWeaponItemDefinition>(L"/Game/Athena/Items/Weapons/WID_Assault_Auto_Athena_R_Ore_T03.WID_Assault_Auto_Athena_R_Ore_T03");
        auto ammo = FindObject<UFortItemDefinition>(L"/Game/Athena/Items/Ammo/AmmoDataBulletsMedium.AmmoDataBulletsMedium");
        if (!controllerClass || !pawnClass || !rifle || !ammo) return false;
        auto controller = GetWorld()->SpawnActor<AFortPlayerControllerAthena>(controllerClass);
        if (!controller) return false;
        Ref controllerRef(controller);
        auto state = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        if (!state) { controller->K2_DestroyActor(); return false; }
        FTransform transform{}; transform.Translation = location; transform.Rotation = FRotator{0,0,0}.Quaternion(); transform.Scale3D = FVector(1,1,1);
        auto pawn = GetWorld()->SpawnActor<AFortPlayerPawnAthena>(pawnClass, transform, CreateSpawnParameters(ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn));
        if (!pawn) { controller->K2_DestroyActor(); return false; }
        Ref pawnRef(pawn);
        auto abort = [&]() {
            if (auto current = Cast<AFortPlayerControllerAthena>(controllerRef.Get())) {
                if (auto inventory = current->GetWorldInventory()) inventory->K2_DestroyActor();
                current->K2_DestroyActor();
            }
            if (auto current = Cast<AActor>(pawnRef.Get())) current->K2_DestroyActor();
            return false;
        };
        // Do not count a partially initialized bot as a live match participant.
        for (auto name : {"PawnStartFire", "PawnStopFire", "AddMovementInput"}) if (!pawn->FindFunction(name)) return abort();
        if (!controller->FindFunction("LineOfSightTo") || !controller->FindFunction("SetControlRotation")) return abort();
        state->SetIsBot(true); controller->Possess(pawn); pawn->SetOwner(controller);
        state->GetTeamIndex() = 50 + Spawned; // Enemies of normal Solo/Squad human teams.
        if (state->GetOffset("SquadId", false) >= 0) state->GetSquadId() = state->GetTeamIndex() - NumToSubtractFromSquadId;
        std::wstring name = L"NovaBot_" + std::to_wstring(Spawned + 1);
        controller->ServerChangeName(name.c_str()); state->OnRep_PlayerName();
        PlayerBot setup; setup.Controller = controller; setup.Pawn = pawn; setup.PlayerState = state;
        setup.SetupInventory();
        if (!controllerRef.Get() || !pawnRef.Get()) return abort();
        auto inventory = controller->GetWorldInventory(); if (!inventory) return abort();
        auto abilities = GetPlayerAbilitySet(); auto asc = state->GetAbilitySystemComponent();
        if (!abilities || !asc) return abort();
        abilities->GiveToAbilitySystem(asc);
        setup.PickRandomLoadout(); setup.ApplyCosmeticLoadout();
        inventory->AddItem(rifle, nullptr, 1, rifle->GetClipSize()); inventory->AddItem(ammo, nullptr, 999); inventory->Update();
        auto item = inventory->FindItemInstance(rifle); if (!item) return abort();
        AFortPlayerController::ServerExecuteInventoryItemHook(controller, item->GetItemEntry()->GetItemGuid());
        if (!pawn->GetCurrentWeapon() || pawn->GetCurrentWeapon()->GetWeaponData() != rifle) return abort();
        pawn->SetMaxHealth(100); pawn->SetHealth(100); pawn->SetCanBeDamaged(true);
        game->AddPlayerStateToGameMemberInfo(state);
        mode->GetAlivePlayers().Add(controller); ++game->GetPlayersLeft(); game->OnRep_PlayersLeft();
        pawn->ForceNetUpdate(); state->ForceNetUpdate();
        Active.push_back({controllerRef, pawnRef}); ++Spawned; return true;
    }
    void Tick(UNetDriver* driver) {
        if (!driver || !Globals::bStartedListening) return;
        auto world = GetWorld(); if (!world) return;
        if (World.Get() != world || Driver.Get() != driver) {
            World = Ref(world); Driver = Ref(driver); Active.clear(); Spawned = Failures = 0;
            RequestedForRound = -1; NextTick = NextSpawn = 0; Faulted = false; Alive.store(0);
        }
        auto game = Cast<AFortGameStateAthena>(world->GetGameState()); auto mode = Cast<AFortGameModeAthena>(world->GetGameMode());
        if (!game || !mode) return;
        if (RequestedForRound < 0) RequestedForRound = BotLobbyRules::Count(Requested.load(), InfinityShowdown::Enabled.load());
        if (!RequestedForRound || InfinityShowdown::Enabled.load()) return;
        double now = game->GetServerWorldTimeSeconds(); if (now < NextTick) return; NextTick = now + .1;
        std::vector<AFortPlayerPawn*> humans;
        const bool playing = game->GetGamePhase() == EAthenaGamePhase::SafeZones;
        auto& connections = driver->GetClientConnections();
        if (playing && !Faulted) for (int i = 0; i < connections.Num(); ++i) {
            auto connection = connections.at(i); if (!connection) continue;
            auto controller = Cast<AFortPlayerControllerAthena>(connection->GetPlayerController());
            auto pawn = controller ? controller->GetMyFortPawn() : nullptr;
            auto state = controller ? Cast<AFortPlayerStateAthena>(controller->GetPlayerState()) : nullptr;
            if (Living(pawn) && state && !state->IsInAircraft() && InfinityShowdown::OnGround(pawn)) humans.push_back(pawn);
        }
        if (playing && !Faulted && Spawned < RequestedForRound && !humans.empty() && now >= NextSpawn) {
            NextSpawn = now + 1;
            auto location = humans[Spawned % humans.size()]->GetActorLocation();
            float angle = std::uniform_real_distribution<float>(0,6.2831853f)(Random);
            location.X += std::cos(angle)*3500; location.Y += std::sin(angle)*3500;
            if (!InfinityShowdown::GroundAt(location) || !Spawn(mode,game,location)) {
                if (++Failures >= 5) { Faulted = true; Report("Bot setup failed. Stop this test session; see server diagnostics."); }
            }
        }
        int alive = 0;
        for (auto& bot : Active) {
            auto controller = Cast<AFortPlayerControllerAthena>(bot.controller.Get());
            auto pawn = Cast<AFortPlayerPawn>(bot.pawn.Get());
            if (!controller || !Living(pawn)) { if (pawn && bot.burst.firing) Fire(pawn,false); bot.burst.firing = false; continue; }
            ++alive;
            AFortPlayerPawn* target = nullptr; float distance = 15000;
            auto from = pawn->GetActorLocation();
            for (auto human : humans) {
                auto to = human->GetActorLocation(); float dx=to.X-from.X, dy=to.Y-from.Y, dz=to.Z-from.Z;
                float length = std::sqrt(dx*dx+dy*dy+dz*dz);
                if (length < distance) { distance=length; target=human; }
            }
            bool visible = target && Visible(controller,target);
            auto action = bot.burst.Tick(BotLobbyRules::CanFight(playing && !Faulted, target != nullptr, visible, distance),now);
            if (action == BotLobbyRules::Burst::Stop) Fire(pawn,false);
            if (!target) continue;
            auto to = target->GetActorLocation(); float dx=to.X-from.X, dy=to.Y-from.Y, dz=to.Z-from.Z;
            float flat = std::sqrt(dx*dx+dy*dy); if (flat < 1) continue;
            FRotator rotation{float(std::atan2(dz,flat)*57.29578),float(std::atan2(dy,dx)*57.29578),0};
            rotation.Yaw += std::uniform_real_distribution<float>(-5,5)(Random);
            Call aim(controller,"SetControlRotation"); aim.Set("NewRotation",rotation); if (!aim.Run()) { Faulted=true; Report("Bot aim function is unavailable."); }
            if (action == BotLobbyRules::Burst::Start) {
                if (auto weapon = pawn->GetCurrentWeapon()) if (weapon->GetAmmoCount() <= 0) weapon->GetAmmoCount() = 30;
                if (!Fire(pawn,true)) { Faulted=true; Report("Bot firing function is unavailable."); }
            }
            FVector direction = distance > 1800 ? FVector(dx/flat,dy/flat,0) : FVector(-dy/flat,dx/flat,0);
            Call move(pawn,"AddMovementInput"); move.Set("WorldDirection",direction); move.Set("ScaleValue",.8f); move.Set("bForce",false);
            if (!move.Run()) { Faulted=true; Report("Bot movement function is unavailable."); }
            if (!visible && now >= bot.jumpAt) { Call jump(pawn,"Jump"); jump.Run(); bot.jumpAt=now+4; }
        }
        Alive.store(alive);
        if (!Faulted) Report(!playing ? "Waiting for the main island." : Spawned < RequestedForRound ? "Land on the island to deploy bots." : "Combat bots deployed. Eliminated bots do not respawn.");
    }
}

// Included after LocalTools.inl in NetDriver.cpp. All mutations run on the game thread.
#include "InfinityShowdown.h"
#include "InfinityRules.h"
#include <unordered_map>
#include <random>
#include <cmath>

namespace InfinityShowdown {
    using Ref = LocalTools::TrackedObject;
    struct SavedItem { Ref definition; int count = 0, ammo = -1; std::string path; };
    struct Player {
        Ref controller, protectedPawn;
        InfinityRules::Lives lives;
        std::vector<SavedItem> equipment;
        bool connected = false, kit = false, transformed = false, restore = false;
        double respawnAt = 0, protectionUntil = 0;
        FVector location;
    };
    static std::unordered_map<std::string, Player> Players;
    static Ref World, Driver;
    static std::string Thanos, PreviousThanos;
    static std::mt19937 Random(std::random_device{}());
    static bool AssignmentSucceeded = false, Faulted = false;
    static double NextTick = 0, NextSelection = 0;
    static AFortPlayerController* Assigning = nullptr;
    static UFortItemDefinition* AssigningDefinition = nullptr;

    static std::string Identity(AFortPlayerController* controller) {
        auto state = controller ? controller->GetPlayerState() : nullptr;
        return state ? state->GetPlayerName().ToString() : "";
    }
    static void Tell(AFortPlayerController* controller, const std::string& text) {
        auto fn = controller ? controller->FindFunction("ClientMessage") : nullptr;
        if (!fn) return;
        auto wide = std::wstring(text.begin(), text.end());
        struct { FString message; FName type; float time; } params{ wide.c_str(), FName(), 8.f };
        controller->ProcessEvent(fn, &params);
    }
    static void Broadcast(const std::string& text) {
        Report(text);
        for (auto& pair : Players) if (pair.second.connected) Tell(Cast<AFortPlayerController>(pair.second.controller.Get()), text);
    }
    static UFortItemDefinition* Gauntlet() {
        auto item = FindObject<UFortItemDefinition>("AGID_CarminePack", nullptr, ANY_PACKAGE);
        return item ? item : LoadObject<UFortItemDefinition>(L"/Game/Athena/Items/Gameplay/BackPacks/CarminePack/AGID_CarminePack.AGID_CarminePack");
    }
    void GadgetApplied(AFortPlayerController* controller, UFortItemDefinition* definition, bool success) {
        if (Enabled.load() && controller == Assigning && definition == AssigningDefinition) AssignmentSucceeded = success;
    }
    static std::vector<SavedItem> SaveEquipment(AFortInventory* inventory) {
        std::vector<SavedItem> saved;
        auto& items = inventory->GetItemList().GetItemInstances();
        for (int i = 0; i < items.Num(); ++i) {
            auto instance = items.at(i); if (!instance) continue;
            auto entry = instance->GetItemEntry(); auto def = entry->GetItemDefinition();
            if (def && def != Gauntlet()) saved.push_back({ Ref(def), entry->GetCount(), entry->GetLoadedAmmo(), def->GetPathName() });
        }
        return saved;
    }
    static void RemoveInventory(AFortInventory* inventory) {
        std::vector<std::pair<FGuid,int>> remove;
        auto& items = inventory->GetItemList().GetItemInstances();
        for (int i = 0; i < items.Num(); ++i) if (auto item = items.at(i))
            remove.push_back({item->GetItemEntry()->GetItemGuid(), item->GetItemEntry()->GetCount()});
        for (const auto& item : remove) inventory->RemoveItem(item.first, nullptr, item.second, true);
        inventory->Update();
    }
    static bool RestoreEquipment(AFortPlayerControllerAthena* controller, Player& player) {
        if (!player.restore) return true;
        auto inventory = controller ? controller->GetWorldInventory() : nullptr; if (!inventory) return false;
        std::vector<UFortItemDefinition*> definitions;
        for (const auto& item : player.equipment) {
            auto def = Cast<UFortItemDefinition>(item.definition.Get());
            if (!def) { auto name = std::wstring(item.path.begin(),item.path.end()); def = LoadObject<UFortItemDefinition>(name.c_str()); }
            if (!def) { Report("Waiting for an equipment asset to reload. The saved inventory is retained."); return false; }
            definitions.push_back(def);
        }
        RemoveInventory(inventory);
        for (size_t i = 0; i < player.equipment.size(); ++i) {
            const auto& item = player.equipment[i];
            inventory->AddItem(definitions[i], nullptr, item.count, item.ammo);
            if (!inventory->FindItemInstance(definitions[i])) return false;
        }
        inventory->Update(); player.restore = false; player.transformed = false;
        player.equipment.clear(); return true;
    }
    static bool AddKit(AFortPlayerControllerAthena* controller) {
        auto inventory = controller->GetWorldInventory(); if (!inventory) return false;
        auto rifle = FindObject<UFortWeaponItemDefinition>("WID_Assault_AutoHigh_Athena_SR_Ore_T03", nullptr, ANY_PACKAGE);
        auto pump = FindObject<UFortWeaponItemDefinition>("WID_Shotgun_Standard_Athena_R_Ore_T03", nullptr, ANY_PACKAGE);
        if (!pump) pump = FindObject<UFortWeaponItemDefinition>("WID_Shotgun_Standard_Athena_C_Ore_T03", nullptr, ANY_PACKAGE);
        if (!rifle || !pump) return false;
        if (!inventory->FindItemInstance(rifle)) inventory->AddItem(rifle, nullptr, 1, rifle->GetClipSize());
        if (!inventory->FindItemInstance(pump)) inventory->AddItem(pump, nullptr, 1, pump->GetClipSize());
        const char* supplies[] = {"WoodItemData","StoneItemData","MetalItemData","AthenaAmmoDataBulletsLight","AthenaAmmoDataBulletsMedium","AthenaAmmoDataBulletsHeavy","AthenaAmmoDataShells","AmmoDataRockets"};
        for (auto name : supplies) if (auto def = FindObject<UFortItemDefinition>(name, nullptr, ANY_PACKAGE)) {
            auto item = inventory->FindItemInstance(def);
            if (!item) { inventory->AddItem(def, nullptr, 1); item = inventory->FindItemInstance(def); }
            if (item) inventory->ModifyCount(item, 999, false, nullptr, false);
        }
        const char* healing[] = {"Athena_ShieldSmall", "Athena_Medkit"};
        for (auto name : healing) if (auto def = FindObject<UFortItemDefinition>(name, nullptr, ANY_PACKAGE))
            if (!inventory->FindItemInstance(def)) inventory->AddItem(def, nullptr, name == healing[0] ? 6 : 3);
        inventory->Update(); return true;
    }
    static FVector ArenaCenter(AFortGameModeAthena* mode, const FVector& fallback) {
        const int offset = mode->GetOffset("SafeZoneLocations", false);
        if (offset != -1) { const auto& locations = mode->Get<TArray<FVector>>(offset); if (locations.Num() > 3) return locations.at(3); }
        return fallback;
    }
    static bool GroundAt(FVector& location) {
        auto fn = FindObject<UFunction>(L"/Script/Engine.KismetSystemLibrary.LineTraceSingle");
        auto library = FindObject<UObject>(L"/Script/Engine.Default__KismetSystemLibrary");
        if (!fn || !library) return false;
        const int context = fn->GetOffsetFunc("WorldContextObject"), start = fn->GetOffsetFunc("Start"), end = fn->GetOffsetFunc("End"),
            trace = fn->GetOffsetFunc("TraceChannel"), hit = fn->GetOffsetFunc("OutHit"), result = fn->GetOffsetFunc("ReturnValue");
        const int impact = FindOffsetStruct("/Script/Engine.HitResult", "ImpactPoint");
        if (context < 0 || start < 0 || end < 0 || trace < 0 || hit < 0 || result < 0 || impact < 0) return false;
        std::vector<uint8_t> params(fn->GetPropertiesSize(),0);
        if (hit + impact + sizeof(FVector) > params.size()) return false;
        auto from = location, to = location; from.Z = 100000; to.Z = -100000;
        *reinterpret_cast<UObject**>(params.data()+context) = GetWorld();
        *reinterpret_cast<FVector*>(params.data()+start) = from; *reinterpret_cast<FVector*>(params.data()+end) = to;
        params[trace] = 0;
        library->ProcessEvent(fn,params.data());
        if (!params[result]) return false;
        location = *reinterpret_cast<FVector*>(params.data()+hit+impact); location.Z += 150; return true;
    }
    static bool Respawn(AFortPlayerControllerAthena* controller, Player& player, double now) {
        auto mode = Cast<AFortGameModeAthena>(GetWorld()->GetGameMode());
        auto state = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        auto spawn = FindObject<UFunction>(L"/Script/Engine.GameModeBase.SpawnDefaultPawnAtTransform");
        if (!mode || !state || !spawn || !controller->GetWorldInventory()) return false;
        auto old = Ref(controller->GetMyFortPawn());
        // Remove Thanos abilities before spawning a normal pawn; never drop the gauntlet.
        if (!RestoreEquipment(controller, player)) return false;
        auto location = ArenaCenter(mode, player.location);
        std::uniform_real_distribution<float> angle(0.f, 6.2831853f);
        float direction = angle(Random); location.X += std::cos(direction)*1200; location.Y += std::sin(direction)*1200;
        if (!GroundAt(location)) return false;
        FTransform transform{}; transform.Translation = location; transform.Rotation = controller->GetControlRotation().Quaternion(); transform.Scale3D = FVector(1,1,1);
        struct { AController* controller; FTransform transform; APawn* result; } params{controller,transform,nullptr};
        mode->ProcessEvent(spawn, &params);
        auto pawn = Cast<AFortPlayerPawn>(params.result); if (!pawn) return false;
        state->EndDBNOAbilities(); state->ClearDeathInfo(); pawn->SetOwner(controller); controller->Possess(pawn);
        pawn->SetMaxHealth(100); pawn->SetHealth(100); pawn->SetMaxShield(100); LocalTools::RestoreShield(pawn);
        controller->SetPlayerIsWaiting(false); controller->ClientClearDeathNotification(); controller->RespawnPlayerAfterDeath(false);
        if (auto restart = controller->FindFunction("ClientRestart")) controller->ProcessEvent(restart, &pawn);
        pawn->SetCanBeDamaged(false); player.protectedPawn = Ref(pawn); player.protectionUntil = now + 3;
        pawn->ForceNetUpdate();
        if (auto previous = Cast<AActor>(old.Get())) if (previous != pawn && !previous->IsActorBeingDestroyed()) previous->K2_DestroyActor();
        player.lives.Spawned();
        Tell(controller, "Infinity Showdown: " + std::to_string(player.lives.remaining) + " respawns remaining."); return true;
    }
    bool OnDeath(AFortPlayerController* controller) {
        if (!Enabled.load() || Faulted) return false;
        auto game = Cast<AFortGameStateAthena>(GetWorld()->GetGameState());
        if (!game || game->GetGamePhase() < EAthenaGamePhase::Aircraft || game->GetGamePhase() == EAthenaGamePhase::EndGame) return false;
        auto pawn = controller->GetMyFortPawn();
        if (!pawn || !pawn->IsValidLowLevel() || pawn->IsDBNO()) return false;
        auto found = Players.find(Identity(controller)); if (found == Players.end()) return false;
        auto& player = found->second; const Ref life(pawn);
        auto result = player.lives.Die((uint64_t(uint32_t(life.serial)) << 32) | uint32_t(life.index));
        if (result == InfinityRules::Lives::Duplicate) return true;
        player.location = pawn->GetActorLocation();
        if (Thanos == found->first) { PreviousThanos = Thanos; Thanos.clear(); player.restore = true; }
        if (result == InfinityRules::Lives::Eliminate) {
            // Remove the gadget before native final elimination; inventory dropping is disabled for this mode.
            RestoreEquipment(Cast<AFortPlayerControllerAthena>(controller), player);
            Tell(controller, "Infinity Showdown: no respawns remaining. You are eliminated."); return false;
        }
        player.respawnAt = game->GetServerWorldTimeSeconds() + 3;
        pawn->SetCanBeDamaged(false);
        Tell(controller, "Respawning in 3 seconds. Your equipment is kept."); return true;
    }
    void Tick(UNetDriver* driver) {
        if (!Enabled.load() || !driver || !Globals::bStartedListening) return;
        auto world = GetWorld();
        if (World.Get() != world || Driver.Get() != driver) {
            World = Ref(world); Driver = Ref(driver); Players.clear(); Thanos.clear(); PreviousThanos.clear(); Faulted = false; NextTick = NextSelection = 0;
        }
        auto game = Cast<AFortGameStateAthena>(world->GetGameState());
        if (!game) return;
        double now = game->GetServerWorldTimeSeconds(); if (now < NextTick) return; NextTick = now + .1;
        if (game->GetGamePhase() == EAthenaGamePhase::EndGame || Faulted) return;
        for (auto& pair : Players) pair.second.connected = false;
        auto& connections = driver->GetClientConnections();
        for (int i = 0; i < connections.Num(); ++i) {
            auto connection = connections.at(i); if (!connection) continue;
            auto controller = Cast<AFortPlayerControllerAthena>(connection->GetPlayerController()); if (!controller) continue;
            auto key = Identity(controller); if (key.empty()) continue;
            auto& player = Players[key]; player.controller = Ref(controller); player.connected = true;
        }
        std::vector<std::string> eligible;
        for (auto& pair : Players) {
            auto& player = pair.second; auto controller = Cast<AFortPlayerControllerAthena>(player.controller.Get());
            if (!player.connected || !controller) {
                if (game->GetGamePhase() >= EAthenaGamePhase::Aircraft) player.lives.Disconnect();
                if (Thanos == pair.first) { PreviousThanos = Thanos; Thanos.clear(); }
                continue;
            }
            if (player.lives.eliminated) {
                controller->SetPlayerIsWaiting(true);
                auto pawn = controller->GetMyFortPawn();
                if (pawn && pawn->IsValidLowLevel() && !pawn->IsActorBeingDestroyed() && pawn->GetHealth() > 0) pawn->K2_DestroyActor();
                continue;
            }
            if (auto protectedPawn = Cast<AActor>(player.protectedPawn.Get())) if (now >= player.protectionUntil) { protectedPawn->SetCanBeDamaged(true); player.protectedPawn = {}; }
            if (player.lives.pending) {
                if (now >= player.respawnAt && !Respawn(controller,player,now)) { player.respawnAt = now + 1; Report("Respawn delayed: waiting for a valid pawn. No extra life is consumed."); }
                continue;
            }
            auto pawn = controller->GetMyFortPawn(); auto state = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
            if (!pawn || !pawn->IsValidLowLevel() || pawn->IsActorBeingDestroyed() || pawn->GetHealth() <= 0 || pawn->IsDBNO() || !state || state->IsInAircraft()) continue;
            if (game->GetGamePhase() < EAthenaGamePhase::SafeZones) continue;
            if (!player.kit) {
                if (!AddKit(controller)) { Faulted = true; Broadcast("Infinity Showdown could not find the starter weapons. Stop this session and use Classic."); return; }
                player.kit = true; LocalTools::RestoreHealth(pawn);
                Tell(controller,"Infinity Showdown: 10 respawns, retained loot, random Thanos. Check F8 for status messages.");
            }
            eligible.push_back(pair.first);
        }
        if (!Thanos.empty() || eligible.empty() || now < NextSelection) return;
        NextSelection = now + 2;
        auto selected = InfinityRules::Choose(eligible, PreviousThanos, Random); if (selected.empty()) return;
        auto& player = Players.at(selected); auto controller = Cast<AFortPlayerControllerAthena>(player.controller.Get());
        auto inventory = controller ? controller->GetWorldInventory() : nullptr; auto gauntlet = Gauntlet();
        if (!inventory || !gauntlet || !Addresses::ApplyGadgetData || !Addresses::RemoveGadgetData || !Globals::bEnableAGIDs) {
            Faulted = true; Broadcast("Infinity Showdown: this build cannot apply the Thanos gadget. Stop and select Classic."); return;
        }
        player.equipment = SaveEquipment(inventory); player.restore = true;
        RemoveInventory(inventory);
        Assigning = controller; AssigningDefinition = gauntlet; AssignmentSucceeded = false;
        inventory->AddItem(gauntlet,nullptr,1); inventory->Update(); Assigning = nullptr; AssigningDefinition = nullptr;
        if (!AssignmentSucceeded || !inventory->FindItemInstance(gauntlet)) {
            RestoreEquipment(controller,player); Faulted = true;
            Broadcast("Infinity Showdown: Thanos transformation failed. Equipment restored; restart with Classic."); return;
        }
        player.transformed = true; Thanos = selected;
        Broadcast("Infinity Showdown: " + selected + " is Thanos! Each player has up to 10 respawns.");
    }
}

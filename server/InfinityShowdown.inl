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
        InfinityRules::Landing landing;
        std::vector<SavedItem> equipment;
        bool connected = false, kit = false, transformed = false, restore = false;
        double respawnAt = 0, protectionUntil = 0;
        FVector location;
    };
    static std::unordered_map<std::string, Player> Players;
    static Ref World, Driver;
    static Ref ZoneWorld, HeldZone;
    static bool ZoneStarted = false, BusStarted = false, BusConfigured = false, BusExited = false;
    static double BusStartedAt = 0;
    static std::vector<Ref> Buses;
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
        // Unequipping this gadget can add a pickaxe. Remove it before taking the
        // snapshot below so that the automatically added item is cleared too.
        if (auto gadget = inventory->FindItemInstance(Gauntlet())) {
            auto entry = gadget->GetItemEntry();
            const auto guid = entry->GetItemGuid(); const int count = entry->GetCount();
            inventory->RemoveItem(guid, nullptr, count, true);
        }
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
    // Fortnite 4.2 exposes these fields through reflection. Missing fields are
    // ignored rather than interpreting a missing offset as an address.
    template<class T> static bool Put(UObject* object, const char* name, const T& value) {
        if (!object) return false;
        const int offset = object->GetOffset(name, false); if (offset < 0) return false;
        object->Get<T>(offset) = value; return true;
    }
    void ConfigurePlaylist(UObject* playlist) {
        // Clients load HUD extensions from their local playlist asset. Mutating
        // Solo's UIExtensions only on the host cannot give clients the Carmine HUD.
        // Replicate the real Carmine asset, retaining Solo gameplay on the server.
        auto solo = LoadObject<UObject>(L"/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo", FindObject<UClass>(L"/Script/FortniteGame.FortPlaylistAthena"));
        if (!playlist || !solo || playlist == solo) { Report("Infinity Showdown: Carmine HUD playlist is unavailable."); return; }
        for (auto name : {"GameData", "LootTierData", "LootPackages", "ResourceRates", "RangedWeapons"}) {
            const int target = playlist->GetOffset(name,false), source = solo->GetOffset(name,false);
            if (target >= 0 && source >= 0) playlist->Get<TSoftObjectPtr<UObject>>(target) = solo->Get<TSoftObjectPtr<UObject>>(source);
        }
        const int mission = solo->GetOffset("PlaylistMissionGen", false);
        if (mission >= 0) Put(playlist, "PlaylistMissionGen", solo->Get<UObject*>(mission));
        Put(playlist, "MaxSquadSize", 1); Put(playlist, "bUseDefaultSupplyDrops", false);
        for (auto name : {"SupplyDropInfoList", "SupplyDropModifierList"}) {
            const int offset = playlist->GetOffset(name,false);
            if (offset >= 0) playlist->Get<TArray<uint8_t>>(offset).ArrayNum = 0;
        }
        LOG_INFO(LogDev, "Infinity Showdown: Carmine HUD enabled; automatic supply drops disabled.");
    }
    bool BeginZone(AFortGameModeAthena* mode) {
        if (ZoneWorld.Get() != GetWorld()) { ZoneWorld = Ref(GetWorld()); ZoneStarted = false; HeldZone = {}; }
        if (ZoneStarted) return false;
        ZoneStarted = true;
        Put(mode, "SafeZonePhase", 3);
        Put(mode->GetGameState(), "SafeZonePhase", uint8_t(3));
        return true;
    }
    void HoldZone(AFortGameModeAthena* mode) {
        if (!ZoneStarted || !mode) return;
        auto zone = mode->GetSafeZoneIndicator(); if (!zone || HeldZone.Get() == zone) return;
        auto game = Cast<AFortGameStateAthena>(mode->GetGameState()); if (!game) return;
        const auto center = ArenaCenter(mode, zone->GetActorLocation());
        const int radiusOffset = zone->GetOffset("NextRadius",false);
        const float radius = InfinityRules::LargerArena(radiusOffset >= 0 ? zone->Get<float>(radiusOffset) : 0.f);
        for (auto name : {"LastCenter", "NextCenter", "NextNextCenter"}) Put(zone, name, center);
        for (auto name : {"LastRadius", "NextRadius", "NextNextRadius", "Radius"}) Put(zone, name, radius);
        // Freeze one holding phase. Never repeatedly restart a 0.2-second shrink.
        const float end = game->GetServerWorldTimeSeconds() + 86400.f;
        Put(zone, "SafeZoneStartShrinkTime", end); Put(zone, "SafeZoneFinishShrinkTime", end);
        // The indicator must keep ticking on clients to update the storm mesh
        // and minimap. Pause progression on the game mode, not its rendering.
        Put(zone, "bPaused", false); Put(mode, "bSafeZonePaused", true);
        Put(mode, "TimeRemainingWhenPhasePaused", 86400.f);
        if (auto fn = zone->FindFunction("SetSafeZoneRadiusAndCenter")) {
            struct { float radius; FVector center; } params{radius, center};
            zone->ProcessEvent(fn, &params);
        }
        zone->ForceNetUpdate(); game->ForceNetUpdate(); HeldZone = Ref(zone);
        LOG_INFO(LogDev, "Infinity Showdown: fixed arena radius {} cm", radius);
    }
    static void TickBus(AFortGameModeAthena* mode, AFortGameStateAthena* game, double now) {
        if (BusRequested.exchange(false) && !BusStarted && game->GetGamePhase() < EAthenaGamePhase::Aircraft) {
            BusStarted = true; mode->StartAircraftPhase();
        }
        // Also cover a bus started by the native countdown.
        if (!BusConfigured && game->GetGamePhase() == EAthenaGamePhase::Aircraft) {
            const int offset = game->GetOffset("Aircrafts", false); if (offset < 0) return;
            auto& aircrafts = game->Get<TArray<AActor*>>(offset); if (!aircrafts.Num()) return;
            auto start = ArenaCenter(mode, FVector()); start.X -= 13500; start.Z += 10000;
            const int flightOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "FlightStartLocation");
            const int rotationOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "FlightStartRotation");
            const int speedOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "FlightSpeed");
            const int endOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "TimeTillFlightEnd");
            const int dropOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "TimeTillDropStart");
            const int dropEndOffset = FindOffsetStruct("/Script/FortniteGame.AircraftFlightInfo", "TimeTillDropEnd");
            if (flightOffset < 0 || rotationOffset < 0 || speedOffset < 0 || endOffset < 0 || dropOffset < 0 || dropEndOffset < 0) {
                Faulted = true; Report("Infinity Showdown: unsupported aircraft fields. Restart with Classic."); return;
            }
            for (int i = 0; i < aircrafts.Num(); ++i) {
                auto bus = aircrafts.at(i); if (!bus || bus->IsActorBeingDestroyed()) continue;
                const int info = bus->GetOffset("FlightInfo", false); if (info < 0) continue;
                bus->Get<FVector>(info + flightOffset) = start;
                bus->Get<FRotator>(info + rotationOffset) = FRotator();
                bus->Get<float>(info + speedOffset) = InfinityRules::BusSpeed;
                bus->Get<float>(info + endOffset) = InfinityRules::BusFlightEnd;
                bus->Get<float>(info + dropOffset) = InfinityRules::BusDropStart;
                bus->Get<float>(info + dropEndOffset) = InfinityRules::BusDropEnd;
                Put(bus,"FlightStartTime",float(now)); Put(bus,"FlightEndTime",float(now)+InfinityRules::BusFlightEnd);
                Put(bus,"DropStartTime",float(now)+InfinityRules::BusDropStart); Put(bus,"DropEndTime",float(now)+InfinityRules::BusDropEnd);
                Put(bus,"FlightElapsedTime",0.f);
                bus->TeleportTo(start, FRotator()); bus->ForceNetUpdate(); Buses.emplace_back(bus);
            }
            if (Buses.empty()) return;
            BusConfigured = BusStarted = true; BusStartedAt = now;
            Put(game,"AircraftStartTime",float(now)); Put(game,"SafeZonesStartTime",float(now)+InfinityRules::BusDropEnd);
            game->ForceNetUpdate(); Report("Battle Bus departing. Thanos selection starts 20 seconds after landing.");
        }
        if (!BusConfigured) return;
        if (!BusExited && now >= BusStartedAt + InfinityRules::BusDropEnd + 1) {
            BusExited = true;
            // Normal aircraft timing handles this first; this is a one-shot fallback.
            if (game->GetGamePhase() == EAthenaGamePhase::Aircraft) game->SkipAircraft();
        }
        if (now < BusStartedAt + InfinityRules::BusFlightEnd + 2) return;
        for (const auto& pair : Players) if (pair.second.connected) {
            auto controller = Cast<AFortPlayerController>(pair.second.controller.Get());
            auto state = controller ? Cast<AFortPlayerStateAthena>(controller->GetPlayerState()) : nullptr;
            if (state && state->IsInAircraft()) return;
        }
        for (auto& ref : Buses) if (auto bus = Cast<AActor>(ref.Get())) {
            if (!bus->IsActorBeingDestroyed()) {
                if (auto ended = mode->FindFunction("OnAircraftFlightEnded")) mode->ProcessEvent(ended, &bus);
                if (!bus->IsActorBeingDestroyed()) bus->K2_DestroyActor();
            }
        }
        Buses.clear();
    }
    static bool OnGround(AFortPawn* pawn) {
        const int offset = pawn->GetOffset("CharacterMovement", false); if (offset < 0) return false;
        auto movement = pawn->Get<UObject*>(offset); if (!movement) return false;
        auto fn = movement->FindFunction("IsMovingOnGround"); if (!fn) return false;
        bool result = false; movement->ProcessEvent(fn, &result); return result;
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
        if (context + sizeof(UObject*) > params.size() || start + sizeof(FVector) > params.size()
            || end + sizeof(FVector) > params.size() || size_t(trace) >= params.size()
            || size_t(result) >= params.size() || hit + impact + sizeof(FVector) > params.size()) return false;
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
        auto skydive = FindObject<UFunction>(L"/Script/FortniteGame.FortPlayerPawn.BeginSkydiving");
        if (!mode || !state || !spawn || !skydive || !controller->GetWorldInventory()) return false;
        auto old = Ref(controller->GetMyFortPawn());
        // Remove Thanos abilities before spawning a normal pawn; never drop the gauntlet.
        if (!RestoreEquipment(controller, player)) return false;
        auto location = ArenaCenter(mode, player.location);
        std::uniform_real_distribution<float> angle(0.f, 6.2831853f);
        float direction = angle(Random); location.X += std::cos(direction)*1200; location.Y += std::sin(direction)*1200;
        if (!GroundAt(location)) return false;
        location.Z += InfinityRules::RespawnHeight;
        FTransform transform{}; transform.Translation = location; transform.Rotation = controller->GetControlRotation().Quaternion(); transform.Scale3D = FVector(1,1,1);
        struct { AController* controller; FTransform transform; APawn* result; } params{controller,transform,nullptr};
        mode->ProcessEvent(spawn, &params);
        auto pawn = Cast<AFortPlayerPawn>(params.result); if (!pawn) return false;
        state->EndDBNOAbilities(); state->ClearDeathInfo(); pawn->SetOwner(controller); controller->Possess(pawn);
        pawn->SetMaxHealth(100); pawn->SetHealth(100); pawn->SetMaxShield(100); LocalTools::RestoreShield(pawn);
        controller->SetPlayerIsWaiting(false); controller->ClientClearDeathNotification(); controller->RespawnPlayerAfterDeath(false);
        if (auto restart = controller->FindFunction("ClientRestart")) controller->ProcessEvent(restart, &pawn);
        bool fromBus = false; pawn->ProcessEvent(skydive, &fromBus);
        pawn->SetCanBeDamaged(false); player.protectedPawn = Ref(pawn); player.protectionUntil = now + 3;
        pawn->ForceNetUpdate();
        if (auto previous = Cast<AActor>(old.Get())) if (previous != pawn && !previous->IsActorBeingDestroyed()) previous->K2_DestroyActor();
        player.lives.Spawned();
        Tell(controller, "Respawned above the arena. " + std::to_string(player.lives.remaining) + " respawns remaining."); return true;
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
            BusStarted = BusConfigured = BusExited = false; Buses.clear(); BusStartedAt = 0;
        }
        auto game = Cast<AFortGameStateAthena>(world->GetGameState());
        if (!game) return;
        double now = game->GetServerWorldTimeSeconds(); if (now < NextTick) return; NextTick = now + .1;
        if (game->GetGamePhase() == EAthenaGamePhase::EndGame || Faulted) return;
        auto mode = Cast<AFortGameModeAthena>(world->GetGameMode()); if (!mode) return;
        for (auto& pair : Players) pair.second.connected = false;
        auto& connections = driver->GetClientConnections();
        for (int i = 0; i < connections.Num(); ++i) {
            auto connection = connections.at(i); if (!connection) continue;
            auto controller = Cast<AFortPlayerControllerAthena>(connection->GetPlayerController()); if (!controller) continue;
            auto key = Identity(controller); if (key.empty()) continue;
            auto& player = Players[key]; player.controller = Ref(controller); player.connected = true;
        }
        TickBus(mode, game, now); HoldZone(mode);
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
            if (game->GetGamePhase() < EAthenaGamePhase::Aircraft) continue;
            if (!player.kit) {
                if (!AddKit(controller)) { Faulted = true; Broadcast("Infinity Showdown could not find the starter weapons. Stop this session and use Classic."); return; }
                player.kit = true; LocalTools::RestoreHealth(pawn);
                Tell(controller,"Infinity Showdown: 10 respawns, retained loot, random Thanos. Check F8 for status messages.");
            }
            const Ref life(pawn);
            const auto token = (uint64_t(uint32_t(life.serial)) << 32) | uint32_t(life.index);
            const bool firstLanding = player.landing.pawn != token || player.landing.landedAt < 0;
            if (player.landing.Ready(token, OnGround(pawn), now)) eligible.push_back(pair.first);
            if (firstLanding && player.landing.landedAt >= 0) Tell(controller, "Landed. You become eligible for Thanos in 20 seconds.");
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
            const bool restored = RestoreEquipment(controller,player); Faulted = true;
            Broadcast(restored ? "Infinity Showdown: Thanos transformation failed. Equipment restored; restart with Classic."
                : "Infinity Showdown: transformation and equipment restore failed. Stop this session; see the server log."); return;
        }
        player.transformed = true; Thanos = selected;
        controller->GetMyFortPawn()->ForceNetUpdate();
        Broadcast("Infinity Showdown: " + selected + " is Thanos! Each player has up to 10 respawns.");
    }
}

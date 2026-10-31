// Included once by NetDriver.cpp: all Unreal mutations run on its game thread.
#include "LocalTools.h"
#include "FortWeapon.h"
#include "FortInventory.h"
#include "FortPickup.h"
#include "GameModeBase.h"
#include "KismetStringLibrary.h"
#include <chrono>

namespace LocalTools {
    static int DeadControllerIndex = -1;
    static FVector DeathLocation;
    static bool HasDeathLocation = false;

    bool IsLocal(AFortPlayerController* controller) {
        if (!controller || !controller->IsValidLowLevel()) return false;
        auto state = controller->GetPlayerState();
        if (!state || !state->IsValidLowLevel()) return false;
        auto ip = state->GetSavedNetworkAddress().ToString();
        return ip == "127.0.0.1" || ip.rfind("127.0.0.1:", 0) == 0;
    }

    bool OnDeath(AFortPlayerController* controller) {
        if (!PracticeRespawn.load() || !IsLocal(controller)) return false;
        auto pawn = controller->GetMyFortPawn();
        if (!pawn || !pawn->IsValidLowLevel()) return false;
        if (pawn->IsDBNO()) return false; // Let normal teammate revival handle knockdowns.
        DeadControllerIndex = controller->InternalIndex;
        DeathLocation = pawn->GetActorLocation();
        HasDeathLocation = true;
        Report("You died. Click Respawn me. Practice mode keeps your inventory and round.");
        // Do not remove this practice player from AlivePlayers or end the local round.
        return true;
    }

    static int TopUp(AFortPlayerControllerAthena* controller, bool materials) {
        auto inventory = controller->GetWorldInventory();
        if (!inventory) return 0;
        const char* mats[] = { "WoodItemData", "StoneItemData", "MetalItemData" };
        const char* ammo[] = { "AthenaAmmoDataBulletsLight", "AthenaAmmoDataBulletsMedium", "AthenaAmmoDataBulletsHeavy", "AthenaAmmoDataShells", "AmmoDataRockets" };
        const int target = materials ? 999 : 200;
        int available = 0;
        for (int i = 0; i < (materials ? 3 : 5); ++i) {
            auto definition = FindObject<UFortItemDefinition>(materials ? mats[i] : ammo[i], nullptr, ANY_PACKAGE);
            if (!definition) continue;
            ++available;
            auto instance = inventory->FindItemInstance(definition);
            int count = instance ? instance->GetItemEntry()->GetCount() : 0;
            if (count < target) {
                bool update = false;
                inventory->AddItem(definition, &update, target - count);
                if (update) inventory->Update();
            }
        }
        return available;
    }

    static void RefillMagazine(AFortPlayerControllerAthena* controller) {
        auto pawn = controller->GetMyFortPawn();
        auto inventory = controller->GetWorldInventory();
        if (!pawn || !inventory) return;
        auto weapon = pawn->GetCurrentWeapon();
        if (!weapon || !weapon->IsValidLowLevel()) return;
        auto definition = weapon->GetWeaponData();
        if (!definition) return;
        int clip = definition->GetClipSize();
        int previous = weapon->GetAmmoCount();
        if (clip <= 0 || clip > 500 || previous >= clip) return;
        weapon->GetAmmoCount() = clip;
        inventory->CorrectLoadedAmmo(weapon->GetItemEntryGuid(), clip);
        if (auto notify = weapon->FindFunction("OnRep_AmmoCount")) weapon->ProcessEvent(notify, &previous);
        weapon->ForceNetUpdate();
    }

    static bool RespawnPlayer(AFortPlayerControllerAthena* controller) {
        auto mode = Cast<AFortGameModeAthena>(GetWorld()->GetGameMode());
        auto state = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        if (!mode || !state || !controller->GetWorldInventory()) return false;
        if (state->IsInAircraft()) { Report("Jump from the bus before respawning."); return false; }
        auto gameState = mode->GetGameStateAthena();
        if (!gameState || gameState->GetGamePhase() == EAthenaGamePhase::EndGame) {
            Report("The match has ended. Restart with Practice respawn enabled."); return false;
        }
        auto oldPawn = controller->GetMyFortPawn();
        bool dead = DeadControllerIndex == controller->InternalIndex;
        if (!oldPawn && !(dead && HasDeathLocation)) { Report("No spawn position is available yet."); return false; }
        FVector location = dead && HasDeathLocation ? DeathLocation : oldPawn->GetActorLocation();
        location.Z += 150;
        auto spawn = FindObject<UFunction>(L"/Script/Engine.GameModeBase.SpawnDefaultPawnAtTransform");
        if (!spawn) { Report("This build does not expose pawn spawning."); return false; }
        FTransform transform{};
        transform.Translation = location;
        transform.Rotation = controller->GetControlRotation().Quaternion();
        transform.Scale3D = FVector(1, 1, 1);
        struct { AController* Player; FTransform Transform; APawn* Result; } params{ controller, transform, nullptr };
        mode->ProcessEvent(spawn, &params);
        auto pawn = Cast<AFortPlayerPawn>(params.Result);
        if (!pawn) { Report("Respawn failed: the game did not create a pawn."); return false; }
        state->EndDBNOAbilities();
        state->ClearDeathInfo();
        pawn->SetOwner(controller);
        controller->Possess(pawn);
        pawn->SetMaxHealth(100); pawn->SetHealth(100);
        pawn->SetMaxShield(100); pawn->SetShield(100);
        controller->SetPlayerIsWaiting(false);
        controller->ClientClearDeathNotification();
        controller->RespawnPlayerAfterDeath(false);
        if (auto restart = controller->FindFunction("ClientRestart")) controller->ProcessEvent(restart, &pawn);
        pawn->ForceNetUpdate();
        if (oldPawn && oldPawn != pawn && oldPawn->IsValidLowLevel() && !oldPawn->IsActorBeingDestroyed()) oldPawn->K2_DestroyActor();
        DeadControllerIndex = -1; HasDeathLocation = false;
        Report("Respawned with 100 health and shield.");
        return true;
    }

    void Execute(AFortPlayerControllerAthena* controller, Action action) {
        if (!IsLocal(controller)) { Report("No local player. Join your match first."); return; }
        if (action == Respawn) { RespawnPlayer(controller); return; }
        auto pawn = controller->GetMyFortPawn();
        if (!pawn || !pawn->IsValidLowLevel() || DeadControllerIndex == controller->InternalIndex) {
            Report("Respawn or join the match first."); return;
        }
        if (action == ClearBuilds) {
            auto buildings = UGameplayStatics::GetAllActorsOfClass(GetWorld(), ABuildingSMActor::StaticClass());
            int count = 0;
            for (int i = 0; i < buildings.Num(); ++i) {
                auto building = Cast<ABuildingSMActor>(buildings.at(i));
                if (!building || !building->IsValidLowLevel() || building->IsDestroyed() ||
                    building->IsActorBeingDestroyed() || !building->IsPlayerPlaced()) continue;
                building->SilentDie(); ++count;
            }
            buildings.Free();
            Report("Removed " + std::to_string(count) + " player builds. Map structures kept.");
        } else if (action == Heal) {
            if (pawn->IsDBNO()) { Report("Respawn or get revived before healing."); return; }
            pawn->SetHealth(100); pawn->SetShield(100); pawn->ForceNetUpdate();
            Report("Health and shield restored.");
        } else if (action == Materials || action == Ammo) {
            int count = TopUp(controller, action == Materials);
            if (action == Ammo) RefillMagazine(controller);
            Report(count ? "Supplies refilled." : "Required item definitions were not found.");
        } else if (action == Kit) {
            auto inventory = controller->GetWorldInventory();
            if (!inventory) { Report("Inventory is not ready."); return; }
            const char* weapons[] = { "WID_Assault_Auto_Athena_R_Ore_T03", "WID_Shotgun_Standard_Athena_C_Ore_T03" };
            int count = 0;
            for (auto name : weapons) {
                auto definition = FindObject<UFortWeaponItemDefinition>(name, nullptr, ANY_PACKAGE);
                if (!definition) continue;
                if (!inventory->FindItemInstance(definition)) {
                    bool update = false;
                    inventory->AddItem(definition, &update, 1, definition->GetClipSize());
                    if (update) inventory->Update();
                }
                ++count;
            }
            TopUp(controller, false); TopUp(controller, true);
            Report("Starter kit: " + std::to_string(count) + "/2 weapons available, ammo and materials refilled.");
        } else if (action == Loot) {
            auto gameState = Cast<AFortGameStateAthena>(GetWorld()->GetGameState());
            if (!gameState) { Report("Match is not ready."); return; }
            auto drops = PickLootDrops(UKismetStringLibrary::Conv_StringToName(L"Loot_AthenaTreasure"), gameState->GetWorldLevel(), -1, false);
            int count = 0;
            for (auto& drop : drops) {
                PickupCreateData data;
                data.ItemEntry = drop.ItemEntry;
                data.bShouldFreeItemEntryWhenDeconstructed = true;
                data.SpawnLocation = pawn->GetActorLocation() + pawn->GetActorForwardVector() * 200;
                data.SpawnLocation.Z += 100;
                data.bToss = true; data.bRandomRotation = true;
                data.SourceType = EFortPickupSourceTypeFlag::GetContainerValue();
                if (AFortPickup::SpawnPickup(data)) ++count;
            }
            Report(count ? "Spawned " + std::to_string(count) + " loot pickups in front of you." : "This playlist returned no chest loot.");
        }
    }

    void Tick(UNetDriver* driver) {
        if (!Globals::bStartedListening || !driver) return;
        using Clock = std::chrono::steady_clock;
        static auto lastRefill = Clock::now();
        bool refill = Clock::now() - lastRefill >= std::chrono::milliseconds(500);
        int action = Pending.exchange(None);
        if (!refill && action == None) return;
        if (refill) lastRefill = Clock::now();
        AFortPlayerControllerAthena* local = nullptr;
        auto& connections = driver->GetClientConnections();
        for (int i = 0; i < connections.Num(); ++i) {
            auto connection = connections.at(i);
            if (!connection) continue;
            auto controller = Cast<AFortPlayerControllerAthena>(connection->GetPlayerController());
            if (!IsLocal(controller)) continue;
            if (local) { if (action != None) Report("More than one local player. Use F8 commands to target yourself."); return; }
            local = controller;
        }
        if (!local) { if (action != None) Report("Join your local match first."); return; }
        if (action != None) Execute(local, static_cast<Action>(action));
        if (refill && DeadControllerIndex != local->InternalIndex && local->GetMyFortPawn()) {
            if (InfiniteMaterials.load()) TopUp(local, true);
            if (InfiniteAmmo.load()) { TopUp(local, false); RefillMagazine(local); }
        }
    }
}

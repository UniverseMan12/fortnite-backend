import fs from 'node:fs';
import path from 'node:path';

export function patchInfinity(root) {
  const directory = path.join(root, 'Project Reboot 3.0');
  const edit = (file, edits) => {
    const target = path.join(directory, file);
    let text = fs.readFileSync(target, 'utf8').replaceAll('\r\n','\n');
    if (text.includes('// Infinity Showdown v2')) return;
    if (text.includes('// Infinity Showdown v1')) throw new Error('Infinity v2 requires a fresh pinned upstream checkout.');
    for (const [before, after] of edits) {
      if (text.split(before).length !== 2) throw new Error(`Infinity patch mismatch in ${file}: ${before.slice(0,70)}`);
      text = text.replace(before,after);
    }
    fs.writeFileSync(target,'// Infinity Showdown v2\n'+text);
  };
  edit('NetDriver.cpp', [
    ['#include "LocalTools.inl"','#include "LocalTools.inl"\n#include "InfinityShowdown.inl"'],
    ['\tLocalTools::Tick(NetDriver);','\tInfinityShowdown::Tick(NetDriver);\n\tLocalTools::Tick(NetDriver);']
  ]);
  edit('FortInventory.cpp', [
    ['#include "FortInventory.h"','#include "FortInventory.h"\n#include "InfinityShowdown.h"'],
    ['if (GadgetItemDefinition->ShouldDropAllItemsOnEquip())','if (GadgetItemDefinition->ShouldDropAllItemsOnEquip() && !InfinityShowdown::Enabled.load())'],
    ['LOG_INFO(LogDev, "DidApplyingGadgetSucceed: {}", DidApplyingGadgetSucceed);','InfinityShowdown::GadgetApplied(FortPlayerController, ItemDefinition, DidApplyingGadgetSucceed);\n\t\t\t\t\tLOG_INFO(LogDev, "DidApplyingGadgetSucceed: {}", DidApplyingGadgetSucceed);']
  ]);
  edit('FortPlayerPawn.cpp', [
    ['#include "FortPlayerPawn.h"', '#include "FortPlayerPawn.h"\n#include "InfinityShowdown.h"'],
    ['void AFortPlayerPawn::ServerHandlePickupHook(AFortPlayerPawn* Pawn, AFortPickup* Pickup, float InFlyTime, FVector InStartDirection, bool bPlayPickupSound)\n{',
     'void AFortPlayerPawn::ServerHandlePickupHook(AFortPlayerPawn* Pawn, AFortPickup* Pickup, float InFlyTime, FVector InStartDirection, bool bPlayPickupSound)\n{\n\tif (InfinityShowdown::HandlePickup(Pawn, Pickup)) return;'],
    ['auto Pickup = *(AFortPickup**)(__int64(Params) + PickupOffset);',
     'auto Pickup = *(AFortPickup**)(__int64(Params) + PickupOffset);\n\tif (InfinityShowdown::HandlePickup(Pawn, Pickup)) return;']
  ]);
  edit('FortPickup.cpp', [
    ['#include "FortPickup.h"', '#include "FortPickup.h"\n#include "InfinityShowdown.h"'],
    ['auto Pawn = Cast<AFortPlayerPawn>(Pickup->GetPickupLocationData()->GetPickupTarget());',
     'auto Pawn = Cast<AFortPlayerPawn>(Pickup->GetPickupLocationData()->GetPickupTarget());\n\tif (InfinityShowdown::HandlePickup(Pawn, Pickup)) return 0;']
  ]);
  edit('FortAthenaSupplyDrop.cpp', [
    ['#include "FortAthenaSupplyDrop.h"', '#include "FortAthenaSupplyDrop.h"\n#include "InfinityShowdown.h"'],
    ['\tSpawnGameModePickupOriginal(Context, Stack, Ret);',
     '\tif (InfinityShowdown::HandleMeteorLoot(Context, ItemDefinition, Position, Ret)) {\n\t\tif (Stack.Code) ++Stack.Code; // P_FINISH: consume EX_EndFunctionParms.\n\t\treturn Ret ? *Ret : nullptr;\n\t}\n\tSpawnGameModePickupOriginal(Context, Stack, Ret);'],
    ['\tSpawnPickupOriginal(Context, Stack, Ret);',
     '\tif (InfinityShowdown::HandleMeteorLoot(Context, ItemDefinition, Position, Ret)) {\n\t\tif (Stack.Code) ++Stack.Code; // P_FINISH: consume EX_EndFunctionParms.\n\t\treturn Ret ? *Ret : nullptr;\n\t}\n\tSpawnPickupOriginal(Context, Stack, Ret);']
  ]);
  edit('FortPlayerController.cpp', [
    ['#include "LocalTools.h"','#include "LocalTools.h"\n#include "InfinityShowdown.h"'],
    ['\tif (Engine_Version < 424 && !Globals::bLateGame.load())',
     '\tif (InfinityShowdown::Enabled.load()) {\n\t\tif (!InfinityShowdown::CanJumpFromBus(PlayerController)) return;\n\t\treturn ServerAttemptAircraftJumpOriginal(PC, ClientRotation);\n\t}\n\n\tif (Engine_Version < 424 && !Globals::bLateGame.load())'],
    ['bool bDropInventory = true;','bool bDropInventory = !InfinityShowdown::Enabled.load();']
  ]);
  edit('extra.cpp', [
    ['#include "gui.h"','#include "gui.h"\n#include "InfinityShowdown.h"'],
    ['\tstatic auto ZoneDurationsOffset =', '\tif (InfinityShowdown::Enabled.load()) {\n\t\tif (InfinityShowdown::BeginZone(GameModeAthena)) {\n\t\t\tSetZoneToIndexOriginal(GameModeAthena, OverridePhaseMaybeIDFK);\n\t\t}\n\t\treturn;\n\t}\n\tstatic auto ZoneDurationsOffset =']
  ]);
  edit('FortGameModeAthena.cpp', [
    ['#include "FortGameModeAthena.h"', '#include "FortGameModeAthena.h"\n#include "InfinityShowdown.h"'],
    ['auto SetPlaylist = [&GameState, &GameMode](UObject* Playlist, bool bOnRep) -> void {',
     'auto SetPlaylist = [&GameState, &GameMode](UObject* Playlist, bool bOnRep) -> void {\n\t\tif (InfinityShowdown::Enabled.load()) InfinityShowdown::ConfigurePlaylist(Playlist);'],
    ['OnAircraftEnteredDropZoneOriginal(GameModeAthena, Aircraft);\n\n\tif (Globals::bLateGame.load())',
     'OnAircraftEnteredDropZoneOriginal(GameModeAthena, Aircraft);\n\n\tif (Globals::bLateGame.load() && !InfinityShowdown::Enabled.load())']
  ]);
  edit('FortPlayerControllerAthena.h', [
    ['if (!CID)\n\t\treturn false;',
     'if (!CID || !Pawn || !Pawn->IsValidLowLevel() || Pawn->IsActorBeingDestroyed())\n\t\treturn false;']
  ]);
  edit('gui.h', [
    ['#include "LocalTools.h"','#include "LocalTools.h"\n#include "InfinityShowdown.h"'],
    ['if (ImGui::Button("Solo")) PlaylistName = "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo";',
     'if (ImGui::Button("Solo")) { InfinityShowdown::Enabled.store(false); SetIsLategame(false); PlaylistName = "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo"; }'],
    ['if (ImGui::Button("Thanos (experimental)")) PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";',
     'if (ImGui::Button("Thanos (experimental)")) { InfinityShowdown::Enabled.store(false); SetIsLategame(false); Globals::bEnableAGIDs = true; PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine"; }\n\t\tImGui::SameLine();\n\t\tif (ImGui::Button("Infinity Showdown")) { InfinityShowdown::Enabled.store(true); SetIsLategame(true); Globals::bEnableAGIDs = true; LocalTools::PracticeRespawn.store(false); PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine"; InfinityShowdown::Report("Waiting for the Battle Bus. Every player has 10 respawns."); }'],
    ['\tchar multiplayerMode[2] = {};',
     '\tchar showdown[2] = {};\n\tif (GetEnvironmentVariableA("FORTNITE_LAUNCHER_SHOWDOWN", showdown, sizeof(showdown)) == 1 && showdown[0] == \'1\') {\n\t\tInfinityShowdown::Enabled.store(true);\n\t\tSetIsLategame(true); Globals::bEnableAGIDs = true;\n\t\tPlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";\n\t\tLocalTools::PracticeRespawn.store(false);\n\t}\n\tchar multiplayerMode[2] = {};'],
    // Existing late-game kit mutates inventory from its GUI thread. Our kit runs only on the game thread.
    ['for (int z = 0; z < ClientConnections.Num(); z++)','for (int z = 0; !InfinityShowdown::Enabled.load() && z < ClientConnections.Num(); z++)'],
    ['CreateThread(0, 0, LateGameThread, 0, 0, 0);', 'if (InfinityShowdown::Enabled.load()) InfinityShowdown::BusRequested.store(true);\n\t\t\t\t\t\t\t\telse CreateThread(0, 0, LateGameThread, 0, 0, 0);'],
    ['\t\tif (ImGui::Button("Start server")) {',
     '\t\tif (InfinityShowdown::Enabled.load()) { ImGui::TextUnformatted("Infinity Showdown: random Thanos, 10 respawns, retained loot."); }\n\t\tif (ImGui::Button("Start server")) {\n\t\t\tif (InfinityShowdown::Enabled.load()) { SetIsLategame(true); Globals::bEnableAGIDs = true; PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine"; }']
  ]);
  // Upgrade previously patched sources too: ordinary Thanos uses the unmodified
  // Carmine playlist, with no Showdown zone, kit or respawn rules.
  const gui = path.join(directory, 'gui.h');
  let source = fs.readFileSync(gui, 'utf8');
  if (!source.includes('FORTNITE_LAUNCHER_THANOS')) {
    const before = '\tchar showdown[2] = {};';
    if (source.split(before).length !== 2) throw new Error('Missing launcher mode initialization in gui.h');
    source = source.replace(before, `\tchar thanos[2] = {};
\tif (GetEnvironmentVariableA("FORTNITE_LAUNCHER_THANOS", thanos, sizeof(thanos)) == 1 && thanos[0] == '1') {
\t\tInfinityShowdown::Enabled.store(false);
\t\tSetIsLategame(false); Globals::bEnableAGIDs = true;
\t\tPlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";
\t\tLocalTools::PracticeRespawn.store(false);
\t}
${before}`);
    fs.writeFileSync(gui, source);
  }
  source = fs.readFileSync(gui, 'utf8').replace('Infinity Showdown: random Thanos, 10 respawns, retained loot.', 'Infinity Showdown: falling Gauntlet, 500 HP / 200 shield, sniper kit, full respawn refill.');
  fs.writeFileSync(gui, source);
}

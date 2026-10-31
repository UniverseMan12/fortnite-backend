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
  edit('FortPlayerController.cpp', [
    ['#include "LocalTools.h"','#include "LocalTools.h"\n#include "InfinityShowdown.h"'],
    ['bool bDropInventory = true;','bool bDropInventory = !InfinityShowdown::Enabled.load();']
  ]);
  edit('extra.cpp', [
    ['#include "gui.h"','#include "gui.h"\n#include "InfinityShowdown.h"'],
    ['\tstatic auto ZoneDurationsOffset =', '\tif (InfinityShowdown::Enabled.load()) {\n\t\tif (InfinityShowdown::BeginZone(GameModeAthena)) {\n\t\t\tSetZoneToIndexOriginal(GameModeAthena, OverridePhaseMaybeIDFK);\n\t\t\tInfinityShowdown::HoldZone(GameModeAthena);\n\t\t}\n\t\treturn;\n\t}\n\tstatic auto ZoneDurationsOffset =']
  ]);
  edit('FortGameModeAthena.cpp', [
    ['#include "FortGameModeAthena.h"', '#include "FortGameModeAthena.h"\n#include "InfinityShowdown.h"'],
    ['auto SetPlaylist = [&GameState, &GameMode](UObject* Playlist, bool bOnRep) -> void {',
     'auto SetPlaylist = [&GameState, &GameMode](UObject* Playlist, bool bOnRep) -> void {\n\t\tif (InfinityShowdown::Enabled.load()) InfinityShowdown::ConfigurePlaylist(Playlist);'],
    ['OnAircraftEnteredDropZoneOriginal(GameModeAthena, Aircraft);\n\n\tif (Globals::bLateGame.load())',
     'OnAircraftEnteredDropZoneOriginal(GameModeAthena, Aircraft);\n\n\tif (Globals::bLateGame.load() && !InfinityShowdown::Enabled.load())']
  ]);
  edit('FortSafeZoneIndicator.cpp', [
    ['#include "FortSafeZoneIndicator.h"', '#include "FortSafeZoneIndicator.h"\n#include "InfinityShowdown.h"'],
    ['return OnSafeZoneStateChangeOriginal(SafeZoneIndicator, NewState, bInitial);',
     'if (InfinityShowdown::Enabled.load() && NewState == EFortSafeZoneState::Shrinking) NewState = EFortSafeZoneState::Holding;\n\treturn OnSafeZoneStateChangeOriginal(SafeZoneIndicator, NewState, bInitial);']
  ]);
  edit('gui.h', [
    ['#include "LocalTools.h"','#include "LocalTools.h"\n#include "InfinityShowdown.h"'],
    ['\tchar multiplayerMode[2] = {};',
     '\tchar showdown[2] = {};\n\tif (GetEnvironmentVariableA("FORTNITE_LAUNCHER_SHOWDOWN", showdown, sizeof(showdown)) == 1 && showdown[0] == \'1\') {\n\t\tInfinityShowdown::Enabled.store(true);\n\t\tSetIsLategame(true); Globals::bEnableAGIDs = true;\n\t\tPlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";\n\t\tLocalTools::PracticeRespawn.store(false);\n\t}\n\tchar multiplayerMode[2] = {};'],
    // Existing late-game kit mutates inventory from its GUI thread. Our kit runs only on the game thread.
    ['for (int z = 0; z < ClientConnections.Num(); z++)','for (int z = 0; !InfinityShowdown::Enabled.load() && z < ClientConnections.Num(); z++)'],
    ['CreateThread(0, 0, LateGameThread, 0, 0, 0);', 'if (InfinityShowdown::Enabled.load()) InfinityShowdown::BusRequested.store(true);\n\t\t\t\t\t\t\t\telse CreateThread(0, 0, LateGameThread, 0, 0, 0);'],
    ['\t\tif (ImGui::Button("Start server")) {',
     '\t\tif (InfinityShowdown::Enabled.load()) { ImGui::TextUnformatted("Infinity Showdown: random Thanos, 10 respawns, retained loot."); }\n\t\tif (ImGui::Button("Start server")) {\n\t\t\tif (InfinityShowdown::Enabled.load()) { SetIsLategame(true); Globals::bEnableAGIDs = true; PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine"; }']
  ]);
}

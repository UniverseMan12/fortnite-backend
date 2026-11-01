# Fortnite Launcher 0.4.0-alpha.1

An experimental Windows release for Fortnite 4.2, focused on the new **Infinity Showdown** mode. The stable release remains **v0.3.1**.

## New mode: Infinity Showdown

- A separate mode in the Launcher and Project Reboot, alongside ordinary Solo and Thanos.
- A moving Battle Bus takes players into a compact, fixed late-game arena.
- Thanos is selected randomly 20 seconds after a player lands. Selection requires a grounded, living player; no gauntlet drops from the sky.
- Each player has an initial life plus 10 respawns. Respawning takes three seconds and returns the player to the air above the arena with glider/skydiving behavior, 100 health, 100 shield and brief spawn protection.
- Normal weapons, ammunition and materials survive death. The Infinity Gauntlet is removed, and Thanos's previous equipment returns.
- A strong starter kit includes a legendary SCAR, an available shotgun, mini shields, medkits and 999 materials/ammunition.
- Multiplayer selection prefers another eligible contender. A lone remaining player can become Thanos again after the next landing delay, including in solo testing.
- The arena is 35% larger than the previous late-game circle, with a minimum radius of 150 metres.

## Fixes since v0.3.1

- Fixed the Fortnite 4.2 startup crash associated with incompatible saved borderless resolution settings. Only the relevant resolution keys are repaired, with an exact backup; Windows display resolution is unchanged.
- Fixed the Thanos-death crash caused by cosmetic restoration accessing a missing pawn.
- Restored normal equipment after Thanos death without adding an extra pickaxe or dropping a replacement gauntlet.
- Added airborne respawning and a fresh landing timer for each life.
- Restored the normal character after respawning. The follow-up restoration also preserves the original body type, gender, all character-part slots and animation override to address stretched proportions.
- Fixed solo reassignment excluding the previous Thanos when no other contender remains.
- Fixed stationary/lingering Battle Bus behavior and the automatic late-game aircraft skip.
- Initialized the arena during bus departure and gated jumping on the countdown and arena readiness, using the native jump path.
- Fixed the experimental Start Bus crash by letting Fortnite create its zone indicator before calling the phase routine.
- Restored the visible storm wall and safe map area, enlarged the arena and stopped repeated storm-shrinking alerts.
- Fixed the storm disappearing after the Battle Bus by completing the native zone transition and preserving the fixed arena across the engine's reset.
- Restored Thanos ability icons through the Carmine HUD while retaining the custom gameplay rules and disabling automatic special supply drops.
- Added duplicate-death protection, independent respawn budgets and reconnect handling that does not reset the life budget.

## Download and play

- **Installer:** `Fortnite-Launcher-0.4.0-alpha.1-x64-nsis.exe`.
- **Portable:** `Fortnite-Launcher-0.4.0-alpha.1-x64-portable.exe`.
- Verify downloads using `SHA256SUMS.txt`.

Windows x64, your own Fortnite 4.2 game files and the Visual C++ x64 runtime are required. Node.js and Git are not required. First-use component preparation needs internet access. The executables are unsigned and contain no Fortnite game files or private settings.

Choose your game folder in Setup, select Infinity Showdown and host. In Reboot select Infinity Showdown, click Start server, enter the island, then click Start Bus. Friends join using the host's private VPN/LAN address. Ordinary Solo and Thanos remain separate choices.

## Validation and known limits

Automated checks cover 28 Node tests, 7 desktop tests, native rules and packaged/portable smoke tests. Manual solo testing covers the gameplay scenarios recorded in the QA notes. Compilation alone does not establish correct in-game behavior.

- A real two-PC VPN match and clean-machine installer/uninstaller testing remain unverified.
- The fixed storm's cosmetic HUD timer can show approximately 1439 minutes.
- This is an experimental prerelease, with no automatic updater. Thanos and private multiplayer retain their compatibility limitations.

[Mode instructions](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/codex/infinity-showdown/INFINITY_SHOWDOWN.md) · [Detailed QA results](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/codex/infinity-showdown/RELEASE_QA.md)

# Infinity Showdown (experimental)

A private Fortnite 4.2 late-game mode with a randomly assigned Thanos role. This is custom server logic, not a playlist name alone.

## Play

1. The host selects **Infinity Showdown** in the launcher, chooses their Fortnite folder and launches.
2. In Reboot, select **Infinity Showdown**, then **Start server**. It has its own button beside **Solo** and **Thanos (experimental)**. The mode uses the Carmine playlist for Thanos' ability HUD, with Solo gameplay rules, automatic supply drops disabled, gadget support and custom late-game rules.
3. Friends choose **Join** and enter the host's VPN/LAN IP. The host controls the rules.
4. Everyone presses Play to enter the island. Once everyone is connected, the host clicks **Start Bus** in Reboot.
5. The bus flies across the arena with a 16-second jump window. Land first: you become eligible for random Thanos selection **20 seconds after touching the ground**. Selection only transforms a currently grounded player. No gauntlet drops from the sky.

## Rules

- Each player starts with one life and **10 additional respawns**. The eleventh death eliminates them normally. Duplicate death callbacks do not spend extra lives, and a failed pawn spawn retries without spending another life.
- Respawns take three seconds and place you **200 metres above the terrain** near the arena center, skydiving back into the safe zone. The new pawn gets three seconds of damage protection.
- Normal equipment stays in the inventory on death. Thanos's previous inventory is stored separately; after his death the gauntlet and its abilities are removed and the previous equipment is restored. No gauntlet pickup is created.
- A different eligible live player is randomly selected as Thanos after the previous Thanos dies or disconnects. When everyone else is waiting to respawn, selection waits. When only one connected, non-eliminated player remains (including solo testing), that player can receive the role again after the new landing delay. Ordinary final-elimination/winner handling remains with the game server.
- The starter kit contains a legendary SCAR, the available blue pump (fallback to the older pump if that definition is absent), six mini shields and three medkits. Wood, stone, metal and ammo start at 999. Consumables use their normal stack sizes. The kit is granted once, not refilled after each death.
- The arena has a fixed radius **35% larger than the previous late-game circle**, with a minimum of 150 metres, around the fourth zone center. The storm is paused once instead of repeatedly starting a shrink. The bus moves immediately and is removed after its flight once everyone has exited.
- Each respawn starts a fresh 20-second landing delay. Jumping does not reset an existing landing timer, but a player cannot become Thanos while airborne.
- Practice respawn, healing and item-spawning tools are disabled in this mode. Classic retains its original tools.
- Disconnecting forfeits that player's participation in the current session. Reconnecting under the same player identity does not reset the life budget. Stop/restart the server for a new round.

## Compatibility and testing limits

The pinned DLL is built from `7fa094930fbc015a09a95be3b2febb4872f0ebd7`. [Native build 41252165069](https://github.com/UniverseMan12/fortnite-backend/actions/runs/41252165069) passed compilation and the engine-independent rules tests, including solo reassignment and preference for a different multiplayer contender. The downloaded archive matches GitHub's SHA-256 digest; the DLL matches the included `reboot.sha256` and the dependency manifest.

Earlier manual Fortnite 4.2 testing confirmed bus departure, the larger visible storm wall, Thanos ability icons, survival of Thanos death without a server crash, normal inventory restoration and airborne respawn. A fresh solo test on November 1 with the new DLL also confirmed the original character after Thanos death, airborne respawn with 100 health/100 shield and restored equipment, and successful reassignment to the same solo player after landing. The 20-second threshold and airborne exclusion are covered by native rules tests; the manual test was not a frame-accurate timing measurement. A real two-PC VPN match and multiplayer role rotation remain unverified in game. Compilation and pure-rule tests alone do not prove engine behavior.

The fixed storm timestamps are held approximately 24 hours ahead. The wall and safe area work in the previous manual test, but the HUD can show approximately 1439 minutes; the timer is not hidden or polished.

If the game cannot load the Thanos gadget, apply its abilities, or find the starter weapons, the mode reports a failure in Reboot and the affected player's F8 console. Stop the session and select Classic. This experimental mode does not silently claim a successful transformation when the game's gadget hook reports failure.

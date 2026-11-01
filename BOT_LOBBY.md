# NOVA DROP bot lobby — experimental v2

Classic and ordinary Thanos can fill a match to **100 participants**: one human gets up to **99 bots**; two humans get 98. **Infinity Showdown disables all bots.** This stays on `codex/bot-lobby`, separate from the stable v0.4.0 release.

## Owner playtest

Use the separately named **bot-lobby-v2-test** launcher. Select Classic or Thanos, then Solo or Host friends. Before **Start server**, Reboot's **Maximum bots (0 = off)** defaults to 99. Wait on the warmup island until **Warmup bots: 99 / 99** (or the reduced multiplayer count) before starting the bus. Starting early freezes the smaller population; eliminated bots never refill.

First check movement on the warmup island, then bus departures, distributed landings, bot-versus-bot gunfire and actual damage to your player. Also check a joining friend takes a bot slot before the bus and that Infinity Showdown spawns zero bots. The assistant does not operate the owner's game.

The original prototype was tested by the owner: bots spawned and could be killed, but neither moved nor fired. That is a failed gameplay test, despite its successful compilation. The v2 implementation below still requires a fresh gameplay test.

## Changes

- Configure controllers without a connected player for authority-side movement, a simulated remote pawn role, acknowledged possession and enabled character physics. Verify `IsLocallyControlled`; reconfigure after the bus replaces a pawn.
- Submit movement every engine frame. Target selection and path planning run less frequently. The original prototype submitted movement only at 10 Hz and did not configure local control.
- Activate the native rifle ability on authority if `PawnStartFire` did not already activate it. Use native bullets, collision, damage and reload; no artificial direct damage or decorative gunfire.
- Spawn in small batches at native warmup starts. Warmup bots do not fight and cannot be damaged. Before the bus, human arrivals remove excess bots and resolve team collisions. Bots get independent teams in the normal 2–101 range.
- Track warmup, bus, airborne, grounded and eliminated states. Use the original aircraft-jump implementation only during the unlocked drop window. Schedule departure near the assigned landing destination along the bus route, then steer through native skydiving movement.
- Choose landing destinations from spatially distributed cells containing actual island loot containers, excluding the warmup island. Native skydiving physics determine the actual landing; this does not teleport bots to destinations.
- Target living enemies of either kind: players and bots. Prefer visible nearby opponents; stop firing after losing the target or visibility. Approach, strafe at close range and prioritize reaching the next storm circle.
- Request paths from native navigation when available, with a bounded request budget. Without usable navigation, use directional movement and a stuck/jump recovery. No building, looting, advanced cover tactics or automatic Gauntlet pickup yet. Complex buildings and cliffs remain a playtest concern.
- Reboot displays observed movement and firing counts. Movement requires a measured position change; firing requires a decrease in actual weapon ammunition. These counters do not by themselves establish correct damage, navigation or 99-bot performance.

## Validation

The C++ rules test covers the 100-participant cap, Infinity Showdown exclusion, team/self/death exclusions, the locked bus/drop window, distributed jump scheduling, shooting range, line-of-sight gating and burst cooldown. Native compilation and launcher regression tests are run before packaging. Full-match performance and native 4.2 behavior need the owner's game test before a stable release.

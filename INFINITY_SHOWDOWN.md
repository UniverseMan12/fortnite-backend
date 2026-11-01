# Infinity Showdown (experimental)

A private Fortnite 4.2 arena mode where players fight over one Infinity Gauntlet. The host controls the rules; this is separate from ordinary full-island Thanos mode.

## Play

1. The host selects **Host friends → Infinity Showdown** in the launcher. Reboot opens with the mode preselected; click **Start server**.
2. Friends select **Join friend** and paste the host's invitation or Hamachi/LAN IPv4. Everyone must be on the same LAN or private VPN. The invitation contains an address, not a VPN tunnel.
3. Once Reboot's **Game** tab shows **Joinable true**, everyone can press **Play** in Fortnite in any order. The host does not have to reach the island first.
4. Start **Bus Countdown** only after everyone has joined the island.
5. After the bus jump window ends, a 20-second countdown begins. The original 4.2 Carmine Gauntlet meteor is spawned 600 metres above its landing point inside the arena. Its native projectile component is initialized downward at 60 metres per second. Pick up the Gauntlet after impact to become Thanos; the role is no longer assigned randomly.

## Rules

- Thanos has **500 health and 200 shield**. Native Carmine effects cannot increase these caps. Damage below the caps is retained; the server does not continuously heal Thanos.
- Thanos drops the Gauntlet on death, including the final elimination. It can be picked up by another player or by the former holder after respawning. Disconnecting also releases it. A drop outside the arena is moved back to a reachable point inside it.
- Only one world Gauntlet or active Thanos is allowed. Pickup requests are checked on the server for the actual tracked Gauntlet, a living grounded player, distance, aircraft state and the player's remaining lives. Competing or duplicate pickup requests cannot create two holders.
- Each player has one initial life and **10 additional respawns**. Respawning takes three seconds and places the player 200 metres above terrain near the arena centre, with 100 health, 100 shield and three seconds of damage protection. Duplicate death callbacks and failed spawn retries do not consume additional lives.
- The five-slot starter kit is a **legendary SCAR, blue pump** (older pump fallback), **legendary bolt-action sniper, six minis and three medkits**. Resources and ammo are stocked to 999.
- Equipment is retained on death. On each respawn, materials, reserve ammo, minis, medkits and all retained weapon magazines are refilled. Thanos's original inventory and normal appearance are restored before spawning a normal player.
- The storm stays around the fixed arena. The radius is at least 150 metres, centred around the fourth native zone. Bus timing, appearance restoration and the fixed storm lifecycle remain in place.
- Disconnecting does not reset the ten-respawn budget. Stop and restart the server to begin a new round.

## Connection troubleshooting

Use the **host's** VPN address for Join friend. The host's firewall needs an inbound exception for its actual `FortniteClient-Win64-Shipping.exe`, **UDP 7777**, on the VPN adapter's active network profile. Prefer a rule scoped to the friend addresses and that adapter. The launcher does not disable the firewall or configure a VPN.

On November 1, 2026, the owner confirmed a successful two-PC Hamachi join after a scoped host firewall exception was added. The friend joining before the host is supported; this does not establish that joining order caused the earlier failure.

## Validation limits

The Gauntlet redesign is under validation on `codex/showdown-gauntlet`. The first candidate's transformation was confirmed in-game, but its simulated pickup descent lacked the original meteor effects and the pickup model remained after use. The first native-meteor candidate showed the original trail stuck near the ground in the owner's screenshot. The next revision starts that same blueprint in the sky, retains Carmine GameData, initializes its native movement and replicates its position. It also retains the consumed pickup notification before delayed destruction. Falling visuals, impact audio and pickup disappearance still need in-game confirmation by the owner. No extracted game assets are distributed with the launcher. Native state tests cover pickup exclusivity, falling versus available states, re-dropping, bus timing, arena lifecycle and the respawn budget. See [RELEASE_QA.md](RELEASE_QA.md) for build and game-test results.

The older fixed storm can still display an approximately 1439-minute cosmetic timer. A complete match with the redesigned Gauntlet must be tested separately from the successful multiplayer connection test. Server-side status messages are available in Reboot and the F8 console.

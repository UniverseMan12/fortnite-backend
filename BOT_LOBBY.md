# NOVA DROP bot lobby — experimental playtest

This adds basic server-controlled combat opponents to **Classic** and ordinary **Thanos** on the main island. **Infinity Showdown always disables bots**, even if a bot count was previously selected.

## Start a test

1. Use the separately named bot-lobby test launcher and select Classic or Thanos. Choose Solo or Host friends.
2. In Reboot, before **Start server**, set **Combat bots (0 = off)** to a small number, such as **3**. The limit is 10; the default is off.
3. Start the server, enter the island, start the bus and land on the main island. The game must have reached its normal storm phase.
4. Bots deploy one at a time, approximately 35 metres from grounded human players. Reboot shows the live bot count and setup status.

## Implemented behavior and limits

- Bots receive a blue assault rifle, ammunition, a normal character and 100 health. They are separate opponents of human players, including a human playing as Thanos.
- The controller aims with spread, requests movement toward/around players and uses Fortnite's native firing functions in short bursts. Visibility and range gate shooting; losing the target or line of sight stops an active burst. No direct/artificial damage is applied to players.
- Existing engine physics handle collisions. The first version has simple steering and occasional jumping; it has no navigation/pathfinding, building, looting, bus jumping or automatic Gauntlet pickup. Bots can get stuck on buildings or terrain and do not plan a route to the storm circle.
- A killed bot stays eliminated. The configured count is a total spawn budget, not a continuously refilled population. Normal match/elimination logic remains with the server.
- The count is fixed when the server starts. Restart the session to change it. Repeated setup failures stop the bot system with a status message.

## Required owner playtest

Compilation and rules tests cannot establish that Fortnite 4.2's native movement and firing work for a controller without a connected player. This must be checked in game before calling the bot lobby ready or publishing it as a regular release.

With three bots, check that they appear after landing, move, visibly fire and actually damage you; check that killing a bot reduces the count and that Classic/Thanos both work. Also check that selecting Infinity Showdown produces zero bots. The assistant does not operate the owner's game for this test.

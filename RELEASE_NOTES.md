# Fortnite Launcher 0.4.0-alpha.3 — development preview

## New in this preview

- A separate **Thanos** selection alongside Classic and Infinity Showdown. It selects the existing Carmine / Infinity Gauntlet playlist on the full island, with late-game and Showdown rules disabled. Normal Thanos selection also disables practice respawning.
- Original Fortnite × Avengers artwork with Omega and Thanos distinguishes the normal mode from Infinity Showdown.
- The chosen mode is saved and preselected in Reboot. Click **Start server** there; selecting the mode a second time is unnecessary. Joining players follow the host's rules.
- A launcher screenshot is included in the GitHub README. All three mode cards fit the supported window sizes.

This preview is not yet a published GitHub release. Ordinary Thanos remains experimental: the launcher uses the existing playlist, and a complete match including the falling gauntlet has not been verified in this update. Server startup is still manual in Reboot. See [RELEASE_QA.md](RELEASE_QA.md) for validation.

## Previous release: 0.4.0-alpha.2

A redesigned Windows launcher for Fortnite 4.2. This prerelease builds on Infinity Showdown from alpha.1; v0.3.1 remains the stable release.

## Game modes and included gameplay fixes

- Classic play and experimental Infinity Showdown are selectable in the launcher. Reboot retains its Solo and ordinary Thanos options alongside the separate Infinity Showdown button.
- Infinity Showdown starts from the Battle Bus in a compact late-game arena. A player becomes Thanos 20 seconds after landing, without a falling gauntlet.
- Players receive ten extra respawns, airborne respawning, retained normal equipment and a strong starter kit with 999 materials/ammo. After Thanos dies, the next selection prefers another player; solo testing can select the same player again after landing and the delay.
- Includes alpha.1's fixes for the Thanos-death crash, original skin and normal body proportions after respawn, bus-start crash and storm wall disappearing across bus departure. The tester confirmed normal proportions and a visible wall before and after jumping.
- Early bus exit is guarded by the native countdown and arena readiness checks. The countdown boundaries are covered by native tests; repeated early jump input was not separately timed in a manual test.
- This release reuses the verified native DLL from alpha.1; the redesign adds no further native gameplay changes.

## A simpler launcher

- A new original portal logo, matching Windows icon and a short startup animation. Reduced-motion preferences skip the animation.
- Season 4 banners featuring Carbide and Omega, with a dedicated Thanos banner for Infinity Showdown.
- A single play screen with the game mode, Solo / Host friends / Join friend and the main launch button.
- Setup downloads happen automatically at launch. Manual repair commands live under Settings → Repair and diagnostics.
- Folder, mode and invitation selections are saved immediately, before launching.
- The status panel keeps the useful next action visible instead of replacing it with a generic keep-open message.

## Easier private multiplayer

- Hosts can copy an invitation such as FN42:25.1.2.3 after their server is listening.
- Friends paste the invitation into Join friend. Plain VPN/LAN addresses still work, including in JOIN.cmd.
- Known VPN adapters are listed first; duplicate addresses are removed. Choose the adapter on the network shared with your friends.
- Invitations disappear when the host session ends or fails.
- Both players still need Fortnite 4.2 and the same LAN or private VPN network. There is no public matchmaking relay or automatic VPN setup.

## Reliability fixes

- Fixed a backend-start failure that could wait forever for an already-fired process-close event.
- Setup commands now support cancellation and a bounded timeout. On Windows, cancellation stops the owned setup process and its descendants.
- CLI cancellation reaches component downloads and backend startup.
- Cancelled startup no longer reuses an already-extracted workspace.
- Invalid saved settings recover to usable defaults.
- Installation validation requires actual .pak files and accepts uppercase extensions.
- Log-write failures are handled instead of becoming unhandled stream errors.
- Exceptions in legacy asynchronous HTTP handlers return an error response instead of stopping the backend.
- Malformed XMPP messages close the affected connection without stopping login and matchmaking.
- Cloudstorage system requests cannot read paths outside the permitted .ini filenames; client-settings uploads are limited to 1 MiB.
- Profile commands accept only known profile names, rejecting path traversal and malformed query parameters before accessing profile files.
- Installer checksum generation targets the current package version, preventing accidental reuse of the previous release's executables.

## Downloads

Installer: Fortnite-Launcher-0.4.0-alpha.2-x64-nsis.exe
Portable: Fortnite-Launcher-0.4.0-alpha.2-x64-portable.exe

Windows x64, your own Fortnite 4.2 files and the Visual C++ x64 runtime are required. Node.js and Git are not required by the EXEs. First component preparation needs internet access. Verify executable hashes with SHA256SUMS.txt.

## Verification and limits

See [the QA record](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0-alpha.2/RELEASE_QA.md) for the checks actually performed. Automated host/guest routing checks are not a real two-PC match. Clean-machine installer/uninstaller testing and a real two-PC VPN playtest remain unverified.

The executables are unsigned. Infinity Showdown remains experimental, and its fixed storm can display an approximately 1439-minute cosmetic timer. The build-tool dependency tree has 15 moderate audit findings; the backend's production dependency audit reports zero. Build tools are not bundled as application runtime dependencies.

Artwork sources are recorded in [ARTWORK.md](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0-alpha.2/desktop/ARTWORK.md).

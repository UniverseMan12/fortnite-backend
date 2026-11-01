# Fortnite Launcher 0.4.0-alpha.5 — test candidate

This build is awaiting owner gameplay validation. It has not been published as a GitHub release.

- Infinity Showdown uses a contested Gauntlet instead of choosing Thanos randomly. The original Fortnite 4.2 Carmine meteor asset now starts 600 metres above the arena and uses its native projectile movement, effects and sounds. This revises a failed candidate whose trail remained near the ground; the corrected visual result still needs confirmation.
- Thanos is configured for 500 health and 200 shield, and drops the Gauntlet on death or disconnect. Pickup consumption is replicated before the world actor is removed.
- The starter kit includes a legendary SCAR and bolt-action sniper, a blue pump, minis and medkits. Respawns refill ammunition, magazines, materials and healing supplies while retaining equipment.
- Ten additional respawns, the fixed arena and restoration of the normal character after Thanos remain in place. Classic and ordinary full-island Thanos remain separate choices.
- The owner confirmed successful Hamachi multiplayer after a scoped host firewall exception. Invitations still require a working LAN/VPN; the launcher does not provide a relay or automatically configure the firewall.

The native build and rules tests pass. Gameplay validation of descent, impact, pickup disappearance and death/respawn behavior is pending. See [RELEASE_QA.md](RELEASE_QA.md) for evidence and limitations.

## Previous release: 0.4.0-alpha.4

## New: download Fortnite 4.2 in the launcher

- The main **Play** button displays **Download Fortnite 4.2** when no game folder is selected. Click it to choose the installation location; no trip to Settings is needed.
- Progress and **Cancel installation** appear beside the main controls. After download and verification, the launcher unpacks the game, automatically selects the folder containing **FortniteGame** and **Engine**, and switches the button to **Launch Fortnite** (or Host & play / Join friend).
- If the game is already installed, **Choose folder** opens a folder picker directly from Play.
- Download progress, retry/resume after interruption and cancellation are built in. Choose the same location to resume; an interrupted extraction can reuse the verified archive.
- About 32 GiB free space is required while installing. Existing folders are not overwritten. Only the actual Fortnite game subtree is extracted; the archive's extra Epic launcher installers are excluded.
- The separate, pinned 7-Zip extractor and upstream source are bundled. Game files remain a separate download; no Google login or external extraction application is needed.
- Google Drive quota/sharing failures are reported with a retry or existing-folder fallback. This feature supports 4.2 / CL-4072250 only.

Windows x64 installer and portable builds are provided below. The download is 8.3 GiB and installation needs about 32 GiB of free space. This is an experimental prerelease; v0.3.1 remains the stable version.

## Alpha.4 downloads and validation

- **Fortnite-Launcher-0.4.0-alpha.4-x64-nsis.exe** — installer.
- **Fortnite-Launcher-0.4.0-alpha.4-x64-portable.exe** — portable application.
- **SHA256SUMS.txt**, **RELEASE-NOTES.md** and **launcher-preview.png**.

45 Node tests and 13 desktop tests passed. A full-size live download/resume, SHA-256 check, extraction and build detection passed. The installed game also started the real game-server helper and stopped cleanly. Packaged download cancellation/resume and portable checks passed. See the [alpha.4 QA record](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0-alpha.4/RELEASE_QA.md). Google Drive availability/quota is external; existing-folder selection remains available. The EXEs are unsigned, and clean-machine installation/uninstallation is not fully tested.

## Previous release: 0.4.0-alpha.3

Three game modes in one Windows launcher for Fortnite 4.2: **Classic**, **Thanos** and **Infinity Showdown**. This is an experimental prerelease; v0.3.1 remains stable.

## New in alpha.3

- **Thanos** is now a separate launcher choice. It selects the existing Carmine / Infinity Gauntlet playlist on the full island, with late-game, Showdown rules and practice respawning disabled.
- A separate Fortnite × Avengers image featuring Omega and Thanos distinguishes this mode from Infinity Showdown.
- The chosen mode is saved and preselected in Reboot. Click **Start server** there; selecting the mode again is unnecessary. Joining players follow the host's rules.
- All three mode cards fit the supported window sizes. The GitHub README includes a real launcher screenshot.

## Included from earlier alpha releases

- Redesigned Play screen, original portal logo, startup animation, Season 4 banners and automatic component preparation.
- Private multiplayer invitations: hosts copy an FN42 invitation, friends paste it into Join friend. Both players still need the same LAN or private VPN.
- **Infinity Showdown:** compact fixed arena, random Thanos selection 20 seconds after landing, ten extra respawns, retained equipment and a strong starter kit. It is separate from the normal Thanos mode.
- Fixes for the Thanos-death and bus-start crashes, restored skin/body proportions, airborne respawning and the storm wall disappearing across bus departure. Early bus exit is guarded by arena readiness and countdown checks.
- Backend startup and cancellation fixes, robust saved settings, profile/cloudstorage path validation, bounded settings uploads and HTTP/XMPP error handling.

## Downloads

- **Fortnite-Launcher-0.4.0-alpha.3-x64-nsis.exe** — Windows installer.
- **Fortnite-Launcher-0.4.0-alpha.3-x64-portable.exe** — run without installing.
- **SHA256SUMS.txt** — executable checksums.
- **launcher-preview.png** — launcher screenshot.

Requires Windows x64, your own Fortnite 4.2 files and the Visual C++ x64 runtime. Node.js and Git are not required by the EXEs. First component preparation requires internet access.

## Verification and known limits

36 Node tests and 11 desktop tests passed. The native DLL passed CI compilation and rules tests. Packaged and portable startup tests passed, including starting the actual game-server helper with Thanos selected up to Reboot settings and stopping it cleanly. All 846 payload hashes were verified. The EXEs were built locally with the runtime at commit 69a9a2d; the release commit only updates release documentation. See the [QA record](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0-alpha.3/RELEASE_QA.md).

Ordinary Thanos remains experimental: a complete match including the falling gauntlet has not been verified in this update. Server startup still requires **Start server** in Reboot. Real two-PC VPN play and clean-machine installation/uninstallation remain unverified. The EXEs are unsigned. Infinity Showdown can show an approximately 1439-minute cosmetic storm timer.

The recorded backend production dependency audit has zero findings; the development build tree has 15 moderate findings. Those build tools are not bundled as runtime dependencies. [Artwork sources](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0-alpha.3/desktop/ARTWORK.md).

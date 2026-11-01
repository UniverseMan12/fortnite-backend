# Fortnite Launcher 0.4.0-alpha.3

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

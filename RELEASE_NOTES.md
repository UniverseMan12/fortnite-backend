# Fortnite Launcher 0.4.0

Regular Windows x64 release for Fortnite 4.2 / CL-4072250, including the launcher features introduced in the alpha series and the Thanos reselection fix.

## Download and play

- Download Fortnite 4.2 directly from the main **Play** button when no game folder is selected. Download progress and cancellation stay on Play.
- Downloads support resume, checksum verification and automatic extraction. The launcher automatically finds and selects the folder containing **FortniteGame** and **Engine**.
- Already installed? Use **Choose folder** on Play. The game download is about 8.3 GiB; allow about 32 GiB of free space while installing.
- Saved settings, automatic component preparation, session logs and **Stop session** are included, alongside the redesigned Season 4 launcher and artwork.

## Three game modes

- **Classic:** full-island gameplay and practice tools.
- **Thanos:** the ordinary Infinity Gauntlet playlist on the full island, with separate artwork.
- **Infinity Showdown:** a compact fixed arena, random Thanos selection, a starter kit, retained equipment and ten additional respawns per player.
- The selected mode is preselected in Reboot. Click **Start server**, then **Play** in Fortnite. The host starts the bus when everyone is on the island.

## Fixes and multiplayer

- **Thanos reselection:** after Thanos dies or disconnects, everyone waits through a shared **20-second cooldown** before the next random selection. The killer does not automatically receive the role. Every eligible player can be selected, including the previous Thanos after their respawn and landing delay. Infinity Showdown uses random assignment; it does not spawn a falling gauntlet.
- Retains fixes for Thanos-death and bus-start crashes, restored character proportions, airborne respawns, storm-wall persistence across bus departure and guarded early bus exit.
- Includes private multiplayer invitations and host/join routing. Friends use the host's VPN/LAN address and must share a LAN or private VPN such as Hamachi or Radmin VPN. The owner has reported a successful two-player Hamachi session.
- Retains fixes for backend startup/cancellation, saved settings, cloudstorage/profile validation and HTTP/XMPP error handling.

## Downloads

- **Fortnite-Launcher-0.4.0-x64-nsis.exe** — Windows installer.
- **Fortnite-Launcher-0.4.0-x64-portable.exe** — run without installing.
- **SHA256SUMS.txt**, **RELEASE-NOTES.md** and **launcher-preview.png**.

Use the new launcher on the host to apply the server fix. Windows 10/11 x64 and the Visual C++ x64 runtime are required. Node.js and Git are not needed by EXE users. Fortnite game files remain a separate download. Existing launcher settings are kept in the same per-user data directory.

## Validation and remaining limits

The pinned native server compiled successfully and passed rules tests covering the 20-second boundary, repeated cooldowns, empty selection pools and all eligible players. The preceding Alpha.4 fix passed 45 Node tests and verification of all 852 staged and packaged payload files. Release build results are recorded in [RELEASE_QA.md](https://github.com/UniverseMan12/fortnite-4-2-launcher/blob/v0.4.0/RELEASE_QA.md).

This is a regular release, not a GitHub prerelease. The new death-to-reselection behavior still needs an in-game multiplayer playtest. Ordinary Thanos gameplay remains experimental. The approximately 1439-minute Showdown storm timer is cosmetic. EXEs are unsigned; clean-machine installation/uninstallation is not fully tested. The launcher has no automatic updater or automatic firewall configuration. Game-download availability depends on the source host.

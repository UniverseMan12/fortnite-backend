# Desktop release checks — 0.3.0

## What is included

- `Fortnite-Launcher-0.3.0-x64-nsis.exe`: per-user Windows installer, with selectable install location.
- `Fortnite-Launcher-0.3.0-x64-portable.exe`: portable launcher; persistent data still lives in the user's AppData.
- `SHA256SUMS.txt`: release asset checksums.
- `RELEASE-NOTES.md`: short usage and compatibility notes.

The installer does not contain Fortnite game files, personal configuration, local profiles, logs or credentials. The backend is staged from its pinned Git revision, with the repository's patches and audited dependency lock. The game-server DLL is checked against dependencies.lock.json. The first-run workspace checks every bundled payload file before use. Login HTTP and XMPP remain bound to loopback.

## Validation performed

- 27 Node tests: game-folder/build detection; backend login/profile/XMPP; local and VPN matchmaking targets; cancellation and process cleanup; download integrity/retries; atomic server replacement; payload integrity/path traversal; first-player warmup regression.
- 6 desktop UI tests: navigation and mode selection, invalid paths/retry, isolated renderer, bounded external links, overlapping start rejection, immediate cancellation, artwork loading, reduced motion, current-page accessibility and all three pages at 940×700, 1200×820 and 1440×960. The hero description and launch button are checked for overlap.
- Packaged EXE with a fresh user-data directory: payload extraction, build detection, first-use component download, rejection of a public host IP, no renderer script errors.
- Previous 0.2.0 packaged EXE with the local Fortnite 4.2 installation: starts the real backend and game-server helper, reaches Reboot playlist settings, then stops the session through the launcher. The 0.3.0 redesign preserves that session coordinator; this real-game check was not repeated for the visual update.
- Portable EXE: self-extraction, initial UI, bundled artwork decoding, verified payload bootstrap, invalid-folder recovery and closing the application.
- The owner previously confirmed successful 4.2 island entry after the multiplayer warmup fix.

Tests cover the stated scenarios, not every possible bug. A full two-PC Hamachi match through this GUI and installation/uninstallation on a clean Windows VM have not been verified. Server-side practice tools and Thanos retain their existing compatibility limits.

## Dependency review

The backend's older packages produced seven audit findings, including one critical finding. Dependencies were updated and UUID generation moved to Node's built-in crypto API. The updated backend lock reports **zero npm audit findings** at the time of this release. The desktop application has no additional production npm dependencies; Electron's version is pinned.

The build-tool dependency tree still reports **15 moderate findings** involving minimatch and its dependents. These packages are development-only and are not included in the launcher runtime. No unsupported forced downgrade was applied. npm audit does not audit native DLL behavior and does not establish complete safety.

## Known limitations

- Windows x64 and Fortnite 4.2 only; game files and Visual C++ runtime are separate.
- Executables are unsigned; no signing certificate or publisher identity has been configured.
- First component preparation needs internet access. No automatic update service is installed.
- Multiplayer requires an existing private VPN/LAN connection and a host firewall allowing UDP 7777 from peers. No public account system, lobby parties or shared progression.
- Do not run the CMD launcher and GUI launcher simultaneously: they use the same fixed local ports. Conflicts are shown as errors, without stopping unrelated services.
- Closing or stopping the launcher ends its own game session. Runtime data is retained across uninstall/reinstall.

## Reproduce and publish

On Windows with Node.js 22+ and Git:

```powershell
npm ci
npm run setup
npm run package:release
node scripts/smoke-release.mjs
node scripts/smoke-portable.mjs
node scripts/release-files.mjs
```

Upload the two EXEs, SHA256SUMS.txt and RELEASE-NOTES.md from `dist/` to a GitHub release. Do not upload runtime/, vendor/, personal config, logs, or the unpacked development folder. The GitHub **Build desktop launcher** workflow performs the same build and publishes a downloadable artifact; it does not automatically publish a GitHub release.

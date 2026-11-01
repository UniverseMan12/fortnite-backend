# Desktop release checks

## 0.4.0-alpha.1 — Infinity Showdown, November 1, 2026

The release target is the experimental **v0.4.0-alpha.1** prerelease. The stable public release remains **v0.3.1**. The development branch has not been merged into `main`.

### Server provenance

- Native source: `bda98ce772651b219476e04e934d9397effe9fe1` on `codex/infinity-showdown`.
- [Native build 41255821532](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41255821532): successful compilation and native rules tests, including solo fallback, multiplayer preference and guarded bus exit.
- Artifact: `13063331595`, `launcher-server`.
- Archive SHA-256: `9b0ba9544f82e78e207f637b72fe0a9bf6efa2ac24946f354dabde23a44d1ac0`, verified against GitHub artifact metadata before updating the dependency manifest.
- DLL SHA-256: `5c898810f41344de82d5911c3249d2c84decbac4df6605b83ca305218328fa67`, verified against the artifact's `reboot.sha256`.
- The previous installed DLL hash is retained in `previousGameServerSha256s` so setup can safely replace it.

### Current validation

Both alpha EXEs were rebuilt with the final `bda98ce` DLL after the confirmed zone playtest. Packaged and portable smoke tests passed again on those final outputs. Historical gameplay observations below name their tested DLL explicitly.

- `npm run setup`: passed; installed the new pinned DLL.
- `npm test`: **28 passed**, run before starting Fortnite.
- `npm run test:desktop`: **7 passed**.
- `npm run stage:release`: staged 845 verified payload files. The staged and unpacked DLL hashes match the new pin.
- `electron-builder --win nsis portable --x64 --publish never`: rebuilt both alpha EXEs successfully with the new pin.
- Packaged launcher smoke test with Infinity Showdown selected: passed fresh-profile extraction, build detection, first-use preparation, public-host rejection and renderer-error checks.
- Portable smoke test: passed self-extraction, initial UI/artwork, payload bootstrap, invalid-folder recovery and closing the application.
- All 845 packaged payload file hashes were checked. Bundled backend profile templates match the pinned public source apart from Windows newlines; no private configuration, session data, logs or Fortnite game files were staged.
- `dist/SHA256SUMS.txt` and `dist/RELEASE-NOTES.md` are generated from the final EXEs and the repository's complete release notes before upload. The alpha notes link to this branch's QA record.
- An isolated manual playtest of the earlier `7fa0949` DLL reached the island and the first successful Thanos transformation. Its loaded module hash was verified. After Thanos death, the tester's screenshot showed the original skin skydiving with 100 health, 100 shield, restored weapons/consumables and retained materials. The server log recorded gadget removal and new possession without a crash.
- Solo reassignment succeeded in that same session: the native log records initial gadget application at 00:34:49, removal/new possession at 00:35:29 and successful application again at 00:36:09 (Europe/Zurich). The 20-second landing threshold is verified by native rules tests; the manual observation was not a frame-accurate timing measurement.
- Follow-up appearance fix in `92773e4`: restores original body type, gender, all six part slots and animation override. The tester confirmed normal body proportions after Thanos death; the earlier skin-visibility result alone did not establish correct proportions.
- Follow-up bus fix in `92773e4`: uses the native `StartsWithAirCraft` zone startup and a guarded native jump path. Bus startup and the subsequent Thanos death completed without a crash, but the tester reported a missing storm wall with only the white minimap circle. This candidate is not ready for publication. Native assertions cover missing arena/configuration, non-passengers, the drop-start boundary, invalid time and end-of-route ejection.
- Zone lifecycle repair in `bda98ce`: completes native initialization once after Aircraft, with a valid indicator, and repairs native resets of the fixed geometry, timestamps and preview pause state. Native rules cover both lifecycle stages and preserving the captured radius. The final solo playtest used the verified DLL hash listed above. The tester confirmed the blue storm wall both before and after leaving the bus. Native logs recorded stage 1 at 01:21:17 and stage 2 at 01:21:34 (Europe/Zurich), with a 15000 cm radius in both stages. Read-only diagnostics after the transition showed the same game-state/mode indicator, active zone, paused mode progression, unpaused indicator/preview, all four radii at 15000 cm and matching fixed timestamps. A screenshot showed the purple storm and safe area on the minimap. Repeated early jump input was not separately measured manually; the countdown boundaries are covered by native assertions.
- Rejected intermediate build `ba9e4e4`: the bus-start playtest crashed before zone creation (access violation reading the indicator's `NextCenter` at null + `0x348`). It is excluded from publication. The pinned DLL removes the premature direct phase call and refuses phase initialization without an indicator.
- Multiplayer preference is covered by native rules tests; a real two-player match has not been performed.
- The repository was renamed to `UniverseMan12/fortnite-4-2-launcher`. The old URL redirects correctly, the pinned native artifact downloads under the new name with the same verified digest, and `main` remains at `fd5384cfc8da2fc327e448ed77f84c8687835515`.

The installer and portable build are unsigned alpha artifacts. Clean-machine installation/uninstallation remains untested. The storm HUD still has the approximately 1439-minute cosmetic timer. See [INFINITY_SHOWDOWN.md](INFINITY_SHOWDOWN.md) for game behavior and limits.

## Historical stable release — 0.3.1

## What is included

- `Fortnite-Launcher-0.3.1-x64-nsis.exe`: per-user Windows installer, with selectable install location.
- `Fortnite-Launcher-0.3.1-x64-portable.exe`: portable launcher; persistent data still lives in the user's AppData.
- `SHA256SUMS.txt`: release asset checksums.
- `RELEASE-NOTES.md`: short usage and compatibility notes.

The installer does not contain Fortnite game files, personal configuration, local profiles, logs or credentials. The backend is staged from its pinned Git revision, with the repository's patches and audited dependency lock. The game-server DLL is checked against dependencies.lock.json. The first-run workspace checks every bundled payload file before use. Login HTTP and XMPP remain bound to loopback.

## Validation performed

- 27 Node tests: game-folder/build detection; backend login/profile/XMPP; local and VPN matchmaking targets; cancellation and process cleanup; download integrity/retries; atomic server replacement; payload integrity/path traversal; first-player warmup regression.
- 6 desktop UI tests: navigation and mode selection, invalid paths/retry, isolated renderer, bounded external links, overlapping start rejection, immediate cancellation, artwork loading, reduced motion, current-page accessibility and all three pages at 940×700, 1200×820 and 1440×960. The hero description and launch button are checked for overlap.
- Packaged EXE with a fresh user-data directory: payload extraction, build detection, first-use component download, rejection of a public host IP, no renderer script errors.
- Previous 0.2.0 packaged EXE with the local Fortnite 4.2 installation: starts the real backend and game-server helper, reaches Reboot playlist settings, then stops the session through the launcher. The 0.3.1 redesign preserves that session coordinator; this real-game check was not repeated for the visual update.
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

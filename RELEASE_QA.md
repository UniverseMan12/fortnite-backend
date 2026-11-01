# Desktop release checks

## Unreleased — Gauntlet redesign candidate

- The owner confirmed two-PC Hamachi joining after a narrowly scoped host firewall exception. The invitation still requires an existing LAN/VPN connection; no relay service was added.
- Candidate `ab8f455` compiled and passed native rules tests. The owner confirmed transformation, but reported no meteor animation/impact sound and a pickup model remaining after use. That candidate is not release-ready.
- Revision `fad9dd7` replaces the simulated pickup descent with the existing Fortnite 4.2 Carmine meteor blueprint and replicates the consumed pickup state before delayed destruction. Its landing callback supplies one tracked collectible; duplicate loot callbacks are suppressed. Ordinary Thanos and Classic keep their existing supply-drop handling.
- After correcting SDK type errors, [native build 41321386196](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41321386196) passed compilation and rules tests at `d396aa5a40b193b60b464e7a160264a109b27514`. Artifact `13088923237` matched GitHub's archive SHA-256 `b593a286fd6053399a18c8171f89829f5c3a8be083c7a4a881a77c332014d14b`; the DLL matched its bundled checksum `3f4ab5250bf4539657f2e8de014949939f2e353b1c1e82dd0f03d7656e01c03e` before pinning.
- **45 Node tests and 13 desktop tests passed** on November 1, 2026. Native patches applied successfully twice to the pinned upstream test checkout. These checks do not validate rendered meteor effects or pickup disappearance.
- In-game confirmation of the revised meteor, impact sound, pickup disappearance, 500/200 Thanos stats and death/respawn refill is still pending. Alpha.5 version preparation is local; no new GitHub release has been published.

## 0.4.0-alpha.4 — download directly from Play (prerelease)

- The owner's public Google Drive archive was retrieved without signing in: `4.20-CL-4072250.7z`, **8,946,548,760 bytes**, SHA-256 `d89a92ed1e4038627aa8bf0c0985c7eb16eab033a194c0f66c38f90285c8de4c`. The manifest selects **24,091,769,351 bytes** of game content; extra Epic launcher/redistributable folders are excluded.
- A full-size installer test resumed the final MiB from the real Drive endpoint, hashed the complete archive, extracted the game, validated every selected file's type/size and detected **4.2 / CL-4072250** before moving the finished folder into place. The archive cache was removed after success.
- Regression coverage includes Range resume, servers ignoring Range, dropped connections, cancellation, wrong ranges, HTML/quota pages, hash mismatch, hard-linked caches, unsafe/duplicate archive paths, links, wrong game builds, insufficient space, extractor cancellation, retry after cancellation and preserving existing folders.
- **45 Node tests passed** in the final combined run.
- **13 desktop tests passed**, including the main Play download button, native folder picker, cancellation, choosing an existing installation from Play, bounded download IPC, progress display and automatic installed-folder feedback. The progress and cancel controls were checked at the minimum 940×700 window size and visually inspected.
- The actual packaged EXE passed a live Drive download/cancel/resume check with a fresh profile. It retained partial bytes across retries and did not select an unfinished game folder. The temporary smoke-test cache was removed afterwards.
- Installer and portable EXEs were rebuilt successfully. The portable test passed self-extraction, UI/artwork loading, verified payload preparation, invalid-folder recovery and clean close. Current-version checksums are generated in `dist/SHA256SUMS.txt`.
- A separate packaged startup test launched the actual game-server helper from the newly downloaded installation up to Reboot settings, then stopped it cleanly. Original game settings were restored and no Fortnite processes remained.
- All **852 staged and unpacked payload hashes** passed, including the native server pin, extractor/source pins and public backend profile templates. No game binaries were included in the launcher payload.
- The first combined Node run overlapped the real-game smoke test; the existing display-repair guard correctly rejected that test while Fortnite was running. The combined suite was rerun after game shutdown.
- Google Drive availability/quota remains external. Slow-drive/low-space scenarios, abrupt power loss and a clean-machine installer/uninstaller run are not fully exercised; automated tests cover the stated cancellation and validation paths. Alpha.4 is an experimental prerelease; stable 0.3.1 remains separate.

## 0.4.0-alpha.3 — ordinary Thanos mode (prerelease)

- Added a third launcher selection for the existing Carmine / Infinity Gauntlet playlist. The native preset disables Infinity Showdown, late-game and practice respawning; it does not apply Showdown's arena, starter kit or respawn rules.
- **36 Node tests passed**, including saved Thanos settings and worker routing for solo, host and joining sessions. **11 desktop tests passed**, including distinct artwork, saved mode selection, host-controlled join rules and the three cards at supported window sizes. Thanos screenshots at 940×700 and 1200×820 were visually inspected.
- Applying the native patch twice to an existing pinned-source test checkout left `gui.h` unchanged on the second run. The CI job also applies the patches to a fresh pinned upstream checkout.
- [Native build 41308510309](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41308510309) passed compilation and native rules tests from `9004ee1cde9920d88f6b06e1ecbedc86bd2c2ed0`. Artifact `13084366928` matched the GitHub archive digest `3a8f0b19fb3be8076d5de7a45e3b2a59a718b3cf98ef63df12bb35923fcdb94f`; DLL digest `7b825bfa081151b58db35414e835b9c92fa296e192f934dbe500fb099b1faf9a` matched its bundled checksum and is pinned in `dependencies.lock.json`.
- All 846 staged and unpacked payload hashes passed, including the new native pin and the public profile-template checks.
- The packaged EXE passed fresh-profile preparation and started the actual game-server helper with Thanos selected up to Reboot settings, then stopped it cleanly. No Fortnite processes remained; original game settings were restored.
- Installer and portable EXEs were rebuilt locally with the verified native DLL. The portable smoke test passed self-extraction, the Thanos mode card and its bundled artwork, payload preparation, invalid-folder recovery and clean close. Checksums are generated in `dist/SHA256SUMS.txt`. The release uses these tested artifacts, with runtime source at `69a9a2d`; the publication commit only updates release documentation. Every uploaded asset is checked against its local size and SHA-256 digest before publication.
- The actual launcher screenshot is committed at `docs/launcher-preview.png` and included in the README. A documentation-only commit on `main` adds the screenshot and clearly distinguishes the upcoming preview from the published alpha.2 and stable 0.3.1 releases; no experimental runtime code was merged into `main`.
- A complete ordinary Thanos match, including the falling gauntlet, has not been played during this update. Automatic server startup is not part of this change: Reboot opens with the requested mode selected and still waits for **Start server**.

## 0.4.0-alpha.2 — launcher redesign and runtime audit

This prerelease is developed on `codex/launcher-redesign`. The alpha.1 release and stable `main` have not been replaced. The native game-server DLL remains the verified `bda98ce` build documented below. Release assets are built locally on Windows from this branch; the release body records the exact committed source.

- Reviewed desktop IPC, startup/state handling, saved settings, worker coordination, local backend startup, HTTP/XMPP handling, cloudstorage, setup/download integrity, game-folder detection and native process ownership/cleanup code.
- **34 Node tests passed** in the final combined suite, including backend spawn failure, host/guest invitation routing, cancellation, file validation, setup-command failures/timeouts and terminating the owned Windows setup process tree.
- 10 desktop tests passed: persisted setup/invitations across restart, error recovery, overlapping starts, cancellation, next-step guidance, expired invitations, reduced motion, startup completion, renderer isolation and the three pages at 940×700, 1200×820 and 1440×960. Classic screenshots at 940×700 and 1200×820 were visually inspected.
- Backend protocol regression tests passed after injecting a failing asynchronous profile command, a traversal-shaped cloudstorage request, an oversized settings upload and a malformed authenticated XMPP message. Profile commands also reject traversal, unknown names, arrays and nested query objects. Health and matchmaking remained available afterwards.
- Production backend dependency audit: **0 findings**. Development build tree: **15 moderate findings**, all through minimatch and its dependents. npm suggests an incompatible electron-builder downgrade; it was not applied. These development packages are not shipped in the runtime.
- Season 4 image sources and the original logo are documented in `desktop/ARTWORK.md`.
- Final staged and unpacked payloads passed all **846 file hashes**, the pinned DLL check, public profile-template comparisons and private-file exclusions.
- The rebuilt packaged EXE passed fresh-profile extraction, build detection, first-use preparation, public-host rejection and renderer-error checks with Infinity Showdown selected. It also started the actual Fortnite game-server helper up to Reboot playlist selection and stopped it cleanly. No Fortnite processes remained, and the user's original game settings were restored.
- Both final alpha.2 EXEs were rebuilt successfully. The portable EXE passed self-extraction, artwork loading, verified payload bootstrap, invalid-folder recovery and closing the application. Checksums and the release-note asset are generated from these final outputs before upload; each uploaded asset's size and SHA-256 digest are verified before publication.
- Native gameplay changes were not made in this redesign. Real two-PC VPN play and clean-machine installation/uninstallation remain unverified. Setup cancellation terminates owned processes, but interruption of a fresh source/CMD Git clone may leave a partial vendor checkout requiring manual recovery; the EXE uses its bundled backend.

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

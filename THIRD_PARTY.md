# Sources and third-party components

Research and local setup: October 31, 2026.

| Component | Source | Pinned revision / license |
| --- | --- | --- |
| Login, profiles, CloudStorage, XMPP, matchmaker | [Lawin0129/LawinServer](https://github.com/Lawin0129/LawinServer) | Commit `36385a150d786561acdd056651b3b15a11280bf3`, GPL-3.0 according to upstream |
| Startup sequence and DLL references | [Auties00/Reboot-Launcher](https://github.com/Auties00/Reboot-Launcher) | Commit `c6f82298b167ef2076bb59dc621f13dc5bd8d390`; consult each upstream component's license terms |
| Game server | [Milxnor/Project-Reboot-3.0](https://github.com/Milxnor/Project-Reboot-3.0) | Build commit `10c659028ad9d6816f78226483f11a884bf81f57`, BSD-3-Clause according to upstream |
| Game archive extraction | [7-Zip 26.05](https://github.com/ip7z/7zip/releases/tag/26.05), reduced standalone `7zr.exe` | The executable identifies itself as Public domain, Igor Pavlov. Unmodified official binary, complete upstream source archive and notice are included under `runtime/7zip`. Their SHA-256 digests are pinned in `game-download.json`. |

DLLs are not committed to the repository. Download locations and checksums are recorded in `dependencies.lock.json`. The customized Reboot DLL is built as a GitHub Actions artifact from the pinned upstream source plus `scripts/patch-reboot.js`, `scripts/patch-local-tools.js` and `server/`; its archive includes the upstream BSD-3-Clause license. The patches add manual startup, playlist selection and local practice tools. UI actions are queued onto the game's network tick; practice death handling keeps the local round open. Checksums identify the pinned files; they do not establish general safety or compatibility with every game build.

## Technical references

- [LawinServer README](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/README.md): The backend provides web services and requires a separate client-request redirect.
- [Reboot startup sequence](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/gui/lib/src/button/game_start_button.dart): Load the auth component at startup, then the console or game server after login completes.
- [Reboot component sources](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/common/lib/src/game/game_downloader.dart): Sinum, Console, Memory and the Reboot artifact.
- [DefaultInput.ini](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/CloudStorage/DefaultInput.ini): F8 is configured as a console key.
- [Project Reboot README](https://github.com/Milxnor/Project-Reboot-3.0): The game server is separate and must be tested with the specific Fortnite build.

All local LawinServer adaptations are visible in `scripts/patch-backend.js`: loopback binding, a health endpoint, method/path logging without authentication headers, and a failing exit status when startup fails. These changes do not overwrite user profiles. This project adds a launcher around the upstream server; the original authors retain credit for their components.

The desktop release includes the modified LawinServer JavaScript source, its GPL-3.0 license, and its dependency sources/licenses. `scripts/backend-dependencies/` pins updated dependencies; UUID generation uses Node's `crypto.randomUUID`. The complete adaptations and build scripts are in this repository. The Reboot binary is accompanied by its BSD-3-Clause license; the pinned upstream revision and all local modifications are available above and in the repository. Sinum, Console and Memory are downloaded from their pinned upstream locations on first use rather than included in the EXE payload.

The desktop shell uses Electron 45.2.1 (MIT and included Chromium/third-party notices). electron-builder and Playwright are development/build tools; they are not bundled into the runtime application. The geometric launcher icon is original vector/code artwork. Promotional-image sources are documented in `desktop/ARTWORK.md`. Fortnite game binaries are downloaded separately from the owner's supplied link; they are not included in the release EXEs. `game-download.json` records the inspected archive size, SHA-256 and supported build. The installer does not execute bundled redistributable or Epic launcher installers from that archive.

# Sources and third-party components

Research and local setup: October 31, 2026.

| Component | Source | Pinned revision / license |
| --- | --- | --- |
| Login, profiles, CloudStorage, XMPP, matchmaker | [Lawin0129/LawinServer](https://github.com/Lawin0129/LawinServer) | Commit `36385a150d786561acdd056651b3b15a11280bf3`, GPL-3.0 according to upstream |
| Startup sequence and DLL references | [Auties00/Reboot-Launcher](https://github.com/Auties00/Reboot-Launcher) | Commit `c6f82298b167ef2076bb59dc621f13dc5bd8d390`; consult each upstream component's license terms |
| Game server | [Milxnor/Project-Reboot-3.0](https://github.com/Milxnor/Project-Reboot-3.0) | Build commit `10c659028ad9d6816f78226483f11a884bf81f57`, BSD-3-Clause according to upstream |

DLLs are not redistributed in this repository. Download locations and checksums are recorded in `dependencies.lock.json`. Checksums identify the pinned files; they do not establish general safety or compatibility with every game build.

## Technical references

- [LawinServer README](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/README.md): The backend provides web services and requires a separate client-request redirect.
- [Reboot startup sequence](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/gui/lib/src/button/game_start_button.dart): Load the auth component at startup, then the console or game server after login completes.
- [Reboot component sources](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/common/lib/src/game/game_downloader.dart): Sinum, Console, Memory and the Reboot artifact.
- [DefaultInput.ini](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/CloudStorage/DefaultInput.ini): F8 is configured as a console key.
- [Project Reboot README](https://github.com/Milxnor/Project-Reboot-3.0): The game server is separate and must be tested with the specific Fortnite build.

All local LawinServer adaptations are visible in `scripts/patch-backend.js`: loopback binding, a health endpoint, method/path logging without authentication headers, and a failing exit status when startup fails. These changes do not overwrite user profiles. This project adds a launcher around the upstream server; the original authors retain credit for their components.

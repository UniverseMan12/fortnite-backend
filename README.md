# Fortnite Backend

A launcher for a local Fortnite legacy setup, using **LawinServer** and components from **Project Reboot**.

## Start

1. Open **START.cmd**.
2. Paste the folder containing **FortniteGame** and **Engine**, then press **Enter**.
3. In **Project Reboot**, choose **Solo** or **Thanos (experimental)** and click **Start server**. There is no countdown.
4. Wait for Fortnite to open, then press **Play** in the lobby. Keep the launcher and Reboot windows open.

The command prompt asks only for the folder, without showing a saved personal path. Green checkmarks mean a step completed, yellow dots mean startup is in progress, and red crosses indicate errors. The launcher detects the build, prepares components and opens Fortnite after you start the host. Press **Ctrl+C** in the launcher to stop the session.

The host runs a separate Fortnite process. Its unused Unreal game window is hidden. Reboot's playlist selection remains open until you click **Start server**, even if you take several minutes. Restart the launcher to change the playlist after the server has started.

**Thanos is experimental:** the preset selects the Carmine playlist and checks that the asset exists. It does not guarantee that the Infinity Gauntlet, abilities or complete match rules work in this server implementation.

```text
Folder you select/
├── Engine/
└── FortniteGame/
    ├── Binaries/Win64/FortniteClient-Win64-Shipping.exe
    └── Content/Paks/*.pak
```

Selecting either subfolder also works: the launcher finds the common parent automatically. No Epic credentials or player-name entry are needed.

**Compatibility:** Automatic startup is currently limited to Fortnite **4.2**. Login, the lobby and F8 were tested with **CL-4072250**. A playable local match has **not yet been verified end to end**. A listening host port alone does not prove a match is ready. This launcher does not support every Fortnite version.

## Requirements

Windows x64, [Node.js 22 or newer](https://nodejs.org/), [Git](https://git-scm.com/downloads/win) for first-time setup, and your own complete Fortnite 4.2 installation. No game files are included.

First-time setup needs internet and may take a few minutes. Pinned components are downloaded automatically and DLL hashes are checked. Later starts reuse them. The host and client run as two game processes, so allow enough RAM for both. Local matches do not automatically contain other players or bots.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Missing FortniteGame or Engine | Select the folder containing both folders. |
| Version cannot be detected or is unsupported | Use a complete 4.2 installation. Detection reads the EXE, not the folder name. |
| Node.js is missing | Install Node.js 22 or newer and reopen START.cmd. |
| Port 80, 3551 or 7777 is occupied | Close your other backend or host instance. Unrelated services are not stopped automatically. |
| Setup fails | Read logs/setup.log and the error shown in the launcher. |
| Server does not start | Read logs/server-helper.log. The client will not open if host startup fails. |
| Fortnite does not open | Read logs/client-helper.log and logs/backend.log. |
| Play returns to the lobby | Check the Reboot window for Joinable: true. Hosting is still unverified; an open port is not a guarantee of gameplay. |
| A download has expired | Review a replacement build and update dependencies.lock.json with its checksum. |

If the host shows **Joinable: true**, you can also press **F8** in Fortnite and enter **open 127.0.0.1:7777**. This connects to the existing host; it cannot start a missing server. If Medal also uses F8, its clip notification may appear.

Detailed output is saved in logs/ instead of filling the launcher. Game-log paths are recorded in the helper logs; Fortnite 4.2 normally writes to %LOCALAPPDATA%\FortniteGame\Saved\Logs.

## Developer commands

```powershell
npm start                  # Launcher
node src/cli.js --check     # Check a selected folder without starting services
node src/cli.js --help      # Short help
npm run doctor             # Check saved installation and DLL hashes
npm run setup              # Install components with detailed output
npm run backend            # Backend only; Ctrl+C stops it
npm test                   # Validation, startup coordination and backend tests
```

Settings are stored in config.local.json. The player name defaults to Player; an existing valid name is preserved. Build identification uses embedded release strings rather than a manually entered version.

The coordinator waits for backend HTTP/XMPP readiness, the user's Start server action, and then UDP port 7777 owned by its host process. Private per-session marker files connect the Reboot settings UI to the launcher. There is no timeout while choosing a playlist; login and server startup still have time limits. It closes its processes on startup failure, client exit or Ctrl+C. Automated orchestration tests cover readiness, failure and cancellation.

HTTP backend: http://127.0.0.1:3551. XMPP/matchmaker: 127.0.0.1:80. Game target: 127.0.0.1:7777 over UDP. HTTP and XMPP bind to loopback. In the 4.2 test, Reboot listened on 0.0.0.0:7777 despite -MULTIHOME=127.0.0.1, so the host's network binding is not restricted to loopback. No firewall rules, hosts-file entries or system certificates are changed.

The launcher loads Reboot components into its own game processes. Windows job objects close those game and companion processes when their helper exits. Existing game EXEs are not patched or replaced. Legacy companion processes remain suspended.

LawinServer V1 is a local single-user emulator with shared profile data, not a public multi-user platform. Items, levels and V-Bucks are local test data.

## Project files

- src/: launcher, validation and process management.
- scripts/: setup, backend adaptations and Windows game startup.
- tests/: installation, orchestration and backend integration checks.
- dependencies.lock.json: pinned sources and DLL hashes.
- [THIRD_PARTY.md](THIRD_PARTY.md): upstream sources, licenses and references.

vendor/, runtime/, logs/, data/, personal settings and game files are excluded from GitHub. Backend profiles remain in vendor/LawinServer or %LOCALAPPDATA%\LawinServer. Upstream licenses remain in downloaded source.

## Contributors and credits

- **[UniverseMan12](https://github.com/UniverseMan12)** — project owner, requirements and local testing.
- **OpenAI Codex (AI assistant)** — assisted implementation, debugging, tests.
- **LawinServer and Project Reboot contributors** — upstream backend, game server and runtime components. See [THIRD_PARTY.md](THIRD_PARTY.md).

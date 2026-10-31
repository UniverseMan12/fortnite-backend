# Fortnite Backend

An Windows launcher for a local Fortnite legacy setup. It uses **LawinServer** for the backend and components from the **Project Reboot ecosystem** for the game server and console.

## Start here

1. Double-click **`START.cmd`** in this project folder.
2. At **Fortnite version**, type `4.2` and press **Enter**. If `[4.2]` is already shown, just press Enter.
3. At **Folder containing FortniteGame AND Engine**, paste the folder where you can see **both** folders side by side. Do not select either subfolder or the EXE. Press Enter if the suggested path is correct.
4. At **Local player name**, enter a name such as `Player`. Use 3-24 letters, numbers, underscores or hyphens. No Epic email address or password is needed.
5. Wait for **Backend ready**, then type **`2`** and press **Enter** to try a local match. This starts the host and your Fortnite client.
6. Keep the startup window open. Wait for the separate **Reboot** window to show **`Joinable: true`**.
7. In the **Fortnite lobby**, press **F8**, type the following in the small **in-game console**, and press **Enter**:

```text
open 127.0.0.1:7777
```

**Do not type that command in the startup window.** F8 opens the console; the command connects to an existing host. Neither creates a game server. Without a ready host, Play or this command may show a loading screen and return you to the lobby.

Type **`H`** at the startup menu to read the instructions again. Type **`0`** there, or press **Ctrl+C**, to stop the session.

**Current limitation:** Login, lobby and F8 have been tested with Fortnite **4.2, CL-4072250**. Joining a local match has **not** yet been verified end to end. The development environment's automatic execution review blocked the separate game server test launch. If Reboot closes or never reaches `Joinable: true`, check the startup error and the troubleshooting section below.

## Which menu option should I choose?

| Option | What it does | When to use it |
| --- | --- | --- |
| **1** | Opens the Fortnite lobby only | Browse the lobby and locker. No game server starts. |
| **2** | Starts a local game server and Fortnite | Choose this to try a local match. |
| **3** | Starts only the game server | Advanced hosting; no playable client opens. |
| **4** | Keeps only the backend running | Run the service without launching the game. |
| **H** | Displays the instructions again | Read the setup and join steps. |
| **0** | Stops the session and exits | Finish playing or restart with a different option. |

If you chose option 1 and now want a match, close Fortnite, wait for its exit message, then choose option 2. If a session is still running, choose 0, reopen `START.cmd`, and choose 2 after setup.

## Requirements and installation folder

You need Windows x64, [Node.js 22 or newer](https://nodejs.org/), [Git](https://git-scm.com/downloads/win) for initial setup, and your own complete Fortnite installation. This repository includes no Fortnite game files.

```text
Folder you select/
├── Engine/
└── FortniteGame/
    ├── Binaries/Win64/FortniteClient-Win64-Shipping.exe
    └── Content/Paks/*.pak
```

For example, if both folders are inside `Downloads\4.2-CL-4072250\Fortnite\Fortnite`, select that final `Fortnite` folder. Your selection is saved in `config.local.json`. Values in `[brackets]` are suggestions: press Enter to keep them or type a replacement.

First-time setup needs an internet connection and may take a few minutes. It downloads pinned third-party components and checks their DLL SHA-256 hashes. Later starts reuse installed components.

Option 2 runs two game processes and needs more RAM than lobby-only mode. Local matches do not automatically include other players or bots or connect to official Epic matchmaking. If Medal also uses F8, a clip notification may appear; the game console still opened during the local test.

## Verified behavior

The following checks passed with Fortnite 4.2, CL-4072250:

- Installation validation for both folders, the x64 Shipping EXE and Pak files.
- Actual game startup, local login and a visible Season 4 lobby.
- F8 opens the in-game console.
- Automated checks for OAuth responses, Athena profiles, service status, the F8 hotfix, matchmaking destination, XMPP and occupied-port errors.

The separate Reboot game server is integrated, but successful backend responses do not prove that a match is playable. Other Fortnite versions have not been tested.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Missing `FortniteGame` or `Engine` | Go up to their common parent folder and enter that path. |
| Node.js is missing | Install Node.js 22 or newer, close the window, then reopen `START.cmd`. |
| Port 80 or 3551 is already in use | Close another backend instance or the service using that port. The launcher does not stop unrelated services. |
| Play loads, then returns to the lobby | Choose option 2 and wait for `Joinable: true`. A timeout to `127.0.0.1:7777` means the host did not respond. |
| F8 opens, but joining fails | Check the Reboot host and port 7777. The command cannot start a missing host. |
| Reboot never becomes ready | Read the startup error. Match hosting remains unverified; repeatedly pressing Play will not fix a failed host. |
| Login gets stuck | Check `logs/backend.log` and the game log printed in the startup window. Fortnite 4.2 normally writes logs to `%LOCALAPPDATA%\FortniteGame\Saved\Logs`. |
| A download has expired | GitHub Actions artifacts can expire. `dependencies.lock.json` records the source commit and checksum. Review a replacement build and update its checksum explicitly. |
| A DLL is missing or its checksum is wrong | Startup stops instead of loading it. No antivirus exclusions or security-setting changes are created. |

## Developer commands

```powershell
npm run setup          # Install dependencies and apply local adaptations
npm start              # Start the interactive launcher
node src/cli.js --help  # Read instructions without starting services
npm run doctor         # Check installation path and DLL hashes
npm run backend        # Start only the backend; Ctrl+C stops it
npm test               # Run tests with isolated backend profiles
```

HTTP backend: `http://127.0.0.1:3551`. XMPP/matchmaker: `127.0.0.1:80`. Game server target: `127.0.0.1:7777` over UDP. HTTP and XMPP bind to loopback only. The host receives `-MULTIHOME=127.0.0.1`; its actual UDP binding still needs testing. No firewall rules, hosts-file entries or system certificates are changed.

The launcher loads Reboot components into its own game processes. Windows job objects close those game and companion processes when their helper exits. Existing game EXEs are not patched or replaced. The legacy companion processes are created and remain suspended.

LawinServer V1 is a local single-user emulator with shared profile data, not a secure public multi-user platform. V-Bucks, items and levels shown by the backend are local test data.

## Project files

- `src/`: launcher, validation and process management.
- `scripts/`: setup, local LawinServer adaptations and Windows game startup.
- `tests/`: installation validation and backend integration tests.
- `dependencies.lock.json`: pinned sources and DLL hashes.
- `THIRD_PARTY.md`: upstream sources, licenses and technical references.

`vendor/`, `runtime/`, `logs/`, `data/`, personal settings and game files are excluded from GitHub. Backend profiles and settings remain in `vendor/LawinServer` or `%LOCALAPPDATA%\LawinServer`. Upstream licenses remain in the downloaded source.

## Contributors and credits

- **[UniverseMan12](https://github.com/UniverseMan12)** - project owner, requirements and local testing.
- **OpenAI Codex (AI assistant)** - assisted implementation, debugging, tests and English documentation. This is an AI assistance credit, not a separate GitHub collaborator account.
- **LawinServer and Project Reboot contributors** - upstream backend, game server and runtime components. See [THIRD_PARTY.md](THIRD_PARTY.md) for attribution and licenses.

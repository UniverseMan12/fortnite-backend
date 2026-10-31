import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { ROOT, readConfig, saveConfig, validateInstall } from './config.js';
import { setup, verifyDll } from '../scripts/setup.js';
import { startBackend } from './backend.js';

const helpers = new Set();
let backend, stopping = false, rl;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const helper of helpers) helper.kill(); // Windows job closes with helper: only our game processes are terminated.
  await backend?.stop();
  rl?.close();
}
process.once('SIGINT', async () => { await stop(); process.exit(0); });
process.once('SIGTERM', async () => { await stop(); process.exit(0); });
function game(mode) {
  const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'launch-game.ps1'), '-Mode', mode], {
    cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  helpers.add(helper);
  helper.stdout.on('data', data => process.stdout.write(data));
  helper.stderr.on('data', data => process.stderr.write(data));
  helper.once('error', error => console.error(`Could not start the game: ${error.message}`));
  helper.once('close', code => { helpers.delete(helper); console.log(`\n${mode === 'server' ? 'Game server' : 'Fortnite'} exited (code ${code}).`); });
  return helper;
}
function showHelp() {
  console.log(`
  HOW TO START
  1. Enter your Fortnite version, for example 4.2.
  2. Paste the folder containing BOTH FortniteGame and Engine.
     Do not select FortniteGame, Engine, or the game EXE itself.
  3. Choose a local player name (3-24 letters, numbers, _ or -).
     You do not need an Epic email address or password.
  4. When the menu appears, type 2 and press Enter for a local match.
     Option 1 starts the lobby only; it does not start a game server.

  HOW TO JOIN
  5. Keep this window open. Wait for the separate Reboot window
     to show "Joinable: true" before trying to join.
  6. In the Fortnite lobby, press F8 to open the small console.
  7. Type this command in the GAME console, then press Enter:

     open 127.0.0.1:7777

  F8 opens the console. The command connects to a running host.
  Neither starts a game server.
  Without a ready host, Play and the command can return you to the lobby.
  If the host closes or never shows "Joinable: true", check the error
  in this window. See README.md for log locations and troubleshooting.

  STATUS: Login, lobby and F8 were tested with Fortnite 4.2.
  Joining a local match has NOT yet been verified end to end.
  Local matches do not automatically include other players or bots.

  Press Enter to accept any value shown in [brackets].
  To stop everything, type 0 at the menu or press Ctrl+C here.
`);
}
const menu = '\n1  Open Fortnite lobby only\n2  Start local match host + Fortnite (choose this to try a match)\n3  Start game server only (advanced)\n4  Keep backend running only\nH  Show step-by-step help again\n0  Stop everything and exit\n';
async function main() {
  console.log('\n  FORTNITE BACKEND - LOCAL\n  Login, lobby and private game server\n');
  if (process.argv.includes('--help') || process.argv.includes('-h')) { showHelp(); return; }
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.');
  if (process.argv.includes('--doctor')) {
    const config = readConfig(); console.log('Version:', config.version);
    console.log('Installation:', validateInstall(config.gamePath).root);
    for (const name of ['sinum.dll', 'console.dll', 'memory.dll', 'reboot.dll']) { verifyDll(name); console.log(`${name}: SHA-256 OK`); }
    console.log('Installation path and components checked. This does not verify gameplay.'); return;
  }
  if (process.platform !== 'win32') throw new Error('The game launcher requires Windows x64.');
  const backendOnly = process.argv.includes('--backend');
  if (!backendOnly) {
    showHelp();
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const old = readConfig();
    const ask = async (label, fallback) => (await rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `)).trim() || fallback;
    let config;
    while (!config) {
      try {
        config = saveConfig({ version: await ask('Step 1/3 - Fortnite version', old.version), gamePath: await ask('Step 2/3 - Folder containing FortniteGame AND Engine', old.gamePath), username: await ask('Step 3/3 - Local player name', old.username) });
      } catch (error) { console.error(`\n${error.message}\n`); }
    }
    console.log(`\nSelected: Fortnite ${config.version}. No Epic credentials are required.`);
    if (!/^4\.(2|20)$/.test(config.version)) console.log('Note: This project was tested with 4.2. Other builds have not been verified.');
  }
  console.log('Checking components. First-time setup may take a few minutes...'); await setup({ withGame: !backendOnly });
  backend = await startBackend();
  console.log(`Backend ready: ${backend.url} | XMPP: 127.0.0.1:80`);
  backend.child.once('exit', code => { if (!stopping) { console.error(`Backend exited unexpectedly (${code}). See logs/backend.log.`); stop().then(() => process.exit(1)); } });
  if (backendOnly) { console.log('Press Ctrl+C to stop the backend.'); return; }
  console.log(menu);
  while (!stopping) {
    const choice = (await rl.question('Type a menu option, then press Enter: ')).trim().toLowerCase();
    if (choice === 'h') { showHelp(); console.log(menu); continue; }
    if (choice === '0') { await stop(); break; }
    if (choice === '4') { console.log('Backend is running. Keep this window open. Type 2 when you want to start a host and client.'); continue; }
    if (!['1', '2', '3'].includes(choice)) { console.log('Choose 0, 1, 2, 3, 4 or H.'); continue; }
    if (helpers.size) { console.log('A game session is already running. Close its game/server windows first. To switch from lobby-only to a local match, exit with 0, reopen START.cmd, then choose 2.'); continue; }
    if (choice === '2' || choice === '3') game('server');
    if (choice === '1' || choice === '2') game('client');
    if (choice === '1') {
      console.log('\nLOBBY ONLY: No game server was started. Play cannot create a match.');
      console.log('To try a local match, close Fortnite, wait for its exit message, then choose 2.');
    } else {
      console.log('\nNEXT: Wait for "Joinable: true" in the Reboot server window.');
      if (choice === '3') console.log('SERVER ONLY: This option does not open a playable client. For both, restart with option 2.');
      console.log('In the Fortnite lobby: press F8, type open 127.0.0.1:7777, then press Enter.');
      console.log('If the host is not ready, joining will fail. Match gameplay is still unverified.');
    }
    console.log('Keep this startup window open. Type H for help or 0 to stop everything.');
  }
}
main().catch(async error => { console.error(`\nERROR: ${error.message}`); await stop(); process.exitCode = 1; });

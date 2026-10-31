import fs from 'node:fs';
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
  helper.once('error', error => console.error(`Spielstart fehlgeschlagen: ${error.message}`));
  helper.once('close', code => { helpers.delete(helper); console.log(`\n${mode === 'server' ? 'Spielserver' : 'Fortnite'} beendet (Code ${code}).`); });
  return helper;
}
async function main() {
  console.log('\n  FORTNITE BACKEND · LOKAL\n  Login, Lobby und privater Spielserver\n');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 oder neuer wird benötigt.');
  if (process.argv.includes('--doctor')) {
    const config = readConfig(); console.log('Version:', config.version);
    console.log('Installation:', validateInstall(config.gamePath).root);
    for (const name of ['sinum.dll', 'console.dll', 'memory.dll', 'reboot.dll']) { verifyDll(name); console.log(`${name}: SHA-256 OK`); }
    console.log('Pfad und Komponenten geprüft. Ein Spieltest ist davon getrennt.'); return;
  }
  if (process.platform !== 'win32') throw new Error('Der Spiel-Launcher benötigt Windows x64.');
  const backendOnly = process.argv.includes('--backend');
  if (!backendOnly) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const old = readConfig();
    const ask = async (label, fallback) => (await rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `)).trim() || fallback;
    let config;
    while (!config) {
      try {
        config = saveConfig({ version: await ask('Fortnite-Version', old.version), gamePath: await ask('Ordner mit FortniteGame und Engine', old.gamePath), username: await ask('Lokaler Spielername', old.username) });
      } catch (error) { console.error(`\n${error.message}\n`); }
    }
    console.log(`\nAusgewählt: Fortnite ${config.version}. Keine Epic-Zugangsdaten erforderlich.`);
    if (!/^4\.(2|20)$/.test(config.version)) console.log('Hinweis: Dieses Projekt wird zunächst mit 4.2 geprüft. Andere Builds sind nicht bestätigt.');
  }
  console.log('Prüfe Komponenten …'); await setup({ withGame: !backendOnly });
  backend = await startBackend();
  console.log(`Backend aktiv: ${backend.url} · XMPP: 127.0.0.1:80`);
  backend.child.once('exit', code => { if (!stopping) { console.error(`Backend unerwartet beendet (${code}). Siehe logs/backend.log.`); stop().then(() => process.exit(1)); } });
  if (backendOnly) { console.log('Strg+C beendet das Backend.'); return; }
  console.log('\n1  Fortnite starten (Lobby)\n2  Lokale Runde: Spielserver + Fortnite starten\n3  Nur Spielserver starten\n4  Backend weiterlaufen lassen\n0  Beenden\n');
  while (!stopping) {
    const choice = (await rl.question('Auswahl: ')).trim();
    if (choice === '0') { await stop(); break; }
    if (choice === '4') { console.log('Backend läuft. Dieses Fenster geöffnet lassen.'); continue; }
    if (!['1', '2', '3'].includes(choice)) { console.log('Bitte 0, 1, 2, 3 oder 4 wählen.'); continue; }
    if (helpers.size) { console.log('Eine Spielsitzung läuft bereits. Beende zuerst ihre Spielfenster.'); continue; }
    if (choice === '2' || choice === '3') game('server');
    if (choice === '1' || choice === '2') game('client');
    console.log('\nNach dem Login: F8 öffnet die Konsole.');
    console.log('Wenn der Reboot-Server „Joinable: true“ zeigt: open 127.0.0.1:7777');
    console.log('Eine lokale Runde enthält keine automatisch verbundenen Online-Spieler.');
  }
}
main().catch(async error => { console.error(`\nFEHLER: ${error.message}`); await stop(); process.exitCode = 1; });

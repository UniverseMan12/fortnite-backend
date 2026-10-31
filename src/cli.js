import readline from 'node:readline/promises';
import { once } from 'node:events';
import { readConfig, saveConfig, prepareConfig } from './config.js';
import { setup, verifyDll } from '../scripts/setup.js';
import { startBackend } from './backend.js';
import { startGame } from './game.js';
import { runSession } from './session.js';
import { folderPrompt, showStatus } from './status.js';

const controller = new AbortController();
let rl;
const cancel = () => { controller.abort(); rl?.close(); };
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);

async function main() {
  console.log('\n  Fortnite Launcher\n');
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Paste the folder containing FortniteGame and Engine, then press Enter.');
    console.log('Setup and startup run automatically. Keep this window open.');
    console.log('Advanced: --check validates your folder; --doctor checks components; --backend starts only the backend.');
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.');
  if (process.platform !== 'win32') throw new Error('The launcher requires Windows x64.');
  if (process.argv.includes('--doctor')) {
    const old = readConfig();
    console.log('Fortnite ' + prepareConfig(old.gamePath, old).version);
    for (const name of ['sinum.dll', 'console.dll', 'memory.dll', 'reboot.dll']) {
      verifyDll(name); console.log(name + ': OK');
    }
    return;
  }
  const backendOnly = process.argv.includes('--backend');
  if (!backendOnly) {
    const old = readConfig();
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let config;
    try {
      while (!config && !controller.signal.aborted) {
        const answer = await rl.question(folderPrompt, { signal: controller.signal });
        try { config = prepareConfig(answer.trim(), old); }
        catch (error) { showStatus(error.message, 'error'); }
      }
    } finally { rl.close(); rl = undefined; }
    if (!config || controller.signal.aborted) return;
    saveConfig(config);
    showStatus('Fortnite ' + config.version, 'ok');
    if (process.argv.includes('--check')) return;
  }
  showStatus('Preparing components...', 'pending');
  await setup({ withGame: !backendOnly, quiet: true });
  showStatus('Components ready', 'ok');
  if (controller.signal.aborted) return;
  if (backendOnly) {
    const backend = await startBackend();
    try {
      showStatus('Backend ready. Ctrl+C stops it.', 'ok');
      if (!controller.signal.aborted && backend.child.exitCode === null) {
        await once(backend.child, 'exit', { signal: controller.signal });
      }
      if (!controller.signal.aborted) throw new Error('Backend stopped. See logs/backend.log.');
    } finally { await backend.stop(); }
    return;
  }
  await runSession({ startBackend, startGame, status: showStatus, signal: controller.signal });
}
main().catch(error => {
  if (!controller.signal.aborted) {
    showStatus(error.message, 'error');
    process.exitCode = 1;
  }
}).finally(() => {
  rl?.close();
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
});

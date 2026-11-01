import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../src/config.js';
import { patchBackend } from './patch-backend.js';
import { downloadVerified } from './download.js';
import { installBackendManifest } from './backend-dependencies.js';

export const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'dependencies.lock.json'), 'utf8'));
export async function run(command, args, cwd = ROOT, quiet = false, {signal, timeoutMs = 180000} = {}) {
  signal?.throwIfAborted();
  const log = quiet ? fs.openSync(path.join(ROOT, 'logs', 'setup.log'), 'a') : null;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {cwd, stdio:quiet ? ['ignore',log,log] : 'inherit', windowsHide:true});
      let failure, stopping = false;
      const stop = error => {
        if (stopping) return; stopping = true; failure = error;
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
        // Kill only this owned setup process and its descendants (e.g. npm's node).
        if (process.platform === 'win32') {
          const killer = spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
          killer.once('error',()=>child.kill());
          killer.once('close',code=>{if(code!==0 && child.exitCode===null)child.kill();});
        } else child.kill();
      };
      const abort = () => stop(signal.reason || new Error('Setup cancelled.'));
      const timer = setTimeout(()=>stop(new Error(`${command} timed out after ${Math.round(timeoutMs/1000)} seconds.`)),timeoutMs);
      signal?.addEventListener('abort',abort,{once:true});
      child.once('error',error=>{failure=error;});
      child.once('close',code=>{
        clearTimeout(timer); signal?.removeEventListener('abort',abort);
        if (failure || code !== 0) reject(failure || new Error(`${command} failed: ${code}${quiet ? '. See logs/setup.log.' : ''}`));
        else resolve();
      });
      if (signal?.aborted) abort();
    });
  }
  finally { if (log !== null) fs.closeSync(log); }
}
export function verifyDll(name) {
  const target = path.join(ROOT, 'runtime', name);
  if (!fs.existsSync(target)) throw new Error(`${name} is missing. Run setup again.`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  if (digest !== lock.dlls[name].toLowerCase()) throw new Error(`${name}: checksum mismatch. This file will not be loaded.`);
  return target;
}
export async function setup({ withGame = true, quiet = false, signal } = {}) {
  signal?.throwIfAborted();
  for (const name of ['vendor', 'runtime', 'logs', 'data']) fs.mkdirSync(path.join(ROOT, name), { recursive: true });
  const backend = path.join(ROOT, 'vendor', 'LawinServer');
  const receipt = path.join(ROOT, 'runtime', 'backend-install.json');
  const bundled = process.env.FORTNITE_LAUNCHER_BUNDLED === '1';
  if (bundled) {
    const bundleReceipt = JSON.parse(fs.readFileSync(path.join(backend, 'launcher-bundle.json'), 'utf8'));
    if (bundleReceipt.commit !== lock.backend.commit || !fs.existsSync(path.join(backend, 'node_modules', '.package-lock.json'))) throw new Error('Bundled backend is incomplete. Reinstall the launcher.');
  }
  if (!bundled && !fs.existsSync(path.join(backend, '.git'))) {
    if (fs.existsSync(backend)) throw new Error('vendor/LawinServer exists without Git metadata. Back it up separately before running setup again.');
    await run('git', ['clone', lock.backend.repository, backend], ROOT, quiet, {signal});
    await run('git', ['checkout', '--detach', lock.backend.commit], backend, quiet, {signal});
  }
  let recordedCommit;
  if (fs.existsSync(receipt)) recordedCommit = JSON.parse(fs.readFileSync(receipt, 'utf8')).commit;
  if (!bundled && recordedCommit !== lock.backend.commit) {
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8', windowsHide: true });
    if (revision.status !== 0 || revision.stdout.trim() !== lock.backend.commit) throw new Error('Git is missing or the backend version does not match dependencies.lock.json. Existing files will not be overwritten automatically.');
    fs.writeFileSync(receipt, JSON.stringify({ commit: lock.backend.commit }));
  }
  const dependenciesChanged = installBackendManifest(backend);
  if (bundled && dependenciesChanged) throw new Error('Bundled dependency versions do not match. Reinstall the launcher.');
  if (dependenciesChanged || !fs.existsSync(path.join(backend, 'node_modules', '.package-lock.json'))) {
    if (process.platform === 'win32') await run('cmd.exe', ['/d', '/c', 'npm.cmd ci --ignore-scripts --no-audit --no-fund'], backend, quiet, {signal});
    else await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], backend, quiet, {signal});
  }
  patchBackend(backend);
  if (withGame) {
    for (const name of ['sinum.dll', 'console.dll', 'memory.dll']) {
      const file = path.join(ROOT, 'runtime', name);
      if (!fs.existsSync(file)) {
        if (!quiet) console.log(`Downloading ${name} from the pinned Reboot Launcher commit...`);
        await downloadVerified(`https://raw.githubusercontent.com/Auties00/Reboot-Launcher/${lock.launcherCommit}/gui/dependencies/dlls/${name}`, file, { sha256: lock.dlls[name], signal });
      }
      verifyDll(name);
    }
    const serverDll = path.join(ROOT, 'runtime', 'reboot.dll');
    let replaceServer = !fs.existsSync(serverDll);
    if (!replaceServer) {
      const current = crypto.createHash('sha256').update(fs.readFileSync(serverDll)).digest('hex');
      const previous = lock.previousGameServerSha256s ?? [lock.previousGameServerSha256];
      replaceServer = current !== lock.dlls['reboot.dll'] && previous.includes(current);
      if (current !== lock.dlls['reboot.dll'] && !replaceServer) verifyDll('reboot.dll');
    }
    if (replaceServer) {
      if (!quiet) console.log('Downloading the pinned Reboot game server...');
      const archive = path.join(ROOT, 'runtime', 'reboot.zip');
      await downloadVerified(lock.gameServerArchive, archive, { sha256: lock.gameServerArchiveSha256, signal });
      await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'extract-server.ps1')], ROOT, quiet, {signal});
    }
    verifyDll('reboot.dll');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setup().then(() => console.log('Setup complete.')).catch(error => { console.error(error.message); process.exitCode = 1; });
}

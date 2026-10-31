import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../src/config.js';
import { patchBackend } from './patch-backend.js';

export const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'dependencies.lock.json'), 'utf8'));
export function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${command} fehlgeschlagen: ${result.error?.message || result.status}`);
}
export function verifyDll(name) {
  const target = path.join(ROOT, 'runtime', name);
  if (!fs.existsSync(target)) throw new Error(`${name} fehlt. Setup erneut ausführen.`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  if (digest !== lock.dlls[name].toLowerCase()) throw new Error(`${name}: Prüfsumme stimmt nicht. Datei wird nicht geladen.`);
  return target;
}
async function download(url, file) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Download fehlgeschlagen (${response.status}): ${url}. Das Build-Artefakt ist eventuell abgelaufen; siehe README.`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}
export async function setup({ withGame = true } = {}) {
  for (const name of ['vendor', 'runtime', 'logs', 'data']) fs.mkdirSync(path.join(ROOT, name), { recursive: true });
  const backend = path.join(ROOT, 'vendor', 'LawinServer');
  const receipt = path.join(ROOT, 'runtime', 'backend-install.json');
  if (!fs.existsSync(path.join(backend, '.git'))) {
    if (fs.existsSync(backend)) throw new Error('vendor/LawinServer existiert ohne Git-Metadaten. Bitte separat sichern, bevor das Setup erneut läuft.');
    run('git', ['clone', lock.backend.repository, backend]);
    run('git', ['checkout', '--detach', lock.backend.commit], backend);
  }
  let recordedCommit;
  if (fs.existsSync(receipt)) recordedCommit = JSON.parse(fs.readFileSync(receipt, 'utf8')).commit;
  if (recordedCommit !== lock.backend.commit) {
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8', windowsHide: true });
    if (revision.status !== 0 || revision.stdout.trim() !== lock.backend.commit) throw new Error('Git fehlt oder die Backend-Version weicht von dependencies.lock.json ab. Kein automatisches Überschreiben.');
    fs.writeFileSync(receipt, JSON.stringify({ commit: lock.backend.commit }));
  }
  if (!fs.existsSync(path.join(backend, 'node_modules', '.package-lock.json'))) {
    if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', 'npm.cmd ci --ignore-scripts --no-audit --no-fund'], backend);
    else run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], backend);
  }
  patchBackend(backend);
  if (withGame) {
    for (const name of ['sinum.dll', 'console.dll', 'memory.dll']) {
      const file = path.join(ROOT, 'runtime', name);
      if (!fs.existsSync(file)) {
        console.log(`Lade ${name} aus dem festgelegten Reboot-Launcher-Commit …`);
        await download(`https://raw.githubusercontent.com/Auties00/Reboot-Launcher/${lock.launcherCommit}/gui/dependencies/dlls/${name}`, file);
      }
      verifyDll(name);
    }
    if (!fs.existsSync(path.join(ROOT, 'runtime', 'reboot.dll'))) {
      console.log('Lade den festgelegten Reboot-Spielserver …');
      const archive = path.join(ROOT, 'runtime', 'reboot.zip');
      await download(lock.gameServerArchive, archive);
      run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'extract-server.ps1')]);
    }
    verifyDll('reboot.dll');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setup().then(() => console.log('Setup abgeschlossen.')).catch(error => { console.error(error.message); process.exitCode = 1; });
}

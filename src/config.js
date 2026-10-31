import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = path.join(ROOT, 'config.local.json');
export const examplePath = path.join(os.homedir(), 'Downloads', '4.2-CL-4072250', 'Fortnite', 'Fortnite');

export function validateInstall(input) {
  const root = path.resolve(String(input).trim().replace(/^"(.*)"$/, '$1'));
  for (const folder of ['FortniteGame', 'Engine']) {
    if (!fs.existsSync(path.join(root, folder)) || !fs.statSync(path.join(root, folder)).isDirectory()) {
      throw new Error(`The selected folder is missing ${folder}. Select the parent folder containing BOTH FortniteGame and Engine.`);
    }
  }
  const exe = path.join(root, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe');
  if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) throw new Error('FortniteClient-Win64-Shipping.exe is missing from FortniteGame/Binaries/Win64.');
  const paks = path.join(root, 'FortniteGame', 'Content', 'Paks');
  if (!fs.existsSync(paks) || !fs.readdirSync(paks).some(name => name.endsWith('.pak'))) throw new Error('No .pak game files were found in FortniteGame/Content/Paks.');
  const fd = fs.openSync(exe, 'r');
  try {
    const header = Buffer.alloc(64); fs.readSync(fd, header, 0, 64, 0);
    if (header.toString('ascii', 0, 2) !== 'MZ') throw new Error('The game EXE is not a valid Windows executable.');
    const pe = Buffer.alloc(6); fs.readSync(fd, pe, 0, 6, header.readUInt32LE(60));
    if (pe.toString('ascii', 0, 4) !== 'PE\0\0' || pe.readUInt16LE(4) !== 0x8664) throw new Error('A Windows x64 build of Fortnite is required.');
  } finally { fs.closeSync(fd); }
  return { root, exe, paks };
}

export function validateConfig(config) {
  if (!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(config.version)) throw new Error('Version must be a number such as 4.2.');
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(config.username)) throw new Error('Player name: use 3-24 letters, numbers, _ or -.');
  return { ...config, gamePath: validateInstall(config.gamePath).root };
}

export function readConfig() {
  if (!fs.existsSync(CONFIG)) return { version: '4.2', gamePath: fs.existsSync(examplePath) ? examplePath : '', username: 'Player' };
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch { throw new Error('config.local.json is invalid. Rename that file and restart the launcher.'); }
}

export function saveConfig(config) {
  const checked = validateConfig(config);
  fs.writeFileSync(`${CONFIG}.tmp`, JSON.stringify(checked, null, 2));
  fs.renameSync(`${CONFIG}.tmp`, CONFIG);
  return checked;
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = path.join(ROOT, 'config.local.json');
export const examplePath = path.join(os.homedir(), 'Downloads', '4.2-CL-4072250', 'Fortnite', 'Fortnite');

export function validateInstall(input) {
  const clean = String(input ?? '').trim().replace(/^["'](.*)["']$/, '$1');
  if (!clean) throw new Error('Enter the folder containing FortniteGame and Engine.');
  let root = path.resolve(clean);
  if (['fortnitegame', 'engine'].includes(path.basename(root).toLowerCase())) root = path.dirname(root);
  for (const folder of ['FortniteGame', 'Engine']) {
    if (!fs.existsSync(path.join(root, folder)) || !fs.statSync(path.join(root, folder)).isDirectory()) {
      throw new Error(`The selected folder is missing ${folder}. Select the parent folder containing BOTH FortniteGame and Engine.`);
    }
  }
  const exe = path.join(root, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe');
  if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) throw new Error('FortniteClient-Win64-Shipping.exe is missing from FortniteGame/Binaries/Win64.');
  const paks = path.join(root, 'FortniteGame', 'Content', 'Paks');
  if (!fs.existsSync(paks) || !fs.statSync(paks).isDirectory() || !fs.readdirSync(paks, {withFileTypes:true}).some(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pak'))) throw new Error('No .pak game files were found in FortniteGame/Content/Paks.');
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

// Read embedded release identifiers rather than trusting a folder name or old settings.
export function detectVersion(exe) {
  const releasePattern = /\+\+Fortnite\+Release-(\d{1,2}\.\d{1,2}(?:\.\d+)?)(?:-CL-(\d+))?(?=[^\d.])/g;
  const versions = new Map(), builds = new Map();
  const chunkSize = 1024 * 1024, overlap = 512;
  const buffer = Buffer.alloc(chunkSize + overlap);
  const fd = fs.openSync(exe, 'r');
  let position = 0, carry = 0;
  try {
    for (;;) {
      const count = fs.readSync(fd, buffer, carry, chunkSize, position);
      if (!count) break;
      const block = buffer.subarray(0, carry + count);
      for (const content of [block.toString('latin1'), block.toString('utf16le'), block.subarray(1).toString('utf16le')]) {
        for (const match of content.matchAll(releasePattern)) {
          const build = { version: match[1], changelist: match[2] || null };
          versions.set(build.version, build);
          if (build.changelist) builds.set(`${build.version}:${build.changelist}`, build);
        }
      }
      carry = Math.min(overlap, block.length);
      buffer.copy(buffer, 0, block.length - carry, block.length);
      position += count;
    }
  } finally { fs.closeSync(fd); }
  const candidates = builds.size ? builds : versions;
  if (candidates.size !== 1) throw new Error('Could not identify one Fortnite version from this game EXE. No game was started.');
  return [...candidates.values()][0];
}

export function prepareConfig(gamePath, previous = {}) {
  const install = validateInstall(gamePath);
  const build = detectVersion(install.exe);
  if (!['4.2', '4.20'].includes(build.version)) {
    throw new Error(`Fortnite ${build.version} detected. Automatic hosting is currently configured for 4.2 only.`);
  }
  const username = /^[A-Za-z0-9_-]{3,24}$/.test(previous.username || '') ? previous.username : 'Player';
  return { gamePath: install.root, username, ...build };
}

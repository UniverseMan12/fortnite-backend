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
      throw new Error(`Im ausgewählten Ordner fehlt ${folder}. Wähle den übergeordneten Ordner, der FortniteGame UND Engine enthält.`);
    }
  }
  const exe = path.join(root, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe');
  if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) throw new Error('FortniteClient-Win64-Shipping.exe fehlt unter FortniteGame/Binaries/Win64.');
  const paks = path.join(root, 'FortniteGame', 'Content', 'Paks');
  if (!fs.existsSync(paks) || !fs.readdirSync(paks).some(name => name.endsWith('.pak'))) throw new Error('Keine .pak-Spieldateien unter FortniteGame/Content/Paks gefunden.');
  const fd = fs.openSync(exe, 'r');
  try {
    const header = Buffer.alloc(64); fs.readSync(fd, header, 0, 64, 0);
    if (header.toString('ascii', 0, 2) !== 'MZ') throw new Error('Die Spiel-EXE ist keine gültige Windows-Datei.');
    const pe = Buffer.alloc(6); fs.readSync(fd, pe, 0, 6, header.readUInt32LE(60));
    if (pe.toString('ascii', 0, 4) !== 'PE\0\0' || pe.readUInt16LE(4) !== 0x8664) throw new Error('Es wird eine Windows-x64-Version von Fortnite benötigt.');
  } finally { fs.closeSync(fd); }
  return { root, exe, paks };
}

export function validateConfig(config) {
  if (!/^\d{1,2}\.\d{1,2}(\.\d+)?$/.test(config.version)) throw new Error('Version bitte als Zahl eingeben, z. B. 4.2.');
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(config.username)) throw new Error('Spielername: 3–24 Buchstaben, Zahlen, _ oder -.');
  return { ...config, gamePath: validateInstall(config.gamePath).root };
}

export function readConfig() {
  if (!fs.existsSync(CONFIG)) return { version: '4.2', gamePath: fs.existsSync(examplePath) ? examplePath : '', username: 'Player' };
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch { throw new Error('config.local.json ist beschädigt. Benenne die Datei um und starte erneut.'); }
}

export function saveConfig(config) {
  const checked = validateConfig(config);
  fs.writeFileSync(`${CONFIG}.tmp`, JSON.stringify(checked, null, 2));
  fs.renameSync(`${CONFIG}.tmp`, CONFIG);
  return checked;
}

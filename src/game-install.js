import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, prepareConfig } from './config.js';
import { downloadGameArchive, hashFile } from './game-download.js';

const reserve = 1024 ** 3;
export function safeArchivePath(value) {
  const name = value.replaceAll('\\','/');
  const parts = name.split('/');
  if (!name || parts.some(p => !p || p === '.' || p === '..' || /[\x00-\x1f<>:"|?*]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(p))) throw new Error('The game archive contains an unsafe path.');
  return name;
}

export function inspectArchive(listing, maxBytes = 64 * 1024 ** 3) {
  const entries = [], seen = new Set();
  for (const block of listing.trim().split(/\r?\n\r?\n/)) {
    const fields = {};
    for (const line of block.split(/\r?\n/)) {
      const split = line.indexOf(' = ');
      if (split < 0 || Object.hasOwn(fields,line.slice(0,split))) throw new Error('Unrecognized game archive listing.');
      fields[line.slice(0,split)] = line.slice(split+3);
    }
    const name = safeArchivePath(fields.Path || '');
    if (seen.has(name.toLowerCase())) throw new Error('The game archive contains duplicate paths.');
    seen.add(name.toLowerCase());
    if (fields.Encrypted === '+' || /L/.test(fields.Attributes || '') || Object.keys(fields).some(k => /link|reparse|alternate/i.test(k) && fields[k] && fields[k] !== '-')) throw new Error('Encrypted files and links are not supported in game archives.');
    const size = Number(fields.Size), directory = fields.Folder === '+' || (fields.Attributes || '').startsWith('D');
    if (!Number.isSafeInteger(size) || size < 0 || entries.length >= 100000) throw new Error('The game archive exceeds installation limits.');
    entries.push({name,size,directory});
  }
  const suffix = 'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe';
  const games = entries.filter(e => !e.directory && (e.name === suffix || e.name.endsWith('/'+suffix)));
  if (games.length !== 1) throw new Error('The archive must contain exactly one Fortnite game installation.');
  const root = games[0].name.slice(0,-suffix.length).replace(/\/$/,'');
  const files = entries.filter(e => !root || e.name.startsWith(root+'/'));
  const bytes = files.reduce((sum,e)=>sum+e.size,0);
  if (!Number.isSafeInteger(bytes) || bytes > maxBytes) throw new Error('The game archive exceeds installation limits.');
  return {root, entries:files, bytes};
}

export function runExtractor(exe, args, {signal, onOutput = () => {}, capture = false} = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve,reject) => {
    const child = spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output = '', errors = '', failure;
    const abort = () => child.kill();
    signal?.addEventListener('abort',abort,{once:true});
    if (signal?.aborted) abort();
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => {
      onOutput(text);
      if (capture) { output += text; if (output.length > 32*1024*1024) { failure = new Error('Game archive listing is too large.'); child.kill(); } }
    });
    child.stderr.on('data',text=>{errors=(errors+text).slice(-4000);});
    child.once('error',error=>{failure=error;});
    child.once('close',code=>{
      signal?.removeEventListener('abort',abort);
      if (signal?.aborted) reject(signal.reason);
      else if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Game extraction failed (code ${code}). Retry the installation. ${errors.trim()}`));
      else resolve(output);
    });
  });
}

function ownedChild(parent, target) {
  const relative = path.relative(parent,target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid installer workspace.');
  return target;
}
async function freeSpace(directory, bytes) {
  const info = await fs.statfs(directory);
  if (info.bavail * info.bsize < bytes) throw new Error(`Not enough free space. About ${Math.ceil(bytes/1024**3)} GiB is required on the selected drive.`);
}
async function exists(file) { try { await fs.lstat(file); return true; } catch (e) { if(e.code==='ENOENT') return false; throw e; } }
async function ensureCache(parent) {
  const cache = ownedChild(parent,path.join(parent,'.fortnite-4.2-download'));
  try { await fs.mkdir(cache); await fs.writeFile(path.join(cache,'owner.json'),JSON.stringify({owner:'FortniteLauncher',version:1}),{flag:'wx'}); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const stat = await fs.lstat(cache);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('The download cache is not a normal directory.');
    const owner = JSON.parse(await fs.readFile(path.join(cache,'owner.json'),'utf8'));
    if (owner.owner !== 'FortniteLauncher' || owner.version !== 1) throw new Error('The download cache belongs to another application.');
  }
  return cache;
}

export async function installGame(parentDirectory, {
  signal, progress = () => {}, source, extractor, fetchImpl, validate = prepareConfig
} = {}) {
  source ??= JSON.parse(await fs.readFile(path.join(ROOT,'game-download.json'),'utf8'));
  extractor ??= path.join(ROOT,'runtime','7zip','7zr.exe');
  signal?.throwIfAborted();
  if (!path.isAbsolute(parentDirectory)) throw new Error('Choose an absolute installation folder.');
  const parent = await fs.realpath(parentDirectory);
  if (!(await fs.stat(parent)).isDirectory()) throw new Error('Choose an installation folder.');
  const target = ownedChild(parent,path.join(parent,'Fortnite-4.2'));
  if (await exists(target)) throw new Error('Fortnite-4.2 already exists in this folder. Use Choose game folder to select it, or choose another installation location.');
  const cache = await ensureCache(parent);
  const archive = ownedChild(cache,path.join(cache,source.sha256+'.7z.part'));
  const cached = await fs.lstat(archive).catch(error=>{if(error.code==='ENOENT')return {size:0};throw error;});
  await freeSpace(parent,Math.max(0,source.size-cached.size)+source.unpackedBytes+reserve);
  if (await hashFile(extractor,{signal}) !== source.extractor.sha256) throw new Error('The bundled game extractor failed its integrity check. Reinstall the launcher.');
  await downloadGameArchive(source,archive,{signal,progress,fetchImpl});
  progress({stage:'inspecting',received:0,total:0});
  const listing = await runExtractor(extractor,['l','-slt','-ba','-sccUTF-8','--',archive],{signal,capture:true});
  const contents = inspectArchive(listing);
  if (contents.bytes !== source.unpackedBytes) throw new Error('The game archive contents differ from the pinned version.');
  await freeSpace(parent,contents.bytes+reserve);
  const temporary = ownedChild(parent,await fs.mkdtemp(path.join(parent,'.fortnite-4.2-install-')));
  try {
    progress({stage:'extracting',received:0,total:100});
    const args = ['x',archive,`-o${temporary}`,'-y','-bsp1','-bso0','-bse1','-sccUTF-8'];
    if (contents.root) args.push(`-ir!${contents.root.replaceAll('/','\\')}\\*`);
    await runExtractor(extractor,args,{signal,onOutput:text=>{
      const matches = [...text.matchAll(/(\d{1,3})%/g)];
      if (matches.length) progress({stage:'extracting',received:Math.min(100,Number(matches.at(-1)[1])),total:100});
    }});
    progress({stage:'checking',received:0,total:0});
    const game = contents.root ? ownedChild(temporary,path.join(temporary,...contents.root.split('/'))) : temporary;
    for (const entry of contents.entries) {
      signal?.throwIfAborted();
      const file = ownedChild(temporary,path.join(temporary,...entry.name.split('/')));
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink() || stat.isDirectory() !== entry.directory || (!entry.directory && (!stat.isFile() || stat.size !== entry.size))) throw new Error('Extracted game files did not match the archive.');
      ownedChild(temporary,await fs.realpath(file));
    }
    const config = validate(game);
    if (!['4.2','4.20'].includes(config.version) || config.changelist !== source.changelist) throw new Error('The downloaded game is not the supported Fortnite 4.2 build.');
    signal?.throwIfAborted();
    if (await exists(target)) throw new Error('The destination was created during installation. Existing files were kept.');
    await fs.rename(game,target);
    // A successful install no longer needs the 8.3 GiB download cache.
    await fs.unlink(archive).catch(()=>{});
    return target;
  } finally {
    ownedChild(parent,temporary);
    await fs.rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}

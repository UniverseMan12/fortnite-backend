import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../src/config.js';
import { hashFile } from '../src/game-download.js';
import { installGame, inspectArchive, safeArchivePath, runExtractor } from '../src/game-install.js';

test('game archives reject traversal, Windows aliases, links and ambiguous installations',()=>{
  for(const name of ['../outside','/absolute','C:/game','folder/../game','CON.txt','folder/file:stream','trailing.','bad\nname','folder//file'])assert.throws(()=>safeArchivePath(name));
  assert.equal(safeArchivePath('Game\\FortniteGame\\Content'),'Game/FortniteGame/Content');
  const entry=(name,extra='')=>`Path = ${name}\nSize = 1\nAttributes = A\nEncrypted = -\n${extra}`;
  const game='Game/FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe';
  assert.throws(()=>inspectArchive(entry(game)+'\n'+entry('../outside')),/unsafe/);
  assert.throws(()=>inspectArchive(entry(game)+'\n'+entry(game.toUpperCase())),/duplicate/);
  assert.throws(()=>inspectArchive(entry(game,'Symbolic Link = ../outside\n')),/links/);
  assert.throws(()=>inspectArchive(entry(game)+'\n'+entry('Other/'+game)),/exactly one/);
});

test('game installation extracts only the game, checks its build and preserves existing folders', {timeout:30000}, async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'game-install-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200}));
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'game-download.json'),'utf8'));
  const extractor=path.join(ROOT,'runtime','7zip','7zr.exe');
  const input=path.join(root,'source'), game=path.join(input,'Wrapper','Game');
  for(const dir of ['Engine','FortniteGame/Binaries/Win64','FortniteGame/Content/Paks'])await fs.mkdir(path.join(game,dir),{recursive:true});
  const exe=Buffer.alloc(512);exe.write('MZ');exe.writeUInt32LE(128,60);exe.write('PE\0\0',128);exe.writeUInt16LE(0x8664,132);exe.write('++Fortnite+Release-4.2-CL-4072250 ',200);
  await fs.writeFile(path.join(game,'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe'),exe);
  await fs.writeFile(path.join(game,'FortniteGame/Content/Paks/test.pak'),'pak fixture');
  await fs.writeFile(path.join(input,'unrelated-launcher.exe'),'must not be installed');
  const archive=path.join(root,'fixture.7z');
  execFileSync(extractor,['a','-t7z',archive,'.'],{cwd:input,windowsHide:true,stdio:'ignore'});
  const listing=await runExtractor(extractor,['l','-slt','-ba','-sccUTF-8','--',archive],{capture:true});
  const bytes=await fs.readFile(archive), contents=inspectArchive(listing);
  const source={...manifest,size:bytes.length,sha256:await hashFile(archive),unpackedBytes:contents.bytes};
  const target=path.join(root,'target');await fs.mkdir(target);
  let requests=0;
  const fetchImpl=async()=>{requests++;return new Response(bytes,{headers:{'content-length':String(bytes.length)}});};
  const controller=new AbortController();
  await assert.rejects(installGame(target,{source,extractor,fetchImpl,signal:controller.signal,progress:p=>{if(p.stage==='extracting')controller.abort();}}),/abort/i);
  assert.equal((await fs.readdir(target)).some(n=>n.startsWith('.fortnite-4.2-install-')),false);
  const installed=await installGame(target,{source,extractor,fetchImpl});
  assert.equal(requests,1,'retry after extraction cancellation reuses the verified cached download');
  // Windows CI may expose TEMP via an 8.3 alias (RUNNER~1). The installer
  // intentionally returns the canonical path, so compare canonical targets.
  assert.equal(installed,await fs.realpath(path.join(target,'Fortnite-4.2')));
  await assert.rejects(fs.stat(path.join(installed,'unrelated-launcher.exe')),{code:'ENOENT'});
  assert.equal((await fs.stat(path.join(installed,'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe'))).size,512);
  await assert.rejects(installGame(target,{source,extractor,fetchImpl}),/already exists/);
  assert.equal((await fs.readFile(path.join(installed,'FortniteGame/Content/Paks/test.pak'),'utf8')),'pak fixture');
  const wrongBuild=path.join(root,'wrong-build');await fs.mkdir(wrongBuild);
  await assert.rejects(installGame(wrongBuild,{source:{...source,changelist:'0000000'},extractor,fetchImpl}),/not the supported/);
  assert.equal((await fs.readdir(wrongBuild)).some(n=>n==='Fortnite-4.2'||n.startsWith('.fortnite-4.2-install-')),false);
  const noSpace=path.join(root,'no-space');await fs.mkdir(noSpace);
  await assert.rejects(installGame(noSpace,{source:{...source,unpackedBytes:1024**5},extractor,fetchImpl}),/Not enough free space/);
});

test('extractor cancellation waits for the owned process to exit',async()=>{
  const controller=new AbortController();
  const task=runExtractor(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:controller.signal});
  setTimeout(()=>controller.abort(),100);
  await assert.rejects(task,/abort/i);
});

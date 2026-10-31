import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateConfig, validateInstall, detectVersion, prepareConfig } from '../src/config.js';

test('installation validation rejects wrong folder, missing content and non-x64 executables', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-path-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => validateInstall(root), /FortniteGame/);
  fs.mkdirSync(path.join(root, 'FortniteGame', 'Binaries', 'Win64'), { recursive: true });
  assert.throws(() => validateInstall(root), /Engine/);
  fs.mkdirSync(path.join(root, 'Engine'));
  assert.throws(() => validateInstall(root), /Shipping.exe/);
  const exe = path.join(root, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe');
  fs.writeFileSync(exe, 'invalid');
  assert.throws(() => validateInstall(root), /pak/);
  fs.mkdirSync(path.join(root, 'FortniteGame', 'Content', 'Paks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'FortniteGame', 'Content', 'Paks', 'test.pak'), 'fixture');
  assert.throws(() => validateInstall(root), /Windows/);
  const pe = Buffer.alloc(128); pe.write('MZ'); pe.writeUInt32LE(64, 60); pe.write('PE\0\0', 64); pe.writeUInt16LE(0x8664, 68);
  fs.writeFileSync(exe, pe);
  assert.equal(validateInstall(`"${root}"`).root, root);
  assert.throws(() => validateConfig({ version: '4.2', username: 'name -argument', gamePath: root }), /Player name/);
  assert.throws(() => validateConfig({ version: 'unknown', username: 'Player', gamePath: root }), /Version/);
  assert.equal(validateConfig({ version: '4.2', username: 'Player', gamePath: root }).version, '4.2');
  assert.equal(validateInstall(path.join(root, 'FortniteGame')).root, root);
  assert.equal(validateInstall(path.join(root, 'Engine')).root, root);
  fs.appendFileSync(exe, Buffer.from('++Fortnite+Release-4.2-CL-4072250\0', 'utf16le'));
  assert.deepEqual(prepareConfig(root, { version: '99.1', username: 'Bad Name' }), {
    gamePath: root, version: '4.2', changelist: '4072250', username: 'Player'
  });
  fs.writeFileSync(exe, Buffer.concat([pe, Buffer.from('++Fortnite+Release-5.0-CL-1234\0')]));
  assert.throws(() => prepareConfig(root), /4.2 only/);
});

test('release detection handles encodings, chunk boundaries and conflicting builds', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const exe = path.join(root, 'renamed.exe');
  const marker = '++Fortnite+Release-4.20-CL-4072250\0';
  for (const encoding of ['latin1', 'utf16le']) {
    const encoded = Buffer.from(marker, encoding);
    for (const offset of [0, 1, 1024 * 1024 - 22, 1024 * 1024 - 30, 1024 * 1024 - 58]) {
      fs.writeFileSync(exe, Buffer.concat([Buffer.alloc(offset), encoded]));
      assert.deepEqual(detectVersion(exe), { version: '4.20', changelist: '4072250' });
    }
  }
  fs.writeFileSync(exe, 'no release identifier');
  assert.throws(() => detectVersion(exe), /Could not identify/);
  fs.writeFileSync(exe, marker + '++Fortnite+Release-5.0-CL-9999\0');
  assert.throws(() => detectVersion(exe), /Could not identify/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateConfig, validateInstall } from '../src/config.js';

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
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareWorkspace } from '../desktop/bootstrap.mjs';
import { validateOptions } from '../desktop/options.mjs';

test('desktop launch requests reject unsupported actions and missing paths', () => {
  for (const value of [null, {}, { mode: 'shell', gamePath: 'C:/game' }, { mode: 'solo', gamePath: '' }]) assert.throws(() => validateOptions(value));
  assert.deepEqual(validateOptions({ mode: 'join', gamePath: ' C:/game ', host: ' 25.1.2.3 ', unexpected: true }), { mode: 'join', gamePath: 'C:/game', host: '25.1.2.3', gameMode: 'classic' });
  assert.equal(validateOptions({mode:'host',gamePath:'C:/game',gameMode:'infinity'}).gameMode,'infinity');
  assert.throws(()=>validateOptions({mode:'host',gamePath:'C:/game',gameMode:'anything'}),/Choose Classic/);
});

test('packaged workspace verifies payload integrity, rejects path traversal and recovers from interrupted setup', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launcher-bundle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const payload = path.join(root, 'payload'), destination = path.join(root, 'data');
  await fs.mkdir(payload);
  const hash = crypto.createHash('sha256').update('valid').digest('hex');
  await fs.writeFile(path.join(payload, 'runtime.txt'), 'damaged');
  await fs.writeFile(path.join(payload, 'payload.json'), JSON.stringify({ files: { 'runtime.txt': hash } }));
  await assert.rejects(prepareWorkspace(payload, destination), /Damaged installer/);
  await fs.writeFile(path.join(payload, 'runtime.txt'), 'valid');
  const workspace = await prepareWorkspace(payload, destination);
  assert.equal(await fs.readFile(path.join(workspace, 'runtime.txt'), 'utf8'), 'valid');
  await fs.writeFile(path.join(workspace, 'user-profile.json'), 'keep');
  assert.equal(await prepareWorkspace(payload, destination), workspace);
  assert.equal(await fs.readFile(path.join(workspace, 'user-profile.json'), 'utf8'), 'keep');
  await fs.writeFile(path.join(payload, 'payload.json'), JSON.stringify({ files: { '../outside': hash } }));
  await assert.rejects(prepareWorkspace(payload, destination), /Invalid bundled file path/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareWorkspace(payload, destination, controller.signal), /abort/i);
});

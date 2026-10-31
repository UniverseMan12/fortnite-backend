import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { downloadVerified } from '../scripts/download.js';

test('verified downloads retry transient errors and preserve working files on bad data', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fortnite-download-'));
  const bytes = Buffer.from('verified component');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  let retries = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/retry' && retries++ === 0) { res.writeHead(503); res.end(); return; }
    if (req.url === '/wrong') { res.end('wrong bytes'); return; }
    if (req.url === '/missing') { res.writeHead(404); res.end(); return; }
    if (req.url === '/interrupted') { res.writeHead(200, { 'Content-Length': 100 }); res.write('partial'); setImmediate(() => res.destroy()); return; }
    if (req.url === '/large') { res.write('12345'); res.end('67890'); return; }
    if (req.url === '/stall') { res.write('partial'); return; }
    res.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const file = path.join(root, 'component.dll');
  const options = { sha256, retryDelayMs: 1, timeoutMs: 2000 };
  await fs.writeFile(file, 'old working component');
  for (const [route, extra] of [['/wrong', {}], ['/missing', {}], ['/interrupted', { attempts: 1 }], ['/large', { maxBytes: 6 }], ['/stall', { timeoutMs: 100, attempts: 1 }]]) {
    await assert.rejects(downloadVerified(base + route, file, { ...options, ...extra }));
    assert.equal(await fs.readFile(file, 'utf8'), 'old working component');
    assert.deepEqual(await fs.readdir(root), ['component.dll']);
  }
  await downloadVerified(base + '/retry', file, options);
  assert.equal(retries, 2);
  assert.deepEqual(await fs.readFile(file), bytes);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(downloadVerified(base + '/retry', file, { ...options, signal: controller.signal }));
  assert.deepEqual(await fs.readFile(file), bytes);
  assert.deepEqual(await fs.readdir(root), ['component.dll']);
  const active = new AbortController();
  const transfer = downloadVerified(base + '/stall', file, { ...options, signal: active.signal });
  setTimeout(() => active.abort(), 30);
  await assert.rejects(transfer);
  assert.deepEqual(await fs.readFile(file), bytes);
  assert.deepEqual(await fs.readdir(root), ['component.dll']);
});

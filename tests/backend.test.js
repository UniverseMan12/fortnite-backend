import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { ROOT } from '../src/config.js';
import { startBackend, assertFreePort } from '../src/backend.js';
import { patchBackend } from '../scripts/patch-backend.js';
import { createRequire } from 'node:module';

const vendor = path.join(ROOT, 'vendor', 'LawinServer');
async function unusedPort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
test('local backend: login, profile, F8 hotfix, matchmaking and XMPP readiness', { timeout: 30000 }, async t => {
  assert.ok(fs.existsSync(path.join(vendor, 'node_modules')), 'Run npm run setup first.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-backend-test-'));
  let backend;
  t.after(async () => {
    await backend?.stop();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  fs.cpSync(vendor, temporary, { recursive: true, filter: source => !['.git', 'node_modules'].includes(path.basename(source)) });
  fs.symlinkSync(path.join(vendor, 'node_modules'), path.join(temporary, 'node_modules'), 'junction');
  patchBackend(temporary);
  const once = fs.readFileSync(path.join(temporary, 'index.js'), 'utf8');
  patchBackend(temporary);
  assert.equal(fs.readFileSync(path.join(temporary, 'index.js'), 'utf8'), once, 'patches are idempotent');
  const port = await unusedPort(), xmppPort = await unusedPort();
  backend = await startBackend({ directory: temporary, port, xmppPort });
  await assert.rejects(assertFreePort(port), /already in use/);
  const headers = { 'user-agent': 'Fortnite/++Fortnite+Release-4.2-CL-4072250 Windows/10', 'content-type': 'application/json' };
  const request = (route, options = {}) => fetch(`${backend.url}${route}`, { headers, ...options });
  const health = await (await request('/local/health')).json();
  assert.equal(health.ready, true);
  const auth = await (await request('/account/api/oauth/token', { method: 'POST', body: JSON.stringify({ username: 'TestPlayer@local.invalid', grant_type: 'password', password: 'LocalOnly' }) })).json();
  assert.equal(auth.account_id, 'TestPlayer'); assert.ok(auth.access_token);
  const status = await (await request('/lightswitch/api/service/bulk/status')).json();
  assert.equal(status[0].status, 'UP');
  const input = await (await request('/fortnite/api/cloudstorage/system/DefaultInput.ini')).text();
  assert.match(input, /ConsoleKeys=F8/);
  const profileResponse = await request('/fortnite/api/game/v2/profile/TestPlayer/client/QueryProfile?profileId=athena&rvn=-1', { method: 'POST', body: '{}' });
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json();
  assert.equal(profile.profileChanges[0].profile.profileId, 'athena');
  const session = await (await request('/fortnite/api/matchmaking/session/local')).json();
  assert.equal(session.serverAddress, '127.0.0.1'); assert.equal(session.serverPort, 7777);
  const unknown = await request('/this-route-does-not-exist'); assert.equal(unknown.status, 404);
  const require = createRequire(path.join(vendor, 'package.json'));
  const WebSocket = require('ws');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${xmppPort}`, 'xmpp');
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error('XMPP timeout')); }, 3000);
    ws.once('error', reject);
    ws.once('open', () => ws.send('<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="prod.ol.epicgames.com" version="1.0"/>'));
    ws.once('message', data => { clearTimeout(timeout); assert.match(data.toString(), /<open/); ws.close(); resolve(); });
  });
});

test('guest Play targets the VPN host while host Play stays local; player identities are distinct', { timeout: 30000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fortnite-multiplayer-test-'));
  const backends = [];
  t.after(async () => {
    await Promise.all(backends.map(backend => backend.stop()));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const instances = [];
  for (const [name, gameHost] of [['HostPlayer', '127.0.0.1'], ['GuestPlayer', '25.42.43.44']]) {
    const directory = path.join(temporary, name);
    fs.cpSync(vendor, directory, { recursive: true, filter: source => !['.git', 'node_modules'].includes(path.basename(source)) });
    fs.symlinkSync(path.join(vendor, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
    patchBackend(directory);
    const matchmaking = path.join(directory, 'structure', 'matchmaking.js');
    const once = fs.readFileSync(matchmaking, 'utf8');
    patchBackend(directory);
    assert.equal(fs.readFileSync(matchmaking, 'utf8'), once);
    const xmppPort = await unusedPort();
    const backend = await startBackend({ directory, port: await unusedPort(), xmppPort, gameHost });
    backends.push(backend);
    instances.push({ backend, name, gameHost, xmppPort });
  }
  const accountIds = [];
  for (const { backend, name, gameHost, xmppPort } of instances) {
    const headers = { 'content-type': 'application/json', 'user-agent': 'Fortnite/++Fortnite+Release-4.2-CL-4072250 Windows/10' };
    const auth = await (await fetch(`${backend.url}/account/api/oauth/token`, {
      method: 'POST', headers, body: JSON.stringify({ username: `${name}@local.invalid`, password: 'LocalOnly', grant_type: 'password' })
    })).json();
    accountIds.push(auth.account_id);
    const ticket = await (await fetch(`${backend.url}/fortnite/api/game/v2/matchmakingservice/ticket/player/${auth.account_id}?bucketId=123:EU:solo`, { headers })).json();
    assert.equal(ticket.serviceUrl, `ws://127.0.0.1:${xmppPort}`);
    const match = await (await fetch(`${backend.url}/fortnite/api/matchmaking/session/local`, { headers })).json();
    assert.equal(match.serverAddress, gameHost);
    assert.equal(match.serverPort, 7777);
    const profile = await (await fetch(`${backend.url}/fortnite/api/game/v2/profile/${auth.account_id}/client/QueryProfile?profileId=athena&rvn=-1`, { method: 'POST', headers, body: '{}' })).json();
    assert.equal(profile.profileChanges[0].profile.profileId, 'athena');
  }
  assert.deepEqual(accountIds, ['HostPlayer', 'GuestPlayer']);
  // A later solo launch must not inherit the guest route from any saved INI file.
  await backends[1].stop();
  const restarted = await startBackend({ directory: path.join(temporary, 'GuestPlayer'), port: await unusedPort(), xmppPort: await unusedPort() });
  backends.push(restarted);
  const match = await (await fetch(`${restarted.url}/fortnite/api/matchmaking/session/local`)).json();
  assert.equal(match.serverAddress, '127.0.0.1');
});

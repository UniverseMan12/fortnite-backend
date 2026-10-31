import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from './config.js';

export async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is already in use. Close the other service or the second backend instance.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
export async function startBackend({ port = 3551, xmppPort = 80, directory = path.join(ROOT, 'vendor', 'LawinServer') } = {}) {
  await assertFreePort(port); await assertFreePort(xmppPort);
  fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
  const log = fs.createWriteStream(path.join(ROOT, 'logs', 'backend.log'), { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} ---\n`);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), XMPP_PORT: String(xmppPort) }
  });
  let error;
  child.on('error', e => { error = e; });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.once('close', () => log.end());
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => { child.once('close', resolve); child.kill(); });
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (error) throw error;
      if (child.exitCode !== null) throw new Error('The backend stopped. See logs/backend.log for details.');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/local/health`, { signal: AbortSignal.timeout(500) });
        const status = await response.json();
        if (response.ok && status.service === 'fortnite-backend-local' && status.ready) return { child, stop, url: `http://127.0.0.1:${port}` };
      } catch {}
      await delay(100);
    }
    throw new Error('The backend did not become ready in time. See logs/backend.log for details.');
  } catch (error) { await stop(); throw error; }
}

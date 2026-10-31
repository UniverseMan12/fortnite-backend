import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { ROOT } from './config.js';

// Keep technical helper output in a log; only readiness drives the startup sequence.
export function startGame(mode) {
  const logPath = path.join(ROOT, 'logs', `${mode}-helper.log`);
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} ---\n`);
  const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'launch-game.ps1'), '-Mode', mode], {
    cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  let resolveReady, rejectReady, isReady = false;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // A startup failure may arrive while the coordinator is still awaiting another service.
  ready.catch(() => {});
  const label = mode === 'server' ? 'Game server' : 'Fortnite';
  const error = () => new Error(`${label} could not start. See logs/${mode}-helper.log.`);
  const timer = setTimeout(() => rejectReady(error()), 7 * 60 * 1000);
  const lines = createInterface({ input: helper.stdout });
  helper.stdout.pipe(log, { end: false });
  helper.stderr.pipe(log, { end: false });
  lines.on('line', line => {
    if (line.trim() === `LAUNCHER_READY:${mode}`) {
      isReady = true; clearTimeout(timer); resolveReady();
    }
  });
  helper.once('error', cause => { log.write(`${cause.message}\n`); rejectReady(error()); });
  const closed = new Promise(resolve => helper.once('close', (code, signal) => {
    clearTimeout(timer); lines.close(); log.end();
    if (!isReady) rejectReady(error());
    resolve({ code, signal });
  }));
  return {
    ready, closed,
    async stop() {
      if (helper.exitCode === null && helper.signalCode === null) helper.kill();
      await closed;
    }
  };
}

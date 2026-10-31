import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadiness } from '../src/readiness.js';

test('settings may stay open indefinitely, then normal readiness resumes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const phases = [];
  const r = createReadiness('server', phase => phases.push(phase), () => new Error('timeout'));
  r.line('LAUNCHER_CONFIGURE:server');
  t.mock.timers.tick(60 * 60 * 1000);
  r.line('LAUNCHER_STARTING:server');
  r.line('LAUNCHER_READY:server');
  await r.ready;
  assert.deepEqual(phases, ['configure', 'starting']);
  r.fail(); // Closing a ready process does not reject an already fulfilled startup.
});

test('timeout is restored after the Start server button', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = createReadiness('server', () => {}, () => new Error('timeout'));
  r.line('LAUNCHER_CONFIGURE:server');
  r.line('LAUNCHER_STARTING:server');
  const rejected = assert.rejects(r.ready, /timeout/);
  t.mock.timers.tick(3 * 60 * 1000);
  await rejected;
});

test('helper exit during playlist selection rejects startup', async () => {
  const r = createReadiness('server', () => {}, () => new Error('closed'));
  r.line('LAUNCHER_CONFIGURE:server');
  const rejected = assert.rejects(r.ready, /closed/);
  r.fail(); await rejected;
});

test('old server readiness cannot skip playlist selection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = createReadiness('server', () => {}, () => new Error('old server'));
  r.line('LAUNCHER_READY:server');
  const rejected = assert.rejects(r.ready, /old server/);
  t.mock.timers.tick(7 * 60 * 1000); await rejected;
});

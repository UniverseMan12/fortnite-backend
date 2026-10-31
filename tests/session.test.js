import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as tick } from 'node:timers/promises';
import { runSession } from '../src/session.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const started = [], stopped = [];
  const child = new EventEmitter(); child.exitCode = null;
  const backend = { child, stop: async () => { stopped.push('backend'); } };
  const games = {};
  for (const name of ['server', 'client']) {
    const ready = deferred(), closed = deferred();
    games[name] = {
      ready: ready.promise, closed: closed.promise,
      becomeReady: ready.resolve, fail: ready.reject, finish: closed.resolve,
      stop: async () => { stopped.push(name); closed.resolve({ code: 0 }); }
    };
  }
  const controller = new AbortController();
  const options = {
    startBackend: async () => { started.push('backend'); return backend; },
    startGame: mode => { started.push(mode); return games[mode]; },
    signal: controller.signal
  };
  return { options, controller, backend, games, started, stopped };
}

test('client waits for its host; client exit closes the session', async () => {
  const f = fixture(), running = runSession(f.options);
  await tick();
  assert.deepEqual(f.started, ['backend', 'server']);
  f.games.server.becomeReady(); await tick();
  assert.deepEqual(f.started, ['backend', 'server', 'client']);
  f.games.client.becomeReady(); await tick();
  f.games.client.finish({ code: 0 }); await running;
  assert.deepEqual(f.stopped, ['client', 'server', 'backend']);
});

test('failed host prevents client startup and releases backend', async () => {
  const f = fixture(), running = runSession(f.options);
  const failed = assert.rejects(running, /host failed/);
  await tick(); f.games.server.fail(new Error('host failed'));
  await failed;
  assert.deepEqual(f.started, ['backend', 'server']);
  assert.deepEqual(f.stopped, ['server', 'backend']);
});

test('cancellation during backend acquisition still cleans up acquired backend', async () => {
  const f = fixture(), acquired = deferred();
  f.options.startBackend = () => acquired.promise;
  const running = runSession(f.options);
  const failed = assert.rejects(running, /cancelled/);
  f.controller.abort(); acquired.resolve(f.backend);
  await failed;
  assert.deepEqual(f.started, []);
  assert.deepEqual(f.stopped, ['backend']);
});

test('cancellation while waiting for host closes host and backend', async () => {
  const f = fixture(), running = runSession(f.options);
  const failed = assert.rejects(running, /cancelled/);
  await tick(); f.controller.abort(); await failed;
  assert.deepEqual(f.stopped, ['server', 'backend']);
});

test('host exit while client starts closes the entire session', async () => {
  const f = fixture(), running = runSession(f.options);
  const failed = assert.rejects(running, /Game server stopped/);
  await tick(); f.games.server.becomeReady(); await tick();
  f.games.server.finish({ code: 1 }); await failed;
  assert.deepEqual(f.stopped, ['client', 'server', 'backend']);
});

test('backend exit while host starts prevents client launch', async () => {
  const f = fixture(), running = runSession(f.options);
  const failed = assert.rejects(running, /Backend stopped/);
  await tick(); f.backend.child.emit('exit', 1); await failed;
  assert.deepEqual(f.started, ['backend', 'server']);
  assert.deepEqual(f.stopped, ['server', 'backend']);
});

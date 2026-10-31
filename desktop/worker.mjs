import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareWorkspace } from './bootstrap.mjs';
import { validateOptions } from './options.mjs';

const controller = new AbortController();
const send = value => { if (process.connected) process.send(value); };
const status = (message, state = 'info') => send({ type: 'status', message, state });
let started = false;
process.on('disconnect', () => controller.abort());
process.on('message', async message => {
  if (message.type === 'stop') { controller.abort(); return; }
  if (message.type !== 'start' || started) return;
  started = true;
  try {
    const options = validateOptions(message.options);
    status('Checking your installation...', 'pending');
    let root = message.root;
    if (message.payload) {
      status('Preparing launcher files...', 'pending');
      root = await prepareWorkspace(message.payload, message.workspace, controller.signal);
      process.env.FORTNITE_LAUNCHER_BUNDLED = '1';
    }
    send({ type: 'workspace', root });
    const module = name => import(pathToFileURL(path.join(root, name)).href);
    const { prepareConfig, readConfig, saveConfig } = await module('src/config.js');
    const { validateHost, multiplayerName, hostAddresses } = await module('src/multiplayer.js');
    const { setup, verifyDll } = await module('scripts/setup.js');
    const { startBackend } = await module('src/backend.js');
    const { startGame } = await module('src/game.js');
    const { runSession } = await module('src/session.js');
    controller.signal.throwIfAborted();
    const host = message.action === 'launch' && options.mode === 'join' ? validateHost(options.host) : '127.0.0.1';
    const old = readConfig();
    const config = prepareConfig(options.gamePath, old);
    config.multiplayerName = /^Player_[a-f0-9]{12}$/.test(message.playerName ?? '') ? message.playerName : multiplayerName(old);
    if (options.mode !== 'solo') config.username = config.multiplayerName;
    saveConfig(config);
    send({ type: 'config', version: config.version, gamePath: config.gamePath });
    status(`Fortnite ${config.version} verified`, 'ok');
    if (message.action === 'check') {
      for (const name of ['sinum.dll', 'console.dll', 'memory.dll', 'reboot.dll']) {
        try { verifyDll(name); status(`${name}: verified`, 'ok'); }
        catch { status(`${name}: not ready. Use Prepare components.`, 'warning'); }
      }
    } else {
      status('Preparing components...', 'pending');
      await setup({ quiet: true, signal: controller.signal });
      controller.signal.throwIfAborted();
      status('Components ready', 'ok');
      if (message.action === 'launch') {
        await runSession({
          startBackend: () => startBackend({ gameHost: host, signal: controller.signal }),
          startGame: (mode, phase) => startGame(mode, phase, { multiplayer: options.mode !== 'solo', gameHost: host }),
          join: options.mode === 'join', signal: controller.signal,
          status: (text, state) => status(text.replace('Ctrl+C stops everything.', 'Use Stop session to close the game.'), state),
          onHostReady: () => { if (options.mode === 'host') send({ type: 'addresses', addresses: hostAddresses() }); }
        });
      }
    }
    send({ type: 'done', cancelled: controller.signal.aborted });
  } catch (error) {
    if (controller.signal.aborted) send({ type: 'done', cancelled: true });
    else send({ type: 'failure', message: error.message });
  } finally { if (process.connected) process.disconnect(); }
});

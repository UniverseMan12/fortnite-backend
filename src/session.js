// Hosts wait for their game port; guests run a client against a remote host.
// Every exit path closes owned processes, including partial startup failures.
export async function runSession({ startBackend, startGame, status = () => {}, signal, join = false, onHostReady = () => {} }) {
  const resources = [];
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  failure.catch(() => {});
  const abort = () => rejectFailure(new Error('Startup cancelled.'));
  signal?.addEventListener('abort', abort, { once: true });
  let backend, backendExit;
  try {
    if (signal?.aborted) throw new Error('Startup cancelled.');
    status('Starting backend...', 'pending');
    // Do not race acquisition: resources must be registered even if cancelled midway.
    backend = await startBackend(); resources.push(backend);
    backendExit = () => rejectFailure(new Error('Backend stopped. See logs/backend.log.'));
    backend.child.once('exit', backendExit);
    if (backend.child.exitCode !== null || signal?.aborted) throw new Error('Backend stopped or startup was cancelled.');
    status('Backend ready', 'ok');
    if (!join) {
      status('Opening server settings...', 'pending');
      const server = startGame('server', phase => {
        if (phase === 'configure') status('Choose a playlist in Reboot, then click Start server.', 'info');
        if (phase === 'starting') status('Starting server...', 'pending');
      }); resources.push(server);
      server.closed.then(() => rejectFailure(new Error('Game server stopped. See logs/server-helper.log.')));
      await Promise.race([server.ready, failure]);
      if (signal?.aborted) throw new Error('Startup cancelled.');
      status('Server listening', 'ok');
      onHostReady();
    }
    status('Starting Fortnite...', 'pending');
    const client = startGame('client'); resources.push(client);
    await Promise.race([client.ready, failure]);
    status(join ? 'Fortnite ready. Press Play when the host is ready.' : 'Fortnite ready. Press Play in the lobby.', 'ok');
    status('Keep this window open. Ctrl+C stops everything.', 'info');
    const result = await Promise.race([client.closed, failure]);
    if (result.code !== 0) throw new Error('Fortnite stopped unexpectedly. See logs/client-helper.log.');
  } finally {
    signal?.removeEventListener('abort', abort);
    if (backendExit) backend.child.removeListener('exit', backendExit);
    await Promise.allSettled(resources.reverse().map(resource => resource.stop()));
  }
}

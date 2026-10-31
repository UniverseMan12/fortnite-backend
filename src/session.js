// Start the client only after this session's host has opened its game port.
// Every exit path closes owned processes, including partial startup failures.
export async function runSession({ startBackend, startGame, status = () => {}, signal }) {
  const resources = [];
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  failure.catch(() => {});
  const abort = () => rejectFailure(new Error('Startup cancelled.'));
  signal?.addEventListener('abort', abort, { once: true });
  let backend, backendExit;
  try {
    if (signal?.aborted) throw new Error('Startup cancelled.');
    status('Starting backend...');
    // Do not race acquisition: resources must be registered even if cancelled midway.
    backend = await startBackend(); resources.push(backend);
    backendExit = () => rejectFailure(new Error('Backend stopped. See logs/backend.log.'));
    backend.child.once('exit', backendExit);
    if (backend.child.exitCode !== null || signal?.aborted) throw new Error('Backend stopped or startup was cancelled.');
    status('Starting local server...');
    const server = startGame('server'); resources.push(server);
    server.closed.then(() => rejectFailure(new Error('Game server stopped. See logs/server-helper.log.')));
    await Promise.race([server.ready, failure]);
    if (signal?.aborted) throw new Error('Startup cancelled.');
    status('Starting Fortnite...');
    const client = startGame('client'); resources.push(client);
    await Promise.race([client.ready, failure]);
    status('Fortnite is open. Press Play in the lobby.');
    status('Keep this window open. Ctrl+C stops everything.');
    const result = await Promise.race([client.closed, failure]);
    if (result.code !== 0) throw new Error('Fortnite stopped unexpectedly. See logs/client-helper.log.');
  } finally {
    signal?.removeEventListener('abort', abort);
    if (backendExit) backend.child.removeListener('exit', backendExit);
    await Promise.allSettled(resources.reverse().map(resource => resource.stop()));
  }
}

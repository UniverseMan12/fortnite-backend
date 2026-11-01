import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function hashFile(file, {signal, onProgress = () => {}} = {}) {
  const hash = crypto.createHash('sha256');
  let received = 0;
  for await (const bytes of createReadStream(file, {highWaterMark: 4 * 1024 * 1024})) {
    signal?.throwIfAborted();
    hash.update(bytes); received += bytes.length; onProgress(received);
  }
  signal?.throwIfAborted();
  return hash.digest('hex');
}

async function partialSize(file) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Download cache is not a regular private file.');
    return stat.size;
  } catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}

// The fixed source and digest come from the bundled manifest, never the renderer.
export async function downloadGameArchive(source, file, {
  signal, progress = () => {}, fetchImpl = fetch, attempts = 3, retryDelayMs = 1000, idleTimeoutMs = 120000
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(source.sha256) || !Number.isSafeInteger(source.size) || source.size <= 0) throw new Error('Invalid game download manifest.');
  let offset = await partialSize(file);
  if (offset > source.size) throw new Error('Download cache exceeds the expected game size.');
  for (let attempt = 1; offset < source.size; attempt++) {
    signal?.throwIfAborted();
    const idle = new AbortController();
    const combined = signal ? AbortSignal.any([signal, idle.signal]) : idle.signal;
    let timer, handle, response;
    const resetTimeout = () => { clearTimeout(timer); timer = setTimeout(() => idle.abort(new Error('Game download timed out. Retry to resume.')), idleTimeoutMs); };
    try {
      resetTimeout();
      response = await fetchImpl(source.url, {headers: {Range: `bytes=${offset}-`, 'Accept-Encoding': 'identity'}, signal: combined});
      if (![200,206].includes(response.status)) throw Object.assign(new Error(`Google Drive could not provide the game (HTTP ${response.status}). Its quota or sharing may be unavailable. Try again later or select an existing game folder.`), {fatal: response.status < 500 && response.status !== 429});
      if ((response.headers.get('content-type') || '').includes('text/') || response.headers.get('content-type')?.includes('json')) throw Object.assign(new Error('Google Drive returned a page instead of the game. Try again later or use the game-files link in Settings.'), {fatal: true});
      if (response.status === 206) {
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
        if (!range || Number(range[1]) !== offset || Number(range[2]) !== source.size - 1 || Number(range[3]) !== source.size) throw Object.assign(new Error('The server returned an unexpected download range. Existing partial data was kept.'), {fatal: true});
      } else offset = 0; // A server without Range support safely restarts, never appends.
      const length = response.headers.get('content-length');
      if (length !== null && Number(length) !== source.size - offset) throw Object.assign(new Error('The game download size has changed. Update the launcher.'), {fatal: true});
      // Recheck before opening; the cache may outlive an interrupted launcher.
      await partialSize(file);
      handle = await fs.open(file, offset ? 'a' : 'w');
      progress({stage:'downloading', received:offset, total:source.size});
      for await (const bytes of response.body) {
        combined.throwIfAborted(); resetTimeout();
        if (offset + bytes.length > source.size) throw Object.assign(new Error('The server exceeded the expected game size.'), {fatal:true});
        await handle.writeFile(bytes); offset += bytes.length;
        progress({stage:'downloading', received:offset, total:source.size});
      }
      if (offset !== source.size) throw new Error('The game download was interrupted. Retry to resume.');
    } catch (error) {
      signal?.throwIfAborted();
      if (error.fatal || error.code || attempt >= attempts) throw error;
      progress({stage:'retrying', received:offset, total:source.size});
      await delay(retryDelayMs * attempt, undefined, {signal});
    } finally {
      clearTimeout(timer);
      await handle?.close();
      try { await response?.body?.cancel(); } catch {}
    }
  }
  progress({stage:'verifying', received:0, total:source.size});
  const digest = await hashFile(file, {signal, onProgress:received => progress({stage:'verifying', received, total:source.size})});
  if (digest !== source.sha256) {
    // Only this installer's fixed cache file is removed; no game folder is touched.
    await fs.unlink(file);
    throw new Error('The game checksum did not match. The damaged download was removed; retry to download a fresh copy.');
  }
  return file;
}

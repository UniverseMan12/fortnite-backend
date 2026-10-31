import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

class DownloadError extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}

// A failed or interrupted transfer must never replace a working component.
export async function downloadVerified(url, destination, {
  sha256, maxBytes = 64 * 1024 * 1024, timeoutMs = 120000,
  attempts = 3, retryDelayMs = 1000, signal
} = {}) {
  if (!/^[a-f0-9]{64}$/i.test(sha256 ?? '')) throw new Error('A pinned SHA-256 checksum is required.');
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid download limits.');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const temporary = destination + '.' + crypto.randomUUID() + '.part';
    let handle;
    try {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(timeoutMs);
      const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!response.ok) {
        await response.body?.cancel();
        throw new DownloadError(`Download failed (HTTP ${response.status}). Retry startup; an expired build needs a new pinned artifact.`, response.status === 429 || response.status >= 500);
      }
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel(); throw new DownloadError('Download exceeds the component size limit.');
      }
      handle = await fs.open(temporary, 'wx');
      let received = 0;
      const hash = crypto.createHash('sha256');
      for await (const chunk of response.body) {
        received += chunk.byteLength;
        if (received > maxBytes) throw new DownloadError('Download exceeds the component size limit.');
        hash.update(chunk); await handle.writeFile(chunk);
      }
      if (hash.digest('hex') !== sha256.toLowerCase()) throw new DownloadError('Downloaded checksum does not match. Existing component was kept.');
      await handle.sync(); await handle.close(); handle = undefined;
      await fs.rename(temporary, destination);
      return;
    } catch (error) {
      if (signal?.aborted || attempt === attempts || error.retryable === false || error.code) throw error;
      await delay(retryDelayMs * attempt, undefined, { signal });
    } finally {
      await handle?.close();
      await fs.rm(temporary, { force: true });
    }
  }
}

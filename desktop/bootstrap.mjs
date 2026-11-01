import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function prepareWorkspace(payload, destination, signal) {
  signal?.throwIfAborted();
  const manifestText = await fs.readFile(path.join(payload, 'payload.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const digest = crypto.createHash('sha256').update(manifestText).digest('hex');
  const root = path.join(destination, digest.slice(0, 16));
  let complete;
  try { complete = await fs.readFile(path.join(root, '.complete'), 'utf8'); } catch {}
  signal?.throwIfAborted();
  if (complete === digest) return root;
  await fs.mkdir(root, { recursive: true });
  for (const [relative, expected] of Object.entries(manifest.files)) {
    signal?.throwIfAborted();
    if (/[\\:\0]/.test(relative) || relative.split('/').some(p => !p || p === '..' || p === '.') || path.isAbsolute(relative)) throw new Error('Invalid bundled file path.');
    const source = await fs.readFile(path.join(payload, relative));
    if (crypto.createHash('sha256').update(source).digest('hex') !== expected) throw new Error(`Damaged installer component: ${relative}. Reinstall the launcher.`);
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, source);
  }
  await fs.writeFile(path.join(root, '.complete'), digest);
  return root;
}

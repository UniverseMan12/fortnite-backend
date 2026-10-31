import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function installBackendManifest(directory) {
  let changed = false;
  for (const name of ['package.json', 'package-lock.json']) {
    const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'backend-dependencies', name));
    const target = path.join(directory, name);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(source)) {
      fs.writeFileSync(target, source); changed = true;
    }
  }
  return changed;
}

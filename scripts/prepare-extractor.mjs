import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT } from '../src/config.js';
import { hashFile } from '../src/game-download.js';
import { downloadVerified } from './download.js';

export async function prepareExtractor({signal} = {}) {
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT,'game-download.json'),'utf8'));
  const directory = path.join(ROOT,'runtime','7zip');
  await fs.mkdir(directory,{recursive:true});
  for (const [name,url,sha256] of [['7zr.exe',manifest.extractor.url,manifest.extractor.sha256],['7zip-source.tar.xz',manifest.extractor.sourceUrl,manifest.extractor.sourceSha256]]) {
    const file = path.join(directory,name);
    const current = await hashFile(file,{signal}).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if (current !== sha256) await downloadVerified(url,file,{sha256,signal});
  }
  await fs.copyFile(path.join(path.dirname(fileURLToPath(import.meta.url)),'7ZIP-NOTICE.txt'),path.join(directory,'NOTICE.txt'));
  return directory;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareExtractor();

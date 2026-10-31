import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from '../src/config.js';
const dist=path.join(ROOT,'dist');
const assets=fs.readdirSync(dist).filter(name=>/^Fortnite-Launcher-0\.3\.0-x64-(nsis|portable)\.exe$/.test(name));
if(assets.length!==2)throw new Error('Both installer and portable EXEs must exist.');
fs.writeFileSync(path.join(dist,'SHA256SUMS.txt'),assets.map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')+'  '+name).join('\n')+'\n');
fs.writeFileSync(path.join(dist,'RELEASE-NOTES.md'),`# Fortnite Launcher 0.3.0\n\nA cinematic redesign with original island artwork, bold typography, animated session cards, reduced-motion support and clearer status indicators.

A desktop launcher for Fortnite 4.2 with Solo, Host and Join, folder selection, automatic component setup, installation checks, activity logs and session cleanup.\n\nChoose the nsis EXE to install, or portable to run without installing. Node.js and Git are not required. Windows 10/11 x64, Fortnite 4.2 and the Visual C++ x64 runtime are required. First component preparation needs internet. The EXEs are unsigned.\n\nOpen Setup, choose the folder containing FortniteGame and Engine, then choose your mode and click Launch Fortnite. When hosting, choose a playlist in Reboot and click Start server, then Play in Fortnite.\n\nSource and instructions: https://github.com/UniverseMan12/fortnite-backend\nValidation and known limits: https://github.com/UniverseMan12/fortnite-backend/blob/main/RELEASE_QA.md\n`);
console.log(assets.join('\n'));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {spawnSync} from 'node:child_process';
import {run} from '../scripts/setup.js';

test('setup commands report failures and timeouts without blocking the event loop', {timeout:10000}, async () => {
  await run(process.execPath,['-e','process.exit(0)']);
  await assert.rejects(run(process.execPath,['-e','process.exit(7)']),/failed: 7/);
  await assert.rejects(run('nonexistent-launcher-test-command',[]),/ENOENT/);
  await assert.rejects(run(process.execPath,['-e','setInterval(()=>{},1000)'],undefined,false,{timeoutMs:250}),/timed out/);
});

test('cancelling setup terminates the owned Windows command tree', {skip:process.platform!=='win32',timeout:10000}, async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-setup-process-'));
  let descendant;
  t.after(()=>{
    if(descendant) spawnSync('taskkill.exe',['/PID',String(descendant),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    fs.rmSync(root,{recursive:true,force:true});
  });
  fs.writeFileSync(path.join(root,'parent.cjs'),`const {spawn}=require('node:child_process'); const fs=require('node:fs'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true}); fs.writeFileSync('child.pid',String(child.pid)); setInterval(()=>{},1000);`);
  const controller=new AbortController();
  const running=run(process.execPath,['parent.cjs'],root,false,{signal:controller.signal});
  const rejected=assert.rejects(running,/abort/i);
  for(let i=0;i<100 && !fs.existsSync(path.join(root,'child.pid'));i++) await delay(20);
  assert.ok(fs.existsSync(path.join(root,'child.pid')));
  descendant=Number(fs.readFileSync(path.join(root,'child.pid'),'utf8'));
  controller.abort(); await rejected;
  for(let i=0;i<50;i++) {try{process.kill(descendant,0);}catch{descendant=undefined;break;}await delay(20);}
  assert.equal(descendant,undefined,'setup descendant must not remain running');
});

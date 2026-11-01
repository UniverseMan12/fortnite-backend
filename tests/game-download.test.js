import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { downloadGameArchive } from '../src/game-download.js';

const bytes = crypto.randomBytes(512*1024), digest = crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture(t, handler) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'game-download-test-'));
  const server = http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
  return {file:path.join(dir,'game.part'),source:{url:`http://127.0.0.1:${server.address().port}`,size:bytes.length,sha256:digest}};
}
function sendRange(req,res, startOverride) {
  const offset = startOverride ?? Number(/^bytes=(\d+)-$/.exec(req.headers.range)?.[1] || 0);
  res.writeHead(206,{'Content-Type':'application/octet-stream','Content-Length':bytes.length-offset,'Content-Range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`});
  res.end(bytes.subarray(offset));
}
test('game download resumes a partial archive and verifies the complete SHA-256', async t=>{
  let requested;
  const {file,source}=await fixture(t,(req,res)=>{requested=req.headers.range;sendRange(req,res);});
  await fs.writeFile(file,bytes.subarray(0,12345));
  await downloadGameArchive(source,file);
  assert.equal(requested,'bytes=12345-');
  assert.deepEqual(await fs.readFile(file),bytes);
});
test('a server ignoring Range safely restarts instead of appending duplicate bytes',async t=>{
  const {file,source}=await fixture(t,(_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes);});
  await fs.writeFile(file,bytes.subarray(0,12345));
  await downloadGameArchive(source,file);
  assert.deepEqual(await fs.readFile(file),bytes);
});
test('game download rejects incorrect ranges, HTML and corrupted bytes',async t=>{
  let behavior='range';
  const {file,source}=await fixture(t,(req,res)=>{
    if(behavior==='range')return sendRange(req,res,0);
    if(behavior==='html'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('Quota exceeded');}
    res.writeHead(200,{'Content-Length':bytes.length});res.end(Buffer.alloc(bytes.length));
  });
  await fs.writeFile(file,bytes.subarray(0,100));
  await assert.rejects(downloadGameArchive(source,file),/unexpected download range/);
  assert.equal((await fs.stat(file)).size,100);
  behavior='html';
  await assert.rejects(downloadGameArchive(source,file),/returned a page/);
  behavior='corrupt';
  await assert.rejects(downloadGameArchive(source,file),/checksum/);
  await assert.rejects(fs.stat(file),{code:'ENOENT'});
});
test('cancelled game downloads retain partial bytes and resume on the next attempt',async t=>{
  const {file,source}=await fixture(t,(req,res)=>sendRange(req,res));
  const controller=new AbortController();
  await assert.rejects(downloadGameArchive(source,file,{signal:controller.signal,progress:p=>{if(p.stage==='downloading'&&p.received>0)controller.abort();}}),/abort/i);
  assert.ok((await fs.stat(file)).size>0);
  await downloadGameArchive(source,file);
  assert.deepEqual(await fs.readFile(file),bytes);
});
test('a dropped connection retries from the last saved byte',async t=>{
  const offsets=[];
  const {file,source}=await fixture(t,(req,res)=>{
    const offset=Number(/^bytes=(\d+)-$/.exec(req.headers.range)[1]);offsets.push(offset);
    if(offsets.length>1)return sendRange(req,res);
    res.writeHead(206,{'Content-Length':bytes.length,'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`});
    res.write(bytes.subarray(0,65536));setTimeout(()=>res.destroy(),30);
  });
  await downloadGameArchive(source,file,{retryDelayMs:1});
  assert.equal(offsets.length,2);assert.ok(offsets[1]>0);
  assert.deepEqual(await fs.readFile(file),bytes);
});

test('download cache hard links cannot overwrite another file',async t=>{
  let requests=0;
  const {file,source}=await fixture(t,(req,res)=>{requests++;sendRange(req,res);});
  const existing=file+'.existing';await fs.writeFile(existing,'keep this file');
  await fs.link(existing,file);
  await assert.rejects(downloadGameArchive(source,file),/regular private file/);
  assert.equal(requests,0);
  assert.equal(await fs.readFile(existing,'utf8'),'keep this file');
});

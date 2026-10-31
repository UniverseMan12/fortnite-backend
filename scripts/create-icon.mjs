import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from '../src/config.js';
// Original geometric F / return-arrow mark, rendered without a font dependency.
function inside(x, y, points) {
  let result = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [a,b]=points[i], [c,d]=points[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) result=!result;
  }
  return result;
}
const size=256, raw=Buffer.alloc((size*4+1)*size);
const f=[[62,56],[180,56],[171,88],[100,88],[91,119],[146,119],[137,150],[83,150],[67,204],[24,204]];
const arrow=[[128,83],[231,83],[231,174],[204,149],[204,131],[139,196],[116,173],[181,108],[153,108]];
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const p=y*(size*4+1)+1+x*4;
  const dx=Math.max(32-x,0,x-223),dy=Math.max(32-y,0,y-223);
  let color=dx*dx+dy*dy>32*32?[0,0,0,0]:[16,17,26,255];
  if(inside(x,y,f)) color=[243,240,255,255];
  if(inside(x,y,arrow)) color=[212,255,136,255];
  for(let i=0;i<4;i++)raw[p+i]=color[i];
}
function crc32(buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
fs.mkdirSync(path.join(ROOT,'build'),{recursive:true});fs.writeFileSync(path.join(ROOT,'build','icon.png'),png);fs.writeFileSync(path.join(ROOT,'build','icon.ico'),Buffer.concat([ico,png]));

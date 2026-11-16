/** Lossless encodings of existing art; original assets stay available. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root = resolve('public');
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
const paths = [...new Set(report.results[0].load.entries.map(e => new URL(e.url).pathname).filter(p => p.endsWith('.png')))];
const records = [], hash = b => createHash('sha256').update(b).digest('hex');
function visible(buffer) {
  for (let i=0;i<buffer.length;i+=4) if (!buffer[i+3]) buffer.fill(0,i,i+3);
  return buffer;
}
let at=0;
await Promise.all(Array.from({length:4},async()=>{
  while(at<paths.length){
    const path=paths[at++], source=resolve(root,'.'+path);
    assert.ok(relative(root,source).startsWith('assets/'));
    const original=await readFile(source); if(original.length<8000)continue;
    const output=await sharp(original).webp({lossless:true,effort:6}).toBuffer();
    if(output.length>original.length*.9)continue;
    const before=visible(await sharp(original).ensureAlpha().raw().toBuffer());
    const after=visible(await sharp(output).ensureAlpha().raw().toBuffer());
    assert.deepEqual(before,after,path+' visible RGBA changed');
    const target='/assets/optimized-startup/'+path.slice('/assets/'.length).replace(/\.png$/,'.webp');
    const dest=resolve(root,'.'+target);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,output);
    records.push({source:path,target,sourceBytes:original.length,bytes:output.length,sourceSHA256:hash(original),pixelSHA256:hash(before)});
  }
}));
records.sort((a,b)=>a.source.localeCompare(b.source));
await writeFile('public/assets/optimized-startup/manifest.json',JSON.stringify({version:1,encoding:'WebP lossless, identical visible RGBA',images:records},null,2)+'\n');
console.log(JSON.stringify({files:records.length,before:records.reduce((s,r)=>s+r.sourceBytes,0),after:records.reduce((s,r)=>s+r.bytes,0)}));

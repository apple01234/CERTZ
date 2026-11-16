/** Bundle the measured first region's shared images byte-for-byte, preserving texture keys. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('public');
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
const paths=[...new Set(report.results[0].load.entries.map(e=>new URL(e.url).pathname))].sort();
const images={},chunks=[];let offset=0;
for(const path of paths){
  if(!/\.(webp|png)$/.test(path)||path.includes('/title/')||/^\/assets\/(?:glow|tree|fragment)\.webp$/.test(path))continue;
  if(/^\/assets\/(?:ch[fm]\d+|job[fm]_|cost[fm]_|gm_)/.test(path))continue;
  const file=resolve(root,'.'+path);assert.ok(relative(root,file).startsWith('assets/'));
  const bytes=await readFile(file);
  images[path.slice(1)]={offset,length:bytes.length,type:path.endsWith('.webp')?'image/webp':'image/png'};
  chunks.push(bytes);offset+=bytes.length;
}
const data=Buffer.concat(chunks),packed=gzipSync(data,{level:9});
// ponytail: split by scene if the shared first-region package exceeds 20 MiB.
assert.ok(data.length<=20*1024*1024,'shared startup package exceeds its memory budget');
await mkdir('public/assets/startup-bundle',{recursive:true});
const digest=createHash('sha256').update(packed).digest('hex');
const url=`assets/startup-bundle/shared-${digest.slice(0,16)}.bin`;
await writeFile(resolve(root,url),packed);
await writeFile('public/assets/startup-bundle/manifest.json',JSON.stringify({version:1,url,encoding:'gzip',bytes:packed.length,decodedBytes:data.length,sha256:digest,images},null,2)+'\n');
for(const [path,r]of Object.entries(images))assert.deepEqual(data.subarray(r.offset,r.offset+r.length),await readFile(resolve(root,path)));
console.log(JSON.stringify({images:Object.keys(images).length,bytes:packed.length,decodedBytes:data.length,url}));

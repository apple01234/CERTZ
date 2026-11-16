/** Bundle the measured first region's shared images byte-for-byte, preserving texture keys. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('public');
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
const previous=JSON.parse(await readFile('public/assets/startup-bundle/manifest.json','utf8'));
const measured=report.results[0].load.entries.map(e=>new URL(e.url).pathname);
const paths=[...new Set(measured.flatMap(path=>{
  if(!path.endsWith('.bin'))return[path];
  return Object.entries(previous.images).filter(([,r])=>(previous.packages?.[r.package]?.url??previous.url)===path.slice(1)).map(([url])=>'/'+url);
}))].sort();
const optimized=JSON.parse(await readFile('public/assets/optimized-startup/manifest.json','utf8'));
const replacements=new Map(optimized.images.map(r=>[r.source,r.target]));
const images={},packages=[],groups={essential:[],effects:[]};
for(const path of paths){
  if(!/\.(webp|png)$/.test(path)||path.includes('/title/')||/^\/assets\/(?:glow|tree|fragment)\.webp$/.test(path))continue;
  if(/^\/assets\/(?:ch[fm]\d+|job[fm]_|cost[fm]_|gm_)/.test(path))continue;
  const url=replacements.get(path)??path;
  const file=resolve(root,'.'+url);assert.ok(relative(root,file).startsWith('assets/'));
  const bytes=await readFile(file);
  const effect=/(?:^|\/)(?:optimized-startup\/)?(?:fx\d*\/|vfx\d*\/|aura\/|(?:gv|hv|vf|vx|gw|fx|vfx|cp)_)/.test(url);
  groups[effect?'effects':'essential'].push({url,bytes});
}
await mkdir('public/assets/startup-bundle',{recursive:true});
const LIMIT=2*1024*1024;
for(const [group,entries]of Object.entries(groups)){
 let batch=[],size=0;
 async function flush(){
  if(!batch.length)return;
  const data=Buffer.concat(batch.map(r=>r.bytes)),packed=gzipSync(data,{level:9});
  const sha256=createHash('sha256').update(packed).digest('hex'),url=`assets/startup-bundle/${group}-${sha256.slice(0,16)}.bin`;
  let offset=0;
  for(const r of batch){images[r.url.slice(1)]={package:packages.length,offset,length:r.bytes.length,type:r.url.endsWith('.webp')?'image/webp':'image/png'};assert.deepEqual(data.subarray(offset,offset+r.bytes.length),r.bytes);offset+=r.bytes.length;}
  packages.push({group,url,encoding:'gzip',bytes:packed.length,decodedBytes:data.length,sha256});
  await writeFile(resolve(root,url),packed);batch=[];size=0;
 }
 for(const r of entries){
  assert.ok(r.bytes.length<=LIMIT,'single image exceeds package memory budget: '+r.url);
  if(size+r.bytes.length>LIMIT)await flush();
  batch.push(r);size+=r.bytes.length;
 }
 await flush();
}
await writeFile('public/assets/startup-bundle/manifest.json',JSON.stringify({version:2,packages,images},null,2)+'\n');
console.log(JSON.stringify({images:Object.keys(images).length,packages:packages.length,bytes:packages.reduce((n,p)=>n+p.bytes,0),maxDecodedBytes:Math.max(...packages.map(p=>p.decodedBytes))}));

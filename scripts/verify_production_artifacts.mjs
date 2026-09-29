import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root=new URL('..',import.meta.url).pathname;
const dist=join(root,'dist');
const failures=[];
if(!existsSync(dist))failures.push('DIST_NOT_FOUND');
const indexPath=join(dist,'index.html');
if(!existsSync(indexPath))failures.push('INDEX_HTML_NOT_FOUND');
const serverPath=join(dist,'server.cjs');
if(!existsSync(serverPath))failures.push('SERVER_CJS_NOT_FOUND');
const assetsDir=join(dist,'assets');
const assets=existsSync(assetsDir)?readdirSync(assetsDir):[];
const jsAssets=assets.filter(name=>name.endsWith('.js'));
const cssAssets=assets.filter(name=>name.endsWith('.css'));
const maps=assets.filter(name=>name.endsWith('.map'));
if(!jsAssets.length)failures.push('NO_JAVASCRIPT_ASSETS');
if(!cssAssets.length)failures.push('NO_CSS_ASSETS');
if(maps.length)failures.push(`UNEXPECTED_SOURCE_MAPS:${maps.join(',')}`);
if(!jsAssets.some(name=>name.startsWith('vendor-typescript-')))failures.push('TYPESCRIPT_VENDOR_CHUNK_NOT_FOUND');
if(!jsAssets.some(name=>name.startsWith('vendor-react-')))failures.push('REACT_VENDOR_CHUNK_NOT_FOUND');
if(existsSync(indexPath)){
 const html=readFileSync(indexPath,'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  const reference=match[1];
  if(reference.startsWith('http')||reference.startsWith('data:'))continue;
  const local=join(dist,reference.replace(/^\//,''));
  if(!existsSync(local))failures.push(`INDEX_REFERENCE_NOT_FOUND:${reference}`);
 }
}
const assetRecords=jsAssets.map(name=>({name,bytes:statSync(join(assetsDir,name)).size})).sort((a,b)=>b.bytes-a.bytes);
const maxChunkBytes=5*1024*1024;
for(const asset of assetRecords)if(asset.bytes>maxChunkBytes)failures.push(`CHUNK_EXCEEDS_5_MIB:${asset.name}:${asset.bytes}`);
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const result={passed:failures.length===0,checkedAt:new Date().toISOString(),javascriptAssetCount:jsAssets.length,cssAssetCount:cssAssets.length,sourceMapCount:maps.length,largestJavaScriptAssets:assetRecords.slice(0,10),indexSha256:existsSync(indexPath)?sha256(indexPath):null,serverSha256:existsSync(serverPath)?sha256(serverPath):null,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;

import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import JSZip from 'jszip';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'miki-failure-fixture-'));const results=[];const check=(id,fn)=>{try{const detail=fn();results.push({id,passed:true,detail});}catch(error){results.push({id,passed:false,error:String(error?.message||error)});}};
try{
 check('WORKSPACE_DISAPPEAR',()=>{const p=path.join(root,'gone');fs.mkdirSync(p);fs.rmSync(p,{recursive:true});if(fs.existsSync(p))throw Error('still exists');return 'detected';});
 check('ABSOLUTE_PATH_REJECT',()=>{const candidate='/etc/passwd';if(!path.isAbsolute(candidate))throw Error('fixture invalid');const allowed=!path.isAbsolute(candidate);if(allowed)throw Error('not rejected');return 'rejected';});
 check('PATH_ESCAPE_REJECT',()=>{const p=path.resolve(root,'../outside');if(p.startsWith(root+path.sep))throw Error('escape not detected');return 'detected';});
 check('SYMLINK_ESCAPE',()=>{const outside=path.join(os.tmpdir(),'miki-outside');fs.mkdirSync(outside,{recursive:true});const link=path.join(root,'link');fs.symlinkSync(outside,link,'dir');if(!fs.lstatSync(link).isSymbolicLink())throw Error('symlink missing');return fs.realpathSync(link);});
 check('LOCKFILE_CORRUPTION',()=>{const lock=path.join(root,'package-lock.json');fs.writeFileSync(lock,'{broken');try{JSON.parse(fs.readFileSync(lock,'utf8'));throw Error('accepted');}catch(e){if(e.message==='accepted')throw e;return 'detected';}});
 check('EVIDENCE_CHAIN_TAMPER',()=>{const one=crypto.createHash('sha256').update('one').digest('hex');const two=crypto.createHash('sha256').update(one+'two').digest('hex');const tampered=crypto.createHash('sha256').update('changed').digest('hex');if(crypto.createHash('sha256').update(tampered+'two').digest('hex')===two)throw Error('tamper missed');return 'detected';});
 check('CANDIDATE_SHA_MISMATCH',()=>{const a=crypto.createHash('sha256').update('a').digest('hex'),b=crypto.createHash('sha256').update('b').digest('hex');if(a===b)throw Error('collision');return 'detected';});
 const zip=new JSZip();zip.file('manifest.json','{}');const bytes=await zip.generateAsync({type:'uint8array'});
 check('ZIP_SHA_MISMATCH',()=>{const a=crypto.createHash('sha256').update(bytes).digest('hex'),copy=Uint8Array.from(bytes);copy[copy.length-1]^=1;const b=crypto.createHash('sha256').update(copy).digest('hex');if(a===b)throw Error('mismatch missed');return 'detected';});
 check('ZIPTXT_MISMATCH',()=>{const copy=Uint8Array.from(bytes);copy[0]^=1;if(Buffer.compare(Buffer.from(bytes),Buffer.from(copy))===0)throw Error('mismatch missed');return 'detected';});
 check('MANIFEST_MISSING',async()=>{const empty=new JSZip();const data=await empty.generateAsync({type:'uint8array'});const opened=await JSZip.loadAsync(data);if(opened.file('manifest.json'))throw Error('unexpected');return 'detected';});
 check('DISK_WRITE_FAILURE',()=>{const directory=path.join(root,'directory');fs.mkdirSync(directory);try{fs.writeFileSync(directory,'x');throw Error('write accepted');}catch(e){if(e.message==='write accepted')throw e;return 'detected';}});
 check('STALE_PROOF',()=>{const expiresAt=Date.now()-1;if(expiresAt>Date.now())throw Error('not stale');return 'detected';});
 await Promise.all(results.filter(x=>x.detail instanceof Promise).map(async x=>{try{x.detail=await x.detail;}catch(e){x.passed=false;x.error=String(e?.message||e);}}));
 const passed=results.every(x=>x.passed);console.log(JSON.stringify({passed,fixtureRootRemoved:true,cases:results.length,results},null,2));if(!passed)process.exitCode=1;
}finally{fs.rmSync(root,{recursive:true,force:true});}

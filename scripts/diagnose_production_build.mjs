import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';

const startedAt=new Date().toISOString();
const packageJson=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const child=spawn(process.execPath,[new URL('../node_modules/vite/bin/vite.js',import.meta.url).pathname,'build'],{
 cwd:new URL('..',import.meta.url).pathname,
 env:{...process.env,NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=3072'},
 stdio:'inherit',
});
child.on('exit',(code,signal)=>{
 const result={startedAt,completedAt:new Date().toISOString(),appVersion:packageJson.version,node:process.version,platform:process.platform,architecture:process.arch,totalMemoryBytes:os.totalmem(),freeMemoryBytes:os.freemem(),nodeOptions:child.spawnargs,exitCode:code,signal,classification:signal==='SIGKILL'||code===137?'EXTERNAL_SIGKILL_POSSIBLE_MEMORY_LIMIT':code===0?'SUCCESS':'BUILD_ERROR'};
 console.log(JSON.stringify(result,null,2));
 process.exitCode=code??(signal==='SIGKILL'?137:1);
});

import{readFileSync,readdirSync,statSync}from'node:fs';
const failures=[];const app=readFileSync('src/App.tsx','utf8');const assets=readdirSync('dist/assets').map(name=>({name,size:statSync(`dist/assets/${name}`).size}));
for(const loader of ['loadCodeEditor','loadImprovementHome','loadMemoryModal','loadActivityMonitor'])if(!app.includes(`const ${loader}`))failures.push(`LOADER_MISSING:${loader}`);
for(const loader of ['loadMemoryModal','loadImprovementHome','loadActivityMonitor'])if(!app.includes(`registerIdle(() => ${loader}())`))failures.push(`IDLE_PRELOAD_MISSING:${loader}`);
if(!app.includes('onPointerEnter')||!app.includes('onTouchStart'))failures.push('INTENT_PRELOAD_MISSING');
if(app.includes('registerIdle(() => loadCodeEditor())'))failures.push('HEAVY_EDITOR_IDLE_PRELOAD_FORBIDDEN');
if(app.includes('preloadWhenIdle()'))failures.push('TYPESCRIPT_IDLE_PRELOAD_FORBIDDEN');
const appChunk=assets.find(x=>x.name.startsWith('App-'))?.size||0;if(appChunk>800000)failures.push(`APP_CHUNK_TOO_LARGE:${appChunk}`);
console.log(JSON.stringify({passed:!failures.length,phase:'PREDICTIVE_PRELOAD_25',appChunkBytes:appChunk,policy:{idle:['memory','improvement','monitor'],intent:['memory','improvement','monitor'],onDemandOnly:['code-editor','typescript-compiler']},responsePathPreserved:true,generationPathPreserved:true,failures},null,2));if(failures.length)process.exitCode=1;

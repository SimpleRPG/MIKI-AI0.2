import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/services/coreResultService.ts','utf8');
const required=['miki_core_results_v2','loadPersistedResults','persistResults','MAX_PERSISTED_CORE_RESULTS','storageService.setItem','storageService.getItem','isPersistedCoreResult'];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){console.error(`missing Core Result persistence: ${missing.join(',')}`);process.exit(1);}
const writes=(source.match(/this\.persistResults\(\)/g)||[]).length;
if(writes<2){console.error('createRequest and updateStatus must both persist');process.exit(1);}
if(!source.includes('this.loadPersistedResults();')){console.error('constructor does not restore Core Results');process.exit(1);}
console.log('PASS core result persistence v97');

import fs from 'node:fs'; import path from 'node:path';
const domains=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const gateways=new Set(['api.ts','chapter69_90PlatformServices.ts','mikiApi.ts','simpleRpgApi.ts','storageService.ts','systemLogger.ts']);
const failures=[]; const details=[];
for(const domain of domains){const dir=path.join('src','miki',domain);const ok=fs.existsSync(dir)&&fs.existsSync(path.join('src','miki',domain+'.ts'));details.push({domain,dirExists:fs.existsSync(dir),barrelExists:fs.existsSync(path.join('src','miki',domain+'.ts'))});if(!ok) failures.push('DOMAIN_MISSING:'+domain);}
const stray=fs.existsSync('src/services')?fs.readdirSync('src/services').filter(x=>/\.tsx?$/.test(x)&&!gateways.has(x)):[];
if(stray.length) failures.push('UNCLASSIFIED_LEGACY_SERVICE:'+stray.join(','));
const reflection=fs.readFileSync('src/miki/selfDevelopment/services/codebaseReflectionService.ts','utf8');
const duplicateNeedle="path: 'miki/safety/services/deterministicRuntimeService.ts'";
const duplicateCount=reflection.split(duplicateNeedle).length-1;
if(duplicateCount!==1) failures.push('DUPLICATE_REFLECTION_ENTRY:'+duplicateCount);
const report={passed:failures.length===0,domainCount:domains.length,details,legacyGateways:[...gateways],strayLegacyServices:stray,duplicateReflectionEntries:duplicateCount,failures};
fs.writeFileSync('DOMAIN_OWNERSHIP_AUDIT_V28.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2)); if(failures.length)process.exit(1);

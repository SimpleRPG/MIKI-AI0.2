import fs from 'node:fs';
const record=JSON.parse(fs.readFileSync('BUILD_GATE_PRIORITY_1_V99.json','utf8'));
const required=['blockReason','requiredInput','resumeCondition','blockedAt','commands','environment','completionClaims'];
const missing=required.filter(key=>!(key in record));
if(missing.length){console.error(`missing blocked record fields: ${missing.join(',')}`);process.exit(1);}
if(record.status!=='BLOCKED'){console.error('priority 1 must remain BLOCKED');process.exit(1);}
if(record.completionClaims.fullTypeScript!==false){console.error('full TypeScript must not be overclaimed');process.exit(1);}
if(!record.environment.packageLockSha256){console.error('lockfile SHA is required');process.exit(1);}
console.log('PASS priority 1 build gate blocked record v99');

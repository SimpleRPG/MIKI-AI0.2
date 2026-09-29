import { readFileSync } from 'node:fs';
const browserGraphFiles=['src/miki/selfDevelopment/services/featureArtifactWiringService.ts','src/miki/selfDevelopment/services/featureCandidateAnalysisService.ts'];
const violations=[];
for(const file of browserGraphFiles){const source=readFileSync(file,'utf8');const lines=source.split(/\r?\n/);for(let index=0;index<lines.length;index+=1){if(/^\s*import\s.+from\s+['"]node:/.test(lines[index]))violations.push(`${file}:${index+1}`);}}
if(violations.length)throw new Error(`NODE_BUILTIN_IN_BROWSER_GRAPH:${violations.join(',')}`);
console.log(JSON.stringify({passed:true,checkedFiles:browserGraphFiles.length},null,2));

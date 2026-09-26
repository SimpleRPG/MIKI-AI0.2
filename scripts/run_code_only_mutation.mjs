import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const target=process.env.MIKI_MUTATION_FILE||'scripts/property_subject.mjs';
const original=fs.readFileSync(target,'utf8');
const mutations=[
 {operator:'LOWER_LT_TO_GT',from:'if(value<min)return min;',to:'if(value>min)return min;'},
 {operator:'UPPER_GT_TO_LT',from:'if(value>max)return max;',to:'if(value<max)return max;'},
 {operator:'BUILD_TRUE_TO_FALSE',from:'input.buildPassed===true',to:'input.buildPassed===false'},
 {operator:'TEST_TRUE_TO_FALSE',from:'input.testPassed===true',to:'input.testPassed===false'},
 {operator:'EVIDENCE_GT_TO_EQ',from:'input.evidenceCount>0',to:'input.evidenceCount===0'},
 {operator:'BLOCKER_EQ_TO_GT',from:'input.blockerCount===0',to:'input.blockerCount>0'},
 {operator:'SET_REMOVE',from:'return [...new Set(values)];',to:'return [...values];'}
];
const results=[];
try{
 for(const mutation of mutations){if(!original.includes(mutation.from)){results.push({...mutation,killed:false,reason:'PATTERN_NOT_FOUND'});continue;}fs.writeFileSync(target,original.replace(mutation.from,mutation.to));const run=spawnSync(process.execPath,['scripts/run_code_only_property.mjs'],{encoding:'utf8',timeout:120000});results.push({operator:mutation.operator,killed:run.status!==0,exitCode:run.status,signal:run.signal,stderr:run.stderr.slice(0,500)});fs.writeFileSync(target,original);}
}finally{fs.writeFileSync(target,original);}
const killed=results.filter(x=>x.killed).length;const score=results.length?killed/results.length:0;const minimumScore=Number(process.env.MIKI_MUTATION_MIN_SCORE||0.8);const verified=results.length===mutations.length&&score>=minimumScore;console.log(JSON.stringify({runner:'CODE_ONLY_MUTATION',verified,rootRequired:false,externalPackagesRequired:false,mutants:results.length,killed,survived:results.length-killed,score,minimumScore,sourceRestored:fs.readFileSync(target,'utf8')===original,results},null,2));if(!verified)process.exitCode=1;

import crypto from 'node:crypto';
let state=Number(process.env.MIKI_PROPERTY_SEED||20260926)>>>0;
const random=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
const runs=Number(process.env.MIKI_PROPERTY_RUNS||500);
const properties=[
 ['JSON_ROUNDTRIP',value=>JSON.stringify(JSON.parse(JSON.stringify(value)))===JSON.stringify(value)],
 ['SET_IDEMPOTENCE',value=>{const a=[...new Set(value)];return JSON.stringify(a)===JSON.stringify([...new Set(a)]);}],
 ['HASH_DETERMINISM',value=>{const s=JSON.stringify(value);return crypto.createHash('sha256').update(s).digest('hex')===crypto.createHash('sha256').update(s).digest('hex');}]
];
const failures=[];
for(let i=0;i<runs;i++){const value=Array.from({length:Math.floor(random()*20)},()=>Math.floor(random()*200)-100);for(const [name,predicate] of properties){try{if(!predicate(value))failures.push({name,seed:state,counterexample:value});}catch(error){failures.push({name,seed:state,error:String(error)});}}}
const result={runner:'CODE_ONLY_PROPERTY',verified:failures.length===0,rootRequired:false,externalPackagesRequired:false,runs,properties:properties.length,failures};console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;

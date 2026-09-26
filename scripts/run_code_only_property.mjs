import crypto from 'node:crypto';
import {clamp,isReviewEligible,stableUnique} from './property_subject.mjs';
let state=Number(process.env.MIKI_PROPERTY_SEED||20260926)>>>0;
const random=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
const integer=(min,max)=>min+Math.floor(random()*(max-min+1));
const runs=Number(process.env.MIKI_PROPERTY_RUNS||1000);
const failures=[];
const check=(name,input,predicate)=>{try{if(!predicate())failures.push({name,seed:state,counterexample:input});}catch(error){failures.push({name,seed:state,counterexample:input,error:String(error)});}};
for(let i=0;i<runs;i++){
 const min=integer(-1000,1000);const max=min+integer(0,1000);const value=integer(-2000,2000);const clamped=clamp(value,min,max);
 check('CLAMP_BOUNDS',{value,min,max},()=>clamped>=min&&clamped<=max);
 check('CLAMP_IDEMPOTENT',{value,min,max},()=>clamp(clamped,min,max)===clamped);
 check('CLAMP_LOWER',{value:min-1,min,max},()=>clamp(min-1,min,max)===min);
 check('CLAMP_UPPER',{value:max+1,min,max},()=>clamp(max+1,min,max)===max);
 const eligible={buildPassed:random()>0.5,testPassed:random()>0.5,evidenceCount:integer(0,4),blockerCount:integer(0,3)};
 check('REVIEW_ELIGIBILITY',eligible,()=>isReviewEligible(eligible)===(eligible.buildPassed===true&&eligible.testPassed===true&&eligible.evidenceCount>0&&eligible.blockerCount===0));
 const values=Array.from({length:integer(0,30)},()=>integer(-10,10));const unique=stableUnique(values);
 check('STABLE_UNIQUE_IDEMPOTENT',values,()=>JSON.stringify(stableUnique(unique))===JSON.stringify(unique));
 check('STABLE_UNIQUE_MEMBERS',values,()=>unique.every(x=>values.includes(x))&&new Set(unique).size===unique.length);
 const text=JSON.stringify(values);check('HASH_DETERMINISM',values,()=>crypto.createHash('sha256').update(text).digest('hex')===crypto.createHash('sha256').update(text).digest('hex'));
}
const result={runner:'CODE_ONLY_PROPERTY',verified:failures.length===0,rootRequired:false,externalPackagesRequired:false,runs,properties:8,failures};console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;

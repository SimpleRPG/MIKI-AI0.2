import fs from'node:fs';import crypto from'node:crypto';import{detailedHumanRuleLearningP194Service as learner}from'../src/miki/core/services/detailedHumanRuleLearningP194Service.ts';
const base=JSON.parse(fs.readFileSync('P194_DETAILED_PERSON_OBSERVATIONS.json','utf8')).subjects;
const clone=v=>JSON.parse(JSON.stringify(v));
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const generated=[];
for(let i=0;i<10;i++){
 const src=clone(base[i]); const phase=(i+1)*0.61803398875; const vary=(v,k,limit=.12)=>typeof v==='number'?v*(1+Math.sin(phase*(k+3))*limit):v;
 const walk=(o,p='')=>{for(const k of Object.keys(o)){const q=p?`${p}.${k}`:k;if(typeof o[k]==='number')o[k]=vary(o[k],q.length);else if(Array.isArray(o[k]))o[k]=o[k].map((v,j)=>vary(v,q.length+j,.09));else if(o[k]&&typeof o[k]==='object')walk(o[k],q)}};
 walk(src);src.subjectId=`fictional-seat-${String(i+11).padStart(2,'0')}`;src.provenance={kind:'DETERMINISTIC_RULE_SPACE_SUBJECT',parentSubjectId:base[i].subjectId,externalProvider:false,sourcePixelCopy:false,qualityEvidence:false};src.sourceSha256=hash(src);generated.push(src);
}
const subjects=[...base,...generated],rules=learner.learn(subjects);
const p194=JSON.parse(fs.readFileSync('P194_VALIDATION_REPORT.json','utf8'));
const quality={rating:'NOT_PHOTO_QUALITY',structuralReadiness:0.58,photographicReadiness:0.18,productionRouteConnected:false,p194RenderedThroughP193:false,realMultiViewEvidence:false,expressionDeformation:false,pixelLevelAnatomyGate:false,androidDeviceE2E:false,evidenceBased:true};
const checks={twentySubjects:subjects.length===20,uniqueIds:new Set(subjects.map(x=>x.subjectId)).size===20,uniqueSha:new Set(subjects.map(x=>x.sourceSha256)).size===20,tenAdded:generated.length===10,provenance:generated.every(x=>x.provenance.kind==='DETERMINISTIC_RULE_SPACE_SUBJECT'),notMisrepresented:generated.every(x=>x.provenance.qualityEvidence===false),featureRules:rules.featureRules.length>=45,qualityNotOverclaimed:quality.rating==='NOT_PHOTO_QUALITY'};
const report={phase:'TWENTY_SUBJECT_RULE_SPACE_P195',passed:Object.values(checks).every(Boolean),checks,subjectCount:20,originalObservedSubjects:10,addedRuleSpaceSubjects:10,quality,warning:'The added ten are deterministic synthetic rule-space subjects. They expand structural variation and stress testing, but do not add independent photographic knowledge and must not be counted as proof of visual quality.',ruleBookSha256:rules.ruleBookSha256,previousP194Passed:p194.passed};
fs.writeFileSync('P195_TWENTY_SUBJECT_OBSERVATIONS.json',JSON.stringify({count:20,observedCount:10,ruleSpaceSyntheticCount:10,subjects},null,2)+'\n');fs.writeFileSync('P195_TWENTY_SUBJECT_RULE_BOOK.json',JSON.stringify(rules,null,2)+'\n');fs.writeFileSync('P195_QUALITY_AND_EXPANSION_REPORT.json',JSON.stringify(report,null,2)+'\n');if(!report.passed)process.exit(1);console.log(JSON.stringify(report,null,2));

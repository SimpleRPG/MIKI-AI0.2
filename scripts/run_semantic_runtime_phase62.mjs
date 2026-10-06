import { readFileSync, writeFileSync } from 'node:fs';
import { semanticFrameV2Service } from '../src/miki/selfDevelopment/services/semanticFrameV2Service.ts';
import { classifySemanticTerms, compileSemanticMutations, resolveConversationReferences } from '../src/miki/selfDevelopment/services/semanticExecutionPlanCompiler.ts';
const cases=JSON.parse(readFileSync('fixtures/phase62/semantic_runtime_cases.json','utf8'));const results=[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const test of cases){const resolvedText=resolveConversationReferences(test.input,test.history||[]);const frame=semanticFrameV2Service.parse(resolvedText,(test.history||[]).flatMap(x=>x.entities||[]));const typedTerms=classifySemanticTerms(resolvedText);const m=compileSemanticMutations(frame.actionChains);const ready=!frame.conflicts.length&&!frame.unknowns.length&&m.every(x=>x.operation!=='UNKNOWN');const r={resolvedText,frame,ready,executionPlan:{mutations:m,typedTerms}};const e=test.expect;const errors=[];
 if(e.mutationCount!==undefined&&m.length!==e.mutationCount)errors.push(`mutationCount:${m.length}`);
 if(e.firstValue!==undefined&&m[0]?.value!==e.firstValue)errors.push(`firstValue:${m[0]?.value}`);
 if(e.firstValueType!==undefined&&m[0]?.valueType!==e.firstValueType)errors.push(`firstValueType:${m[0]?.valueType}`);
 if(e.secondTargetSet&&m[1]?.targetSet!==e.secondTargetSet)errors.push(`secondTargetSet:${m[1]?.targetSet}`);
 if(e.secondDependsOn&&!eq(m[1]?.dependsOn,e.secondDependsOn))errors.push(`secondDependsOn:${JSON.stringify(m[1]?.dependsOn)}`);
 if(e.secondSameTransaction!==undefined&&m[1]?.sameTransaction!==e.secondSameTransaction)errors.push(`secondSameTransaction:${m[1]?.sameTransaction}`);
 if(e.targets&&!eq(m.map(x=>x.targetSet),e.targets))errors.push(`targets:${JSON.stringify(m.map(x=>x.targetSet))}`);
 if(e.dependencies&&!eq(m.map(x=>x.dependsOn),e.dependencies))errors.push(`dependencies:${JSON.stringify(m.map(x=>x.dependsOn))}`);
 if(e.fields&&!eq(m.map(x=>x.field),e.fields))errors.push(`fields:${JSON.stringify(m.map(x=>x.field))}`);
 if(e.term){const t=r.executionPlan.typedTerms.find(x=>x.value===e.term);if(t?.kind!==e.termKind)errors.push(`term:${t?.kind}`);}
 if(e.businessCode){const t=r.executionPlan.typedTerms.find(x=>x.value===e.businessCode);if(t?.kind!=='BUSINESS_CODE'||t.preserveLeadingZeros!==e.preserveLeadingZeros)errors.push(`businessCode:${JSON.stringify(t)}`);}
 if(e.resolvedContains&&!r.resolvedText.includes(e.resolvedContains))errors.push('resolvedContains');if(e.resolvedContains2&&!r.resolvedText.includes(e.resolvedContains2))errors.push('resolvedContains2');
 if(e.ready!==undefined&&r.ready!==e.ready)errors.push(`ready:${r.ready}`);if(e.hasUnknownMutation&&!m.some(x=>x.operation==='UNKNOWN'))errors.push('unknownMutation');
 if(e.exclusionMinimum!==undefined&&r.frame.exclusionSets.length<e.exclusionMinimum)errors.push('exclusion');if(e.continuationMinimum!==undefined&&r.frame.continuationConditions.length<e.continuationMinimum)errors.push('continuation');if(e.stopMinimum!==undefined&&r.frame.stopConditions.length<e.stopMinimum)errors.push('stop');
 results.push({id:test.id,passed:!errors.length,errors,actual:{ready:r.ready,mutations:m,typedTerms:r.executionPlan.typedTerms,resolvedText:r.resolvedText,unknowns:r.frame.unknowns}});
}
const report={passed:results.every(x=>x.passed),phase:'SEMANTIC_RUNTIME_REGRESSION_62',executed:results.length,passedCount:results.filter(x=>x.passed).length,failedCount:results.filter(x=>!x.passed).length,results};writeFileSync('SEMANTIC_RUNTIME_REGRESSION_PHASE62_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,executed:report.executed,passedCount:report.passedCount,failed:results.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;

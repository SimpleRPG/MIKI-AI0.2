import type { BlackboardTask } from './taskBlackboardService';

export interface PlateauResult {
  plateau:boolean;
  repeatedRoutes:number;
  unchangedCycles:number;
  oscillation:boolean;
  repeatedFailure:boolean;
  sameResearchQuery:boolean;
  reason:'PROGRESS_OBSERVED'|'NO_PROGRESS'|'OSCILLATION_DETECTED'|'REPEATED_FAILURE'|'NO_NEW_EVIDENCE';
}

const VOLATILE_KEYS=/^(id|createdAt|updatedAt|completedAt|dispatchId|replyId|envelopeId|operationInstanceId|planRevision|corePlanRevision|requestId|taskId|timestamp|observedAt)$/i;

function canonical(value:unknown):unknown{
  if(value===null||value===undefined)return value;
  if(typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(canonical);
  const source=value as Record<string,unknown>;
  const out:Record<string,unknown>={};
  for(const key of Object.keys(source).sort()){
    if(VOLATILE_KEYS.test(key))continue;
    out[key]=canonical(source[key]);
  }
  return out;
}

function stable(value:unknown):string{
  return JSON.stringify(canonical(value));
}

function cycleSegments(task:BlackboardTask):Array<{plan:string;outcomes:string}> {
  const checkpoints=task.entries
    .map((entry,index)=>({entry,index}))
    .filter(item=>item.entry.kind==='CHECKPOINT'&&item.entry.domain==='core'&&item.entry.key.startsWith('coreCycle:'));
  return checkpoints.map((checkpoint,index)=>{
    const start=checkpoint.index+1;
    const end=index+1<checkpoints.length?checkpoints[index+1].index:task.entries.length;
    const segment=task.entries.slice(start,end);
    const planEntry=segment.filter(entry=>entry.kind==='DECISION'&&entry.key.startsWith('corePlan:')).at(-1);
    const outcomeEntries=segment.filter(entry=>['RESULT','EVIDENCE','CLAIM','ERROR'].includes(entry.kind));
    return {
      plan:stable(planEntry?.value||null),
      outcomes:stable(outcomeEntries.map(entry=>({kind:entry.kind,domain:entry.domain,key:entry.key,value:entry.value,evidenceIds:[...entry.evidenceIds].sort()})))
    };
  });
}

function routeSignatures(task:BlackboardTask):string[] {
  return task.entries
    .filter(entry=>entry.kind==='DECISION'&&entry.key.startsWith('corePlan:'))
    .map(entry=>{
      const value=Array.isArray(entry.value)?entry.value:[];
      return stable(value.map((item:unknown)=>{
        const row=item&&typeof item==='object'?item as Record<string,unknown>:{};
        return {target:String(row.target||''),command:String(row.command||'')};
      }).sort((a,b)=>`${a.target}:${a.command}`.localeCompare(`${b.target}:${b.command}`)));
    });
}

function maxConsecutive(values:string[]):number{
  if(values.length<2)return 0;
  let best=1,current=1;
  for(let i=1;i<values.length;i+=1){
    if(values[i]===values[i-1]){current+=1;best=Math.max(best,current);}else current=1;
  }
  return Math.max(0,best-1);
}

function researchRows(task:BlackboardTask):Array<{query:string;evidence:string[]}> {
  const rows:Array<{query:string;evidence:string[]}>=[];
  for(const entry of task.entries){
    if(entry.kind!=='RESULT'||entry.domain!=='research'||!entry.key.includes('RUN_RESEARCH'))continue;
    let query='';
    const walk=(value:unknown):void=>{
      if(value===null||value===undefined||query)return;
      if(Array.isArray(value)){for(const child of value)walk(child);return;}
      if(typeof value!=='object')return;
      for(const [key,child] of Object.entries(value as Record<string,unknown>)){
        if(/^(researchQuery|query|nextQuery)$/i.test(key)&&typeof child==='string'&&child.trim()){query=child.trim();return;}
        walk(child);
        if(query)return;
      }
    };
    walk(entry.value);
    if(query)rows.push({query,evidence:[...entry.evidenceIds].sort()});
  }
  return rows;
}

function failureSignatures(task:BlackboardTask):string[]{
  return task.entries
    .filter(entry=>entry.kind==='ERROR')
    .map(entry=>stable({domain:entry.domain,key:entry.key,value:entry.value}));
}

class PlateauDetectorService{
  evaluate(task:BlackboardTask):PlateauResult{
    const segments=cycleSegments(task);
    const routeSigs=routeSignatures(task);
    const unchangedCycles=maxConsecutive(segments.map(segment=>`${segment.plan}|${segment.outcomes}`));
    const repeatedRoutes=maxConsecutive(routeSigs);
    const lastRoutes=routeSigs.slice(-3);
    const oscillation=lastRoutes.length===3 && lastRoutes[0]!==lastRoutes[1] && lastRoutes[0]===lastRoutes[2];

    const failures=failureSignatures(task);
    const repeatedFailure=maxConsecutive(failures)>=2;

    const research=researchRows(task);
    const lastResearch=research.slice(-2);
    const sameResearchQuery=lastResearch.length===2
      && lastResearch[0].query===lastResearch[1].query
      && lastResearch[0].evidence.join('|')===lastResearch[1].evidence.join('|');

    const plateau=unchangedCycles>=2 || repeatedRoutes>=2 || oscillation || repeatedFailure || sameResearchQuery;
    const reason:PlateauResult['reason']=repeatedFailure
      ? 'REPEATED_FAILURE'
      : oscillation
        ? 'OSCILLATION_DETECTED'
        : sameResearchQuery
          ? 'NO_NEW_EVIDENCE'
          : plateau
            ? 'NO_PROGRESS'
            : 'PROGRESS_OBSERVED';

    return {plateau,repeatedRoutes,unchangedCycles,oscillation,repeatedFailure,sameResearchQuery,reason};
  }
}

export const plateauDetectorService=new PlateauDetectorService();

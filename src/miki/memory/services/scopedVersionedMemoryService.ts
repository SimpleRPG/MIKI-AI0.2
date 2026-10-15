import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
export type GovernedMemoryKind='FACT'|'DECISION'|'PREFERENCE'|'CONSTRAINT'|'HYPOTHESIS'|'TASK'|'EVIDENCE'|'ARTIFACT';
export type GovernedMemoryStatus='ACTIVE'|'UNVERIFIED'|'SUPERSEDED'|'REJECTED'|'EXPIRED'|'INVALIDATED';
export type GovernedScopeType='GLOBAL'|'REPOSITORY'|'FEATURE'|'MODULE'|'FUNCTION'|'WORKBOOK'|'SHEET'|'ACTION'|'TASK'|'CONVERSATION';
export interface GovernedMemoryScope{type:GovernedScopeType;id:string;targets?:string[];excludedTargets?:string[];validFrom?:number;validUntil?:number;}
export interface GovernedMemorySource{turnIds:string[];fileIds:string[];evidenceIds:string[];artifactSha256?:string;repositoryRevision?:string;}
export interface GovernedMemoryRecord{id:string;subject:string;content:string;kind:GovernedMemoryKind;status:GovernedMemoryStatus;scope:GovernedMemoryScope;source:GovernedMemorySource;confidence:number;createdAt:number;updatedAt:number;supersedes?:string;supersededBy?:string;invalidationReason?:string;}
export interface GovernedMemoryQuery{subject?:string;scopeType?:GovernedScopeType;scopeId?:string;target?:string;now?:number;includeUnverified?:boolean;limit?:number;}
const KEY='miki_scoped_versioned_memory_v1';
const RETRIEVAL_STATS_KEY='miki_scoped_versioned_memory_retrieval_v1';
interface MemoryRetrievalStats{memoryId:string;retrievalCount:number;successCount:number;failureCount:number;lastRetrievedAt:number;lastOutcomeAt:number;outcomeTaskIds:string[];}
class ScopedVersionedMemoryService{
 private records=new Map<string,GovernedMemoryRecord>();private retrievalStats=new Map<string,MemoryRetrievalStats>();private pendingStatsWrites=0;private lastStatsPersistAt=0;constructor(){this.load();this.loadRetrievalStats();}
 propose(input:Omit<GovernedMemoryRecord,'id'|'status'|'createdAt'|'updatedAt'>):GovernedMemoryRecord{const now=Date.now();const record:GovernedMemoryRecord={...input,id:`MEM-${canonicalSha256({subject:input.subject,content:input.content,scope:input.scope,source:input.source}).slice(0,24)}`,status:input.kind==='HYPOTHESIS'?'UNVERIFIED':'ACTIVE',confidence:Math.max(0,Math.min(1,input.confidence)),createdAt:now,updatedAt:now};this.records.set(record.id,record);this.save();return record;}
 supersede(previousId:string,next:Omit<GovernedMemoryRecord,'id'|'status'|'createdAt'|'updatedAt'|'supersedes'>):GovernedMemoryRecord|undefined{const previous=this.records.get(previousId);if(!previous||!['ACTIVE','UNVERIFIED'].includes(previous.status))return undefined;const replacement=this.propose({...next,supersedes:previousId});previous.status='SUPERSEDED';previous.supersededBy=replacement.id;previous.updatedAt=Date.now();this.records.set(previous.id,previous);this.save();return replacement;}
 invalidate(id:string,reason:string):GovernedMemoryRecord|undefined{const record=this.records.get(id);if(!record)return undefined;record.status='INVALIDATED';record.invalidationReason=reason;record.updatedAt=Date.now();this.records.set(id,record);this.save();return record;}
 invalidateBySource(sourceId:string,reason:string):GovernedMemoryRecord[]{const changed=[] as GovernedMemoryRecord[];for(const record of this.records.values()){const linked=[...record.source.turnIds,...record.source.fileIds,...record.source.evidenceIds].includes(sourceId);if(linked&&['ACTIVE','UNVERIFIED'].includes(record.status)){const item=this.invalidate(record.id,reason);if(item)changed.push(item);}}return changed;}
 retrieve(query:GovernedMemoryQuery):GovernedMemoryRecord[]{
  const now=query.now??Date.now();
  const selected=[...this.records.values()].filter(record=>{
   if(record.status!=='ACTIVE'&&!(query.includeUnverified&&record.status==='UNVERIFIED'))return false;
   if(record.scope.validFrom&&record.scope.validFrom>now)return false;
   if(record.scope.validUntil&&record.scope.validUntil<now)return false;
   if(query.subject&&record.subject!==query.subject)return false;
   if(query.scopeType&&record.scope.type!==query.scopeType)return false;
   if(query.scopeId&&record.scope.id!==query.scopeId)return false;
   if(query.target){if(record.scope.excludedTargets?.includes(query.target))return false;if(record.scope.targets?.length&&!record.scope.targets.includes(query.target))return false;}
   return true;
  }).sort((a,b)=>this.score(b,query,now)-this.score(a,query,now)||b.updatedAt-a.updatedAt).slice(0,query.limit??50);
  for(const record of selected){
   const stats=this.retrievalStats.get(record.id)||{memoryId:record.id,retrievalCount:0,successCount:0,failureCount:0,lastRetrievedAt:0,lastOutcomeAt:0,outcomeTaskIds:[]};
   stats.retrievalCount+=1;stats.lastRetrievedAt=now;this.retrievalStats.set(record.id,stats);
  }
  if(selected.length){this.pendingStatsWrites+=selected.length;if(this.pendingStatsWrites>=16||now-this.lastStatsPersistAt>=60_000)this.saveRetrievalStats();}
  return selected;
 }
 resolveReference(candidates:Array<{id:string;taskMatch:number;featureMatch:number;targetMatch:number;recency:number;evidenceStrength:number;contradiction:number}>):{resolvedId?:string;ambiguous:boolean;scores:Array<{id:string;score:number}>}{const scores=candidates.map(item=>({id:item.id,score:item.taskMatch+item.featureMatch+item.targetMatch+item.recency+item.evidenceStrength-item.contradiction})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));return{resolvedId:scores.length&&(!scores[1]||scores[0].score-scores[1].score>=0.15)?scores[0].id:undefined,ambiguous:scores.length>1&&scores[0].score-scores[1].score<0.15,scores};}
 list():GovernedMemoryRecord[]{return[...this.records.values()].sort((a,b)=>b.updatedAt-a.updatedAt);}
 recordOutcome(memoryIds:string[],outcome:'SUCCESS'|'FAILURE',outcomeTaskId?:string):void{
  let changed=false;
  const now=Date.now();
  for(const memoryId of new Set(memoryIds)){
   if(!this.records.has(memoryId))continue;
   const stats=this.retrievalStats.get(memoryId)||{memoryId,retrievalCount:0,successCount:0,failureCount:0,lastRetrievedAt:0,lastOutcomeAt:0,outcomeTaskIds:[]};
   if(outcomeTaskId&&stats.outcomeTaskIds.includes(outcomeTaskId))continue;
   if(outcome==='SUCCESS')stats.successCount+=1;else stats.failureCount+=1;
   stats.lastOutcomeAt=now;
   if(outcomeTaskId)stats.outcomeTaskIds=[...stats.outcomeTaskIds,outcomeTaskId].slice(-50);
   this.retrievalStats.set(memoryId,stats);changed=true;
  }
  if(changed)this.saveRetrievalStats();
 }
 private score(record:GovernedMemoryRecord,query:GovernedMemoryQuery,now=query.now??Date.now()):number{
  const base=(record.scope.type===query.scopeType?2:0)+(record.scope.id===query.scopeId?2:0)+(record.source.evidenceIds.length?1:0)+record.confidence;
  const stats=this.retrievalStats.get(record.id);
  const retrievalCount=stats?.retrievalCount||0;
  const successCount=stats?.successCount||0;
  const failureCount=stats?.failureCount||0;
  const lastUse=stats?.lastRetrievedAt||record.createdAt;
  const elapsedDays=Math.max(0,now-lastUse)/86_400_000;
  const outcomeCount=successCount+failureCount;
  const failureRate=outcomeCount?failureCount/outcomeCount:0;
  const activation=Math.log1p(retrievalCount)*0.12-Math.log1p(elapsedDays)*0.15+Math.log1p(successCount)*0.20-failureRate*0.50;
  return base+Math.max(-1,Math.min(1,activation));
 }
 private save():void{storageService.setItem(KEY,JSON.stringify(this.list().slice(0,5000)));}
 private load():void{try{const parsed=JSON.parse(storageService.getItem(KEY)||'[]') as GovernedMemoryRecord[];for(const item of parsed)this.records.set(item.id,item);}catch{}}
 private loadRetrievalStats():void{
  try{
   const parsed:unknown=JSON.parse(storageService.getItem(RETRIEVAL_STATS_KEY)||'[]');
   if(!Array.isArray(parsed))return;
   const numberValue=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,value):0;
   for(const item of parsed){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const value=item as Record<string,unknown>;
    const memoryId=typeof value.memoryId==='string'?value.memoryId:'';
    if(!memoryId||!this.records.has(memoryId))continue;
    const outcomeTaskIds=Array.isArray(value.outcomeTaskIds)?value.outcomeTaskIds.filter((id):id is string=>typeof id==='string').slice(-50):[];
    this.retrievalStats.set(memoryId,{memoryId,retrievalCount:numberValue(value.retrievalCount),successCount:numberValue(value.successCount),failureCount:numberValue(value.failureCount),lastRetrievedAt:numberValue(value.lastRetrievedAt),lastOutcomeAt:numberValue(value.lastOutcomeAt),outcomeTaskIds});
   }
  }catch{/* Optional retrieval statistics never block memory startup. */}
 }
 private saveRetrievalStats():void{
  try{
   const snapshot=[...this.retrievalStats.values()].sort((a,b)=>b.lastRetrievedAt-a.lastRetrievedAt).slice(0,5000);
   storageService.setItem(RETRIEVAL_STATS_KEY,JSON.stringify(snapshot));
   this.pendingStatsWrites=0;this.lastStatsPersistAt=Date.now();
  }catch{/* Retrieval statistics never block the primary memory service. */}
 }
}
export const scopedVersionedMemoryService=new ScopedVersionedMemoryService();

import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export type JobState = 'QUEUED'|'PREPARING'|'RUNNING'|'WAITING_RESOURCE'|'RETRYING'|'PAUSED'|'CANCELLING'|'CANCELLED'|'COMPLETED'|'FAILED'|'TIMED_OUT'|'ROLLED_BACK'|'BLOCKED';
export interface DurableJob {
 jobId:string; workspaceId:string; repositoryIds:string[]; priority:number; foreground:boolean; dependencies:string[]; fileLocks:string[];
 resource:{cpu:number;memoryMb:number;diskMb:number}; retryBudget:number; attempt:number; state:JobState; leaseOwner?:string; leaseExpiresAt?:number;
 heartbeatAt?:number; cancelToken:string; createdAt:number; updatedAt:number; failureCode?:string;
}
const KEY='miki_durable_job_runtime_v1';
const TERMINAL=new Set<JobState>(['CANCELLED','COMPLETED','FAILED','TIMED_OUT','ROLLED_BACK','BLOCKED']);
const TRANSITIONS:Record<JobState,ReadonlySet<JobState>>={
 QUEUED:new Set(['PREPARING','RUNNING','CANCELLING','CANCELLED','FAILED','BLOCKED']),
 PREPARING:new Set(['RUNNING','WAITING_RESOURCE','PAUSED','CANCELLING','CANCELLED','FAILED','TIMED_OUT','ROLLED_BACK']),
 RUNNING:new Set(['WAITING_RESOURCE','RETRYING','PAUSED','CANCELLING','CANCELLED','COMPLETED','FAILED','TIMED_OUT','ROLLED_BACK']),
 WAITING_RESOURCE:new Set(['QUEUED','RUNNING','RETRYING','CANCELLING','CANCELLED','FAILED','BLOCKED']),
 RETRYING:new Set(['RUNNING','CANCELLING','CANCELLED','FAILED','BLOCKED']),
 PAUSED:new Set(['QUEUED','RUNNING','CANCELLING','CANCELLED','FAILED','BLOCKED']),
 CANCELLING:new Set(['CANCELLED']), CANCELLED:new Set(), COMPLETED:new Set(), FAILED:new Set(), TIMED_OUT:new Set(), ROLLED_BACK:new Set(), BLOCKED:new Set()
};
const validJob=(v:unknown):v is DurableJob=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)&&typeof (v as DurableJob).jobId==='string'&&typeof (v as DurableJob).state==='string'&&Array.isArray((v as DurableJob).dependencies)&&Array.isArray((v as DurableJob).repositoryIds)&&typeof (v as DurableJob).cancelToken==='string');
class DurableJobWorkerRuntimeService {
 private persistenceBlocked=false; private enqueueSequence=0;
 enqueue(input:Omit<DurableJob,'jobId'|'state'|'attempt'|'cancelToken'|'createdAt'|'updatedAt'>){
  if(!input.workspaceId.trim()||!input.repositoryIds.length||![input.resource.cpu,input.resource.memoryMb,input.resource.diskMb].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(input.retryBudget)||input.retryBudget<0)throw new Error('JOB_INPUT_INVALID');
  const rows=this.list();if(this.persistenceBlocked)throw new Error('JOB_STORE_PERSISTENCE_BLOCKED');
  for(const dep of input.dependencies){const existing=rows.find(j=>j.jobId===dep);if(!existing)throw new Error('JOB_DEPENDENCY_NOT_FOUND');if(TERMINAL.has(existing.state)&&existing.state!=='COMPLETED')throw new Error('JOB_DEPENDENCY_FAILED');}
  const now=Date.now();this.enqueueSequence+=1;const nonce=this.enqueueSequence;const job:DurableJob={...input,jobId:`JOB-${canonicalSha256({...input,now,nonce}).slice(0,22)}`,state:'QUEUED',attempt:0,cancelToken:canonicalSha256({now,nonce,input}),createdAt:now,updatedAt:now};
  if(rows.some(x=>x.jobId===job.jobId))throw new Error('JOB_ID_COLLISION');if(!this.save(job))throw new Error('JOB_STORE_PERSISTENCE_BLOCKED');return job;
 }
 claim(workerId:string,capacity:{cpu:number;memoryMb:number;diskMb:number},ttlMs=60000){
  if(!workerId.trim()||![capacity.cpu,capacity.memoryMb,capacity.diskMb,ttlMs].every(Number.isFinite)||capacity.cpu<=0||capacity.memoryMb<=0||capacity.diskMb<=0||ttlMs<=0)throw new Error('WORKER_CAPACITY_INVALID');
  const now=Date.now();this.recoverStale(now);this.blockJobsWithFailedDependencies();const all=this.list();
  const jobs=all.filter(j=>['QUEUED','RETRYING','WAITING_RESOURCE'].includes(j.state)&&j.dependencies.every(id=>all.some(x=>x.jobId===id&&x.state==='COMPLETED'))).sort((a,b)=>Number(b.foreground)-Number(a.foreground)||b.priority-a.priority||a.createdAt-b.createdAt||a.jobId.localeCompare(b.jobId));
  const running=all.filter(j=>j.state==='RUNNING'&&(j.leaseExpiresAt||0)>=now);const job=jobs.find(j=>j.resource.cpu<=capacity.cpu&&j.resource.memoryMb<=capacity.memoryMb&&j.resource.diskMb<=capacity.diskMb&&!running.some(r=>r.repositoryIds.some(id=>j.repositoryIds.includes(id))||r.fileLocks.some(f=>j.fileLocks.includes(f))));
  if(!job)return undefined;Object.assign(job,{state:'RUNNING',leaseOwner:workerId,leaseExpiresAt:now+ttlMs,heartbeatAt:now,attempt:job.attempt+1,updatedAt:now});if(!this.save(job))throw new Error('JOB_STORE_PERSISTENCE_BLOCKED');return job;
 }
 heartbeat(jobId:string,workerId:string,ttlMs=60000){const j=this.must(jobId);const now=Date.now();if(j.state!=='RUNNING')throw new Error('JOB_NOT_RUNNING');if(j.leaseOwner!==workerId)throw new Error('LEASE_OWNER_MISMATCH');if((j.leaseExpiresAt||0)<now)throw new Error('JOB_LEASE_EXPIRED');if(!Number.isFinite(ttlMs)||ttlMs<=0)throw new Error('LEASE_TTL_INVALID');j.heartbeatAt=now;j.leaseExpiresAt=now+ttlMs;j.updatedAt=now;if(!this.save(j))throw new Error('JOB_STORE_PERSISTENCE_BLOCKED');return j;}
 transition(jobId:string,state:JobState,failureCode?:string){const j=this.must(jobId);if(j.state===state)return j;if(!TRANSITIONS[j.state]?.has(state))throw new Error(`JOB_INVALID_STATE_TRANSITION:${j.state}->${state}`);j.state=state;j.updatedAt=Date.now();if(failureCode)j.failureCode=failureCode;if(TERMINAL.has(state)||state==='CANCELLING'){j.leaseOwner=undefined;j.leaseExpiresAt=undefined;}if(!this.save(j))throw new Error('JOB_STORE_PERSISTENCE_BLOCKED');return j;}
 cancel(jobId:string,token:string){const j=this.must(jobId);if(j.cancelToken!==token)throw new Error('CANCEL_TOKEN_MISMATCH');if(TERMINAL.has(j.state))return j;if(j.state==='CANCELLING')return j;if(j.state==='QUEUED'||j.state==='RETRYING'||j.state==='WAITING_RESOURCE'||j.state==='PAUSED')return this.transition(jobId,'CANCELLED','CANCELLED_BY_REQUEST');return this.transition(jobId,'CANCELLING','CANCEL_REQUESTED');}
 fanIn(jobIds:string[]){return jobIds.length>0&&jobIds.every(id=>this.list().some(j=>j.jobId===id&&j.state==='COMPLETED'));}
 list():DurableJob[]{if(this.persistenceBlocked)return [];const raw=storageService.getItem(KEY);if(raw===null||raw==='')return [];try{const value=JSON.parse(raw);if(!Array.isArray(value)||value.some(v=>!validJob(v)||!Object.prototype.hasOwnProperty.call(TRANSITIONS,v.state)))throw new Error('JOB_SNAPSHOT_INVALID');return value as DurableJob[];}catch(error){this.quarantine(raw,error);return [];}}
 private recoverStale(now:number){for(const j of this.list())if(j.state==='RUNNING'&&(j.leaseExpiresAt||0)<now){j.leaseOwner=undefined;j.leaseExpiresAt=undefined;j.state=j.attempt<j.retryBudget?'RETRYING':'FAILED';j.updatedAt=now;if(j.state==='FAILED')j.failureCode='LEASE_EXPIRED_RETRY_BUDGET_EXHAUSTED';this.save(j);}}
 private blockJobsWithFailedDependencies(){for(const j of this.list()){if(!['QUEUED','RETRYING','WAITING_RESOURCE','PAUSED'].includes(j.state))continue;const failed=this.list().find(d=>j.dependencies.includes(d.jobId)&&d.state!=='COMPLETED'&&TERMINAL.has(d.state));if(failed){j.state='BLOCKED';j.failureCode=`DEPENDENCY_${failed.state}:${failed.jobId}`;j.updatedAt=Date.now();this.save(j);}}}
 private must(id:string){const j=this.list().find(x=>x.jobId===id);if(!j)throw new Error(this.persistenceBlocked?'JOB_STORE_PERSISTENCE_BLOCKED':'JOB_NOT_FOUND');return j;}
 private save(job:DurableJob){if(this.persistenceBlocked)return false;const rows=this.list();if(this.persistenceBlocked)return false;try{storageService.setItem(KEY,JSON.stringify([job,...rows.filter(x=>x.jobId!==job.jobId)].slice(0,5000)));const written=storageService.getItem(KEY);if(!written)throw new Error('JOB_STORE_WRITE_EMPTY');const parsed=JSON.parse(written);if(!Array.isArray(parsed)||!parsed.some((x:DurableJob)=>x.jobId===job.jobId&&x.state===job.state))throw new Error('JOB_STORE_WRITE_VERIFY_FAILED');return true;}catch{return false;}}
 private quarantine(raw:string,error:unknown){let preserved=false;const base=`${KEY}_quarantine_v1`;const value={version:1,sourceKey:KEY,quarantinedAt:Date.now(),reason:String(error instanceof Error?error.message:error).slice(0,500),raw};try{const existing=storageService.getItem(base);let key=base;if(existing){if(JSON.parse(existing).raw===raw){preserved=true;}else key=`${base}_${Date.now()}`;}if(!preserved){storageService.setItem(key,JSON.stringify(value));const written=storageService.getItem(key);preserved=Boolean(written&&JSON.parse(written).raw===raw);}}catch{preserved=false;}this.persistenceBlocked=!preserved;}
}
export const durableJobWorkerRuntimeService=new DurableJobWorkerRuntimeService();

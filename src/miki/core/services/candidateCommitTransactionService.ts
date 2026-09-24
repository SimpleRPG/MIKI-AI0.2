import { storageService } from '../../../services/storageService';
import { persistenceReceiptLedgerService } from './persistenceReceiptLedgerService';

export type CandidateTransactionStatus='STAGED'|'APPLYING'|'COMMITTED'|'ROLLED_BACK'|'RECOVERY_REQUIRED';
export interface CandidateTransactionFile {path:string;baselineContent:string;candidateContent:string;baselineSha256:string;candidateSha256:string;evidenceIds:string[];}
export interface CandidateCommitTransaction {schemaVersion:1;transactionId:string;issueId:string;workspaceId:string;guardId:string;revision:number;status:CandidateTransactionStatus;files:CandidateTransactionFile[];baselineSnapshotSha256:string;candidateManifestSha256:string;candidateRevisionSha256:string;receiptId?:string;previousTransactionId?:string;operationInstanceId:string;manifest:{schemaVersion:2;normalizationVersion:1;encoding:'UTF-8';newlinePolicy:'LF';orderedPaths:string[]};failure?:string;createdAt:number;updatedAt:number;}
const KEY='miki_candidate_commit_transactions_v1';
class CandidateCommitTransactionService{
 private rows=new Map<string,CandidateCommitTransaction>();private sequence=0;
 constructor(){this.load();this.recoverIncomplete();}
 async commit(input:{issueId:string;taskId:string;workspaceId:string;guardId:string;files:Array<{path:string;baselineContent:string;candidateContent:string;baselineSha256:string;candidateSha256:string;evidenceIds:string[]}>;receiptId:string;previousTransactionId?:string;operationInstanceId:string;}):Promise<CandidateCommitTransaction>{
  if(!input.receiptId.trim())throw new Error('PERSISTENCE_RECEIPT_REQUIRED');
  if(!input.operationInstanceId.trim())throw new Error('OPERATION_INSTANCE_REQUIRED');
  if(!input.taskId.trim())throw new Error('TASK_ID_REQUIRED');
  const receipt=persistenceReceiptLedgerService.get(input.receiptId);if(!receipt||receipt.taskId!==input.taskId||receipt.operationInstanceId!==input.operationInstanceId)throw new Error('PERSISTENCE_RECEIPT_LINEAGE_MISMATCH');
  this.assertCrypto();this.assertPaths(input.files.map(file=>file.path));
  const now=Date.now();this.sequence+=1;const transactionId=`CTX-${now}-${String(this.sequence).padStart(6,'0')}`;
  const revision=this.nextRevision(input.issueId);
  const baselineSnapshotSha256=await this.sha(input.files.map(file=>`${file.path}\n${file.baselineSha256}`).join('\n'));
  const candidateRevisionSha256=await this.sha(input.files.map(file=>`${file.path}\n${file.candidateSha256}`).join('\n'));
  const orderedPaths=[...input.files.map(file=>file.path)].sort();const manifest={schemaVersion:2 as const,normalizationVersion:1 as const,encoding:'UTF-8' as const,newlinePolicy:'LF' as const,orderedPaths};
  const candidateManifestSha256=await this.sha(JSON.stringify({...manifest,issueId:input.issueId,workspaceId:input.workspaceId,guardId:input.guardId,revision,baselineSnapshotSha256,candidateRevisionSha256,files:input.files.slice().sort((a,b)=>a.path.localeCompare(b.path)).map(file=>({path:file.path,baselineSha256:file.baselineSha256,candidateSha256:file.candidateSha256})),receiptId:input.receiptId,operationInstanceId:input.operationInstanceId}));
  const row:CandidateCommitTransaction={schemaVersion:1,transactionId,issueId:input.issueId,workspaceId:input.workspaceId,guardId:input.guardId,revision,status:'STAGED',files:input.files.map(file=>({...file,evidenceIds:[...file.evidenceIds]})),baselineSnapshotSha256,candidateManifestSha256,candidateRevisionSha256,receiptId:input.receiptId,previousTransactionId:input.previousTransactionId,operationInstanceId:input.operationInstanceId,manifest,createdAt:now,updatedAt:now};
  this.rows.set(transactionId,row);this.persist();
  try{row.status='APPLYING';row.updatedAt=Date.now();this.persist();row.status='COMMITTED';row.updatedAt=Date.now();this.persist();return this.clone(row);}catch(error){row.status='RECOVERY_REQUIRED';row.failure=error instanceof Error?error.message:String(error);row.updatedAt=Date.now();this.safePersist();throw error;}
 }
 rollback(transactionId:string,reason:string):CandidateCommitTransaction|undefined{const row=this.rows.get(transactionId);if(!row)return undefined;row.status='ROLLED_BACK';row.failure=reason;row.updatedAt=Date.now();this.persist();return this.clone(row);}
 get(transactionId:string){const row=this.rows.get(transactionId);return row?this.clone(row):undefined;}
 list():CandidateCommitTransaction[]{return [...this.rows.values()].sort((a,b)=>b.updatedAt-a.updatedAt).map(row=>this.clone(row));}
 latestCommitted(issueId:string){return [...this.rows.values()].filter(row=>row.issueId===issueId&&row.status==='COMMITTED').sort((a,b)=>b.revision-a.revision)[0];}
 private recoverIncomplete(){for(const row of this.rows.values())if(row.status==='STAGED'||row.status==='APPLYING'){const previous=row.previousTransactionId?this.rows.get(row.previousTransactionId):undefined;if(previous?.status==='COMMITTED'){row.status='ROLLED_BACK';row.failure='RESTART_RECOVERED_TO_PREVIOUS_REVISION';}else{row.status='RECOVERY_REQUIRED';row.failure='RESTART_WITHOUT_SAFE_PREVIOUS_REVISION';}row.updatedAt=Date.now();}this.safePersist();}
 private nextRevision(issueId:string){return Math.max(0,...[...this.rows.values()].filter(row=>row.issueId===issueId).map(row=>row.revision))+1;}
 private assertCrypto(){if(typeof crypto==='undefined'||!crypto.subtle)throw new Error('WEB_CRYPTO_REQUIRED');}
 private assertPaths(paths:string[]){for(const raw of paths){let decoded=raw;try{decoded=decodeURIComponent(raw);if(/%[0-9a-f]{2}/i.test(decoded))decoded=decodeURIComponent(decoded);}catch{throw new Error('CANDIDATE_PATH_ENCODING_INVALID');}const normalized=decoded.replace(/\\/g,'/');if(!normalized||normalized.startsWith('/')||/^[a-zA-Z]:\//.test(normalized)||normalized.split('/').includes('..')||normalized.includes('\0')||normalized.split('/').includes('.')||normalized.includes('//')||normalized.toLowerCase().includes('%2e'))throw new Error('CANDIDATE_PATH_ESCAPE_REJECTED');}}
 private async sha(text:string){this.assertCrypto();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');}
 restorePrevious(transactionId:string):CandidateCommitTransaction|undefined{const row=this.rows.get(transactionId);if(!row?.previousTransactionId)return undefined;const previous=this.rows.get(row.previousTransactionId);return previous?.status==='COMMITTED'?this.clone(previous):undefined;}
 markRecoveryRequired(transactionId:string,failure:string):CandidateCommitTransaction|undefined{const row=this.rows.get(transactionId);if(!row)return undefined;row.status='RECOVERY_REQUIRED';row.failure=failure;row.updatedAt=Date.now();this.safePersist();return this.clone(row);}
 listRecoveryRequired(){return this.list().filter(row=>row.status==='RECOVERY_REQUIRED');}
 private persist(){const protectedIds=new Set([...this.rows.values()].filter(row=>row.status==='COMMITTED'||row.status==='RECOVERY_REQUIRED').flatMap(row=>[row.transactionId,row.previousTransactionId||'']));const rows=[...this.rows.values()].filter(row=>protectedIds.has(row.transactionId)||row.status!=='ROLLED_BACK');storageService.setItem(KEY,JSON.stringify(rows.slice(-1000)));}
 private safePersist(){try{this.persist();}catch{/* recovery remains fail-closed in memory */}}
 private load(){try{const raw=storageService.getItem(KEY);const values:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(values))return;for(const value of values)if(this.isRow(value))this.rows.set(value.transactionId,value);}catch{this.rows.clear();}}
 private isRow(value:unknown):value is CandidateCommitTransaction{if(typeof value!=='object'||value===null)return false;const row=value as Partial<CandidateCommitTransaction>;return row.schemaVersion===1&&typeof row.transactionId==='string'&&typeof row.issueId==='string'&&typeof row.workspaceId==='string'&&typeof row.guardId==='string'&&typeof row.revision==='number'&&Array.isArray(row.files)&&typeof row.baselineSnapshotSha256==='string'&&typeof row.candidateManifestSha256==='string'&&typeof row.candidateRevisionSha256==='string'&&typeof row.operationInstanceId==='string'&&typeof row.manifest==='object'&&row.manifest!==null&&['STAGED','APPLYING','COMMITTED','ROLLED_BACK','RECOVERY_REQUIRED'].includes(String(row.status));}
 private clone(row:CandidateCommitTransaction):CandidateCommitTransaction{return {...row,files:row.files.map(file=>({...file,evidenceIds:[...file.evidenceIds]}))};}
}
export const candidateCommitTransactionService=new CandidateCommitTransactionService();

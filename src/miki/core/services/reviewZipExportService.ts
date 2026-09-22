import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { isolatedCandidateWorkspaceService } from './isolatedCandidateWorkspaceService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { candidateValidationEvidenceService } from './candidateValidationEvidenceService';
import { shadowEvaluationService } from './shadowEvaluationService';
import { canonicalSha256 } from './canonicalSha256Service';
import { candidateUnknownResolutionService } from './candidateUnknownResolutionService';
import { persistenceReceiptLedgerService } from './persistenceReceiptLedgerService';

export type ReviewPackageStatus='READY_FOR_EXTERNAL_REVIEW'|'EXTERNAL_REVIEW_PENDING'|'ACCEPTED'|'REJECTED'|'NEEDS_CHANGES'|'HOLD';
export type ReviewZipCreateCode='SUCCESS'|'RUN_NOT_FOUND'|'WORKSPACE_NOT_FOUND'|'NO_CANDIDATE_FILES'|'PACKAGE_NOT_FOUND'|'SNAPSHOT_MISMATCH'|'ZIP_BUILD_FAILED'|'ZIP_VERIFY_FAILED'|'SAVE_FAILED';
export type ReviewPackageCreationMode='NEW_SERIES'|'NEXT_PACKAGE_REVISION';
export interface ReviewPackageLedgerRecord {
 packageId:string; candidateId?:string; validationBundleId?:string; packageSeriesId:string; packageRevision:number; candidateRevision:number; workspaceId:string; runId:string;
 transactionId:string; corePlanRevision:string; operationInstanceId:string; persistenceReceiptId:string;
 fileName:string; zipSha256:string; candidateManifestSha256:string; baselineManifestSha256:string; packageManifestSha256:string; packageLedgerReceiptId?:string;
 status:ReviewPackageStatus; createdAt:number;
 inputs:{issueId:string;objective:string;files:Array<{path:string;baselineContent:string;candidateContent:string;baselineSha256:string;candidateSha256:string;evidenceIds:string[]}>};
}
export interface ReviewZipArtifact extends ReviewPackageLedgerRecord {blob:Blob;size:number;}
export interface ReviewZipCreateResult {ok:boolean;code:ReviewZipCreateCode;artifact?:ReviewZipArtifact;message:string;}
const LEDGER_KEY='miki_review_package_ledger_v3';
const LEGACY_LEDGER_KEY='miki_review_package_ledger_v2';
const textBytes=(value:string)=>new TextEncoder().encode(value).length;
class ReviewZipExportService {
 private ledger=new Map<string,ReviewPackageLedgerRecord>();
 constructor(){this.load();}
 async create(runId:string,workspaceId:string,options:{mode?:ReviewPackageCreationMode;sourcePackageId?:string;corePlanRevision?:number;operationInstanceId?:string;candidateId?:string;candidateManifestSha256?:string;validationBundleId?:string;taskId?:string;externalReviewQuestions?:string[];learningLineage?:unknown}={}):Promise<ReviewZipCreateResult>{
  const run=improvementIntakeRouterService.get(runId); if(!run)return {ok:false,code:'RUN_NOT_FOUND',message:`Run not found: ${runId}`};
  const workspace=isolatedCandidateWorkspaceService.get(workspaceId); if(!workspace)return {ok:false,code:'WORKSPACE_NOT_FOUND',message:`Workspace not found: ${workspaceId}`};
  if(workspace.files.length===0)return {ok:false,code:'NO_CANDIDATE_FILES',message:'Candidate workspace contains no files'};
  const source=options.sourcePackageId?this.ledger.get(options.sourcePackageId):undefined;
  if(options.sourcePackageId&&!source)return {ok:false,code:'PACKAGE_NOT_FOUND',message:`Package not found: ${options.sourcePackageId}`};
  const mode=options.mode??'NEW_SERIES';
  const packageSeriesId=mode==='NEXT_PACKAGE_REVISION'&&source?source.packageSeriesId:`RPS-${canonicalSha256({runId,workspaceId,createdAt:Date.now(),count:this.ledger.size}).slice(0,24)}`;
  const packageRevision=mode==='NEXT_PACKAGE_REVISION'?this.nextPackageRevision(packageSeriesId):1;
  const candidateRevision=workspace.committedRevision??this.nextCandidateRevision(runId,workspaceId);
  const transactionId=workspace.transactionId??'UNCOMMITTED';
  const persistenceReceiptId=workspace.persistenceReceiptId??'UNAVAILABLE';
  const corePlanRevision=String(options.corePlanRevision??run.payload.corePlanRevision??run.payload.planRevision??'UNAVAILABLE');
  const operationInstanceId=String(options.operationInstanceId??run.payload.operationInstanceId??'UNAVAILABLE');
  const candidateId=String(options.candidateId||`CAND-${workspace.workspaceId}`);
  const candidateManifestSha256=String(options.candidateManifestSha256||workspace.candidateRevisionSha256);
  const validationBundleId=String(options.validationBundleId||`VAL-${candidateId}`);
  try{
   const snapshotFiles=workspace.files.map(file=>({...file,evidenceIds:[...file.evidenceIds]}));
   const baselineManifest={formatVersion:1,workspaceId,issueId:workspace.issueId,files:snapshotFiles.map(file=>({path:file.path,size:textBytes(file.baselineContent),sha256:file.baselineSha256}))};
   const baselineManifestSha256=canonicalSha256(baselineManifest);
   const candidateManifestBody={formatVersion:3,candidateId,validationBundleId,learningLineage:options.learningLineage??null,packageSeriesId,packageRevision,candidateRevision,workspaceId,runId,issueId:workspace.issueId,transactionId,corePlanRevision,operationInstanceId,persistenceReceiptId,externalDirective:{directiveId:run.payload.directiveId||null,sourceHash:run.payload.sourceHash||null,targetFiles:run.payload.targetFiles||[],requirements:run.payload.requirements||[],prohibitions:run.payload.prohibitions||[],invariants:run.payload.invariants||[],validationRequirements:run.payload.validationRequirements||[],deliveryRequirements:run.payload.deliveryRequirements||[],relatedIssueIds:run.payload.relatedIssueIds||[]},files:snapshotFiles.map(file=>({path:file.path,size:textBytes(file.candidateContent),sha256:file.candidateSha256,evidenceIds:file.evidenceIds}))};
   const packageId=`RPK-${canonicalSha256({packageSeriesId,packageRevision,candidateManifestSha256}).slice(0,24)}`;
   const packageManifest={...candidateManifestBody,packageId,baselineManifestSha256,candidateManifestSha256};
   const packageManifestSha256=canonicalSha256(packageManifest);
   const validation=candidateValidationEvidenceService.list(workspaceId);
   const validationManifest=candidateValidationEvidenceService.evaluate(workspaceId,workspace.candidateRevisionSha256);
   const shadow=shadowEvaluationService.latest(workspaceId);
   const candidateUnknownContext=candidateUnknownResolutionService.get(runId);
   const unresolvedChecks=[...[...validationManifest.missing.map(item=>`MISSING:${item}`),...validationManifest.failed.map(item=>`FAILED:${item}`)],...(candidateUnknownContext?.candidateNotes??[])];
   const changedFiles=snapshotFiles.filter(file=>file.baselineSha256!==file.candidateSha256).map(file=>file.path);
   const changeHistory={packageId,packageSeriesId,packageRevision,candidateRevision,previousPackageId:source?.packageId??null,createdAt:Date.now(),changedFiles};
   const issue={issueId:workspace.issueId,runId,objective:run.objective,sourceId:run.sourceId,runType:run.runType};
   const reviewRequest={packageId,candidateId,validationBundleId,packageSeriesId,packageRevision,candidateRevision,transactionId,corePlanRevision,operationInstanceId,persistenceReceiptId,packageManifestSha256,candidateManifestSha256,objective:'Evaluate this isolated MIKI-AI self-improvement candidate. Do not assume it is adopted or applied.',changedFiles,evaluationPoints:['correctness','regression risk','security and safety','maintainability','baseline-to-candidate consistency'],unresolvedChecks,requestedResponse:{packageId:'repeat exactly',packageManifestSha256:'repeat exactly',decision:'ACCEPT|REJECT|NEEDS_CHANGES',findings:'ordered list',requiredChanges:'ordered list'},externalReviewQuestions:options.externalReviewQuestions||[]};
   const zip=new JSZip();
   for(const file of snapshotFiles){zip.file(`baseline/${file.path}`,file.baselineContent);zip.file(`candidate/${file.path}`,file.candidateContent);}
   zip.file('baseline_manifest.json',JSON.stringify({...baselineManifest,baselineManifestSha256},null,2));
   zip.file('candidate_manifest.json',JSON.stringify(packageManifest,null,2));
   zip.file('package_manifest.json',JSON.stringify({...packageManifest,packageManifestSha256},null,2));
   zip.file('change_history.json',JSON.stringify(changeHistory,null,2));
   zip.file('issue.json',JSON.stringify(issue,null,2));
   zip.file('validation.json',JSON.stringify({schemaVersion:2,workspaceId,validationManifest,validationSummary:validationManifest,requirements:{validationRequirements:run.payload.validationRequirements||[],deliveryRequirements:run.payload.deliveryRequirements||[]},performed:validation.filter(item=>item.passed).map(item=>({...item,status:'PASSED'})),unperformed:validationManifest.missing.map(stage=>({stage,status:'NOT_RUN'})),shadowEvaluation:shadow??null,disclosure:'NOT_RUN and ENVIRONMENT_UNAVAILABLE are never treated as PASS'},null,2));
   zip.file('unresolved_checks.json',JSON.stringify({packageId,items:unresolvedChecks,candidateUnknownContext:candidateUnknownContext??null,externalQuestions:candidateUnknownContext?.externalQuestions??[]},null,2));
   zip.file('review_request.json',JSON.stringify(reviewRequest,null,2));
   const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
   if(!await this.verify(blob,{packageManifestSha256,baselineManifestSha256,candidateManifestSha256,files:snapshotFiles}))return {ok:false,code:'ZIP_VERIFY_FAILED',message:'Generated ZIP failed entry or SHA verification'};
   const zipSha256=await this.sha(blob); const createdAt=Date.now();
   const record:ReviewPackageLedgerRecord={packageId,candidateId,validationBundleId,packageSeriesId,packageRevision,candidateRevision,workspaceId,runId,transactionId,corePlanRevision,operationInstanceId,persistenceReceiptId,fileName:`MIKI-AI-review-${packageSeriesId}-r${packageRevision}-${packageId}.zip`,zipSha256,candidateManifestSha256,baselineManifestSha256,packageManifestSha256,status:'EXTERNAL_REVIEW_PENDING',createdAt,inputs:{issueId:workspace.issueId,objective:run.objective,files:snapshotFiles}};
   this.ledger.set(packageId,record); if(!this.save()){this.ledger.delete(packageId);return {ok:false,code:'SAVE_FAILED',message:'Review package ledger could not be persisted'};}
   const packageLedgerReceiptId=`PR-PKG-${packageId}`;
   try{
    const receipt=persistenceReceiptLedgerService.register({
      receiptId:packageLedgerReceiptId,entityType:'REVIEW_PACKAGE',entityId:packageId,entitySha256:packageManifestSha256,
      storageKey:LEDGER_KEY,persistedAt:Date.now(),reloaded:true,
      taskId:options.taskId||workspace.issueId,corePlanRevision:Number(corePlanRevision)||0,operationInstanceId,targetSha256:packageManifestSha256
    },'miki_candidate_persistence_receipts_v1');
    record.packageLedgerReceiptId=receipt.receiptId;
    if(!this.save()){this.ledger.delete(packageId);return {ok:false,code:'SAVE_FAILED',message:'Review package receipt could not be persisted'};}
   }catch(error){this.ledger.delete(packageId);return {ok:false,code:'SAVE_FAILED',message:error instanceof Error?error.message:String(error)};}
   isolatedCandidateWorkspaceService.setStatus(workspaceId,'EXPORTED');
   return {ok:true,code:'SUCCESS',message:'Evaluation ZIP created, reloaded, and SHA verified',artifact:{...this.clone(record),blob,size:blob.size}};
  }catch(error){return {ok:false,code:'ZIP_BUILD_FAILED',message:error instanceof Error?error.message:String(error)};}
 }
 async regenerate(packageId:string):Promise<ReviewZipCreateResult>{
  const record=this.ledger.get(packageId); if(!record)return {ok:false,code:'PACKAGE_NOT_FOUND',message:`Package not found: ${packageId}`};
  const current=isolatedCandidateWorkspaceService.get(record.workspaceId);
  if(!current||canonicalSha256(current.files.map(file=>({path:file.path,baselineSha256:file.baselineSha256,candidateSha256:file.candidateSha256})))!==canonicalSha256(record.inputs.files.map(file=>({path:file.path,baselineSha256:file.baselineSha256,candidateSha256:file.candidateSha256}))))return this.rebuildFromSnapshot(record);
  return this.rebuildFromSnapshot(record);
 }
 async createNextPackage(packageId:string):Promise<ReviewZipCreateResult>{const source=this.ledger.get(packageId);if(!source)return {ok:false,code:'PACKAGE_NOT_FOUND',message:`Package not found: ${packageId}`};return this.create(source.runId,source.workspaceId,{mode:'NEXT_PACKAGE_REVISION',sourcePackageId:packageId});}
 async createNewSeries(packageId:string):Promise<ReviewZipCreateResult>{const source=this.ledger.get(packageId);if(!source)return {ok:false,code:'PACKAGE_NOT_FOUND',message:`Package not found: ${packageId}`};return this.create(source.runId,source.workspaceId,{mode:'NEW_SERIES',sourcePackageId:packageId});}
 list(){return [...this.ledger.values()].sort((a,b)=>b.createdAt-a.createdAt).map(value=>this.clone(value));}
 updateStatus(packageId:string,status:ReviewPackageStatus){const item=this.ledger.get(packageId);if(!item)return undefined;item.status=status;if(!this.save())throw new Error('REVIEW_PACKAGE_STATUS_SAVE_FAILED');return this.clone(item);}
 download(artifact:ReviewZipArtifact){const url=URL.createObjectURL(artifact.blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=artifact.fileName;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {fileName:artifact.fileName,size:artifact.size,sha256:artifact.zipSha256};}
 private async rebuildFromSnapshot(record:ReviewPackageLedgerRecord):Promise<ReviewZipCreateResult>{
  const zip=new JSZip(); for(const file of record.inputs.files){zip.file(`baseline/${file.path}`,file.baselineContent);zip.file(`candidate/${file.path}`,file.candidateContent);}
  const base={formatVersion:1,workspaceId:record.workspaceId,issueId:record.inputs.issueId,files:record.inputs.files.map(file=>({path:file.path,size:textBytes(file.baselineContent),sha256:file.baselineSha256})),baselineManifestSha256:record.baselineManifestSha256};
  const manifest={formatVersion:3,packageId:record.packageId,candidateId:record.candidateId,validationBundleId:record.validationBundleId,packageSeriesId:record.packageSeriesId,packageRevision:record.packageRevision,candidateRevision:record.candidateRevision,workspaceId:record.workspaceId,runId:record.runId,issueId:record.inputs.issueId,transactionId:record.transactionId,corePlanRevision:record.corePlanRevision,operationInstanceId:record.operationInstanceId,persistenceReceiptId:record.persistenceReceiptId,files:record.inputs.files.map(file=>({path:file.path,size:textBytes(file.candidateContent),sha256:file.candidateSha256,evidenceIds:file.evidenceIds})),baselineManifestSha256:record.baselineManifestSha256,candidateManifestSha256:record.candidateManifestSha256};
  zip.file('baseline_manifest.json',JSON.stringify(base,null,2));zip.file('candidate_manifest.json',JSON.stringify(manifest,null,2));zip.file('package_manifest.json',JSON.stringify({...manifest,packageManifestSha256:record.packageManifestSha256},null,2));zip.file('change_history.json',JSON.stringify({packageId:record.packageId,packageSeriesId:record.packageSeriesId,packageRevision:record.packageRevision,candidateRevision:record.candidateRevision,regeneratedFromFrozenSnapshot:true},null,2));zip.file('issue.json',JSON.stringify({issueId:record.inputs.issueId,runId:record.runId,objective:record.inputs.objective},null,2));const frozenValidationManifest=candidateValidationEvidenceService.evaluate(record.workspaceId,record.candidateManifestSha256);zip.file('validation.json',JSON.stringify({schemaVersion:2,workspaceId:record.workspaceId,validationManifest:frozenValidationManifest,validationSummary:frozenValidationManifest,performed:candidateValidationEvidenceService.list(record.workspaceId).filter(item=>item.passed).map(item=>({...item,status:'PASSED'})),unperformed:frozenValidationManifest.missing.map(stage=>({stage,status:'NOT_RUN'})),shadowEvaluation:shadowEvaluationService.latest(record.workspaceId)??null,disclosure:'NOT_RUN and ENVIRONMENT_UNAVAILABLE are never treated as PASS'},null,2));zip.file('unresolved_checks.json',JSON.stringify({packageId:record.packageId,items:frozenValidationManifest.missing.map(stage=>`NOT_RUN:${stage}`)},null,2));zip.file('review_request.json',JSON.stringify({packageId:record.packageId,packageManifestSha256:record.packageManifestSha256,decision:'ACCEPT|REJECT|NEEDS_CHANGES'},null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});const verified=await this.verify(blob,{packageManifestSha256:record.packageManifestSha256,baselineManifestSha256:record.baselineManifestSha256,candidateManifestSha256:record.candidateManifestSha256,files:record.inputs.files});if(!verified)return {ok:false,code:'ZIP_VERIFY_FAILED',message:'Frozen package snapshot failed ZIP verification'};const zipSha256=await this.sha(blob);const artifact={...this.clone(record),blob,size:blob.size,zipSha256};return {ok:true,code:'SUCCESS',message:'Frozen evaluation ZIP regenerated and verified',artifact};
 }
 private nextPackageRevision(seriesId:string){return this.list().filter(item=>item.packageSeriesId===seriesId).reduce((max,item)=>Math.max(max,item.packageRevision),0)+1;}
 private nextCandidateRevision(runId:string,workspaceId:string){return this.list().filter(item=>item.runId===runId&&item.workspaceId===workspaceId).reduce((max,item)=>Math.max(max,item.candidateRevision),0)+1;}
 private async verify(blob:Blob,expected:{packageManifestSha256:string;baselineManifestSha256:string;candidateManifestSha256:string;files:Array<{path:string;baselineContent:string;candidateContent:string;baselineSha256:string;candidateSha256:string}>}){const zip=await JSZip.loadAsync(blob);for(const path of ['baseline_manifest.json','candidate_manifest.json','package_manifest.json','change_history.json','issue.json','validation.json','unresolved_checks.json','review_request.json'])if(!zip.file(path))return false;const packageManifest=JSON.parse(await zip.file('package_manifest.json')!.async('string'));if(packageManifest.packageManifestSha256!==expected.packageManifestSha256||packageManifest.baselineManifestSha256!==expected.baselineManifestSha256||packageManifest.candidateManifestSha256!==expected.candidateManifestSha256)return false;for(const file of expected.files){for(const [area,content,sha256] of [['baseline',file.baselineContent,file.baselineSha256],['candidate',file.candidateContent,file.candidateSha256]] as const){const entry=zip.file(`${area}/${file.path}`);if(!entry||canonicalSha256(await entry.async('string'))!==sha256||canonicalSha256(content)!==sha256)return false;}}return true;}
 private async sha(blob:Blob){const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
 private clone(value:ReviewPackageLedgerRecord):ReviewPackageLedgerRecord{return {...value,inputs:{...value.inputs,files:value.inputs.files.map(file=>({...file,evidenceIds:[...file.evidenceIds]}))}};}
 private save(){try{storageService.setItem(LEDGER_KEY,JSON.stringify(this.list().slice(0,100)));return true;}catch{return false;}}
 private load(){try{const raw=storageService.getItem(LEDGER_KEY)??storageService.getItem(LEGACY_LEDGER_KEY);const values=raw?JSON.parse(raw):[];if(Array.isArray(values))for(const value of values){const migrated:ReviewPackageLedgerRecord={...value,candidateId:value.candidateId??`CAND-${value.workspaceId}`,validationBundleId:value.validationBundleId??`VAL-CAND-${value.workspaceId}`,packageSeriesId:value.packageSeriesId??`LEGACY-${value.packageId}`,packageRevision:value.packageRevision??1,transactionId:value.transactionId??'UNAVAILABLE',corePlanRevision:value.corePlanRevision??'UNAVAILABLE',operationInstanceId:value.operationInstanceId??'UNAVAILABLE',persistenceReceiptId:value.persistenceReceiptId??'UNAVAILABLE',baselineManifestSha256:value.baselineManifestSha256??canonicalSha256(value.inputs?.files?.map((file:any)=>({path:file.path,sha256:file.baselineSha256}))??[]),packageManifestSha256:value.packageManifestSha256??value.candidateManifestSha256,packageLedgerReceiptId:value.packageLedgerReceiptId,inputs:{...value.inputs,objective:value.inputs?.objective??''}};this.ledger.set(migrated.packageId,migrated);}}catch{this.ledger.clear();}}
}
export const reviewZipExportService=new ReviewZipExportService();

import { autonomousIssueDiscoveryService, type DiscoveredIssue, type DiscoveredIssueKind } from './autonomousIssueDiscoveryService';
import { isolatedCandidateWorkspaceService, type CandidateWorkspace } from './isolatedCandidateWorkspaceService';
import { selfCodeSpaceService } from './selfCodeSpaceService';

export interface TargetResolution { issueId:string; targetPaths:string[]; evidenceIds:string[]; confidence:number; reasons:string[]; }
export interface CandidateDraft { issueId:string; targetPath:string; baselineContent:string; candidateContent:string; evidenceIds:string[]; generationMode:'AI_SUPPLIED'|'SAFE_TEMPLATE'; }
export interface AutonomousImplementationPlan {
 version:1;
 source:'AUTONOMOUS_ISSUE'|'REVIEW_REVALIDATION';
 issueId:string;
 targetPaths:string[];
 changeScope:'MINIMAL_SINGLE_FILE'|'MINIMAL_MULTI_FILE';
 investigationSteps:string[];
 requiredValidation:string[];
 forbiddenExpansion:string[];
 rationale:string[];
 confidence:number;
}
class AutonomousCandidatePreparationService {
 buildImplementationPlan(issue:DiscoveredIssue,resolution:TargetResolution):AutonomousImplementationPlan{
  const stepsByKind:Record<DiscoveredIssueKind,string[]>={
   EXECUTION_FAILURE:['失敗シグネチャと発生環境を確認する','対象ファイルと依存呼び出しを最小範囲で確認する','既存の再現・回帰テストを確認する'],
   KNOWLEDGE_GAP:['不足知識が実装要求に本当に必要か確認する','Research/Evidence/Verification境界を確認する','未検証推測を実装仕様として固定しない'],
   CAPABILITY_GAP:['既存Capability Registryで代替可能か確認する','Promotion/Verification境界を確認する','新規Capabilityが本当に必要な場合だけ対象を限定する'],
   STALLED_TASK:['TaskBlackboardの現在状態と停止理由を確認する','既存pause/resume/replan経路を確認する','状態遷移を増やさず再開または安全終了条件を明確化する'],
   DOMAIN_DISCONNECTED:['既存CORE/Cross-Domain循環の入口と出口を確認する','不足している既存Command/Event経路を特定する','独立Orchestratorを増設せず既存循環へ接続する'],
   CLAIM_CONTRADICTION:['ClaimのEvidenceと現在のRevision状態を確認する','独立Evidence・矛盾処理経路を確認する','未解決矛盾を確定事実へ変換しない'],
   IMPROVEMENT_DEBT:['負債の発生原因と既存試行履歴を確認する','未実行検証・回帰・反例ゲートを確認する','同一失敗の無限再試行を避ける'],
  };
  const investigationSteps=stepsByKind[issue.kind]||['既存実装と要求の差分を確認する','最小変更対象を確定する','既存検証経路を確認する'];
  const requiredValidation=['TypeScript/構文検査','既存単体・回帰テスト','Counterexample/境界値検証','RequirementContract評価','既存CORE/安全ゲート通過'];
  const forbiddenExpansion=['対象外ファイルへの変更','新しいDB/Blackboard/Truth Storeの追加','新しいOrchestrator/Queue/最上位司令塔の追加','未検証外部コードの直接実行・採用','検証結果を変更理由の証拠として偽装すること'];
  const targetPaths=[...resolution.targetPaths].sort((a,b)=>a.localeCompare(b));
  const changeScope=targetPaths.length<=1?'MINIMAL_SINGLE_FILE':'MINIMAL_MULTI_FILE';
  return {version:1,source:'AUTONOMOUS_ISSUE',issueId:issue.id,targetPaths,changeScope,investigationSteps,requiredValidation,forbiddenExpansion,rationale:[`Issue ${issue.id}: ${issue.title}`,`source=${issue.sourceId}`,`resolutionConfidence=${resolution.confidence.toFixed(3)}`,...resolution.reasons.slice(0,8)],confidence:resolution.confidence};
 }

 async prepare(issueId:string,aiCandidates?:Array<{path:string;candidateContent:string;evidenceIds?:string[]}>,targetPaths?:string[]):Promise<CandidateWorkspace|undefined>{
  const issue=autonomousIssueDiscoveryService.list(500).find(x=>x.id===issueId);if(!issue)return undefined;
  const resolvedTargetPaths=[...(targetPaths||[])].filter(Boolean);const sourceMap=new Map(selfCodeSpaceService.listSourceFiles().map(file=>[file.path,file]));
  if(resolvedTargetPaths.length===0)return undefined;
  const supplied=new Map((aiCandidates||[]).map(x=>[x.path,x]));const drafts:CandidateDraft[]=[];
  for(const path of resolvedTargetPaths){const source=sourceMap.get(path);if(!source)continue;const candidate=supplied.get(path);const candidateContent=candidate?.candidateContent||this.safeTemplate(source.content,issue);if(candidateContent.trim()===source.content.trim())continue;drafts.push({issueId,targetPath:path,baselineContent:source.content,candidateContent,evidenceIds:[...new Set([...source.evidenceIds,...(candidate?.evidenceIds||[])])],generationMode:candidate?'AI_SUPPLIED':'SAFE_TEMPLATE'});}
  if(drafts.length===0)return undefined;return isolatedCandidateWorkspaceService.create(issueId,drafts.map(x=>({path:x.targetPath,baselineContent:x.baselineContent,candidateContent:x.candidateContent,evidenceIds:x.evidenceIds})));
 }

 async prepareForRun(runId:string,aiCandidates?:Array<{path:string;candidateContent:string;evidenceIds?:string[]}>):Promise<{workspaceId?:string;targetPaths:string[];missingPaths:string[];reason?:string}>{
  const { improvementIntakeRouterService }=await import('./improvementIntakeRouterService');const run=improvementIntakeRouterService.get(runId);const sourceMap=new Map(selfCodeSpaceService.listSourceFiles().map(file=>[file.path,file]));if(!run)return {targetPaths:[],missingPaths:[],reason:'IMPROVEMENT_RUN_NOT_FOUND'};
  if(run.runType==='EXTERNAL_DIRECTIVE'){
   const targetPaths=Array.isArray(run.payload.targetFiles)?run.payload.targetFiles.filter((value):value is string=>typeof value==='string'):[];const missingPaths=targetPaths.filter(path=>!sourceMap.has(path));if(targetPaths.length===0)return {targetPaths:[],missingPaths:[],reason:'EXTERNAL_DIRECTIVE_TARGETS_MISSING'};if(missingPaths.length>0)return {targetPaths,missingPaths,reason:'EXTERNAL_DIRECTIVE_TARGET_NOT_FOUND'};
   const supplied=new Map((aiCandidates||[]).map(candidate=>[candidate.path,candidate]));const drafts=[] as Array<{path:string;baselineContent:string;candidateContent:string;evidenceIds:string[]}>;
   for(const path of targetPaths){const source=sourceMap.get(path);const candidate=supplied.get(path);if(!source||!candidate||candidate.candidateContent.trim()===source.content.trim())continue;drafts.push({path,baselineContent:source.content,candidateContent:candidate.candidateContent,evidenceIds:[...new Set([...source.evidenceIds,...(candidate.evidenceIds||[])])]});}
   if(drafts.length===0)return {targetPaths,missingPaths:[],reason:'EXTERNAL_DIRECTIVE_AI_CANDIDATE_REQUIRED'};const workspace=await isolatedCandidateWorkspaceService.create(runId,drafts,runId);improvementIntakeRouterService.update(runId,{workspaceId:workspace.workspaceId,status:'IN_PROGRESS'});return {workspaceId:workspace.workspaceId,targetPaths,missingPaths:[]};
  }
  const issueId=typeof run.payload.issueId==='string'?run.payload.issueId:run.sourceId;
  const issue=(await import('./autonomousIssueDiscoveryService')).autonomousIssueDiscoveryService.list(500).find(item=>item.id===issueId);
  if(!issue)return {targetPaths:[],missingPaths:[],reason:'AUTONOMOUS_ISSUE_NOT_FOUND'};
  const targetPaths=Array.isArray(run.payload.targetFiles)
    ? run.payload.targetFiles.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).map(value=>value.trim())
    : [];
  if(targetPaths.length===0)return {targetPaths:[],missingPaths:[],reason:'CORE_TARGET_FILES_REQUIRED'};
  const missingPaths=targetPaths.filter(path=>!sourceMap.has(path));
  if(missingPaths.length>0)return {targetPaths,missingPaths,reason:'CORE_TARGET_FILES_NOT_FOUND'};
  const resolution:TargetResolution={
    issueId:issue.id,
    targetPaths:[...new Set(targetPaths)].slice(0,3),
    evidenceIds:[],
    confidence:1,
    reasons:['TARGETS_SELECTED_BY_CORE']
  };
  const implementationPlan=this.buildImplementationPlan(issue,resolution);
  improvementIntakeRouterService.update(runId,{implementationPlan,status:'IN_PROGRESS'});
  if(!aiCandidates||aiCandidates.length===0)return {targetPaths:resolution.targetPaths,missingPaths:[]};
  const workspace=await this.prepare(issue.id,aiCandidates,resolution.targetPaths);
  if(!workspace)return {targetPaths:resolution.targetPaths,missingPaths:[],reason:'AUTONOMOUS_AI_CANDIDATE_REQUIRED'};
  improvementIntakeRouterService.update(runId,{workspaceId:workspace.workspaceId,status:'IN_PROGRESS'});
  return {workspaceId:workspace.workspaceId,targetPaths:resolution.targetPaths,missingPaths:[]};
 }

 private safeTemplate(content:string,issue:DiscoveredIssue):string{const note=`\n/* MIKI-AI isolated candidate note\n * Issue: ${issue.kind} / ${issue.id}\n * This draft is isolated and requires AI-supplied implementation plus validation.\n */\n`;return content+note;}

}
export const autonomousCandidatePreparationService=new AutonomousCandidatePreparationService();

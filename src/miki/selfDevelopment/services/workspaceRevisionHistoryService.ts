import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { isolatedCandidateWorkspaceService,type CandidateWorkspace } from '../../core/services/isolatedCandidateWorkspaceService';
export interface WorkspaceRevisionRecord{revisionId:string;instructionId:string;workspaceId:string;parentWorkspaceId?:string;revision:number;candidateSha256:string;reason:string;createdAt:number;}
const KEY='miki_workspace_revision_history_v1';
class WorkspaceRevisionHistoryService{
 async createRevision(instructionId:string,parent:CandidateWorkspace,reason:string,files:Array<{path:string;candidateContent:string;evidenceIds:string[]}>){
  const revisions=this.list().filter(row=>row.instructionId===instructionId);
  const revision=Math.max(0,...revisions.map(row=>row.revision))+1;
  const candidates=files.map(file=>{
   const previous=parent.files.find(row=>row.path===file.path);
   return {path:file.path,baselineContent:previous?.candidateContent||'',candidateContent:file.candidateContent,evidenceIds:[...new Set([...file.evidenceIds,`PARENT_WORKSPACE:${parent.workspaceId}`])]};
  });
  const workspace=await isolatedCandidateWorkspaceService.create(`${parent.issueId}:revision:${revision}`,candidates,parent.runId);
  const record:WorkspaceRevisionRecord={revisionId:`WREV-${canonicalSha256({instructionId,parent:parent.workspaceId,workspace:workspace.workspaceId,revision}).slice(0,24)}`,instructionId,workspaceId:workspace.workspaceId,parentWorkspaceId:parent.workspaceId,revision,candidateSha256:workspace.candidateRevisionSha256,reason,createdAt:Date.now()};
  const rows=this.list();rows.unshift(record);storageService.setItem(KEY,JSON.stringify(rows.slice(0,500)));return {workspace,record};
 }
 list():WorkspaceRevisionRecord[]{try{const rows=JSON.parse(storageService.getItem(KEY)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}}
}
export const workspaceRevisionHistoryService=new WorkspaceRevisionHistoryService();

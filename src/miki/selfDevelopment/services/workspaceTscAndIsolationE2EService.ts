import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { isolatedCandidateWorkspaceService } from '../../core/services/isolatedCandidateWorkspaceService';
import { reviewZipExportService } from '../../core/services/reviewZipExportService';
import { repositoryTypeScriptResolutionService } from './repositoryTypeScriptResolutionService';
import { workspaceRollbackAuditService } from './workspaceRollbackAuditService';
class WorkspaceTscAndIsolationE2EService{
 async verify(runId:string,workspaceId:string){
  const workspace=isolatedCandidateWorkspaceService.get(workspaceId);
  if(!workspace)return {passed:false,reasons:['WORKSPACE_NOT_FOUND']};
  const snapshot=()=>canonicalSha256(workspace.files.map(file=>({path:file.path,content:file.baselineContent})));
  const canonicalBefore=snapshot();
  const tsc=await repositoryTypeScriptResolutionService.resolve(workspaceId,5);
  if(!tsc.passed){
   const audit=workspaceRollbackAuditService.record(workspace,'TSC_NON_ZERO',tsc);
   return {passed:false,tsc,audit,canonicalUnchanged:canonicalBefore===snapshot()};
  }
  const packageResult=await reviewZipExportService.create(runId,workspaceId);
  return {passed:packageResult.ok,tsc,packageId:packageResult.artifact?.packageId,canonicalUnchanged:canonicalBefore===snapshot(),reasons:packageResult.ok?[]:[packageResult.message]};
 }
 verifyRejectedCandidateIsolation(workspaceId:string){
  const workspace=isolatedCandidateWorkspaceService.get(workspaceId);
  if(!workspace)return {passed:false,reasons:['WORKSPACE_NOT_FOUND']};
  const snapshot=()=>canonicalSha256(workspace.files.map(file=>({path:file.path,content:file.baselineContent})));
  const baseline=snapshot();
  isolatedCandidateWorkspaceService.setStatus(workspaceId,'DISCARDED');
  const after=snapshot();
  return {passed:baseline===after&&workspace.status==='DISCARDED',baselineSha256:baseline,canonicalAfterSha256:after,status:workspace.status};
 }
}
export const workspaceTscAndIsolationE2EService=new WorkspaceTscAndIsolationE2EService();

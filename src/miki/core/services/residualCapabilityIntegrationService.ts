import { memoryRecordRepositoryService } from '../../memory/services/memoryRecordRepositoryService';
import { postPromotionStabilityService } from './postPromotionStabilityService';
import { storageAuthorityRegistryService } from './storageAuthorityRegistryService';
import { workspaceRevisionHistoryService } from '../../selfDevelopment/services/workspaceRevisionHistoryService';
import { typescriptCompilerLoaderService } from '../../selfDevelopment/services/typescriptCompilerLoaderService';
import { vbaDesignAssistantService } from '../../selfDevelopment/services/vbaDesignAssistantService';
export interface ResidualIntegrationRequest{workspaceId?:string;candidateSha256?:string;preloadTypeScript?:boolean;vbaRequirement?:string;}
class ResidualCapabilityIntegrationService{
 snapshot(request:ResidualIntegrationRequest={}){
  storageAuthorityRegistryService.assertUnique();
  const stability=request.workspaceId&&request.candidateSha256?postPromotionStabilityService.evaluate(request.workspaceId,request.candidateSha256):undefined;
  if(request.preloadTypeScript===true)typescriptCompilerLoaderService.preloadWhenIdle();
  const vbaDesign=request.vbaRequirement?vbaDesignAssistantService.generateDesignSpecification(request.vbaRequirement):undefined;
  return {memory:{backend:memoryRecordRepositoryService.backend(),count:memoryRecordRepositoryService.listAll().length},storageAuthorities:storageAuthorityRegistryService.list(),workspaceRevisionCount:workspaceRevisionHistoryService.list().length,stability,vbaDesign,informationFlow:{memory:'memoryRecordRepositoryService->core snapshot',storage:'storageAuthorityRegistryService->core invariant',revision:'workspaceRevisionHistoryService->core evidence',stability:'postPromotionStabilityService->core adoption guard',typescript:'explicit idle preload only',vba:'explicit requirement->design specification'}};
 }
}
export const residualCapabilityIntegrationService=new ResidualCapabilityIntegrationService();

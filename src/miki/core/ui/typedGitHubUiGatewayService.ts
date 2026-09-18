import { apiService } from '../../../services/api';
import { storageService } from '../../../services/storageService';
import { unknownResolutionService, type UnknownResolution } from '../../unknown/services/unknownResolutionService';
import { crossDomainCirculationService, type DomainCoverage } from '../services/crossDomainCirculationService';
import { domainIntegrationBootstrapService } from '../services/domainIntegrationBootstrapService';
import { taskBlackboardService } from '../services/taskBlackboardService';
import { priorityOneRuntimeReadModelService } from '../services/priorityOneRuntimeReadModelService';
import { autonomousIssueDiscoveryService } from '../services/autonomousIssueDiscoveryService';
import { requiredAssetAcquisitionService } from '../services/requiredAssetAcquisitionService';
import { selfImprovementDirectionService, type ImprovementDirection } from '../services/selfImprovementDirectionService';
import { externalDirectiveIntakeService, type ExternalDirective } from '../services/externalDirectiveIntakeService';

export type { DomainCoverage, ExternalDirective, ImprovementDirection, UnknownResolution };

class TypedGitHubUiGatewayService {
  readonly api = apiService;
  readonly storage = storageService;
  readonly unknown = unknownResolutionService;
  readonly circulation = crossDomainCirculationService;
  readonly bootstrap = domainIntegrationBootstrapService;
  readonly blackboard = taskBlackboardService;
  getImprovementRuntime(){return priorityOneRuntimeReadModelService.list();}
  getImprovementStatus(){const rows=priorityOneRuntimeReadModelService.list();const active=rows.find(item=>item.taskStatus==='RUNNING'||item.taskStatus==='ROUTING'||item.operationStatus==='RUNNING');const blocked=rows.find(item=>item.taskStatus==='PAUSED'||item.operationStatus==='BLOCKED');return {status:active?'RUNNING':blocked?'PAUSED':'IDLE',activeTaskId:active?.taskId,reason:blocked?.stopReasons[0]};}
  readonly issueDiscovery = autonomousIssueDiscoveryService;
  readonly requiredAssets = requiredAssetAcquisitionService;
  readonly improvementDirection = selfImprovementDirectionService;
  readonly externalDirective = externalDirectiveIntakeService;
}

export const typedGitHubUiGatewayService = new TypedGitHubUiGatewayService();

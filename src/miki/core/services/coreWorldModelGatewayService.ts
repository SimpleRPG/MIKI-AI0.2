import { worldModelService } from '../../selfAwareness/services/worldModelService';
import { developmentWorldProjectionService,type DevelopmentWorldObservation } from './developmentWorldProjectionService';
class CoreWorldModelGatewayService{
 observeDevelopment(input:Omit<DevelopmentWorldObservation,'observedAt'> & {observedAt?:number}){return developmentWorldProjectionService.observe(input);}
 projectDevelopment(input:{repositoryRevision:string;candidateSha256:string;workspaceId:string}){return developmentWorldProjectionService.project(input);}
 predictConversation(...args:Parameters<typeof worldModelService.predictAction>){return worldModelService.predictAction(...args);}
}
export const coreWorldModelGatewayService=new CoreWorldModelGatewayService();

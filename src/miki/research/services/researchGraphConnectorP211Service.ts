import { crossDomainGraphConnectionP211Service, type P211GraphEvent } from '../../core/services/crossDomainGraphConnectionP211Service';
export type { P211GraphEventKind, P211ConnectionReceipt } from '../../core/services/crossDomainGraphConnectionP211Service';
class ResearchGraphConnectorP211Service {
 connect(event:Omit<P211GraphEvent,'domain'>){return crossDomainGraphConnectionP211Service.connect({...event,domain:'research'})}
}
export const researchGraphConnectorP211Service=new ResearchGraphConnectorP211Service();

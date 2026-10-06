import { crossDomainGraphConnectionP211Service, type P211GraphEvent } from '../../core/services/crossDomainGraphConnectionP211Service';
export type { P211GraphEventKind, P211ConnectionReceipt } from '../../core/services/crossDomainGraphConnectionP211Service';
class SafetyGraphConnectorP211Service {
 connect(event:Omit<P211GraphEvent,'domain'>){return crossDomainGraphConnectionP211Service.connect({...event,domain:'safety'})}
}
export const safetyGraphConnectorP211Service=new SafetyGraphConnectorP211Service();

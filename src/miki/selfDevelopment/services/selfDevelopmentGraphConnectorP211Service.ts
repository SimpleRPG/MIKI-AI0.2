import { crossDomainGraphConnectionP211Service, type P211GraphEvent } from '../../core/services/crossDomainGraphConnectionP211Service';
export type { P211GraphEventKind, P211ConnectionReceipt } from '../../core/services/crossDomainGraphConnectionP211Service';
class SelfDevelopmentGraphConnectorP211Service {
 connect(event:Omit<P211GraphEvent,'domain'>){return crossDomainGraphConnectionP211Service.connect({...event,domain:'selfDevelopment'})}
}
export const selfDevelopmentGraphConnectorP211Service=new SelfDevelopmentGraphConnectorP211Service();

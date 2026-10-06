import { crossDomainGraphConnectionP211Service, type P211GraphEvent } from '../../core/services/crossDomainGraphConnectionP211Service';
export type { P211GraphEventKind, P211ConnectionReceipt } from '../../core/services/crossDomainGraphConnectionP211Service';
class AutonomyGraphConnectorP211Service {
 connect(event:Omit<P211GraphEvent,'domain'>){return crossDomainGraphConnectionP211Service.connect({...event,domain:'autonomy'})}
}
export const autonomyGraphConnectorP211Service=new AutonomyGraphConnectorP211Service();

import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
export type FailureRoute='LOCAL_REPAIR'|'CONTRACT_PROPAGATION'|'WIRING_REVISION'|'INTEGRATION_REVISION'|'FEATURE_REPLAN'|'CAPABILITY_GAP';
export interface FailureRoutingDecision { decisionId:string; route:FailureRoute; reasons:string[]; }
class DevelopmentFailureRoutingService {
 public classify(reasons:string[]):FailureRoutingDecision{const text=reasons.join('|');let route:FailureRoute='CAPABILITY_GAP';if(/SYNTAX|TS2304|TS2554|TYPECHECK/.test(text))route='LOCAL_REPAIR';else if(/INTERFACE|PAYLOAD|CONTRACT|TS2339/.test(text))route='CONTRACT_PROPAGATION';else if(/IMPORT|WIRING|DEPENDENCY/.test(text))route='WIRING_REVISION';else if(/ANCHOR|INTEGRATION|JSX|CORE_COMMAND/.test(text))route='INTEGRATION_REVISION';else if(/ARTIFACT|PLAN|ARCHITECTURE|MAX_REPAIR/.test(text))route='FEATURE_REPLAN';return {decisionId:`FAILROUTE-${canonicalSha256({reasons:[...reasons].sort(),route}).slice(0,24)}`,route,reasons:[...reasons]};}
}
export const developmentFailureRoutingService=new DevelopmentFailureRoutingService();

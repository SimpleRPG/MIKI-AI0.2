import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { WiredFeatureArtifact } from './featureArtifactWiringService';
export interface FeatureExecutionPathVerification { verificationId:string; passed:boolean; checks:Record<string,boolean>; reasons:string[]; }
class FeatureExecutionPathVerifierService {
 public verify(artifacts:WiredFeatureArtifact[]):FeatureExecutionPathVerification{const text=artifacts.map(item=>item.source).join('\n');const checks={coreToRoute:/route\(\)/.test(text),uiToRoute:/onExecute/.test(text)&&/routeDependencies/.test(text),persistenceRoundTrip:/storageService\.setItem/.test(text)&&/storageService\.getItem/.test(text),serviceToStore:/featureDependencies/.test(text)};const reasons=Object.entries(checks).filter(([,value])=>!value).map(([key])=>`EXECUTION_PATH_MISSING:${key}`);return {verificationId:`PATH-${canonicalSha256({checks,reasons}).slice(0,24)}`,passed:reasons.length===0,checks,reasons};}
}
export const featureExecutionPathVerifierService=new FeatureExecutionPathVerifierService();

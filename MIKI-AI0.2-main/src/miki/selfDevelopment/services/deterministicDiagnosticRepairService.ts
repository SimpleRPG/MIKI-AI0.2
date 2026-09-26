import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { AstCandidateOperation } from './astCandidateTransformationService';

export interface TypeScriptDiagnosticInput { code:number; path:string; message:string; symbolName?:string; moduleSpecifier?:string; importName?:string; functionName?:string; parameterName?:string; parameterType?:string; }
export interface DiagnosticRepairPlan { planId:string; accepted:boolean; path:string; operations:AstCandidateOperation[]; reasons:string[]; }

class DeterministicDiagnosticRepairService {
  public plan(input:TypeScriptDiagnosticInput):DiagnosticRepairPlan {
    const operations:AstCandidateOperation[]=[];const reasons:string[]=[];
    if(input.code===2304&&input.moduleSpecifier&&input.importName){operations.push({kind:'ADD_IMPORT',moduleSpecifier:input.moduleSpecifier,namedImports:[input.importName]});}
    else if(input.code===2554&&input.functionName&&input.parameterName&&input.parameterType){operations.push({kind:'ADD_PARAMETER',functionName:input.functionName,parameterName:input.parameterName,parameterType:input.parameterType});}
    else if(input.code===2339&&input.symbolName){reasons.push(`PROPERTY_REPAIR_REQUIRES_CONTRACT_CONTEXT:${input.symbolName}`);}
    else {reasons.push(`UNSUPPORTED_TYPESCRIPT_DIAGNOSTIC:${input.code}`);}
    const seed={input,operations,reasons};
    return {planId:`DIAGREPAIR-${canonicalSha256(seed).slice(0,24)}`,accepted:operations.length>0&&reasons.length===0,path:input.path,operations,reasons};
  }
}
export const deterministicDiagnosticRepairService=new DeterministicDiagnosticRepairService();

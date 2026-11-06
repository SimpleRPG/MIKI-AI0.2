import { callSelfCodeApi,isApiFailure } from './selfCodeApiClient';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { SynthesizedComponent } from './atomicComponentTemplateSynthesisService';
export interface WorkerSandboxEvidence {evidenceId:string;componentId:string;passed:boolean;implementationHash:string;checks:Record<string,boolean>;runs:Array<{caseId:string;outputHash?:string;error?:string;durationMs:number}>;outputs?:unknown[];reasons:string[];createdAt:number;}
/**
 * P441(A): ワーカーサンドボックスは「実行のみ」。
 * 旧 executeAndPromote はサーバの success フラグだけで
 * registerComponent による直接 VERIFIED 書き込みを行い、遷移表・
 * 証拠ゲート・Regression・Canary を全迂回していたため廃止する。
 * この execute は実行結果（証拠）のみを返し、Registry への
 * 書き込みは一切行わない。サンドボックス成功は DEVICE_TESTED
 * でも VERIFIED でもない。正式昇格は promoteIfSafeForCanary
 * 経由のみ。
 * exportName は実装テキストから決定論的に抽出する（componentId や
 * 契約からの推測はしない）。サーバ :4027 ハンドラは exportName 必須。
 */
class GeneratedComponentWorkerSandboxService {
  async execute(component:SynthesizedComponent):Promise<WorkerSandboxEvidence>{
    const createdAt=Date.now();
    const implementationHash=canonicalSha256(component.implementation);
    const failed=(reasons:string[],checks:Record<string,boolean>={}):WorkerSandboxEvidence=>({evidenceId:`CEXEC-${canonicalSha256({component:component.componentId,createdAt}).slice(0,24)}`,componentId:component.componentId,passed:false,implementationHash,checks,runs:[],reasons,createdAt});
    const exportName=this.extractExportName(component.implementation);
    if(!exportName)return failed(['EXPORT_FUNCTION_NOT_FOUND']);
    const response=await callSelfCodeApi<{success:boolean;checks:Record<string,boolean>;runs:Array<{caseId:string;outputHash?:string;error?:string;durationMs:number}>;outputs?:unknown[];reasons:string[]}>('/api/self-code/component-worker-sandbox',{method:'POST',body:{componentId:component.componentId,implementation:component.implementation,implementationHash,exportName,inputs:[{caseId:'NORMAL',source:'alpha',request:{}},{caseId:'EMPTY',source:'',request:{}},{caseId:'BOUNDARY',source:'x'.repeat(4096),request:{}}],timeoutMs:1500,memoryMb:64}});
    if(isApiFailure(response))return failed([response.reason],{api:false});
    return {evidenceId:`CEXEC-${canonicalSha256({component:component.componentId,response,createdAt}).slice(0,24)}`,componentId:component.componentId,passed:response.success,implementationHash,checks:response.checks,runs:response.runs,outputs:response.outputs,reasons:response.reasons,createdAt};
  }
  private extractExportName(implementation:string):string|undefined{
    const match=implementation.match(/export function\s+([A-Za-z_$][\w$]*)\s*\(/);
    return match?match[1]:undefined;
  }
}
export const generatedComponentWorkerSandboxService=new GeneratedComponentWorkerSandboxService();

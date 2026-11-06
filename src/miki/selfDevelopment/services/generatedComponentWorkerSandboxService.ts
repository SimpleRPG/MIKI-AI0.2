import { callSelfCodeApi,isApiFailure } from './selfCodeApiClient';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { SynthesizedComponent } from './atomicComponentTemplateSynthesisService';
import { buildSandboxFixture } from './generatedComponentTemplateSpecService';
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
 * P443(G3): 入力は契約のテンプレート一覧から決定論的に組み立てる。
 * 生成関数は input.request.operations[<templateId>] からパラメータを
 * 読む汎用実装のため、標準パラメータ（フィクスチャ）を同じ仕様
 * テーブルから作って渡す。NORMAL/EMPTY/BOUNDARY に加え、INVALID
 * （要求なし→安全な失敗）と PERMISSION（allowed: false→拒否）も
 * 実行する。P445: REGRESSION（NORMAL 入力の再実行）も実行する。
 * 入力は最大6件（サーバの上限8件以内）。REGRESSION は NORMAL と
 * 同じ source/request を持つ別入力としてサーバに送る。サーバは各
 * 入力を2回実行して決定性を照合するため、REGRESSION は独自の実行
 * 観測になる。NORMAL の出力を流用するのでも、決定性照合の2回目の
 * 実行を流用するのでもない。
 */
class GeneratedComponentWorkerSandboxService {
  async execute(component:SynthesizedComponent):Promise<WorkerSandboxEvidence>{
    const createdAt=Date.now();
    const implementationHash=canonicalSha256(component.implementation);
    const failed=(reasons:string[],checks:Record<string,boolean>={}):WorkerSandboxEvidence=>({evidenceId:`CEXEC-${canonicalSha256({component:component.componentId,createdAt}).slice(0,24)}`,componentId:component.componentId,passed:false,implementationHash,checks,runs:[],reasons,createdAt});
    const exportName=this.extractExportName(component.implementation);
    if(!exportName)return failed(['EXPORT_FUNCTION_NOT_FOUND']);
    const fixture=buildSandboxFixture(component.contract.templateIds);
    const response=await callSelfCodeApi<{success:boolean;checks:Record<string,boolean>;runs:Array<{caseId:string;outputHash?:string;error?:string;durationMs:number}>;outputs?:unknown[];reasons:string[]}>('/api/self-code/component-worker-sandbox',{method:'POST',body:{componentId:component.componentId,implementation:component.implementation,implementationHash,exportName,inputs:[{caseId:'NORMAL',source:fixture.normalSource,request:fixture.normalRequest},{caseId:'EMPTY',source:'',request:fixture.normalRequest},{caseId:'BOUNDARY',source:fixture.boundarySource,request:fixture.normalRequest},{caseId:'INVALID',source:fixture.normalSource,request:{}},{caseId:'PERMISSION',source:fixture.normalSource,request:fixture.permissionRequest},{caseId:'REGRESSION',source:fixture.normalSource,request:fixture.normalRequest}],timeoutMs:1500,memoryMb:64}});
    if(isApiFailure(response))return failed([response.reason],{api:false});
    return {evidenceId:`CEXEC-${canonicalSha256({component:component.componentId,response,createdAt}).slice(0,24)}`,componentId:component.componentId,passed:response.success,implementationHash,checks:response.checks,runs:response.runs,outputs:response.outputs,reasons:response.reasons,createdAt};
  }
  private extractExportName(implementation:string):string|undefined{
    const match=implementation.match(/export function\s+([A-Za-z_$][\w$]*)\s*\(/);
    return match?match[1]:undefined;
  }
}
export const generatedComponentWorkerSandboxService=new GeneratedComponentWorkerSandboxService();

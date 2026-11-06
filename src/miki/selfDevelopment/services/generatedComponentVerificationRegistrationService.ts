import ts from 'typescript';import { canonicalSha256 } from '../../core/services/canonicalSha256Service';import { componentRegistryService } from '../../capability/services/componentRegistryService';import type { SynthesizedComponent } from './atomicComponentTemplateSynthesisService';
/** サンドボックス実行証拠（サーバの実行結果そのもの）。自己申告ではない。 */
export interface GeneratedComponentExecutionEvidence{passed:boolean;evidenceId:string;}
class GeneratedComponentVerificationRegistrationService{
  /**
   * 生成部品の静的検証と登録。実行証拠はサンドボックスのサーバ実行
   * 結果をそのまま反映する（証拠がない場合は false のまま）。
   * P441(C): 状態の上限は ANALYZED。実行証拠があってもここで
   * VERIFIED にはしない。正式昇格は promoteIfSafeForCanary 経由のみ。
   * deterministic も正規表現で計算した値をそのまま使う（旧コードの
   * 無条件 true 書き込みは、非決定的な実装でも決定性100%に見せる
   * 薄い所だったため直す）。
   * P442(G2): 実行環境は EXTERNAL_RUNNER。生成部品は P441 の直結
   * パスでサンドボックス（サーバ側の外部Runner相当）で実行される。
   * 'universal' は Runner の部分文字列一致でどの環境名にも一致せず、
   * Suite 要求が全部 UNSUPPORTED になっていた。ワイルドカード扱い
   * にはしない（環境の申告を曖昧にしないため）。
   */
  verifyAndRegister(component:SynthesizedComponent,execution?:GeneratedComponentExecutionEvidence){const parsed=ts.createSourceFile(`${component.componentId}.ts`,component.implementation,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);const diagnostics=((parsed as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics||[]);const deterministic=!/Date\.now|Math\.random|fetch\(|XMLHttpRequest|eval\(/.test(component.implementation);const contractComplete=component.contract.inputs.length>0&&component.contract.outputs.length>0&&component.contract.preconditions.length>0&&component.contract.postconditions.length>0;const staticPassed=diagnostics.length===0&&deterministic&&contractComplete;const executionEvidence=execution?.passed===true;const passed=staticPassed&&executionEvidence;const validation=`PARSE=${diagnostics.length===0}\nDETERMINISTIC=${deterministic}\nCONTRACT_COMPLETE=${contractComplete}\nSTATIC_TESTS_PASSED=${staticPassed}\nEXECUTION_EVIDENCE=${executionEvidence}${execution?`\nSANDBOX_EVIDENCE=${execution.evidenceId}`:''}\nALL_TESTS_PASSED=${passed}`;const now=Date.now();const pkg:any={component_id:component.componentId,version:'1.0.0',status:staticPassed?'ANALYZED':'CANDIDATE',purpose:component.contract.purpose,inputs:component.contract.inputs.map(name=>({name,type:'unknown',description:name})),outputs:component.contract.outputs.map(name=>({name,type:'unknown',description:name})),preconditions:component.contract.preconditions,postconditions:component.contract.postconditions,side_effects:[],dependencies:[],supported_environments:['EXTERNAL_RUNNER'],entry_point:component.componentId,failure_behavior:'契約または構造検証失敗時は適用しない',security_class:component.contract.securityClass,idempotent:true,deterministic,component_txt:JSON.stringify(component.contract,null,2),implementation_txt:component.implementation,tests_txt:component.tests,validation_txt:validation,sources_txt:'deterministic template synthesis + repository evidence',history_txt:`${new Date(now).toISOString()}: generated and ${staticPassed?'analyzed':'candidate'}`,implementation_hash:canonicalSha256(component.implementation),validation_hash:canonicalSha256(validation),success_count:0,failure_count:0,created_at:now,updated_at:now};componentRegistryService.registerComponent(pkg);return {passed,component:pkg,diagnostics:diagnostics.map(value=>ts.flattenDiagnosticMessageText(value.messageText,' '))};}}
export const generatedComponentVerificationRegistrationService=new GeneratedComponentVerificationRegistrationService();

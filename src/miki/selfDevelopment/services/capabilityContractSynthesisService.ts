import { canonicalSha256 } from '../../core/services/canonicalSha256Service';import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { dynamicTemplateRegistryService } from './dynamicTemplateRegistryService';
export interface CapabilityContract{contractId:string;capabilityId:string;purpose:string;inputs:string[];outputs:string[];preconditions:string[];postconditions:string[];securityClass:'READ_ONLY'|'LOCAL_WRITE';deterministic:true;templateIds:string[];}
class CapabilityContractSynthesisService{synthesize(operation:string,evidencePaths:string[]):CapabilityContract|undefined{if(componentRegistryService.searchComponents(operation,{verifiedOnly:true}).length)return undefined;const templateIds=this.templates(operation);return {contractId:`CCON-${canonicalSha256({operation,evidencePaths,templateIds}).slice(0,24)}`,capabilityId:`generated.${operation.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`,purpose:`Repository証拠に基づき${operation}を決定論的に実行する`,inputs:['SOURCE_DOCUMENT','STRUCTURED_CHANGE_REQUEST'],outputs:['CANDIDATE_DOCUMENT','VALIDATION_REPORT'],preconditions:['BASELINE_SHA_MATCH','SUPPORTED_ARTIFACT','UNIQUE_STRUCTURAL_ANCHOR'],postconditions:['PARSE_VALID','REQUEST_SATISFIED','NO_UNRELATED_CHANGE'],securityClass:'LOCAL_WRITE',deterministic:true,templateIds};}private templates(operation:string):string[]{
// P444: テンプレートの選択は動的レジストリが持つ。旧・正規表現分岐は
// レジストリの builtin 選択規則へ移行した（JSON/CSV の規則を含む）。
// 選べるのは VERIFIED のテンプレートだけ。どの規則にも当たらなければ
// 既定を返し、その操作をテンプレート不足として記録する。
return dynamicTemplateRegistryService.selectTemplates(operation);}}
export const capabilityContractSynthesisService=new CapabilityContractSynthesisService();

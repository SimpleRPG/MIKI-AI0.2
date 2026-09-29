import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { selfCodeSpaceService } from '../../core/services/selfCodeSpaceService';
import { naturalLanguageDevelopmentIntentService } from './naturalLanguageDevelopmentIntentService';
import { autonomousDevelopmentReadinessService } from './autonomousDevelopmentReadinessService';
import { generationCapabilityExpansionService } from './generationCapabilityExpansionService';

export interface NaturalLanguageReviewPackagePlan {
  planId:string;
  normalizedGoal:string;
  targetFiles:string[];
  requirements:string[];
  prohibitions:string[];
  invariants:string[];
  validationRequirements:string[];
  deliveryRequirements:string[];
  assumptions:string[];
  researchQuestions:string[];
  implementationStrategy:string[];
  completionPipeline:string[];
  readiness:{ready:boolean;score:number;missing:string[];blockers:string[]};
}

const behaviorRules:[RegExp,string][]=[
  [/追加|作成|新規|implement|create/i,'BEHAVIOR:CREATE_OR_EXTEND_FEATURE'],
  [/修正|直し|不具合|bug|fix/i,'BEHAVIOR:REPRODUCE_FIX_REGRESSION'],
  [/画面|UI|ボタン|表示|フォーム/i,'BEHAVIOR:UI_STATE_EVENT_ACCESSIBILITY'],
  [/保存|読込|永続|database|sqlite|room/i,'BEHAVIOR:PERSISTENCE_SCHEMA_MIGRATION_RECOVERY'],
  [/API|endpoint|request|response/i,'BEHAVIOR:API_CONTRACT_VALIDATION_ERROR_MAPPING'],
  [/高速|性能|最適|cache|memory/i,'BEHAVIOR:PERFORMANCE_BASELINE_BUDGET_REGRESSION'],
  [/安全|権限|認証|secret|security/i,'BEHAVIOR:SECURITY_DEFAULT_DENY_SECRET_BOUNDARY'],
  [/android|kotlin|workmanager|端末/i,'BEHAVIOR:ANDROID_LIFECYCLE_PERMISSION_BACKGROUND'],
  [/会話|自然言語|意味理解/i,'BEHAVIOR:LANGUAGE_NORMALIZATION_CONTEXT_AMBIGUITY'],
  [/zip|評価用|review/i,'BEHAVIOR:REVIEW_PACKAGE_LINEAGE_INTEGRITY'],
];

class NaturalLanguageToReviewPackageService {
  compile(goal:string,providedTargets:string[]=[]):NaturalLanguageReviewPackagePlan{
    const normalizedGoal=goal.normalize('NFKC').replace(/\s+/g,' ').trim();
    const understanding=naturalLanguageDevelopmentIntentService.understand(normalizedGoal,providedTargets);
    const targetFiles=this.resolveTargets(providedTargets,understanding.repositoryEvidence,understanding.primary.entities);
    const readiness=autonomousDevelopmentReadinessService.assess({...understanding,repositoryEvidence:targetFiles});
    const behaviors=[...new Set(behaviorRules.filter(([pattern])=>pattern.test(normalizedGoal)).map(([,item])=>item))];
    if(behaviors.length===0)behaviors.push('BEHAVIOR:GENERIC_FEATURE_WITH_OBSERVABLE_ACCEPTANCE');
    const assumptions=[...understanding.ambiguities.map(item=>`ASSUMPTION_REQUIRES_VALIDATION:${item}`)];
    if(targetFiles.length===0)assumptions.push('ASSUMPTION:TARGET_DISCOVERY_REQUIRED');
    const requirements=[
      ...behaviors,
      'REQUIREMENT:PRESERVE_EXISTING_PUBLIC_CONTRACTS_UNLESS_EXPLICITLY_CHANGED',
      'REQUIREMENT:GENERATE_ACTUAL_CHANGED_CANDIDATE_FILES',
      'REQUIREMENT:TRACE_REQUIREMENT_TO_FILE_OPERATION_AND_EVIDENCE',
      'REQUIREMENT:REPAIR_FAILED_VALIDATION_WITH_BOUNDED_RETRY',
      ...assumptions,
    ];
    const expansion=generationCapabilityExpansionService.plan({objective:normalizedGoal,targetPaths:targetFiles,requirements,constructionGaps:readiness.missing});
    const validationRequirements=[
      'VALIDATE:NON_EMPTY_DIFF',
      'VALIDATE:SYNTAX_OR_PARSE',
      'VALIDATE:TYPECHECK_OR_LANGUAGE_EQUIVALENT',
      'VALIDATE:NORMAL_BOUNDARY_EMPTY_DUPLICATE_LARGE_CASES',
      'VALIDATE:REGRESSION_AND_INVARIANTS',
      'VALIDATE:PERSISTENCE_RECEIPT',
      'VALIDATE:SHADOW_EVALUATION',
      ...expansion.validationRequirements,
      ...expansion.validationProfiles,
    ];
    const deliveryRequirements=[
      'DELIVER:REVIEW_ZIP',
      'DELIVER:ZIP_TXT_IDENTICAL_BYTES',
      'DELIVER:SHA256',
      'DELIVER:CANDIDATE_INPUT_MANIFEST',
      'DELIVER:VALIDATION_EVIDENCE',
      'DELIVER:SOURCE_AND_DECISION_LINEAGE',
    ];
    const implementationStrategy=[
      ...expansion.decompositionSteps,
      ...expansion.algorithmPatterns,
      ...expansion.implementationContracts,
      ...expansion.safeFallbacks,
    ];
    const researchQuestions=[...expansion.apiResearchQuestions,...readiness.missing.map(item=>`RESEARCH_OR_COMPONENT_ACQUISITION:${item}`)];
    const completionPipeline=['UNDERSTAND','DISCOVER_TARGETS','ACQUIRE_KNOWLEDGE','PLAN','GENERATE_CANDIDATE','VALIDATE','REPAIR_IF_NEEDED','SHADOW_EVALUATE','CREATE_REVIEW_PACKAGE','VERIFY_ZIP','RETURN_ZIP_ZIPTXT_SHA256'];
    const base={normalizedGoal,targetFiles,requirements,prohibitions:['PROHIBIT:RUNTIME_SELF_MODIFICATION','PROHIBIT:UNVERIFIED_API_SYMBOLS','PROHIBIT:UNSCOPED_BINARY_MUTATION'],invariants:['INVARIANT:ALL_INGRESS_THROUGH_CORE','INVARIANT:BASELINE_IMMUTABLE','INVARIANT:CANDIDATE_ISOLATED_UNTIL_ACCEPTED'],validationRequirements,deliveryRequirements,assumptions,researchQuestions,implementationStrategy,completionPipeline,readiness};
    return {planId:`NLRP-${canonicalSha256(base).slice(0,20)}`,...base};
  }

  private resolveTargets(provided:string[],repositoryEvidence:string[],entities:string[]):string[]{
    const files=selfCodeSpaceService.listSourceFiles();
    const exact=[...provided,...repositoryEvidence].filter(path=>files.some(file=>file.path===path));
    if(exact.length>0)return [...new Set(exact)].slice(0,24);
    const tokens=entities.map(item=>item.toLowerCase()).filter(item=>item.length>=3);
    const scored=files.map(file=>({path:file.path,score:tokens.reduce((sum,token)=>sum+(file.path.toLowerCase().includes(token)?3:0)+(file.content.toLowerCase().includes(token)?1:0),0)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
    return scored.slice(0,12).map(item=>item.path);
  }
}
export const naturalLanguageToReviewPackageService=new NaturalLanguageToReviewPackageService();

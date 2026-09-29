import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { repositoryArtifactAdapterService, type ArtifactAdapterDecision } from './repositoryArtifactAdapterService';

export type GenerationGapKind='ADAPTER'|'COMPONENT'|'AST'|'EVIDENCE'|'ALGORITHM'|'EXTERNAL_API';
export interface GenerationCapabilityPlan {
  planId:string;
  adapterDecisions:ArtifactAdapterDecision[];
  supportedTargets:string[];
  blockedTargets:string[];
  componentRequirements:string[];
  algorithmPatterns:string[];
  apiResearchQuestions:string[];
  validationRequirements:string[];
  safeFallbacks:string[];
  implementationContracts:string[];
  validationProfiles:string[];
  decompositionSteps:string[];
}

const algorithmCatalog:[RegExp,string][]=[
  [/sort|並べ替え|順位/i,'ALGORITHM_PATTERN:STABLE_SORT_COMPARATOR'],
  [/search|検索|探索/i,'ALGORITHM_PATTERN:INDEXED_LOOKUP_AND_BOUNDED_SCAN'],
  [/graph|グラフ|依存/i,'ALGORITHM_PATTERN:DIRECTED_GRAPH_TRAVERSAL_CYCLE_GUARD'],
  [/retry|再試行|リトライ/i,'ALGORITHM_PATTERN:BOUNDED_RETRY_EXPONENTIAL_BACKOFF'],
  [/cache|キャッシュ/i,'ALGORITHM_PATTERN:KEYED_CACHE_TTL_INVALIDATION'],
  [/queue|キュー|順番待ち/i,'ALGORITHM_PATTERN:IDEMPOTENT_WORK_QUEUE'],
  [/merge|マージ|統合/i,'ALGORITHM_PATTERN:THREE_WAY_MERGE_CONFLICT_REPORT'],
  [/diff|差分/i,'ALGORITHM_PATTERN:STRUCTURAL_DIFF_CANONICAL_HASH'],
  [/parse|parser|解析/i,'ALGORITHM_PATTERN:SECTION_AWARE_STATE_MACHINE_PARSER'],
  [/schedule|スケジュール|日付/i,'ALGORITHM_PATTERN:CALENDAR_RULE_ENGINE'],
  [/dedup|重複|一意/i,'ALGORITHM_PATTERN:CANONICAL_KEY_DEDUPLICATION'],
  [/transaction|rollback|トランザクション|ロールバック/i,'ALGORITHM_PATTERN:TRANSACTION_SNAPSHOT_COMMIT_ROLLBACK'],
  [/concurr|parallel|並列|同時実行|競合/i,'ALGORITHM_PATTERN:BOUNDED_CONCURRENCY_AND_RACE_GUARD'],
  [/state machine|状態遷移|ステートマシン/i,'ALGORITHM_PATTERN:EXPLICIT_STATE_MACHINE_TRANSITION_GUARD'],
  [/stream|チャンク|大量データ/i,'ALGORITHM_PATTERN:STREAMING_CHUNK_PROCESSING_BACKPRESSURE'],
  [/pagination|ページング|ページネーション/i,'ALGORITHM_PATTERN:CURSOR_PAGINATION_STABLE_ORDER'],
  [/rate limit|レート制限|流量制御/i,'ALGORITHM_PATTERN:TOKEN_BUCKET_RATE_CONTROL'],
  [/timeout|タイムアウト|期限/i,'ALGORITHM_PATTERN:DEADLINE_PROPAGATION_AND_CANCELLATION'],
  [/permission|権限|認可|authorization/i,'ALGORITHM_PATTERN:CAPABILITY_PERMISSION_GATE_DEFAULT_DENY'],
  [/encrypt|暗号|署名|signature/i,'ALGORITHM_PATTERN:VERSIONED_CRYPTO_ENVELOPE_AND_KEY_BOUNDARY'],
  [/migration|移行|schema|スキーマ/i,'ALGORITHM_PATTERN:VERSIONED_SCHEMA_MIGRATION_ROLLBACK'],
  [/event|イベント|pubsub|publish|subscribe/i,'ALGORITHM_PATTERN:IDEMPOTENT_EVENT_DELIVERY_AND_DEDUP'],
  [/workflow|ワークフロー|工程/i,'ALGORITHM_PATTERN:CHECKPOINTED_WORKFLOW_RESUME'],
  [/ranking|スコア|評価順/i,'ALGORITHM_PATTERN:EXPLAINABLE_WEIGHTED_RANKING'],
];

class GenerationCapabilityExpansionService {
  plan(input:{objective:string;targetPaths:string[];requirements:string[];constructionGaps:string[]}):GenerationCapabilityPlan{
    const text=[input.objective,...input.requirements,...input.constructionGaps].join('\n');
    const adapterDecisions=repositoryArtifactAdapterService.classifyAll(input.targetPaths);
    const algorithmPatterns=[...new Set(algorithmCatalog.filter(([pattern])=>pattern.test(text)).map(([,id])=>id))];
    const externalTerms=[...text.matchAll(/\b(?:android|kotlin|java|gradle|capacitor|webview|sqlite|room|workmanager|github|azure|microsoft|excel|vba|office|api|sdk|library|framework)\b/gi)].map(match=>match[0].toLowerCase());
    const apiResearchQuestions=[...new Set(externalTerms.map(term=>`AUTHORITATIVE_SPEC_REQUIRED:${term}:version|api-contract|permissions|error-semantics|offline-behavior`))];
    const componentRequirements=[...new Set([
      ...input.constructionGaps.map(gap=>`COMPONENT_ACQUISITION_REQUIRED:${gap}`),
      ...algorithmPatterns.map(id=>`COMPONENT_SYNTHESIS_REQUIRED:${id}`),
      ...adapterDecisions.filter(item=>!item.editable).map(item=>`ADAPTER_ACQUISITION_REQUIRED:${item.path}:${item.adapter}`),
    ])];
    const validationRequirements=[
      'GENERATED_CODE_MUST_CHANGE_AT_LEAST_ONE_TARGET',
      'GENERATED_CODE_MUST_PRESERVE_DECLARED_INVARIANTS',
      'GENERATED_CODE_MUST_PASS_TYPECHECK_OR_LANGUAGE_EQUIVALENT',
      'NEW_ALGORITHM_REQUIRES_NORMAL_BOUNDARY_EMPTY_DUPLICATE_LARGE_TESTS',
      'EXTERNAL_API_CODE_REQUIRES_VERSIONED_SPEC_EVIDENCE',
      'UNVERIFIED_API_SYMBOLS_MUST_NOT_BE_EMITTED',
    ];
    const implementationContracts=[...new Set([
      ...algorithmPatterns.map(id=>`IMPLEMENTATION_CONTRACT:${id}:inputs|outputs|invariants|failure-modes|complexity|side-effects`),
      ...adapterDecisions.map(item=>`ADAPTER_CONTRACT:${item.path}:${item.adapter}:preimage-hash|parse|mutate|reparse|postimage-hash`),
      ...apiResearchQuestions.map(question=>`API_CONTRACT:${question}`),
    ])];
    const validationProfiles=[...new Set(adapterDecisions.map(item=>{
      if(item.kind==='PYTHON')return 'VALIDATION_PROFILE:PYTHON:parse|compile|unit|property|lint';
      if(item.kind==='JVM_SOURCE')return 'VALIDATION_PROFILE:JVM:parse|compile|unit|gradle-contract';
      if(item.kind==='SQL')return 'VALIDATION_PROFILE:SQL:dialect-parse|parameterization|transaction|query-plan';
      if(item.kind==='MARKUP')return 'VALIDATION_PROFILE:MARKUP:parse|schema|accessibility|snapshot';
      if(item.kind==='STYLESHEET')return 'VALIDATION_PROFILE:STYLE:parse|selector-scope|visual-contract';
      if(item.kind==='CONFIG'||item.kind==='BUILD_SCRIPT')return 'VALIDATION_PROFILE:CONFIG:parse|key-preservation|secret-scan|build-dry-run';
      if(item.kind==='SCRIPT')return 'VALIDATION_PROFILE:SCRIPT:parse|shellcheck-equivalent|forbidden-command|dry-run';
      if(item.kind==='TEXT')return 'VALIDATION_PROFILE:TEXT:anchor-unique|preimage-hash|encoding|newline-preservation';
      if(item.kind==='TYPESCRIPT'||item.kind==='JAVASCRIPT')return 'VALIDATION_PROFILE:JS_TS:ast-parse|typecheck|lint|unit|regression';
      return `VALIDATION_PROFILE:${item.kind}:parse|roundtrip|hash`;
    }))];
    const decompositionSteps=[
      'DECOMPOSE:INTENT_TO_OBSERVABLE_BEHAVIOR',
      'DECOMPOSE:BEHAVIOR_TO_CONTRACTS',
      'DECOMPOSE:CONTRACTS_TO_COMPONENTS',
      'DECOMPOSE:COMPONENTS_TO_FILE_OPERATIONS',
      'DECOMPOSE:FILE_OPERATIONS_TO_VALIDATION_EVIDENCE',
      'DECOMPOSE:VALIDATION_TO_REVIEW_ARTIFACT',
    ];
    const safeFallbacks=[
      'AST_UNAVAILABLE_USE_ANCHORED_TEXT_EDIT_WITH_PREIMAGE_HASH',
      'COMPONENT_UNAVAILABLE_CREATE_ISOLATED_CANDIDATE_COMPONENT_NOT_PRODUCTION_COMPONENT',
      'API_UNKNOWN_GENERATE_INTERFACE_AND_TEST_DOUBLE_ONLY',
      'ALGORITHM_UNKNOWN_GENERATE_CONTRACT_TESTS_BEFORE_IMPLEMENTATION',
      'BINARY_TARGET_GENERATE_SIDECAR_MANIFEST_AND_TOOL_INSTRUCTION_ONLY',
    ];
    const base={adapterDecisions,supportedTargets:adapterDecisions.filter(item=>item.editable).map(item=>item.path),blockedTargets:adapterDecisions.filter(item=>!item.editable).map(item=>item.path),componentRequirements,algorithmPatterns,apiResearchQuestions,validationRequirements,safeFallbacks,implementationContracts,validationProfiles,decompositionSteps};
    return {planId:`GCAP-${canonicalSha256(base).slice(0,20)}`,...base};
  }
}
export const generationCapabilityExpansionService=new GenerationCapabilityExpansionService();

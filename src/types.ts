export type EngineMode = 'native_gpu' | 'webgpu' | 'external_gpu' | 'autonomous_rule' | 'gemini_cloud';

export interface PersonaConfig {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  basePersonality: string;
  speakingStyle: string;
  userNickname: string;
  intimacyLevel: number;
  intimacyExp: number;
  autoExtractMemories: boolean;
}

/**
 * 記憶の7階層 (設計思想 4. RAG・外部記憶とプロンプト上限)
 */
export type MemoryType =
  | 'raw'          // 1. 原文記憶: 会話、ファイル、ログなどを加工せず保存
  | 'structural'   // 2. 構造記憶: シンボル、関数、依存、ハッシュ等
  | 'semantic'     // 3. 意味記憶: 確定した事実、仕様、判断、関係
  | 'episodic'     // 4. エピソード記憶: 過去の案件、成功経路、失敗経路
  | 'procedural'   // 5. 手続き記憶: どう調べるか、どうツールを使うか
  | 'meta'         // 6. メタ記憶: どの記憶をどう組み合わせて使うか
  | 'working';     // 7. 作業記憶: 現在の会話や案件だけで使う一時状態

/**
 * 経験の保存先9分類 (49章：経験の保存先ルーター)
 * memoryType（7階層の性質）とは別軸として、経験を「どこへ振り分けるか」を決定する
 */
export type MemoryDestination =
  | 'working_memory'      // 1. 作業記憶: 会話・セッション限定の一時状態
  | 'long_term_memory'    // 2. 長期記憶: 確定した事実・普遍的なユーザー好み・継続ルール
  | 'project_memory'      // 3. プロジェクト記憶: 特定案件・リポジトリ・VBA仕様限定の記憶
  | 'skill'               // 4. スキル: 手順化・再利用可能な実行可能手順 (skillsService)
  | 'search_policy'       // 5. 検索ポリシー: どの情報をどう検索・取得すべきかの方針
  | 'retrieval_policy'    // 5. (検索ポリシー別名)
  | 'evaluation_set'      // 6. 評価セット: 能力検証・回帰ベンチマークテストケース候補
  | 'lora_dataset'        // 7. LoRA教材: モデル追加学習用の高品質instruction/outputペア
  | 'quarantine'          // 8. 隔離: 出典・正解・利用条件が不明な情報 (プロンプト注入完全除外)
  | 'discard_candidate';  // 9. 破棄候補: 重複・誤り・低価値・badCount超過 (一括確認対象)

/**
 * 49章の判断要素 (経験の保存先ルーター用)
 */
export interface ExperienceRoutingFactors {
  updateFrequency?: 'high' | 'medium' | 'low';    // 更新頻度 (頻繁 / 中程度 / 恒久)
  scope?: 'session' | 'project' | 'global';        // 適用範囲 (今回限定 / 特定案件限定 / 汎用)
  reusability?: 'high' | 'medium' | 'low';        // 再利用可能性
  machineVerifiable?: boolean;                    // 機械検証可能性 (テストや単体実行可能か)
  sourceReliability?: 'high' | 'medium' | 'low' | 'unknown'; // 出典の信頼性
  approvalStatus?: 'approved' | 'pending' | 'unconfirmed' | 'rejected'; // 承認状態
  hasPII?: boolean;                               // 個人情報・秘匿情報の有無
  isDuplicate?: boolean;                          // 既存情報との重複
  impactRisk?: 'low' | 'medium' | 'high' | 'critical'; // 誤適用時の影響度
  projectScopeId?: string;                        // 案件・プロジェクト識別子
  notes?: string;
}

export interface ExperienceRoutingResult {
  destination: MemoryDestination;
  reason: string;
  factors: ExperienceRoutingFactors;
  riskScore: number; // 0 (安全) 〜 100 (極めて高リスク)
  suggestedAction?: 'promote' | 'keep_quarantine' | 'discard' | 'export_skill' | 'export_benchmark';
}

export interface MemoryItem {
  id: string;
  category: 'chat' | 'relationship' | 'gamedev' | 'preference' | 'profile' | 'memory' | 'vba' | 'code';
  content: string;
  importance?: number;
  pinned?: boolean;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
  source?: 'auto' | 'manual' | 'txt_import' | 'conversation' | 'code_review' | 'file';
  tags?: string[];
  lastUsedAt?: number;
  useCount?: number;
  goodCount?: number; // ユーザーが「役に立った」と評価した回数
  badCount?: number;  // ユーザーが「見当違い/不要」と評価した回数
  approved?: boolean; // 人または機械検証で確定された承認状態
  sourceRef?: string; // 根拠となる原文参照・メッセージID・ファイル名
  rawExcerpt?: string; // 原文抜粋
  memoryType?: MemoryType; // 記憶の7階層分類
  expiresAt?: number;  // 有効期限 (作業記憶など一時的なもの)
  conflictWith?: string[]; // 競合・上書き関係にある記憶ID
  status?: 'active' | 'sleeping' | 'deprecated' | 'archived'; // 状態
  // 49章: 経験の保存先ルーター用フィールド
  destination?: MemoryDestination; // 保存先9分類
  projectScopeId?: string;         // プロジェクト記憶用: 案件ID・リポジトリ名・対象ファイル
  quarantineReason?: string;       // 隔離理由 (出典不明、利用条件未確定、リスク過多など)
  discardReason?: string;          // 破棄候補理由 (重複、低評価、誤り判定など)
  routingFactors?: ExperienceRoutingFactors; // ルーティング時の評価要素
  routedAt?: number;               // 保存先決定日時
  // 知識グラフ & 依存関係 (設計思想 12. 知識グラフと関係性)
  parentMemoryId?: string;       // 親ノード (上位概念・大元の設定)
  relatedMemoryIds?: string[];   // 関連記憶ノードID (横のリンク)
  prerequisiteMemoryIds?: string[]; // 前提条件となる記憶ID (依存先)
  domainVector?: number[];       // 多次元トピック重み疎ベクトル
  semanticKeywords?: string[];   // 抽出された意味的キーワード
  // 設計思想 8章 & 35章 第4段階: 記憶管理・長期記憶・置換関係
  memoryScope?: MemoryScope;
  longTermType?: LongTermMemoryType;
  lifecycleStatus?: MemoryLifecycleStatus;
  replacedBy?: string;           // 置換先記憶ID (例: MEM-0047)
  replacementReason?: string;    // 置換理由 (例: 固定回数ではなく無料予算で動的運用するため)
  supersededAt?: number;         // 置換された日時
  supersededFrom?: string;       // 置換元となった古い記憶ID
  rawSourceId?: string;          // 紐づく原文メッセージID
  rawSourceType?: 'chat' | 'teacher_response' | 'synthesis_process' | 'eval_result';
}

/**
 * 設計思想 8章 & 35章 第4段階: 記憶の種類
 */
export type MemoryScope =
  | 'short_term'    // 短期記憶: 直近数往復、現在の質問、現在の回答設計
  | 'mid_term'      // 中期記憶: 現在進行中の話題、未解決事項、直近の決定
  | 'long_term'     // 長期記憶: 継続的な好み、長期的な方針、確定した設計原則、一般ルール
  | 'raw_archive';  // 原文保管: 会話全文、教師回答全文、教材生成過程、評価結果

/**
 * 設計思想 8.1 長期記憶の4大分類
 */
export type LongTermMemoryType =
  | 'preference'        // 継続的な好み
  | 'policy'            // 長期的な方針
  | 'design_principle'  // 確定した設計原則
  | 'general_rule';     // 繰り返し利用する一般ルール

/**
 * 設計思想 8.2 記憶の状態
 */
export type MemoryLifecycleStatus =
  | 'ACTIVE'      // 有効
  | 'SUPERSEDED'  // 置換済み（古い記憶だが置換関係を保持）
  | 'REJECTED'    // 却下
  | 'EXPIRED'     // 期限切れ
  | 'UNVERIFIED'  // 未検証
  | 'APPROVED';   // 承認済み

/**
 * 設計思想 8.3 検索方針: 7段階検索パイプライン結果
 */
export interface MemoryPipelineStepHit {
  step: number;
  name: string;
  count: number;
  description: string;
  sampleIds?: string[];
}

export interface MemoryPipelineSearchResult {
  scoredMemories: Array<{
    memory: MemoryItem;
    score: number;
    matchStage?: string;
  }>;
  filteredOutCount: number;
  steps: MemoryPipelineStepHit[];
  retrievedRawExcerpts: Array<{
    memoryId: string;
    sourceRef: string;
    rawExcerpt: string;
    lifecycleStatus: MemoryLifecycleStatus;
  }>;
}

/**
 * スキルライブラリ (設計思想 13. スキルライブラリ)
 */
export interface SkillItem {
  id: string;
  name: string;
  category: 'coding' | 'debug' | 'vba' | 'retrieval' | 'summarize' | 'file_analysis' | 'planning' | 'custom';
  description: string;
  triggerCondition: string; // 適用条件 (発言に特定のキーワードや意図が含まれる場合)
  requiredInputs: string[];  // 必要入力 (コード、ファイル、要件など)
  steps: string[];           // 処理手順
  usedTools: string[];       // 使用ツール (検索、計算、パーサーなど)
  outputFormat: string;      // 出力形式
  verificationMethod: string;// 検証方法
  status: 'candidate' | 'tested' | 'official' | 'official_matured' | 'disabled';
  distinctContexts?: string[]; // 50章: 異なる文脈・トリガーパターンの記録 (最低3パターンの多様性検証)
  promotedToOfficialAt?: number; // 正式運用(official)へ昇格した日時 (30日運用の判定基準)
  graduatedToTrainingAt?: number; // 50章: LoRA教材候補・学習サンプルプールへ投入された日時
  trainingSampleId?: string; // 連携された自己改善学習サンプルのID
  diversityWarning?: string; // 単一文脈でのみ成功している場合の警告 (案件固有エピソード配置推奨)
  successCount: number;
  failureCount: number;
  version: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 設計思想 46. 能力プラグイン方式 (Capability Plugin System)
 * 47章「自然言語からワークフローを作る機構」の allowed_tools の参照元となる能力定義基盤。
 * プラグインが追加されても端末内の正式権限を自動的に増やさず、ACTIVE昇格時にユーザー同意を必須とする。
 */
export type CapabilityPluginStatus =
  | 'DISABLED'   // 無効化中
  | 'CANDIDATE'  // 候補（未テスト・未承認）
  | 'TESTED'     // テスト完了（権限同意待ち、または試験合格）
  | 'ACTIVE'     // 有効（ユーザーによる権限明示同意済み、稼働中）
  | 'SUSPENDED'  // 一時停止（失敗多発またはユーザー手動停止）
  | 'RETIRED';   // 引退（新バージョンまたは別能力へ移行済み）

export interface CapabilityPluginExecutionBudget {
  maxTokens?: number;       // 1回あたりの最大消費トークン
  maxCalls?: number;        // セッションまたはタスク内最大呼び出し回数
  costPerRun?: number;      // クラウド実行時等の想定コスト (Credits/USD等)
  maxDurationMs?: number;   // 想定最大所要時間 (ミリ秒)
}

export interface CapabilityPlugin {
  plugin_id: string;                      // プラグイン識別子 (例: plugin_web_search)
  name: string;                           // 名称 (例: Web調査能力)
  description: string;                    // 概要・説明
  category: string;                       // 対応する依頼分類 (例: web_search, vba_validation, code_analysis)
  requiredInputs: string[];               // 必要入力 (例: ['検索クエリ', '調査テーマ'])
  outputSchema: string;                   // 出力スキーマ (例: 'Markdownレポート形式 (引用元URL・事実要約)')
  allowedTools: string[];                 // 使用可能ツール (例: ['tool_gemini_cloud_search', 'tool_workspace_search'])
  requiredPermissions: string[];          // 必要権限 (例: ['network_cloud', 'workspace_read'])
  executionBudget: CapabilityPluginExecutionBudget; // 実行予算
  timeoutMs: number;                      // タイムアウト (ミリ秒)
  verificationMethod: string;             // 検証方法 (例: '事実整合性チェック & 参照URLのフォーマット検証')
  fallbackPluginId?: string;              // 失敗時の代替経路 (例: 'plugin_local_code_analysis')
  version: string;                        // 版 (例: '1.0.0')
  status: CapabilityPluginStatus;         // 状態 (DISABLED, CANDIDATE, TESTED, ACTIVE, SUSPENDED, RETIRED)
  
  // 権限・同意管理 (プラグインが追加されても正式権限を自動追加しない原則)
  userConsentGrantedAt?: number;          // ユーザー明示同意日時
  grantedPermissions?: string[];          // ユーザーが明示的に承認した権限一覧
  consentNotes?: string;                  // 同意時の特記事項

  // 実行実績統計
  successCount?: number;                  // 成功回数
  failureCount?: number;                  // 失敗回数
  lastExecutedAt?: number;                // 最終実行日時
  createdAt: number;                      // 作成日時
  updatedAt: number;                      // 更新日時
}

export interface PluginConsentRequest {
  plugin: CapabilityPlugin;
  missingPermissions: string[];
  riskSummary: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isModified?: boolean;
}

/**
 * コード自動適用の確認ゲート用型定義 (設計思想 2. 生成と適用の分離)
 */
export interface ProposedCodeFile {
  path: string;
  name: string;
  content: string;
  language: string;
  originalContent?: string;
  isNewFile?: boolean;
}

export interface CodeProposal {
  id: string;
  messageId?: string;
  files: ProposedCodeFile[];
  status: 'pending' | 'applied' | 'rejected';
  createdAt: number;
  appliedAt?: number;
  source: 'chat' | 'task_plan' | 'assistant' | 'teacher';
  summary?: string;
}

/**
 * Native llama.cpp 実行パラメータ設定 (設計思想 3. 実設定反映)
 */
export interface NativeLlamaConfig {
  nGpuLayers: number;       // 0〜99 (0=純CPU, 99=全層GPUオフロード)
  nCtx: number;             // コンテキスト長 (512, 1024, 2048, 4096, 8192)
  nThreads: number;         // CPUスレッド数 (1〜16)
  temperature: number;      // サンプリング温度 (0.1〜1.5)
  topP: number;             // Top-P核サンプリング (0.1〜1.0)
  maxTokens: number;        // 最大生成トークン数 (64〜2048)
  repetitionPenalty: number;// 繰り返しペナルティ (1.0〜1.5)
}

/**
 * VBA準備・安全ゲート検証結果 (設計思想 10. VBA準備ゲート)
 */
export interface VbaSafetyAssessment {
  status: 'safe' | 'warning' | 'restricted' | 'blocked';
  hasFileSystemAccess: boolean;
  hasShellExecution: boolean;
  hasNetworkCall: boolean;
  hasAutoExecEvent: boolean;
  warnings: string[];
  reviewed: boolean;
  targetApplication: 'Excel' | 'Access' | 'Word' | 'Other';
}

/**
 * ツール管理 (:feature:tools) & タスク計画とツール利用 (設計思想 13-14章, 22章)
 */
export type ToolPermissionLevel = 'read_only' | 'workspace_read' | 'workspace_write' | 'network' | 'system';

export interface ToolParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'math' | 'code' | 'workspace' | 'data' | 'system';
  permission: ToolPermissionLevel;
  requiresConfirmation: boolean;
  parameters: ToolParameterSchema[];
  linkedSkillIds?: string[]; // 連携するスキルID (設計思想 13章)
  isAvailable: boolean;
  executionCount?: number;
  lastExecutedAt?: number;
}

export interface ToolExecutionRequest {
  id: string;
  toolId: string;
  toolName: string;
  params: Record<string, any>;
  timestamp: number;
  requiresConfirmation: boolean;
  permission: ToolPermissionLevel;
  reason?: string;
}

export interface ToolExecutionResult {
  toolId: string;
  toolName: string;
  success: boolean;
  result: any;
  error?: string;
  outputSummary: string;
  executionTimeMs: number;
  permission: ToolPermissionLevel;
  requiresConfirmation?: boolean;
  requiresPluginConsent?: boolean;   // 46章: 能力プラグインの権限同意待ちで実行できなかった場合 true
  pluginConsentRequest?: PluginConsentRequest; // 46章: 同意ダイアログにそのまま渡せる形の同意要求
  executedAt?: number;
}

export interface SafeMathResult {
  result: number;
  formatted: string;
  expression: string;
  success?: boolean;
  error?: string;
}

export interface ToolRecommendation {
  toolId: string;
  name: string;
  category: 'math' | 'code' | 'workspace' | 'data' | 'system';
  reason: string;
  suggestedParams?: Record<string, any>;
  requiresConfirmation: boolean;
  permission: ToolPermissionLevel;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface ExecutionStep {
  stepNumber: number;
  totalSteps: number;
  title: string;
  category: string;
  elapsedMs: number;
  relativeMs?: number;
  relativeDeltaMs?: number;
  status: 'pending' | 'active' | 'success' | 'warn' | 'error';
  details?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  speaker?: {
    id: string;
    name: string;
    avatar: string;
    roleName: string;
    color: string;
  };
  attachedFiles?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  engineMode?: EngineMode;
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
  metrics?: {
    engine?: string;
    modelName?: string;
    tokens?: number;
    tokensPerSec?: number;
    ttftMs?: number;
    totalDurationMs?: number;
  };
  executionSteps?: ExecutionStep[];
  isStreaming?: boolean;
  isError?: boolean;
  // 設計思想 24. 第1世代〜第3世代 追跡フィールド
  usedMemories?: Array<{ id: string; content: string; score?: number }>;
  usedSkills?: Array<{ id: string; name: string }>;
  // ツール管理 (:feature:tools / 設計思想 14 & 22章)
  suggestedTools?: ToolRecommendation[];
  executedTools?: ToolExecutionResult[];
  pendingToolConfirmation?: ToolExecutionRequest;
  taskPlan?: TaskPlan; // フェーズ3: 多段推論・検証タスク計画
  userFeedback?: 'good' | 'bad' | null;
  feedbackNote?: string;
  fallbackDiagnostic?: {
    category: string;
    cause: string;
    tip: string;
    modelId: string;
  };
  failureClassification?: {
    category: string;
    rootCause: string;
    suggestedFixArea: 'memory' | 'retrieval' | 'prompt' | 'skill' | 'tool' | 'model' | 'no_change';
    verified: boolean;
  };
  // 文書48章「完成条件と完了判定器」
  completionEvaluation?: CompletionEvaluation;
  // コード適用確認ゲート & VBA準備ゲート
  codeProposal?: CodeProposal;
  vbaAssessment?: VbaSafetyAssessment;
  // 設計思想 6章 & 第3段階: 回答品質・回答長・直接回答評価
  responseQuality?: ResponseQualityEvaluation;
  // 設計思想 10章, 15-16章, 47章 & 35章 第5段階
  codeVerification?: ComprehensiveCodeVerification;
  falsificationReport?: FalsificationEvaluation;
  synthesizedWorkflow?: SynthesizedWorkflow;
  // 設計思想 Version 3.2: 9章 回答骨格, 22-25章 コード理解IR, 26章 抽象VBA設計仕様
  answerPlan?: AnswerPlanApplicationResult;
  codeUnderstandingIR?: CodeUnderstandingIR;
  vbaDesignSpecification?: VbaDesignSpecification;
  // 設計思想 49章: 経験の保存先ルーター判定結果 (9分類仕分け)
  experienceRouting?: ExperienceRoutingResult;
  // 設計思想 18章: 会話評価の11指標スコア
  dialogueEvaluation?: ConversationEvaluationMetrics;
  // 設計思想 20章: 不確実性・判断の割れ検出結果
  uncertaintyEvaluation?: UncertaintyDivergenceItem;
  // 設計思想 27章: セキュリティ境界・社内固有情報マスキング監査結果
  securityBoundaryAudit?: SecurityBoundaryAuditResult;
  // 設計思想 37章: 失敗再発検知・回帰パターン
  failureRecurrence?: FailureRecurrencePattern;
}

/**
 * 設計思想 6章 & 7章 & 第3段階: 回答長・会話処理の三段階分離
 */
export type ResponseLength = 'short' | 'standard' | 'detailed';

export interface ResponseQualityEvaluation {
  directAnswerFirst: boolean;
  lengthCategory: ResponseLength;
  actualLengthChars: number;
  lengthCompliant: boolean;
  duplicatesRemovedCount: number;
  unnaturalPhrasesFixed: number;
  passed: boolean;
  feedback: string[];
}

/**
 * 設計思想 7章: 会話状態管理 (Conversation State Management)
 */
export type ConversationStage =
  | 'QUESTION' | 'CLARIFICATION' | 'CORRECTION' | 'COMPARISON'
  | 'DECISION' | 'FOLLOW_UP' | 'TOPIC_CHANGE' | 'CLOSING';

export interface ConversationCorrectionEvent {
  oldValue: string;
  newValue: string;
  affectedTopics: string[];
  timestamp: number;
}

export interface ConversationState {
  currentTopic: string;
  topLevelGoal: string;
  stage: ConversationStage;
  confirmedFacts: string[];
  corrections: ConversationCorrectionEvent[];
  invalidatedAssumptions: string[];
  pendingQuestions: string[];
  expectedResponseLength: ResponseLength;
  updatedAt: number;
}

/**
 * 設計思想 10章 & 35章 第5段階: 総合コード・VBA安全準備ゲート検証結果
 */
export type CodeLanguageType = 'vba' | 'javascript' | 'html' | 'canvas' | 'python' | 'json' | 'sql' | 'other';
export type CodeSafetyLevel = 'PASS_SAFE' | 'WARN_REVIEW_NEEDED' | 'BLOCKED_HIGH_RISK';
export type CodeReadinessStatus = 'READY_FOR_PREVIEW' | 'EXTERNAL_TEST_REQUIRED' | 'RUNTIME_GUARD_NEEDED' | 'BLOCKED';

export interface CodeSafetyRiskItem {
  riskType: 'file_system' | 'shell_exec' | 'network' | 'auto_exec' | 'memory_leak' | 'infinite_loop' | 'privilege';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  lineSnippet?: string;
}

export interface ComprehensiveCodeVerification {
  hasCode: boolean;
  languages: CodeLanguageType[];
  syntaxValid: boolean;
  syntaxErrors: string[];
  safetyLevel: CodeSafetyLevel;
  safetyScore: number; // 0〜100
  risks: CodeSafetyRiskItem[];
  environmentRequirements: string[];
  readiness: CodeReadinessStatus;
  reviewedAt: number;
}

/**
 * 設計思想 15-16章 & 35章 第5段階: 内的自己反証・エッジケース自己検証結果
 */
export interface FalsificationCheckItem {
  aspect: 'boundary_edge_cases' | 'invalidated_assumptions' | 'self_contradiction' | 'persona_retention' | 'hallucination_guard';
  title: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  riskPoint?: string;
}

export interface FalsificationEvaluation {
  falsificationScore: number; // 0〜100 (100 = 完全に堅牢・反証なし)
  passed: boolean;
  checks: FalsificationCheckItem[];
  falsificationWarnings: string[];
  suggestedMitigations: string[];
  evaluatedAt: number;
}

/**
 * 設計思想 47章 & 35章 第5段階: 自然言語からワークフローを作る機構 (Workflow Synthesis)
 */
export interface SynthesizedWorkflowStep {
  stepId: string;
  stepNumber: number;
  name: string;
  intent: string;
  pluginId: string; // 46章 CapabilityPlugin
  assignedTool: string;
  inputMapping: Record<string, any>;
  expectedOutputSchema: string;
  requiresConsent: boolean;
  requiredPermissions: string[];
  timeoutMs: number;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
  resultExcerpt?: string;
}

export interface SynthesizedWorkflow {
  workflowId: string;
  userGoal: string;
  steps: SynthesizedWorkflowStep[];
  budgetEstimate: {
    estimatedDurationMs: number;
    estimatedTokens: number;
    estimatedCostUnits: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  synthesisRationale: string;
  createdAt: number;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed';
}

export interface ConsoleLogItem {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export interface GitHubRepoData {
  repoName: string;
  owner: string;
  stars: number;
  description: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  branch: string;
}

export interface LocalLLMModel {
  id: string;
  name: string;
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat' | 'general';
  expertName: string;
  icon: string;
  sizeMB: number;
  parameters: string;
  quantization: string;
  vramMB: number;
  description: string;
  huggingFaceRepo: string;
  format?: 'gguf' | 'mlc';
  downloadUrl?: string;
  fileName?: string;
  downloadStatus: 'not_downloaded' | 'downloading' | 'cached' | 'loaded_in_vram' | 'error';
  downloadProgress: number;
  statusText?: string;
  errorMessage?: string;
  downloadSpeed?: string;
  etaSeconds?: number;
  lastUpdatedTime?: number;
  isStalled?: boolean;
}

export interface WebGPUStatus {
  supported: boolean;
  adapterName: string;
  vendor: string;
  architecture?: string;
  maxBufferSize?: number;
  maxComputeInvocations?: number;
  status: 'ready' | 'loading' | 'unsupported' | 'error';
}

/**
 * 自己改善記録 (設計思想 9. メタ学習 & 19. 自己改善研究所)
 */
export interface SelfImprovementRecord {
  id: string;
  timestamp: number;
  type: 'failure_diagnosis' | 'prompt_ab_test' | 'retrieval_benchmark' | 'skill_candidate_eval' | 'memory_consolidation';
  targetArea: 'memory' | 'retrieval' | 'prompt' | 'skill' | 'tool' | 'model' | 'no_change';
  hypothesis: string;
  baseline: string;
  candidate: string;
  result: 'improved' | 'regressed' | 'inconclusive' | 'no_change';
  adopted: boolean;
  metrics?: {
    accuracyDelta?: number;
    speedDeltaMs?: number;
    tokenDelta?: number;
  };
}

/**
 * Colab / LoRA学習用 高品質教材JSONL (設計思想 7. 学習データの改善)
 */
export interface TrainingSampleJSONL {
  id: string;
  instruction: string;
  inputContext?: string;
  outputTarget: string;
  category: 'chat' | 'code' | 'vba' | 'retrieval' | 'correction' | 'tool_use';
  reliability: 'high' | 'medium' | 'low';
  source?: 'local_user' | 'autonomous_cycle' | 'external_teacher' | 'synthetic' | 'benchmark_feedback' | string;
  approved: boolean;
  split?: 'train' | 'validation' | 'test'; // 設計思想 7: 学習・検証・テストの厳格なデータ分離 (リーク防止)
  originalFailureOutput?: string;
  failureReason?: string;
  correctionHistory?: string[];
  verificationResult?: string;
  verifiedEffective?: boolean;
  verificationNote?: string; // 例: "原文+18点 / 言い換え+22点"
  redacted?: boolean; // 個人情報伏字化([REDACTED])フラグ (設計思想 25. 安全・品質境界)
  redactedReasons?: string[];
  createdAt: number;
}

/**
 * 失敗パターンの再現性追跡 (設計思想 9. 回帰テスト & 37. 外部教師パイプライン)
 */
export interface FailureRecurrenceEntry {
  patternKey: string;
  category: string;
  firstSeenAt: number;
  lastSeenAt: number;
  recurrenceCount: number;
  samplePrompt: string;
  promotedToTraining?: boolean;
  promotedToSample?: boolean;
  notes?: string;
  reason?: string;
}

/**
 * 外部教師リクエストパイプライン型定義 (設計思想 37〜39節 フェーズ8)
 */
export interface TeacherBudgetLimits {
  dailyCalls: number;
  monthlyCalls: number;
}

export interface TeacherBudgetUsage {
  currentDate: string; // YYYY-MM-DD
  currentMonth: string; // YYYY-MM
  dailyCalls: number;
  monthlyCalls: number;
  dailyPromptTokens: number;
  dailyOutputTokens: number;
  monthlyPromptTokens: number;
  monthlyOutputTokens: number;
  totalGeneratedMaterials: number;
  totalVerifiedPassed: number;
}

export interface TeacherBudgetStatus {
  allowed: boolean;
  reason?: string;
  remaining: {
    daily: number;
    monthly: number;
  };
  usage: TeacherBudgetUsage;
  limits: TeacherBudgetLimits;
}

export interface TeacherRequestPayload {
  failureCategory: string;
  abstractFailurePattern: string;
  anonymizedExample?: string;
  expectedCondition: string;
  failureReason?: string;
  suggestedFormat: {
    instruction: string;
    inputContext?: string;
    idealOutput: string;
    reasoningExplanation: string;
    category: string;
  };
  privacyDeclaration: string;
}

export interface TeacherGeneratedMaterial {
  title?: string;
  instruction: string;
  inputContext?: string;
  outputTarget: string;
  category: 'chat' | 'code' | 'vba' | 'retrieval' | 'correction' | 'tool_use';
  reasoningExplanation?: string;
  tokensUsed?: {
    promptTokens: number;
    outputTokens: number;
  };
}

export interface TeacherUsageRecord {
  id: string;
  timestamp: number;
  category: string;
  promptTokens: number;
  outputTokens: number;
  generatedCount: number;
  verifiedCount: number;
  success: boolean;
  notes?: string;
}

/**
 * 設計思想 11章 睡眠ゲート ＆ 20章 不確実性ルーティング連携:
 * 外部教師のオフライン遅延送信キュー (Delayed Teacher Request Queue)
 */
export type DelayedTeacherQueueStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'REJECTED';

export interface DelayedTeacherQueueItem {
  id: string;
  source: 'uncertainty_divergence' | 'failure_recurrence' | 'manual';
  targetCapabilityId: string;
  userPrompt: string;
  anonymizedPrompt: string;
  failureCategory: string;
  divergenceTypes?: string[];
  uncertaintyScore?: number;
  candidateResponses?: string[];
  enqueuedAt: number;
  status: DelayedTeacherQueueStatus;
  retryCount: number;
  processedAt?: number;
  errorMessage?: string;
  resultSkeletonId?: string;
  resultMaterialId?: string;
  verificationPassed?: boolean;
}

/**
 * 端末内 合成教材生成パイプライン (設計思想 33節・53節 フェーズ7)
 * データ状態遷移: GENERATED → VERIFIED → CANDIDATE → APPROVED / REJECTED
 */
export type SyntheticProblemStatus = 'GENERATED' | 'VERIFIED' | 'CANDIDATE' | 'APPROVED' | 'REJECTED';
export type SyntheticProblemCategory = 'math' | 'json_transform' | 'string_manipulation' | 'tool_selection' | 'memory_conflict';

export interface SyntheticProblem {
  id: string;
  category: SyntheticProblemCategory;
  instruction: string;
  inputContext?: string;
  expectedOutput: string; // 通常プログラムで確定的に作成された模範正解 (Qwenには作らせない)
  sampleCategory: 'chat' | 'code' | 'vba' | 'retrieval' | 'correction' | 'tool_use';
  status: SyntheticProblemStatus;
  generatorType: 'deterministic_program' | 'approved_reference';
  verificationDetails?: {
    method: string;
    passed: boolean;
    error?: string;
    testedWithModel?: boolean;
    modelAnswer?: string;
  };
  rejectionReason?: string;
  createdAt: number;
  verifiedAt?: number;
}

export interface SyntheticBatchSummary {
  id: string;
  timestamp: number;
  weaknessCategory: string;
  weaknessReason: string;
  generatedCount: number;
  verifiedCount: number;
  candidateCount: number;
  approvedCount: number;
  durationMs: number;
  problems: SyntheticProblem[];
}

/**
 * 安全境界ガードにより除外されたサンプルのログ (設計思想 25. 安全・品質境界)
 * 本文は一切保存せず、誤検知分析用の判定理由・ハッシュ・タイムスタンプのみを記録
 */
export interface RejectedTrainingSampleLog {
  id: string;
  timestamp: number;
  reasons: string[];
  excerptHash: string;
  category?: string;
}

/**
 * フィクション文脈（TRPG/ロールプレイ等）で保留された確認待ちサンプル (設計思想 25. 安全・品質境界)
 * 即除外(rejected)せず、別キューに保留して要確認とする第3分類
 */
export interface ReviewQueueItem {
  id: string;
  instruction: string;
  inputContext?: string;
  outputTarget: string;
  category?: string;
  reasons: string[];
  createdAt: number;
}

export interface TrainingDataSplitStats {
  total: number;
  train: number;
  validation: number;
  test: number;
  unassigned: number;
  trainRatio: number;
  valRatio: number;
  validationRatio: number;
  testRatio: number;
}

/**
 * 世界モデル・事前予測 & 予測誤差レコード (設計思想 17. 世界モデルと予測誤差)
 */
export interface ActionPrediction {
  predictionId: string;
  timestamp: number;
  userPrompt: string;
  // 事前予測項目
  expectedIntent: 'chat_casual' | 'code_generation' | 'code_repair' | 'qa_technical' | 'tool_execution' | 'clarification';
  expectedTone: 'friendly_casual' | 'technical_strict' | 'concise';
  expectedMemoryUsage: {
    needed: boolean;
    predictedMemoryCount: number;
    predictedMemoryTopics: string[];
  };
  expectedSkillUsage: {
    needed: boolean;
    predictedSkillIds: string[];
  };
  expectedExecutionPath: 'direct_llm' | 'retrieval_augmented' | 'multi_step_tool' | 'code_sandbox';
  confidenceScore: number; // 0.0 - 1.0
  predictedRisk: 'none' | 'hallucination_risk' | 'persona_drift_risk' | 'syntax_error_risk' | 'missing_context_risk';
}

export interface PredictionErrorRecord {
  id: string;
  predictionId: string;
  timestamp: number;
  prediction: ActionPrediction;
  actualOutcome: {
    actualIntent: string;
    actualUsedMemoriesCount: number;
    actualUsedSkillsCount: number;
    hasCodeBlock: boolean;
    hasToneViolation: boolean; // ロボット口調や過剰敬語が混入したか
    executionError: boolean;
    userFeedback: 'good' | 'bad' | 'correction' | 'neutral';
    tokenCount: number;
    elapsedMs: number;
  };
  // 予測と実際の差分 (Surprisal & Prediction Error)
  predictionError: {
    errorMagnitude: number; // 0.0 (完全一致) 〜 1.0 (完全乖離)
    memorySurprisal: 'matched' | 'under_retrieved' | 'over_retrieved' | 'retrieved_but_unused';
    skillSurprisal: 'matched' | 'unpredicted_skill_used' | 'predicted_skill_failed';
    toneSurprisal: 'matched' | 'drifted_to_robot';
    errorCategory: 'none' | 'memory_policy_mismatch' | 'intent_misclassification' | 'constraint_violation' | 'model_capacity_limit';
    diagnosisNote: string;
    suggestedImprovement: 'update_memory_policy' | 'refine_prompt_boundary' | 'add_skill' | 'export_dpo_sample' | 'no_action';
  };
}

/**
 * モデル世代管理 & 系統樹 (設計思想 18. 系統樹 & 24. 第4世代)
 */
export interface ModelGeneration {
  generationId: string;
  modelName: string;
  baseModel: string;
  version: string;
  branch: 'stable' | 'chat_specialized' | 'code_specialized' | 'ultra_light' | 'experimental' | 'memory_retrieval';
  parameterCount?: number;    // 概算パラメータ数 (例: 1.5e9, 3e9)
  loraRank?: number;
  trainingSamplesCount?: number;
  status: 'active' | 'shadow_testing' | 'archived' | 'deprecated';
  benchmarkScore?: number;
  benchmarkReportId?: string; // どの回帰レポートに基づく昇格・実測か (設計思想 25)
  promotedAt?: number;        // 安定版(stable)への昇格承認日時
  promotionNotes?: string;    // 昇格検証の承認根拠
  notes?: string;
  createdAt: number;
}

/**
 * Android WorkManager & バックグラウンド自律処理 (設計思想 11. バックグラウンド自己対話 & 23. Androidネイティブ)
 */
export interface BackgroundExecutionConditions {
  isCharging: boolean;
  batteryLevel: number; // 0-1 (30% = 0.3)
  isUserActive: boolean; // 直近数分以内にチャット操作があったか
  thermalState: 'normal' | 'warm' | 'hot' | 'critical'; // Android Battery/Thermal APIから取得
}

export interface WorkManagerConstraints {
  requiresCharging: boolean;       // 充電中制約 (BatteryManager.BATTERY_STATUS_CHARGING)
  requiresDeviceIdle: boolean;     // 端末アイドル制約 (ユーザー無操作)
  requiresUnmeteredWifi: boolean;  // Wi-Fi接続制約 (NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
  batteryNotLow: boolean;          // バッテリー残量20%以上
  nightTimeOnly: boolean;          // 深夜帯限定 (02:00〜05:00)
}

export interface BackgroundTaskExecutionLog {
  id: string;
  timestamp: number;
  taskType: 'memory_consolidation' | 'self_dialogue_testing' | 'dataset_cleanup' | 'graph_link_builder' | 'autonomous_cycle' | 'skill_discovery' | 'ab_prompt_testing' | 'regression_benchmark';
  status: 'running' | 'completed' | 'failed' | 'aborted_constraint';
  durationMs: number;
  batteryLevel?: number;
  isCharging?: boolean;
  isWifi?: boolean;
  summary: string;
  details: {
    consolidatedMemoriesCount?: number;
    graphLinksCreatedCount?: number;
    simulatedDialoguesCount?: number;
    cleanedDatasetSamplesCount?: number;
    cleanedDuplicatesCount?: number;
    prunedLowQualityCount?: number;
    skillsExtractedCount?: number;
    skillsPromotedCount?: number;
    abTestsRunCount?: number;
    regressionBenchmarkScore?: number;
    regressionReportId?: string;
    trainingThresholdReached?: boolean;
    trainingCurrentCount?: number;
    trainingTargetThreshold?: number;
    syntheticGeneratedCount?: number;
    weaknessFound?: string[];
  };
}

export interface WorkManagerStatus {
  isRegistered: boolean;
  lastRunTimestamp?: number;
  nextScheduledRunTimestamp?: number;
  intervalMinutes: number; // デフォルト: 360分 (6時間ごと)
  constraints: WorkManagerConstraints;
  currentBatteryState: {
    level: number; // 0 - 100
    charging: boolean;
    supported: boolean;
  };
  currentNetworkState: {
    isWifi: boolean;
    isOnline: boolean;
    type: string;
  };
  isIdle: boolean;
  isExecutingNow: boolean;
  currentSleepState: 'idle' | 'shallow' | 'deep';
  currentConditions: BackgroundExecutionConditions;
  unmetReasons: {
    shallow: string[];
    deep: string[];
  };
}

/**
 * ベンチマーク & 退行テスト (設計思想 9. ベンチマークと退行テスト)
 */
export interface BenchmarkTestCase {
  id: string;
  category: 'persona_tone' | 'vba_coding' | 'js_canvas' | 'stress_boundary' | 'japanese_corpus' | 'structured_json';
  title: string;
  prompt: string;
  expectedKeywords: string[];     // 含まれるべきキーワード
  forbiddenKeywords: string[];    // 含まれてはならない禁止語 (敬語など)
  expectedCodeType?: 'vba' | 'javascript' | 'html' | 'json';
  baselineScore: number;          // 前バージョン/ベースラインスコア (0-100)
}

export interface BenchmarkTestResult {
  testId: string;
  passed: boolean;
  score: number;                  // 0 - 100
  generatedResponse: string;
  matchedKeywords: string[];
  foundForbiddenKeywords: string[];
  codeSyntaxValid: boolean;
  isRegression: boolean;          // ベースラインより著しく低下したか
  scoreDelta: number;             // ベースラインとの差分
  latencyMs: number;
}

export interface RegressionSuiteRunReport {
  id: string;
  timestamp: number;
  modelName: string;
  modelId?: string;               // 実際にテストされた推論モデルの識別子 (GGUFファイル名またはWebLLMモデルID)
  engineType?: 'native_gguf' | 'webllm' | 'none'; // 実行エンジン種別
  totalTests: number;
  passedTests: number;
  failedTests: number;
  regressionsCount: number;
  overallScore: number;
  averageLatencyMs: number;
  categoryScores: Record<string, number>;
  results: BenchmarkTestResult[];
}

/**
 * モデルサイズ比較ベンチマーク評価 (設計思想 44節 & 79節 フェーズ6)
 * 1.5B vs 3B など、異なるベースモデル規模間での品質・速度・発熱・メモリ総合比較
 */
export interface BenchmarkScores {
  overallScore: number;
  accuracyScore: number;      // 正答率 (0-100)
  groundingScore: number;     // 根拠率・キーワード一致率 (0-100)
  categoryScores: Record<string, number>;
  regressionsCount: number;
  passedTests: number;
  totalTests: number;
}

export interface ModelSizeProfile {
  id: string;
  name: string;
  params: number;             // 概算パラメータ数 (例: 1.5e9, 3.0e9)
  scores: BenchmarkScores;
  avgTps: number;             // 生成速度 (tokens / sec)
  avgFirstTokenMs: number;    // 初回トークンまでの時間 (ms)
  estimatedMemoryMb: number;  // 実行時推定メモリ使用量 (MB)
  thermalState?: 'normal' | 'warm' | 'hot' | 'critical'; // 端末温度状態
  jsonSuccessRate: number;    // 構造化JSON出力成功率 (0.0 - 1.0)
}

export interface ModelSizeComparisonReport {
  id: string;
  timestamp: number;
  modelA: ModelSizeProfile;
  modelB: ModelSizeProfile;
  verdict: 'ADOPT_B' | 'KEEP_A' | 'INCONCLUSIVE';
  verdictReasons: string[];
  metricsDelta?: {
    scoreDelta: number;       // modelB.scores.overallScore - modelA.scores.overallScore
    tpsChangePercent: number; // ((modelB.avgTps - modelA.avgTps) / modelA.avgTps) * 100
    ttftChangePercent: number; // ((modelB.avgFirstTokenMs - modelA.avgFirstTokenMs) / modelA.avgFirstTokenMs) * 100
    memoryIncreaseMb: number; // modelB.estimatedMemoryMb - modelA.estimatedMemoryMb
  };
}

/**
 * コンテキスト圧縮・スライディングウィンドウ (設計思想 20. コンテキスト圧縮)
 */
export interface CompressedContextResult {
  isCompressed: boolean;
  originalTokensEstimated: number;
  compressedTokensEstimated: number;
  compressionRatio: number;      // 0.0 - 1.0 (例: 0.35 = 65%削減)
  summarizedTurnCount: number;
  activeRecentTurnCount: number;
  episodeSummary: string;        // 過去ターンの要約蒸留テキスト
  formattedMessages: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

/**
 * フェーズ3: 多段推論・検証タスク計画 (設計思想 79節 実装フェーズ3)
 */
export type TaskStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type TaskStepActionType =
  | 'analysis'         // 要件整理・現状分析
  | 'tool_execution'   // ツール実行（計算、検索、ファイル読み込み等）
  | 'code_generation'  // コード・成果物生成
  | 'verification'     // 整合性自己検証・エラーチェック
  | 'synthesis';       // 最終統合・回答構築

export interface TaskStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: TaskStepStatus;
  actionType?: TaskStepActionType;
  toolCall?: {
    toolId: string;
    toolName?: string;
    params?: Record<string, unknown>;
  };
  result?: string;
  error?: string;
  durationMs?: number;
  confidenceScore?: number;
}

export interface TaskPlanCheckpoint {
  lastCompletedStepId?: string;
  snapshotTime: number;
  completedStepCount: number;
  stateData?: Record<string, unknown>;
}

export interface TaskClaimLedger {
  confirmed: string[];   // 確定した事実
  hypotheses: string[];  // まだ仮説段階のもの
  unconfirmed: string[]; // 未確認・要調査事項
}

export type TaskPlanStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'paused';

export interface TaskPlan {
  id: string;
  goal: string;
  status: TaskPlanStatus;
  steps: TaskStep[];
  currentStepIndex: number;
  claimLedger: {
    confirmed: string[];   // 確定した事実
    hypotheses: string[];  // まだ仮説段階のもの
    unconfirmed: string[]; // 未確認・要調査事項
  };
  constraints?: string[];
  acceptanceConditions?: string[];
  checkpoint?: TaskPlanCheckpoint;
  totalSteps: number;
  completedSteps: number;
  finalSummary?: string;
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// 文書48章「完成条件と完了判定器」関連型定義
// ==========================================

export type CompletionStatus =
  | 'COMPLETE'                    // 依頼が完遂され、要求事項を満たし追加アクション不要
  | 'PARTIAL'                     // 部分的達成、未解決事項や次回への繰り越しあり
  | 'BLOCKED'                     // 外部リソース・権限・必須情報不足等で中断
  | 'FAILED'                      // 意図した実行や生成が失敗
  | 'CANCELLED'                   // ユーザーにより中断、または取り消し
  | 'EXTERNAL_COMPILE_REQUIRED'   // VBA等の外部環境（Excel / VBE等）での構文チェック・コンパイル確認が必要
  | 'RUNTIME_TEST_REQUIRED';      // 構文は通ったが、実際のデータや実機（実シート・API等）での動作テストが必要

export interface CompletionChecklist {
  // 1. 依頼の目的を満たしたか
  goalSatisfaction: {
    passed: boolean;
    note: string;
  };
  // 2. 成果物の存在
  artifactPresence: {
    passed: boolean;
    type?: 'code' | 'vba' | 'json' | 'plan' | 'text' | 'file';
    summary?: string;
  };
  // 3. 必須項目の充足
  requiredItems: {
    passed: boolean;
    fulfilled: string[];
    missing: string[];
  };
  // 4. 検証結果の有無
  verification: {
    status: 'verified' | 'static_only' | 'unverified' | 'failed';
    note: string;
  };
  // 5. 未解決事項の有無と明示
  unresolvedIssues: {
    hasIssues: boolean;
    issues: string[];
    explicitlyNoted: boolean;
  };
  // 6. 保存先とハッシュの記録
  storageTracking: {
    savedLocation?: string;
    contentHash?: string;
    filename?: string;
  };
  // 7. 次操作の要否
  nextAction: {
    required: boolean;
    actionType: 'compile_in_excel' | 'run_test' | 'provide_info' | 'user_review' | 'none';
    note: string;
  };
}

export interface CompletionEvaluation {
  status: CompletionStatus;
  score: number; // 0 - 100
  headline: string; // 簡潔な要約（例: "Excel構文確認待ち"）
  reason: string; // 判定詳細理由
  checklist: CompletionChecklist;
  isCodeOrVba: boolean;
  detectedCodeTypes: string[]; // 'vba', 'typescript', 'python' など
  requiresExternalVerification: boolean;
  evaluatedAt: number;
  autoDiagnosedAt?: number; // 48章: FAILED/BLOCKED自動検出で診断済みの場合に記録（手動👎時の二重登録防止）
  manuallyOverridden?: boolean;
}

// ============================================================
// 設計思想 Version 3.2 統合改訂版 (9章, 16章, 20-26章, 31-32章) 型定義
// ============================================================

/**
 * 設計思想 9章 & 35章 第5段階: 回答骨格と思考節約
 */
export type ResponseSkeletonReuseMode = 'EXACT_RESPONSE' | 'PLAN_ONLY' | 'SKILL_COMPOSITION';

export interface ResponseSkeleton {
  pattern_id: string; // 例: PATTERN-CORRECTION-01
  situation: string;  // 適用状況（例: 以前の前提が明示的/遠回しに訂正された）
  triggerKeywords: string[];
  stage: ConversationStage;
  response_plan: string[]; // 手順（例: 1.訂正認識 2.古い前提無効化 3.結論先行）
  avoid: string[]; // 禁止・回避事項（例: 古い前提を残す、謝罪だけで終わる）
  reuse_mode: ResponseSkeletonReuseMode;
  samplePrompt: string;
  exampleResponseTemplate: string;
  usageCount: number;
  successRate: number; // 0〜100
  createdAt: number;
  updatedAt: number;
}

export interface AnswerPlanApplicationResult {
  applied: boolean;
  matchedSkeleton?: ResponseSkeleton;
  differenceCheck?: string[];
  savingsNote?: string;
  stepsToExecute?: string[];
  reason?: string;
}

/**
 * 設計思想 21章: 能力の習得状態
 */
export type CapabilityMasteryState =
  | 'UNASSESSED'
  | 'WEAK'
  | 'LEARNING'
  | 'STABLE'
  | 'SATURATED'
  | 'REGRESSED';

export interface CapabilityMasteryProfile {
  capabilityId: string;
  name: string;
  category: string;
  state: CapabilityMasteryState;
  successCount: number;
  failureCount: number;
  paraphraseFailureCount: number;
  generalizationGapCount: number;
  associatedSkeletons: string[];
  lastAssessedAt: number;
  transitionHistory: Array<{
    from: CapabilityMasteryState;
    to: CapabilityMasteryState;
    reason: string;
    timestamp: number;
  }>;
}

/**
 * 設計思想 32章 & 20章: 不足能力レジストリ (汎化不足型含む)
 */
export type CapabilityGapType = 'failure' | 'generalization_gap';

export interface CapabilityGapEntry {
  gap_id: string; // 例: GAP-0012, GAP-0031
  description: string;
  gap_type: CapabilityGapType; // 20章: 'generalization_gap' = 対策骨格を保存済みだが類似の未知の言い回しで再発した汎化不足
  capabilityId: string;
  frequency: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  current_workaround: string;
  candidate_solution: string;
  status: 'OPEN' | 'MITIGATED' | 'RESOLVED';
  firstSeenAt: number;
  lastSeenAt: number;
  samples: string[];
  associatedPatternId?: string; // 紐づく回答骨格パターンID
}

/**
 * 設計思想 16章: LoRA検討の発動条件と仮想学習試験
 */
export interface LoraTriggerAssessment {
  triggered: boolean; // 16.2の発動条件を満たしたか
  reasons: string[];
  paraphraseFailureRepeated: boolean;
  skeletonAddedButFailurePersists: boolean;
  weakCapabilityStagnated: boolean;
  recommendation: 'MAINTAIN_DISABLED' | 'RECOMMEND_VIRTUAL_TEST' | 'APPROVE_LORA_CANDIDATE';
}

export interface VirtualTrainingTrial {
  trialId: string;
  capabilityId: string;
  testPrompt: string;
  paraphrasePrompts: string[];
  crossDomainPrompt: string;
  step1_baselineOutput: string;
  step2_retrievalInjectedOutput: string;
  step3_sameProblemRetestPassed: boolean;
  step4_paraphraseRetestPassed: boolean;
  step5_crossDomainRetestPassed: boolean;
  step6_regressionCheckPassed: boolean;
  verdict: 'NO_LORA_NEEDED_SAVE_SKELETON' | 'LORA_CANDIDATE' | 'INCONCLUSIVE_TOO_DIFFICULT' | 'REJECT_REGRESSION';
  verdictDetails: string;
  timestamp: number;
}

/**
 * 設計思想 22〜25章 & 35章 第10段階: コード理解AI (Code IR)
 */
export interface CodeProcedureIR {
  procedureName: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'FRIEND' | 'UNKNOWN';
  purpose: string;
  inputs: Array<{ name: string; type: string; optional?: boolean }>;
  returns: string | null;
  reads: string[];
  writes: string[];
  calls: string[];
  conditions: string[];
  loops: string[];
  terminationConditions: string[];
  errorHandling: string[];
  side_effects: string[];
  external_dependencies: string[];
  unknown_dependencies: string[];
  docComment?: string;
}

export interface CodeUnderstandingIR {
  id: string;
  sourceLanguage: string;
  rawSnippet: string;
  procedures: CodeProcedureIR[];
  globalVariables: string[];
  unresolvedDependencies: string[];
  commentCodeContradictions: Array<{
    location: string;
    commentClaim: string;
    actualCodeBehavior: string;
    severity: 'warn' | 'conflict';
  }>;
  impactPredictions: Array<{
    targetProcedure: string;
    potentialBreakage: string;
    affectedCallers: string[];
    testCasesToRerun: string[];
  }>;
  comprehensionQA: Array<{
    question: string;
    answer: string;
    criteria: string;
  }>;
  naturalJapaneseSummary: string;
  createdAt: number;
}

/**
 * 設計思想 22〜25章: 複数モジュールVBAプロジェクト解析型定義
 */
export interface VbaModuleFile {
  id: string;
  name: string; // 例: "M_Main", "clsOrder", "Sheet1", "frmDialog"
  type: 'standard' | 'class' | 'sheet' | 'userform';
  code: string;
}

export interface CrossModuleCallEdge {
  callerModule: string;
  callerProcedure: string;
  calleeModule: string;
  calleeProcedure: string;
  callType: 'explicit_module' | 'implicit_global' | 'method_call';
}

export interface CrossModuleImpactAnalysis {
  targetModule: string;
  targetProcedure: string;
  directlyAffectedCallers: Array<{ module: string; procedure: string }>;
  indirectlyAffectedCallers: Array<{ module: string; procedure: string }>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedTestCases: string[];
}

export interface MultiModuleAnalysisResult {
  projectId: string;
  modulesCount: number;
  totalProceduresCount: number;
  modules: Array<{
    name: string;
    type: string;
    ir: CodeUnderstandingIR;
  }>;
  callGraph: CrossModuleCallEdge[];
  circularCalls: Array<{
    cycle: string[]; // 例: ["M_Main.RunAll", "M_Calc.Compute", "M_Main.RunAll"]
    severity: 'warn' | 'error';
    description: string;
  }>;
  crossModuleImpacts: CrossModuleImpactAnalysis[];
  unresolvedExternalCalls: Array<{
    callerModule: string;
    callerProcedure: string;
    unresolvedName: string;
  }>;
  analyzedAt: number;
}

/**
 * 設計思想 26章 & 35章 第11段階: 抽象コード・VBA設計支援AI
 */
export interface DecisionTableRule {
  ruleId: string;
  conditionValues: Record<string, string | boolean>;
  actionValues: Record<string, string | boolean>;
  priority: number;
  notes?: string;
}

export interface DecisionTable {
  title: string;
  conditions: Array<{ id: string; name: string; possibleValues: string[] }>;
  actions: Array<{ id: string; name: string }>;
  rules: DecisionTableRule[];
}

export interface AbstractProcedurePlan {
  name: string; // 例: PROCESS_MAIN, FIND_HEADER, IS_TARGET_ROW
  role: string;
  abstractInputs: string[];
  abstractOutputs: string[];
  errorStrategy: string;
}

export interface AbstractTestCasePlan {
  category: 'normal' | 'boundary' | 'exception';
  scenario: string;
  inputDescription: string;
  expectedBehavior: string;
}

export interface VbaDesignSpecification {
  specId: string;
  title: string;
  abstractRequirement: string;
  decisionTable: DecisionTable;
  procedurePlans: AbstractProcedurePlan[];
  testCasePlans: AbstractTestCasePlan[];
  externalCopilotPrompt: string; // 外部Copilot等へ渡す詳細指示書
  dataCharacteristicsPreserved: string[]; // 例: 5桁の文字列、先頭ゼロを保持する、数値変換しない
  createdAt: number;
}

/**
 * 設計思想 31章: 機能フラグ
 */
export type FeatureFlagState = 'DISABLED' | 'DEVELOPMENT' | 'SHADOW' | 'LIMITED' | 'STABLE';

export interface SystemFeatureFlags {
  CHAT_CORE: FeatureFlagState;
  SHORT_TERM_CONTEXT: FeatureFlagState;
  LONG_TERM_RETRIEVAL: FeatureFlagState;
  ANSWER_PLAN_CACHE: FeatureFlagState;
  TEACHER_ROUTER: FeatureFlagState;
  MULTI_STEP_REASONING: FeatureFlagState;
  LORA_TRAINING: FeatureFlagState; // 16.2の発動条件を満たすまで長期DISABLED固定
  CODE_UNDERSTANDING: FeatureFlagState;
  VBA_DESIGN_ASSISTANT: FeatureFlagState;
  // 設計思想 49章 & 50章 機能フラグ
  EXPERIENCE_ROUTER: FeatureFlagState;
  SKILL_GRADUATION: FeatureFlagState;
}

/**
 * 設計思想 50章: 技能の多様性再試験 (Cross-Context Retest) 結果
 */
export interface SkillDiversityTestCase {
  contextId: string;
  contextType: 'paraphrased' | 'different_domain' | 'edge_case' | 'complex_input';
  prompt: string;
  expectedBehavior: string;
  executed: boolean;
  passed: boolean;
  confidenceScore: number;
  reason: string;
}

export interface SkillDiversityTestResult {
  skillId: string;
  skillName: string;
  evaluatedAt: number;
  totalTests: number;
  passedTests: number;
  diversityScore: number; // 0.0 - 1.0 (多様な文脈での合格率)
  distinctContextCount: number; // 異なる文脈パターン数 (目標: 3以上)
  testCases: SkillDiversityTestCase[];
  generalizationVerdict: 'HIGHLY_GENERALIZED' | 'MODERATE' | 'OVERFITTED_TO_SINGLE_CONTEXT';
  recommendation: 'READY_FOR_OFFICIAL' | 'NEEDS_MORE_DIVERSITY' | 'CONVERT_TO_EPISODIC_MEMORY';
}

/**
 * 設計思想 50章: 技能の卒業進捗情報 (Graduation Progress)
 */
export interface SkillGraduationProgress {
  skillId: string;
  skillName: string;
  status: 'candidate' | 'tested' | 'official' | 'official_matured' | 'disabled';
  // 卒業の4大要件
  requirements: {
    daysSinceOfficial: { current: number; required: number; met: boolean };
    successCount: { current: number; required: number; met: boolean };
    successRate: { current: number; required: number; met: boolean }; // 0.0 - 1.0
    contextDiversity: { current: number; required: number; met: boolean }; // 種類数
  };
  overallGraduationReadiness: number; // 0 - 100%
  isGraduated: boolean;
  graduatedAt?: number;
  trainingSampleId?: string;
  nextMilestone: string;
}

/**
 * 設計思想 18章: 会話評価の固定シナリオ12種
 */
export type FixedConversationScenarioType =
  | 'NORMAL_SHORT_QUESTION'     // 1. 普通の短い質問
  | 'DETAILED_CONSULTATION'     // 2. 少し詳しい相談
  | 'CONTINUATION_REQUEST'      // 3. 前の説明の続きを求める
  | 'PREMISE_CORRECTION'        // 4. 前提を訂正する
  | 'CONTRADICTION_POINT_OUT'   // 5. 矛盾を指摘する
  | 'TOO_LONG_FEEDBACK'         // 6. 回答が長すぎると伝える
  | 'TOO_SHORT_FEEDBACK'        // 7. 回答が短すぎると伝える
  | 'TOPIC_SWITCH'              // 8. 話題を切り替える
  | 'RETURN_TO_PREVIOUS'        // 9. 以前の話へ戻る
  | 'UNKNOWN_QUESTION'          // 10. 不明な内容を質問する
  | 'CONCLUSION_ONLY'           // 11. 結論だけを求める
  | 'AMBIGUOUS_QUERY';          // 12. 曖昧な言い方をする

/**
 * 設計思想 18章: 会話評価の11指標
 */
export interface ConversationEvaluationMetrics {
  directness: number;           // 質問への直接性 (0-100)
  contextRetention: number;     // 文脈維持 (0-100)
  intentRecognition: number;    // 意図理解 (0-100)
  correctionUpdate: number;     // 訂正反映 (0-100)
  contradictionRecovery: number;// 矛盾修復 (0-100)
  naturalness: number;          // 日本語の自然さ (0-100)
  lengthConformity: number;     // 回答長適合度 (0-100)
  noRepetition: number;         // 不要な繰り返しの排除 (0-100)
  uncertaintyHandling: number;  // 不明点の扱い (0-100)
  memoryRelevance: number;      // 記憶の正しい利用 (0-100)
  latencyMs: number;            // 応答速度 (ミリ秒)
  overallScore: number;         // 総合得点 (0-100)
}

/**
 * 18章: 固定評価テストケース
 */
export interface FixedScenarioTestCase {
  id: string;
  scenarioType: FixedConversationScenarioType;
  title: string;
  description: string;
  initialPrompt: string;
  contextHistory?: { role: 'user' | 'assistant'; content: string }[];
  expectedAspects: string[];
  avoidAspects: string[];
  evaluationCriteria: string;
}

export interface FixedScenarioResult {
  testCaseId: string;
  scenarioType: FixedConversationScenarioType;
  title: string;
  prompt: string;
  response: string;
  metrics: ConversationEvaluationMetrics;
  passed: boolean;
  notes: string;
}

/**
 * 18章: 動的会話評価 (Dynamic Multi-Turn Dialogue Evaluation)
 * 教師AI/シミュレータがユーザー役となり、端末AIの回答に応じて次々と発言を変える
 */
export interface DynamicDialogueTurn {
  turnIndex: number;
  stage: 'AMBIGUOUS_START' | 'PREMISE_CORRECTION' | 'CONTRADICTION_PROBE';
  userMessage: string;
  assistantResponse: string;
  turnScore: number;
  critique: string;
  passed: boolean;
}

export interface DynamicDialogueEvaluationResult {
  id: string;
  evaluatedAt: number;
  scenarioName: string;
  turns: DynamicDialogueTurn[];
  fixedEvaluationPassed: boolean;
  dynamicEvaluationPassed: boolean;
  overallPassed: boolean; // 固定評価と動的評価の両方に合格した場合だけ改善扱い (18章)
  overallScore: number;
  summary: string;
}

/**
 * 設計思想 20章: 不確実性駆動の教師利用 (Uncertainty-Driven Teacher Routing)
 */
export interface UncertaintyDivergenceItem {
  id: string;
  sampleText: string;
  candidateResponses: string[];
  divergenceDetected: boolean;
  divergenceTypes: (
    | 'conclusion_diverged'    // 結論が候補ごとに異なる
    | 'intent_diverged'        // 意図推定が一致しない
    | 'memory_diverged'        // 使う記憶が異なる
    | 'length_diverged'        // 回答長の判断が安定しない
    | 'condition_diverged'     // 条件や例外の扱いが異なる
  )[];
  uncertaintyScore: number;    // 0 (安定一致) 〜 100 (極めて判断が割れている)
  shouldSendToTeacher: boolean;// 判定が割れた場合だけ教師へ送信 (20章)
  teacherActionTaken?: 'created_skeleton' | 'recorded_generalization_gap' | 'delayed_no_budget' | 'skipped_stable';
  generatedSkeletonId?: string;
  gapIdRecorded?: string;
  generalizationGapReason?: string;
  createdAt: number;
}

/**
 * 設計思想 28章: 保存容量計画 (60GB配分モニター) & 29章: 自動整理
 */
export interface StoragePartitionUsage {
  id: string;
  category: 'models' | 'dialogue_and_materials' | 'eval_and_experiments' | 'lora_and_artifacts' | 'backups' | 'free_and_temp';
  name: string;
  allocatedGb: number;
  usedBytes: number;
  estimatedMb: number;
  itemCount: number;
  description: string;
  itemsDetail: string[];
}

export interface StorageCapacityPlanReport {
  totalAllocatedGb: number; // 60GB
  totalUsedMb: number;
  freeSpaceMb: number;
  partitions: StoragePartitionUsage[];
  lastAuditedAt: number;
  deduplicationStats: {
    duplicateItemsFound: number;
    spaceSavedMb: number;
    auditLog: string[];
  };
}

/**
 * 設計思想 36章: 当面の最小完成範囲 (Minimal Viable Scope) チェックリスト
 */
export interface MinimalScopeItem {
  id: string;
  category: 'conversation_v1' | 'code_understanding_v1';
  itemNumber: number;
  title: string;
  requirement: string;
  status: 'VERIFIED_ACTIVE' | 'PARTIALLY_MET' | 'NEEDS_VERIFICATION';
  automatedTestStatus: string;
  verifiedTimestamp: number;
  notes: string;
}

/**
 * 設計思想 27章 & 35章 第12段階:
 * 会社固有・環境固有情報の抽象化とセキュリティ境界 (Company & Environment Sanitization & Security Boundary)
 */
export type SanitizationMaskType =
  | 'server_path'      // \\fileserver\share や /var/app/data などの内部パス
  | 'unc_share'        // 内部UNC共有名
  | 'ip_domain'        // 内部社内IP (10.x, 192.168.x, 172.16.x) や社内ドメイン (.corp, .local, .internal)
  | 'credential'       // APIキー、パスワード、接続文字列、Basic認証ヘッダ
  | 'table_sheet'      // 機密社内シート名、DBテーブル名、固有システム名
  | 'personal_name'    // 社員氏名・個人名・メールアドレス
  | 'corp_id';         // 社員番号、顧客コード、口座番号

export interface SanitizedTokenMapping {
  id: string;
  original: string;
  placeholder: string; // 例: <<<SERVER_PATH_1>>>, <<<CORP_SHEET_A>>>, <<<SECRET_CREDENTIAL_1>>>
  maskType: SanitizationMaskType;
  confidence: number; // 0.0 〜 1.0
  detectedContext: string;
}

export interface SecurityBoundaryAuditResult {
  isSafeForExternalSubmission: boolean; // 外部教師や外部AI送信、公開可能か
  sanitizedText: string;                // 抽象化・マスキング後の安全なテキスト
  mappings: SanitizedTokenMapping[];    // 逆展開用マッピング表（ローカル端末内限定保存）
  detectedLeaksCount: number;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'CRITICAL';
  boundaryViolationReasons: string[];
  auditedAt: number;
}

export interface DeAnonymizationResult {
  restoredText: string;
  restoredCount: number;
  unmatchedPlaceholders: string[];
}

/**
 * 設計思想 37章 & 35章 第12段階:
 * 失敗再発 (Failure Recurrence) 検知と自動再対策ループ
 */
export interface FailureRecurrencePattern {
  id: string;
  targetCapabilityId: string;
  failureSignature: string;            // エラー・症状の正規化ハッシュ
  failureTitle: string;
  firstDetectedAt: number;
  lastDetectedAt: number;
  recurrenceCount: number;              // 再発カウント (>=2 で再発と認定)
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggerExamples: string[];            // 再発を誘発したユーザープロンプト例
  associatedSkeletonIds: string[];      // 過去に試みた回答骨格ID
  remediationStatus: 'NEW' | 'QUEUED_FOR_TEACHER' | 'REMEDIATED' | 'REGRESSED';
  regressionTestStatus: 'PASSED' | 'FAILED' | 'PENDING';
  notes?: string;
}

export interface FailureRecurrenceAuditReport {
  totalPatterns: number;
  activeRecurrencesCount: number;
  highRiskRecurrences: FailureRecurrencePattern[];
  autoEnqueuedTeacherCount: number;
  regressedCapabilities: string[];
  lastAuditedAt: number;
}

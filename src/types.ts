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
  // 知識グラフ & 依存関係 (設計思想 12. 知識グラフと関係性)
  parentMemoryId?: string;       // 親ノード (上位概念・大元の設定)
  relatedMemoryIds?: string[];   // 関連記憶ノードID (横のリンク)
  prerequisiteMemoryIds?: string[]; // 前提条件となる記憶ID (依存先)
  domainVector?: number[];       // 多次元トピック重み疎ベクトル
  semanticKeywords?: string[];   // 抽出された意味的キーワード
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
  status: 'candidate' | 'tested' | 'official' | 'disabled';
  successCount: number;
  failureCount: number;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isModified?: boolean;
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
  approved: boolean;
  split?: 'train' | 'validation' | 'test'; // 設計思想 7: 学習・検証・テストの厳格なデータ分離 (リーク防止)
  originalFailureOutput?: string;
  failureReason?: string;
  correctionHistory?: string[];
  verificationResult?: string;
  redacted?: boolean; // 個人情報伏字化([REDACTED])フラグ (設計思想 25. 安全・品質境界)
  redactedReasons?: string[];
  createdAt: number;
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





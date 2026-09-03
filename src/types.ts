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
  originalFailureOutput?: string;
  failureReason?: string;
  correctionHistory?: string[];
  verificationResult?: string;
  createdAt: number;
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
}

/**
 * ベンチマーク & 退行テスト (設計思想 9. ベンチマークと退行テスト)
 */
export interface BenchmarkTestCase {
  id: string;
  category: 'persona_tone' | 'vba_coding' | 'js_canvas' | 'stress_boundary' | 'japanese_corpus';
  title: string;
  prompt: string;
  expectedKeywords: string[];     // 含まれるべきキーワード
  forbiddenKeywords: string[];    // 含まれてはならない禁止語 (敬語など)
  expectedCodeType?: 'vba' | 'javascript' | 'html';
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




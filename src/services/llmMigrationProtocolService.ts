/**
 * 設計思想 13.3節 LLM機能の移管判定プロトコル (LLM Migration Protocol Service)
 *
 * ローカルLLM呼出しログを解析し、反復して同形式の入出力を扱う処理
 * (意図ラベル付け、検索語生成、JSON整形、候補順位付け、定型説明、構文チェック等)を
 * 非LLM決定論的コンポーネントへ移管・評価・安全ロールバック管理する。
 */
import {
  LlmMigrationTask,
  LlmMigrationStatus,
  ShadowComparisonRecord,
} from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

const STORAGE_KEY = 'miki_llm_migration_tasks_v2';

export class LlmMigrationProtocolService {
  private static instance: LlmMigrationProtocolService;
  private tasks: Map<string, LlmMigrationTask> = new Map();

  private constructor() {
    this.loadFromStorage();
    if (this.tasks.size === 0) {
      this.seedInitialTasks();
    }
  }

  public static getInstance(): LlmMigrationProtocolService {
    if (!LlmMigrationProtocolService.instance) {
      LlmMigrationProtocolService.instance = new LlmMigrationProtocolService();
    }
    return LlmMigrationProtocolService.instance;
  }

  private loadFromStorage(): void {
    try {
      const data = storageService.getItem(STORAGE_KEY);
      if (data) {
        const parsed: LlmMigrationTask[] = JSON.parse(data);
        parsed.forEach((t) => this.tasks.set(t.taskId, t));
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage(): void {
    try {
      const arr = Array.from(this.tasks.values());
      storageService.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private seedInitialTasks(): void {
    const initialTasks: LlmMigrationTask[] = [
      {
        taskId: 'MIG-001',
        taskName: '対話行為・意図ラベリング (Dialogue Act Classification)',
        category: 'INTENT_LABELING',
        description: 'ユーザー発話から対話行為 (QUESTION/REQUEST/CORRECTION等) を推定する処理',
        inputStructureDefinition: 'UserMessageString + PreviousDialogueState',
        outputContract: 'DialogueActEnum: QUESTION | REQUEST | CORRECTION | CONFIRMATION | REJECTION...',
        status: 'NON_LLM_DEFAULT',
        metrics: {
          latencyReductionRatio: 99.1, // 4500ms (LLM) -> 1.2ms (Sudachi/Regex)
          ramReductionMb: 1800,
          accuracyScore: 97.4,
          naturalnessScore: 92.0,
          determinismRate: 100,
          userCorrectionRate: 2.1,
        },
        shadowRecords: [
          {
            id: 'SR-001',
            taskId: 'MIG-001',
            sampleInput: '重複行を消すマクロ作って',
            llmOutput: '{"intent": "REQUEST", "action": "VBA_GENERATION"}',
            nonLlmOutput: 'REQUEST: ARTIFACT_VBA',
            latencyLlmMs: 4200,
            latencyNonLlmMs: 1,
            semanticMatchScore: 100,
            isDeterministic: true,
            winner: 'NON_LLM',
            notes: '非LLM正規表現・形態素解析で完全一致し4200倍高速化',
            timestamp: Date.now() - 3600000 * 24,
          },
        ],
        assignedComponentId: 'text.dialogue_act_parser',
        lastEvaluatedAt: Date.now(),
      },
      {
        taskId: 'MIG-002',
        taskName: 'Excel VBA 構文・安全不変条件検査 (VBA Static Verification)',
        category: 'SYNTAX_CHECK',
        description: 'Sub/Functionブロック整合、Option Explicit、未宣言変数、GoToラベルの機械的検査',
        inputStructureDefinition: 'RawVbaSourceCodeString',
        outputContract: 'VbaVerificationReport: { valid: boolean, errors: string[], hasOptionExplicit: boolean }',
        status: 'NON_LLM_DEFAULT',
        metrics: {
          latencyReductionRatio: 99.8, // 12000ms -> 3ms
          ramReductionMb: 2400,
          accuracyScore: 99.9,
          naturalnessScore: 95.0,
          determinismRate: 100,
          userCorrectionRate: 0.1,
        },
        shadowRecords: [
          {
            id: 'SR-002',
            taskId: 'MIG-002',
            sampleInput: 'Sub Test() \n Dim x \n x = 1 \n End Sub',
            llmOutput: 'Option Explicitがありません。変数型が未指定です。',
            nonLlmOutput: '{"hasOptionExplicit": false, "undeclaredVariables": ["x"]}',
            latencyLlmMs: 8400,
            latencyNonLlmMs: 2,
            semanticMatchScore: 100,
            isDeterministic: true,
            winner: 'NON_LLM',
            notes: 'LLMの確率的回答よりAST/行検査の方が網羅性・再現性で圧勝',
            timestamp: Date.now() - 3600000 * 12,
          },
        ],
        assignedComponentId: 'vba.static_verifier_core',
        lastEvaluatedAt: Date.now(),
      },
      {
        taskId: 'MIG-003',
        taskName: '重複除去マクロのコード合成 (Deduplication Macro Synthesis)',
        category: 'VBA_SYNTHESIS',
        description: '辞書オブジェクトを用いた安全な重複排除マクロの決定論的部品合成',
        inputStructureDefinition: 'RequestSpec: { srcSheet, destSheet, keyColumns, preserveLeadingZeros }',
        outputContract: 'ValidExecutableVbaModuleString',
        status: 'NON_LLM_DEFAULT',
        metrics: {
          latencyReductionRatio: 99.5, // 25000ms -> 12ms
          ramReductionMb: 3200,
          accuracyScore: 98.8,
          naturalnessScore: 89.0,
          determinismRate: 100,
          userCorrectionRate: 1.5,
        },
        shadowRecords: [
          {
            id: 'SR-003',
            taskId: 'MIG-003',
            sampleInput: '仕入先コードの先頭ゼロを残して重複除外して',
            llmOutput: 'Sub RemoveDuplicates()... (毎回変数名が変わる)',
            nonLlmOutput: 'Sub ExtractUniqueSupplierCodes()... (検証済み部品合成)',
            latencyLlmMs: 28000,
            latencyNonLlmMs: 14,
            semanticMatchScore: 98,
            isDeterministic: true,
            winner: 'NON_LLM',
            notes: '検証済みTXT部品の決定論的合成によりVulkan Device Lostを完全回避',
            timestamp: Date.now() - 3600000 * 4,
          },
        ],
        assignedComponentId: 'vba.dedup_dictionary_verified',
        lastEvaluatedAt: Date.now(),
      },
      {
        taskId: 'MIG-004',
        taskName: '定型確認・作業完了説明 (Fixed Explanation IR)',
        category: 'FIXED_EXPLANATION',
        description: '作業完了の結論・理由・成立条件・未確認事項を骨格テンプレートから確定出力',
        inputStructureDefinition: 'AnswerContentIR: { conclusion, reasons, conditions, exceptions }',
        outputContract: 'SurfaceExplanationString',
        status: 'SHADOW_COMPARISON',
        metrics: {
          latencyReductionRatio: 97.2,
          ramReductionMb: 1600,
          accuracyScore: 94.0,
          naturalnessScore: 88.5,
          determinismRate: 98,
          userCorrectionRate: 3.2,
        },
        shadowRecords: [],
        assignedComponentId: 'ir.surface_generator_v1',
        lastEvaluatedAt: Date.now(),
      },
      {
        taskId: 'MIG-005',
        taskName: 'Web検索クエリの語彙展開・正規化 (Search Query Expansion)',
        category: 'SEARCH_KEYWORD_GEN',
        description: '曖昧な口語要求から検索エンジン用キーワードを品詞と同意語辞書で展開',
        inputStructureDefinition: 'NaturalQueryString',
        outputContract: 'SearchKeywordsArray: string[]',
        status: 'NON_LLM_CANDIDATE',
        metrics: {
          latencyReductionRatio: 96.0,
          ramReductionMb: 1200,
          accuracyScore: 91.0,
          naturalnessScore: 85.0,
          determinismRate: 95,
          userCorrectionRate: 4.8,
        },
        shadowRecords: [],
        assignedComponentId: 'text.query_tokenizer',
        lastEvaluatedAt: Date.now(),
      },
    ];

    // 13.3の完成判定は実測証拠が必要。旧版にあった固定/想定値を正式証拠として引き継がない。
    initialTasks.forEach((t) => {
      t.status = 'NON_LLM_CANDIDATE';
      t.metrics = {
        latencyReductionRatio: 0,
        ramReductionMb: 0,
        accuracyScore: 0,
        naturalnessScore: 0,
        determinismRate: 0,
        userCorrectionRate: 0,
      };
      t.shadowRecords = [];
      t.lastEvaluatedAt = 0;
      this.tasks.set(t.taskId, t);
    });
    this.saveToStorage();
  }

  public getAllTasks(): LlmMigrationTask[] {
    return Array.from(this.tasks.values());
  }

  public getTaskById(id: string): LlmMigrationTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * シャドー比較の実行と記録
   */
  public runShadowComparison(params: {
    taskId: string;
    sampleInput: string;
    llmOutput: string;
    nonLlmOutput: string;
    latencyLlmMs: number;
    latencyNonLlmMs: number;
    semanticMatchScore: number;
    userCorrection?: boolean;
    notes?: string;
    /** 任意。自然さの実測評価(0-100)。未指定の場合はaccuracyへ流用しない。 */
    naturalnessScore?: number;
  }): ShadowComparisonRecord | null {
    const task = this.tasks.get(params.taskId);
    if (!task) return null;

    // 第13.3節: 比較試験は同一入力・同一資料・同一完成条件・同一資源予算で行う。
    // このサービス自身がLLMの出力・速度を捏造してはいけない。実測値を呼び出し側から受け取る。
    const latencyLlmMs = Number.isFinite(params.latencyLlmMs) ? Math.max(0, params.latencyLlmMs) : 0;
    const latencyNonLlmMs = Number.isFinite(params.latencyNonLlmMs) ? Math.max(0, params.latencyNonLlmMs) : 0;
    const semanticMatchScore = Math.max(0, Math.min(100, params.semanticMatchScore));
    const isDeterministic = this.isDeterministicOutput(params.nonLlmOutput, task);
    const winner: 'LLM' | 'NON_LLM' | 'TIE' =
      semanticMatchScore >= 98 && (latencyNonLlmMs < latencyLlmMs || latencyLlmMs === 0)
        ? 'NON_LLM'
        : semanticMatchScore >= 98 && latencyLlmMs < latencyNonLlmMs
          ? 'LLM'
          : semanticMatchScore >= 95
            ? 'TIE'
            : 'LLM';

    const record: ShadowComparisonRecord = {
      id: `SR-${Date.now()}-${this.tasks.size}-${task.shadowRecords.length}`,
      taskId: params.taskId,
      sampleInput: params.sampleInput,
      llmOutput: params.llmOutput,
      nonLlmOutput: params.nonLlmOutput,
      latencyLlmMs,
      latencyNonLlmMs,
      semanticMatchScore,
      naturalnessScore: Number.isFinite(params.naturalnessScore)
        ? Math.max(0, Math.min(100, Number(params.naturalnessScore)))
        : undefined,
      userCorrection: params.userCorrection === true,
      isDeterministic,
      winner,
      notes: params.notes || '実測されたLLM/非LLM結果によるシャドー比較',
      timestamp: Date.now(),
    };

    task.shadowRecords.unshift(record);
    if (task.shadowRecords.length > 50) task.shadowRecords.pop();
    this.recomputeMetrics(task, params.userCorrection === true);
    task.lastEvaluatedAt = Date.now();
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[第13.3節 シャドー比較] ${task.taskName}: winner=${winner}, semantic=${semanticMatchScore}, ` +
      `LLM=${latencyLlmMs}ms, NON_LLM=${latencyNonLlmMs}ms, deterministic=${isDeterministic}`
    );
    return record;
  }

  private isDeterministicOutput(output: string, task: LlmMigrationTask): boolean {
    if (!output.trim()) return false;
    // 出力契約に反するランダムな自由文を「決定論的」と認定しない。
    // 同一入力の複数実行結果は呼び出し側で比較し、ここでは形式上の契約を確認する。
    if (task.outputContract.includes('string[]')) return output.trim().startsWith('[') && output.trim().endsWith(']');
    if (task.outputContract.includes('boolean')) return /true|false|合格|警告|正常|未検出/.test(output);
    return true;
  }

  private recomputeMetrics(task: LlmMigrationTask, latestUserCorrection: boolean): void {
    const records = task.shadowRecords;
    if (records.length === 0) return;
    const avgLlm = records.reduce((a, r) => a + r.latencyLlmMs, 0) / records.length;
    const avgNon = records.reduce((a, r) => a + r.latencyNonLlmMs, 0) / records.length;
    task.metrics.latencyReductionRatio = avgLlm > 0 ? Math.max(0, (1 - avgNon / avgLlm) * 100) : 0;
    task.metrics.accuracyScore = records.reduce((a, r) => a + r.semanticMatchScore, 0) / records.length;
    task.metrics.determinismRate = records.filter(r => r.isDeterministic).length / records.length * 100;
    // 旧版は「今回の訂正」を先頭1件だけに反映していたため、履歴全体の訂正率になっていなかった。
    // 旧レコード互換のため userCorrection 未保存レコードは「今回の呼出しが最新レコード」のみ補完する。
    const corrected = records.filter((r, i) =>
      typeof r.userCorrection === 'boolean' ? r.userCorrection : i === 0 ? latestUserCorrection : false
    ).length;
    task.metrics.userCorrectionRate = corrected / records.length * 100;

    // 自然さは測定値が存在する場合だけ集計する。未計測を精度100等に置き換えない。
    const naturalness = records
      .map((r) => r.naturalnessScore)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (naturalness.length > 0) {
      task.metrics.naturalnessScore = naturalness.reduce((a, v) => a + v, 0) / naturalness.length;
    }
  }

  /**
   * 移管ステータスの更新（昇格・降格・ロールバック）
   */
  public updateStatus(taskId: string, newStatus: LlmMigrationStatus, reason: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const oldStatus = task.status;
    if (newStatus === 'LLM_ONLY' || newStatus === 'LLM_FALLBACK_ONLY' || newStatus === 'ROLLBACK_TO_LLM') {
      systemLogger.warn('SELF_IMPROVEMENT', `[第13.3節] ${task.taskName}: ローカル生成LLMは退役済みのため再有効化を拒否`);
      return false;
    }
    const recordCount = task.shadowRecords.length;
    const m = task.metrics;
    const evidenceReady = recordCount >= 10 && m.accuracyScore >= 98 && m.determinismRate >= 99 && m.userCorrectionRate <= 2;
    const limitedReady = recordCount >= 3 && m.accuracyScore >= 95 && m.determinismRate >= 95;
    const safeManualStates: LlmMigrationStatus[] = ['NON_LLM_CANDIDATE', 'SHADOW_COMPARISON'];
    if (newStatus === 'NON_LLM_LIMITED' && !limitedReady) {
      systemLogger.warn('SELF_IMPROVEMENT', `[第13.3節] ${task.taskName}: 実測証拠不足のため NON_LLM_LIMITED への昇格を拒否`);
      return false;
    }
    if (newStatus === 'NON_LLM_DEFAULT' && !evidenceReady) {
      systemLogger.warn('SELF_IMPROVEMENT', `[第13.3節] ${task.taskName}: 実測証拠不足のため NON_LLM_DEFAULT への昇格を拒否 (records=${recordCount}, accuracy=${m.accuracyScore.toFixed(1)}, deterministic=${m.determinismRate.toFixed(1)})`);
      return false;
    }
    if (!safeManualStates.includes(newStatus) && newStatus !== 'NON_LLM_LIMITED' && newStatus !== 'NON_LLM_DEFAULT') {
      return false;
    }
    task.status = newStatus;
    task.lastEvaluatedAt = Date.now();
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔄 [第13.3節 移管ステータス変更] ${task.taskName}: ${oldStatus} ➔ ${newStatus} (理由: ${reason})`
    );
    return true;
  }


  /**
   * 13.3の証拠だけから、次に許される移管状態を判定する。
   * 自動でステータスを書き換えず、「証拠が揃ったか」と「不足条件」を返す。
   */
  public evaluatePromotion(taskId: string): {
    taskId: string;
    currentStatus: LlmMigrationStatus;
    recommendedStatus: LlmMigrationStatus;
    promotable: boolean;
    evidence: {
      recordCount: number;
      accuracyScore: number;
      determinismRate: number;
      userCorrectionRate: number;
      naturalnessMeasured: boolean;
    };
    missing: string[];
  } | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const recordCount = task.shadowRecords.length;
    const m = task.metrics;
    const missing: string[] = [];
    if (recordCount < 3) missing.push('シャドー比較を最低3件実測');
    if (m.accuracyScore < 95) missing.push('意味一致率95%以上');
    if (m.determinismRate < 95) missing.push('決定性95%以上');

    const limitedReady = missing.length === 0;
    const defaultMissing = [...missing];
    if (recordCount < 10) defaultMissing.push('NON_LLM_DEFAULTにはシャドー比較10件以上');
    if (m.accuracyScore < 98) defaultMissing.push('NON_LLM_DEFAULTには意味一致率98%以上');
    if (m.determinismRate < 99) defaultMissing.push('NON_LLM_DEFAULTには決定性99%以上');
    if (m.userCorrectionRate > 2) defaultMissing.push('NON_LLM_DEFAULTにはユーザー訂正率2%以下');

    const defaultReady = defaultMissing.length === 0;
    return {
      taskId,
      currentStatus: task.status,
      recommendedStatus: defaultReady ? 'NON_LLM_DEFAULT' : limitedReady ? 'NON_LLM_LIMITED' : 'SHADOW_COMPARISON',
      promotable: defaultReady,
      evidence: {
        recordCount,
        accuracyScore: m.accuracyScore,
        determinismRate: m.determinismRate,
        userCorrectionRate: m.userCorrectionRate,
        naturalnessMeasured: task.shadowRecords.some((r) => typeof r.naturalnessScore === 'number'),
      },
      missing: defaultReady ? [] : defaultMissing,
    };
  }

  /**
   * 新規の移管タスク定義を追加
   */
  public registerNewTask(task: Omit<LlmMigrationTask, 'metrics' | 'shadowRecords' | 'lastEvaluatedAt'>): LlmMigrationTask {
    const fullTask: LlmMigrationTask = {
      ...task,
      metrics: {
        latencyReductionRatio: 0,
        ramReductionMb: 0,
        accuracyScore: 0,
        naturalnessScore: 0,
        determinismRate: 0,
        userCorrectionRate: 0,
      },
      shadowRecords: [],
      lastEvaluatedAt: Date.now(),
    };

    this.tasks.set(fullTask.taskId, fullTask);
    this.saveToStorage();
    return fullTask;
  }
}

export const llmMigrationProtocolService = LlmMigrationProtocolService.getInstance();

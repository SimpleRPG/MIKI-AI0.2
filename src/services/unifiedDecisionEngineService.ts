import {
  UserContextProfileType,
  UserContextProfile,
  ReductionIntelligenceCategory,
  DecisionDelayCheckpoint,
  DecisionFailureCause,
  UnifiedDecisionRecord,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const DECISIONS_STORAGE_KEY = 'miki_unified_decisions_v1';

/**
 * 8.2 状況別ユーザー優先順位 既定プロファイルカタログ
 */
export const CONTEXT_PROFILES: Record<UserContextProfileType, UserContextProfile> = {
  casual_chat: {
    profileType: 'casual_chat',
    name: '雑談・日常相談',
    priorities: {
      safetyFirst: 40,
      speedPriority: 85,
      verbosity: 'concise',
      askConfirmationPolicy: 'ask_only_when_blocking',
      preferLocalExecution: true,
    },
  },
  technical_research: {
    profileType: 'technical_research',
    name: '技術調査・仕様調査',
    priorities: {
      safetyFirst: 80,
      speedPriority: 40,
      verbosity: 'detailed',
      askConfirmationPolicy: 'ask_only_when_blocking',
      preferLocalExecution: false,
    },
  },
  code_design: {
    profileType: 'code_design',
    name: '設計検討・アーキテクチャ',
    priorities: {
      safetyFirst: 75,
      speedPriority: 50,
      verbosity: 'balanced',
      askConfirmationPolicy: 'ask_only_when_blocking',
      preferLocalExecution: true,
    },
  },
  code_delivery: {
    profileType: 'code_delivery',
    name: '納品・コード生成',
    priorities: {
      safetyFirst: 95,
      speedPriority: 30,
      verbosity: 'balanced',
      askConfirmationPolicy: 'always_confirm',
      preferLocalExecution: true,
    },
  },
  background_learning: {
    profileType: 'background_learning',
    name: '自律・バックグラウンド学習',
    priorities: {
      safetyFirst: 90,
      speedPriority: 20,
      verbosity: 'concise',
      askConfirmationPolicy: 'autonomous',
      preferLocalExecution: true,
    },
  },
  troubleshooting: {
    profileType: 'troubleshooting',
    name: '障害調査・不具合特定',
    priorities: {
      safetyFirst: 85,
      speedPriority: 70,
      verbosity: 'detailed',
      askConfirmationPolicy: 'ask_only_when_blocking',
      preferLocalExecution: true,
    },
  },
  data_migration: {
    profileType: 'data_migration',
    name: 'データ移行・構造変更',
    priorities: {
      safetyFirst: 100,
      speedPriority: 15,
      verbosity: 'detailed',
      askConfirmationPolicy: 'always_confirm',
      preferLocalExecution: true,
    },
  },
  emergency_recovery: {
    profileType: 'emergency_recovery',
    name: '緊急復旧・ロールバック',
    priorities: {
      safetyFirst: 95,
      speedPriority: 90,
      verbosity: 'concise',
      askConfirmationPolicy: 'always_confirm',
      preferLocalExecution: true,
    },
  },
};

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書(統合版) 第8章
 * 判断・意思決定エンジン
 * 
 * - 8.2 状況別ユーザー優先順位 (8プロファイルと5段階階層規則)
 * - 8.4 判断結果の遅延評価と後悔学習
 * - 8.5 削減知能 (機能追加抑制)
 */
export class UnifiedDecisionEngineService {
  private static instance: UnifiedDecisionEngineService;
  private decisions: Map<string, UnifiedDecisionRecord> = new Map();
  private activeProfile: UserContextProfileType = 'code_design';
  private projectPolicy?: string;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): UnifiedDecisionEngineService {
    if (!UnifiedDecisionEngineService.instance) {
      UnifiedDecisionEngineService.instance = new UnifiedDecisionEngineService();
    }
    return UnifiedDecisionEngineService.instance;
  }

  /**
   * 8.2 状況プロファイルの自動推論または明示切替
   */
  public inferContextProfile(text: string): UserContextProfileType {
    const t = text.toLowerCase();

    if (/緊急|ロールバック|壊れた|大至急|戻したい|データ消失/.test(t)) {
      return 'emergency_recovery';
    }
    if (/移行|マイグレーション|スキーマ変更|db更新|全件置換/.test(t)) {
      return 'data_migration';
    }
    if (/エラー|バグ|動かない|クラッシュ|不具合|なぜ.*動かない|調査して/.test(t)) {
      return 'troubleshooting';
    }
    if (/納品|本番|完成版|マクロコード|作成して|コード書いて|スクリプト生成/.test(t)) {
      return 'code_delivery';
    }
    if (/設計|アーキテクチャ|構成|部品化|クラス設計|方針/.test(t)) {
      return 'code_design';
    }
    if (/調査|ドキュメント|仕様|公式|比較|最新動向|教えて/.test(t)) {
      return 'technical_research';
    }
    if (/学習|覚えた|自律|バックグラウンド|知識登録/.test(t)) {
      return 'background_learning';
    }

    return 'casual_chat';
  }

  /**
   * 8.5 削減知能(機能追加抑制) の評価判定 (非LLM・決定論的)
   * 「何かを作る」前に、本当に必要かを7段階で判定する
   */
  public evaluateReductionIntelligence(params: {
    requestText: string;
    existingComponentsCount: number;
    hasExistingMatch: boolean;
    complexityScore: number; // 0-100
    hasVerifiedEvidence: boolean;
  }): {
    verdict: ReductionIntelligenceCategory;
    reason: string;
  } {
    const { requestText, hasExistingMatch, complexityScore, hasVerifiedEvidence } = params;

    // 1. 既存部品で組み合わせ可能か
    if (hasExistingMatch) {
      return {
        verdict: 'COMPOSE_EXISTING',
        reason: '既存の検証済み部品の組み合わせで要求を満たせるため、新規コード追加を抑制しCOMPOSEを採用',
      };
    }

    // 2. 根拠不足または仮定段階
    if (!hasVerifiedEvidence && /かも|気がする|たぶん|噂/.test(requestText)) {
      return {
        verdict: 'WAIT_FOR_EVIDENCE',
        reason: '技術的根拠・実測データが不足しているため、実装を行わず証拠収集を優先',
      };
    }

    // 3. 複雑性リスク過大 (スコア80超で新規要望)
    if (complexityScore > 80 && !/必須|絶対|どうしても/.test(requestText)) {
      return {
        verdict: 'REJECT_COMPLEXITY',
        reason: '端末リソースおよび保守複雑性のオーバーヘッドが利点を上回るため、複雑性抑制(REJECT_COMPLEXITY)を適用',
      };
    }

    // 4. ドキュメントや設定のみで充足可能
    if (/ルール|メモ|方針|定義|用語/.test(requestText) && !/プログラム|実装|自動化/.test(requestText)) {
      return {
        verdict: 'DOCUMENT_ONLY',
        reason: 'コード生成ではなく、知識記録・ドキュメント定義として充足',
      };
    }

    // 5. 新規実装
    return {
      verdict: 'IMPLEMENT',
      reason: '既存代替がなく、要求の成立要件・検証要件が明確であるため実装を承認',
    };
  }

  /**
   * 8.1 & 8.2 意思決定の実行と理由・スコープの記録
   */
  public makeDecision(params: {
    topic: string;
    options: { name: string; score: number; pros: string[]; cons: string[] }[];
    explicitInstruction?: string;
    requestText: string;
    complexityScore?: number;
    hasExistingMatch?: boolean;
    hasVerifiedEvidence?: boolean;
  }): UnifiedDecisionRecord {
    const profileType = this.inferContextProfile(params.requestText);
    const profile = CONTEXT_PROFILES[profileType];

    // 8.5 削減知能の評価
    const reduction = this.evaluateReductionIntelligence({
      requestText: params.requestText,
      existingComponentsCount: 10,
      hasExistingMatch: params.hasExistingMatch ?? false,
      complexityScore: params.complexityScore ?? 30,
      hasVerifiedEvidence: params.hasVerifiedEvidence ?? true,
    });

    // 8.1 評価スコア計算 (安全性重み・速度重みをプロファイルから加味)
    const weightedScores: Record<string, number> = {};
    for (const opt of params.options) {
      const base = opt.score;
      const safetyPenalty = opt.cons.some((c) => /リスク|破壊|危険|未検証/.test(c))
        ? (profile.priorities.safetyFirst / 100) * 30
        : 0;
      const speedBonus = opt.pros.some((p) => /高速|即時|軽量/.test(p))
        ? (profile.priorities.speedPriority / 100) * 15
        : 0;
      weightedScores[opt.name] = Math.round(base - safetyPenalty + speedBonus);
    }

    // 最高得点のオプションを選定
    let chosen = params.options[0]?.name || '現状維持';
    let highestScore = -Infinity;
    for (const [name, sc] of Object.entries(weightedScores)) {
      if (sc > highestScore) {
        highestScore = sc;
        chosen = name;
      }
    }

    // 8.2 優先規則第1位: 最新の明示指示がある場合はそれを最優先
    if (params.explicitInstruction) {
      const match = params.options.find((o) => params.explicitInstruction!.includes(o.name));
      if (match) {
        chosen = match.name;
      }
    }

    const decisionId = `DEC-${Date.now().toString(36).toUpperCase()}`;
    const record: UnifiedDecisionRecord = {
      decision_id: decisionId,
      topic: params.topic,
      chosen_option: chosen,
      alternative_options: params.options.map((o) => o.name).filter((n) => n !== chosen),
      evaluation_scores: weightedScores,
      applied_profile: profileType,
      reasons: [
        `状況プロファイル [${profile.name}] に基づく重み付け評価`,
        `削減知能判定: [${reduction.verdict}] (${reduction.reason})`,
        `最高総合適合スコア: ${highestScore}点`,
      ],
      conditions_for_change: [
        'ユーザーから明示的な優先指示があった場合',
        '実測ベンチマークで想定と異なる性能ボトルネックが検出された場合',
      ],
      reduction_verdict: reduction.verdict,
      evaluations: {
        IMMEDIATE: {
          outcome: 'PENDING',
          feedback: '判断を確定したが、結果はまだ評価していない',
          evaluated_at: Date.now(),
        },
      },
      created_at: Date.now(),
    };

    this.decisions.set(decisionId, record);
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `⚖️ [8章 判断確定] ${decisionId}: 『${params.topic}』 ➔ 選択: [${chosen}] (プロファイル: ${profileType}, 削減知能: ${reduction.verdict})`
    );

    return record;
  }

  /**
   * 8.4 判断結果の遅延評価と後悔学習
   */
  public evaluateDelayedOutcome(params: {
    decisionId: string;
    checkpoint: DecisionDelayCheckpoint;
    outcome: 'SUCCESS' | 'SUBOPTIMAL' | 'FAILURE';
    cause?: DecisionFailureCause;
    feedback: string;
  }): boolean {
    const record = this.decisions.get(params.decisionId);
    if (!record) return false;

    if (!record.evaluations) record.evaluations = {};
    record.evaluations[params.checkpoint] = {
      outcome: params.outcome,
      cause: params.cause,
      feedback: params.feedback,
      evaluated_at: Date.now(),
    };

    if (params.outcome === 'FAILURE' || params.outcome === 'SUBOPTIMAL') {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⚠️ [8.4 後悔学習検知] 判断 ${params.decisionId} (${record.topic}) は ${params.checkpoint} で失敗/準最適と評価されました。原因: ${params.cause || '未分類'}`
      );
    }

    this.saveToStorage();
    return true;
  }

  public getDecision(id: string): UnifiedDecisionRecord | undefined {
    return this.decisions.get(id);
  }

  public getAllDecisions(): UnifiedDecisionRecord[] {
    return Array.from(this.decisions.values());
  }

  public getActiveProfile(): UserContextProfile {
    return CONTEXT_PROFILES[this.activeProfile];
  }

  public setActiveProfile(type: UserContextProfileType): void {
    this.activeProfile = type;
  }

  private loadFromStorage(): void {
    try {
      const raw = storageService.getItem(DECISIONS_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const d of data) {
            this.decisions.set(d.decision_id, d);
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  private saveToStorage(): void {
    try {
      storageService.setItem(DECISIONS_STORAGE_KEY, JSON.stringify(Array.from(this.decisions.values())));
    } catch {
      // Ignore
    }
  }
}

export const unifiedDecisionEngineService = UnifiedDecisionEngineService.getInstance();

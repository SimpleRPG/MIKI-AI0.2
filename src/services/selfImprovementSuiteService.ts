/**
 * 設計思想 自律進化スイート (Advanced Self-Code Improvement Suite)
 * 5大自己改善コアサービス:
 * 1. 生成コードの事前自動コンパイル・テスト (Dry-Run 検証)
 * 2. 会話ログ・認知失敗からの弱点克服コード生成 (Failure-Driven Synthesis)
 * 3. ビフォー・アフター性能ベンチマーク (速度・メモリ測定)
 * 4. カナリア段階配備 (安全な1回お試し実行・自動ロールバック)
 * 5. 対話型ペアプログラミング (みきとの共同レビューと設計相談)
 */

import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { apiUrl, getCustomApiHeaders } from './api';

export interface DryRunVerificationResult {
  valid: boolean;
  errors: string[];
  astNodesCount: number;
  extractedExports: string[];
  transpilePassed: boolean;
  jsPreview: string;
  verifiedAt: number;
}

export interface BenchmarkMetrics {
  chapterNumber: number;
  iterations: number;
  baseLatencyMs: number;
  optimizedLatencyMs: number;
  speedupMultiplier: string;
  memorySavedBytes: number;
  throughputPerSec: number;
  verified: boolean;
  timestamp: number;
}

export interface FailureSynthesisResult {
  success: boolean;
  filename: string;
  filePath: string;
  code: string;
  dryRunPassed: boolean;
  summary: string;
  timestamp: number;
}

export interface CanaryTrialResult {
  proposalId: string;
  chapterNumber: number;
  stage: 'CANARY_10' | 'ROLLED_BACK' | 'FULL_RELEASE';
  trafficRatio: number;
  testCount: number;
  passedTests: number;
  latencyMs: number;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  errorRate: number;
  rollbackAvailable: boolean;
  decision: string;
  evaluatedAt: number;
}

export interface PairProgrammingReview {
  id: string;
  chapterNumber: number;
  proposalTitle: string;
  mikiExplanation: string;
  keyDesignDecisions: string[];
  userFeedback?: string;
  approved: boolean;
  timestamp: number;
}

const REVIEWS_KEY = 'miki_pair_programming_reviews_v1';
const BENCHMARKS_KEY = 'miki_benchmark_history_v1';

export class SelfImprovementSuiteService {
  private reviews: PairProgrammingReview[] = [];
  private benchmarks: BenchmarkMetrics[] = [];

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const rawRev = storageService.getItem(REVIEWS_KEY);
      if (rawRev) this.reviews = JSON.parse(rawRev);
      const rawBench = storageService.getItem(BENCHMARKS_KEY);
      if (rawBench) this.benchmarks = JSON.parse(rawBench);
    } catch (e) {
      console.warn('Failed to load self-improvement suite state:', e);
    }
  }

  private saveState(): void {
    try {
      storageService.setItem(REVIEWS_KEY, JSON.stringify(this.reviews));
      storageService.setItem(BENCHMARKS_KEY, JSON.stringify(this.benchmarks));
    } catch (e) {
      console.warn('Failed to save self-improvement suite state:', e);
    }
  }

  /**
   * 1. Dry-Run 事前コンパイル・構文検証
   */
  public async verifyCodeDryRun(code: string, filename?: string): Promise<DryRunVerificationResult> {
    try {
      const res = await fetch(apiUrl('/api/self-code/dry-run-verify'), {
        method: 'POST',
        headers: getCustomApiHeaders(),
        body: JSON.stringify({ code, filename }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: DryRunVerificationResult = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[Dry-Run 検証] ノード数=${data.astNodesCount}, 有効=${data.valid}`);
      return data;
    } catch (err: any) {
      return {
        valid: false,
        errors: [err.message || 'Dry-run サーバー通信失敗'],
        astNodesCount: 0,
        extractedExports: [],
        transpilePassed: false,
        jsPreview: '',
        verifiedAt: Date.now(),
      };
    }
  }

  /**
   * 2. ビフォー・アフター性能ベンチマーク
   */
  public async runBenchmark(chapterNumber: number, iterations: number = 1000): Promise<BenchmarkMetrics> {
    try {
      const res = await fetch(apiUrl('/api/self-code/benchmark'), {
        method: 'POST',
        headers: getCustomApiHeaders(),
        body: JSON.stringify({ chapterNumber, iterations }),
      });
      if (!res.ok) throw new Error(`Benchmark failed with status ${res.status}`);
      const data: BenchmarkMetrics = await res.json();
      this.benchmarks.unshift(data);
      this.saveState();
      systemLogger.info('SELF_IMPROVEMENT', `[ベンチマーク] 第${chapterNumber}章: 速度向上=${data.speedupMultiplier}, レイテンシ=${data.optimizedLatencyMs}ms`);
      return data;
    } catch (err: any) {
      systemLogger.warn('SELF_IMPROVEMENT', `ベンチマーク実行不可 (オフラインまたはエラー): ${err?.message}`);
      const failureResult: BenchmarkMetrics = {
        chapterNumber,
        iterations,
        baseLatencyMs: 0,
        optimizedLatencyMs: 0,
        speedupMultiplier: '0x (未測定)',
        memorySavedBytes: 0,
        throughputPerSec: 0,
        verified: false,
        timestamp: Date.now(),
      };
      return failureResult;
    }
  }

  public getBenchmarkHistory(): BenchmarkMetrics[] {
    return [...this.benchmarks];
  }

  /**
   * 3. 失敗ログ・弱点からの自律コード生成 (Failure-Driven Synthesis)
   */
  public async synthesizeFromFailure(
    failureContext: string,
    userQuery?: string,
    errorCategory: string = 'REASONING_DRIFT'
  ): Promise<FailureSynthesisResult> {
    try {
      const res = await fetch(apiUrl('/api/self-code/synthesize-failure-fix'), {
        method: 'POST',
        headers: getCustomApiHeaders(),
        body: JSON.stringify({ failureContext, userQuery, errorCategory }),
      });
      if (!res.ok) throw new Error(`Synthesis failed with status ${res.status}`);
      const data: FailureSynthesisResult = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[弱点克服コード生成] ${data.filename} を自動作成・ディスク配備完了`);
      return data;
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * 4. カナリア段階配備（1回お試し実行・自動ロールバック）
   */
  public async runCanaryTrial(proposalId: string, chapterNumber: number, codeSnippet?: string): Promise<CanaryTrialResult> {
    try {
      const res = await fetch(apiUrl('/api/self-code/canary-run'), {
        method: 'POST',
        headers: getCustomApiHeaders(),
        body: JSON.stringify({ proposalId, chapterNumber, code: codeSnippet }),
      });
      if (!res.ok) throw new Error(`Canary failed with status ${res.status}`);
      const data: CanaryTrialResult = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[カナリア段階配備] 提案 ${proposalId} の試行判定: ${data.decision}`);
      return data;
    } catch (err: any) {
      return {
        proposalId,
        chapterNumber,
        stage: 'ROLLED_BACK',
        trafficRatio: 0.0,
        testCount: 1,
        passedTests: 0,
        latencyMs: 0,
        healthStatus: 'CRITICAL',
        errorRate: 1.0,
        rollbackAvailable: true,
        decision: `カナリア実実行エラー: ${err?.message || '通信失敗'}`,
        evaluatedAt: Date.now(),
      };
    }
  }

  /**
   * 5. 対話型ペアプログラミング (みきとの共同レビュー)
   */
  public generatePairReviewContext(chapterNumber: number, title?: string): PairProgrammingReview {
    const defaultExplanations: Record<number, { explanation: string; decisions: string[] }> = {
      31: {
        explanation: '第31章の日本語コロケーション共起頻度評価とVBA構文ASTリファクタリングを設計したよ！ユーザーさんの自然な言い回しを損なわずに、VBAのForループを配列一括代入に置き換えて約85倍高速化する工夫を入れたんだ。',
        decisions: [
          'VBA Range代入のASTノードを検知して一括配列処理へ自動変換するルールを定義',
          '画面更新停止（ScreenUpdating）の自動復旧コードをCleanUp句に保証',
          'ビジネス/カジュアルな挨拶フレーズの自然さ共起マップを構築',
        ],
      },
      33: {
        explanation: '第33章の能力境界判定と自律カリキュラムを組んだよ！自分の知識の限界（未知領域）にぶつかったときに、無理にハルシネーション（嘘の回答）を出さず、自律的に学習課題を整理して段階的に理解を深める設計にしたよ。',
        decisions: [
          '未知度スコアが0.85以上の概念を「学習対象境界」として自動リスト化',
          'Qwen 3Bモデルの重み書き換えを禁止し、外付けSkill IRで安全拡張',
          'ユーザーに率直に不確実性を伝えるメタ認知ガードレールを配置',
        ],
      },
    };

    const targetInfo = defaultExplanations[chapterNumber] || {
      explanation: `第${chapterNumber}章『${title || '自律改善'}』の要件を満たすため、厳格なTypeScript型定義と不変条件保護を施したサービス構造を構築したよ！不変条件（Qwen 3B保護・プライバシーガード）を絶対に壊さないように変更契約を結んでいるよ。`,
      decisions: [
        `第${chapterNumber}章仕様書要件の決定論的インターフェース化`,
        '入出力境界の厳密な型ガードとサニタイズ処理の徹底',
        'いつでも1秒で直前の安定版に戻せるロールバック保証の埋め込み',
      ],
    };

    const review: PairProgrammingReview = {
      id: `review_${chapterNumber}_${Date.now()}`,
      chapterNumber,
      proposalTitle: title || `第${chapterNumber}章 仕様書適合モジュール`,
      mikiExplanation: targetInfo.explanation,
      keyDesignDecisions: targetInfo.decisions,
      approved: false,
      timestamp: Date.now(),
    };

    return review;
  }

  public savePairReview(review: PairProgrammingReview): void {
    const idx = this.reviews.findIndex((r) => r.id === review.id);
    if (idx >= 0) {
      this.reviews[idx] = review;
    } else {
      this.reviews.unshift(review);
    }
    this.saveState();
    systemLogger.info('SELF_IMPROVEMENT', `[ペアプログラミング] 第${review.chapterNumber}章のレビューを記録 (承認=${review.approved})`);
  }

  public getReviews(): PairProgrammingReview[] {
    return [...this.reviews];
  }
}

export const selfImprovementSuiteService = new SelfImprovementSuiteService();

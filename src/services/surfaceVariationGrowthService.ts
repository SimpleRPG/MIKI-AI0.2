/**
 * 設計思想 19.2節「同じ定型文の反復を抑える」＆ v18 横(言い回し)の自動成長エンジン
 *
 * 1. 弱点検出: RecentUsageCacheの使用履歴・プール枯渇圧力を評価し、候補プールが小さい/使用過多なカテゴリを特定
 * 2. 候補生成: 既存の変種から意味を変えずに言い回しだけを変えた候補を機械的に生成 (既存規則の再利用)
 * 3. 検証: answerContentIrService.verifySemanticPreservation & 文法検査器に通し、意味・条件・否定・文法の保持を厳格判定 (不合格なら破棄)
 * 4. 昇格: CANDIDATE -> VERIFIED 状態遷移を経て正式プールへ登録 (1サイクルの昇格上限ガード付き)
 */

import { systemLogger } from './systemLogger';
import { surfaceVariationService } from './surfaceVariationService';
import { VariationItem } from './surfaceVariationData';
import { surfaceGrammarAndStyleService } from './surfaceGrammarAndStyleService';
import { answerContentIrService } from './answerContentIrService';
import { AnswerContentIR } from '../types';
import { bannedTopicsConfigService } from './bannedTopicsConfigService';
import { WebExtractedSurfacePattern, isRealDataProvider } from './webMaterialPatternExtractor';

export interface VariationCandidateRecord {
  id: string;
  categoryKey: string;
  seedText: string;
  candidateText: string;
  mutationType:
    | 'CONJUGATION_SHIFT'
    | 'CONNECTOR_SYNONYM'
    | 'POLITENESS_FLIP'
    | 'WORD_ORDER_SHIFT'
    | 'DEFECTIVE_PROBE'
    | 'WEB_DERIVED';
  status: 'CANDIDATE' | 'VERIFIED' | 'REJECTED';
  verification: {
    semanticPreserved: boolean;
    missingOrDistorted: string[];
    grammarClean: boolean;
    grammarIssues: string[];
    rejectionReason?: string;
  };
  sourceProvenance?: {
    query?: string;
    url?: string;
    extractedAt?: number;
    fragment?: string;
  };
  createdAt: number;
}

export interface VariationGrowthReport {
  cycleId: string;
  weaknessDetected: string[];
  totalGenerated: number;
  passedCount: number;
  rejectedCount: number;
  promotedCount: number;
  rejectionReasons: Array<{ candidateText: string; reason: string }>;
  promotedItems: Array<{ categoryKey: string; id: string; text: string }>;
  summary: string;
}

export class SurfaceVariationGrowthService {
  private static instance: SurfaceVariationGrowthService;

  /** 候補ログ・監査台帳 */
  private candidateRecords: VariationCandidateRecord[] = [];

  public static getInstance(): SurfaceVariationGrowthService {
    if (!SurfaceVariationGrowthService.instance) {
      SurfaceVariationGrowthService.instance = new SurfaceVariationGrowthService();
    }
    return SurfaceVariationGrowthService.instance;
  }

  /**
   * 1. 弱点検出
   * RecentUsageCache の使用履歴とプール規模を評価し、枯渇圧力（反復リスク）が高いカテゴリを検出
   */
  public detectWeaknessCategories(limit: number = 3): Array<{ categoryKey: string; pressureScore: number; reason: string }> {
    const summary = surfaceVariationService.getAllCategoriesSummary();

    const scored = summary.map((cat) => {
      // 履歴長 / プール規模 または 使用回数 / プール規模
      const history = surfaceVariationService.getCache().getHistory(cat.categoryKey);
      const usageCount = cat.usageCount;
      const totalPool = Math.max(1, cat.totalCount);

      // 圧迫度スコア: 使用回数が多く、総プールに対する履歴占有率が高いほどスコア大
      const saturationRatio = history.length / totalPool;
      const pressureScore = usageCount * 1.5 + saturationRatio * 10 + (30 / totalPool);

      return {
        categoryKey: cat.categoryKey,
        pressureScore,
        reason: `プール数:${totalPool}, 直近使用履歴:${history.length}, 累積使用:${usageCount}`,
      };
    });

    // 圧力スコア降順
    scored.sort((a, b) => b.pressureScore - a.pressureScore);
    return scored.slice(0, limit);
  }

  /**
   * 2. 候補生成
   * 既存の変種から意味を変えずに言い回しを変えた候補を生成
   * ※ 意図的な欠陥プローブ（否定脱落や助詞重複、過度断定など）も混入させ、検証器の厳格さを担保
   */
  public generateMutations(
    categoryKey: string,
    seedItem: VariationItem
  ): Array<{ candidateText: string; mutationType: VariationCandidateRecord['mutationType'] }> {
    const text = seedItem.text;
    const candidates: Array<{ candidateText: string; mutationType: VariationCandidateRecord['mutationType'] }> = [];

    // パターン A: 語尾・親和表現の変換 (丁寧語 ⇔ 親しみ語, 〜だよ ⇔ 〜ね / 〜ですよ)
    if (text.endsWith('だよ。') || text.endsWith('だよ！') || text.endsWith('だよ')) {
      candidates.push({
        candidateText: text.replace(/だよ[。！]?$/, 'ね！'),
        mutationType: 'CONJUGATION_SHIFT',
      });
      candidates.push({
        candidateText: text.replace(/だよ[。！]?$/, 'ですよ。'),
        mutationType: 'POLITENESS_FLIP',
      });
    } else if (text.endsWith('ね！') || text.endsWith('ね。') || text.endsWith('ね')) {
      candidates.push({
        candidateText: text.replace(/ね[。！]?$/, 'だよ！'),
        mutationType: 'CONJUGATION_SHIFT',
      });
      candidates.push({
        candidateText: text.replace(/ね[。！]?$/, 'ですね。'),
        mutationType: 'POLITENESS_FLIP',
      });
    } else if (text.endsWith('です。') || text.endsWith('ます。')) {
      candidates.push({
        candidateText: text.replace(/です。$/, 'だよ。').replace(/ます。$/, 'るよ。'),
        mutationType: 'POLITENESS_FLIP',
      });
    }

    // パターン B: 接続詞・前提表現の同義語置換
    const synonymMap: [RegExp, string][] = [
      [/結論から言うと[、,]/g, '結論として、'],
      [/結論として[、,]/g, '端的に整理すると、'],
      [/至急確認/g, '最優先の確認事項として'],
      [/原因として/g, '発生原因の分析として'],
      [/前提条件として/g, '成立のための前提として'],
      [/さらに[、,]/g, '加えて、'],
      [/加えて[、,]/g, 'その上で、'],
      [/したがって[、,]/g, 'そのため、'],
      [/確認してみてね/g, 'チェックしてみよう'],
      [/共有するね/g, 'お知らせするよ'],
      [/整理したよ/g, 'まとめたよ'],
    ];

    for (const [pattern, replacement] of synonymMap) {
      if (pattern.test(text)) {
        const mutated = text.replace(pattern, replacement);
        if (mutated !== text) {
          candidates.push({
            candidateText: mutated,
            mutationType: 'CONNECTOR_SYNONYM',
          });
        }
      }
    }

    // パターン C: 検証器の選別能力を実証するための意図的欠陥プローブ (不適格候補)
    // 1. 否定語の脱落・反転テスト
    if (/ない|不要|できない|除外|回避/.test(text)) {
      candidates.push({
        candidateText: text.replace(/できない/g, 'できる').replace(/不要/g, '必要').replace(/ない/g, 'ある'),
        mutationType: 'DEFECTIVE_PROBE',
      });
    } else {
      // 否定がなければ過度断定（100%絶対）の不当混入テスト
      candidates.push({
        candidateText: `絶対に100%確実です！${text}`,
        mutationType: 'DEFECTIVE_PROBE',
      });
    }

    // 2. 助詞破綻テスト (「をを」「についてについて」の混入)
    if (text.includes('を') || text.includes('について')) {
      candidates.push({
        candidateText: text.replace(/を/g, 'をを').replace(/について/g, 'についてについて'),
        mutationType: 'DEFECTIVE_PROBE',
      });
    }

    // 重複除去 & シードと同一のものは除外
    const seen = new Set<string>([text]);
    return candidates.filter((c) => {
      if (seen.has(c.candidateText)) return false;
      seen.add(c.candidateText);
      return true;
    });
  }

  /**
   * 3. 検証
   * answerContentIrService.verifySemanticPreservation & 文法・助詞検査器で厳格判定
   */
  public verifyCandidate(
    seedText: string,
    candidateText: string
  ): {
    passed: boolean;
    semanticPreserved: boolean;
    missingOrDistorted: string[];
    grammarClean: boolean;
    grammarIssues: string[];
    rejectionReason?: string;
  } {
    // 3.1 意味保持検証 (verifySemanticPreservation)
    // シード文を正解IRとして構築し、候補文との意味保持性を評価
    const hasCondition = /前提|場合|条件|なら|時/.test(seedText);
    const hasNegation = /ない|不要|できない|除外|回避|禁止/.test(seedText);
    const isFactCertain = /確実|絶対|100%/.test(seedText);

    const testIr: AnswerContentIR = {
      ir_id: `verify-${Date.now()}`,
      conclusion: seedText,
      reasons: [],
      conditions: hasCondition ? ['前提条件の維持'] : [],
      exceptions: [],
      certainty: isFactCertain ? 'CERTAIN' : 'CONDITIONAL',
      target: 'user',
      next_actions: [],
      detail_level: 'STANDARD',
      interaction_mode: 'NORMAL',
      world_scope: 'REAL',
    };

    const irCheck = answerContentIrService.verifySemanticPreservation(testIr, candidateText);
    const missingOrDistorted = [...irCheck.missingOrDistortedElements];

    // 否定反転の特別検知
    const candidateHasNegation = /ない|不要|できない|除外|回避|禁止/.test(candidateText);
    if (hasNegation && !candidateHasNegation) {
      missingOrDistorted.push('【意味破綻】元文の否定・制約要素が脱落し肯定化されています');
    }

    // 確実性の不当誇張検知
    if (!isFactCertain && /絶対に|100%|確実/i.test(candidateText)) {
      missingOrDistorted.push('【確実性誇張】根拠なく絶対・100%断定を付与しています');
    }

    const semanticPreserved = irCheck.isPreserved && missingOrDistorted.length === 0;

    // 3.2 文法・助詞破綻検査 (surfaceGrammarAndStyleService)
    const conjCheck = surfaceGrammarAndStyleService.detectConjugationDisruption(candidateText);
    const partCheck = surfaceGrammarAndStyleService.detectParticleDisruption(candidateText);

    const grammarIssues = [...conjCheck.issues, ...partCheck.issues];
    const grammarClean = !conjCheck.hasError && !partCheck.hasError;

    // 3.3 長さ・文字欠落検査
    let lengthOk = candidateText.length >= 6 && candidateText !== seedText;
    if (!lengthOk) {
      grammarIssues.push('【文字長不良】文字数が不足しているか、元文と同一です');
    }

    const passed = semanticPreserved && grammarClean && lengthOk;

    let rejectionReason: string | undefined;
    if (!passed) {
      const reasons: string[] = [];
      if (!semanticPreserved) reasons.push(...missingOrDistorted);
      if (!grammarClean) reasons.push(...grammarIssues);
      if (!lengthOk) reasons.push('文字数不適正');
      rejectionReason = reasons.join('; ');
    }

    return {
      passed,
      semanticPreserved,
      missingOrDistorted,
      grammarClean,
      grammarIssues,
      rejectionReason,
    };
  }

  /**
   * 4. 自律サイクル実行
   * 弱点検出 -> 候補生成 -> 検証 -> CANDIDATE -> VERIFIED 昇格 -> 正式プール登録
   * @param maxPromotions 1サイクルの最大昇格数 (暴走防止: デフォルト2)
   */
  public runAutonomousVariationGrowthCycle(maxPromotions: number = 2): VariationGrowthReport {
    const cycleId = `growth-${Date.now()}`;
    systemLogger.info('SELF_IMPROVEMENT', `[${cycleId}] 🎨 横(言い回し)の自律成長サイクルを開始します...`);

    const weaknesses = this.detectWeaknessCategories(2);
    const weaknessLabels = weaknesses.map((w) => `${w.categoryKey} (${w.reason})`);

    let totalGenerated = 0;
    let passedCount = 0;
    let rejectedCount = 0;
    let promotedCount = 0;

    const rejectionReasons: Array<{ candidateText: string; reason: string }> = [];
    const promotedItems: Array<{ categoryKey: string; id: string; text: string }> = [];

    const categoriesSummary = surfaceVariationService.getAllCategoriesSummary();

    for (const weakness of weaknesses) {
      if (promotedCount >= maxPromotions) break;

      const catInfo = categoriesSummary.find((c) => c.categoryKey === weakness.categoryKey);
      if (!catInfo || catInfo.samplePool.length === 0) continue;

      // 既存プールからランダムにシードアイテムを選択
      const seedIndex = Math.floor(Math.random() * catInfo.samplePool.length);
      const seedItem = catInfo.samplePool[seedIndex];

      // 候補を生成
      const mutations = this.generateMutations(weakness.categoryKey, seedItem);
      totalGenerated += mutations.length;

      for (const mut of mutations) {
        // 検証実行
        const vResult = this.verifyCandidate(seedItem.text, mut.candidateText);

        const candidateId = `VAR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const record: VariationCandidateRecord = {
          id: candidateId,
          categoryKey: weakness.categoryKey,
          seedText: seedItem.text,
          candidateText: mut.candidateText,
          mutationType: mut.mutationType,
          status: vResult.passed ? 'CANDIDATE' : 'REJECTED',
          verification: {
            semanticPreserved: vResult.semanticPreserved,
            missingOrDistorted: vResult.missingOrDistorted,
            grammarClean: vResult.grammarClean,
            grammarIssues: vResult.grammarIssues,
            rejectionReason: vResult.rejectionReason,
          },
          createdAt: Date.now(),
        };

        if (vResult.passed) {
          passedCount++;

          // 昇格上限チェック
          if (promotedCount < maxPromotions) {
            // CANDIDATE -> VERIFIED へ昇格し、正式プールへ反映
            record.status = 'VERIFIED';
            surfaceVariationService.registerDynamicVariant(weakness.categoryKey, {
              id: candidateId,
              text: mut.candidateText,
            });

            promotedCount++;
            promotedItems.push({
              categoryKey: weakness.categoryKey,
              id: candidateId,
              text: mut.candidateText,
            });

            systemLogger.info(
              'SELF_IMPROVEMENT',
              `✨ [言い回し正式昇格] ${weakness.categoryKey} に新変種を採用 (id:${candidateId}): 「${mut.candidateText}」`
            );
          }
        } else {
          rejectedCount++;
          rejectionReasons.push({
            candidateText: mut.candidateText,
            reason: vResult.rejectionReason || '検証不合格',
          });

          systemLogger.info(
            'SELF_IMPROVEMENT',
            `🛡️ [言い回し破棄] 意味・文法不適格により候補を破棄: 「${mut.candidateText}」 (理由: ${vResult.rejectionReason})`
          );
        }

        this.candidateRecords.unshift(record);
      }
    }

    // 履歴保持上限 (直近100件)
    if (this.candidateRecords.length > 100) {
      this.candidateRecords = this.candidateRecords.slice(0, 100);
    }

    const summary = `生成:${totalGenerated}件, 合格:${passedCount}件, 不合格破棄:${rejectedCount}件, 正式昇格:${promotedCount}件`;
    systemLogger.info('SELF_IMPROVEMENT', `[${cycleId}] 🏁 横の自律成長サイクル完了: ${summary}`);

    return {
      cycleId,
      weaknessDetected: weaknessLabels,
      totalGenerated,
      passedCount,
      rejectedCount,
      promotedCount,
      rejectionReasons,
      promotedItems,
      summary,
    };
  }

  /**
   * 作業指示書 v19 第1.2節 & 第1.3節:
   * 自律Web検索から取得した自然な言い回しパターンを、弱点カテゴリの同義候補として検証・昇格する
   * - 意味保持検査(verifySemanticPreservation)は今まで通り必須
   * - 文章を丸ごと転用せず、抽象化された言い回しパターンのみを適用
   * - 禁止トピック検査(bannedTopicsConfigService)を経由
   * - 出典記録(sourceProvenance)を残す
   */
  public processWebMaterialForVariationGrowth(
    patterns: WebExtractedSurfacePattern[],
    maxPromotions: number = 1
  ): {
    processedCount: number;
    passedCount: number;
    rejectedCount: number;
    promotedCount: number;
    promotedItems: Array<{ categoryKey: string; id: string; text: string }>;
  } {
    if (!patterns || patterns.length === 0) {
      return { processedCount: 0, passedCount: 0, rejectedCount: 0, promotedCount: 0, promotedItems: [] };
    }

    const weaknesses = this.detectWeaknessCategories(3);
    if (weaknesses.length === 0) {
      return { processedCount: 0, passedCount: 0, rejectedCount: 0, promotedCount: 0, promotedItems: [] };
    }

    const categoriesSummary = surfaceVariationService.getAllCategoriesSummary();
    let processedCount = 0;
    let passedCount = 0;
    let rejectedCount = 0;
    let promotedCount = 0;
    const promotedItems: Array<{ categoryKey: string; id: string; text: string }> = [];

    for (const pattern of patterns) {
      if (promotedCount >= maxPromotions) break;

      // 作業指示書 v21 第2.2節: プロバイダが実データ由来でない場合は候補化せずに破棄
      if (!isRealDataProvider(pattern.provider)) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🛡️ [Web言い回し破棄] プロバイダ「${pattern.provider || 'none'}」は実データではないため、言い回し候補化を破棄しました`
        );
        rejectedCount++;
        continue;
      }

      // 禁止トピック検査 (手動設定リスト参照)
      const bannedCheck = bannedTopicsConfigService.checkBanned(
        `${pattern.abstractedPattern} ${pattern.sourceQuery} ${pattern.originalFragment}`
      );
      if (bannedCheck.isBanned) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🚫 [Web言い回し破棄] 禁止トピック「${bannedCheck.matchedTopic}」に一致したため候補化を中止: 「${pattern.abstractedPattern}」`
        );
        rejectedCount++;
        continue;
      }

      // 最も親和性の高い弱点カテゴリを探索
      let targetCategoryKey = weaknesses[0].categoryKey;
      if (pattern.extractedStyle === 'CONCLUSION_FIRST') {
        const found = weaknesses.find((w) => w.categoryKey.includes('lead') || w.categoryKey.includes('connector'));
        if (found) targetCategoryKey = found.categoryKey;
      } else if (pattern.extractedStyle === 'POLITE' || pattern.extractedStyle === 'CASUAL') {
        const found = weaknesses.find((w) => w.categoryKey.includes('acknowledgement') || w.categoryKey.includes('greeting'));
        if (found) targetCategoryKey = found.categoryKey;
      }

      const catInfo = categoriesSummary.find((c) => c.categoryKey === targetCategoryKey);
      if (!catInfo || catInfo.samplePool.length === 0) continue;

      const seedItem = catInfo.samplePool[0];
      processedCount++;

      // 既存の言い回しの主旨（シード）に合わせてWebの接続詞・語尾スタイルを適用した新候補文を合成
      let candidateText = '';
      if (pattern.connectorPhrase && !seedItem.text.startsWith(pattern.connectorPhrase)) {
        candidateText = `${pattern.connectorPhrase}、${seedItem.text.replace(/^[、,\s]+/, '')}`;
      } else if (pattern.extractedStyle === 'POLITE' && !seedItem.text.endsWith('です。')) {
        candidateText = seedItem.text.replace(/だよ[。！]?$/, 'ですよ。').replace(/ね[。！]?$/, 'ですね。');
      } else if (pattern.extractedStyle === 'CASUAL' && (seedItem.text.endsWith('です。') || seedItem.text.endsWith('ます。'))) {
        candidateText = seedItem.text.replace(/です。$/, 'だよ。').replace(/ます。$/, 'るよ。');
      } else {
        // パターンから抽出された抽象骨組みがそのまま自然な表現の場合
        candidateText = pattern.abstractedPattern || seedItem.text;
      }

      if (!candidateText || typeof candidateText !== 'string') {
        candidateText = seedItem.text;
      }

      // 厳格な意味保持・文法検査 (基準は緩めない)
      const vResult = this.verifyCandidate(seedItem.text, candidateText);
      const candidateId = `VAR-WEB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const record: VariationCandidateRecord = {
        id: candidateId,
        categoryKey: targetCategoryKey,
        seedText: seedItem.text,
        candidateText,
        mutationType: 'WEB_DERIVED',
        status: vResult.passed ? 'CANDIDATE' : 'REJECTED',
        verification: {
          semanticPreserved: vResult.semanticPreserved,
          missingOrDistorted: vResult.missingOrDistorted,
          grammarClean: vResult.grammarClean,
          grammarIssues: vResult.grammarIssues,
          rejectionReason: vResult.rejectionReason,
        },
        sourceProvenance: {
          query: pattern.sourceQuery,
          url: pattern.sourceUrl,
          extractedAt: pattern.extractedAt,
          fragment: pattern.originalFragment,
        },
        createdAt: Date.now(),
      };

      if (vResult.passed) {
        passedCount++;
        if (promotedCount < maxPromotions) {
          record.status = 'VERIFIED';
          surfaceVariationService.registerDynamicVariant(targetCategoryKey, {
            id: candidateId,
            text: candidateText,
            sourceType: 'WEB_OBSERVED',
            sourceProvenance: {
              query: pattern.sourceQuery,
              url: pattern.sourceUrl,
              extractedAt: pattern.extractedAt,
              fragment: pattern.originalFragment,
            },
          });

          promotedCount++;
          promotedItems.push({
            categoryKey: targetCategoryKey,
            id: candidateId,
            text: candidateText,
          });

          systemLogger.info(
            'SELF_IMPROVEMENT',
            `🌐✨ [Web由来言い回し昇格] ${targetCategoryKey} にWeb調査由来の変種を採用 (id:${candidateId}): 「${candidateText}」 (出典: ${pattern.sourceQuery} - ${pattern.sourceUrl})`
          );
        }
      } else {
        rejectedCount++;
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🛡️ [Web由来言い回し破棄] 意味・文法検査不合格により候補を破棄: 「${candidateText}」 (理由: ${vResult.rejectionReason})`
        );
      }

      this.candidateRecords.unshift(record);
    }

    return {
      processedCount,
      passedCount,
      rejectedCount,
      promotedCount,
      promotedItems,
    };
  }

  /** 全監査台帳の取得 */
  public getCandidateRecords(): VariationCandidateRecord[] {
    return [...this.candidateRecords];
  }
}

export const surfaceVariationGrowthService = SurfaceVariationGrowthService.getInstance();

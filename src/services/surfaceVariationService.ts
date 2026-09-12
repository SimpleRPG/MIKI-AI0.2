/**
 * 設計思想 19.2節「同じ定型文の反復を抑える」
 * 非重複選択キャッシュ (RecentUsageCache) & 表層変種選択サービス
 */

import {
  VariationItem,
  SCENE_CONNECTORS_DATA,
  PRUDENCE_NOTES_DATA,
  PROACTIVE_SUGGESTIONS_DATA,
  WARMTH_AND_HUMOR_DATA,
  SECTION_HEADINGS_DEFAULT_DATA,
} from './surfaceVariationData';
import { SKELETON_VARIATIONS_DATA } from './skeletonVariationData';
import { AnswerSkeletonType, MultiAxisPersonaConfig } from '../types';

export class RecentUsageCache {
  private static instance: RecentUsageCache;
  private history: Map<string, string[]> = new Map();

  public static getInstance(): RecentUsageCache {
    if (!RecentUsageCache.instance) {
      RecentUsageCache.instance = new RecentUsageCache();
    }
    return RecentUsageCache.instance;
  }

  /**
   * 直近使用履歴を除外して候補からランダム選択
   * @param categoryKey 部品カテゴリ識別子 (例: 'connector:DISASTER_RECOVERY')
   * @param items 候補プール (30件等)
   * @param maxRecentMemory 記憶する直近履歴件数 (デフォルト10件、またはプール数の1/3)
   */
  public selectNonRepeating<T extends VariationItem>(
    categoryKey: string,
    items: T[],
    maxRecentMemory: number = 10
  ): T {
    if (!items || items.length === 0) {
      throw new Error(`[RecentUsageCache] Empty variation pool for key: ${categoryKey}`);
    }
    if (items.length === 1) return items[0];

    const recent = this.history.get(categoryKey) || [];
    // 直近履歴に含まれていないアイテムを抽出
    let available = items.filter((item) => !recent.includes(item.id));

    // もし直近履歴ですべて埋まってしまった場合は、最も古い履歴を除外して再評価
    if (available.length === 0) {
      available = items;
    }

    // 候補からランダムに1つ選択
    const chosenIndex = Math.floor(Math.random() * available.length);
    const chosen = available[chosenIndex];

    // 履歴更新: 直近maxRecentMemory件（またはプール数の1/3）を維持
    const limit = Math.min(maxRecentMemory, Math.max(1, Math.floor(items.length / 3)));
    const updatedHistory = [...recent.filter((id) => id !== chosen.id), chosen.id].slice(-limit);
    this.history.set(categoryKey, updatedHistory);

    return chosen;
  }

  /** 履歴リセット (テスト・新規セッション用) */
  public clearHistory(): void {
    this.history.clear();
  }

  /** 特定カテゴリの直近選択履歴取得 */
  public getHistory(categoryKey: string): string[] {
    return [...(this.history.get(categoryKey) || [])];
  }
}

export class SurfaceVariationService {
  private static instance: SurfaceVariationService;
  private cache: RecentUsageCache;

  constructor() {
    this.cache = RecentUsageCache.getInstance();
  }

  public static getInstance(): SurfaceVariationService {
    if (!SurfaceVariationService.instance) {
      SurfaceVariationService.instance = new SurfaceVariationService();
    }
    return SurfaceVariationService.instance;
  }

  /**
   * 1. 接続表現の選択 (30種以上から非重複選択)
   */
  public getConnector(
    scene: MultiAxisPersonaConfig['currentScene'],
    directness: MultiAxisPersonaConfig['directness']
  ): VariationItem {
    let key = 'DEFAULT';
    if (scene === 'DISASTER_RECOVERY') key = 'DISASTER_RECOVERY';
    else if (scene === 'ERROR_REPORT') key = 'ERROR_REPORT';
    else if (scene === 'TECHNICAL_RESEARCH') key = 'TECHNICAL_RESEARCH';
    else if (scene === 'CODE_DELIVERY') key = 'CODE_DELIVERY';
    else if (directness === 'HIGH') key = 'HIGH_DIRECTNESS';
    else if (directness === 'LOW') key = 'LOW_DIRECTNESS';

    const pool = SCENE_CONNECTORS_DATA[key] || SCENE_CONNECTORS_DATA.DEFAULT;
    return this.cache.selectNonRepeating(`connector:${key}`, pool);
  }

  /**
   * 2. 慎重さ注記の選択 (30種以上から非重複選択)
   */
  public getPrudenceNote(
    prudence: MultiAxisPersonaConfig['prudence'],
    scene: MultiAxisPersonaConfig['currentScene']
  ): VariationItem | null {
    if (scene === 'SHORT_MODE') return null;
    if (prudence === 'VERY_HIGH') {
      return this.cache.selectNonRepeating('prudence:VERY_HIGH', PRUDENCE_NOTES_DATA.VERY_HIGH);
    }
    if (prudence === 'HIGH') {
      return this.cache.selectNonRepeating('prudence:HIGH', PRUDENCE_NOTES_DATA.HIGH);
    }
    return null;
  }

  /**
   * 3. 積極的提案の選択 (30種以上から非重複選択)
   */
  public getProactiveSuggestion(
    proactive: MultiAxisPersonaConfig['proactiveSuggestion'],
    scene: MultiAxisPersonaConfig['currentScene']
  ): VariationItem | null {
    if (scene === 'SHORT_MODE' || scene === 'DISASTER_RECOVERY' || scene === 'ERROR_REPORT') {
      return null;
    }
    if (proactive === 'ACTIVE') {
      return this.cache.selectNonRepeating('proactive:ACTIVE', PROACTIVE_SUGGESTIONS_DATA.ACTIVE);
    }
    if (proactive === 'MODERATE') {
      return this.cache.selectNonRepeating('proactive:MODERATE', PROACTIVE_SUGGESTIONS_DATA.MODERATE);
    }
    return null;
  }

  /**
   * 4. ユーモア・温かみ結び表現の選択 (30種以上から非重複選択)
   */
  public getHumorLine(humor: MultiAxisPersonaConfig['humor']): VariationItem | null {
    if (humor === 'MODERATE') {
      return this.cache.selectNonRepeating('humor:MODERATE', WARMTH_AND_HUMOR_DATA.HUMOR_MODERATE);
    }
    if (humor === 'LIGHT') {
      return this.cache.selectNonRepeating('humor:LIGHT', WARMTH_AND_HUMOR_DATA.HUMOR_LIGHT);
    }
    return null;
  }

  public getWarmthClosing(politeness: MultiAxisPersonaConfig['politeness']): VariationItem {
    if (politeness === 'CASUAL') {
      return this.cache.selectNonRepeating('warmth:HIGH_CASUAL', WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_CASUAL);
    }
    return this.cache.selectNonRepeating('warmth:HIGH_POLITE', WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_POLITE);
  }

  /**
   * 5. 見出しラベルの選択 (デフォルト分岐 5キー × 各30種以上から非重複選択)
   * ※ 4つのシーン別見出しは次回以降のスコープ外
   */
  public getSectionHeadings(
    skeleton: AnswerSkeletonType,
    scene: MultiAxisPersonaConfig['currentScene']
  ): {
    conclusion: string;
    reasons: string;
    conditions: string;
    exceptions: string;
    nextActions: string;
  } {
    // 4つのシーン別見出し (DISASTER_RECOVERY等) は規定の固定見出しを優先 (指示書 1.1 より)
    if (scene === 'DISASTER_RECOVERY') {
      return {
        conclusion: '【緊急対処手順】',
        reasons: '【障害の直接要因】',
        conditions: '【復旧の成立条件】',
        exceptions: '【現時点で確認済みの影響・二次被害】',
        nextActions: '【直ちに実行すべき復旧確認】',
      };
    }
    if (scene === 'ERROR_REPORT') {
      return {
        conclusion: '【エラー診断結果】',
        reasons: '【エラー発生原因】',
        conditions: '【再現・回避条件】',
        exceptions: '【例外的な発生パターン】',
        nextActions: '【推奨する解消ステップ】',
      };
    }
    if (scene === 'TECHNICAL_RESEARCH') {
      return {
        conclusion: '【技術調査結論】',
        reasons: '【技術的根拠・仕様】',
        conditions: '【適用制約・依存環境】',
        exceptions: '【技術的例外・未検証事項】',
        nextActions: '【次の検証・ベンチマーク】',
      };
    }
    if (scene === 'CODE_DELIVERY') {
      return {
        conclusion: '【納品仕様・実装概要】',
        reasons: '【設計採用理由】',
        conditions: '【稼働環境および前提条件】',
        exceptions: '【仕様上の制限事項】',
        nextActions: '【納品後の確認・受入れテスト】',
      };
    }

    // デフォルト分岐 (NORMAL, SHORT_MODE, DETAILED_MODE): 30種以上のプールから非重複選択
    const cItem = this.cache.selectNonRepeating(
      `heading:conclusion:${skeleton}`,
      SECTION_HEADINGS_DEFAULT_DATA.conclusion
    );
    const rItem = this.cache.selectNonRepeating(
      `heading:reasons:${skeleton}`,
      SECTION_HEADINGS_DEFAULT_DATA.reasons
    );
    const cdItem = this.cache.selectNonRepeating(
      `heading:conditions:${skeleton}`,
      SECTION_HEADINGS_DEFAULT_DATA.conditions
    );
    const exItem = this.cache.selectNonRepeating(
      `heading:exceptions:${skeleton}`,
      SECTION_HEADINGS_DEFAULT_DATA.exceptions
    );
    const naItem = this.cache.selectNonRepeating(
      `heading:nextActions:${skeleton}`,
      SECTION_HEADINGS_DEFAULT_DATA.nextActions
    );

    return {
      conclusion: cItem.text,
      reasons: rItem.text,
      conditions: cdItem.text,
      exceptions: exItem.text,
      nextActions: naItem.text,
    };
  }

  /**
   * 6. INITIAL_SKELETONS 7パターンのバリエーション選択 (各30種以上から非重複選択)
   */
  public getSkeletonResponseTemplate(patternId: string): VariationItem | null {
    const pool = SKELETON_VARIATIONS_DATA[patternId];
    if (!pool || pool.length === 0) return null;
    return this.cache.selectNonRepeating(`skeleton:${patternId}`, pool);
  }

  public getCache(): RecentUsageCache {
    return this.cache;
  }
}

export const surfaceVariationService = SurfaceVariationService.getInstance();

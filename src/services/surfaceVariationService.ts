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
  private cumulativeCounts: Map<string, number> = new Map();

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

    // 累積使用回数のカウントアップ
    const currentCount = this.cumulativeCounts.get(categoryKey) || 0;
    this.cumulativeCounts.set(categoryKey, currentCount + 1);

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
    this.cumulativeCounts.clear();
  }

  /** 特定カテゴリの直近選択履歴取得 */
  public getHistory(categoryKey: string): string[] {
    return [...(this.history.get(categoryKey) || [])];
  }

  /** 特定カテゴリの累積使用回数取得 */
  public getUsageCount(categoryKey: string): number {
    return this.cumulativeCounts.get(categoryKey) || 0;
  }

  /** 全追跡中カテゴリキーの取得 */
  public getAllCategoryKeys(): string[] {
    const keys = new Set<string>([
      ...Array.from(this.history.keys()),
      ...Array.from(this.cumulativeCounts.keys()),
    ]);
    return Array.from(keys);
  }

  /** 手動での使用記録 */
  public recordUsage(categoryKey: string, itemId: string): void {
    const currentCount = this.cumulativeCounts.get(categoryKey) || 0;
    this.cumulativeCounts.set(categoryKey, currentCount + 1);
    const recent = this.history.get(categoryKey) || [];
    const updated = [...recent.filter((id) => id !== itemId), itemId].slice(-10);
    this.history.set(categoryKey, updated);
  }
}

export class SurfaceVariationService {
  private static instance: SurfaceVariationService;
  private cache: RecentUsageCache;
  private dynamicVariations: Map<string, VariationItem[]> = new Map();

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
   * 使用履歴の記録（キャッシュへの委譲）
   */
  public recordUsage(categoryKey: string, itemId: string): void {
    this.cache.recordUsage(categoryKey, itemId);
  }

  /**
   * 動的バリエーション（VERIFIED昇格済み）の登録
   */
  public registerDynamicVariant(categoryKey: string, item: VariationItem): void {
    const list = this.dynamicVariations.get(categoryKey) || [];
    if (!list.some((x) => x.id === item.id || x.text === item.text)) {
      list.push(item);
      this.dynamicVariations.set(categoryKey, list);
    }
  }

  /** 動的バリエーションの取得 */
  public getDynamicVariants(categoryKey: string): VariationItem[] {
    return [...(this.dynamicVariations.get(categoryKey) || [])];
  }

  /** 静的＋動的のマージプール取得 */
  public getMergedPool(categoryKey: string, staticPool: VariationItem[]): VariationItem[] {
    const dynamic = this.dynamicVariations.get(categoryKey) || [];
    if (dynamic.length === 0) return staticPool;
    return [...staticPool, ...dynamic];
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

    const categoryKey = `connector:${key}`;
    const base = SCENE_CONNECTORS_DATA[key] || SCENE_CONNECTORS_DATA.DEFAULT;
    const pool = this.getMergedPool(categoryKey, base);
    return this.cache.selectNonRepeating(categoryKey, pool);
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
      const categoryKey = 'prudence:VERY_HIGH';
      const pool = this.getMergedPool(categoryKey, PRUDENCE_NOTES_DATA.VERY_HIGH);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    if (prudence === 'HIGH') {
      const categoryKey = 'prudence:HIGH';
      const pool = this.getMergedPool(categoryKey, PRUDENCE_NOTES_DATA.HIGH);
      return this.cache.selectNonRepeating(categoryKey, pool);
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
      const categoryKey = 'proactive:ACTIVE';
      const pool = this.getMergedPool(categoryKey, PROACTIVE_SUGGESTIONS_DATA.ACTIVE);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    if (proactive === 'MODERATE') {
      const categoryKey = 'proactive:MODERATE';
      const pool = this.getMergedPool(categoryKey, PROACTIVE_SUGGESTIONS_DATA.MODERATE);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    return null;
  }

  /**
   * 4. ユーモア・温かみ結び表現の選択 (30種以上から非重複選択)
   */
  public getHumorLine(humor: MultiAxisPersonaConfig['humor']): VariationItem | null {
    if (humor === 'MODERATE') {
      const categoryKey = 'humor:MODERATE';
      const pool = this.getMergedPool(categoryKey, WARMTH_AND_HUMOR_DATA.HUMOR_MODERATE);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    if (humor === 'LIGHT') {
      const categoryKey = 'humor:LIGHT';
      const pool = this.getMergedPool(categoryKey, WARMTH_AND_HUMOR_DATA.HUMOR_LIGHT);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    return null;
  }

  public getWarmthClosing(politeness: MultiAxisPersonaConfig['politeness']): VariationItem {
    if (politeness === 'CASUAL') {
      const categoryKey = 'warmth:HIGH_CASUAL';
      const pool = this.getMergedPool(categoryKey, WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_CASUAL);
      return this.cache.selectNonRepeating(categoryKey, pool);
    }
    const categoryKey = 'warmth:HIGH_POLITE';
    const pool = this.getMergedPool(categoryKey, WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_POLITE);
    return this.cache.selectNonRepeating(categoryKey, pool);
  }

  /**
   * 5. 見出しラベルの選択 (デフォルト分岐 5キー × 各30種以上から非重複選択)
   * ※ 4つのシーン別見出しは規定の固定見出しを優先 (指示書 1.1 より)
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

    // デフォルト分岐: 30種以上のプールから非重複選択（動的変種を合算）
    const cKey = `heading:conclusion:${skeleton}`;
    const cItem = this.cache.selectNonRepeating(
      cKey,
      this.getMergedPool(cKey, SECTION_HEADINGS_DEFAULT_DATA.conclusion)
    );
    const rKey = `heading:reasons:${skeleton}`;
    const rItem = this.cache.selectNonRepeating(
      rKey,
      this.getMergedPool(rKey, SECTION_HEADINGS_DEFAULT_DATA.reasons)
    );
    const cdKey = `heading:conditions:${skeleton}`;
    const cdItem = this.cache.selectNonRepeating(
      cdKey,
      this.getMergedPool(cdKey, SECTION_HEADINGS_DEFAULT_DATA.conditions)
    );
    const exKey = `heading:exceptions:${skeleton}`;
    const exItem = this.cache.selectNonRepeating(
      exKey,
      this.getMergedPool(exKey, SECTION_HEADINGS_DEFAULT_DATA.exceptions)
    );
    const naKey = `heading:nextActions:${skeleton}`;
    const naItem = this.cache.selectNonRepeating(
      naKey,
      this.getMergedPool(naKey, SECTION_HEADINGS_DEFAULT_DATA.nextActions)
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
    const base = SKELETON_VARIATIONS_DATA[patternId];
    if (!base || base.length === 0) return null;
    const categoryKey = `skeleton:${patternId}`;
    const pool = this.getMergedPool(categoryKey, base);
    return this.cache.selectNonRepeating(categoryKey, pool);
  }

  /** 全プールの状態（静的件数、動的件数、累積使用件数等）を一覧化 */
  public getAllCategoriesSummary(): Array<{
    categoryKey: string;
    staticCount: number;
    dynamicCount: number;
    totalCount: number;
    usageCount: number;
    samplePool: VariationItem[];
  }> {
    const results: Array<{
      categoryKey: string;
      staticCount: number;
      dynamicCount: number;
      totalCount: number;
      usageCount: number;
      samplePool: VariationItem[];
    }> = [];

    // 1. connectors
    for (const key of Object.keys(SCENE_CONNECTORS_DATA)) {
      const cat = `connector:${key}`;
      const staticPool = SCENE_CONNECTORS_DATA[key] || [];
      const dynamic = this.dynamicVariations.get(cat) || [];
      results.push({
        categoryKey: cat,
        staticCount: staticPool.length,
        dynamicCount: dynamic.length,
        totalCount: staticPool.length + dynamic.length,
        usageCount: this.cache.getUsageCount(cat),
        samplePool: staticPool,
      });
    }

    // 2. prudence
    for (const key of Object.keys(PRUDENCE_NOTES_DATA)) {
      const cat = `prudence:${key}`;
      const staticPool = (PRUDENCE_NOTES_DATA as any)[key] || [];
      const dynamic = this.dynamicVariations.get(cat) || [];
      results.push({
        categoryKey: cat,
        staticCount: staticPool.length,
        dynamicCount: dynamic.length,
        totalCount: staticPool.length + dynamic.length,
        usageCount: this.cache.getUsageCount(cat),
        samplePool: staticPool,
      });
    }

    // 3. proactive
    for (const key of Object.keys(PROACTIVE_SUGGESTIONS_DATA)) {
      const cat = `proactive:${key}`;
      const staticPool = (PROACTIVE_SUGGESTIONS_DATA as any)[key] || [];
      const dynamic = this.dynamicVariations.get(cat) || [];
      results.push({
        categoryKey: cat,
        staticCount: staticPool.length,
        dynamicCount: dynamic.length,
        totalCount: staticPool.length + dynamic.length,
        usageCount: this.cache.getUsageCount(cat),
        samplePool: staticPool,
      });
    }

    // 4. skeletons
    for (const key of Object.keys(SKELETON_VARIATIONS_DATA)) {
      const cat = `skeleton:${key}`;
      const staticPool = SKELETON_VARIATIONS_DATA[key] || [];
      const dynamic = this.dynamicVariations.get(cat) || [];
      results.push({
        categoryKey: cat,
        staticCount: staticPool.length,
        dynamicCount: dynamic.length,
        totalCount: staticPool.length + dynamic.length,
        usageCount: this.cache.getUsageCount(cat),
        samplePool: staticPool,
      });
    }

    return results;
  }

  public getCache(): RecentUsageCache {
    return this.cache;
  }
}

export const surfaceVariationService = SurfaceVariationService.getInstance();

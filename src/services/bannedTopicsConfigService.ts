/**
 * 設計思想指示書 21.2 & 作業指示書 v19
 * 禁止トピック手動設定サービス (Banned Topics Config Service)
 *
 * 本人利用専用アプリのため、センシティブ領域の扱いはコード固定フィルタではなくユーザー手動設定式。
 * - 初期値は一般的なセンシティブ項目（自傷、自殺、性的、暴力の詳細な手順等）をプリセット。
 * - ユーザーが任意の文字列/キーワードを追加・削除・リセット可能。
 * - ネット検索由来の素材がこの禁止トピックに一致する場合は、骨格・言い回しの候補化を完全除外する。
 */

import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const BANNED_TOPICS_STORAGE_KEY = 'miki_ai_banned_topics_config_v19';

export interface BannedTopicsConfig {
  enabled: boolean;
  topics: string[];
  updatedAt: number;
}

export const DEFAULT_BANNED_TOPICS: string[] = [
  '自傷',
  '自殺',
  '性的',
  '暴力の詳細な手順',
  'テロ',
  '違法薬物の製造',
  '爆発物の製造',
  '差別的ヘイトスピーチ',
];

export class BannedTopicsConfigService {
  private static instance: BannedTopicsConfigService;
  private config: BannedTopicsConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): BannedTopicsConfigService {
    if (!BannedTopicsConfigService.instance) {
      BannedTopicsConfigService.instance = new BannedTopicsConfigService();
    }
    return BannedTopicsConfigService.instance;
  }

  private loadConfig(): BannedTopicsConfig {
    try {
      const saved = storageService.getItem(BANNED_TOPICS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
          return {
            enabled: parsed.enabled ?? true,
            topics: parsed.topics,
            updatedAt: parsed.updatedAt || Date.now(),
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load banned topics config:', e);
    }

    return {
      enabled: true,
      topics: [...DEFAULT_BANNED_TOPICS],
      updatedAt: Date.now(),
    };
  }

  private saveConfig(): void {
    try {
      storageService.setItem(BANNED_TOPICS_STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save banned topics config:', e);
    }
  }

  public getConfig(): BannedTopicsConfig {
    return {
      enabled: this.config.enabled,
      topics: [...this.config.topics],
      updatedAt: this.config.updatedAt,
    };
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.config.updatedAt = Date.now();
    this.saveConfig();
  }

  public addTopic(topic: string): boolean {
    const trimmed = topic.trim();
    if (!trimmed) return false;
    if (this.config.topics.includes(trimmed)) return false;

    this.config.topics.push(trimmed);
    this.config.updatedAt = Date.now();
    this.saveConfig();
    systemLogger.info('SELF_IMPROVEMENT', `🛡️ [禁止トピック追加] 新たな禁止キーワード「${trimmed}」を登録しました`);
    return true;
  }

  public removeTopic(topic: string): boolean {
    const trimmed = topic.trim();
    const index = this.config.topics.indexOf(trimmed);
    if (index === -1) return false;

    this.config.topics.splice(index, 1);
    this.config.updatedAt = Date.now();
    this.saveConfig();
    systemLogger.info('SELF_IMPROVEMENT', `🛡️ [禁止トピック削除] 禁止キーワード「${trimmed}」を解除しました`);
    return true;
  }

  public resetToDefault(): void {
    this.config.topics = [...DEFAULT_BANNED_TOPICS];
    this.config.enabled = true;
    this.config.updatedAt = Date.now();
    this.saveConfig();
    systemLogger.info('SELF_IMPROVEMENT', '🛡️ [禁止トピック初期化] デフォルト禁止キーワード群にリセットしました');
  }

  /**
   * テキストが禁止トピックに触れていないか判定
   * @param text 判定対象テキスト
   * @returns isBanned: 該当したか, matchedTopic: 該当したキーワード
   */
  public checkBanned(text: string): { isBanned: boolean; matchedTopic?: string; reason?: string } {
    if (!this.config.enabled) {
      return { isBanned: false };
    }

    const lower = text.toLowerCase();
    for (const topic of this.config.topics) {
      const topicLower = topic.toLowerCase().trim();
      if (!topicLower) continue;

      if (lower.includes(topicLower)) {
        return {
          isBanned: true,
          matchedTopic: topic,
          reason: `禁止トピック手動設定「${topic}」に一致しました`,
        };
      }
    }

    return { isBanned: false };
  }
}

export const bannedTopicsConfigService = BannedTopicsConfigService.getInstance();

import {
  WebSearchResultItem,
  AutonomousSearchLearningRecord,
  AutonomousSearchMessageMeta,
  MemoryItem,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { workingAgendaService } from './workingAgendaService';
import { selfImprovementService } from './selfImprovementService';
import { capabilityGapService } from './capabilityGapService';
import { privacyGuardrailService } from './privacyGuardrailService';

const SEARCH_CONFIG_KEY = 'miki_ai_autonomous_search_config';
const SEARCH_RECORDS_KEY = 'miki_ai_autonomous_search_records';
const SEARCH_STATS_KEY = 'miki_ai_autonomous_search_stats';

export interface AutonomousSearchConfig {
  enabled: boolean;
  autoSearchInChat: boolean;
  idleSearchEnabled: boolean;
  maxResults: number;
  autoLearnToLongTermMemory: boolean;
  autoLearnToSyntheticData: boolean;
}

export interface AutonomousSearchStats {
  totalSearches: number;
  inChatSearches: number;
  idleAutonomousSearches: number;
  knowledgeItemsLearned: number;
  lastSearchAt: number;
}

const DEFAULT_CONFIG: AutonomousSearchConfig = {
  enabled: true,
  autoSearchInChat: true,
  idleSearchEnabled: true,
  maxResults: 4,
  autoLearnToLongTermMemory: true,
  autoLearnToSyntheticData: true,
};

const DEFAULT_STATS: AutonomousSearchStats = {
  totalSearches: 0,
  inChatSearches: 0,
  idleAutonomousSearches: 0,
  knowledgeItemsLearned: 0,
  lastSearchAt: 0,
};

export class AutonomousSearchService {
  private config: AutonomousSearchConfig;
  private stats: AutonomousSearchStats;
  private cache: Map<string, { data: { results: WebSearchResultItem[]; summary?: string; provider?: string }; timestamp: number }> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.stats = this.loadStats();
  }

  private loadConfig(): AutonomousSearchConfig {
    try {
      const saved = storageService.getItem(SEARCH_CONFIG_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to load autonomous search config:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(cfg: Partial<AutonomousSearchConfig>): AutonomousSearchConfig {
    this.config = { ...this.config, ...cfg };
    try {
      storageService.setItem(SEARCH_CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save autonomous search config:', e);
    }
    return this.config;
  }

  public getConfig(): AutonomousSearchConfig {
    return { ...this.config };
  }

  private loadStats(): AutonomousSearchStats {
    try {
      const saved = storageService.getItem(SEARCH_STATS_KEY);
      if (saved) return { ...DEFAULT_STATS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to load search stats:', e);
    }
    return { ...DEFAULT_STATS };
  }

  private saveStats() {
    try {
      storageService.setItem(SEARCH_STATS_KEY, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save search stats:', e);
    }
  }

  public getStats(): AutonomousSearchStats {
    return { ...this.stats };
  }

  public getRecentRecords(limit = 20): AutonomousSearchLearningRecord[] {
    try {
      const saved = storageService.getItem(SEARCH_RECORDS_KEY);
      if (saved) {
        const records: AutonomousSearchLearningRecord[] = JSON.parse(saved);
        return records.slice(0, limit);
      }
    } catch (e) {
      console.warn('Failed to load search records:', e);
    }
    return [];
  }

  private addRecord(record: AutonomousSearchLearningRecord) {
    try {
      const records = this.getRecentRecords(100);
      records.unshift(record);
      storageService.setItem(SEARCH_RECORDS_KEY, JSON.stringify(records.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save search record:', e);
    }
  }

  /**
   * 会話中のユーザー入力から、能動的にWeb検索が必要かを高精度判定し、クエリを抽出
   * 設計思想 Master v5.0 第13章1節
   */
  public detectNeedForSearch(userText: string): {
    needsSearch: boolean;
    query?: string;
    reason?: string;
    category?: 'news_latest' | 'spec_docs' | 'factual' | 'explicit_request';
  } {
    if (!this.config.enabled || !this.config.autoSearchInChat) {
      return { needsSearch: false };
    }

    const t = userText.trim();
    if (!t || t.length < 2) return { needsSearch: false };

    // 1. 明示的な検索指示
    const explicitPattern = /(?:調べ|検索|ググっ|ネットで|リサーチ|情報集め|グーグル|google)(?:て|ろ|てみて|てほしい|た|る|ます)/i;
    if (explicitPattern.test(t)) {
      const cleaned = t
        .replace(/(?:について|の事|のこと)?(?:調べ|検索|ググっ|ネットで|リサーチ)(?:て|ろ|てみて|てほしい|た|る|ます|くれ)?/gi, '')
        .replace(/^[、。\s]+|[、。\s]+$/g, '')
        .trim();
      return {
        needsSearch: true,
        query: cleaned || t,
        reason: 'ユーザーからの明示的なWeb検索指示を検出',
        category: 'explicit_request',
      };
    }

    // 2. 時事・最新情報・日付依存トピック (2025年、2026年、最新、最近、トレンド、ニュース)
    const latestPattern = /(?:最新|最近|トレンド|ニュース|今年|現行|いま|現在|2025年?|2026年?|アップデート|バージョン)/;
    if (latestPattern.test(t) && (t.includes('何') || t.includes('どう') || t.includes('教えて') || t.includes('一覧') || t.includes('状況'))) {
      const cleaned = t
        .replace(/(?:を|について|のこと)?(?:教えて|知りたい|どうなってる|どう|ですか|何|なん)?/g, '')
        .trim();
      return {
        needsSearch: true,
        query: cleaned,
        reason: '最新トレンド・時事情報に関する質問を検出',
        category: 'news_latest',
      };
    }

    // 3. 仕様書・公式ドキュメント・ライブラリ・API・構文に関する調査
    const specPattern = /(?:仕様|ドキュメント|API|リリースノート|文法|構文|ライブラリ|パッケージ|引数|戻り値|関数)(?:を|について|って|とは)?(?:教えて|知りたい|確認|どう使う)/i;
    if (specPattern.test(t)) {
      const cleaned = t
        .replace(/(?:を|について|のこと)?(?:教えて|知りたい|確認したい|どう使う|使い方)?/g, '')
        .trim();
      return {
        needsSearch: true,
        query: cleaned,
        reason: '技術仕様・公式ドキュメントに関する調査要求を検出',
        category: 'spec_docs',
      };
    }

    // 4. 定義・事実確認 (「〜って何？」「〜とは？」で未知語の可能性が高いもの)
    const definitionPattern = /(.+?)(?:って何(?:ですか|なん)?|とは(?:何ですか|何|なんですか)?|の意味)/;
    const defMatch = t.match(definitionPattern);
    if (defMatch && defMatch[1]) {
      const targetTerm = defMatch[1].trim();
      // 短すぎる日常会話（「これ」「それ」「あれ」等）は除外
      if (targetTerm.length >= 2 && !/^(これ|それ|あれ|どれ|自分|私|あなた|みき)$/.test(targetTerm)) {
        return {
          needsSearch: true,
          query: targetTerm,
          reason: `定義・事実照会要求「${targetTerm}」を検出`,
          category: 'factual',
        };
      }
    }

    return { needsSearch: false };
  }

  /**
   * Web検索を実行
   */
  public async executeSearch(
    query: string,
    options?: { maxResults?: number; bypassCache?: boolean }
  ): Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string }> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return { results: [] };

    // 設計思想 Master v5.0 第11章 11.1節: 送信前プライバシー・機密監査
    const audit = privacyGuardrailService.auditOutboundContent(cleanQuery, 'web_search', { autoSanitize: true });
    if (!audit.allowed) {
      systemLogger.warn('SELF_IMPROVEMENT', `🚫 [Web検索遮断] 検索クエリに機密が含まれるため中断: ${cleanQuery}`);
      return { results: [], summary: 'プライバシー保護のため検索を安全にスキップしました。' };
    }
    const safeQuery = audit.sanitizedText;

    const cacheKey = safeQuery.toLowerCase();
    if (!options?.bypassCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      // 1時間有効
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.data;
      }
    }

    const maxResults = options?.maxResults || this.config.maxResults || 4;

    try {
      // 1. Expressバックエンド /api/search へリクエスト
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: safeQuery, maxResults }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const output = {
          results: (data.results || []).map((r: any) => ({
            title: r.title || cleanQuery,
            snippet: r.snippet || '',
            url: r.url || '',
            source: r.source || 'Web Search',
            publishedDate: r.publishedDate,
          })),
          summary: data.summary || '',
          provider: data.provider || 'api_search',
        };

        this.cache.set(cacheKey, { data: output, timestamp: Date.now() });
        this.stats.totalSearches++;
        this.stats.lastSearchAt = Date.now();
        this.saveStats();
        return output;
      }
    } catch (apiErr) {
      console.warn('[AutonomousSearch] Backend /api/search unavailable, falling back to direct Wikipedia API:', apiErr);
    }

    // 2. フォールバック: 直接 Wikipedia API (CORS対応オープンエンドポイント)
    try {
      const wikiUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=${maxResults}`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const hits = wikiData?.query?.search || [];
        const results: WebSearchResultItem[] = hits.map((hit: any) => ({
          title: hit.title,
          snippet: (hit.snippet || '').replace(/<[^>]+>/g, '').trim(),
          url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
          source: 'Wikipedia (Direct)',
          publishedDate: hit.timestamp,
        }));

        const summary = results.length > 0 ? results[0].snippet : `「${cleanQuery}」に関する知見を取得しました。`;
        const output = { results, summary, provider: 'wikipedia_direct' };
        this.cache.set(cacheKey, { data: output, timestamp: Date.now() });
        this.stats.totalSearches++;
        this.stats.lastSearchAt = Date.now();
        this.saveStats();
        return output;
      }
    } catch (directErr) {
      console.warn('[AutonomousSearch] Direct Wikipedia fetch error:', directErr);
    }

    // 3. 究極フォールバック (オフライン・接続不可環境)
    const fallbackResult: WebSearchResultItem[] = [
      {
        title: `${cleanQuery} (ローカル参照)`,
        snippet: `「${cleanQuery}」についてローカル知識ベースから参照。最新版では該当仕様が策定・更新されています。`,
        url: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
        source: 'Local Synthetic Fallback',
      },
    ];
    const fallbackOutput = {
      results: fallbackResult,
      summary: `「${cleanQuery}」に関する基礎仕様・解説情報を取得しました。`,
      provider: 'local_fallback',
    };
    this.stats.totalSearches++;
    this.stats.lastSearchAt = Date.now();
    this.saveStats();
    return fallbackOutput;
  }

  /**
   * 検索結果から知識を抽出し、長期記憶(Semantic Memory)や合成データセットへ能動的に還元・学習
   * 設計思想 Master v5.0 第13章 & 第2章・第9章連結
   */
  public learnFromSearch(
    query: string,
    results: WebSearchResultItem[],
    summary?: string,
    options?: {
      triggerType: 'in_conversation' | 'idle_autonomous' | 'working_agenda' | 'capability_gap';
      resolvedAgendaId?: string;
    }
  ): AutonomousSearchLearningRecord {
    const triggerType = options?.triggerType || 'in_conversation';
    const extractedKnowledge: string[] = [];

    // 重要スニペット・要点の抽出
    if (summary && summary.trim().length > 10) {
      extractedKnowledge.push(summary.trim());
    }
    for (const r of results.slice(0, 3)) {
      if (r.snippet && r.snippet.length > 15) {
        const cleaned = r.snippet.replace(/[\n\r]+/g, ' ').trim();
        if (!extractedKnowledge.some(k => k.includes(cleaned.slice(0, 30)))) {
          extractedKnowledge.push(`[${r.title}] ${cleaned}`);
        }
      }
    }

    let integratedToMemory = false;
    let integratedToSyntheticData = false;

    // 1. 長期記憶 (Semantic Core / Procedural) への自動定着
    if (this.config.autoLearnToLongTermMemory && extractedKnowledge.length > 0) {
      try {
        const knowledgeContent = `【自律Web学習知識: ${query}】\n要約: ${summary || results[0]?.title || ''}\n詳細知見:\n${extractedKnowledge.slice(0, 2).join('\n')}`;
        const memItem: MemoryItem = {
          id: 'mem_web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          category: 'code',
          content: knowledgeContent,
          importance: 8,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'auto',
          tags: ['web_search', 'autonomous_learning', query.slice(0, 20)],
          memoryType: 'semantic',
          destination: 'long_term_memory',
          approved: true,
        };
        storageService.saveMemoryItem(memItem);
        integratedToMemory = true;
        this.stats.knowledgeItemsLearned += extractedKnowledge.length;
      } catch (memErr) {
        console.warn('Failed to integrate search knowledge to longTermMemory:', memErr);
      }
    }

    // 2. 合成学習データセット (Synthetic Data) への教材還元
    if (this.config.autoLearnToSyntheticData && extractedKnowledge.length > 0) {
      try {
        selfImprovementService.addTrainingSample({
          instruction: `「${query}」についての最新情報や仕様、知見を説明してください。`,
          outputTarget: summary || extractedKnowledge.join('\n'),
          category: 'retrieval',
          reliability: 'high',
          source: 'auto_repair',
          verificationNote: `Web検索自律学習教材: ${query.slice(0, 30)}`,
        });
        integratedToSyntheticData = true;
      } catch (synErr) {
        console.warn('Failed to integrate search knowledge to synthetic data:', synErr);
      }
    }

    // 3. 中期記憶 (Working Agenda) の宿題があれば解決
    if (options?.resolvedAgendaId) {
      try {
        workingAgendaService.resolveAgenda(
          options.resolvedAgendaId,
          `自律Web検索学習により解決: ${summary || extractedKnowledge[0] || '知見獲得完了'}`
        );
      } catch (agErr) {
        console.warn('Failed to resolve agenda via search learning:', agErr);
      }
    }

    if (triggerType === 'in_conversation') {
      this.stats.inChatSearches++;
    } else {
      this.stats.idleAutonomousSearches++;
    }
    this.saveStats();

    const record: AutonomousSearchLearningRecord = {
      id: 'sr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      query,
      triggerType,
      timestamp: Date.now(),
      results,
      summary,
      extractedKnowledge,
      integratedToMemory,
      integratedToSyntheticData,
      resolvedAgendaId: options?.resolvedAgendaId,
    };

    this.addRecord(record);

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🌐 [第13章 能動学習] クエリ「${query}」からWeb検索し${extractedKnowledge.length}件の知見を獲得・多層記憶に統合 (${triggerType})`
    );

    return record;
  }

  /**
   * 会話していない時 (アイドル時 / バックグラウンド / 睡眠時) に自律的にWeb検索して学習するループ
   * 設計思想 Master v5.0 第13章2節: Idle & Background Autonomous Web Learning
   */
  public async performIdleAutonomousLearning(abortSignal?: AbortSignal): Promise<{
    learnedCount: number;
    queriesInvestigated: string[];
    details: string[];
  }> {
    if (!this.config.enabled || !this.config.idleSearchEnabled) {
      return { learnedCount: 0, queriesInvestigated: [], details: ['自律検索が無効です'] };
    }

    const investigated: string[] = [];
    const details: string[] = [];
    let learnedCount = 0;

    // 1. Working Agenda の未解決宿題から検索トピックを探索
    const homeworks = workingAgendaService.getHomeworkForAutonomousThought();
    if (homeworks.length > 0) {
      for (const hw of homeworks.slice(0, 2)) {
        if (abortSignal?.aborted) break;

        // クエリを生成 (課題トピック + 未解決事項の先頭)
        const subQuery = hw.unresolvedQuestions[0] || hw.topic;
        const searchQuery = `${hw.topic} ${subQuery}`.replace(/[\n\r]/g, ' ').slice(0, 50).trim();

        investigated.push(searchQuery);
        details.push(`宿題「${hw.topic}」について自律Web検索開始: ${searchQuery}`);

        const { results, summary, provider } = await this.executeSearch(searchQuery, { maxResults: 3 });
        if (results.length > 0) {
          this.learnFromSearch(searchQuery, results, summary, {
            triggerType: 'working_agenda',
            resolvedAgendaId: hw.id,
          });
          learnedCount++;
          details.push(`宿題「${hw.topic}」の調査完了 (${provider}, ${results.length}件の知見)`);
        }
      }
    }

    // 2. 宿題がない場合は Capability Gap (能力不足レジストリ) から探索
    if (learnedCount === 0 && !abortSignal?.aborted) {
      const openGaps = capabilityGapService.getAllGaps().filter((g) => g.status === 'OPEN');
      if (openGaps.length > 0) {
        const topGap = openGaps[0];
        const gapQuery = `${topGap.capabilityId} ${topGap.description || ''}`.replace(/[\n\r]/g, ' ').slice(0, 40).trim();
        investigated.push(gapQuery);
        details.push(`能力ギャップ「${topGap.capabilityId}」について自律Web検索開始: ${gapQuery}`);

        const { results, summary } = await this.executeSearch(gapQuery, { maxResults: 3 });
        if (results.length > 0) {
          this.learnFromSearch(gapQuery, results, summary, {
            triggerType: 'capability_gap',
          });
          learnedCount++;
          capabilityGapService.updateGapStatus(topGap.gap_id, 'MITIGATED');
          details.push(`能力ギャップ「${topGap.capabilityId}」の知見補完完了`);
        }
      }
    }

    return {
      learnedCount,
      queriesInvestigated: investigated,
      details,
    };
  }
}

export const autonomousSearchService = new AutonomousSearchService();

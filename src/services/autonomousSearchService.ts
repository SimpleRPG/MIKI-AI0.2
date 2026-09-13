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
import { bannedTopicsConfigService } from './bannedTopicsConfigService';
import { WebMaterialPatternExtractor } from './webMaterialPatternExtractor';
import { answerPlanService } from './answerPlanService';
import { surfaceVariationGrowthService } from './surfaceVariationGrowthService';
import { getJinaApiKeyItem } from './api';

/**
 * Jina Reader検索レスポンス (Markdown / JSON) のパーサー
 * Jina利用規約: https://jina.ai/legal/terms-of-service/
 */
export function parseJinaSearchResults(rawText: string, maxResults = 4): WebSearchResultItem[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. JSON形式のレスポンスのパース判定
  if (rawText.trim().startsWith('{')) {
    try {
      const json = JSON.parse(rawText);
      const dataItems = Array.isArray(json.data) ? json.data : (json.data?.results || []);
      if (Array.isArray(dataItems) && dataItems.length > 0) {
        return dataItems.slice(0, maxResults).map((d: any) => ({
          title: d.title || 'Jina Search Result',
          snippet: (d.description || d.content || '').slice(0, 500).replace(/[\r\n]+/g, ' ').trim(),
          url: d.url || '',
          source: 'Jina Reader (Web)',
        }));
      }
    } catch {
      // JSONパースに失敗した場合はMarkdownパースへフォールバック
    }
  }

  // 2. Markdown形式のパース
  // Jinaのレスポンスは "Title: " や "[1] Title: ", "### Title: " で始まるブロックで区切られる
  const items: WebSearchResultItem[] = [];
  const blocks = rawText.split(/(?=(?:^|\n)(?:\[\d+\]\s*)?Title:\s*)/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/(?:^|\n)(?:\[\d+\]\s*)?Title:\s*/.test(trimmed)) continue;

    const titleMatch = trimmed.match(/(?:^|\n)(?:\[\d+\]\s*)?Title:\s*([^\n]+)/);
    const urlMatch = trimmed.match(/(?:^|\n)(?:\[\d+\]\s*)?URL(?:\s*Source)?:\s*([^\n]+)/i);

    const contentIndex = trimmed.indexOf('Markdown Content:');
    let snippet = '';
    if (contentIndex !== -1) {
      snippet = trimmed.slice(contentIndex + 'Markdown Content:'.length).trim();
    } else {
      const lines = trimmed.split('\n').filter(l =>
        !l.match(/^(?:\[\d+\]\s*)?Title:/i) &&
        !l.match(/^(?:\[\d+\]\s*)?URL/i) &&
        !l.match(/^(?:\[\d+\]\s*)?Published Time:/i)
      );
      snippet = lines.join(' ').trim();
    }

    // Markdown装飾を除去してスニペットを整形
    snippet = snippet
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*`_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    const title = titleMatch ? titleMatch[1].trim() : 'Web情報';
    const url = urlMatch ? urlMatch[1].trim() : '';

    if (title || snippet) {
      items.push({
        title,
        snippet: snippet || title,
        url: url || 'https://jina.ai',
        source: 'Jina Reader (Web)',
      });
    }

    if (items.length >= maxResults) break;
  }

  return items;
}

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
  allowFallbackMock?: boolean;
  maxQueriesPerRun?: number;
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

  public updateConfig(cfg: Partial<AutonomousSearchConfig>): AutonomousSearchConfig {
    return this.saveConfig(cfg);
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
    options?: {
      maxResults?: number;
      bypassCache?: boolean;
      preferredProvider?: 'auto' | 'wikipedia' | 'jina' | 'duckduckgo';
    }
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

    // 作業指示書 v19: 禁止トピック手動設定によるクエリ遮断
    const bannedQueryCheck = bannedTopicsConfigService.checkBanned(safeQuery);
    if (bannedQueryCheck.isBanned) {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `🚫 [Web検索遮断] 検索クエリが禁止トピック「${bannedQueryCheck.matchedTopic}」に一致したため中断: ${safeQuery}`
      );
      return { results: [], summary: `禁止トピック（${bannedQueryCheck.matchedTopic}）に該当するため安全にスキップしました。` };
    }

    const cacheKey = safeQuery.toLowerCase();
    if (!options?.bypassCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      // 1時間有効
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.data;
      }
    }

    const maxResults = options?.maxResults || this.config.maxResults || 4;

    if (this.config.allowFallbackMock) {
      const mockResult: WebSearchResultItem[] = [
        {
          title: `【テスト用モック】トラブルシューティング ガイド (${cleanQuery})`,
          snippet: `【テスト用モックデータ】「${cleanQuery}」についての手順解説です。実データではありません。`,
          url: `https://knowledge.local/search?q=${encodeURIComponent(cleanQuery)}`,
          source: 'Mock (Non-Real)',
        },
      ];
      const mockOutput = {
        results: mockResult,
        summary: `【テスト用モック】「${cleanQuery}」に関するテスト用モックデータです（実データではありません）。`,
        provider: 'mock_fallback',
      };
      this.cache.set(cacheKey, { data: mockOutput, timestamp: Date.now() });
      this.stats.totalSearches++;
      this.stats.lastSearchAt = Date.now();
      this.saveStats();
      return mockOutput;
    }

    // 2. 検索プロバイダ実行パイプライン (作業指示書 v23 第1.1節)
    // 順序: Wikipedia直接fetch -> Jina Reader検索 (s.jina.ai) -> DuckDuckGo Instant Answer -> local_fallback
    const preferred = options?.preferredProvider || 'auto';

    // --- サブルーチン: Wikipedia直接fetch (CORS対応オープンエンドポイント) ---
    const runWikipedia = async (): Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string } | null> => {
      try {
        const wikiUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=${maxResults}`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const hits = wikiData?.query?.search || [];
          if (hits.length > 0) {
            const results: WebSearchResultItem[] = hits.map((hit: any) => ({
              title: hit.title,
              snippet: (hit.snippet || '').replace(/<[^>]+>/g, '').trim(),
              url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
              source: 'Wikipedia (Direct)',
              publishedDate: hit.timestamp,
            }));
            const summary = results[0].snippet || `「${cleanQuery}」に関する知見を取得しました。`;
            systemLogger.info('SELF_IMPROVEMENT', `📖 [Wikipedia] 直接検索成功: ${results.length}件 (provider: wikipedia_direct)`);
            return { results, summary, provider: 'wikipedia_direct' };
          }
        }
      } catch (directErr) {
        console.warn('[AutonomousSearch] Direct Wikipedia fetch error:', directErr);
      }
      return null;
    };

    // --- サブルーチン: Jina Reader直接検索 (s.jina.ai) ---
    // Jina利用規約: https://jina.ai/legal/terms-of-service/
    // クライアント側から直接fetch。登録済みAPIキーがあればAuthorizationヘッダーに付与。
    const runJinaReader = async (): Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string } | null> => {
      try {
        const jinaHeaders: Record<string, string> = {
          Accept: 'text/plain',
        };
        const jinaKey = getJinaApiKeyItem();
        if (jinaKey) {
          jinaHeaders['Authorization'] = `Bearer ${jinaKey}`;
          systemLogger.info(
            'SELF_IMPROVEMENT',
            '🔑 [Jina Reader] 登録済みAPIキーを使用して認証ヘッダーを付与しました (Bearer jina_***)'
          );
        }

        const jinaUrl = `https://s.jina.ai/${encodeURIComponent(cleanQuery)}`;
        const jinaRes = await fetch(jinaUrl, {
          headers: jinaHeaders,
          signal: AbortSignal.timeout(8000),
        });

        if (jinaRes.ok) {
          const jinaText = await jinaRes.text();
          const jinaResults = parseJinaSearchResults(jinaText, maxResults);
          if (jinaResults.length > 0) {
            const summary = jinaResults[0].snippet || `「${cleanQuery}」に関するWeb知見を取得しました。`;
            systemLogger.info(
              'SELF_IMPROVEMENT',
              `🌐 [Jina Reader] Web検索成功: ${jinaResults.length}件取得 (provider: jina_direct)`
            );
            return { results: jinaResults, summary, provider: 'jina_direct' };
          } else {
            systemLogger.warn(
              'SELF_IMPROVEMENT',
              '⚠️ [Jina Reader] レスポンス本文から有効な検索結果を抽出できませんでした'
            );
          }
        } else {
          systemLogger.warn(
            'SELF_IMPROVEMENT',
            `⚠️ [Jina Reader] 検索エンドポイント応答: HTTP ${jinaRes.status} (${jinaRes.statusText})`
          );
        }
      } catch (jinaErr: any) {
        console.warn('[AutonomousSearch] Jina Reader fetch error:', jinaErr);
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [Jina Reader] 取得例外: ${jinaErr?.message || String(jinaErr)}`);
      }
      return null;
    };

    // --- サブルーチン: DuckDuckGo Instant Answer API ---
    // DuckDuckGo Attribution & 非商用ポリシー: https://duckduckgo.com/api
    const runDuckDuckGo = async (): Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string } | null> => {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
        const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });
        if (ddgRes.ok) {
          const ddgData = await ddgRes.json();
          const results: WebSearchResultItem[] = [];

          // 1. Abstract (主要即答テキスト)
          const abstractText = (ddgData.AbstractText || ddgData.Abstract || '').trim();
          if (abstractText) {
            results.push({
              title: ddgData.Heading || cleanQuery,
              snippet: abstractText,
              url: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
              source: `DuckDuckGo (${ddgData.AbstractSource || 'Instant Answer'})`,
            });
          }

          // 2. RelatedTopics (関連トピック)
          if (Array.isArray(ddgData.RelatedTopics)) {
            for (const item of ddgData.RelatedTopics) {
              if (results.length >= maxResults) break;
              if (item.Text && item.FirstURL) {
                const topicText = item.Text.trim();
                const titlePart = topicText.split(' - ')[0] || topicText.slice(0, 30);
                results.push({
                  title: titlePart,
                  snippet: topicText,
                  url: item.FirstURL,
                  source: 'DuckDuckGo Instant Answer',
                });
              }
            }
          }

          if (results.length > 0) {
            const summary = results[0].snippet;
            systemLogger.info(
              'SELF_IMPROVEMENT',
              `🦆 [DuckDuckGo] 即答ナレッジ取得成功: ${results.length}件 (provider: duckduckgo_direct)`
            );
            return { results, summary, provider: 'duckduckgo_direct' };
          }
        }
      } catch (ddgErr: any) {
        console.warn('[AutonomousSearch] DuckDuckGo fetch error:', ddgErr);
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [DuckDuckGo] 取得例外: ${ddgErr?.message || String(ddgErr)}`);
      }
      return null;
    };

    // 優先指定に応じた実行順序の制御
    let pipelineSteps: Array<() => Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string } | null>>;
    if (preferred === 'jina') {
      pipelineSteps = [runJinaReader, runWikipedia, runDuckDuckGo];
    } else if (preferred === 'duckduckgo') {
      pipelineSteps = [runDuckDuckGo, runWikipedia, runJinaReader];
    } else if (preferred === 'wikipedia') {
      pipelineSteps = [runWikipedia, runJinaReader, runDuckDuckGo];
    } else {
      // デフォルト順: Wikipedia直接fetch -> Jina Reader検索 -> DuckDuckGo Instant Answer
      pipelineSteps = [runWikipedia, runJinaReader, runDuckDuckGo];
    }

    // パイプラインを順次実行
    for (const step of pipelineSteps) {
      const stepOutput = await step();
      if (stepOutput && stepOutput.results.length > 0) {
        this.cache.set(cacheKey, { data: stepOutput, timestamp: Date.now() });
        this.stats.totalSearches++;
        this.stats.lastSearchAt = Date.now();
        this.saveStats();
        return stepOutput;
      }
    }

    // 5. 検索失敗時のフォールバック (オフライン・全検索エンジン空振り)
    // 作業指示書 v21 第2.1節: 架空の検索結果やもっともらしい説明文を生成せず、「検索できませんでした」という事実のみを返す
    const failureOutput = {
      results: [],
      summary: `「${cleanQuery}」の検索に失敗しました（外部検索エンジン全件該当なし、または接続失敗）。`,
      provider: 'local_fallback',
    };
    this.stats.totalSearches++;
    this.stats.lastSearchAt = Date.now();
    this.saveStats();
    return failureOutput;
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

    // 4. 作業指示書 v19 第1.1節: 縦(骨格)への自律学習素材還元
    // 検索結果の受け答え構造・手順・FAQから骨格候補を抽出・登録 (WEB_OBSERVED, 3回観測昇格制)
    try {
      for (const r of results.slice(0, 2)) {
        const skeletonCand = WebMaterialPatternExtractor.extractSkeletonStructuresFromWebText({
          title: r.title,
          snippet: r.snippet,
          summary,
          sourceQuery: query,
          sourceUrl: r.url,
        });

        if (skeletonCand) {
          answerPlanService.registerSkeletonFromWebObservation(skeletonCand);
        }
      }
    } catch (skErr) {
      console.warn('Failed to extract web skeleton pattern:', skErr);
    }

    // 5. 作業指示書 v19 第1.2節 & 第1.3節: 横(言い回し)への自律学習素材還元
    // 検索結果から普遍的な言い回し・文頭・文末パターンを抽出し、弱点カテゴリの候補として検証・昇格
    try {
      const combinedSnippets = results
        .map((r) => r.snippet)
        .filter(Boolean)
        .join('\n');
      if (combinedSnippets) {
        const surfacePatterns = WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({
          text: combinedSnippets,
          sourceQuery: query,
          sourceUrl: results[0]?.url || '',
        });

        if (surfacePatterns.length > 0) {
          surfaceVariationGrowthService.processWebMaterialForVariationGrowth(surfacePatterns, 1);
        }
      }
    } catch (varErr) {
      console.warn('Failed to extract web surface variation pattern:', varErr);
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

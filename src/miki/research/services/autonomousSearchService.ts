import {
  WebSearchResultItem,
  AutonomousSearchLearningRecord,
  AutonomousSearchMessageMeta,
  MemoryItem,
} from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { getSearxngSearchSettings, buildSearxngSearchUrl } from './searxngSettingsService';
import { workingAgendaService } from '../../strategy/services/workingAgendaService';
import { selfImprovementService } from '../../improvement/services/selfImprovementService';
import { experienceLinkService } from '../../experience/services/experienceLinkService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { bannedTopicsConfigService } from '../../safety/services/bannedTopicsConfigService';
import { WebMaterialPatternExtractor } from './webMaterialPatternExtractor';
import { answerPlanService } from '../../strategy/services/answerPlanService';
import { surfaceVariationGrowthService } from '../../conversation/services/surfaceVariationGrowthService';
import { nativeWorkManagerService } from '../../execution/services/nativeWorkManagerService';
import { evidenceIdentityService } from '../../core/services/evidenceIdentityService';

export interface AutonomousSearchConfig {
  enabled:boolean;
  autoSearchInChat:boolean;
  idleSearchEnabled:boolean;
  maxResults:number;
  allowFallbackMock:boolean;
  autoLearnToLongTermMemory:boolean;
  autoLearnToSyntheticData:boolean;
}

export interface AutonomousSearchStats {
  totalSearches:number;
  inChatSearches:number;
  idleAutonomousSearches:number;
  knowledgeItemsLearned:number;
  lastSearchAt?:number;
}

export type SearchProviderName = 'searxng' | 'wikipedia' | 'duckduckgo';

export type SearchProviderExecutionStatus =
  | 'SUCCEEDED'
  | 'EMPTY'
  | 'FAILED'
  | 'SKIPPED';

export interface SearchProviderStatusRecord {
  provider: SearchProviderName;
  status: SearchProviderExecutionStatus;
  error?: string;
}

export interface AutonomousSearchExecutionResult {
  results: WebSearchResultItem[];
  summary?: string;
  provider?: string;
  providers: SearchProviderName[];
  providerStatuses: Record<SearchProviderName, SearchProviderStatusRecord>;
}

interface ProviderSearchOutput {
  provider: SearchProviderName;
  results: WebSearchResultItem[];
}

function compareStableText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalizeSearchUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

function deriveSourceIdentity(provider: SearchProviderName, item: WebSearchResultItem, canonicalUrl: string): {
  sourceId: string;
  independenceClusterId: string;
} {
  const sourceId =
    item.sourceId ||
    canonicalUrl ||
    `${provider}:${String(item.title || '').trim().toLowerCase()}`;

  let independenceClusterId = item.independenceClusterId;
  if (!independenceClusterId) {
    try {
      const host = canonicalUrl
        ? new URL(canonicalUrl).hostname.toLowerCase().replace(/^www\./, '')
        : '';
      independenceClusterId = host
        ? `cluster_web_${host}`
        : `cluster_provider_${provider}`;
    } catch {
      independenceClusterId = `cluster_provider_${provider}`;
    }
  }

  return { sourceId, independenceClusterId };
}

/**
 * 複数Providerの結果を、到着順ではなく固定ルールで統合する。
 * maxResultsはProviderごとの取得上限として扱い、探索経路の多様性を保持する。
 */
export function mergeSearchResults(
  outputs: ProviderSearchOutput[],
  preferredProvider: 'auto' | SearchProviderName = 'auto',
  maxResults = 4,
): WebSearchResultItem[] {
  const preferredOrder: SearchProviderName[] =
    preferredProvider === 'auto'
      ? ['searxng', 'wikipedia', 'duckduckgo']
      : [
          preferredProvider,
          ...(['searxng', 'wikipedia', 'duckduckgo'] as SearchProviderName[]).filter(
            (name) => name !== preferredProvider,
          ),
        ];

  const rank = new Map(preferredOrder.map((provider, index) => [provider, index]));
  const successfulProviderCount = outputs.filter((output) => output.results.length > 0).length;
  const maxCombinedResults = Math.max(1, maxResults) * Math.max(1, successfulProviderCount);

  const candidates = outputs.flatMap((output) =>
    output.results.slice(0, Math.max(1, maxResults)).map((item) => {
      const canonicalUrl = canonicalizeSearchUrl(item.url);
      const identity = deriveSourceIdentity(output.provider, item, canonicalUrl);
      return {
        item: {
          ...item,
          url: canonicalUrl || item.url,
          sourceId: identity.sourceId,
          independenceClusterId: identity.independenceClusterId,
        },
        provider: output.provider,
        canonicalKey:
          canonicalUrl ||
          `${output.provider}|${String(item.title || '').trim().toLowerCase()}|${String(item.snippet || '').trim().slice(0, 160).toLowerCase()}`,
      };
    }),
  );

  candidates.sort((a, b) => {
    const relevanceDelta = (b.item.relevanceScore ?? 0) - (a.item.relevanceScore ?? 0);
    if (relevanceDelta !== 0) return relevanceDelta;

    const providerDelta = (rank.get(a.provider) ?? 99) - (rank.get(b.provider) ?? 99);
    if (providerDelta !== 0) return providerDelta;

    const canonicalDelta = compareStableText(a.canonicalKey, b.canonicalKey);
    if (canonicalDelta !== 0) return canonicalDelta;

    const titleDelta = compareStableText(a.item.title, b.item.title);
    if (titleDelta !== 0) return titleDelta;

    return compareStableText(a.item.source, b.item.source);
  });

  const deduped = new Map<string, WebSearchResultItem>();
  for (const candidate of candidates) {
    if (!deduped.has(candidate.canonicalKey)) {
      deduped.set(candidate.canonicalKey, candidate.item);
    }
  }

  return Array.from(deduped.values()).slice(0, maxCombinedResults);
}

function createProviderStatuses(): Record<SearchProviderName, SearchProviderStatusRecord> {
  return {
    searxng: { provider: 'searxng', status: 'FAILED', error: 'NOT_RUN' },
    wikipedia: { provider: 'wikipedia', status: 'FAILED', error: 'NOT_RUN' },
    duckduckgo: { provider: 'duckduckgo', status: 'FAILED', error: 'NOT_RUN' },
  };
}

const SEARCH_CONFIG_KEY='miki_autonomous_search_config_v1';
const SEARCH_STATS_KEY='miki_autonomous_search_stats_v1';
const SEARCH_RECORDS_KEY='miki_autonomous_search_records_v1';
const DEFAULT_CONFIG:AutonomousSearchConfig={
  enabled:true,autoSearchInChat:true,idleSearchEnabled:true,maxResults:4,allowFallbackMock:false,
  autoLearnToLongTermMemory:true,autoLearnToSyntheticData:false
};
const DEFAULT_STATS:AutonomousSearchStats={
  totalSearches:0,inChatSearches:0,idleAutonomousSearches:0,knowledgeItemsLearned:0
};

export class AutonomousSearchService {
  private config: AutonomousSearchConfig;
  private stats: AutonomousSearchStats;
  private cache: Map<string, { data: AutonomousSearchExecutionResult; timestamp: number }> = new Map();

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
      preferredProvider?: 'auto' | 'searxng' | 'wikipedia' | 'duckduckgo';
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

    const preferred = options?.preferredProvider || 'auto';
    const maxResults = Math.max(1, options?.maxResults ?? this.config.maxResults ?? 4);
    const cacheKey = `${safeQuery.toLowerCase()}|preferred:${preferred}|perProvider:${maxResults}`;

    if (!options?.bypassCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.data;
      }
    }

    if (this.config.allowFallbackMock) {
      const mockResult: WebSearchResultItem[] = [
        {
          title: `【テスト用モック】トラブルシューティング ガイド (${cleanQuery})`,
          snippet: `【テスト用モックデータ】「${cleanQuery}」についての手順解説です。実データではありません。`,
          url: `https://knowledge.local/search?q=${encodeURIComponent(cleanQuery)}`,
          source: 'Mock (Non-Real)',
        },
      ];
      const mockOutput: AutonomousSearchExecutionResult = {
        results: mockResult,
        summary: `【テスト用モック】「${cleanQuery}」に関するテスト用モックデータです（実データではありません）。`,
        provider: 'mock_fallback',
        providers: [],
        providerStatuses: {
          searxng: { provider: 'searxng', status: 'SKIPPED' },
          wikipedia: { provider: 'wikipedia', status: 'SKIPPED' },
          duckduckgo: { provider: 'duckduckgo', status: 'SKIPPED' },
        },
      };
      this.cache.set(cacheKey, { data: mockOutput, timestamp: Date.now() });
      this.stats.totalSearches++;
      this.stats.lastSearchAt = Date.now();
      this.saveStats();
      return mockOutput;
    }

    const providerStatuses = createProviderStatuses();
    const markProvider = (
      provider: SearchProviderName,
      status: SearchProviderExecutionStatus,
      error?: string,
    ) => {
      providerStatuses[provider] = {
        provider,
        status,
        ...(error ? { error } : {}),
      };
    };

    const runSearxng = async (): Promise<ProviderSearchOutput | null> => {
      try {
        const searxSettings = getSearxngSearchSettings();
        const searxUrl = buildSearxngSearchUrl(searxSettings, cleanQuery);
        const searxRes = await fetch(searxUrl, { signal: AbortSignal.timeout(searxSettings.timeoutMs) });

        if (!searxRes.ok) {
          const reason = `HTTP ${searxRes.status}`;
          markProvider('searxng', 'FAILED', reason);
          systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [SearXNG] 応答失敗: ${reason}`);
          return null;
        }

        const searxData = await searxRes.json();
        const hits = Array.isArray(searxData?.results) ? searxData.results : [];

        if (hits.length === 0) {
          markProvider('searxng', 'EMPTY');
          systemLogger.info('SELF_IMPROVEMENT', 'ℹ️ [SearXNG] 検索結果0件');
          return null;
        }

        const results: WebSearchResultItem[] = hits.slice(0, maxResults).map((hit: any) => {
          const url = typeof hit?.url === 'string' ? hit.url : '';
          const canonicalUrl = canonicalizeSearchUrl(url);
          const item = {
            title: hit?.title || cleanQuery,
            snippet: (hit?.content || hit?.snippet || '').replace(/<[^>]+>/g, '').trim(),
            url,
            source: 'SearXNG (Local)',
            publishedDate: hit?.publishedDate || hit?.published_date,
            engine: typeof hit?.engine === "string" ? hit.engine : "",
            engines: Array.isArray(hit?.engines) ? hit.engines : [],
            author: typeof hit?.author === "string" ? hit.author : "",
            category: typeof hit?.category === "string" ? hit.category : "",
            metadata: typeof hit?.metadata === "string" ? hit.metadata : "",
          };
          const identity = deriveSourceIdentity('searxng', item, canonicalUrl);
          return {
            ...item,
            sourceId: identity.sourceId,
            independenceClusterId: identity.independenceClusterId,
          };
        });

        markProvider('searxng', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🔍 [SearXNG] 並行検索成功: ${results.length}件`);
        return { provider: 'searxng', results };
      } catch (error: any) {
        const reason = error?.name === 'TimeoutError'
          ? 'タイムアウト'
          : error?.message || String(error);
        markProvider('searxng', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [SearXNG] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    const runWikipedia = async (): Promise<ProviderSearchOutput | null> => {
      try {
        const wikiUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=${maxResults}`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });

        if (!wikiRes.ok) {
          const reason = `HTTP ${wikiRes.status}`;
          markProvider('wikipedia', 'FAILED', reason);
          return null;
        }

        const wikiData = await wikiRes.json();
        const hits = Array.isArray(wikiData?.query?.search) ? wikiData.query.search : [];

        if (hits.length === 0) {
          markProvider('wikipedia', 'EMPTY');
          return null;
        }

        const results: WebSearchResultItem[] = hits.slice(0, maxResults).map((hit: any) => {
          const url = `https://ja.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`;
          const canonicalUrl = canonicalizeSearchUrl(url);
          const item = {
            title: hit.title,
            snippet: (hit.snippet || '').replace(/<[^>]+>/g, '').trim(),
            url,
            source: 'Wikipedia (Direct)',
            publishedDate: hit.timestamp,
          };
          const identity = deriveSourceIdentity('wikipedia', item, canonicalUrl);
          return {
            ...item,
            sourceId: identity.sourceId,
            independenceClusterId: identity.independenceClusterId,
          };
        });

        markProvider('wikipedia', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `📖 [Wikipedia] 並行検索成功: ${results.length}件`);
        return { provider: 'wikipedia', results };
      } catch (error: any) {
        const reason = error?.message || String(error);
        markProvider('wikipedia', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Wikipedia] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    const runDuckDuckGo = async (): Promise<ProviderSearchOutput | null> => {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
        const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });

        if (!ddgRes.ok) {
          const reason = `HTTP ${ddgRes.status}`;
          markProvider('duckduckgo', 'FAILED', reason);
          return null;
        }

        const ddgData = await ddgRes.json();
        const results: WebSearchResultItem[] = [];

        const abstractText = (ddgData.AbstractText || ddgData.Abstract || '').trim();
        if (abstractText) {
          const url = ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`;
          const canonicalUrl = canonicalizeSearchUrl(url);
          const item = {
            title: ddgData.Heading || cleanQuery,
            snippet: abstractText,
            url,
            source: `DuckDuckGo (${ddgData.AbstractSource || 'Instant Answer'})`,
          };
          const identity = deriveSourceIdentity('duckduckgo', item, canonicalUrl);
          results.push({
            ...item,
            sourceId: identity.sourceId,
            independenceClusterId: identity.independenceClusterId,
          });
        }

        if (Array.isArray(ddgData.RelatedTopics)) {
          for (const itemData of ddgData.RelatedTopics) {
            if (results.length >= maxResults) break;
            if (itemData?.Text && itemData?.FirstURL) {
              const topicText = String(itemData.Text).trim();
              const url = String(itemData.FirstURL);
              const canonicalUrl = canonicalizeSearchUrl(url);
              const item = {
                title: topicText.split(' - ')[0] || topicText.slice(0, 30),
                snippet: topicText,
                url,
                source: 'DuckDuckGo Instant Answer',
              };
              const identity = deriveSourceIdentity('duckduckgo', item, canonicalUrl);
              results.push({
                ...item,
                sourceId: identity.sourceId,
                independenceClusterId: identity.independenceClusterId,
              });
            }
          }
        }

        if (results.length === 0) {
          markProvider('duckduckgo', 'EMPTY');
          return null;
        }

        markProvider('duckduckgo', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🦆 [DuckDuckGo] 並行検索成功: ${results.length}件`);
        return { provider: 'duckduckgo', results };
      } catch (error: any) {
        const reason = error?.message || String(error);
        markProvider('duckduckgo', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [DuckDuckGo] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    /*
     * P0: Providerを直列フォールバックしない。
     * 3経路を同時に開始し、到着順には依存せずmergeSearchResults()で統合する。
     *
     * preferredProviderは「最初に試すProvider」ではなく、
     * 同率候補の決定論的タイブレーク優先度としてだけ利用する。
     */
    const providerRuns: Array<{
      name: SearchProviderName;
      run: () => Promise<ProviderSearchOutput | null>;
    }> = [
      { name: 'searxng', run: runSearxng },
      { name: 'wikipedia', run: runWikipedia },
      { name: 'duckduckgo', run: runDuckDuckGo },
    ];

    const settled = await Promise.allSettled(
      providerRuns.map(async ({ name, run }) => {
        try {
          return await run();
        } catch (error: any) {
          const reason = error?.message || String(error);
          markProvider(name, 'FAILED', reason);
          return null;
        }
      }),
    );

    const outputs = settled
      .filter((item): item is PromiseFulfilledResult<ProviderSearchOutput | null> => item.status === 'fulfilled')
      .map((item) => item.value)
      .filter((value): value is ProviderSearchOutput => Boolean(value && value.results.length > 0));

    const mergedResults = mergeSearchResults(outputs, preferred, maxResults);
    const successfulProviders = (['searxng', 'wikipedia', 'duckduckgo'] as SearchProviderName[]).filter(
      (provider) => providerStatuses[provider].status === 'SUCCEEDED',
    );

    const result: AutonomousSearchExecutionResult = {
      results: mergedResults,
      summary:
        mergedResults[0]?.snippet ||
        (successfulProviders.length
          ? `「${cleanQuery}」について複数の探索経路から候補を取得しました。`
          : `「${cleanQuery}」について利用可能な探索経路から結果を取得できませんでした。`),
      provider:
        successfulProviders.length > 1
          ? 'parallel'
          : successfulProviders[0] || 'parallel',
      providers: successfulProviders,
      providerStatuses,
    };

    this.stats.totalSearches++;
    this.stats.lastSearchAt = Date.now();
    this.saveStats();

    if (result.results.length > 0) {
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    return {
      ...result,
      summary: `「${cleanQuery}」の検索に失敗しました（各Providerの状態はproviderStatusesを参照）。`,
    };
  }

  /**
   * 検索結果のURLを実際に読み、検索スニペットとは別のWeb内容Evidenceを取得する。
   * SearXNGは探索入口であり、研究時には必要な結果を読むところまでを同一経路で行う。
   */
  public async readSearchResultPages<T extends {
    title: string;
    snippet: string;
    url?: string;
    publishedDate?: string;
    sourceId?: string;
    independenceClusterId?: string;
    claimText?: string;
    source?: string;
    engine?: string;
    engines?: string[];
    author?: string;
    category?: string;
    metadata?: string;
  }>(
    query: string,
    results: T[],
    options?: { maxPages?: number; timeoutMs?: number; renderWaitMs?: number }
  ): Promise<Array<{
    result: T;
    success: boolean;
    text: string;
    url: string;
    error?: string;
  }>> {
    const maxPages = Math.max(1, Math.min(3, options?.maxPages ?? 2));
    const readable = results
      .filter((r) => typeof r.url === 'string' && /^https?:\/\//i.test(r.url))
      .slice(0, maxPages);

    // 各ページ本文取得も並行化する。ただし出力順は入力順に固定する。
    const outputs = await Promise.all(
      readable.map(async (result) => {
        try {
          const page = await this.fetchRenderedPage(result.url!, {
            query,
            timeoutMs: options?.timeoutMs,
            renderWaitMs: options?.renderWaitMs,
          });
          return {
            result,
            success: page.success,
            text: page.text || '',
            url: page.url || result.url!,
            error: page.error,
          };
        } catch (error) {
          return {
            result,
            success: false,
            text: '',
            url: result.url!,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    const successCount = outputs.filter((o) => o.success && o.text.trim()).length;
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📖 [Research Read] 「${query}」の検索結果${readable.length}件を読み取り、${successCount}件の本文取得に成功`
    );
    return outputs;
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
      provider?: string;
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
          approved: false, // 未検証: 自動昇格防止
        };
        storageService.saveMemoryItem(memItem);
        integratedToMemory = true;
        this.stats.knowledgeItemsLearned += extractedKnowledge.length;
      } catch (memErr) {
        console.warn('Failed to integrate search knowledge to longTermMemory:', memErr);
      }
    }

    // 2. Web検索知見を Evidence / Experience として記録 (TrainingSampleへの直接投入を廃止)
    if (this.config.autoLearnToSyntheticData && extractedKnowledge.length > 0) {
      try {
        const experienceId = `exp_search_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const evidenceId = evidenceIdentityService.create('search', `${query}|${extractedKnowledge.join('|')}|${Date.now()}`);
        experienceLinkService.getOrCreateLink(experienceId, 'web_search', `Web検索知見獲得: ${query.slice(0, 40)}`);
        experienceLinkService.linkEntity(experienceId, 'evidence', evidenceId);

        // 検索結果は無条件で正解とせず、未検証の能力改善候補(approved: false)として記録し、
        // 独立検証(Verification)を経てからCapability/骨格へ昇格させる
        selfImprovementService.registerCapabilityCandidate({
          instruction: `「${query}」についての最新情報や仕様、知見を説明してください。`,
          outputTarget: summary || extractedKnowledge.join('\n'),
          category: 'retrieval',
          reliability: 'medium',
          source: 'web_search',
          approved: false, // 未検証: 自動昇格防止
          verifiedEffective: false,
          verificationNote: `Web検索未検証証拠: ${query.slice(0, 30)}`,
          experienceId,
          evidenceIds: [evidenceId],
        });
        integratedToSyntheticData = true;
      } catch (synErr) {
        console.warn('Failed to integrate search knowledge to capability candidates:', synErr);
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
        const itemProvider = options?.provider ||
          (r.source?.includes('SearXNG') ? 'searxng' :
           r.source?.includes('Wikipedia') ? 'wikipedia_direct' :
           r.source?.includes('DuckDuckGo') ? 'duckduckgo_direct' : undefined);

        const skeletonCand = WebMaterialPatternExtractor.extractSkeletonStructuresFromWebText({
          title: r.title,
          snippet: r.snippet,
          summary,
          sourceQuery: query,
          sourceUrl: r.url,
          provider: itemProvider,
          fetchMethod: 'api',
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
        const topProvider = options?.provider ||
          (results[0]?.source?.includes('SearXNG') ? 'searxng' :
           results[0]?.source?.includes('Wikipedia') ? 'wikipedia_direct' :
           results[0]?.source?.includes('DuckDuckGo') ? 'duckduckgo_direct' : undefined);

        const surfacePatterns = WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({
          text: combinedSnippets,
          sourceQuery: query,
          sourceUrl: results[0]?.url || '',
          provider: topProvider,
          fetchMethod: 'api',
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

  /**
   * 指示1 & 指示5: ネイティブ(またはフォールバック)のヘッドレスWebViewを用いて
   * 指定URLを完全レンダリングし、innerTextを抽出・自律学習パターン化する
   */
  public async fetchRenderedPage(url: string, options?: { timeoutMs?: number; renderWaitMs?: number; query?: string }): Promise<{
    success: boolean;
    text: string;
    url: string;
    length: number;
    patternsCount: number;
    error?: string;
  }> {
    systemLogger.info('SELF_IMPROVEMENT', `🌐 [HeadlessWebView] ページ取得開始: ${url}`);
    const result = await nativeWorkManagerService.fetchRenderedPage(url, options);
    if (!result.success || !result.text) {
      systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [HeadlessWebView] ページ取得失敗: ${url} (${result.error || '空データ'})`);
      return { ...result, patternsCount: 0 };
    }

    const text = result.text;
    const query = options?.query || url;
    let patternsCount = 0;

    // 縦(骨格)の抽出・登録
    try {
      const skeleton = WebMaterialPatternExtractor.extractSkeletonStructuresFromWebText({
        title: text.slice(0, 50),
        snippet: text.slice(0, 300),
        summary: text.slice(0, 150),
        sourceQuery: query,
        sourceUrl: url,
        provider: 'headless_webview',
        fetchMethod: 'headless_webview',
      });
      if (skeleton) {
        answerPlanService.registerSkeletonFromWebObservation(skeleton);
        patternsCount++;
      }
    } catch (e) {
      console.warn('Failed to extract skeleton from headless webview page:', e);
    }

    // 横(言い回し)の抽出・登録
    try {
      const surfacePatterns = WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({
        text: text.slice(0, 1500),
        sourceQuery: query,
        sourceUrl: url,
        provider: 'headless_webview',
        fetchMethod: 'headless_webview',
      });
      if (surfacePatterns.length > 0) {
        surfaceVariationGrowthService.processWebMaterialForVariationGrowth(surfacePatterns, 1);
        patternsCount += surfacePatterns.length;
      }
    } catch (e) {
      console.warn('Failed to extract surface patterns from headless webview page:', e);
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `✅ [HeadlessWebView] ページ取得完了: ${url} (${result.length}文字, ${patternsCount}個のパターン/骨格を抽出, fetchMethod: headless_webview)`
    );

    return {
      success: true,
      text,
      url,
      length: result.length,
      patternsCount,
    };
  }
}

export const autonomousSearchService = new AutonomousSearchService();

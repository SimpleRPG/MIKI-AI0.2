import {
  WebSearchResultItem,
  AutonomousSearchLearningRecord,
  AutonomousSearchMessageMeta,
  MemoryItem,
} from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { getSearxngSearchSettings, buildSearxngSearchUrl } from './searxngSettingsService';
import { sourceTrustBonus } from './sourceTrustService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { workingAgendaService } from '../../strategy/services/workingAgendaService';
import { selfImprovementService } from '../../improvement/services/selfImprovementService';
import { experienceLinkService } from '../../experience/services/experienceLinkService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { sanitizeOutboundPayload } from '../../safety/services/outboundPayloadSanitizer';
import { bannedTopicsConfigService } from '../../safety/services/bannedTopicsConfigService';
import { WebMaterialPatternExtractor } from './webMaterialPatternExtractor';
import { answerPlanService } from '../../strategy/services/answerPlanService';
import { surfaceVariationGrowthService } from '../../conversation/services/surfaceVariationGrowthService';
import { nativeWorkManagerService } from '../../execution/services/nativeWorkManagerService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { evidenceService, isSyntheticWebMaterial } from '../../memory/services/evidenceService';

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

export type SearchProviderName = 'searxng' | 'wikipedia' | 'openalex' | 'marginalia';

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
  // P418: pacer snapshot at the end of this search (interval
  // multiplier, effective interval, cooldown) -- readable material
  // for later learning, alongside the provider statuses.
  searchPacer?: SearchPacerSnapshot;
}

interface ProviderSearchOutput {
  provider: SearchProviderName;
  results: WebSearchResultItem[];
}

function compareStableText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// P415: every SearXNG response carries an unresponsive_engines list
// ([engine, reason] pairs) naming the engines that did not contribute
// to that answer and why. Until P415 nothing in this codebase read it,
// so an empty answer arrived with its explanation attached and the
// explanation was thrown away. The classifier below turns the raw
// reason strings into short labels; a reason that matches no known
// class keeps its raw text in the summary so no information is lost.
// "Suspended:" reasons are SearXNG-side engine suspensions (shipped
// settings: 180s for too many requests / access denied, 3600s for a
// CAPTCHA), during which the engine is not queried at all.
interface SearxngUnresponsiveEngine {
  engine: string;
  label: string;
  suspended: boolean;
}

function classifySearxngUnresponsive(rawEntries: unknown): {
  summary: string;
  allSuspended: boolean;
  hasCaptchaSuspension: boolean;
} {
  const list = Array.isArray(rawEntries) ? rawEntries : [];
  const byEngine = new Map<string, SearxngUnresponsiveEngine>();
  let hasCaptchaSuspension = false;
  for (const entry of list) {
    let engine = '';
    let reason = '';
    if (Array.isArray(entry)) {
      engine = String(entry[0] ?? '');
      reason = String(entry[1] ?? '');
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      engine = String(record.engine ?? record.name ?? '');
      reason = String(record.error ?? record.reason ?? record.message ?? '');
    } else if (typeof entry === 'string') {
      reason = entry;
    }
    engine = engine.trim();
    reason = reason.trim();
    if (!engine && !reason) continue;
    const lower = reason.toLowerCase();
    // P417: on-device SearXNG localizes its reason strings, e.g.
    // "一時停止: リクエストが多すぎます" for a too-many-requests
    // suspension. The manual curl checks that informed P415 sent no
    // language preference and saw the English forms, so the original
    // English-only patterns filed every real device reason under
    // その他, allSuspended never stood, and the skip-the-retry rule
    // never engaged on device (device log 2026-11-04 17:41 JST).
    // Match the Japanese forms alongside the English ones.
    const tooManyRequests =
      /too many requests|429/.test(lower) ||
      reason.includes('リクエストが多すぎます') ||
      reason.includes('多すぎます');
    const suspended =
      lower.includes('suspended') ||
      reason.includes('一時停止') ||
      reason.includes('停止中') ||
      // A bare too-many-requests answer (no suspension prefix) puts
      // the engine under a SearXNG suspension from that response on,
      // so an immediate retry is just as pointless as with the
      // prefixed form; count it as suspension class as well.
      tooManyRequests;
    let label: string;
    if (suspended && tooManyRequests) label = '停止中-リクエスト過多';
    else if (suspended && (lower.includes('captcha') || reason.includes('キャプチャ'))) { label = '停止中-CAPTCHA'; hasCaptchaSuspension = true; }
    else if (suspended && (/access denied|denied|forbidden|\b40[23]\b/.test(lower) || reason.includes('拒否'))) label = '停止中-アクセス拒否';
    else if (suspended) label = '停止中';
    else if (/timeout|timed out/.test(lower) || reason.includes('タイムアウト')) label = 'タイムアウト';
    else if (/pars|xpath/.test(lower) || reason.includes('解析エラー')) label = '解析エラー';
    else if (/http|\b[45]\d\d\b/.test(lower)) label = 'HTTPエラー';
    else label = 'その他';
    // Keep the raw text whenever the label alone would lose the
    // actual reason (generic suspension, HTTP error, unknown text).
    const keepRaw = label === '停止中' || label === 'HTTPエラー' || label === 'その他';
    const text = keepRaw && reason ? `${label}（${reason.slice(0, 80)}）` : label;
    const key = engine || '(unknown)';
    byEngine.set(key, { engine: key, label: text, suspended });
  }
  const engines = [...byEngine.values()].slice(0, 8);
  return {
    summary: engines.map((item) => `${item.engine}=${item.label}`).join('、'),
    allSuspended: engines.length > 0 && engines.every((item) => item.suspended),
    // P418: the pacer prices a CAPTCHA-class suspension into a
    // longer cooldown than a rate/access suspension, so the class
    // has to survive classification alongside allSuspended.
    hasCaptchaSuspension,
  };
}

// P418: search pacer -- one gate for every SearXNG launch.
// Until P417 each task in the improvement queue fired its searches
// independently, so MIKI as a whole behaved like a burst client
// against its own SearXNG: on 2026-11-04 the bursts drove every
// general engine into rate-limit suspensions at once (brave and
// google cse both "too many requests", 180s), and the queue kept
// probing the suspended engines. The pacer turns all SearXNG
// traffic into one calm caller:
//   * gate: at most SEARCH_PACER_MAX_CONCURRENT passes run at once
//     and launches are spaced by an effective start interval
//     (base 2s, adapted by outcome, see below). A pass is the whole
//     attempt sequence of one search (P414's retry included); the
//     gate is acquired once per search and never re-entered by the
//     retry. Cache hits never reach the gate (they leave no network
//     trace), and Wikipedia is exempt (large allowance, independent
//     operator). OpenAlex is budgeted separately (see executeSearch).
//   * cooldown: when a pass ends with every engine suspended
//     (P415/P417 classification), SearXNG is not queried again
//     until the suspension class expires (rate/access class 180s,
//     CAPTCHA class 600s). A search that arrives during cooldown
//     returns immediately with the cooldown as its recorded reason
//     -- the research layer's evidence-wait backoff becomes the
//     wait, and no probe is wasted on a suspended engine.
//   * adaptation: suspension-class empties and HTTP 429 double the
//     interval multiplier (cap x5); a successful SearXNG pass halves
//     it back toward x1. The multiplier and the effective interval
//     stay readable via getSearchPacerState() and ride each search
//     result, as material for later learning.
//   * lanes: foreground searches (the user's live conversation and
//     tools) pass the queue ahead of background ones (improvement
//     loop, workers, audits). A running pass is never interrupted.
// The state lives in memory only: an app restart resets it, exactly
// like the SearXNG-side suspension timers it mirrors. There is no
// resident timer loop -- the single wake timer exists only while
// callers are queued and clears itself when it fires; every wait is
// a delay inside the waiting search's own execution.
export type SearchLane = 'foreground' | 'background';

export type SearchPacerCooldownTier = 'rate' | 'captcha';

export interface SearchPacerSnapshot {
  baseIntervalMs: number;
  intervalMultiplier: number;
  effectiveIntervalMs: number;
  maxConcurrent: number;
  inFlight: number;
  queuedForeground: number;
  queuedBackground: number;
  cooldownRemainingMs: number;
  cooldownTier: '' | SearchPacerCooldownTier;
  cooldownReason: string;
}

interface SearchPacerWaiter {
  lane: SearchLane;
  grant: () => void;
}

interface SearxngPassOutcome {
  output: ProviderSearchOutput | null;
  emptyReason?: string;
  suspensionTier?: SearchPacerCooldownTier | null;
  httpStatus?: number;
  cooledDown?: boolean;
}

const SEARCH_PACER_BASE_INTERVAL_MS = 2000;
const SEARCH_PACER_MAX_CONCURRENT = 2;
const SEARCH_PACER_MAX_MULTIPLIER = 5;
const SEARCH_PACER_COOLDOWN_RATE_MS = 180 * 1000;
const SEARCH_PACER_COOLDOWN_CAPTCHA_MS = 600 * 1000;

const searchPacer = {
  inFlight: 0,
  lastStartAt: 0,
  intervalMultiplier: 1,
  cooldownUntil: 0,
  cooldownTier: '' as '' | SearchPacerCooldownTier,
  cooldownReason: '',
  queue: [] as SearchPacerWaiter[],
  wakeTimer: null as ReturnType<typeof setTimeout> | null,
};

function searchPacerEffectiveIntervalMs(): number {
  return Math.round(SEARCH_PACER_BASE_INTERVAL_MS * searchPacer.intervalMultiplier);
}

function searchPacerCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, searchPacer.cooldownUntil - now);
}

function snapshotSearchPacer(): SearchPacerSnapshot {
  return {
    baseIntervalMs: SEARCH_PACER_BASE_INTERVAL_MS,
    intervalMultiplier: searchPacer.intervalMultiplier,
    effectiveIntervalMs: searchPacerEffectiveIntervalMs(),
    maxConcurrent: SEARCH_PACER_MAX_CONCURRENT,
    inFlight: searchPacer.inFlight,
    queuedForeground: searchPacer.queue.filter((w) => w.lane === 'foreground').length,
    queuedBackground: searchPacer.queue.filter((w) => w.lane === 'background').length,
    cooldownRemainingMs: searchPacerCooldownRemainingMs(),
    cooldownTier: searchPacer.cooldownTier,
    cooldownReason: searchPacer.cooldownReason,
  };
}

function searchPacerScheduleWake(delayMs: number): void {
  if (searchPacer.wakeTimer) return;
  searchPacer.wakeTimer = setTimeout(() => {
    searchPacer.wakeTimer = null;
    searchPacerPump();
  }, Math.max(0, delayMs));
}

function searchPacerPump(): void {
  while (searchPacer.queue.length > 0) {
    if (searchPacer.inFlight >= SEARCH_PACER_MAX_CONCURRENT) return;
    const now = Date.now();
    const waitMs = searchPacer.lastStartAt + searchPacerEffectiveIntervalMs() - now;
    if (waitMs > 0) {
      searchPacerScheduleWake(waitMs);
      return;
    }
    let index = searchPacer.queue.findIndex((w) => w.lane === 'foreground');
    if (index < 0) index = 0;
    const [waiter] = searchPacer.queue.splice(index, 1);
    searchPacer.inFlight += 1;
    searchPacer.lastStartAt = now;
    waiter.grant();
  }
}

function acquireSearchGate(lane: SearchLane): Promise<void> {
  return new Promise((resolve) => {
    searchPacer.queue.push({ lane, grant: resolve });
    searchPacerPump();
  });
}

function releaseSearchGate(): void {
  searchPacer.inFlight = Math.max(0, searchPacer.inFlight - 1);
  searchPacerPump();
}

function searchPacerNotePressure(source: string): void {
  const next = Math.min(SEARCH_PACER_MAX_MULTIPLIER, searchPacer.intervalMultiplier * 2);
  if (next !== searchPacer.intervalMultiplier) {
    searchPacer.intervalMultiplier = next;
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `ℹ️ [検索ペーサー] 制限圧力（${source}）のため発射間隔を実効${searchPacerEffectiveIntervalMs()}ms（倍率${next}）へ拡大`,
    );
  }
}

function searchPacerNoteSuccess(): void {
  if (searchPacer.intervalMultiplier > 1) {
    searchPacer.intervalMultiplier = Math.max(1, searchPacer.intervalMultiplier / 2);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `ℹ️ [検索ペーサー] SearXNG成功を受け発射間隔を実効${searchPacerEffectiveIntervalMs()}ms（倍率${searchPacer.intervalMultiplier}）へ緩和`,
    );
  }
}

function searchPacerStartCooldown(tier: SearchPacerCooldownTier, reasonSummary: string): void {
  const durationMs =
    tier === 'captcha' ? SEARCH_PACER_COOLDOWN_CAPTCHA_MS : SEARCH_PACER_COOLDOWN_RATE_MS;
  const until = Date.now() + durationMs;
  if (until > searchPacer.cooldownUntil) searchPacer.cooldownUntil = until;
  searchPacer.cooldownTier = tier;
  if (reasonSummary) searchPacer.cooldownReason = reasonSummary;
  systemLogger.info(
    'SELF_IMPROVEMENT',
    `⏸️ [検索ペーサー] SearXNG冷却を開始（${tier === 'captcha' ? 'CAPTCHA級' : 'リクエスト過多・アクセス拒否級'}、約${Math.round(durationMs / 1000)}秒）: ${reasonSummary || 'エンジン停止中'}`,
  );
}

function resetSearchPacerState(): void {
  if (searchPacer.wakeTimer) {
    clearTimeout(searchPacer.wakeTimer);
    searchPacer.wakeTimer = null;
  }
  const waiters = searchPacer.queue.splice(0, searchPacer.queue.length);
  searchPacer.inFlight = 0;
  searchPacer.lastStartAt = 0;
  searchPacer.intervalMultiplier = 1;
  searchPacer.cooldownUntil = 0;
  searchPacer.cooldownTier = '';
  searchPacer.cooldownReason = '';
  for (const waiter of waiters) waiter.grant();
}

// P416: free supplemental providers (Wikipedia / OpenAlex) run in
// parallel with the SearXNG main route under a hard 3-second cap
// (method A of the 2026-11-04 free-source survey): the main route is
// never waited on, whatever arrives inside the cap is merged, and a
// supplement that misses the cap simply does not exist for that
// search. Supplements get no retry of their own (retries stay
// centralized in the main route: P361/P414/P415) and a supplement
// failure never fails the search as a whole.
const SUPPLEMENTAL_PROVIDER_TIMEOUT_MS = 3000;

// Wikimedia's User-Agent policy asks for an identifiable agent
// string. This carries the project's public repository URL only --
// no personal contact information (no mail address) is ever sent.
const SUPPLEMENTAL_USER_AGENT = 'MIKI-AI/1.0 (https://github.com/SimpleRPG/MIKI-AI0.2)';

// API endpoints are overridable through storage keys (same pattern
// as miki_searxng_base_url) so the endpoints can be pointed at a
// stub in verification and, if ever needed, at a mirror in operation.
function readSupplementalApiUrl(storageKey: string, fallback: string): string {
  try {
    const value = storageService.getItem(storageKey);
    if (typeof value === 'string' && value.trim()) return value.trim();
  } catch {
    // fall through to the default endpoint
  }
  return fallback;
}

// OpenAlex returns abstracts as an inverted index (word -> positions).
// Rebuild the plain text so it can ride the normal snippet field.
function reconstructOpenAlexAbstract(invertedIndex: unknown): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (typeof position === 'number' && Number.isInteger(position) && position >= 0) {
        words[position] = word;
      }
    }
  }
  return words.join(' ').replace(/\s+/g, ' ').trim();
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

function contentFingerprint(title: string, snippet: string): string | null {
  const normalizedTitle = String(title || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
  if (normalizedTitle.length < 8) return null;
  const normalizedLead = String(snippet || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 40);
  return `${normalizedTitle}|${normalizedLead}`;
}

/**
 * P387: independence was judged by hostname alone, so the same wire
 * story reprinted by several portals counted as several independent
 * sources, and the research policy could be "satisfied" by copies of
 * a single report. Items from different hosts whose title and lead
 * agree (a reprint fingerprint) now share one content cluster; only
 * genuinely distinct reporting keeps separate clusters.
 */
export function applyContentIndependenceClusters<T extends { title: string; snippet: string; url?: string; independenceClusterId?: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const fingerprint = contentFingerprint(item.title, item.snippet);
    if (!fingerprint) continue;
    const group = groups.get(fingerprint);
    if (group) group.push(item); else groups.set(fingerprint, [item]);
  }
  for (const [fingerprint, group] of groups) {
    if (group.length < 2) continue;
    const hosts = new Set(group.map((item) => { try { return new URL(String(item.url || '')).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }));
    hosts.delete('');
    if (hosts.size < 2) continue;
    const clusterId = `cluster_content_${canonicalSha256Object({ fingerprint }).slice(0, 12)}`;
    for (const item of group) item.independenceClusterId = clusterId;
  }
  return items;
}

/**
 * Provider結果を、固定ルールで整列・重複排除する。
 * maxResultsは取得上限として扱う（合流上限は成功Provider数に応じて広がるため、
 * 補助Providerの結果が主経路SearXNGの結果を押し出すことはない）。
 */
export function mergeSearchResults(
  outputs: ProviderSearchOutput[],
  preferredProvider: 'auto' | SearchProviderName = 'auto',
  maxResults = 4,
): WebSearchResultItem[] {
  const preferredOrder: SearchProviderName[] = ['searxng', 'wikipedia', 'openalex', 'marginalia'];

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
          provider: output.provider,
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
    // P490: 出典の信頼度ルールを並びにだけ効かせる（一次情報に
    // 近い出典をわずかに前へ、まとめ側をわずかに後ろへ）。保存
    // される関連度そのものは変えない。
    const relevanceDelta =
      (b.item.relevanceScore ?? 0) + sourceTrustBonus(b.item.url) -
      ((a.item.relevanceScore ?? 0) + sourceTrustBonus(a.item.url));
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

  return applyContentIndependenceClusters(Array.from(deduped.values()).slice(0, maxCombinedResults));
}

function createProviderStatuses(): Record<SearchProviderName, SearchProviderStatusRecord> {
  return {
    searxng: { provider: 'searxng', status: 'FAILED', error: 'NOT_RUN' },
    wikipedia: { provider: 'wikipedia', status: 'FAILED', error: 'NOT_RUN' },
    openalex: { provider: 'openalex', status: 'FAILED', error: 'NOT_RUN' },
    marginalia: { provider: 'marginalia', status: 'FAILED', error: 'NOT_RUN' },
  };
}

function isSyntheticSearchResult(result: WebSearchResultItem): boolean {
  return isSyntheticWebMaterial({
    title: String(result.title || ''),
    snippet: String(result.snippet || ''),
    source: String(result.source || ''),
    url: String(result.url || ''),
  });
}

export function isSourceBackedSearchResult(result: WebSearchResultItem): boolean {
  const source = String(result.source || '').trim();
  const rawUrl = String(result.url || '').trim();
  if (!source || !rawUrl || isSyntheticSearchResult(result)) return false;

  try {
    const parsedUrl = new URL(rawUrl);
    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      Boolean(parsedUrl.hostname) &&
      !parsedUrl.username &&
      !parsedUrl.password
    );
  } catch {
    return false;
  }
}

// P485: her own classified diagnosis of why search is (or was)
// failing -- the record form of the investigation process (notice a
// pattern in outcomes, classify the cause as hers vs upstream vs
// budget, act on it, keep the conclusion). Persisted so a restart
// does not erase what she concluded, and readable via
// getSearchSelfDiagnosis().
export type SearchSelfDiagnosisCause = 'NONE' | 'UPSTREAM_SUSPENDED' | 'BUDGET_EXHAUSTED' | 'RECOVERED';
export interface SearchSelfDiagnosis {
  cause: SearchSelfDiagnosisCause;
  detail: string;
  at: number;
  until?: number;
}
const SEARCH_SELF_DIAGNOSIS_KEY = 'miki_search_self_diagnosis_v1';
const OPENALEX_BUDGET_BLOCK_KEY = 'miki_openalex_budget_block_v1';
// P485: empty outcomes are cached for a shorter window than hits --
// long enough to stop the exact-duplicate re-fires the device logs
// showed (same query up to 4x in one window), short enough that a
// recovered upstream is retried reasonably soon.
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000;

const SEARCH_CONFIG_KEY='miki_autonomous_search_config_v1';
const SEARCH_STATS_KEY='miki_autonomous_search_stats_v1';
const SEARCH_RECORDS_KEY='miki_autonomous_search_records_v1';
const UNVERIFIED_RESEARCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// P432: how long a failed page URL is remembered (in-memory only).
// A URL that just timed out is skipped instead of being re-fetched
// on every research pass.
const FAILED_PAGE_URL_MEMORY_MS = 30 * 60 * 1000;
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
  private cache: Map<string, { data: AutonomousSearchExecutionResult; timestamp: number; negative?: boolean }> = new Map();
  // P485: self-diagnosis of the search infrastructure (see the type
  // above) and the OpenAlex daily-budget block. Both persisted.
  private selfDiagnosis: SearchSelfDiagnosis = { cause: 'NONE', detail: '', at: 0 };
  private openAlexBudgetBlockedUntil = 0;
  // P432: failed page reads, in-memory only (URL -> failedAt). No
  // persistence, no timer; stale entries are dropped when re-checked.
  private failedPageUrls = new Map<string, number>();

  constructor() {
    this.config = this.loadConfig();
    this.stats = this.loadStats();
    // P485: restore the self-diagnosis and any live OpenAlex budget
    // block, so a restart does not make her re-spend a budget she
    // already concluded is exhausted.
    try {
      const savedDiagnosis = storageService.getItem(SEARCH_SELF_DIAGNOSIS_KEY);
      if (savedDiagnosis) {
        const parsed = JSON.parse(savedDiagnosis);
        if (parsed && typeof parsed.cause === 'string') this.selfDiagnosis = parsed;
      }
      const savedBlock = storageService.getItem(OPENALEX_BUDGET_BLOCK_KEY);
      if (savedBlock) {
        const parsed = JSON.parse(savedBlock);
        if (typeof parsed?.blockedUntil === 'number') this.openAlexBudgetBlockedUntil = parsed.blockedUntil;
      }
    } catch {
      // Diagnosis/block are auxiliary state; defaults stand.
    }
  }

  // P485: record a classified cause for the search layer's state.
  // The log line states the conclusion in her terms (what is wrong,
  // whose side it is on, what she will do meanwhile) -- the same
  // shape as an investigator's report, kept where later turns and
  // the operational snapshot can find it.
  private recordSelfDiagnosis(cause: SearchSelfDiagnosisCause, detail: string, until?: number): void {
    const previous = this.selfDiagnosis;
    this.selfDiagnosis = {
      cause,
      detail: detail.slice(0, 300),
      at: Date.now(),
      ...(until ? { until } : {}),
    };
    try {
      storageService.setItem(SEARCH_SELF_DIAGNOSIS_KEY, JSON.stringify(this.selfDiagnosis));
    } catch {
      // Auxiliary record; losing it must not break the search.
    }
    if (previous.cause !== cause || cause === 'UPSTREAM_SUSPENDED' || cause === 'BUDGET_EXHAUSTED') {
      const sentence =
        cause === 'UPSTREAM_SUSPENDED'
          ? '検索が振るわない原因は、クエリではなく上流エンジンの停止と判断しました。冷却が明けるまで検索を控えます'
          : cause === 'BUDGET_EXHAUSTED'
            ? 'OpenAlex の無料予算が枯渇したと判断しました。UTC 深夜のリセットまで OpenAlex を止めます'
            : '検索基盤の回復を確認しました';
      systemLogger.info('SELF_IMPROVEMENT', `🩺 [自己診断] ${sentence}（詳細: ${this.selfDiagnosis.detail}）`);
    }
  }

  private noteSearchRecovered(): void {
    if (this.selfDiagnosis.cause === 'UPSTREAM_SUSPENDED') {
      this.recordSelfDiagnosis('RECOVERED', 'SearXNG が結果を返しました');
    }
  }

  // P485: a budget-exhaustion 429 from OpenAlex means the shared
  // daily budget is gone until the UTC-midnight reset. Remembering
  // that conclusion stops the rescue path from re-spending calls
  // that cannot succeed (device-observed: 34 calls in one window
  // after the budget was already known to be $0).
  private blockOpenAlexForBudget(detail: string): void {
    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);
    this.openAlexBudgetBlockedUntil = reset.getTime();
    try {
      storageService.setItem(OPENALEX_BUDGET_BLOCK_KEY, JSON.stringify({ blockedUntil: this.openAlexBudgetBlockedUntil }));
    } catch {
      // Auxiliary record; the in-memory block still holds.
    }
    this.recordSelfDiagnosis('BUDGET_EXHAUSTED', detail, this.openAlexBudgetBlockedUntil);
  }

  public getSearchSelfDiagnosis(): SearchSelfDiagnosis {
    return { ...this.selfDiagnosis };
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

  // P418: the pacer state is in-memory only by design (an app
  // restart resets it, like the SearXNG-side suspension timers).
  public getSearchPacerState(): SearchPacerSnapshot {
    return snapshotSearchPacer();
  }

  /**
   * P418: reset the in-memory search pacer (queued waiters are
   * granted, interval multiplier and cooldown cleared). Intended
   * for verification and for an operator reset after a SearXNG-side
   * settings change; not for use while searches are in flight.
   */
  public resetSearchPacer(): void {
    resetSearchPacerState();
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

  private hasRecentUnverifiedResearch(
    query: string,
    triggerType: 'working_agenda' | 'capability_gap',
  ): boolean {
    const now = Date.now();
    return this.getRecentRecords(100).some(record =>
      record.query === query &&
      record.triggerType === triggerType &&
      record.verificationStatus !== 'VERIFIED' &&
      now - Number(record.timestamp || 0) < UNVERIFIED_RESEARCH_COOLDOWN_MS
    );
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
      preferredProvider?: 'auto' | 'searxng';
      // P418: queue lane at the shared SearXNG gate (default
      // background). Foreground is for the user's live searches.
      lane?: SearchLane;
      // P418: the caller's plan marks an official/scholarly source
      // intent (researchService threads sourceTierTarget
      // PRIMARY_OR_OFFICIAL as this flag). Only then does OpenAlex
      // fire in parallel; otherwise it is a rescue-only provider.
      officialSourceIntent?: boolean;
    }
  ): Promise<{ results: WebSearchResultItem[]; summary?: string; provider?: string }> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return { results: [] };

    // Mandatory baseline sanitization runs before the configurable privacy audit.
    // Only the parsed sanitized payload may be used for cache keys or provider requests.
    const outbound = sanitizeOutboundPayload(cleanQuery, (serialized) =>
      privacyGuardrailService.auditOutboundContent(serialized, 'web_search', { autoSanitize: true })
    );
    if (!outbound.allowed || typeof outbound.payload !== 'string') {
      systemLogger.warn('SELF_IMPROVEMENT', '🚫 [Web検索遮断] outbound sanitization failed; query redacted');
      return { results: [], summary: 'プライバシー保護のため検索を安全にスキップしました。' };
    }
    const safeQuery = outbound.payload;

    // 作業指示書 v19: 禁止トピック手動設定によるクエリ遮断
    const bannedQueryCheck = bannedTopicsConfigService.checkBanned(safeQuery);
    if (bannedQueryCheck.isBanned) {
      systemLogger.warn('SELF_IMPROVEMENT', '🚫 [Web検索遮断] 禁止トピックに該当したため中断 (query redacted)');
      return { results: [], summary: '禁止トピックに該当するため安全にスキップしました。' };
    }

    const preferred = options?.preferredProvider || 'auto';
    const maxResults = Math.max(1, options?.maxResults ?? this.config.maxResults ?? 4);
    const cacheKey = `${safeQuery.toLowerCase()}|preferred:${preferred}|perProvider:${maxResults}`;

    if (!options?.bypassCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      // P485: negative (empty) entries live for the shorter TTL.
      const ttl = cached.negative ? NEGATIVE_CACHE_TTL_MS : 3600000;
      if (Date.now() - cached.timestamp < ttl) {
        if (cached.negative) {
          systemLogger.info('SELF_IMPROVEMENT', 'ℹ️ [検索キャッシュ] 直近に同じ検索が空だったため、再送せず記録を返します');
        }
        return cached.data;
      }
    }

    if (this.config.allowFallbackMock) {
      const mockResult: WebSearchResultItem[] = [
        {
          title: `【テスト用モック】トラブルシューティング ガイド (${safeQuery})`,
          snippet: `【テスト用モックデータ】「${safeQuery}」についての手順解説です。実データではありません。`,
          url: `https://knowledge.local/search?q=${encodeURIComponent(safeQuery)}`,
          source: 'Mock (Non-Real)',
        },
      ];
      const mockOutput: AutonomousSearchExecutionResult = {
        results: mockResult,
        summary: `【テスト用モック】「${safeQuery}」に関するテスト用モックデータです（実データではありません）。`,
        provider: 'mock_fallback',
        providers: [],
        providerStatuses: {
          searxng: { provider: 'searxng', status: 'SKIPPED' },
          wikipedia: { provider: 'wikipedia', status: 'SKIPPED' },
          openalex: { provider: 'openalex', status: 'SKIPPED' },
          marginalia: { provider: 'marginalia', status: 'SKIPPED' },
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

    const attemptSearxng = async (): Promise<{ output: ProviderSearchOutput | null; retryable: boolean; empty: boolean; emptyReason?: string; suspensionTier?: SearchPacerCooldownTier | null; httpStatus?: number }> => {
      try {
        const searxSettings = getSearxngSearchSettings();
        const searxUrl = buildSearxngSearchUrl(searxSettings, safeQuery);
        const searxRes = await fetch(searxUrl, { signal: AbortSignal.timeout(searxSettings.timeoutMs) });

        if (!searxRes.ok) {
          const reason = `HTTP ${searxRes.status}`;
          markProvider('searxng', 'FAILED', reason);
          systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [SearXNG] 応答失敗: ${reason}`);
          return { output: null, retryable: searxRes.status >= 500, empty: false, httpStatus: searxRes.status };
        }

        const searxData = await searxRes.json();
        const hits = Array.isArray(searxData?.results) ? searxData.results : [];

        if (hits.length === 0) {
          // P414: no log line here. The 検索結果0件 line is emitted by
          // runSearxng only when the pass still ends empty after the
          // retry, so the line keeps its meaning (this search ended
          // with no results) instead of firing per attempt.
          // P415: the same response says WHY it is empty
          // (unresponsive_engines). Classify and keep that reason: it
          // rides providerStatuses and the failure summary into the
          // research record instead of being discarded.
          const unresponsive = classifySearxngUnresponsive((searxData as any)?.unresponsive_engines);
          const emptyReason = unresponsive.summary || undefined;
          markProvider('searxng', 'EMPTY', emptyReason);
          return {
            output: null,
            // P415: P414's single retry stays for empties that look
            // transient (timeouts, parse errors, mixed causes, or no
            // reason information at all). When every silent engine is
            // under a SearXNG suspension (>= 180s by the shipped
            // settings) an immediate retry cannot succeed, so the
            // pass ends here and the research layer's evidence-wait
            // backoff becomes the wait instead.
            retryable: !unresponsive.allSuspended,
            empty: true,
            emptyReason,
            // P418: when every silent engine is suspended, the
            // suspension class rides along so the pacer can price
            // its cooldown (CAPTCHA class waits longer).
            suspensionTier: unresponsive.allSuspended
              ? unresponsive.hasCaptchaSuspension
                ? 'captcha'
                : 'rate'
              : null,
          };
        }

        const results: WebSearchResultItem[] = hits.slice(0, maxResults).map((hit: any) => {
          const url = typeof hit?.url === 'string' ? hit.url : '';
          const canonicalUrl = canonicalizeSearchUrl(url);
          const item = {
            title: hit?.title || safeQuery,
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

        applyContentIndependenceClusters(results);
        markProvider('searxng', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🔍 [SearXNG] 検索成功: ${results.length}件`);
        return { output: { provider: 'searxng', results }, retryable: false, empty: false };
      } catch (error: any) {
        const reason = error?.name === 'TimeoutError'
          ? 'タイムアウト'
          : error?.message || String(error);
        markProvider('searxng', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [SearXNG] 探索経路失敗: ${reason}`);
        return { output: null, retryable: true, empty: false };
      }
    };

    // P361: SearXNG is the single research route (P348), so a transient
    // failure must not zero out the whole pass. Retry exactly once, and
    // only for transient causes (network error, timeout, HTTP 5xx).
    // P414: an empty result set receives the same single retry. Under
    // engine load or rate limiting SearXNG answers with zero results
    // for a moment (device-observed 2026-11-04: the same queries,
    // including the full planner text, returned results when issued
    // manually moments later), so treating an empty answer as final
    // made a transient zero permanent for that search while fetch
    // failures were already retried. A pass that still ends empty
    // logs 検索結果0件 exactly once here and stays EMPTY downstream.
    // P415: that retry is now skipped when the empty answer's reasons
    // are all SearXNG engine suspensions -- the engines stay silent
    // for at least 180s, so an immediate second attempt would only
    // repeat the same empty answer. The reason summary is returned
    // alongside so the final log line and the search summary can
    // state what limited the search.
    const runSearxng = async (): Promise<SearxngPassOutcome> => {
      let attempt = await attemptSearxng();
      if (!attempt.output && attempt.retryable) {
        systemLogger.info('SELF_IMPROVEMENT', 'ℹ️ [SearXNG] 一時的な失敗のため1回だけ再試行します');
        attempt = await attemptSearxng();
      }
      if (!attempt.output && attempt.empty) {
        systemLogger.info(
          'SELF_IMPROVEMENT',
          attempt.emptyReason
            ? `ℹ️ [SearXNG] 検索結果0件（理由: ${attempt.emptyReason}）`
            : 'ℹ️ [SearXNG] 検索結果0件',
        );
      }
      return {
        output: attempt.output,
        emptyReason: !attempt.output && attempt.empty ? attempt.emptyReason : undefined,
        suspensionTier: !attempt.output ? attempt.suspensionTier ?? null : null,
        httpStatus: !attempt.output ? attempt.httpStatus : undefined,
      };
    };

    // P416: supplemental free providers. Both attempts receive the
    // same sanitized safeQuery the main route uses -- no unsanitized
    // text ever leaves through a side channel -- and every fetch is
    // bounded by SUPPLEMENTAL_PROVIDER_TIMEOUT_MS. Attempts never
    // throw: any failure is recorded in providerStatuses only.
    const attemptWikipedia = async (): Promise<ProviderSearchOutput | null> => {
      try {
        const langs = ['ja', 'en'] as const;
        const perLang = await Promise.allSettled(langs.map(async (lang) => {
          const apiUrl = readSupplementalApiUrl(
            `miki_wikipedia_${lang}_api_url`,
            `https://${lang}.wikipedia.org/w/api.php`,
          );
          const url = new URL(apiUrl);
          url.searchParams.set('action', 'query');
          url.searchParams.set('generator', 'search');
          url.searchParams.set('gsrsearch', safeQuery);
          url.searchParams.set('gsrnamespace', '0');
          url.searchParams.set('gsrlimit', String(maxResults));
          url.searchParams.set('prop', 'extracts|info');
          url.searchParams.set('inprop', 'url');
          url.searchParams.set('exintro', '1');
          url.searchParams.set('explaintext', '1');
          url.searchParams.set('format', 'json');
          url.searchParams.set('formatversion', '2');
          url.searchParams.set('origin', '*');
          const res = await fetch(url.toString(), {
            signal: AbortSignal.timeout(SUPPLEMENTAL_PROVIDER_TIMEOUT_MS),
            headers: { 'User-Agent': SUPPLEMENTAL_USER_AGENT, Accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const pages = Array.isArray(data?.query?.pages) ? [...data.query.pages] : [];
          pages.sort((a: any, b: any) => (a?.index ?? 999) - (b?.index ?? 999));
          return pages
            .filter((page: any) => page?.title && page?.fullurl)
            .slice(0, maxResults)
            .map((page: any) => ({
              title: String(page.title),
              snippet: String(page.extract || '').replace(/\s+/g, ' ').trim().slice(0, 400),
              url: String(page.fullurl),
              source: 'Wikipedia (API)',
            }));
        }));
        const flatItems = perLang.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
        if (flatItems.length === 0) {
          const firstRejection = perLang.find((entry) => entry.status === 'rejected') as
            | PromiseRejectedResult
            | undefined;
          if (firstRejection && perLang.every((entry) => entry.status === 'rejected')) {
            const reason = firstRejection.reason?.name === 'TimeoutError'
              ? 'タイムアウト'
              : firstRejection.reason?.message || String(firstRejection.reason);
            markProvider('wikipedia', 'FAILED', reason);
            systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Wikipedia] 探索経路失敗: ${reason}`);
          } else {
            markProvider('wikipedia', 'EMPTY');
          }
          return null;
        }
        const results: WebSearchResultItem[] = flatItems.map((item) => {
          const canonicalUrl = canonicalizeSearchUrl(item.url);
          const identity = deriveSourceIdentity('wikipedia', item, canonicalUrl);
          return { ...item, sourceId: identity.sourceId, independenceClusterId: identity.independenceClusterId };
        });
        applyContentIndependenceClusters(results);
        markProvider('wikipedia', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🔍 [Wikipedia] 検索成功: ${results.length}件`);
        return { provider: 'wikipedia', results };
      } catch (error: any) {
        const reason = error?.name === 'TimeoutError' ? 'タイムアウト' : error?.message || String(error);
        markProvider('wikipedia', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Wikipedia] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    const attemptOpenAlex = async (): Promise<ProviderSearchOutput | null> => {
      // P485: she already concluded the daily budget is exhausted;
      // do not spend another call re-learning it.
      if (this.openAlexBudgetBlockedUntil > Date.now()) {
        markProvider('openalex', 'SKIPPED', 'OpenAlexは予算枯渇のため停止中（UTC深夜にリセット）');
        return null;
      }
      try {
        const apiUrl = readSupplementalApiUrl('miki_openalex_api_url', 'https://api.openalex.org/works');
        const url = new URL(apiUrl);
        url.searchParams.set('search', safeQuery);
        url.searchParams.set('per-page', String(maxResults));
        url.searchParams.set('select', 'id,display_name,doi,publication_year,abstract_inverted_index,primary_location');
        // P416: deliberately no mailto parameter. The polite pool
        // would transmit a contact mail address to OpenAlex; no user
        // address is used (and no setting for one is created), so
        // this provider runs on the anonymous pool by design.
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(SUPPLEMENTAL_PROVIDER_TIMEOUT_MS),
          headers: { 'User-Agent': SUPPLEMENTAL_USER_AGENT, Accept: 'application/json' },
        });
        if (!res.ok) {
          // P417: the API explains itself in the error body (JSON
          // error/message), but the P416 code kept only the status,
          // so the device's HTTP 400 was unreadable. Carry the
          // message into the provider status and the log, capped at
          // 200 chars (the body can embed URLs). A body that cannot
          // be read or is not JSON leaves the status-only form.
          let detail = '';
          try {
            const body = JSON.parse(await res.text());
            const message =
              typeof body?.message === 'string'
                ? body.message
                : typeof body?.error === 'string'
                  ? body.error
                  : '';
            detail = message.replace(/\s+/g, ' ').trim().slice(0, 200);
          } catch {
            // unreadable or non-JSON body: keep the status only.
          }
          const reason = detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`;
          markProvider('openalex', 'FAILED', reason);
          systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [OpenAlex] 応答失敗: ${reason}`);
          // P485: a 429 whose body says the budget is gone is a
          // conclusion, not a transient failure -- remember it
          // until the UTC-midnight reset instead of re-asking on
          // every rescue.
          if (res.status === 429 && /budget|insufficient/i.test(detail)) {
            this.blockOpenAlexForBudget(reason);
          }
          return null;
        }
        const data = await res.json();
        const works = Array.isArray(data?.results) ? data.results : [];
        const flatItems = works
          .filter((work: any) => work && (work.display_name || work.title))
          .slice(0, maxResults)
          .map((work: any) => {
            const abstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);
            const venue = typeof work?.primary_location?.source?.display_name === 'string'
              ? work.primary_location.source.display_name
              : '';
            const year = typeof work?.publication_year === 'number' ? work.publication_year : undefined;
            const snippet = (abstract || [venue, year ? String(year) : ''].filter(Boolean).join(' · ')).slice(0, 400);
            const itemUrl =
              (typeof work.doi === 'string' && work.doi) ||
              (typeof work?.primary_location?.landing_page_url === 'string' && work.primary_location.landing_page_url) ||
              (typeof work.id === 'string' && work.id) ||
              '';
            return {
              title: String(work.display_name || work.title),
              snippet,
              url: itemUrl,
              source: 'OpenAlex (API)',
              ...(year ? { publishedDate: String(year) } : {}),
            };
          })
          .filter((item: { url: string }) => Boolean(item.url));
        if (flatItems.length === 0) {
          markProvider('openalex', 'EMPTY');
          return null;
        }
        const results: WebSearchResultItem[] = flatItems.map((item) => {
          const canonicalUrl = canonicalizeSearchUrl(item.url);
          const identity = deriveSourceIdentity('openalex', item, canonicalUrl);
          return { ...item, sourceId: identity.sourceId, independenceClusterId: identity.independenceClusterId };
        });
        applyContentIndependenceClusters(results);
        markProvider('openalex', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🔍 [OpenAlex] 検索成功: ${results.length}件`);
        return { provider: 'openalex', results };
      } catch (error: any) {
        const reason = error?.name === 'TimeoutError' ? 'タイムアウト' : error?.message || String(error);
        markProvider('openalex', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [OpenAlex] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    // P489: Marginalia -- an independent-index search engine whose
    // public API needs no key signup and no card (API-Key: public).
    // Its index leans to the non-commercial web (personal sites,
    // technical writing, forums, academic pages), so it joins as a
    // rescue-only provider below: it fires only when every other
    // route produced nothing, which also keeps her spend against
    // the shared public key's rate limit minimal. A 503 from that
    // shared limit is a classified failure, not a retry trigger.
    const attemptMarginalia = async (): Promise<ProviderSearchOutput | null> => {
      try {
        const apiUrl = readSupplementalApiUrl('miki_marginalia_api_url', 'https://api2.marginalia-search.com/search');
        const url = new URL(apiUrl);
        // P491: Marginalia のインデックスは英語圏中心のため、
        // 日英対応が分かる語は英語に置き換えたクエリで投げる。
        const marginaliaQuery = lexicalRelationService.translationVariantOf(safeQuery) ?? safeQuery;
        if (marginaliaQuery !== safeQuery) {
          systemLogger.info('SELF_IMPROVEMENT', `🌐 [Marginalia] 英語クエリで発射: ${marginaliaQuery}`);
        }
        url.searchParams.set('query', marginaliaQuery);
        url.searchParams.set('count', String(maxResults));
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(SUPPLEMENTAL_PROVIDER_TIMEOUT_MS),
          headers: { 'API-Key': 'public', 'User-Agent': SUPPLEMENTAL_USER_AGENT, Accept: 'application/json' },
        });
        if (!res.ok) {
          const reason = res.status === 503 ? 'HTTP 503（共有キーのレート制限）' : `HTTP ${res.status}`;
          markProvider('marginalia', 'FAILED', reason);
          systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Marginalia] 応答失敗: ${reason}`);
          return null;
        }
        const data = await res.json();
        const hits = Array.isArray(data?.results) ? data.results : [];
        const flatItems = hits
          .filter((hit: any) => hit && typeof hit.url === 'string' && hit.url)
          .slice(0, maxResults)
          .map((hit: any) => ({
            title: String(hit.title || hit.url),
            snippet: String(hit.description || '').replace(/\s+/g, ' ').trim().slice(0, 400),
            url: String(hit.url),
            source: 'Marginalia (API)',
          }));
        if (flatItems.length === 0) {
          markProvider('marginalia', 'EMPTY');
          return null;
        }
        const results: WebSearchResultItem[] = flatItems.map((item) => {
          const canonicalUrl = canonicalizeSearchUrl(item.url);
          const identity = deriveSourceIdentity('marginalia', item, canonicalUrl);
          return { ...item, sourceId: identity.sourceId, independenceClusterId: identity.independenceClusterId };
        });
        applyContentIndependenceClusters(results);
        markProvider('marginalia', 'SUCCEEDED');
        systemLogger.info('SELF_IMPROVEMENT', `🔍 [Marginalia] 検索成功: ${results.length}件`);
        return { provider: 'marginalia', results };
      } catch (error: any) {
        const reason = error?.name === 'TimeoutError' ? 'タイムアウト' : error?.message || String(error);
        markProvider('marginalia', 'FAILED', reason);
        systemLogger.info('SELF_IMPROVEMENT', `ℹ️ [Marginalia] 探索経路失敗: ${reason}`);
        return null;
      }
    };

    /*
     * P348: 探索経路はSearXNG単一に統一した（Wikipedia／DuckDuckGoへの直接取得は廃止）。
     * P416: ユーザーの方針訂正（2026-11-04：使わないのは「お金がかかる外部」であって
     * 外部そのものではない）を受け、無料・鍵なしの補助ソース（Wikipedia系・OpenAlex）を
     * 方式A（主経路と並列・3秒期限・再試行なし）で再接続した。主経路はSearXNGのままで、
     * 補助は合流と裏付け（独立クラスタ）の補完に留まる。
     * P418: 発射の交通整理をここに置く。SearXNG は単一ゲート（同時2本・
     * 開始間隔・優先レーン）を通し、冷却中は発射自体を省略する。
     * Wikipedia は枠が大きく独立のためゲート対象外で即時並列発射する。
     * OpenAlex は日次予算の配慮から、公式・学術意図がある場合のみ
     * 並列発射し、それ以外は主経路が空・失敗・冷却中のときの救済に回す。
     */
    const lane: SearchLane = options?.lane === 'foreground' ? 'foreground' : 'background';
    const wikipediaPromise = attemptWikipedia();
    const openAlexParallelPromise =
      options?.officialSourceIntent === true ? attemptOpenAlex() : null;

    let searxngRun: SearxngPassOutcome;
    const cooldownRemainingMs = searchPacerCooldownRemainingMs();
    if (cooldownRemainingMs > 0) {
      // Cooldown: never hold the caller -- the SearXNG share of this
      // search returns at once with the cooldown as its reason, and
      // the supplements below remain available as the rescue route.
      const remainSec = Math.ceil(cooldownRemainingMs / 1000);
      const cooledReason = `SearXNG冷却中（残り約${remainSec}秒）: ${searchPacer.cooldownReason || 'エンジン停止中'}`;
      markProvider('searxng', 'SKIPPED', cooledReason);
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `⏸️ [SearXNG] 冷却中のため発射を省略しました（残り約${remainSec}秒）`,
      );
      searxngRun = { output: null, emptyReason: cooledReason, cooledDown: true };
    } else {
      await acquireSearchGate(lane);
      try {
        searxngRun = await runSearxng();
      } finally {
        releaseSearchGate();
      }
      // Adaptation and cooldown are driven by the finished pass:
      // success settles the pace, a full suspension starts the
      // matching cooldown, an HTTP 429 counts as rate pressure.
      if (searxngRun.output) {
        searchPacerNoteSuccess();
        // P485: a success after a suspended diagnosis closes the
        // investigation -- the recorded cause flips to RECOVERED.
        this.noteSearchRecovered();
      } else if (searxngRun.suspensionTier) {
        searchPacerNotePressure('エンジン停止');
        searchPacerStartCooldown(searxngRun.suspensionTier, searxngRun.emptyReason || '');
        // P485: keep the classified cause, not just the cooldown.
        this.recordSelfDiagnosis(
          'UPSTREAM_SUSPENDED',
          searxngRun.emptyReason || '全エンジン停止中',
          Date.now() + searchPacerCooldownRemainingMs(),
        );
      } else if (searxngRun.httpStatus === 429) {
        searchPacerNotePressure('HTTP 429');
      } else if (searxngRun.httpStatus !== undefined && searxngRun.httpStatus >= 500) {
        // P485: instance-side 5xx is also rate/load pressure; until
        // now only suspensions and 429 fed the pacer, so a
        // struggling instance never slowed her down.
        searchPacerNotePressure('HTTP 5xx');
      }
    }

    const wikipediaOutput = await wikipediaPromise;
    let openAlexOutput: ProviderSearchOutput | null = null;
    if (openAlexParallelPromise) {
      openAlexOutput = await openAlexParallelPromise;
    } else if (!searxngRun.output) {
      // Budget-aware rescue: the main route contributed nothing, so
      // spending a little of the shared daily budget is worth it.
      openAlexOutput = await attemptOpenAlex();
    } else {
      markProvider('openalex', 'SKIPPED', '主経路SearXNGが結果を返したため未発射（日次予算の配慮）');
    }
    // P489: last-resort rescue. Marginalia fires only when SearXNG,
    // Wikipedia and OpenAlex together produced nothing; in every
    // other case it stays unfired (shared-key rate-limit care).
    let marginaliaOutput: ProviderSearchOutput | null = null;
    if (!searxngRun.output && !wikipediaOutput && !openAlexOutput) {
      marginaliaOutput = await attemptMarginalia();
    } else {
      markProvider('marginalia', 'SKIPPED', '他の経路が結果を返したため未発射（共有キーのレート制限への配慮）');
    }
    const supplementOutputs: ProviderSearchOutput[] = [];
    if (wikipediaOutput) supplementOutputs.push(wikipediaOutput);
    if (openAlexOutput) supplementOutputs.push(openAlexOutput);
    if (marginaliaOutput) supplementOutputs.push(marginaliaOutput);
    const searxngOutput = searxngRun.output;
    const emptyReason = searxngRun.emptyReason;
    const outputs: ProviderSearchOutput[] = [
      ...(searxngOutput && searxngOutput.results.length > 0 ? [searxngOutput] : []),
      ...supplementOutputs,
    ];

    const mergedResults = mergeSearchResults(outputs, preferred, maxResults);
    const successfulProviders = (['searxng', 'wikipedia', 'openalex', 'marginalia'] as SearchProviderName[]).filter(
      (provider) => providerStatuses[provider].status === 'SUCCEEDED',
    );

    const providerLabel = (provider: SearchProviderName): string =>
      provider === 'searxng' ? 'SearXNG' : provider === 'wikipedia' ? 'Wikipedia' : provider === 'marginalia' ? 'Marginalia' : 'OpenAlex';
    // P436: 冷却中の検索で補助が拾ったかどうかが要約に残らないため、
    // 各Providerの状態の内訳を要約に載せる。冷却そのものを減らす
    // 変更（発射間隔の延長など）は行わない。
    const providerSummary = (['searxng', 'wikipedia', 'openalex', 'marginalia'] as SearchProviderName[])
      .map((provider) => {
        const record = providerStatuses[provider];
        return `${providerLabel(provider)}:${record.status}${record.error ? `（${record.error}）` : ''}`;
      })
      .join('／');
    const baseSummary =
      mergedResults[0]?.snippet ||
      (successfulProviders.length
        ? `「${safeQuery}」について${successfulProviders.map(providerLabel).join('・')}から候補を取得しました。`
        : `「${safeQuery}」について結果を取得できませんでした。`);
    const result: AutonomousSearchExecutionResult = {
      results: mergedResults,
      summary: `${baseSummary}（${providerSummary}）`,
      provider: successfulProviders[0] || 'searxng',
      providers: successfulProviders,
      providerStatuses,
      searchPacer: snapshotSearchPacer(),
    };

    this.stats.totalSearches++;
    this.stats.lastSearchAt = Date.now();
    this.saveStats();

    if (result.results.length > 0) {
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    const emptyResult: AutonomousSearchExecutionResult = {
      ...result,
      // P415: when the pass ended empty and SearXNG said why, the
      // summary carries the classified reasons. This summary is what
      // researchService copies into ResearchResult.summary, so the
      // limiting cause stays readable in the run detail (and in the
      // WAITING_EVIDENCE record) instead of only in this log stream.
      summary: emptyReason
        ? `「${safeQuery}」の検索に失敗しました。空の理由: ${emptyReason}（${providerSummary}）。`
        : `「${safeQuery}」の検索に失敗しました（${providerSummary}）。`,
    };
    // P485: cache the empty outcome too. Until now only successes
    // were cached, so the same query re-fired every provider on
    // every pass and every re-queued gap -- the device logs showed
    // one query sent 4 times inside a single window, all returning
    // the same empty answer from a suspended upstream.
    this.cache.set(cacheKey, { data: emptyResult, timestamp: Date.now(), negative: true });
    return emptyResult;
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
    const readStartedAt = Date.now();
    // P436: PDF は HeadlessWebView（描画経由）の取得対象から外す。
    // 巨大な PDF を10秒で描画して読むのは事実上無理があり、失敗1件
    // あたり10秒を直列で消費する。素の fetch での PDF テキスト抽出は
    // この経路にはないため、取得は行わずスニペットのみで扱う。
    // 失敗ではなく意図的なスキップのため、失敗URL記憶には残さない。
    const isPdfUrl = (url: string): boolean => {
      try {
        return new URL(url).pathname.toLowerCase().endsWith('.pdf');
      } catch {
        return url.split(/[?#]/)[0]?.toLowerCase().endsWith('.pdf') ?? false;
      }
    };
    const pdfSkipped = results.filter(
      (r) => typeof r.url === 'string' && /^https?:\/\//i.test(r.url) && isPdfUrl(r.url),
    );
    const readable = results
      .filter((r) => typeof r.url === 'string' && /^https?:\/\//i.test(r.url))
      .filter((r) => !isPdfUrl(r.url!))
      .filter((r) => {
        // P432: skip a URL that failed recently; forget it once the
        // memory window has passed so it can be tried again later.
        const failedAt = this.failedPageUrls.get(r.url!);
        if (failedAt === undefined) return true;
        if (readStartedAt - failedAt >= FAILED_PAGE_URL_MEMORY_MS) {
          this.failedPageUrls.delete(r.url!);
          return true;
        }
        return false;
      })
      .slice(0, maxPages);

    // Native WebView rejects overlapping calls; serialize page reads while preserving input order.
    const outputs: Array<{ result: T; success: boolean; text: string; url: string; error?: string }> = [];
    for (const result of readable) {
      try {
        const page = await this.fetchRenderedPage(result.url!, {
          query,
          timeoutMs: options?.timeoutMs,
          renderWaitMs: options?.renderWaitMs,
        });
        // P432: remember a failed read so the same URL is not
        // re-fetched on the next research pass.
        if (!page.success) this.failedPageUrls.set(result.url!, Date.now());
        outputs.push({
          result,
          success: page.success,
          text: page.text || '',
          url: page.url || result.url!,
          error: page.error,
        });
      } catch (error) {
        this.failedPageUrls.set(result.url!, Date.now());
        outputs.push({
          result,
          success: false,
          text: '',
          url: result.url!,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // P436: スキップした PDF は取得なしの結果として残す。利用側は
    // success:false のため本文抽出を飛ばし、スニペットだけが残る。
    for (const result of pdfSkipped) {
      outputs.push({
        result,
        success: false,
        text: '',
        url: result.url!,
        error: 'PDF_SKIPPED: PDFは描画経由の取得対象外のため、スニペットのみで扱います',
      });
    }

    const successCount = outputs.filter((o) => o.success && o.text.trim()).length;
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📖 [Research Read] 「${query}」の検索結果${readable.length}件を読み取り、${successCount}件の本文取得に成功${pdfSkipped.length > 0 ? `（PDF ${pdfSkipped.length}件は描画対象外のためスキップ）` : ''}`
    );
    return outputs;
  }

  /**
   * 検索結果から知識を抽出し、長期記憶(Semantic Memory)や合成データセットへ能動的に還元・学習
   * 設計思想 Master v5.0 第13章 & 第2章・第9章連結
   */
  private hasVerifiedResearchOutcome(options?: {
    verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
    evidenceIds?: string[];
    claimIds?: string[];
  }): boolean {
    if (options?.verificationStatus !== 'VERIFIED') return false;

    const evidenceIds = [...new Set((options.evidenceIds || []).map(String).filter(Boolean))];
    const claimIds = [...new Set((options.claimIds || []).map(String).filter(Boolean))];
    if (evidenceIds.length === 0 || claimIds.length === 0) return false;

    return claimIds.every(claimId => {
      const claim = claimDatabaseService.getClaim(claimId);
      if (!claim || (claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED')) {
        return false;
      }
      return evidenceIds.some(evidenceId => {
        const item = evidenceService.getEvidence(evidenceId);
        return Boolean(
          item &&
          item.kind === 'WEB' &&
          item.status === 'ADMISSIBLE' &&
          item.claim_ids.includes(claimId)
        );
      });
    });
  }

  public learnFromSearch(
    query: string,
    results: WebSearchResultItem[],
    summary?: string,
    options?: {
      triggerType: 'in_conversation' | 'idle_autonomous' | 'working_agenda' | 'capability_gap';
      resolvedAgendaId?: string;
      provider?: string;
      sourceRef?: string;
      evidenceIds?: string[];
      claimIds?: string[];
      researchGapId?: string;
      verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
    }
  ): AutonomousSearchLearningRecord {
    const triggerType = options?.triggerType || 'in_conversation';
    let sourceBackedResults = results.filter(isSourceBackedSearchResult);
    const syntheticResult = results.find(isSyntheticSearchResult);
    const syntheticSummary = isSyntheticWebMaterial({
      title: '',
      snippet: String(summary || ''),
      source: '',
    });

    // モック、出典URLのない結果、失敗要約だけでは学習を実行しない。
    if (syntheticResult || syntheticSummary || sourceBackedResults.length === 0) {
      const rejectedRecord: AutonomousSearchLearningRecord = {
        id: 'sr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        query,
        triggerType,
        timestamp: Date.now(),
        results: [],
        summary: syntheticResult || syntheticSummary
          ? 'テスト用モックを検出したため、学習・記憶・回答パターンへの反映を拒否しました。'
          : '実URL付きの検索結果がないため、学習・記憶・回答パターンへの反映を拒否しました。',
        extractedKnowledge: [],
        integratedToMemory: false,
        integratedToSyntheticData: false,
        verificationStatus: 'UNVERIFIED',
      };
      this.addRecord(rejectedRecord);
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        syntheticResult || syntheticSummary
          ? '[Research Learning] mock result rejected; no learning side effects'
          : '[Research Learning] source-less result rejected; no learning side effects',
      );
      return rejectedRecord;
    }

    const verifiedResearchOutcome = this.hasVerifiedResearchOutcome(options);
    const effectiveVerificationStatus = verifiedResearchOutcome ? 'VERIFIED' : 'UNVERIFIED';

    // URL一致の実在Evidenceを再利用し、REJECTEDのIDは学習処理へ渡さない。
    const suppliedEvidenceIds = [...new Set((options?.evidenceIds || []).map(String).filter(Boolean))]
      .filter(id => {
        const item = evidenceService.getEvidence(id);
        return Boolean(item && item.kind === 'WEB' && item.status !== 'REJECTED');
      });
    const sourceEvidenceIds: string[] = [];
    const acceptedSourceBackedResults: WebSearchResultItem[] = [];
    for (const result of sourceBackedResults.slice(0, 3)) {
      const canonicalUrl = canonicalizeSearchUrl(String(result.url || ''));
      const existingEvidence = suppliedEvidenceIds
        .map(id => evidenceService.getEvidence(id))
        .find(item => Boolean(
          item &&
          item.kind === 'WEB' &&
          item.status !== 'REJECTED' &&
          canonicalizeSearchUrl(String(item.url || '')) === canonicalUrl
        ));
      const evidence = existingEvidence || evidenceService.recordWebEvidence({
        title: String(result.title || query),
        snippet: String(result.snippet || ''),
        source: String(result.source || 'web_search'),
        url: result.url,
        publishedDate: result.publishedDate,
        sourceId: result.sourceId,
        independenceClusterId: result.independenceClusterId,
        metadata: {
          fetch_method: 'api',
          trust_boundary: 'UNTRUSTED_EXTERNAL_WEB',
          verification_status: 'UNVERIFIED',
          observed_at: Date.now(),
          result_summary: '検索素材を未検証Evidenceとして記録。Claimの独立検証が必要。',
        },
      });

      if (!evidence || evidence.kind !== 'WEB' || evidence.status === 'REJECTED') {
        continue;
      }
      acceptedSourceBackedResults.push(result);
      sourceEvidenceIds.push(evidence.evidence_id);
    }
    sourceBackedResults = acceptedSourceBackedResults;

    if (sourceBackedResults.length === 0 || sourceEvidenceIds.length === 0) {
      const rejectedRecord: AutonomousSearchLearningRecord = {
        id: 'sr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        query,
        triggerType,
        timestamp: Date.now(),
        results: [],
        summary: '非拒否のWeb Evidenceがないため、学習・記憶・回答パターンへの反映を拒否しました。',
        extractedKnowledge: [],
        integratedToMemory: false,
        integratedToSyntheticData: false,
        verificationStatus: 'UNVERIFIED',
      };
      this.addRecord(rejectedRecord);
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        '[Research Learning] no non-rejected Web Evidence; no learning side effects',
      );
      return rejectedRecord;
    }

    const extractedKnowledge: string[] = [];

    // 重要スニペット・要点の抽出
    if (summary && summary.trim().length > 10) {
      extractedKnowledge.push(summary.trim());
    }
    for (const r of sourceBackedResults.slice(0, 3)) {
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
        const knowledgeContent = `【自律Web学習知識: ${query}】\n要約: ${summary || sourceBackedResults[0]?.title || ''}\n詳細知見:\n${extractedKnowledge.slice(0, 2).join('\n')}`;
        const memItem: MemoryItem = {
          id: 'mem_web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          category: 'code',
          content: knowledgeContent,
          importance: 8,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'auto',
          sourceRef: options?.sourceRef || `web_search:${query}`,
          rawSourceId: options?.researchGapId,
          rawExcerpt: knowledgeContent,
          tags: ['web_search', 'autonomous_learning', query.slice(0, 20)],
          memoryType: 'semantic',
          memoryScope: 'long_term',
          longTermType: 'general_rule',
          destination: 'long_term_memory',
          lifecycleStatus: 'CANDIDATE',
          approved: false, // 未検証: 自動昇格防止
          verificationStatus: effectiveVerificationStatus,
          researchGapId: options?.researchGapId,
          evidenceIds: sourceEvidenceIds,
          claimIds: [...new Set((options?.claimIds || []).map(String).filter(Boolean))],
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
        if (sourceEvidenceIds.length === 0) {
          throw new Error('SOURCE_BACKED_EVIDENCE_REQUIRED');
        }
        experienceLinkService.getOrCreateLink(experienceId, 'web_search', `Web検索知見獲得: ${query.slice(0, 40)}`);
        for (const evidenceId of sourceEvidenceIds) {
          experienceLinkService.linkEntity(experienceId, 'evidence', evidenceId);
        }

        // 検索結果は無条件で正解とせず、実在するEvidence IDへ結び付けた未検証候補として保存する。
        selfImprovementService.registerCapabilityCandidate({
          instruction: `「${query}」についての最新情報や仕様、知見を説明してください。`,
          outputTarget: summary || extractedKnowledge.join('\n'),
          category: 'retrieval',
          reliability: 'medium',
          source: 'web_search',
          approved: false,
          verifiedEffective: false,
          verificationNote: `Web検索未検証証拠: ${query.slice(0, 30)}`,
          experienceId,
          evidenceIds: sourceEvidenceIds,
        });
        integratedToSyntheticData = true;
      } catch (synErr) {
        console.warn('Failed to integrate search knowledge to capability candidates:', synErr);
      }
    }

    // 3. Working Agendaは検索件数では閉じない。保存済みEvidenceとClaimの検証を再照合する。
    let resolvedAgendaId: string | undefined;
    if (options?.resolvedAgendaId && verifiedResearchOutcome) {
      try {
        workingAgendaService.resolveAgenda(
          options.resolvedAgendaId,
          `独立検証済みClaimに基づき解決: ${summary || extractedKnowledge[0] || '検証済み知見'}`
        );
        resolvedAgendaId = options.resolvedAgendaId;
      } catch (agErr) {
        console.warn('Failed to resolve verified research agenda:', agErr);
      }
    }

    // 4. 作業指示書 v19 第1.1節: 縦(骨格)への自律学習素材還元
    // 検索結果の受け答え構造・手順・FAQから骨格候補を抽出・登録 (WEB_OBSERVED, 3回観測昇格制)
    try {
      for (const r of sourceBackedResults.slice(0, 2)) {
        const itemProvider = options?.provider ||
          (r.source?.includes('SearXNG') ? 'searxng' : undefined);

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
      const combinedSnippets = sourceBackedResults
        .map((r) => r.snippet)
        .filter(Boolean)
        .join('\n');
      if (combinedSnippets) {
        const topProvider = options?.provider ||
          (sourceBackedResults[0]?.source?.includes('SearXNG') ? 'searxng' : undefined);

        const surfacePatterns = WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({
          text: combinedSnippets,
          sourceQuery: query,
          sourceUrl: sourceBackedResults[0]?.url || '',
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
      results: sourceBackedResults,
      summary,
      extractedKnowledge,
      integratedToMemory,
      integratedToSyntheticData,
      resolvedAgendaId,
      verificationStatus: effectiveVerificationStatus,
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

    const allHomeworks = workingAgendaService.getHomeworkForAutonomousThought();
    const homeworks = allHomeworks.filter(hw => {
      const subQuery = hw.unresolvedQuestions[0] || hw.topic;
      const searchQuery = `${hw.topic} ${subQuery}`.replace(/[\n\r]/g, ' ').slice(0, 50).trim();
      return !this.hasRecentUnverifiedResearch(searchQuery, 'working_agenda');
    });

    for (const hw of homeworks.slice(0, 2)) {
      if (abortSignal?.aborted) break;

      const subQuery = hw.unresolvedQuestions[0] || hw.topic;
      const searchQuery = `${hw.topic} ${subQuery}`.replace(/[\n\r]/g, ' ').slice(0, 50).trim();

      investigated.push(searchQuery);
      details.push(`宿題「${hw.topic}」について自律Web検索開始: ${searchQuery}`);

      const { results, summary, provider } = await this.executeSearch(searchQuery, { maxResults: 3 });
      if (results.length === 0) {
        details.push(`宿題「${hw.topic}」は検索結果を取得できませんでした。未解決状態を維持します。`);
        continue;
      }

      const record = this.learnFromSearch(searchQuery, results, summary, {
        triggerType: 'working_agenda',
        verificationStatus: 'UNVERIFIED',
      });

      if (record.extractedKnowledge.length > 0) {
        learnedCount++;
        details.push(`宿題「${hw.topic}」の検索素材を候補として記録しました (${provider})。独立検証まで未解決状態を維持します。`);
      } else {
        details.push(`宿題「${hw.topic}」の検索結果は学習条件を満たさなかったため反映しませんでした。`);
      }
    }

    if (learnedCount === 0 && !abortSignal?.aborted) {
      const allOpenGaps = capabilityGapService.getAllGaps().filter(g => g.status === 'OPEN');
      const openGaps = allOpenGaps.filter(gap => {
        const query = `${gap.capabilityId} ${gap.description || ''}`
          .replace(/[\n\r]/g, ' ')
          .slice(0, 40)
          .trim();
        return !this.hasRecentUnverifiedResearch(query, 'capability_gap');
      });

      if (openGaps.length > 0) {
        const topGap = openGaps[0];
        const gapQuery = `${topGap.capabilityId} ${topGap.description || ''}`
          .replace(/[\n\r]/g, ' ')
          .slice(0, 40)
          .trim();

        investigated.push(gapQuery);
        details.push(`能力ギャップ「${topGap.capabilityId}」について自律Web検索開始: ${gapQuery}`);

        const { results, summary } = await this.executeSearch(gapQuery, { maxResults: 3 });
        if (results.length === 0) {
          details.push(`能力ギャップ「${topGap.capabilityId}」は検索結果を取得できませんでした。OPENを維持します。`);
        } else {
          const record = this.learnFromSearch(gapQuery, results, summary, {
            triggerType: 'capability_gap',
            verificationStatus: 'UNVERIFIED',
          });
          if (record.extractedKnowledge.length > 0) {
            learnedCount++;
            details.push(`能力ギャップ「${topGap.capabilityId}」の調査素材を未検証候補として保存しました。独立検証までOPENを維持します。`);
          } else {
            details.push(`能力ギャップ「${topGap.capabilityId}」の検索結果は学習条件を満たしません。OPENを維持します。`);
          }
        }
      } else if (allOpenGaps.length > 0) {
        details.push('未検証の検索記録がある能力ギャップは24時間再検索を抑制しています。ギャップ状態はOPENのまま維持します。');
      }
    }

    if (investigated.length === 0 && details.length === 0) {
      details.push('未検証の同一クエリは24時間再検索を抑制し、宿題・能力ギャップは未解決状態で維持します。');
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

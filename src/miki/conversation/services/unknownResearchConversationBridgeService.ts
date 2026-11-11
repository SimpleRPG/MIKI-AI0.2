import { unifiedUnknownResolutionCoordinatorService, type UnifiedUnknownResult } from '../../unknown/services/unifiedUnknownResolutionCoordinatorService';
import { runtimeConversationCompositionService } from './runtimeConversationCompositionService';
import { researchService } from '../../research/services/researchService';
import type { EvidenceRecord } from '../../memory/services/evidenceService';

export interface UnknownResearchConversationResult {
  resolution: UnifiedUnknownResult;
  surfaceText: string;
  status: UnifiedUnknownResult['status'];
  returnedToConversation: true;
  /** P457 (H): 未検証の出典付き提示を行った場合の出典。 */
  unverifiedSources?: Array<{ title: string; url: string }>;
}

interface SourceRef {
  title: string;
  url: string;
}

export interface UnverifiedPresentation {
  summary: string;
  sources: SourceRef[];
}

/** 照会の主要語。全体・空白区切り・「の」区切りの順に、長いものから使う。 */
function queryTerms(query: string): string[] {
  const q = String(query || '').trim();
  if (!q) return [];
  const parts = q
    .split(/[\s、。・/／「」『』（）()]+/)
    .flatMap((part) => part.split('の'))
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return [...new Set([q, ...parts])].sort((a, b) => b.length - a.length);
}

/**
 * P457 (H): 未検証提示（2段構えの1段目）の材料を選ぶ。
 * - 出典は URL を持つ証拠だけ。出典の無い情報は1段目でも出さない。
 * - 証拠のタイトル・抜粋に照会の主要語が含まれるものだけを使う。
 *   検索基盤に実質到達できていない場合に、無関係な記事が証拠として
 *   残ることがあり（プロバイダのフォールバック等）、それを出典として
 *   提示してしまわないための関連性ガード。
 * - 要約は調査要約を優先するが、失敗文（「検索に失敗しました」等）や
 *   照会と無関係な要約は使わず、出典先頭の抜粋に倒す。
 * 材料が揃わなければ null（提示せず、従来の未解決の返しに倒す）。
 */
// P579: 取得したページ本文の先頭には、サイトの案内文（「コンテンツ
// にスキップ」「メインメニュー」等）が混ざる。要約として提示する
// 前に取り除き、照会語を含む文を優先して拾う。
const WEB_CHROME_PHRASES = [
  'コンテンツにスキップ', 'メインメニュー', 'サイドバーに移動', 'サイドバー',
  'コミュニティ・ポータル', '最近の出来事', '新しいページ', '最近の更新',
  'おまかせ表示', 'メインページ', '案内', '非表示',
  '特別ページ', '個人用ツール', 'アカウント作成', 'ウィキペディアに関するお問い合わせ',
  'バグの報告', '練習用ページ', '井戸端', '寄付',
];

// P595: ページの操作系テキスト（ナビゲーション）の目印。
const NAV_MARKERS = ['アップロード', 'コモンズ', 'ヘルプ', 'お知らせ', 'ログイン', '目次', 'ページ先頭', 'メインメニュー', 'サイドバー', '特別ページ', '個人用ツール', 'アカウント作成', '編集', 'ICAO', 'IATA', '空港名', '一覧'];

export function cleanWebSummary(text: string, terms: string[]): string {
  let t = String(text || '');
  t = t.replace(/^[^。]{0,60}? - (?:Wikipedia|ウィキペディア)\s*/u, '');
  for (const p of WEB_CHROME_PHRASES) t = t.split(p).join(' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const sentences = t.split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
  // P595: ページの操作系テキスト（ナビゲーション）の目印が複数ある
  // 文は本文ではないとみなして採用しない（「アップロード ヘルプ
  // ログイン 目次…」のような案内文の塊が要約に化けていた）。
  const clean = sentences.filter((s) => NAV_MARKERS.filter((m) => s.includes(m)).length < 2);
  const withTerm = clean.find((s) => terms.some((term) => term && s.includes(term)));
  const chosen = withTerm || clean[0] || '';
  return chosen.replace(/[。．]\s*$/, '').slice(0, 120);
}

export function selectUnverifiedPresentation(
  evidence: EvidenceRecord[],
  query: string,
  researchSummary?: string,
): UnverifiedPresentation | null {
  const terms = queryTerms(query);
  const isRelevant = (text: string) => terms.length === 0 || terms.some((t) => text.includes(t));
  const usable = (evidence || []).filter(
    (ev) => ev.status !== 'REJECTED' && String(ev.url || '').trim() && isRelevant(`${ev.title || ''} ${ev.snippet || ''}`),
  );
  if (usable.length === 0) return null;
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const ev of usable) {
    const url = String(ev.url || '').trim();
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: String(ev.title || '').trim() || url, url });
    if (sources.length >= 2) break;
  }
  let summary = '';
  const rawSummary = typeof researchSummary === 'string' ? researchSummary.trim() : '';
  if (rawSummary && !/検索に失敗|失敗しました/.test(rawSummary) && isRelevant(rawSummary)) {
    summary = cleanWebSummary(rawSummary, terms);
  }
  if (!summary) {
    summary = cleanWebSummary(String(usable[0].snippet || ''), terms);
  }
  // P599: 要約文そのものが検索語を含まない場合は、無関係なページの
  // 冒頭文を拾っているだけなので提示しない（調査キューの形に倒す）。
  if (summary && terms.length > 0 && !terms.some((t) => summary.includes(t))) {
    summary = '';
  }
  if (!summary) return null;
  return { summary, sources };
}

/**
 * P457 (H): 未検証提示の結論文。検証済みの答えと混同されないよう、
 * 未検証の明示と出典を、表層の候補選択で落ちない結論側に含める。
 */
export function buildUnverifiedConclusion(presentation: UnverifiedPresentation): string {
  const sourceText = presentation.sources
    .map((s) => `「${s.title}」（${s.url}）`)
    .join('、');
  return `調べてみたら、${presentation.summary}という情報があったよ。まだ裏付けは取れてないけど。出典は${sourceText}だよ。`;
}

class UnknownResearchConversationBridgeService {
  async resolveAndRespond(input: { question: string; unknownTerms: string[]; useSearch: boolean }): Promise<UnknownResearchConversationResult> {
    const resolution = await unifiedUnknownResolutionCoordinatorService.resolveForChat({
      question: input.question,
      useSearch: input.useSearch,
      unknownTerms: input.unknownTerms,
      hasAttachments: false,
    });
    let status = resolution.status;
    let unverifiedSources: SourceRef[] | undefined;
    let unverifiedSummary = '';
    let researchedEvidenceCount = resolution.evidenceCount;

    /*
     * P457 (G): 調査が必要と判定されたら、会話の場で実際に調査まで実行する。
     * 従来は RESEARCH_REQUIRED（調査待ち）のまま「確認できません」で終わり、
     * 検索自体が発動しなかった。
     * P457 (H): 出典（URL）付きの結果が得られたら、未検証であることを明示し
     * 出典を添えて提示する（2段構えの1段目）。検証済みの答えとは status でも
     * 文面でも区別し、昇格は既存の検証ゲートに委ねたままにする。
     * 出典が得られない・調査基盤に到達できない場合は提示せず、調査キューに
     * 残した旨を会話の言葉で返す。
     */
    if (status === 'RESEARCH_REQUIRED' && resolution.query) {
      try {
        const research = await researchService.executeSearch(resolution.query, { maxResults: 2 });
        const presentation = selectUnverifiedPresentation(research.evidence || [], resolution.query, research.summary);
        if (presentation) {
          unverifiedSummary = presentation.summary;
          unverifiedSources = presentation.sources;
          researchedEvidenceCount = (research.evidence || []).filter((ev) => ev.status !== 'REJECTED').length;
          status = 'RESEARCHED_UNVERIFIED';
        }
      } catch {
        // 調査基盤に到達できない環境では、キュー投入済みの返答に倒す。
      }
    }

    // P720: 未知語が複数あっても、連結して実在しない複合語を
    // 作らない。代表（先頭）の語だけを名指す。
    const termsLabel = input.unknownTerms[0] || '';
    let ir: any;
    if (status === 'REUSED_SUPPORTED') {
      // 検証済みの過去調査の再利用。本文（タイトル・snippet・URL 付き）をそのまま提示する。
      ir = {
        conclusion: resolution.effectiveText || resolution.researchQuestion || input.question,
        target: input.unknownTerms[0] || '',
        reasons: [],
        conditions: [],
        exceptions: [],
        next_actions: [],
        certainty: 'LIKELY',
        detail_level: 'STANDARD',
        interaction_mode: 'NORMAL',
        world_scope: 'REAL',
      };
    } else if (status === 'RESEARCHED_UNVERIFIED' && unverifiedSources) {
      ir = {
        conclusion: buildUnverifiedConclusion({ summary: unverifiedSummary, sources: unverifiedSources }),
        target: input.unknownTerms[0] || '',
        reasons: unverifiedSources.map((s) => `出典: ${s.title}（${s.url}）`),
        conditions: [],
        exceptions: ['調査結果は未検証です'],
        next_actions: [],
        certainty: 'UNKNOWN',
        detail_level: 'STANDARD',
        interaction_mode: 'NORMAL',
        world_scope: 'REAL',
      };
    } else if (status === 'RESEARCH_REQUIRED') {
      // 調査キュー（未知解決レコード）へ投入済み。到達できなかった旨を自然に返す。
      ir = {
        conclusion: `「${termsLabel}」はまだ確認できていないよ。調べるキューに入れておいたから、後でもう一度聞いてみて。`,
        target: input.unknownTerms[0] || '',
        reasons: [],
        conditions: [],
        exceptions: [],
        next_actions: [],
        certainty: 'UNKNOWN',
        detail_level: 'STANDARD',
        interaction_mode: 'NORMAL',
        world_scope: 'REAL',
      };
    } else {
      ir = {
        conclusion: `「${termsLabel}」はまだ確認できていないよ。`,
        target: input.unknownTerms[0] || '',
        reasons: [],
        conditions: [],
        exceptions: [],
        next_actions: [],
        certainty: 'UNKNOWN',
        detail_level: 'STANDARD',
        interaction_mode: 'NORMAL',
        world_scope: 'REAL',
      };
    }

    // P592: 会話の返答に、表層生成の「温かみ・ユーモア」の定型末尾
    // （「急がず着実に前へ進もう。誠心誠意…」等）を付けない
    // （P579 の core 側と同じ規律を、調査橋の IR にも効かせる）。
    (ir as any).suppressGarnish = true;
    const composed = runtimeConversationCompositionService.compose(ir, 'GENERAL_ANSWER');
    return {
      resolution: status === resolution.status ? resolution : { ...resolution, status, evidenceCount: researchedEvidenceCount },
      surfaceText: composed.surfaceText,
      status,
      returnedToConversation: true,
      ...(unverifiedSources ? { unverifiedSources } : {}),
    };
  }
}

export const unknownResearchConversationBridgeService = new UnknownResearchConversationBridgeService();

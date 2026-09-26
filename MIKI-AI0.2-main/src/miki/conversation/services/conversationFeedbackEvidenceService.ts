import { storageService } from '../../../services/storageService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';

export type ConversationFeedbackPolarity = 'POSITIVE' | 'NEGATIVE' | 'PARTIAL' | 'NEUTRAL' | 'UNCERTAIN' | 'CORRECTION';
export type ConversationFeedbackScope = 'FACT' | 'TARGET' | 'ACTION' | 'CONDITION' | 'EXCEPTION' | 'REASONING' | 'ANSWER_STRUCTURE' | 'WORDING' | 'DETAIL_LEVEL' | 'TONE' | 'NEXT_ACTION' | 'WHOLE_RESPONSE';
export type FeedbackEpistemicStatus = 'SUPPORTED' | 'CONFLICTED' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface ConversationFeedbackObservation {
  observationId: string;
  responseId: string;
  conversationId?: string;
  source: 'EXPLICIT_TEXT' | 'EXPLICIT_RATING' | 'BEHAVIORAL_SIGNAL' | 'LEGACY_API';
  polarity: ConversationFeedbackPolarity;
  scopes: ConversationFeedbackScope[];
  positiveScopes: ConversationFeedbackScope[];
  negativeScopes: ConversationFeedbackScope[];
  userText?: string;
  rejectedText?: string;
  replacementText?: string;
  unknownTerms: string[];
  epistemicStatus: FeedbackEpistemicStatus;
  supportingClaimIds: string[];
  conflictingClaimIds: string[];
  confidence: number;
  independentContextKey: string;
  observedAt: number;
}

export interface ConversationFeedbackAggregate {
  responseId: string;
  observations: number;
  independentContexts: number;
  positiveWeight: number;
  negativeWeight: number;
  partialWeight: number;
  unresolvedUnknownTerms: string[];
  epistemicConflicts: number;
  positiveScopes: ConversationFeedbackScope[];
  negativeScopes: ConversationFeedbackScope[];
}

const STORAGE_KEY = 'miki_conversation_feedback_evidence_v2';
const MAX_OBSERVATIONS = 5000;

function stableId(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeTerm(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function detectScopes(text: string): ConversationFeedbackScope[] {
  const scopes = new Set<ConversationFeedbackScope>();
  if (/事実|正しい|間違|意味|定義|ってなに|とは/.test(text)) scopes.add('FACT');
  if (/対象|ファイル|関数|列|行|それ|これ|そっち/.test(text)) scopes.add('TARGET');
  if (/処理|操作|変更|削除|追加|実装|やり方|方法/.test(text)) scopes.add('ACTION');
  if (/条件|場合|とき|前提/.test(text)) scopes.add('CONDITION');
  if (/例外|除外|ただし/.test(text)) scopes.add('EXCEPTION');
  if (/理由|判断|論理|考え方/.test(text)) scopes.add('REASONING');
  if (/構成|順番|流れ|章立て/.test(text)) scopes.add('ANSWER_STRUCTURE');
  if (/言葉|表現|言い方|文言|語彙/.test(text)) scopes.add('WORDING');
  if (/長い|短い|詳し|簡潔/.test(text)) scopes.add('DETAIL_LEVEL');
  if (/口調|トーン|丁寧/.test(text)) scopes.add('TONE');
  if (/次|続け|手順/.test(text)) scopes.add('NEXT_ACTION');
  if (!scopes.size) scopes.add('WHOLE_RESPONSE');
  return [...scopes];
}

function parseReplacement(text: string): { rejectedText?: string; replacementText?: string } {
  const patterns = [
    /[「『]?(.+?)[」』]?って(?:なに|何|なん)(?:よ|ですか)?[、,。 ]*[「『]?(.+?)[」』]?(?:でしょ|だろ|です|だよ)(?:[。！!？?]|$)/,
    /[「『]?(.+?)[」』]?(?:ではなく|じゃなく|じゃない)[、, ]*[「『]?(.+?)[」』]?(?:です|だ|でしょ|にして|の方)?(?:[。！!？?]|$)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { rejectedText: match[1].trim(), replacementText: match[2].trim() };
  }
  return {};
}

function assessEpistemic(rejectedText?: string, replacementText?: string): {
  status: FeedbackEpistemicStatus;
  supportingClaimIds: string[];
  conflictingClaimIds: string[];
  unknownTerms: string[];
} {
  if (!replacementText) return { status: 'NOT_APPLICABLE', supportingClaimIds: [], conflictingClaimIds: [], unknownTerms: [] };
  const supporting = claimDatabaseService.searchClaims(replacementText, 5).filter(claim => claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED');
  const conflicting = rejectedText
    ? claimDatabaseService.searchClaims(rejectedText, 5).filter(claim => claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED')
    : [];
  const terms = [rejectedText, replacementText].filter(Boolean).map(value => normalizeTerm(String(value)));
  const unknownTerms = terms.filter(term => term.length > 1 && japaneseDictionaryService.lookup(term).length === 0 && claimDatabaseService.searchClaims(term, 1).length === 0);
  if (supporting.length && !conflicting.length) return { status: 'SUPPORTED', supportingClaimIds: supporting.map(claim => claim.claim_id), conflictingClaimIds: [], unknownTerms };
  if (conflicting.length) return { status: 'CONFLICTED', supportingClaimIds: supporting.map(claim => claim.claim_id), conflictingClaimIds: conflicting.map(claim => claim.claim_id), unknownTerms };
  return { status: 'UNKNOWN', supportingClaimIds: [], conflictingClaimIds: [], unknownTerms };
}

export class ConversationFeedbackEvidenceService {
  private observations: ConversationFeedbackObservation[] = [];

  public constructor() {
    this.load();
  }

  public analyzeText(params: { responseId: string; text: string; conversationId?: string; contextKey?: string }): ConversationFeedbackObservation {
    const text = params.text.trim();
    const replacement = parseReplacement(text);
    const scopes = detectScopes(text);
    const positive = /それでいい|合ってる|正しい|ありがとう|助かった|問題ない/.test(text);
    const negative = /違う|そうじゃない|ずれて|間違|だめ|駄目|やり直/.test(text);
    let polarity: ConversationFeedbackPolarity = 'NEUTRAL';
    if (replacement.replacementText) polarity = 'CORRECTION';
    else if (positive && negative) polarity = 'PARTIAL';
    else if (negative) polarity = 'NEGATIVE';
    else if (positive) polarity = 'POSITIVE';
    const epistemic = assessEpistemic(replacement.rejectedText, replacement.replacementText);
    if (polarity === 'CORRECTION' && epistemic.status === 'UNKNOWN') polarity = 'UNCERTAIN';
    const observation: ConversationFeedbackObservation = {
      observationId: `CFO-${Date.now()}-${stableId(`${params.responseId}|${text}|${params.contextKey || ''}`)}`,
      responseId: params.responseId,
      conversationId: params.conversationId,
      source: 'EXPLICIT_TEXT',
      polarity,
      scopes,
      positiveScopes: positive ? scopes : [],
      negativeScopes: negative || replacement.replacementText ? scopes : [],
      userText: text,
      rejectedText: replacement.rejectedText,
      replacementText: replacement.replacementText,
      unknownTerms: epistemic.unknownTerms,
      epistemicStatus: epistemic.status,
      supportingClaimIds: epistemic.supportingClaimIds,
      conflictingClaimIds: epistemic.conflictingClaimIds,
      confidence: replacement.replacementText ? 0.75 : positive || negative ? 0.6 : 0.3,
      independentContextKey: params.contextKey || params.conversationId || `turn:${Date.now()}`,
      observedAt: Date.now(),
    };
    return this.record(observation);
  }

  public recordLegacy(responseId: string, feedback: 'POSITIVE' | 'NEGATIVE', userGoal?: string): ConversationFeedbackObservation {
    return this.record({
      observationId: `CFO-${Date.now()}-${stableId(`${responseId}|${feedback}|${userGoal || ''}`)}`,
      responseId,
      source: 'LEGACY_API',
      polarity: feedback,
      scopes: ['WHOLE_RESPONSE'],
      positiveScopes: feedback === 'POSITIVE' ? ['WHOLE_RESPONSE'] : [],
      negativeScopes: feedback === 'NEGATIVE' ? ['WHOLE_RESPONSE'] : [],
      unknownTerms: [],
      epistemicStatus: 'NOT_APPLICABLE',
      supportingClaimIds: [],
      conflictingClaimIds: [],
      confidence: 0.4,
      independentContextKey: userGoal || `legacy:${Date.now()}`,
      observedAt: Date.now(),
    });
  }

  public record(observation: ConversationFeedbackObservation): ConversationFeedbackObservation {
    if (!this.observations.some(existing => existing.observationId === observation.observationId)) {
      this.observations.push(observation);
      this.observations = this.observations.slice(-MAX_OBSERVATIONS);
      this.save();
    }
    return observation;
  }

  public aggregate(responseId: string): ConversationFeedbackAggregate {
    const observations = this.observations.filter(item => item.responseId === responseId);
    const usable = observations.filter(item => item.epistemicStatus !== 'CONFLICTED');
    const weight = (item: ConversationFeedbackObservation) => item.confidence * (item.source === 'LEGACY_API' ? 0.5 : 1);
    return {
      responseId,
      observations: observations.length,
      independentContexts: new Set(observations.map(item => item.independentContextKey)).size,
      positiveWeight: usable.filter(item => item.polarity === 'POSITIVE').reduce((sum, item) => sum + weight(item), 0),
      negativeWeight: usable.filter(item => item.polarity === 'NEGATIVE').reduce((sum, item) => sum + weight(item), 0),
      partialWeight: usable.filter(item => item.polarity === 'PARTIAL' || item.polarity === 'CORRECTION' || item.polarity === 'UNCERTAIN').reduce((sum, item) => sum + weight(item), 0),
      unresolvedUnknownTerms: [...new Set(observations.flatMap(item => item.unknownTerms))],
      epistemicConflicts: observations.filter(item => item.epistemicStatus === 'CONFLICTED').length,
      positiveScopes: [...new Set(usable.flatMap(item => item.positiveScopes))],
      negativeScopes: [...new Set(usable.flatMap(item => item.negativeScopes))],
    };
  }

  public list(responseId?: string): ConversationFeedbackObservation[] {
    return this.observations.filter(item => !responseId || item.responseId === responseId).map(item => ({ ...item }));
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.observations = parsed;
    } catch {
      this.observations = [];
    }
  }

  private save(): void {
    storageService.setItem(STORAGE_KEY, JSON.stringify(this.observations));
  }
}

export const conversationFeedbackEvidenceService = new ConversationFeedbackEvidenceService();

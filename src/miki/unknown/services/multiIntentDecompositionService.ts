import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export interface DecomposedIntent {
  intentId: string;
  text: string;
  sourceText: string;
  index: number;
  confidence: number;
  reason: 'EXPLICIT_CONNECTOR' | 'PUNCTUATION' | 'SINGLE_INTENT';
}

export interface MultiIntentDecompositionResult {
  sourceText: string;
  isMultiIntent: boolean;
  intents: DecomposedIntent[];
  signature: string;
}

/**
 * 非LLMの決定論的Multi-Intent分解。
 * 分解だけを担当し、各サブタスクの実行・ルーティングはCOREへ戻す。
 */
export class MultiIntentDecompositionService {
  public decompose(input: string): MultiIntentDecompositionResult {
    const sourceText = String(input || '').replace(/\s+/g, ' ').trim();
    if (!sourceText) return { sourceText, isMultiIntent: false, intents: [], signature: canonicalSha256Object({ sourceText, intents: [] }) };

    const connectorPattern = /(?:、|,|\n|\r|\s+(?:そして|それから|また|及び|および|並びに|さらに|plus|and|also)\s+|(?:と)\s+)/g;
    const parts = sourceText
      .split(connectorPattern)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);

    const uniqueParts: string[] = [];
    for (const part of parts) {
      const normalized = part.replace(/^[\s、,。]+|[\s、,。]+$/g, '').trim();
      if (!normalized) continue;
      if (!uniqueParts.some((existing) => this.semanticKey(existing) === this.semanticKey(normalized))) uniqueParts.push(normalized);
    }

    const isMultiIntent = uniqueParts.length > 1;
    const intents = (isMultiIntent ? uniqueParts : [sourceText]).map((text, index) => ({
      intentId: `INTENT-${canonicalSha256Object({ sourceText, text, index }).slice(0, 16)}`,
      text,
      sourceText,
      index,
      confidence: isMultiIntent ? 0.9 : 1,
      reason: isMultiIntent ? (/[、,\n\r]/.test(sourceText) ? 'PUNCTUATION' : 'EXPLICIT_CONNECTOR') : 'SINGLE_INTENT',
    } as DecomposedIntent));

    return { sourceText, isMultiIntent, intents, signature: canonicalSha256Object(intents.map(({ intentId, text, index }) => ({ intentId, text, index }))) };
  }

  private semanticKey(text: string): string {
    return text.toLowerCase().replace(/[。！？!?]/g, '').replace(/(教えて|知りたい|お願いします|ください|please)/gi, '').replace(/\s+/g, '').trim();
  }
}

export const multiIntentDecompositionService = new MultiIntentDecompositionService();

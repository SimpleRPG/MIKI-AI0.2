/**
 * MIKI-AI 自律モジュール: 指示語解決純粋関数の実装
 * 対象ファイル: src/autonomous_modules/anaphora_resolver_sample.ts
 *
 * 【主要要件】
 * 1. 入力プロンプトおよびコンテキストプールからの決定論的照応解決
 * 2. 指示語パターン（「これ」「それ」「あれ」「さっきの」「前のやつ」「どっち」「どちら」）
 * 3. 曖昧検知（ambiguous）と安全委譲（unresolved）の厳格判定
 */

export interface PureAnaphoraResolutionResult {
  detectedExpression: string | null;
  resolved: string | null;
  candidates: string[];
  confidence: 'unique' | 'ambiguous' | 'unresolved';
  reasoning: string;
}

/**
 * 副作用のない純粋関数による指示語・文脈照応解決
 */
export function resolveAnaphoraPure(
  prompt: string,
  candidatePool: string[]
): PureAnaphoraResolutionResult {
  if (!prompt || typeof prompt !== 'string') {
    return {
      detectedExpression: null,
      resolved: null,
      candidates: [],
      confidence: 'unresolved',
      reasoning: '入力プロンプトが空です',
    };
  }

  const p = prompt.trim();
  const anaphoraRegex = /(さっきの|前の方|前のやつ|前の|あれ|それ|これ|どっち|どちら)/;
  const match = p.match(anaphoraRegex);
  if (!match) {
    return {
      detectedExpression: null,
      resolved: null,
      candidates: [],
      confidence: 'unresolved',
      reasoning: '指示語・照応表現は検出されませんでした',
    };
  }

  const expr = match[1];
  const cleanPool = (candidatePool || []).filter((c) => typeof c === 'string' && c.trim().length > 0);

  // 1. 比較・二者択一表現 (「どっち」「どちら」)
  if (expr === 'どっち' || expr === 'どちら') {
    const vsMatch = p.match(/(.+?)(?:と|vs|または|か)(.+?)(?:どっち|どちら)/i);
    if (vsMatch) {
      const c1 = vsMatch[1].trim().replace(/^[、\s]+|[、\s]+$/g, '');
      const c2 = vsMatch[2].trim().replace(/^[、\s]+|[、\s]+$/g, '');
      const directCandidates = [c1, c2].filter((c) => c.length > 0 && c.length < 50);
      if (directCandidates.length >= 2) {
        return {
          detectedExpression: expr,
          resolved: null,
          candidates: directCandidates,
          confidence: 'ambiguous',
          reasoning: `明示的比較選択肢 [${directCandidates.join(', ')}] を抽出 (曖昧・ユーザー確認推奨)`,
        };
      }
    }

    if (cleanPool.length >= 2) {
      return {
        detectedExpression: expr,
        resolved: null,
        candidates: cleanPool.slice(-2),
        confidence: 'ambiguous',
        reasoning: `文脈プールから最新2候補 [${cleanPool.slice(-2).join(', ')}] を照応`,
      };
    }
    if (cleanPool.length === 1) {
      return {
        detectedExpression: expr,
        resolved: cleanPool[0],
        candidates: cleanPool,
        confidence: 'unique',
        reasoning: `単一候補『${cleanPool[0]}』に一意決定`,
      };
    }
  }

  // 2. 「前のやつ」「前の」: 1つ前の話題
  if (expr === '前のやつ' || expr === '前の' || expr === '前の方') {
    if (cleanPool.length >= 2) {
      const target = cleanPool[cleanPool.length - 2];
      return {
        detectedExpression: expr,
        resolved: target,
        candidates: [target],
        confidence: 'unique',
        reasoning: `直前2番目の話題『${target}』に一意照応`,
      };
    }
    if (cleanPool.length === 1) {
      return {
        detectedExpression: expr,
        resolved: cleanPool[0],
        candidates: cleanPool,
        confidence: 'unique',
        reasoning: `保持されている唯一の話題『${cleanPool[0]}』に照応`,
      };
    }
  }

  // 3. 「さっきの」「それ」「これ」「あれ」: 最新の話題
  if (cleanPool.length > 0) {
    const latest = cleanPool[cleanPool.length - 1];
    return {
      detectedExpression: expr,
      resolved: latest,
      candidates: [latest],
      confidence: 'unique',
      reasoning: `最新のコンテキスト『${latest}』に一意照応`,
    };
  }

  return {
    detectedExpression: expr,
    resolved: null,
    candidates: [],
    confidence: 'unresolved',
    reasoning: `指示語「${expr}」を検出しましたが、有効なコンテキストプールが存在しません`,
  };
}

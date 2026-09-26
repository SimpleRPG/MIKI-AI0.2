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

  // 2. 「前のやつ」「前の」: 直近の話題・エンティティに一意照応
  if (expr === '前のやつ' || expr === '前の' || expr === '前の方') {
    if (cleanPool.length > 0) {
      const target = cleanPool[cleanPool.length - 1];
      return {
        detectedExpression: expr,
        resolved: target,
        candidates: [target],
        confidence: 'unique',
        reasoning: `直近の話題・成果物『${target}』に一意照応`,
      };
    }
  }

  // 3. 「さっきの」など修飾語を伴う表現 (例:「さっきのコードを見せて」)
  if (expr === 'さっきの' || expr === '前の') {
    const modifierMatch = p.match(/(?:さっきの|前の)(.+?)(?:と|で|を|に|が|は|も|の|！|？|、|\s|$)/);
    const targetNoun = modifierMatch ? modifierMatch[1].trim() : '';
    if (targetNoun && targetNoun !== 'やつ' && targetNoun !== '方') {
      const matched = cleanPool.find((item) => item.includes(targetNoun) || targetNoun.includes(item));
      if (matched) {
        return {
          detectedExpression: expr,
          resolved: matched,
          candidates: [matched],
          confidence: 'unique',
          reasoning: `後続名詞「${targetNoun}」に合致するエンティティ『${matched}』に一意照応`,
        };
      }
    }
  }

  // 4. 指示代名詞 (「これ」「それ」「あれ」): 候補が単一ならunique、複数ならambiguous
  if (expr === 'これ' || expr === 'それ' || expr === 'あれ') {
    if (cleanPool.length === 1) {
      return {
        detectedExpression: expr,
        resolved: cleanPool[0],
        candidates: cleanPool,
        confidence: 'unique',
        reasoning: `単一候補『${cleanPool[0]}』に一意照応`,
      };
    } else if (cleanPool.length > 1) {
      return {
        detectedExpression: expr,
        resolved: null,
        candidates: cleanPool.slice(-3),
        confidence: 'ambiguous',
        reasoning: `指示代名詞「${expr}」に対し複数候補 [${cleanPool.slice(-3).join(', ')}] が存在するため曖昧`,
      };
    }
  }

  // 5. その他の直近解決 (さっきの単独など)
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

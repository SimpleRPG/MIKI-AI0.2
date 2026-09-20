/**
 * Conversation/CORE共通の未知語抽出境界。
 *
 * 解析Componentが返した構造化結果だけを入力にし、未辞書語らしい表層を
 * 最大3件まで安定順で返す。これは「正解」を決める処理ではなく、Research
 * へ渡す候補を作るだけなので、Knowledge/Verificationの昇格境界を侵食しない。
 */

const EXCLUDED = new Set([
  'これ','それ','あれ','ここ','そこ','あそこ','もの','こと','ため','よう','ところ',
  'する','できる','ある','いる','ない','なる','なった','です','ます','でした',
  'は','が','を','に','へ','と','で','から','まで','も','の','や','ね','よ','か',
]);

function clean(value: unknown): string {
  return String(value ?? '').normalize('NFKC').trim();
}

function usableTerm(value: unknown): boolean {
  const term = clean(value);
  if (!term || term.length < 2 || term.length > 48) return false;
  if (EXCLUDED.has(term.toLowerCase())) return false;
  if (/^https?:\/\//i.test(term)) return false;
  if (/^[\d\W_]+$/.test(term)) return false;
  if (/^[A-Za-z0-9_.:/-]+$/.test(term) && term.length < 3) return false;
  return /[\p{L}\p{N}]/u.test(term);
}

function add(out: string[], seen: Set<string>, value: unknown): void {
  const term = clean(value);
  const key = term.toLowerCase();
  if (!usableTerm(term) || seen.has(key) || out.length >= 3) return;
  seen.add(key);
  out.push(term);
}

/**
 * ConversationComponentPipelineResult / JapaneseAnalysisResult を直接または
 * Blackboard経由で受け取り、未知語候補だけを抽出する。
 */
export function detectUnknownTermsFromBlackboardValue(value: unknown): string[] {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const out: string[] = [];
  const seen = new Set<string>();

  const addArray = (candidate: unknown): void => {
    if (!Array.isArray(candidate)) return;
    for (const item of candidate) {
      if (typeof item === 'string' || typeof item === 'number') add(out, seen, item);
      if (out.length >= 3) return;
    }
  };

  for (const key of ['unknownTerms','unknownWords','unresolvedTerms','unresolvedWords','unknownTokens']) {
    addArray(root[key]);
    if (out.length >= 3) return out;
  }

  const analysis = root.analysis && typeof root.analysis === 'object'
    ? root.analysis as Record<string, unknown>
    : root;

  for (const key of ['unknownTerms','unknownWords','unresolvedTerms','unresolvedWords']) {
    addArray(analysis[key]);
    if (out.length >= 3) return out;
  }

  const tokens = analysis.tokens;
  if (Array.isArray(tokens)) {
    for (const token of tokens) {
      if (!token || typeof token !== 'object') continue;
      const t = token as Record<string, unknown>;
      const kind = clean(t.kind).toUpperCase();
      const source = clean(t.dictionarySource);
      if (kind === 'UNKNOWN' || (!source && kind === 'WORD')) {
        add(out, seen, t.surface ?? t.normalized);
      }
      if (out.length >= 3) return out;
    }
  }

  // 最終手段としてcontentTokensを候補にする。ただし辞書にないことを
  // 証明するフィールドがないので、明示的な未解決情報より低優先で扱う。
  addArray(analysis.unresolved);
  return out;
}

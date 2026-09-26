/**
 * Unknown Term Detection Service
 * Blackboardエントリやユーザー入力から未解決語・未知用語を検出・抽出する
 */

export function detectUnknownTermsFromBlackboardValue(
  value: Record<string, unknown> | null | undefined
): string[] {
  if (!value) return [];
  const terms: string[] = [];

  if (Array.isArray(value.unknownTerms)) {
    terms.push(...value.unknownTerms.map(String));
  }
  if (typeof value.unknownTerm === 'string' && value.unknownTerm) {
    terms.push(value.unknownTerm);
  }
  if (Array.isArray(value.unresolvedTerms)) {
    terms.push(...value.unresolvedTerms.map(String));
  }
  if (Array.isArray(value.missingKnowledge)) {
    terms.push(...value.missingKnowledge.map(String));
  }

  return [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
}

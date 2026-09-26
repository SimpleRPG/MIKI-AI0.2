const severityOf = (value: any): string => {
  const text = String(value || '').toUpperCase();
  for (const s of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
    if (text.includes(s)) return s;
  }
  if (/致命|重大/.test(text)) return 'HIGH';
  if (/中/.test(text)) return 'MEDIUM';
  if (/軽微|低/.test(text)) return 'LOW';
  return 'UNKNOWN';
};

const verdictOf = (value: any): string => {
  const text = String(value || '').toUpperCase();
  if (/NEEDS[_ ]?CHANGES|要修正|修正必要/.test(text)) return 'NEEDS_CHANGES';
  if (/REJECT|却下/.test(text)) return 'REJECT';
  if (/INCONCLUSIVE|判断不能|不明/.test(text)) return 'INCONCLUSIVE';
  if (/APPROVE|承認|問題なし|LGTM/.test(text)) return 'APPROVE';
  return 'UNKNOWN';
};

const pick = (text: string, patterns: RegExp[]): string | undefined => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
};

export interface NormalizedFinding {
  severity: string;
  file?: string;
  line?: number;
  claim: string;
  evidence?: string;
  suggestion?: string;
  rawFragment?: string;
}

export interface NormalizedReview {
  rawText: string;
  parsedFormat: string;
  candidateId?: string;
  candidateHash?: string;
  reviewPackageHash?: string;
  sourceTreeHash?: string;
  verdict: string;
  findings: NormalizedFinding[];
  unreviewedAreas: string[];
  warnings: string[];
}

export class ExternalReviewNormalizerService {
  public normalize(input: unknown): NormalizedReview {
    const rawText = typeof input === 'string' ? input : JSON.stringify(input ?? {}, null, 2);
    let obj: any = typeof input === 'object' && input !== null ? input : undefined;
    let parsedFormat = obj ? 'JSON' : /```|^#|\|.*\|/m.test(rawText) ? 'MARKDOWN' : 'TEXT';

    if (!obj) {
      const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
      const candidate = fenced || rawText.trim();
      try {
        obj = JSON.parse(candidate);
        parsedFormat = fenced ? 'MIXED' : 'JSON';
      } catch {
        obj = undefined;
      }
    }

    const candidateId = String(
      obj?.candidateId ||
        pick(rawText, [/candidateId\s*[:=]\s*["']?([^\s,"']+)/i, /(ART-[0-9a-f]+)/i]) ||
        ''
    ) || undefined;

    const candidateHash = String(
      obj?.candidateHash ||
        obj?.contentHash ||
        pick(rawText, [/(?:candidateHash|contentHash)\s*[:=]\s*["']?([0-9a-f]{8,64})/i]) ||
        ''
    ) || undefined;

    const reviewPackageHash = String(
      obj?.reviewPackageHash ||
        obj?.packageSha256 ||
        pick(rawText, [/(?:reviewPackageHash|packageSha256)\s*[:=]\s*["']?([0-9a-f]{64})/i]) ||
        ''
    ) || undefined;

    const sourceTreeHash = String(
      obj?.reviewedSourceTreeSha256 ||
        obj?.sourceTreeSha256 ||
        pick(rawText, [/(?:reviewedSourceTreeSha256|sourceTreeSha256)\s*[:=]\s*["']?([0-9a-f]{64})/i]) ||
        ''
    ) || undefined;

    const rawFindings = Array.isArray(obj?.findings) ? obj.findings : [];
    const findings: NormalizedFinding[] = [];

    for (const f of rawFindings) {
      const claim = String(f?.claim || f?.message || f?.issue || f?.summary || '').trim();
      if (!claim) continue;
      findings.push({
        severity: severityOf(f?.severity || f?.priority),
        file: f?.file ? String(f.file) : undefined,
        line: Number.isFinite(Number(f?.line)) ? Number(f.line) : undefined,
        claim,
        evidence: f?.evidence ? String(f.evidence) : undefined,
        suggestion: f?.suggestion ? String(f.suggestion) : undefined,
        rawFragment: JSON.stringify(f),
      });
    }

    if (findings.length === 0) {
      for (const line of rawText.split(/\r?\n/)) {
        const clean = line.replace(/^\s*[-*#>\d.)]+\s*/, '').trim();
        if (clean.length < 8) continue;
        const sev = severityOf(clean);
        if (sev === 'UNKNOWN' && !/(問題|issue|error|不具合|risk|危険|修正|改善)/i.test(clean)) continue;
        const fm = clean.match(/((?:src|server|android|\.github)\/[\w./-]+|server\.ts)(?::(\d+))?/i);
        findings.push({
          severity: sev,
          file: fm?.[1],
          line: fm?.[2] ? Number(fm[2]) : undefined,
          claim: clean,
          rawFragment: line,
        });
      }
    }

    const warnings: string[] = [];
    if (!candidateId) warnings.push('candidateId_not_found');
    if (!candidateHash) warnings.push('candidateHash_not_found');
    if (!reviewPackageHash) warnings.push('reviewPackageHash_not_found');
    if (findings.length === 0) warnings.push('no_structured_findings');

    return {
      rawText,
      parsedFormat,
      candidateId,
      candidateHash,
      reviewPackageHash,
      sourceTreeHash,
      verdict: verdictOf(obj?.verdict || obj?.decision || rawText),
      findings,
      unreviewedAreas: Array.isArray(obj?.unreviewedAreas || obj?.notReviewed)
        ? (obj.unreviewedAreas || obj.notReviewed).map(String)
        : [],
      warnings,
    };
  }
}

export const externalReviewNormalizerService = new ExternalReviewNormalizerService();

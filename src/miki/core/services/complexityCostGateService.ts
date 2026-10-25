import type { CandidateWorkspace } from './isolatedCandidateWorkspaceService';
export interface ComplexityDecision { passed:boolean; reasons:string[]; metrics:{files:number;addedLines:number;imports:number;publicApis:number;storageKeys:number;events:number}; }
function normalizedMatches(source: string, pattern: RegExp): string[] {
  return (source.match(pattern) || []).map(value => value.trim().replace(/\s+/g, ' '));
}

function countAddedMatches(
  baseline: string,
  candidate: string,
  pattern: RegExp
): number {
  const remaining = new Map<string, number>();
  for (const match of normalizedMatches(baseline, pattern)) {
    remaining.set(match, (remaining.get(match) || 0) + 1);
  }

  let added = 0;
  for (const match of normalizedMatches(candidate, pattern)) {
    const count = remaining.get(match) || 0;
    if (count > 0) {
      remaining.set(match, count - 1);
    } else {
      added += 1;
    }
  }
  return added;
}

function countAddedUniqueTokens(
  baseline: string,
  candidate: string,
  pattern: RegExp
): number {
  const baselineTokens = new Set(
    (baseline.match(pattern) || []).map(token => token.toLowerCase())
  );
  const candidateTokens = new Set(
    (candidate.match(pattern) || []).map(token => token.toLowerCase())
  );
  let added = 0;
  for (const token of candidateTokens) {
    if (!baselineTokens.has(token)) added += 1;
  }
  return added;
}

function countAddedLines(baseline: string, candidate: string): number {
  const remaining = new Map<string, number>();
  for (const line of baseline.split(/\r?\n/)) {
    remaining.set(line, (remaining.get(line) || 0) + 1);
  }

  let added = 0;
  for (const line of candidate.split(/\r?\n/)) {
    const count = remaining.get(line) || 0;
    if (count > 0) {
      remaining.set(line, count - 1);
    } else {
      added += 1;
    }
  }
  return added;
}

class ComplexityCostGateService {
  evaluate(workspace: CandidateWorkspace): ComplexityDecision {
    let addedLines = 0;
    let imports = 0;
    let publicApis = 0;
    let storageKeys = 0;
    let events = 0;

    for (const file of workspace.files) {
      const baseline = file.baselineContent;
      const candidate = file.candidateContent;

      addedLines += countAddedLines(baseline, candidate);
      imports += countAddedMatches(
        baseline,
        candidate,
        /^[ \t]*import\b[^\r\n]*/gm
      );
      publicApis += countAddedMatches(
        baseline,
        candidate,
        /^[ \t]*export[ \t]+(?:class|function|const|interface|type)[ \t]+[A-Za-z_$][\w$]*/gm
      );
      storageKeys += countAddedUniqueTokens(
        baseline,
        candidate,
        /miki_[a-z0-9_]+/gi
      );
      events += countAddedMatches(
        baseline,
        candidate,
        /\.(?:publish|subscribe)[ \t]*\([ \t]*[^,\r\n)]*/g
      );
    }

    const metrics = {
      files: workspace.files.length,
      addedLines,
      imports,
      publicApis,
      storageKeys,
      events
    };

    const reasons: string[] = [];
    if (metrics.files > 12) reasons.push('TOO_MANY_CHANGED_FILES');
    if (metrics.addedLines > 2000) reasons.push('TOO_MANY_ADDED_LINES');
    if (metrics.imports > 24) reasons.push('TOO_MANY_NEW_IMPORTS');
    if (metrics.publicApis > 12) reasons.push('TOO_MANY_NEW_PUBLIC_APIS');
    if (metrics.storageKeys > 8) reasons.push('TOO_MANY_NEW_STORAGE_KEYS');
    if (metrics.events > 24) reasons.push('TOO_MANY_NEW_EVENTS');

    return { passed: reasons.length === 0, reasons, metrics };
  }
}

export const complexityCostGateService = new ComplexityCostGateService();

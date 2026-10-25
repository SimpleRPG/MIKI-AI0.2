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

function variableExportTokens(source: string): string[] {
  const tokens = new Set<string>();
  const prefixes = /^[ \t]*export[ \t]+(?:(?:declare)[ \t]+)?(?:const|let|var)[ \t]+/gm;

  for (const match of source.matchAll(prefixes)) {
    let cursor = (match.index ?? 0) + match[0].length;
    let segmentStart = cursor;
    let depth = 0;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    const segments: string[] = [];

    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      const next = source[cursor + 1];

      if (lineComment) {
        if (character !== '\n') continue;
        lineComment = false;
      }
      if (blockComment) {
        if (character === '*' && next === '/') {
          blockComment = false;
          cursor += 1;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (character === '\\') {
          escaped = true;
          continue;
        }
        if (character === quote) quote = '';
        continue;
      }
      if (character === '/' && next === '/') {
        lineComment = true;
        cursor += 1;
        continue;
      }
      if (character === '/' && next === '*') {
        blockComment = true;
        cursor += 1;
        continue;
      }
      if (character === '\'' || character === '"' || character === '`') {
        quote = character;
        continue;
      }
      if (character === '(' || character === '[' || character === '{') {
        depth += 1;
        continue;
      }
      if (character === ')' || character === ']' || character === '}') {
        if (depth > 0) depth -= 1;
        continue;
      }
      if (depth === 0 && character === ',') {
        segments.push(source.slice(segmentStart, cursor));
        segmentStart = cursor + 1;
        continue;
      }
      if (depth === 0 && character === ';') {
        segments.push(source.slice(segmentStart, cursor));
        segmentStart = cursor + 1;
        break;
      }
      if (depth === 0 && character === '\n') {
        const previous = source.slice(0, cursor).trimEnd().slice(-1);
        const nextLine = source.slice(cursor + 1).split(/\r?\n/, 1)[0].trim();
        if (/[=,:?&|+\-*\/.>]/.test(previous) || /^[,.?&|+\-*\/]/.test(nextLine)) continue;
        segments.push(source.slice(segmentStart, cursor));
        segmentStart = cursor + 1;
        break;
      }
    }
    if (segmentStart < cursor) segments.push(source.slice(segmentStart, cursor));

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      if (trimmed[0] === '{' || trimmed[0] === '[') {
        tokens.add('!unresolved-export-binding:' + trimmed.replace(/\s+/g, ' ').slice(0, 120));
        continue;
      }
      const identifier = trimmed.match(/^([A-Za-z_$][\w$]*)\b/);
      if (!identifier) {
        tokens.add('!unresolved-export-binding:' + trimmed.replace(/\s+/g, ' ').slice(0, 120));
        continue;
      }
      tokens.add(identifier[1]);
    }
  }
  return [...tokens];
}

function publicApiTokens(source: string): string[] {
  const tokens = new Set<string>();
  const declarations =
    /^[ \t]*export[ \t]+(?:(?:declare|abstract|async|default|const)[ \t]+)*(?:class|function|const|let|var|interface|type|enum|namespace)[ \t]+([A-Za-z_$][\w$]*)/gm;
  for (const match of source.matchAll(declarations)) {
    tokens.add(/\bdefault\b/.test(match[0]) ? 'default' : match[1]);
  }

  for (const token of variableExportTokens(source)) tokens.add(token);

  const exportLists =
    /^[ \t]*export[ \t]+(?:type[ \t]+)?\{([^}]*)\}[ \t]*(?:from[ \t]+['"][^'"\r\n]+['"])?[ \t]*;?/gm;
  for (const match of source.matchAll(exportLists)) {
    for (const rawItem of match[1].split(',')) {
      const item = rawItem.trim().replace(/^type[ \t]+/, '');
      const parts = item.split(/[ \t]+as[ \t]+/);
      const exportedName = parts[parts.length - 1].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exportedName)) tokens.add(exportedName);
    }
  }

  const namespaceExports =
    /^[ \t]*export[ \t]+(?:type[ \t]+)?\*[ \t]+as[ \t]+([A-Za-z_$][\w$]*)[ \t]+from[ \t]+['"][^'"\r\n]+['"]/gm;
  for (const match of source.matchAll(namespaceExports)) tokens.add(match[1]);

  const wildcardExports =
    /^[ \t]*export[ \t]+(?:type[ \t]+)?\*[ \t]+from[ \t]+['"]([^'"\r\n]+)['"]/gm;
  for (const match of source.matchAll(wildcardExports)) tokens.add(`*:${match[1]}`);

  if (/^[ \t]*export[ \t]+default\b/m.test(source)) tokens.add('default');
  if (/^[ \t]*export[ \t]*=/m.test(source)) tokens.add('export=');
  return [...tokens].sort();
}

function countAddedPublicApis(baseline: string, candidate: string): number {
  const baselineTokens = new Set(publicApiTokens(baseline));
  const candidateTokens = publicApiTokens(candidate);
  const addedTokens = candidateTokens.filter(token => !baselineTokens.has(token));
  const unresolvedAdded = addedTokens.some(
    token => token.startsWith('*:') || token.startsWith('!unresolved-export-binding:')
  );
  return unresolvedAdded ? Math.max(addedTokens.length, 13) : addedTokens.length;
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
      publicApis += countAddedPublicApis(baseline, candidate);
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

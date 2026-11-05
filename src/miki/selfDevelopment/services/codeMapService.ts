/**
 * 設計思想 第31章 31.6: コード地図ビュー
 *
 * CodeUnderstandingIRをLLMへ再投入するのではなく、ファイル/プロシージャ/変数/呼出/読書き/
 * 副作用/外部依存を小さなグラフへ変換する。確定情報と静的推定を分離する。
 */
import { CodeUnderstandingIR } from '../../../types';

export type CodeMapNodeKind = 'MODULE' | 'PROCEDURE' | 'VARIABLE' | 'DATA' | 'DEPENDENCY' | 'SIDE_EFFECT';
export type CodeMapEdgeKind = 'CONTAINS' | 'CALLS' | 'READS' | 'WRITES' | 'DEPENDS_ON' | 'CAUSES_SIDE_EFFECT';

export interface CodeMapNode { id: string; kind: CodeMapNodeKind; label: string; certainty: 'STATIC_FACT' | 'STATIC_INFERENCE'; }
export interface CodeMapEdge { from: string; to: string; kind: CodeMapEdgeKind; certainty: 'STATIC_FACT' | 'STATIC_INFERENCE'; }
export interface CodeMap {
  id: string; sourceLanguage: string; nodes: CodeMapNode[]; edges: CodeMapEdge[];
  focusedNodeIds: string[]; createdAt: number;
}

class CodeMapService {
  // P440 D3: 生コードから CodeUnderstandingIR を生成する（決定論的・
  // ヒューリスティックな静的解析）。文字列・コメント・テンプレートは
  // 空白化してから走査する。完全な構文解析ではないため、結果は
  // 「理解確認の出題元」として扱い、検証の証拠にはしない。
  public buildIRFromCode(code: string, id: string, sourceLanguage = 'TypeScript'): CodeUnderstandingIR {
    const stripped = stripCodeForIR(code);
    const spans: Array<{ start: number; end: number }> = [];
    const procedures: CodeUnderstandingIR['procedures'] = [];
    const seenNames = new Set<string>();
    const candidates: Array<{ name: string; params: string; openBrace: number; start: number }> = [];
    const pushCandidate = (name: string, paramsRaw: string, openBrace: number, start: number) => {
      if (!name || CODE_MAP_KEYWORDS.has(name)) return;
      if (openBrace < 0) return;
      candidates.push({ name, params: paramsRaw, openBrace, start });
    };
    const functionDecl = /(?:^|[;\n}])\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
    const functionExpr = /(?:^|[;\n}])\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*(?:[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
    const arrowFn = /(?:^|[;\n}])\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=>{]+)?=>\s*\{/g;
    const arrowSingle = /(?:^|[;\n}])\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*(?::\s*[^=>{]+)?=>\s*\{/g;
    const methodFn = /(?:^|\n)\s*(?:(?:public|private|protected|static|async|readonly|get|set|\*)\s+)*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::\s*[^{;]+)?\{/g;
    let match: RegExpExecArray | null;
    while ((match = functionDecl.exec(stripped)) !== null) {
      pushCandidate(match[1], match[2], findNextBrace(stripped, functionDecl.lastIndex), match.index);
    }
    while ((match = functionExpr.exec(stripped)) !== null) {
      pushCandidate(match[1], match[2], findNextBrace(stripped, functionExpr.lastIndex), match.index);
    }
    while ((match = arrowFn.exec(stripped)) !== null) {
      pushCandidate(match[1], match[2], match.index + match[0].length - 1, match.index);
    }
    while ((match = arrowSingle.exec(stripped)) !== null) {
      pushCandidate(match[1], match[2], match.index + match[0].length - 1, match.index);
    }
    while ((match = methodFn.exec(stripped)) !== null) {
      pushCandidate(match[1], match[2], match.index + match[0].length - 1, match.index);
    }
    candidates.sort((a, b) => a.start - b.start);
    for (const candidate of candidates) {
      if (procedures.length >= 32) break;
      if (seenNames.has(candidate.name)) continue;
      // 開きブレースの位置で重複を判定する。候補の start はマッチの
      // 先頭（前の手続きの閉じブレース等）になり得るため、start での
      // 判定だと直後のトップレベル手続きを誤って除外してしまう。
      if (spans.some(span => candidate.openBrace >= span.start && candidate.openBrace < span.end)) continue;
      const closeBrace = findMatchingBrace(stripped, candidate.openBrace);
      if (closeBrace < 0) continue;
      const body = stripped.slice(candidate.openBrace + 1, closeBrace);
      const params = parseParamNames(candidate.params);
      const locals = new Set<string>(params);
      const declared = /(?:^|[;\n{}])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
      let declaredMatch: RegExpExecArray | null;
      while ((declaredMatch = declared.exec(body)) !== null) locals.add(declaredMatch[1]);
      const innerFn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
      while ((declaredMatch = innerFn.exec(body)) !== null) locals.add(declaredMatch[1]);
      const calls = uniqueCapped(extractCalls(body), 16);
      const writes = uniqueCapped(extractWrites(body), 12);
      const writeRoots = new Set(writes.map(write => write.split('.')[0]));
      const reads = uniqueCapped(extractReads(body, locals, new Set(calls), writeRoots, candidate.name), 16);
      const sideEffects = uniqueCapped(writes.filter(write => !locals.has(write.split('.')[0])), 8);
      procedures.push({
        procedureName: candidate.name,
        calls,
        reads,
        writes,
        external_dependencies: extractExternalDependencies(stripped, body),
        side_effects: sideEffects,
        variables: [...locals].slice(0, 16),
      });
      seenNames.add(candidate.name);
      spans.push({ start: candidate.start, end: closeBrace + 1 });
    }
    const globalVariables: string[] = [];
    const topDecl = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
    while ((match = topDecl.exec(stripped)) !== null) {
      if (globalVariables.length >= 32) break;
      if (spans.some(span => match!.index >= span.start && match!.index < span.end)) continue;
      if (!globalVariables.includes(match[1])) globalVariables.push(match[1]);
    }
    const comprehensionQA = procedures.slice(0, 8).map(procedure => ({
      question: `${procedure.procedureName}が書き込む対象は何ですか？`,
      answer: procedure.writes.length > 0 ? procedure.writes.join(', ') : '書き込みなし',
      criteria: 'IRのwritesと一致すること',
    })).slice(0, 10);
    return { id, sourceLanguage, procedures, globalVariables, comprehensionQA };
  }

  public build(ir: CodeUnderstandingIR, focusTerms: string[] = []): CodeMap {
    const nodes: CodeMapNode[] = [];
    const edges: CodeMapEdge[] = [];
    const addNode = (node: CodeMapNode) => { if (!nodes.some(n => n.id === node.id)) nodes.push(node); };
    const addEdge = (edge: CodeMapEdge) => { if (!edges.some(e => e.from === edge.from && e.to === edge.to && e.kind === edge.kind)) edges.push(edge); };
    const moduleId = `module:${ir.id}`;
    addNode({ id: moduleId, kind: 'MODULE', label: ir.sourceLanguage, certainty: 'STATIC_FACT' });
    for (const proc of ir.procedures) {
      const pid = `proc:${ir.id}:${proc.procedureName}`;
      addNode({ id: pid, kind: 'PROCEDURE', label: proc.procedureName, certainty: 'STATIC_FACT' });
      addEdge({ from: moduleId, to: pid, kind: 'CONTAINS', certainty: 'STATIC_FACT' });
      for (const name of proc.calls) {
        const cid = `proc:${ir.id}:${name}`;
        addNode({ id: cid, kind: 'PROCEDURE', label: name, certainty: 'STATIC_INFERENCE' });
        addEdge({ from: pid, to: cid, kind: 'CALLS', certainty: 'STATIC_FACT' });
      }
      for (const value of proc.reads) {
        const did = `data:${ir.id}:${value}`;
        addNode({ id: did, kind: 'DATA', label: value, certainty: 'STATIC_FACT' });
        addEdge({ from: pid, to: did, kind: 'READS', certainty: 'STATIC_FACT' });
      }
      for (const value of proc.writes) {
        const did = `data:${ir.id}:${value}`;
        addNode({ id: did, kind: 'DATA', label: value, certainty: 'STATIC_FACT' });
        addEdge({ from: pid, to: did, kind: 'WRITES', certainty: 'STATIC_FACT' });
      }
      for (const dep of proc.external_dependencies) {
        const did = `dep:${ir.id}:${dep}`;
        addNode({ id: did, kind: 'DEPENDENCY', label: dep, certainty: 'STATIC_FACT' });
        addEdge({ from: pid, to: did, kind: 'DEPENDS_ON', certainty: 'STATIC_FACT' });
      }
      for (const effect of proc.side_effects) {
        const sid = `effect:${ir.id}:${effect}`;
        addNode({ id: sid, kind: 'SIDE_EFFECT', label: effect, certainty: 'STATIC_FACT' });
        addEdge({ from: pid, to: sid, kind: 'CAUSES_SIDE_EFFECT', certainty: 'STATIC_INFERENCE' });
      }
    }
    for (const variable of ir.globalVariables) {
      const vid = `var:${ir.id}:${variable}`;
      addNode({ id: vid, kind: 'VARIABLE', label: variable, certainty: 'STATIC_FACT' });
      addEdge({ from: moduleId, to: vid, kind: 'CONTAINS', certainty: 'STATIC_FACT' });
    }
    const normalized = focusTerms.map(t => t.toLowerCase()).filter(Boolean);
    const focused = normalized.length === 0 ? nodes.map(n => n.id) : nodes.filter(n => {
      const text = n.label.toLowerCase();
      return normalized.some(term => text.includes(term)) || edges.some(e => (e.from === n.id || e.to === n.id) && normalized.some(term => (nodes.find(x => x.id === (e.from === n.id ? e.to : e.from))?.label || '').toLowerCase().includes(term)));
    }).map(n => n.id);
    return { id: `codemap_${ir.id}`, sourceLanguage: ir.sourceLanguage, nodes, edges, focusedNodeIds: Array.from(new Set(focused)), createdAt: Date.now() };
  }
}
export const codeMapService = new CodeMapService();

const CODE_MAP_KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', 'try', 'finally', 'return', 'throw', 'new', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of', 'await', 'yield', 'function', 'class', 'extends', 'super', 'this', 'import', 'export', 'default', 'break', 'continue', 'debugger', 'with']);

function stripCodeForIR(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && code[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) { out += code[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ' '; i++;
      while (i < n) {
        if (code[i] === '\\') { out += '  '; i += 2; continue; }
        if (code[i] === quote) { out += ' '; i++; break; }
        out += code[i] === '\n' ? '\n' : ' '; i++;
      }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

function findNextBrace(code: string, from: number): number {
  for (let i = from; i < Math.min(code.length, from + 120); i++) {
    if (code[i] === '{') return i;
    if (code[i] === ';') return -1;
  }
  return -1;
}

function findMatchingBrace(code: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseParamNames(paramsRaw: string): string[] {
  if (!paramsRaw.trim()) return [];
  const names: string[] = [];
  for (const part of paramsRaw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('...')) continue;
    const nameMatch = /^([A-Za-z_$][\w$]*)/.exec(trimmed);
    if (nameMatch) names.push(nameMatch[1]);
  }
  return names;
}

function uniqueCapped(items: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

function extractCalls(body: string): string[] {
  const calls: string[] = [];
  const callPattern = /([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callPattern.exec(body)) !== null) {
    if (!CODE_MAP_KEYWORDS.has(match[1])) calls.push(match[1]);
  }
  return calls;
}

function extractWrites(body: string): string[] {
  const writes: string[] = [];
  const writePattern = /(?:^|[^\w$.])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(=(?![=>])|\+=|-=|\*=|\/=|%=|\+\+|--)/g;
  let match: RegExpExecArray | null;
  while ((match = writePattern.exec(body)) !== null) {
    if (!CODE_MAP_KEYWORDS.has(match[1].split('.')[0])) writes.push(match[1]);
  }
  return writes;
}

function extractReads(body: string, locals: Set<string>, calls: Set<string>, writeRoots: Set<string>, ownName: string): string[] {
  const reads: string[] = [];
  const identifierPattern = /([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = identifierPattern.exec(body)) !== null) {
    const name = match[1];
    if (CODE_MAP_KEYWORDS.has(name)) continue;
    if (name === ownName || locals.has(name) || calls.has(name) || writeRoots.has(name)) continue;
    const prevChar = body[match.index - 1];
    if (prevChar === '.') continue;
    reads.push(name);
  }
  return reads;
}

function extractExternalDependencies(strippedCode: string, body: string): string[] {
  const localToModule = new Map<string, string>();
  const importPattern = /import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*)|\*\s+as\s+([A-Za-z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(strippedCode)) !== null) {
    const moduleName = match[4];
    if (match[1]) {
      for (const part of match[1].split(',')) {
        const local = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (local) localToModule.set(local, moduleName);
      }
    } else if (match[2]) {
      localToModule.set(match[2], moduleName);
    } else if (match[3]) {
      localToModule.set(match[3], moduleName);
    }
  }
  const requirePattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(strippedCode)) !== null) {
    localToModule.set(match[1], match[2]);
  }
  const modules: string[] = [];
  const seen = new Set<string>();
  for (const [local, moduleName] of localToModule) {
    if (seen.has(moduleName)) continue;
    if (new RegExp(`(?:^|[^\\w$.])${local}(?:[^\\w$]|$)`).test(body)) {
      seen.add(moduleName);
      modules.push(moduleName);
      if (modules.length >= 8) break;
    }
  }
  return modules;
}

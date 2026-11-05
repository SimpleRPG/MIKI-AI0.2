/**
 * 設計思想 第31章 31.8: コード読解クイズ自動生成
 *
 * CodeUnderstandingIR から決定論的にクイズを生成する。生成はテンプレート
 * のまま。P440 D3 で追加した判定は、IR を見ない別経路（生コードからの
 * 再導出）で回答を作り、IR の writes との一致で判定する。出題元と採点
 * 基準が同じ IR だと自明に合格してしまうため、回答経路の独立性が必須。
 * クイズの結果は学習の信号専用で、検証の証拠にはしない。
 */
import { CodeUnderstandingIR } from '../../../types';
import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { codeMapService } from '../../selfDevelopment/services/codeMapService';

export interface CodeComprehensionQuiz { id: string; question: string; expectedAnswer: string; criteria: string; source: 'STATIC_IR'; difficulty: 'EASY'|'NORMAL'|'HARD'; }

export interface ComprehensionSelfTestResult {
  topicId: string;
  codeHash: string;
  total: number;
  passed: number;
  failed: number;
  failedQuestions: string[];
  rerun: boolean;
  observedAt: number;
}

export interface ComprehensionTopicMismatch {
  topic: string;
  mismatches: number;
  runs: number;
}

// P440 D3: 学習専用台帳。証拠系・検証台帳・候補生成台帳には書かない。
const COMPREHENSION_SELF_TEST_KEY = 'miki_comprehension_self_test_v1';
const COMPREHENSION_SELF_TEST_MAX_RECORDS = 200;

class CodeComprehensionQuizService {
  public generate(ir: CodeUnderstandingIR, limit = 10): CodeComprehensionQuiz[] {
    const out: CodeComprehensionQuiz[] = [];
    for (const qa of ir.comprehensionQA.slice(0, limit)) out.push({ id: `quiz_${ir.id}_${out.length}`, question: qa.question, expectedAnswer: qa.answer, criteria: qa.criteria, source: 'STATIC_IR', difficulty: 'NORMAL' });
    if (out.length < limit) for (const proc of ir.procedures) {
      if (out.length >= limit) break;
      out.push({ id: `quiz_${ir.id}_${out.length}`, question: `${proc.procedureName}が書き込む対象は何ですか？`, expectedAnswer: proc.writes.join(', ') || '書き込みなし', criteria: 'IRのwritesと一致すること', source: 'STATIC_IR', difficulty: 'EASY' });
    }
    return out;
  }

  // P440 D3: 1問の判定。writes 問題だけを決定論的に判定する。
  // criteria が「IRのwritesと一致すること」以外のものは対象外。
  public judge(quiz: CodeComprehensionQuiz, derivedAnswer: string): boolean {
    if (quiz.criteria !== 'IRのwritesと一致すること') return false;
    const expected = new Set(
      quiz.expectedAnswer === '書き込みなし' ? [] : quiz.expectedAnswer.split(',').map(part => part.trim()).filter(Boolean),
    );
    const derived = new Set(
      derivedAnswer === '書き込みなし' ? [] : derivedAnswer.split(',').map(part => part.trim()).filter(Boolean),
    );
    if (expected.size !== derived.size) return false;
    for (const item of expected) {
      if (!derived.has(item)) return false;
    }
    return true;
  }

  // P440 D3: IR を生成する自己テストの入口。IR を作り、クイズを出し、
  // 生コードから書き込みを再導出して判定し、学習専用台帳に記録する。
  // 同じコード（同一ハッシュ）の再実行は台帳の直近の記録を返す。
  public runSelfTest(input: { code: string; id: string; sourceLanguage?: string }): ComprehensionSelfTestResult {
    const codeHash = canonicalSha256(input.code);
    const records = this.listRecords();
    const previous = records.find(record => record.topicId === input.id && record.codeHash === codeHash);
    if (previous) {
      return { ...previous, rerun: false };
    }
    const ir = codeMapService.buildIRFromCode(input.code, input.id, input.sourceLanguage ?? 'TypeScript');
    const quizzes = this.generate(ir, 10);
    let passed = 0;
    let failed = 0;
    const failedQuestions: string[] = [];
    for (const quiz of quizzes) {
      const procedureName = extractProcedureNameFromQuestion(quiz.question);
      if (!procedureName) continue;
      const derivedWrites = deriveWritesFromCode(input.code, procedureName);
      const derivedAnswer = derivedWrites.length > 0 ? derivedWrites.join(', ') : '書き込みなし';
      if (this.judge(quiz, derivedAnswer)) {
        passed++;
      } else {
        failed++;
        failedQuestions.push(quiz.question);
      }
    }
    const result: ComprehensionSelfTestResult = {
      topicId: input.id,
      codeHash,
      total: passed + failed,
      passed,
      failed,
      failedQuestions: failedQuestions.slice(0, 10),
      rerun: true,
      observedAt: Date.now(),
    };
    const next = [result, ...records].slice(0, COMPREHENSION_SELF_TEST_MAX_RECORDS);
    try {
      storageService.setItem(COMPREHENSION_SELF_TEST_KEY, JSON.stringify(next));
    } catch {
      // 学習台帳の永続化失敗は結果を変えない。
    }
    return result;
  }

  // P440 D3: 不一致が多かったトピックの集計（D1 の「次に学ぶべき
  // トピック」への入力用）。学習専用台帳だけを読む。
  public listTopicMismatches(): ComprehensionTopicMismatch[] {
    const byTopic = new Map<string, { mismatches: number; runs: number }>();
    for (const record of this.listRecords()) {
      if (record.failed === 0) continue;
      const entry = byTopic.get(record.topicId) || { mismatches: 0, runs: 0 };
      entry.mismatches += record.failed;
      entry.runs += 1;
      byTopic.set(record.topicId, entry);
    }
    return [...byTopic.entries()]
      .map(([topic, entry]) => ({ topic, mismatches: entry.mismatches, runs: entry.runs }))
      .sort((a, b) => b.mismatches - a.mismatches);
  }

  public listRecords(): ComprehensionSelfTestResult[] {
    try {
      const raw = storageService.getItem(COMPREHENSION_SELF_TEST_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as ComprehensionSelfTestResult[]) : [];
    } catch {
      return [];
    }
  }
}

function extractProcedureNameFromQuestion(question: string): string | null {
  const match = /^(.+?)が書き込む対象は何ですか？$/.exec(question);
  return match ? match[1] : null;
}

// P440 D3: 回答の再導出。codeMapService の IR 生成とは意図的に共有
// しない小さなパーサーで、生コードから対象プロシージャの書き込みを
// 直接読み取る。IR を見ない別経路であることが、自己テストの独立性
// の根拠。ヒューリスティックであり、完全な構文解析ではない。
function deriveWritesFromCode(code: string, procedureName: string): string[] {
  const stripped = stripCodeForDerivation(code);
  const body = findProcedureBody(stripped, procedureName);
  if (body === null) return [];
  const writes: string[] = [];
  const seen = new Set<string>();
  const writePattern = /(?:^|[^\w$.])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(=(?![=>])|\+=|-=|\*=|\/=|%=|\+\+|--)/g;
  let match: RegExpExecArray | null;
  while ((match = writePattern.exec(body)) !== null) {
    const target = match[1];
    if (target === 'return' || target === 'if' || target === 'for' || target === 'while') continue;
    if (seen.has(target)) continue;
    seen.add(target);
    writes.push(target);
    if (writes.length >= 12) break;
  }
  return writes;
}

function findProcedureBody(stripped: string, procedureName: string): string | null {
  const escaped = procedureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`(?:^|[;\\n}])\\s*(?:export\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${escaped}\\s*\\(([^)]*)\\)`),
    new RegExp(`(?:^|[;\\n}])\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s+)?function\\s*(?:[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)`),
    new RegExp(`(?:^|[;\\n}])\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*(?::\\s*[^=>{]+)?=>\\s*\\{`),
    new RegExp(`(?:^|[;\\n}])\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?[A-Za-z_$][\\w$]*\\s*(?::\\s*[^=>{]+)?=>\\s*\\{`),
    new RegExp(`(?:^|\\n)\\s*(?:(?:public|private|protected|static|async|readonly|get|set|\\*)\\s+)*${escaped}\\s*\\(([^)]*)\\)\\s*(?::\\s*[^{;]+)?\\{`),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(stripped);
    if (!match) continue;
    const openBrace = match[0].endsWith('{')
      ? match.index + match[0].length - 1
      : findNextBraceForDerivation(stripped, match.index + match[0].length);
    if (openBrace < 0) continue;
    const closeBrace = findMatchingBraceForDerivation(stripped, openBrace);
    if (closeBrace < 0) continue;
    return stripped.slice(openBrace + 1, closeBrace);
  }
  return null;
}

function stripCodeForDerivation(code: string): string {
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

function findNextBraceForDerivation(code: string, from: number): number {
  for (let i = from; i < Math.min(code.length, from + 120); i++) {
    if (code[i] === '{') return i;
    if (code[i] === ';') return -1;
  }
  return -1;
}

function findMatchingBraceForDerivation(code: string, openIndex: number): number {
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

export const codeComprehensionQuizService = new CodeComprehensionQuizService();

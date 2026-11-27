// P3012: 統合知識グラフ（ループを閉じる層・第1スライス）。
//
// 設計（きりあと 2026-11-27/28 に決定）:
//  - 彼女の理解は二様式。選択（状況→行動をスコアで選ぶ、従来どおり速く）と
//    連結（因果リンク「◯◯だから◯◯」を多段にたどる。説明・診断・調査は
//    連結側の仕事）。
//  - バラバラだった保管庫（コード理解索引・部品保管庫・教師レッスン・
//    診断台帳）を、1つのグラフとして読む。ノード＝彼女が推論に使うもの、
//    エッジ＝種類付きの関係（構造・因果・根拠・由来・検証）。
//  - コード理解索引（selfCodeUnderstandingService）は既にグラフ（ファイル／
//    シンボル＝ノード、IMPORTS/CALLS/READS_STORAGE 等＝エッジ）なので、
//    作り直さず射影して取り込む。
//  - 規律: 嘘の「だから」は無いより悪い。因果・説明エッジ（CAUSES /
//    EXPLAINS）は必ず検証状態を持ち、消費側が区別できること。生の塊
//    （ファイル本文・会話ログ）はノードにせず、payloadRef で参照だけ持つ。
//  - 既存の保管庫は書き換えない。このサービスは読み取り専用の射影／
//    アダプタ層であり、どこにも書き戻さない。
//
// 本スライスの実施範囲:
//  - 部品保管庫の射影（レッスン／診断パターン／知識部品→ノード、
//    教師検証スタンプ→VERIFIED_BY エッジ）。
//  - 診断台帳の射影（試行・ケース→ノード、因果連鎖→STATEMENT ノードと
//    CAUSES エッジ、パターンの由来→DERIVED_FROM、証拠→SUPPORTS、
//    診断→ケースへの EXPLAINS）。
//  - コード理解索引の射影（遅延構築。ファイル／シンボル→ノード、
//    関係→構造エッジ、未解決の端点→CONCEPT ノード）。
//  - 最初の消費側: 会話の「やり方」質問を、グラフ経由で検証済みレッスン
//    ノードへ案内する（conversationCoreService.lessonHowToAnswer）。
// 後段（ここでは作らない）: 連鎖の上での予測→結果比較→リンク改訂、
// 具体リンクの抽象化、計画の後方連鎖。
import { componentRepositoryCacheService } from '../../memory/services/componentRepositoryCacheService';
import { teacherLessonRecallService } from '../../memory/services/teacherLessonRecallService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { diagnosisTaskService } from './diagnosisTaskService';
import { canonicalSha256 } from './canonicalSha256Service';

export type KnowledgeNodeKind =
  | 'FILE' | 'SYMBOL' | 'LESSON' | 'COMPONENT' | 'DIAGNOSIS_PATTERN'
  | 'DIAGNOSIS_ATTEMPT' | 'DIAGNOSIS_CASE' | 'STATEMENT' | 'VERIFIER' | 'CONCEPT';

export type KnowledgeEdgeKind =
  | 'IMPORTS' | 'CALLS' | 'IMPLEMENTS' | 'EXTENDS'
  | 'READS_STORAGE' | 'WRITES_STORAGE'
  | 'DECLARES_COMMAND' | 'USES_COMMAND'
  | 'PUBLISHES_EVENT' | 'SUBSCRIBES_EVENT'
  | 'CONTAINS' | 'CAUSES' | 'EXPLAINS' | 'DERIVED_FROM' | 'VERIFIED_BY' | 'SUPPORTS';

// CLAUDE_VERIFIED: Muse（教師）が実際に確認したもの（P3007 のスタンプ）。
// SELF_GATED: 彼女自身の検証ゲートを通ったもの。
// UNVERIFIED: まだ誰の検証も通っていないもの（彼女の診断パターンや
//   因果連鎖はこちら。因果の主張は証拠の引用確認とは別物として扱う）。
// STRUCTURAL: コードから機械的に抽出した構造的事実（意味の検証ではない）。
export type KnowledgeVerification = 'CLAUDE_VERIFIED' | 'SELF_GATED' | 'UNVERIFIED' | 'STRUCTURAL';

export interface KnowledgeNode {
  id: string;
  kind: KnowledgeNodeKind;
  label: string;
  verification: KnowledgeVerification;
  // 生データそのものは持たない。実体は元の保管庫にあり、これは参照だけ。
  payloadRef?: { store: string; key: string };
  componentId?: string;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  kind: KnowledgeEdgeKind;
  verification: KnowledgeVerification;
  evidence?: string;
}

export interface GroundedLessonNode {
  node: KnowledgeNode;
  componentId: string;
  lessonId: string;
  title: string;
  rule: string;
  reason?: string;
  antiPattern?: string;
  subject: string;
  verification: KnowledgeVerification;
}

interface Projection {
  nodes: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
  out: Map<string, KnowledgeEdge[]>;
  into: Map<string, KnowledgeEdge[]>;
}

function emptyProjection(): Projection {
  return { nodes: new Map(), edges: [], out: new Map(), into: new Map() };
}

function addNode(p: Projection, node: KnowledgeNode): void {
  if (!p.nodes.has(node.id)) p.nodes.set(node.id, node);
}

function addEdge(p: Projection, edge: KnowledgeEdge): void {
  p.edges.push(edge);
  const o = p.out.get(edge.from);
  if (o) o.push(edge); else p.out.set(edge.from, [edge]);
  const i = p.into.get(edge.to);
  if (i) i.push(edge); else p.into.set(edge.to, [edge]);
}

function mergeInto(base: Projection, extra: Projection): void {
  for (const node of extra.nodes.values()) addNode(base, node);
  for (const edge of extra.edges) addEdge(base, edge);
}

function componentVerification(item: Record<string, unknown>): KnowledgeVerification {
  const tv = item.teacherVerification as { verifiedBy?: unknown } | undefined;
  if (tv && typeof tv.verifiedBy === 'string' && tv.verifiedBy) return 'CLAUDE_VERIFIED';
  if (item.verificationStatus === 'VERIFIED' || item.lifecycleStatus === 'VERIFIED') return 'SELF_GATED';
  return 'UNVERIFIED';
}

const VERIFIER_CLAUDE_ID = 'verifier:Claude';

function statementId(text: string): string {
  return `stmt:${canonicalSha256(text).slice(0, 16)}`;
}

// ---- 部品保管庫＋診断台帳の射影（軽い。最初に使う） ----
let learnedCache: {
  itemsRef: unknown;
  attemptsFingerprint: string;
  projection: Projection;
  lessonByComponentId: Map<string, GroundedLessonNode>;
} | null = null;

function buildLearnedProjection(): { projection: Projection; lessonByComponentId: Map<string, GroundedLessonNode> } {
  const p = emptyProjection();
  const lessonByComponentId = new Map<string, GroundedLessonNode>();
  const items = componentRepositoryCacheService.readAll();
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const componentId = typeof item.componentId === 'string' ? item.componentId : '';
    if (!componentId) continue;
    const verification = componentVerification(item);
    if (item.componentType === 'TEACHER_LESSON') {
      const lesson = item.lesson as Record<string, unknown> | undefined;
      if (!lesson || typeof lesson.title !== 'string' || typeof lesson.rule !== 'string') continue;
      const lessonId = typeof lesson.id === 'string' ? lesson.id : '';
      const node: KnowledgeNode = {
        id: lessonId ? `lesson:${lessonId}` : `component:${componentId}`,
        kind: 'LESSON',
        label: lesson.title,
        verification,
        payloadRef: { store: 'componentRepository', key: componentId },
        componentId,
      };
      addNode(p, node);
      lessonByComponentId.set(componentId, {
        node,
        componentId,
        lessonId,
        title: lesson.title,
        rule: lesson.rule,
        reason: typeof lesson.reason === 'string' ? lesson.reason : undefined,
        antiPattern: typeof lesson.antiPattern === 'string' ? lesson.antiPattern : undefined,
        subject: typeof item.packageSubject === 'string' ? item.packageSubject : '',
        verification,
      });
      const tv = item.teacherVerification as { verifiedBy?: unknown; how?: unknown } | undefined;
      if (tv && typeof tv.verifiedBy === 'string' && tv.verifiedBy) {
        addNode(p, { id: VERIFIER_CLAUDE_ID, kind: 'VERIFIER', label: 'Claude（教師検証）', verification: 'CLAUDE_VERIFIED' });
        addEdge(p, {
          from: node.id, to: VERIFIER_CLAUDE_ID, kind: 'VERIFIED_BY', verification: 'CLAUDE_VERIFIED',
          evidence: typeof tv.how === 'string' ? tv.how : undefined,
        });
      }
      continue;
    }
    if (item.componentType === 'DIAGNOSIS_PATTERN') {
      const pattern = item.diagnosisPattern as { findingKind?: unknown; selectorShape?: unknown } | undefined;
      addNode(p, {
        id: `component:${componentId}`,
        kind: 'DIAGNOSIS_PATTERN',
        label: pattern
          ? `診断パターン ${String(pattern.findingKind || '')}/${String(pattern.selectorShape || '')}`
          : `診断パターン ${componentId}`,
        verification,
        payloadRef: { store: 'componentRepository', key: componentId },
        componentId,
      });
      continue;
    }
    addNode(p, {
      id: `component:${componentId}`,
      kind: 'COMPONENT',
      label: typeof item.purpose === 'string' ? item.purpose.slice(0, 120) : componentId,
      verification,
      payloadRef: { store: 'componentRepository', key: componentId },
      componentId,
    });
  }

  // 診断台帳: 試行・ケース・因果連鎖・由来・証拠。
  let attempts: ReturnType<typeof diagnosisTaskService.listAttempts> = [];
  try { attempts = diagnosisTaskService.listAttempts(); } catch { attempts = []; }
  for (const attempt of attempts) {
    // 彼女の証拠検証（引用が証拠パックに実在すること）を通って初めて
    // diagnosed になるので、診断済みの試行は SELF_GATED。ただし因果
    // 連鎖の主張そのものは未検証として分けて持つ（下の CAUSES）。
    const attemptVerification: KnowledgeVerification =
      attempt.diagnosis.status === 'diagnosed' ? 'SELF_GATED' : 'UNVERIFIED';
    const attemptNode: KnowledgeNode = {
      id: `attempt:${attempt.attemptId}`,
      kind: 'DIAGNOSIS_ATTEMPT',
      label: `${attempt.caseId} / ${attempt.findingKind || attempt.diagnosis.status}`,
      verification: attemptVerification,
      payloadRef: { store: 'diagnosisLedger', key: attempt.attemptId },
    };
    addNode(p, attemptNode);
    const caseNodeId = `case:${attempt.caseId}`;
    addNode(p, {
      id: caseNodeId, kind: 'DIAGNOSIS_CASE', label: attempt.caseId,
      verification: 'STRUCTURAL', payloadRef: { store: 'diagnosisCase', key: attempt.targetFile },
    });
    if (attempt.diagnosis.status === 'diagnosed') {
      addEdge(p, { from: attemptNode.id, to: caseNodeId, kind: 'EXPLAINS', verification: attemptVerification });
    }
    // パターンは試行の診断から一般化された（由来）。逆に、既存パターンを
    // 根拠に使った試行は、そのパターンから導かれた。
    if (attempt.patternComponentId) {
      addEdge(p, {
        from: `component:${attempt.patternComponentId}`, to: attemptNode.id,
        kind: 'DERIVED_FROM', verification: 'STRUCTURAL',
      });
    }
    for (const basisId of attempt.patternBasisIds || []) {
      addEdge(p, {
        from: attemptNode.id, to: `component:${basisId}`,
        kind: 'DERIVED_FROM', verification: 'STRUCTURAL',
      });
    }
    const chain = attempt.diagnosis.causalChain || [];
    let lastConclusionId = '';
    for (const link of chain) {
      const premiseId = statementId(link.premise);
      const conclusionId = statementId(link.conclusion);
      addNode(p, { id: premiseId, kind: 'STATEMENT', label: link.premise, verification: 'UNVERIFIED' });
      addNode(p, { id: conclusionId, kind: 'STATEMENT', label: link.conclusion, verification: 'UNVERIFIED' });
      // 因果の主張は彼女の一般化であり、証拠の引用確認とは別。未検証と
      // 明示する（嘘の「だから」は無いより悪い、という規律）。
      addEdge(p, { from: premiseId, to: conclusionId, kind: 'CAUSES', verification: 'UNVERIFIED' });
      lastConclusionId = conclusionId;
    }
    if (lastConclusionId && attempt.diagnosis.evidence) {
      addEdge(p, {
        from: attemptNode.id, to: lastConclusionId, kind: 'SUPPORTS',
        verification: attemptVerification, evidence: attempt.diagnosis.evidence,
      });
    }
  }
  return { projection: p, lessonByComponentId };
}

function learnedProjection(): { projection: Projection; lessonByComponentId: Map<string, GroundedLessonNode> } {
  // 保管庫の配列参照が同じ間は射影を使い回す（teacherLessonRecallService
  // の LessonStore と同じ作り）。試行台帳は件数＋末尾で指紋を取る。
  const items = componentRepositoryCacheService.readAll();
  let attemptsFingerprint = '';
  try {
    const attempts = diagnosisTaskService.listAttempts();
    const last = attempts[attempts.length - 1];
    attemptsFingerprint = `${attempts.length}:${last ? `${last.attemptId}:${last.at}` : ''}`;
  } catch { attemptsFingerprint = 'err'; }
  if (learnedCache && learnedCache.itemsRef === (items as unknown)
    && learnedCache.attemptsFingerprint === attemptsFingerprint) {
    return learnedCache;
  }
  const built = buildLearnedProjection();
  learnedCache = {
    itemsRef: items as unknown,
    attemptsFingerprint,
    projection: built.projection,
    lessonByComponentId: built.lessonByComponentId,
  };
  return learnedCache;
}

// ---- コード理解索引の射影（重い。要求された時だけ構築） ----
let codeCache: { snapshotSha: string; projection: Projection } | null = null;

function buildCodeProjection(): Projection {
  const p = emptyProjection();
  let snapshot: ReturnType<typeof selfCodeUnderstandingService.getSnapshot>;
  try { snapshot = selfCodeUnderstandingService.getSnapshot(); } catch { snapshot = undefined; }
  if (!snapshot) return p;
  const fileIds = new Set(snapshot.entries.map((e) => `file:${e.path}`));
  const symbolIds = new Set<string>();
  for (const entry of snapshot.entries) {
    for (const sym of entry.symbols) symbolIds.add(`symbol:${sym.id}`);
  }
  const resolve = (raw: string, selfPath: string): string => {
    if (fileIds.has(`file:${raw}`)) return `file:${raw}`;
    if (symbolIds.has(`symbol:${raw}`)) return `symbol:${raw}`;
    if (raw === selfPath) return `file:${raw}`;
    return `concept:${raw}`;
  };
  for (const entry of snapshot.entries) {
    const fileId = `file:${entry.path}`;
    addNode(p, {
      id: fileId, kind: 'FILE', label: entry.role ? `${entry.path} — ${entry.role}` : entry.path,
      verification: 'STRUCTURAL', payloadRef: { store: 'codeUnderstandingEntry', key: entry.path },
    });
    for (const sym of entry.symbols) {
      const symId = `symbol:${sym.id}`;
      addNode(p, {
        id: symId, kind: 'SYMBOL', label: sym.qualifiedName || sym.name,
        verification: 'STRUCTURAL', payloadRef: { store: 'codeUnderstandingEntry', key: entry.path },
      });
      addEdge(p, { from: fileId, to: symId, kind: 'CONTAINS', verification: 'STRUCTURAL' });
    }
    for (const rel of entry.relations) {
      const from = resolve(rel.from, entry.path);
      const to = resolve(rel.to, entry.path);
      if (!p.nodes.has(from)) {
        addNode(p, { id: from, kind: 'CONCEPT', label: rel.from, verification: 'STRUCTURAL' });
      }
      if (!p.nodes.has(to)) {
        addNode(p, { id: to, kind: 'CONCEPT', label: rel.to, verification: 'STRUCTURAL' });
      }
      addEdge(p, {
        from, to, kind: rel.kind as KnowledgeEdgeKind, verification: 'STRUCTURAL',
        evidence: rel.evidence,
      });
    }
  }
  return p;
}

function codeProjection(): Projection {
  let sha = '';
  try { sha = selfCodeUnderstandingService.getSnapshot()?.snapshotSha256 || ''; } catch { sha = ''; }
  if (codeCache && codeCache.snapshotSha === sha && sha) return codeCache.projection;
  const built = buildCodeProjection();
  codeCache = { snapshotSha: sha, projection: built };
  return built;
}

function combinedProjection(includeCode: boolean): Projection {
  const learned = learnedProjection().projection;
  if (!includeCode) return learned;
  const merged = emptyProjection();
  mergeInto(merged, learned);
  mergeInto(merged, codeProjection());
  return merged;
}

export const knowledgeGraphService = {
  // 射影の規模（点検用）。コード射影は重いので、要求が無ければ数えない。
  stats(includeCode = false): { nodes: number; edges: number; codeProjected: boolean; byNodeKind: Record<string, number>; byEdgeKind: Record<string, number> } {
    const p = combinedProjection(includeCode);
    const byNodeKind: Record<string, number> = {};
    for (const n of p.nodes.values()) byNodeKind[n.kind] = (byNodeKind[n.kind] || 0) + 1;
    const byEdgeKind: Record<string, number> = {};
    for (const e of p.edges) byEdgeKind[e.kind] = (byEdgeKind[e.kind] || 0) + 1;
    return { nodes: p.nodes.size, edges: p.edges.length, codeProjected: includeCode, byNodeKind, byEdgeKind };
  },

  nodeById(id: string, includeCode = false): KnowledgeNode | undefined {
    return combinedProjection(includeCode).nodes.get(id);
  },

  edgesFrom(id: string, kinds?: KnowledgeEdgeKind[], includeCode = false): KnowledgeEdge[] {
    const edges = combinedProjection(includeCode).out.get(id) || [];
    return kinds ? edges.filter((e) => kinds.includes(e.kind)) : [...edges];
  },

  edgesTo(id: string, kinds?: KnowledgeEdgeKind[], includeCode = false): KnowledgeEdge[] {
    const edges = combinedProjection(includeCode).into.get(id) || [];
    return kinds ? edges.filter((e) => kinds.includes(e.kind)) : [...edges];
  },

  // コード理解索引の射影を明示的に構築する（規模を返す）。
  projectCode(): { files: number; symbols: number; edges: number } {
    const p = codeProjection();
    let files = 0;
    let symbols = 0;
    for (const n of p.nodes.values()) {
      if (n.kind === 'FILE') files += 1;
      else if (n.kind === 'SYMBOL') symbols += 1;
    }
    return { files, symbols, edges: p.edges.length };
  },

  // 質問文に合うレッスンを、グラフのノードとして順位つきで返す。
  // 照合は実績のある teacherLessonRecallService の基準をそのまま使い、
  // グラフ側は「ノードとしての位置づけと検証状態」を付けて返す。
  findLessonNodesFor(text: string): GroundedLessonNode[] {
    const { lessonByComponentId } = learnedProjection();
    const ranked = teacherLessonRecallService.findRanked(text);
    const out: GroundedLessonNode[] = [];
    for (const view of ranked) {
      const grounded = lessonByComponentId.get(view.componentId);
      if (grounded) out.push(grounded);
    }
    return out;
  },

  // 連結モードの基本動作: 起点の文から CAUSES エッジを前方へたどり、
  // 因果の連なりを順序つきで返す（説明・診断が辿る対象）。
  walkCauses(fromNodeId: string, maxDepth = 8): Array<{ node: KnowledgeNode; depth: number }> {
    const p = learnedProjection().projection;
    const out: Array<{ node: KnowledgeNode; depth: number }> = [];
    const seen = new Set<string>([fromNodeId]);
    let frontier = [fromNodeId];
    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of p.out.get(id) || []) {
          if (edge.kind !== 'CAUSES' || seen.has(edge.to)) continue;
          seen.add(edge.to);
          const node = p.nodes.get(edge.to);
          if (node) out.push({ node, depth });
          next.push(edge.to);
        }
      }
      frontier = next;
    }
    return out;
  },
};

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
import { teacherLessonRecallService, titleKeys } from '../../memory/services/teacherLessonRecallService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { diagnosisTaskService } from './diagnosisTaskService';
import { contentDecompositionService } from './contentDecompositionService';
import { canonicalSha256 } from './canonicalSha256Service';
import { isTrustedVerifierName } from './trustedVerifier';

export type KnowledgeNodeKind =
  | 'FILE' | 'SYMBOL' | 'LESSON' | 'COMPONENT' | 'DIAGNOSIS_PATTERN'
  | 'DIAGNOSIS_ATTEMPT' | 'DIAGNOSIS_CASE' | 'STATEMENT' | 'VERIFIER' | 'CONCEPT'
  | 'CLAIM' | 'ENTITY';

export type KnowledgeEdgeKind =
  | 'IMPORTS' | 'CALLS' | 'IMPLEMENTS' | 'EXTENDS'
  | 'READS_STORAGE' | 'WRITES_STORAGE'
  | 'DECLARES_COMMAND' | 'USES_COMMAND'
  | 'PUBLISHES_EVENT' | 'SUBSCRIBES_EVENT'
  | 'CONTAINS' | 'CAUSES' | 'EXPLAINS' | 'DERIVED_FROM' | 'VERIFIED_BY' | 'SUPPORTS'
  | 'IS_A' | 'PART_OF' | 'ENABLES' | 'USED_FOR'
  // P3019: 分解リンク。本文が明示した条件・順序（CAUSES は P3014 から）。
  | 'CONDITION' | 'SEQUENCE';

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

export interface ActivatedNode {
  node: KnowledgeNode;
  depth: number;
}

export interface ActivationResult {
  seeds: KnowledgeNode[];
  activated: ActivatedNode[];
  edges: KnowledgeEdge[];
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
  if (tv && typeof tv.verifiedBy === 'string' && isTrustedVerifierName(tv.verifiedBy)) return 'CLAUDE_VERIFIED';
  if (item.verificationStatus === 'VERIFIED' || item.lifecycleStatus === 'VERIFIED') return 'SELF_GATED';
  return 'UNVERIFIED';
}

const VERIFIER_MUSE_ID = 'verifier:Muse';

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
  const pendingClaimEdges: Array<{ from: string; to: string }> = [];
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
      if (tv && typeof tv.verifiedBy === 'string' && isTrustedVerifierName(tv.verifiedBy)) {
        addNode(p, { id: VERIFIER_MUSE_ID, kind: 'VERIFIER', label: 'Muse（教師検証）', verification: 'CLAUDE_VERIFIED' });
        addEdge(p, {
          from: node.id, to: VERIFIER_MUSE_ID, kind: 'VERIFIED_BY', verification: 'CLAUDE_VERIFIED',
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
    // 知識部品の根拠 Claim への由来（実在する Claim ノードだけに張る。
    // Claim 射影はこの後に走るので、端点の有無は後段で確認する）。
    const claimIds = Array.isArray(item.claimIds) ? item.claimIds : [];
    for (const cid of claimIds) {
      if (typeof cid === 'string' && cid) {
        pendingClaimEdges.push({ from: `component:${componentId}`, to: `claim:${cid}` });
      }
    }
  }

  // P3019: 分解台帳の射影。取り込み時に割り出された原子文を STATEMENT
  // ノードとして親（レッスン／辞書の語）から DERIVED_FROM でぶら下げ、
  // 本文が明示した関係（因果・条件・順序）を文どうしの辺にする。
  // 文の検証状態は親から引き継ぐ：教師スタンプつきレッスンの文は
  // CLAUDE_VERIFIED（抽出は機械的で、主張しているのは検証済みの
  // 本文自身）。診断連鎖の文が UNVERIFIED のままなのは、あちらが
  // 彼女自身の一般化だからで、扱いの違いは意図的。
  // Claim 射影より前に置く：同一文が診断連鎖にも現れた場合、
  // addNode の先勝ちでレッスン側（検証済み）の射影を残すため。
  try {
    for (const rec of contentDecompositionService.allRecords()) {
      const verification = rec.verification as KnowledgeVerification;
      let parentNodeId = '';
      if (rec.parentKind === 'TEACHER_LESSON') {
        const lessonNode = lessonByComponentId.get(rec.parentComponentId);
        if (!lessonNode) continue;
        parentNodeId = lessonNode.node.id;
      } else if (rec.parentKind === 'DICTIONARY') {
        parentNodeId = `term:${rec.parentId}`;
        addNode(p, {
          id: parentNodeId, kind: 'CONCEPT', label: rec.parentTitle,
          verification: 'UNVERIFIED',
          payloadRef: { store: 'contentDecomposition', key: rec.recordId },
        });
        if (rec.sourceRef) {
          const sourceId = `source:${rec.sourceRef}`;
          addNode(p, {
            id: sourceId, kind: 'CONCEPT', label: rec.sourceRef,
            verification: 'STRUCTURAL',
            payloadRef: { store: 'contentDecomposition', key: rec.recordId },
          });
          addEdge(p, { from: parentNodeId, to: sourceId, kind: 'DERIVED_FROM', verification: 'STRUCTURAL' });
        }
      } else if (rec.parentComponentId && p.nodes.has(`component:${rec.parentComponentId}`)) {
        // 一般形（P3019）：レッスン以外の登録項目が部品に属する
        // 場合は、その部品ノードを親にする。親ノードが射影に
        // 無いレコードはぶら下げ先が無いので射影しない。
        parentNodeId = `component:${rec.parentComponentId}`;
      } else {
        continue;
      }
      const stmtIds: string[] = [];
      rec.statements.forEach((text) => {
        const id = statementId(text);
        stmtIds.push(id);
        addNode(p, {
          id, kind: 'STATEMENT', label: text, verification,
          payloadRef: { store: 'contentDecomposition', key: rec.recordId },
        });
        addEdge(p, { from: id, to: parentNodeId, kind: 'DERIVED_FROM', verification: 'STRUCTURAL' });
      });
      for (const link of rec.links) {
        const from = stmtIds[link.fromIndex];
        const to = stmtIds[link.toIndex];
        if (!from || !to || from === to) continue;
        addEdge(p, {
          from, to, kind: link.kind, verification,
          evidence: link.marker,
        });
      }
    }
  } catch { /* 分解台帳が読めなくても他の射影は成立させる */ }

  // P3013: Claim 台帳の射影。彼女の事実のストックはここが正本で、
  // 調査・会話出力など既存の生産経路がここへ書くものは、射影によって
  // 自動的にグラフの知識になる（新しい書き込み経路は作らない）。
  // 検証状態の対応: SUPPORTED / DEVICE_VERIFIED は彼女の検証ゲートを
  // 通ったものとして SELF_GATED、それ以外は UNVERIFIED。
  // CONTEXT_ONLY（創作の文脈だけの文）と FICTION 世界の Claim は知識
  // として扱わないので射影しない。
  let claims: Array<Record<string, unknown>> = [];
  try { claims = claimDatabaseService.getAllClaims() as Array<Record<string, unknown>>; } catch { claims = []; }
  const claimNodeIds = new Set<string>();
  for (const claim of claims) {
    const claimId = typeof claim.claim_id === 'string' ? claim.claim_id : '';
    const statement = typeof claim.statement === 'string' ? claim.statement : '';
    if (!claimId || !statement) continue;
    if (claim.status === 'CONTEXT_ONLY' || claim.world === 'FICTION') continue;
    const nodeId = `claim:${claimId}`;
    claimNodeIds.add(nodeId);
    addNode(p, {
      id: nodeId,
      kind: 'CLAIM',
      label: statement,
      verification: (claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED') ? 'SELF_GATED' : 'UNVERIFIED',
      payloadRef: { store: 'claimDb', key: claimId },
    });
    // 出典（origin_source_id）は由来の事実として射影する。同じ出典を
    // 持つ Claim 同士は、このノードを介して「同じ出典の関連知識」
    // としてたどれる（意味の近さで勝手に結ぶことはしない）。
    const origin = typeof claim.origin_source_id === 'string' ? claim.origin_source_id : '';
    if (origin) {
      const sourceId = `source:${origin}`;
      addNode(p, { id: sourceId, kind: 'CONCEPT', label: origin, verification: 'STRUCTURAL' });
      addEdge(p, { from: nodeId, to: sourceId, kind: 'DERIVED_FROM', verification: 'STRUCTURAL' });
    }
  }
  for (const e of pendingClaimEdges) {
    if (claimNodeIds.has(e.to)) {
      addEdge(p, { from: e.from, to: e.to, kind: 'DERIVED_FROM', verification: 'STRUCTURAL' });
    }
  }

  // P3013: 世界モデルの射影。実体＝ENTITY ノード、型つき関係＝そのまま
  // エッジ。仮の関係（provisional、未検証 Claim 由来）は UNVERIFIED、
  // 確定した関係は彼女の検証を経たものとして SELF_GATED。関係の由来
  // Claim は evidence に残す。
  try {
    for (const entity of worldModelGraphService.entities()) {
      if (!entity || typeof entity.name !== 'string' || !entity.name) continue;
      addNode(p, {
        id: `entity:${entity.name}`, kind: 'ENTITY', label: entity.name,
        verification: 'STRUCTURAL', payloadRef: { store: 'worldModel', key: entity.name },
      });
    }
    for (const rel of worldModelGraphService.relations()) {
      if (!rel || typeof rel.from !== 'string' || typeof rel.to !== 'string') continue;
      const fromId = `entity:${rel.from}`;
      const toId = `entity:${rel.to}`;
      if (!p.nodes.has(fromId)) addNode(p, { id: fromId, kind: 'ENTITY', label: rel.from, verification: 'STRUCTURAL' });
      if (!p.nodes.has(toId)) addNode(p, { id: toId, kind: 'ENTITY', label: rel.to, verification: 'STRUCTURAL' });
      addEdge(p, {
        from: fromId, to: toId, kind: rel.type as KnowledgeEdgeKind,
        verification: rel.provisional ? 'UNVERIFIED' : 'SELF_GATED',
        evidence: (rel.sourceClaimIds || []).length ? `claims:${(rel.sourceClaimIds || []).join(',')}` : undefined,
      });
    }
  } catch { /* 世界モデルが読めなくても他の射影は成立させる */ }

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
  // P3013: Claim 台帳と世界モデルも射影対象になったので、その変化も
  // 指紋に含める（件数＋末尾 ID の軽い指紋）。
  let knowledgeFingerprint = '';
  try {
    const claims = claimDatabaseService.getAllClaims() as Array<Record<string, unknown>>;
    const lastClaim = claims[claims.length - 1];
    const rels = worldModelGraphService.relations();
    knowledgeFingerprint = `c${claims.length}:${lastClaim ? String(lastClaim.claim_id || '') : ''}:r${rels.length}`;
  } catch { knowledgeFingerprint = 'err'; }
  // P3019: 分解台帳の変化も指紋に含める。
  let decompositionFingerprint = '';
  try { decompositionFingerprint = contentDecompositionService.fingerprint(); } catch { decompositionFingerprint = 'err'; }
  const fullFingerprint = `${attemptsFingerprint}|${knowledgeFingerprint}|${decompositionFingerprint}`;
  if (learnedCache && learnedCache.itemsRef === (items as unknown)
    && learnedCache.attemptsFingerprint === fullFingerprint) {
    return learnedCache;
  }
  const built = buildLearnedProjection();
  learnedCache = {
    itemsRef: items as unknown,
    attemptsFingerprint: fullFingerprint,
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
      // CONCEPT 端点だけここで作る。ファイル／シンボルの端点は各
      // エントリの処理で正しい種別のノードが入るので、処理順の
      // 都合で CONCEPT として先に作ってしまうと種別が固定されて
      // しまう（addNode は先勝ち）。
      if (from.startsWith('concept:') && !p.nodes.has(from)) {
        addNode(p, { id: from, kind: 'CONCEPT', label: rel.from, verification: 'STRUCTURAL' });
      }
      if (to.startsWith('concept:') && !p.nodes.has(to)) {
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
  // 並びはグラフ側で付け直す: パッケージ主題そのもののキー（例:
  // 主題「EFR…」に対するキー「EFR」）は、そのパッケージの全レッスンに
  // 共通で判別力がない。想起の素点では主題キーが長い分だけ「○○とは
  // 何か」の概要レッスンが手順の質問でも勝ってしまう（EFR-L01 が
  // 脱出の質問で L08 に勝った実測）。主題キーを除いた判別キーの
  // 一致数で並べ替え、同数は想起の順序に従う。
  findLessonNodesFor(text: string): GroundedLessonNode[] {
    const { lessonByComponentId } = learnedProjection();
    const ranked = teacherLessonRecallService.findRanked(text);
    const grounded: GroundedLessonNode[] = [];
    for (const view of ranked) {
      const g = lessonByComponentId.get(view.componentId);
      if (g) grounded.push(g);
    }
    const scored = grounded.map((g, idx) => {
      const hits = titleKeys(g.title)
        .filter((key) => key !== g.subject && !(g.subject && g.subject.includes(key)))
        .filter((key) => text.includes(key)).length;
      return { g, idx, hits };
    });
    scored.sort((a, b) => b.hits - a.hits || a.idx - b.idx);
    return scored.map((s) => s.g);
  },

  // P3019: レッスンの分解文（原子文）を返す。消費側が「レッスンの
  // 中の1つの事実だけを聞かれた」場合に、レッスン全体ではなく
  // その文だけを根拠にできるようにするための読み口。分解されて
  // いないレッスンでは undefined。
  decomposedStatementsFor(componentId: string): {
    recordId: string;
    statements: Array<{ nodeId: string; text: string }>;
    links: Array<{ fromNodeId: string; toNodeId: string; kind: KnowledgeEdgeKind; marker: string }>;
  } | undefined {
    const rec = contentDecompositionService.recordForComponent(componentId);
    if (!rec || !rec.statements.length) return undefined;
    const statements = rec.statements.map((text) => ({ nodeId: statementId(text), text }));
    const links = rec.links.flatMap((link) => {
      const from = statements[link.fromIndex];
      const to = statements[link.toIndex];
      return from && to ? [{ fromNodeId: from.nodeId, toNodeId: to.nodeId, kind: link.kind as KnowledgeEdgeKind, marker: link.marker }] : [];
    });
    return { recordId: rec.recordId, statements, links };
  },

  // P3019: 質問がレッスン内の「1つの事実だけ」を狙っているかを
  // 判定する。文ごとに、その文にだけ現れる判別キー（標題キー抽出
  // と同じ規則で、他の文に出ないもの）を取り、質問に含まれる
  // 判別キーの長さ合計で競わせる。最良の文が単独で、2位に差を
  // つけて、最低限の強さ（3）を超えたときだけ「その文が答え」。
  // それ以外は決定的でない＝レッスン全体で答える側に倒す。
  // 数値つきのキー（「3秒間静止」）は、数値を外した核（「静止」）
  // でも照合する：数を聞く質問は、その数自体が未知であることが
  // 多い（「何秒間静止すれば」）。核は元の文の中でのみ判別キーに
  // なる（他の文に出る核は落とす）。
  findDecisiveStatement(
    text: string,
    componentId: string,
  ): { nodeId: string; text: string } | undefined {
    const decomposed = this.decomposedStatementsFor(componentId);
    if (!decomposed || decomposed.statements.length < 2) return undefined;
    const expandKeys = (keys: string[]): string[] => {
      const out = new Set<string>();
      for (const key of keys) {
        out.add(key);
        // 先頭の数値＋単位を外した核（「3秒間静止」→「静止」ではなく
        // 「秒間静止」になる場合もあるので、以下の派生と併用する）。
        const core = key.replace(/^[0-9０-９]+(?:秒|分|時間|日|年|月|回|個|つ|人|本|枚|円|％|%)?/u, '');
        if (core.length >= 2 && core !== key) out.add(core);
        // 数値を全部外した形（「中で3秒間静止」→「中で秒間静止」）：
        // 「何秒間静止すれば」のように数を伏せて聞く形に当てる。
        const noDigits = key.replace(/[0-9０-９]+/gu, '');
        if (noDigits.length >= 2 && noDigits !== key) out.add(noDigits);
        // 最後の数値の後ろの部分（「中で3秒間静止」→「静止」）：
        // 内容語そのもので聞く形に当てる。
        const tail = key.replace(/^.*[0-9０-９]+(?:秒|分|時間|日|年|月|回|個|つ|人|本|枚|円|％|%)?/u, '');
        if (tail.length >= 2 && tail !== key) out.add(tail);
      }
      return [...out];
    };
    const keySets = decomposed.statements.map((s) => expandKeys(titleKeys(s.text).filter((k) => k.length >= 2)));
    const distinctive = keySets.map((keys, i) =>
      keys.filter((key) => !decomposed.statements.some((other, j) => j !== i && other.text.includes(key))));
    const scores = distinctive.map((keys) =>
      keys.filter((key) => text.includes(key)).reduce((sum, key) => sum + key.length, 0));
    let best = -1;
    let bestScore = 0;
    let secondScore = 0;
    scores.forEach((score, i) => {
      if (score > bestScore) { secondScore = bestScore; bestScore = score; best = i; }
      else if (score > secondScore) { secondScore = score; }
    });
    // 閾値は4：話題語1つ（「レイド」=3）だけでは決定的にしない。
    // 内容語の組（「ゾーン」+「静止」等）で初めて1事実とみなす。
    if (best < 0 || bestScore < 4 || bestScore <= secondScore) return undefined;
    return decomposed.statements[best];
  },

  // P3023: 語についてのレッスン（標題がその語を立てる教材）から、
  // 質問に決定的な分解文を引く。未知語の会話経路が「彼女が既に
  // 持っている語のレッスン」を引くための読み口（P3041 プローブの
  // 消費者配線）。照合の根拠は標題への語の含有だけにする——本文に
  // 語が出るだけのレッスンは「その語についてのレッスン」ではない。
  // 文の選択は質問の狙いに合わせる: 目的の質問は「ために／ための
  // ／目的」を明示する文、1つの事実を狙う質問は
  // findDecisiveStatement、それ以外（意味・定義の質問）は定義の
  // 形をした文（「X」とは…のこと／Xは…のこと。主の定義に別の
  // 義を1つまで添える）。どれにも当たらなければ undefined
  // （持っていない側＝正直な未知の返しに倒す）。
  findTermLessonStatements(
    term: string,
    questionText: string,
  ): { lesson: GroundedLessonNode; statements: Array<{ nodeId: string; text: string }> } | undefined {
    const raw = String(term || '').trim();
    if (!raw) return undefined;
    const variants = [...new Set([
      raw,
      raw.replace(/(?:し|する|ます|です)$/u, ''),
    ])].filter((v) => v.length >= 2);
    if (!variants.length) return undefined;
    const { lessonByComponentId } = learnedProjection();
    const candidates: GroundedLessonNode[] = [];
    for (const g of lessonByComponentId.values()) {
      if (variants.some((v) => g.title.includes(v))) candidates.push(g);
    }
    if (!candidates.length) return undefined;
    // 標題の中で語が先に立つレッスン（「棚卸の意味」型）を優先し、
    // 同点は標題の短い方（語に特化している方）を取る。
    const headScore = (g: GroundedLessonNode): number => {
      let best = Number.POSITIVE_INFINITY;
      for (const v of variants) {
        const idx = g.title.indexOf(v);
        if (idx >= 0) best = Math.min(best, idx);
      }
      return best;
    };
    candidates.sort((a, b) => headScore(a) - headScore(b) || a.title.length - b.title.length);
    const isDefinitional = (text: string): boolean => {
      for (const v of variants) {
        if (text.includes(`「${v}」とは`) || text.includes(`${v}とは`)) return true;
        const idx = text.indexOf(`${v}は`);
        if (idx >= 0 && idx <= 12 && /(?:のこと|である|ことだ)/.test(text)) return true;
      }
      return false;
    };
    for (const lesson of candidates) {
      const decomposed = this.decomposedStatementsFor(lesson.componentId);
      if (!decomposed || !decomposed.statements.length) continue;
      const stmts = decomposed.statements;
      // 目的の質問: 目的を明示する文が答えの核。
      if (/(?:何のため|ためには|目的|どうして|なぜ|理由)/.test(questionText)) {
        const purpose = stmts.filter((s) => /(?:ために|ための|目的)/.test(s.text)).slice(0, 2);
        if (purpose.length) return { lesson, statements: purpose };
      }
      // 1つの事実を狙う質問は既存の決定的文の判定に委ねる。
      const decisive = this.findDecisiveStatement(questionText, lesson.componentId);
      if (decisive) return { lesson, statements: [decisive] };
      // 意味・定義の質問: 定義の形をした文。
      const definitional = stmts.filter((s) => isDefinitional(s.text)).slice(0, 2);
      if (definitional.length) return { lesson, statements: definitional };
    }
    return undefined;
  },

  // ノードの「中身」を返す（消費側が答えを組み立てるための素材。
  // 文の生成そのものは消費側＝会話の仕組みの仕事で、グラフは
  // 何を知っていて何とつながっているかだけを渡す）。
  contentFor(nodeId: string): { text: string; verification: KnowledgeVerification } | undefined {
    const { projection, lessonByComponentId } = learnedProjection();
    const node = projection.nodes.get(nodeId);
    if (!node) return undefined;
    if (node.kind === 'LESSON' && node.componentId) {
      const g = lessonByComponentId.get(node.componentId);
      if (g) return { text: g.rule, verification: node.verification };
    }
    // CLAIM はラベルが主張文そのもの。COMPONENT は目的文、ENTITY /
    // STATEMENT は名前・文がラベルに入っている。
    return { text: node.label, verification: node.verification };
  },

  // P3013: 一般想起のための活性化。入力文で言及された話題・実体を
  // 種ノードとして起こし、知識のエッジ（因果・説明・由来・根拠・
  // 世界モデルの関係）を最大 maxDepth 段までたどって、つながった
  // 知識ごと返す。コード射影は対象外（重さと性質が違うため）。
  // 種の取り方: レッスンは findLessonNodesFor の照合、実体は名前の
  // 出現、Claim は主張文の内容キーの一致（2件以上、または4文字以上
  // のキー1件）。文（STATEMENT）は断片的なので直接の種にはしない。
  activateFor(text: string, maxDepth = 2): ActivationResult {
    const { projection } = learnedProjection();
    const seeds: KnowledgeNode[] = [];
    const seenSeed = new Set<string>();
    const push = (n: KnowledgeNode | undefined) => {
      if (n && !seenSeed.has(n.id)) { seenSeed.add(n.id); seeds.push(n); }
    };
    for (const g of this.findLessonNodesFor(text)) push(g.node);
    for (const node of projection.nodes.values()) {
      if (node.kind === 'ENTITY') {
        if (node.label.length >= 2 && text.includes(node.label)) push(node);
      } else if (node.kind === 'CLAIM') {
        const hits = titleKeys(node.label).filter((k) => k.length >= 2 && text.includes(k));
        if (hits.length >= 2 || hits.some((k) => k.length >= 4)) push(node);
      }
    }
    const WALK_KINDS = new Set<KnowledgeEdgeKind>([
      'CAUSES', 'EXPLAINS', 'DERIVED_FROM', 'VERIFIED_BY', 'SUPPORTS',
      'IS_A', 'PART_OF', 'ENABLES', 'USED_FOR',
      'CONDITION', 'SEQUENCE',
    ]);
    const depthOf = new Map<string, number>();
    for (const s of seeds) depthOf.set(s.id, 0);
    let frontier = seeds.map((s) => s.id);
    for (let d = 1; d <= maxDepth && frontier.length > 0; d += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        const incident = [...(projection.out.get(id) || []), ...(projection.into.get(id) || [])];
        for (const e of incident) {
          if (!WALK_KINDS.has(e.kind)) continue;
          const other = e.from === id ? e.to : e.from;
          if (!depthOf.has(other)) { depthOf.set(other, d); next.push(other); }
        }
      }
      frontier = next;
    }
    const activated: ActivatedNode[] = [];
    for (const [id, depth] of depthOf) {
      const node = projection.nodes.get(id);
      if (node) activated.push({ node, depth });
    }
    activated.sort((a, b) => a.depth - b.depth);
    const idSet = new Set(depthOf.keys());
    const edges = projection.edges.filter((e) => idSet.has(e.from) && idSet.has(e.to) && WALK_KINDS.has(e.kind));
    return { seeds, activated, edges };
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

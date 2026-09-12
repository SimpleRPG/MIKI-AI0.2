/**
 * 設計思想 第31章 31.6: コード地図ビュー
 *
 * CodeUnderstandingIRをLLMへ再投入するのではなく、ファイル/プロシージャ/変数/呼出/読書き/
 * 副作用/外部依存を小さなグラフへ変換する。確定情報と静的推定を分離する。
 */
import { CodeUnderstandingIR } from '../types';

export type CodeMapNodeKind = 'MODULE' | 'PROCEDURE' | 'VARIABLE' | 'DATA' | 'DEPENDENCY' | 'SIDE_EFFECT';
export type CodeMapEdgeKind = 'CONTAINS' | 'CALLS' | 'READS' | 'WRITES' | 'DEPENDS_ON' | 'CAUSES_SIDE_EFFECT';

export interface CodeMapNode { id: string; kind: CodeMapNodeKind; label: string; certainty: 'STATIC_FACT' | 'STATIC_INFERENCE'; }
export interface CodeMapEdge { from: string; to: string; kind: CodeMapEdgeKind; certainty: 'STATIC_FACT' | 'STATIC_INFERENCE'; }
export interface CodeMap {
  id: string; sourceLanguage: string; nodes: CodeMapNode[]; edges: CodeMapEdge[];
  focusedNodeIds: string[]; createdAt: number;
}

class CodeMapService {
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

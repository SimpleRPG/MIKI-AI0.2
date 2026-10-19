import { storageService } from '../../../services/storageService';

/** Editable relationship overlay for the capability ledger. It never mutates registry/evidence records. */
export interface LedgerGraphNode {
  id: string;
  label: string;
  detail: string;
  createdAt: number;
  updatedAt: number;
}
export interface LedgerGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  createdAt: number;
  updatedAt: number;
}
export interface LedgerGraphSnapshot {
  version: 1;
  updatedAt: number;
  nodes: LedgerGraphNode[];
  edges: LedgerGraphEdge[];
}
const GRAPH_KEY = 'miki_capability_ledger_graph_v1';
const MAX_NODES = 2000;
const MAX_EDGES = 8000;
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

class CapabilityLedgerGraphService {
  private cache: LedgerGraphSnapshot | null = null;

  getSnapshot(): LedgerGraphSnapshot {
    if (this.cache) return JSON.parse(JSON.stringify(this.cache));
    try {
      const raw = storageService.getItem(GRAPH_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        const nodeIds = new Set<string>();
        const nodes = parsed.nodes.filter((n: any) => n && typeof n.id === 'string' && typeof n.label === 'string' && !nodeIds.has(n.id) && nodeIds.add(n.id)).slice(0, MAX_NODES) as LedgerGraphNode[];
        const validIds = new Set(nodes.map(n => n.id));
        const edgeIds = new Set<string>();
        const edges = parsed.edges.filter((e: any) => e && typeof e.id === 'string' && !edgeIds.has(e.id) && edgeIds.add(e.id) && validIds.has(e.from) && validIds.has(e.to)).slice(0, MAX_EDGES) as LedgerGraphEdge[];
        this.cache = { version: 1, updatedAt: Number(parsed.updatedAt) || Date.now(), nodes, edges };
      } else {
        this.cache = { version: 1, updatedAt: Date.now(), nodes: [], edges: [] };
      }
    } catch {
      this.cache = { version: 1, updatedAt: Date.now(), nodes: [], edges: [] };
    }
    return JSON.parse(JSON.stringify(this.cache));
  }

  private commit(next: LedgerGraphSnapshot): LedgerGraphSnapshot {
    next.updatedAt = Date.now();
    // Keep cache unchanged if persistence throws; callers must not report a saved edit.
    storageService.setItem(GRAPH_KEY, JSON.stringify(next));
    this.cache = next;
    return this.getSnapshot();
  }

  addNode(label: string, detail = ''): LedgerGraphNode {
    const cleanLabel = clean(label, 160);
    if (!cleanLabel) throw new Error('GRAPH_NODE_LABEL_REQUIRED');
    const g = this.getSnapshot();
    if (g.nodes.length >= MAX_NODES) throw new Error('GRAPH_NODE_LIMIT_REACHED');
    const now = Date.now();
    const node = { id: makeId('LN'), label: cleanLabel, detail: clean(detail, 2000), createdAt: now, updatedAt: now };
    g.nodes.push(node); this.commit(g); return node;
  }

  updateNode(id: string, patch: { label?: string; detail?: string }): LedgerGraphNode {
    const g = this.getSnapshot(); const node = g.nodes.find(n => n.id === id);
    if (!node) throw new Error('GRAPH_NODE_NOT_FOUND');
    if (patch.label !== undefined) { const label = clean(patch.label, 160); if (!label) throw new Error('GRAPH_NODE_LABEL_REQUIRED'); node.label = label; }
    if (patch.detail !== undefined) node.detail = clean(patch.detail, 2000);
    node.updatedAt = Date.now(); this.commit(g); return node;
  }

  deleteNode(id: string): { deletedNodeId: string; removedEdges: number } {
    const g = this.getSnapshot(); if (!g.nodes.some(n => n.id === id)) throw new Error('GRAPH_NODE_NOT_FOUND');
    const before = g.edges.length; g.nodes = g.nodes.filter(n => n.id !== id); g.edges = g.edges.filter(e => e.from !== id && e.to !== id);
    this.commit(g); return { deletedNodeId: id, removedEdges: before - g.edges.length };
  }

  addEdge(from: string, to: string, label: string): LedgerGraphEdge {
    const g = this.getSnapshot();
    if (from === to) throw new Error('GRAPH_SELF_EDGE_NOT_ALLOWED');
    if (!g.nodes.some(n => n.id === from) || !g.nodes.some(n => n.id === to)) throw new Error('GRAPH_EDGE_ENDPOINT_NOT_FOUND');
    if (g.edges.length >= MAX_EDGES) throw new Error('GRAPH_EDGE_LIMIT_REACHED');
    const normalizedLabel = clean(label, 120) || '関連';
    const duplicate = g.edges.find(e => e.from === from && e.to === to && e.label === normalizedLabel);
    if (duplicate) return duplicate;
    const now = Date.now(); const edge = { id: makeId('LE'), from, to, label: normalizedLabel, createdAt: now, updatedAt: now };
    g.edges.push(edge); this.commit(g); return edge;
  }

  updateEdge(id: string, patch: { from?: string; to?: string; label?: string }): LedgerGraphEdge {
    const g = this.getSnapshot(); const edge = g.edges.find(e => e.id === id);
    if (!edge) throw new Error('GRAPH_EDGE_NOT_FOUND');
    const from = patch.from ?? edge.from; const to = patch.to ?? edge.to;
    if (from === to) throw new Error('GRAPH_SELF_EDGE_NOT_ALLOWED');
    const ids = new Set(g.nodes.map(n => n.id)); if (!ids.has(from) || !ids.has(to)) throw new Error('GRAPH_EDGE_ENDPOINT_NOT_FOUND');
    edge.from = from; edge.to = to; if (patch.label !== undefined) edge.label = clean(patch.label, 120) || '関連';
    edge.updatedAt = Date.now(); this.commit(g); return edge;
  }

  deleteEdge(id: string): void {
    const g = this.getSnapshot(); const next = g.edges.filter(e => e.id !== id);
    if (next.length === g.edges.length) throw new Error('GRAPH_EDGE_NOT_FOUND');
    g.edges = next; this.commit(g);
  }

  executeAgentOperation(input: { action: string; id?: string; label?: string; detail?: string; from?: string; to?: string }): unknown {
    const action = clean(input.action, 32).toLowerCase();
    switch (action) {
      case 'list': return this.getSnapshot();
      case 'add_node': return this.addNode(input.label || '', input.detail || '');
      case 'update_node': return this.updateNode(input.id || '', { label: input.label, detail: input.detail });
      case 'delete_node': return this.deleteNode(input.id || '');
      case 'add_edge': return this.addEdge(input.from || '', input.to || '', input.label || '関連');
      case 'update_edge': return this.updateEdge(input.id || '', { from: input.from, to: input.to, label: input.label });
      case 'delete_edge': this.deleteEdge(input.id || ''); return { deletedEdgeId: input.id };
      default: throw new Error('GRAPH_ACTION_UNSUPPORTED');
    }
  }
}
export const capabilityLedgerGraphService = new CapabilityLedgerGraphService();

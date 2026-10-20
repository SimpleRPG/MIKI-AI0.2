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
export type LedgerGraphStorageStatus = 'READY' | 'RECOVERED_QUARANTINED' | 'WRITE_BLOCKED';
export interface LedgerGraphStorageState {
  status: LedgerGraphStorageStatus;
  reason?: string;
}

const GRAPH_KEY = 'miki_capability_ledger_graph_v1';
const MAX_NODES = 2000;
const MAX_EDGES = 8000;
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

class CapabilityLedgerGraphService {
  private cache: LedgerGraphSnapshot | null = null;
  private blocked = false;
  private storageStatus: LedgerGraphStorageStatus = 'READY';
  private storageReason?: string;

  getSnapshot(): LedgerGraphSnapshot {
    if (this.cache) return JSON.parse(JSON.stringify(this.cache)) as LedgerGraphSnapshot;

    let raw: string | null;
    try {
      raw = storageService.getItem(GRAPH_KEY);
    } catch (error) {
      this.blocked = true;
      this.storageStatus = 'WRITE_BLOCKED';
      this.storageReason = `GRAPH_STORE_READ_FAILED: ${String(error instanceof Error ? error.message : error).slice(0, 500)}`;
      this.cache = this.emptySnapshot();
      return JSON.parse(JSON.stringify(this.cache)) as LedgerGraphSnapshot;
    }

    if (raw === null) {
      this.cache = this.emptySnapshot();
      return JSON.parse(JSON.stringify(this.cache)) as LedgerGraphSnapshot;
    }

    try {
      this.cache = this.parseSnapshot(raw);
      this.storageStatus = 'READY';
      this.storageReason = undefined;
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : error).slice(0, 500);
      const quarantined = this.quarantine(raw, reason);
      this.blocked = !quarantined;
      this.storageStatus = quarantined ? 'RECOVERED_QUARANTINED' : 'WRITE_BLOCKED';
      this.storageReason = quarantined
        ? `GRAPH_SNAPSHOT_QUARANTINED: ${reason}`
        : `GRAPH_STORE_QUARANTINE_FAILED: ${reason}`;
      // Keep a read-only empty view for callers. Mutations are allowed only if the exact raw
      // snapshot was first preserved and verified in quarantine.
      this.cache = this.emptySnapshot();
    }

    return JSON.parse(JSON.stringify(this.cache)) as LedgerGraphSnapshot;
  }

  getStorageState(): LedgerGraphStorageState {
    this.getSnapshot();
    return {
      status: this.storageStatus,
      ...(this.storageReason ? { reason: this.storageReason } : {}),
    };
  }

  private emptySnapshot(): LedgerGraphSnapshot {
    return { version: 1, updatedAt: Date.now(), nodes: [], edges: [] };
  }

  private parseSnapshot(raw: string): LedgerGraphSnapshot {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('GRAPH_SNAPSHOT_INVALID_ROOT');
    }
    const snapshot = value as Record<string, unknown>;
    if (
      snapshot.version !== 1 ||
      typeof snapshot.updatedAt !== 'number' || !Number.isFinite(snapshot.updatedAt) || snapshot.updatedAt < 0 ||
      !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)
    ) {
      throw new Error('GRAPH_SNAPSHOT_INVALID_SHAPE');
    }
    if (snapshot.nodes.length > MAX_NODES) throw new Error('GRAPH_NODE_LIMIT_EXCEEDED_IN_SNAPSHOT');
    if (snapshot.edges.length > MAX_EDGES) throw new Error('GRAPH_EDGE_LIMIT_EXCEEDED_IN_SNAPSHOT');

    const nodes: LedgerGraphNode[] = [];
    const nodeIds = new Set<string>();
    for (const candidate of snapshot.nodes) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('GRAPH_SNAPSHOT_INVALID_NODE');
      }
      const node = candidate as Record<string, unknown>;
      if (
        typeof node.id !== 'string' || !node.id.trim() || node.id.length > 256 ||
        typeof node.label !== 'string' || !node.label.trim() || node.label.length > 160 ||
        typeof node.detail !== 'string' || node.detail.length > 2000 ||
        typeof node.createdAt !== 'number' || !Number.isFinite(node.createdAt) || node.createdAt < 0 ||
        typeof node.updatedAt !== 'number' || !Number.isFinite(node.updatedAt) || node.updatedAt < 0
      ) throw new Error('GRAPH_SNAPSHOT_INVALID_NODE_FIELDS');
      if (nodeIds.has(node.id)) throw new Error('GRAPH_SNAPSHOT_DUPLICATE_NODE_ID');
      nodeIds.add(node.id);
      nodes.push({
        id: node.id,
        label: node.label,
        detail: node.detail,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      });
    }

    const edges: LedgerGraphEdge[] = [];
    const edgeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    for (const candidate of snapshot.edges) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('GRAPH_SNAPSHOT_INVALID_EDGE');
      }
      const edge = candidate as Record<string, unknown>;
      if (
        typeof edge.id !== 'string' || !edge.id.trim() || edge.id.length > 256 ||
        typeof edge.from !== 'string' || !edge.from.trim() || edge.from.length > 256 ||
        typeof edge.to !== 'string' || !edge.to.trim() || edge.to.length > 256 ||
        typeof edge.label !== 'string' || !edge.label.trim() || edge.label.length > 120 ||
        typeof edge.createdAt !== 'number' || !Number.isFinite(edge.createdAt) || edge.createdAt < 0 ||
        typeof edge.updatedAt !== 'number' || !Number.isFinite(edge.updatedAt) || edge.updatedAt < 0
      ) throw new Error('GRAPH_SNAPSHOT_INVALID_EDGE_FIELDS');
      if (edgeIds.has(edge.id)) throw new Error('GRAPH_SNAPSHOT_DUPLICATE_EDGE_ID');
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error('GRAPH_SNAPSHOT_DANGLING_EDGE');
      if (edge.from === edge.to) throw new Error('GRAPH_SNAPSHOT_SELF_EDGE');
      const edgeKey = JSON.stringify([edge.from, edge.to, edge.label]);
      if (edgeKeys.has(edgeKey)) throw new Error('GRAPH_SNAPSHOT_DUPLICATE_EDGE');
      edgeIds.add(edge.id);
      edgeKeys.add(edgeKey);
      edges.push({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      });
    }

    return { version: 1, updatedAt: snapshot.updatedAt, nodes, edges };
  }

  private quarantine(raw: string, reason: string): boolean {
    const baseKey = `${GRAPH_KEY}_quarantine_v1`;
    const envelope = {
      version: 1,
      sourceKey: GRAPH_KEY,
      quarantinedAt: Date.now(),
      reason: reason.slice(0, 500),
      raw,
    };
    try {
      let destination = baseKey;
      const existingRaw = storageService.getItem(baseKey);
      if (existingRaw !== null) {
        try {
          const existing = JSON.parse(existingRaw) as Record<string, unknown>;
          if (existing.version === 1 && existing.sourceKey === GRAPH_KEY && existing.raw === raw) return true;
        } catch {
          // Never overwrite an unrecognized quarantine record; choose another key below.
        }
        let suffix = 0;
        do {
          destination = `${baseKey}_${Date.now()}_${suffix++}`;
          if (suffix > 1000) return false;
        } while (storageService.getItem(destination) !== null);
      }

      storageService.setItem(destination, JSON.stringify(envelope));
      const saved = storageService.getItem(destination);
      if (saved === null) return false;
      const verified = JSON.parse(saved) as Record<string, unknown>;
      return verified.version === 1 && verified.sourceKey === GRAPH_KEY && verified.raw === raw;
    } catch {
      return false;
    }
  }

  private commit(next: LedgerGraphSnapshot): LedgerGraphSnapshot {
    this.assertWritable();
    const candidate: LedgerGraphSnapshot = { version: 1, updatedAt: Date.now(), nodes: next.nodes, edges: next.edges };
    const persisted = this.parseSnapshot(JSON.stringify(candidate));
    const serialized = JSON.stringify(persisted);
    try {
      storageService.setItem(GRAPH_KEY, serialized);
      if (storageService.getItem(GRAPH_KEY) !== serialized) throw new Error('GRAPH_STORE_READBACK_MISMATCH');
    } catch (error) {
      this.blocked = true;
      this.storageStatus = 'WRITE_BLOCKED';
      this.storageReason = `GRAPH_STORE_WRITE_VERIFY_FAILED: ${String(error instanceof Error ? error.message : error).slice(0, 500)}`;
      throw new Error('GRAPH_STORE_WRITE_VERIFY_FAILED');
    }
    this.cache = JSON.parse(serialized) as LedgerGraphSnapshot;
    return JSON.parse(serialized) as LedgerGraphSnapshot;
  }

  private assertWritable(): void {
    if (this.blocked) throw new Error('GRAPH_STORE_WRITE_BLOCKED_QUARANTINE_FAILED');
  }

  addNode(label: string, detail = ''): LedgerGraphNode {
    this.assertWritable();
    const cleanLabel = clean(label, 160);
    if (!cleanLabel) throw new Error('GRAPH_NODE_LABEL_REQUIRED');
    const g = this.getSnapshot();
    if (g.nodes.length >= MAX_NODES) throw new Error('GRAPH_NODE_LIMIT_REACHED');
    const now = Date.now();
    const node = { id: makeId('LN'), label: cleanLabel, detail: clean(detail, 2000), createdAt: now, updatedAt: now };
    g.nodes.push(node); this.commit(g); return node;
  }

  updateNode(id: string, patch: { label?: string; detail?: string }): LedgerGraphNode {
    this.assertWritable();
    const g = this.getSnapshot(); const node = g.nodes.find(n => n.id === id);
    if (!node) throw new Error('GRAPH_NODE_NOT_FOUND');
    if (patch.label !== undefined) { const label = clean(patch.label, 160); if (!label) throw new Error('GRAPH_NODE_LABEL_REQUIRED'); node.label = label; }
    if (patch.detail !== undefined) node.detail = clean(patch.detail, 2000);
    node.updatedAt = Date.now(); this.commit(g); return node;
  }

  deleteNode(id: string): { deletedNodeId: string; removedEdges: number } {
    this.assertWritable();
    const g = this.getSnapshot(); if (!g.nodes.some(n => n.id === id)) throw new Error('GRAPH_NODE_NOT_FOUND');
    const before = g.edges.length; g.nodes = g.nodes.filter(n => n.id !== id); g.edges = g.edges.filter(e => e.from !== id && e.to !== id);
    this.commit(g); return { deletedNodeId: id, removedEdges: before - g.edges.length };
  }

  addEdge(from: string, to: string, label: string): LedgerGraphEdge {
    this.assertWritable();
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
    this.assertWritable();
    const g = this.getSnapshot(); const edge = g.edges.find(e => e.id === id);
    if (!edge) throw new Error('GRAPH_EDGE_NOT_FOUND');
    const from = patch.from ?? edge.from; const to = patch.to ?? edge.to;
    if (from === to) throw new Error('GRAPH_SELF_EDGE_NOT_ALLOWED');
    const ids = new Set(g.nodes.map(n => n.id)); if (!ids.has(from) || !ids.has(to)) throw new Error('GRAPH_EDGE_ENDPOINT_NOT_FOUND');
    const label = patch.label === undefined ? edge.label : clean(patch.label, 120) || '関連';
    if (g.edges.some(candidate => candidate.id !== id && candidate.from === from && candidate.to === to && candidate.label === label)) {
      throw new Error('GRAPH_DUPLICATE_EDGE_NOT_ALLOWED');
    }
    edge.from = from;
    edge.to = to;
    edge.label = label;
    edge.updatedAt = Date.now();
    this.commit(g);
    return edge;
  }

  deleteEdge(id: string): void {
    this.assertWritable();
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

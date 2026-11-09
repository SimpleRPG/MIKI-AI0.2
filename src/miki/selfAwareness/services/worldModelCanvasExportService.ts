import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { worldModelGraphService } from './worldModelGraphService';

/**
 * P538: 世界モデルの JSON Canvas 書き出し。
 *
 * 教材 TM6-07（JSON Canvas 仕様 1.0）の実装側。世界モデルの
 * 実体を text ノードに、関係をエッジ（label = 関係の種類）に
 * 写して .canvas の中身（JSON）を組み立て、自分のストレージに
 * 保存する。仮の関係は色 3（黄）で区別する。人が Obsidian 等で
 * 開ける形にしておくことで、内部形式に閉じない「目で確認でき
 * る世界モデル」になる。
 */

export interface WorldModelCanvasExport {
  exportedAt: number;
  nodes: number;
  edges: number;
  json: string;
}

const STORAGE_KEY = 'miki_world_model_canvas_v1';

class WorldModelCanvasExportService {
  /** 世界モデルを JSON Canvas 形式の JSON 文字列に写す（保存しない）。 */
  public buildCanvas(): { json: string; nodes: number; edges: number } {
    const entities = worldModelGraphService.entities();
    const relations = worldModelGraphService.relations();
    const idByName = new Map<string, string>();
    const nodes = entities.map((entity, index) => {
      const id = `e${index}`;
      idByName.set(entity.name, id);
      return {
        id,
        type: 'text',
        x: (index % 6) * 340,
        y: Math.floor(index / 6) * 180,
        width: 280,
        height: 100,
        text: entity.name,
      };
    });
    const edges: Array<Record<string, unknown>> = [];
    relations.forEach((relation, index) => {
      const fromNode = idByName.get(relation.from);
      const toNode = idByName.get(relation.to);
      if (!fromNode || !toNode) return;
      const edge: Record<string, unknown> = {
        id: `r${index}`,
        fromNode,
        toNode,
        label: relation.type,
      };
      if (relation.provisional) edge.color = '3';
      edges.push(edge);
    });
    return { json: JSON.stringify({ nodes, edges }, null, 2), nodes: nodes.length, edges: edges.length };
  }

  /** 書き出して保存し、件数を返す。 */
  public exportNow(): WorldModelCanvasExport {
    const built = this.buildCanvas();
    const record: WorldModelCanvasExport = { exportedAt: Date.now(), ...built };
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch { /* 保存は補助経路 */ }
    systemLogger.info('SELF_IMPROVEMENT', `📤 [世界モデル書き出し] 実体${built.nodes}・関係${built.edges} を JSON Canvas 形式で書き出しました`);
    return record;
  }

  public latestExport(): WorldModelCanvasExport | undefined {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.json === 'string') return parsed as WorldModelCanvasExport;
      }
    } catch { /* 壊れた記録は無いものとする */ }
    return undefined;
  }
}

export const worldModelCanvasExportService = new WorldModelCanvasExportService();

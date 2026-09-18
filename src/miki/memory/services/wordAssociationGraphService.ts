import { ClaimRecord } from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

const STORAGE_KEY = 'miki_word_association_graph_v1';

export interface AssociationEdge {
  from: string;
  to: string;
  weight: number;
}

export interface RelatednessEvaluation {
  score: number; // 0.0 - 1.0
  directOverlap: string[];
  graphAssociations: AssociationEdge[];
  reason: string;
  isSufficientlyRelated: boolean;
}

/**
 * 設計思想 第19章・第6章: 単語連想グラフ (Word Association Graph)
 * 
 * Claim同士、またはClaimと推論テンプレートの間で、意味的・概念的な連想度（距離）を計算。
 * 型の一致だけでなく「意味的に結合可能か」を合成前に判定する事前フィルタとして機能する。
 * LLMに依存せず、決定論的な連想ネットワークとキーワード共起スコアで算出する。
 */
export class WordAssociationGraphService {
  private static instance: WordAssociationGraphService;
  private adjacency: Map<string, Map<string, number>> = new Map();
  private isLoaded = false;

  private constructor() {
    this.load();
    if (this.adjacency.size === 0) {
      this.seedDefaultGraph();
    }
  }

  public static getInstance(): WordAssociationGraphService {
    if (!WordAssociationGraphService.instance) {
      WordAssociationGraphService.instance = new WordAssociationGraphService();
    }
    return WordAssociationGraphService.instance;
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.from && item.to && typeof item.weight === 'number') {
              this.addEdgeInternal(item.from, item.to, item.weight);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to load word association graph', e);
      this.adjacency.clear();
    }
  }

  private save(): void {
    try {
      const list: AssociationEdge[] = [];
      for (const [from, map] of this.adjacency) {
        for (const [to, weight] of map) {
          if (from < to) {
            list.push({ from, to, weight });
          }
        }
      }
      storageService.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to save word association graph', e);
    }
  }

  private seedDefaultGraph(): void {
    const defaultEdges: Array<[string, string, number]> = [
      // Excel / VBA / パフォーマンスクラスタ
      ['vba', 'excel', 0.95],
      ['vba', 'マクロ', 0.92],
      ['vba', '配列', 0.88],
      ['vba', 'セル', 0.88],
      ['vba', 'ループ', 0.82],
      ['excel', 'セル', 0.90],
      ['excel', 'シート', 0.88],
      ['セル', 'ループ', 0.85],
      ['セル', '配列', 0.82],
      ['セル', '一括代入', 0.80],
      ['配列', '一括代入', 0.95],
      ['配列', '高速化', 0.92],
      ['配列', 'パフォーマンス', 0.88],
      ['ループ', 'オーバーヘッド', 0.85],
      ['ループ', '速度低下', 0.88],
      ['オーバーヘッド', '速度低下', 0.90],
      ['速度低下', '高速化', 0.85], // パフォーマンス比較軸上の強い関連
      ['改善', '高速化', 0.85],
      ['対策', '原因', 0.82],
      ['対策', '解決', 0.85],

      // Android / Termux / Vulkan / クラッシュクラスタ
      ['termux', 'android', 0.95],
      ['termux', 'vulkan', 0.92],
      ['vulkan', 'device_lost', 0.95],
      ['vulkan', 'クラッシュ', 0.90],
      ['vulkan', 'gpu', 0.88],
      ['vulkan', 'レンダリング', 0.85],
      ['android', 'galaxy', 0.82],
      ['android', 'linux', 0.78],

      // 創作世界・SFクラスタ (現実世界と隔離)
      ['火星', '軍事基地', 0.95],
      ['火星', '宇宙', 0.90],
      ['軍事基地', '秘密', 0.90],
      ['秘密', '陰謀', 0.82],
      ['宇宙', 'エイリアン', 0.85],
    ];

    for (const [a, b, w] of defaultEdges) {
      this.addEdgeInternal(a, b, w);
    }
    this.save();
  }

  private addEdgeInternal(a: string, b: string, weight: number): void {
    const termA = a.toLowerCase().trim();
    const termB = b.toLowerCase().trim();
    if (!termA || !termB || termA === termB) return;

    if (!this.adjacency.has(termA)) this.adjacency.set(termA, new Map());
    if (!this.adjacency.has(termB)) this.adjacency.set(termB, new Map());

    this.adjacency.get(termA)!.set(termB, weight);
    this.adjacency.get(termB)!.set(termA, weight);
  }

  public addAssociation(termA: string, termB: string, weight: number): void {
    this.addEdgeInternal(termA, termB, Math.min(1.0, Math.max(0.0, weight)));
    this.save();
  }

  public getAssociationWeight(a: string, b: string): number {
    const termA = a.toLowerCase().trim();
    const termB = b.toLowerCase().trim();
    if (termA === termB) return 1.0;
    return this.adjacency.get(termA)?.get(termB) || 0.0;
  }

  /**
   * 単語・トークン抽出 (日本語・英語正規化)
   */
  public extractKeywords(source: ClaimRecord | string): string[] {
    let rawText = '';
    const extraTokens: string[] = [];

    if (typeof source === 'string') {
      rawText = source;
    } else {
      rawText = `${source.statement} ${source.origin_source_id || ''}`;
      if (source.scope) {
        if (source.scope.environment) extraTokens.push(source.scope.environment.toLowerCase());
        if (source.scope.runtime) extraTokens.push(source.scope.runtime.toLowerCase());
        if (source.scope.device) extraTokens.push(source.scope.device.toLowerCase());
        if (source.scope.backend) extraTokens.push(source.scope.backend.toLowerCase());
      }
    }

    const cleaned = rawText
      .toLowerCase()
      .replace(/[^\w\u3040-\u30ff\u3400-\u9fff\s]/g, ' ');

    const rawTokens = cleaned
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    // 代表的ドメインキーワードの検出
    const recognizedTerms = [
      'vba', 'excel', 'マクロ', '配列', 'セル', 'ループ', '一括代入',
      '高速化', '速度低下', 'オーバーヘッド', 'パフォーマンス',
      'termux', 'vulkan', 'android', 'galaxy', 'device_lost', 'クラッシュ',
      '火星', '軍事基地', '秘密', '宇宙',
    ];

    for (const term of recognizedTerms) {
      if (rawText.toLowerCase().includes(term) && !rawTokens.includes(term)) {
        rawTokens.push(term);
      }
    }

    return Array.from(new Set([...rawTokens, ...extraTokens]));
  }

  /**
   * 2つの主張間の意味的連想度（関連度）を計算
   * @param claimA 主張A
   * @param claimB 主張B
   * @param minThreshold 最低許容関連度 (デフォルト 0.40)
   */
  public calculateRelatedness(
    claimA: ClaimRecord | string,
    claimB: ClaimRecord | string,
    minThreshold = 0.40
  ): RelatednessEvaluation {
    const tokensA = this.extractKeywords(claimA);
    const tokensB = this.extractKeywords(claimB);

    // 1. 直接重複トークン (Jaccard / 共通単語)
    const setB = new Set(tokensB);
    const directOverlap = tokensA.filter((t) => setB.has(t));

    // 2. 連想グラフエッジ探索 (tokensAとtokensBのペア)
    const graphAssociations: AssociationEdge[] = [];
    let maxGraphWeight = 0;
    let sumGraphWeight = 0;

    for (const a of tokensA) {
      for (const b of tokensB) {
        if (a === b) continue;
        const w = this.getAssociationWeight(a, b);
        if (w > 0) {
          graphAssociations.push({ from: a, to: b, weight: w });
          if (w > maxGraphWeight) maxGraphWeight = w;
          sumGraphWeight += w;
        }
      }
    }

    // 重複スコア (1語あたり +0.35、2語で0.70)
    const overlapScore = Math.min(0.80, directOverlap.length * 0.35);

    // 連想グラフスコア (最大エッジ重み + 複合エッジボーナス)
    const associationScore = maxGraphWeight > 0
      ? maxGraphWeight * 0.6 + Math.min(0.3, (sumGraphWeight - maxGraphWeight) * 0.15)
      : 0;

    // 総合スコア (上限 1.0)
    const rawScore = Math.max(overlapScore, associationScore) + (overlapScore > 0 && associationScore > 0 ? 0.15 : 0);
    const score = Math.min(1.0, Math.round(rawScore * 100) / 100);

    const isSufficientlyRelated = score >= minThreshold;

    let reason = '';
    if (isSufficientlyRelated) {
      reason = `単語連想関連度十分 (スコア: ${score.toFixed(2)} >= ${minThreshold.toFixed(2)})。共通概念: [${directOverlap.join(', ') || '連想結合'}], 主要連想: [${graphAssociations.map(e => `${e.from}↔${e.to}(${e.weight})`).slice(0, 3).join(', ')}]`;
    } else {
      reason = `単語連想関連度不足 (スコア: ${score.toFixed(2)} < ${minThreshold.toFixed(2)})。共通概念なし・連想エッジ不在のため無関係と判定`;
    }

    return {
      score,
      directOverlap,
      graphAssociations,
      reason,
      isSufficientlyRelated,
    };
  }

  public getAllEdges(): AssociationEdge[] {
    const list: AssociationEdge[] = [];
    for (const [from, map] of this.adjacency) {
      for (const [to, weight] of map) {
        if (from < to) {
          list.push({ from, to, weight });
        }
      }
    }
    return list;
  }
}

export const wordAssociationGraphService = WordAssociationGraphService.getInstance();

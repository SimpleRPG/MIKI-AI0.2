import type { MemoryItem } from '../types';
import { storageService } from '../services/storageService';
import { experienceRouterService } from '../services/experienceRouterService';

/**
 * 多層ベクトル検索 & 知識グラフ依存関係検索エンジン
 *
 * 設計思想 4. RAG・外部記憶とプロンプト上限 (目次＋必要な候補のみの少数投入)
 * 設計思想 12. 検索・記憶の改善案 (知識グラフ、関係性、多層検索、前提依存)
 *
 * 端末内だけで高速かつミリ秒オーダーで動作する3層ハイブリッド検索:
 * 1. Tier 1: Lexical N-Gram (形態素バイグラム + 形態素トークン一致)
 * 2. Tier 2: Semantic Domain Vector (8次元ドメイン概念疎ベクトル + TF-IDF重み類似度)
 * 3. Tier 3: Metadata & Recency (重要度、承認状態、フィードバック、時間減衰)
 * 4. Graph Traversal: 知識グラフ依存関係トラバーサル (前提条件、親子、関連ノード連鎖)
 */

const STOPWORDS = new Set([
  'です', 'ます', 'こと', 'それ', 'これ', 'あれ', 'よう', 'ため', 'から', 'まで',
  'って', 'けど', 'でも', 'だよ', 'だね', 'かな', 'ねえ', 'ちゃん', 'さん',
  'the', 'and', 'for', 'with', 'this', 'that', 'ですね', 'でしょうか',
  'する', 'した', 'ある', 'ない', 'いる', '私', '僕', 'あなた',
]);

// 8次元セマンティックドメイン
export const SEMANTIC_DOMAINS = [
  'coding_dev',       // 0: コード、JavaScript, Canvas, HTML, VBA, バグ, エラー, 関数
  'persona_style',    // 1: 口調、タメ口、親友、キャラクター、挨拶、呼び名
  'user_profile',     // 2: ユーザー情報、名前、趣味、好み、端末環境
  'system_rules',     // 3: 制約、禁止事項、品質境界、安全ルール、手順
  'episodic_history', // 4: 過去の出来事、前回、失敗談、成功経験
  'relationship',     // 5: 親密度、約束、感情、信頼、思い出
  'game_mechanics',   // 6: ゲーム、RPG、戦闘、アイテム、マップ
  'meta_learning',    // 7: スキル、自己改善、学習、LoRA、ベンチマーク
] as const;

export type SemanticDomain = typeof SEMANTIC_DOMAINS[number];

const DOMAIN_KEYWORDS: Record<SemanticDomain, string[]> = {
  coding_dev: [
    'コード', 'javascript', 'js', 'typescript', 'ts', 'html', 'css', 'canvas', 'vba', 'excel',
    'エラー', 'バグ', '修正', '関数', 'api', 'react', 'tailwind', 'コンポーネント', 'レンダリング',
    '変数', 'クラス', 'アルゴリズム', '非同期', 'promise', 'async', 'json',
  ],
  persona_style: [
    '口調', 'タメ口', '親友', 'ミキ', 'キャラクター', 'ペルソナ', '脱ロボット', '敬語禁止',
    '呼び方', '挨拶', 'ニックネーム', '語尾', '自然な日本語',
  ],
  user_profile: [
    'ユーザー', '名前', '趣味', '好き', '嫌い', '端末', 'スマホ', 'android', 'mac', 'windows',
    '職業', '年齢', '誕生日', '住まい', '好み', '設定',
  ],
  system_rules: [
    'ルール', '制約', '禁止', '必須', '方針', '安全境界', '基準', '仕様', 'ガイドライン',
    '手順', '要件', 'チェックリスト', '前提',
  ],
  episodic_history: [
    '前回', '過去', '昨日', '前言ってた', 'あの時', '失敗', '成功', '直した', '作った',
    '歴史', '経緯', '記憶', '覚えてる',
  ],
  relationship: [
    '親密度', '仲良し', '約束', '秘密', '思い出', '感謝', '信頼', '相談', '気持ち',
  ],
  game_mechanics: [
    'ゲーム', 'rpg', '戦闘', 'アリーナ', 'ダイス', 'インベントリ', 'クエスト', 'マップ',
    'ステータス', 'hp', 'mp', 'レベル', '敵',
  ],
  meta_learning: [
    'スキル', '改善', '自己学習', 'lora', 'colab', 'ベンチマーク', '評価', '世界モデル',
    '予測誤差', '系統樹', '世代', 'データセット', 'jsonl',
  ],
};

/**
 * テキストからドメインベクトル（8次元疎ベクトル）を算出
 */
export function calculateDomainVector(text: string): number[] {
  const lower = (text || '').toLowerCase();
  const vector = new Array(SEMANTIC_DOMAINS.length).fill(0);

  SEMANTIC_DOMAINS.forEach((domain, idx) => {
    const keywords = DOMAIN_KEYWORDS[domain];
    let hits = 0;
    keywords.forEach((kw) => {
      if (lower.includes(kw)) hits++;
    });
    vector[idx] = hits;
  });

  // ベクトルの正規化 (L2ノルム)
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    return vector.map((v) => Number((v / norm).toFixed(3)));
  }
  return vector;
}

/**
 * 2つのドメインベクトルの余弦類似度を計算 (0.0 〜 1.0)
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))));
}

/**
 * 日本語バイグラム + 単語トークン抽出 (Tier 1 Lexical)
 */
export function extractQueryTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  if (!text) return tokens;

  // 記号・空白で分割した単語トークン
  const words = text
    .toLowerCase()
    .split(/[\s、。,.!?！？「」『』()（）\[\]【】\/\\・:：;；~〜\-]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  words.forEach((w) => tokens.add(w));

  // 日本語文字バイグラム（2文字ずつのスライディング）
  const cleaned = text.replace(/[\s、。,.!?！？「」『』()（）\[\]【】\/\\・:：;；~〜\-]+/g, '');
  for (let i = 0; i < cleaned.length - 1; i++) {
    const bigram = cleaned.slice(i, i + 2).toLowerCase();
    if (!STOPWORDS.has(bigram)) tokens.add(bigram);
  }

  return tokens;
}

export interface MemoryRetrievalOptions {
  limit?: number;
  alwaysIncludePinned?: boolean;
  filterExpired?: boolean;
  onlyApproved?: boolean;
  onlyApprovedForFacts?: boolean; // profileやpreference等の事実性カテゴリは承認済みのみに制限 (設計思想 25)
  traverseGraph?: boolean;       // 知識グラフ依存関係トラバーサルを有効化 (デフォルト: true)
  maxGraphHops?: number;         // 最大探索ホップ数 (デフォルト: 2)
}

export interface ScoredMemory {
  memory: MemoryItem;
  score: number;
  keywordMatches: number;
  semanticSimilarity: number;
  retrievalSource: 'direct_match' | 'prerequisite_dependency' | 'parent_context' | 'graph_relation';
  linkedFromId?: string;
  matchReasons: string[];
}

/**
 * 現在のユーザー発言に関連する記憶を上位N件取得する
 */
export function retrieveRelevantMemories(
  currentUserMessage: string,
  memories: MemoryItem[],
  options: MemoryRetrievalOptions = {}
): MemoryItem[] {
  const scored = retrieveScoredMemories(currentUserMessage, memories, options);
  return scored.map((s) => s.memory);
}

/**
 * 多層ベクトル検索 ＋ 知識グラフ依存関係トラバーサル (メインスコアリング)
 */
export function retrieveScoredMemories(
  currentUserMessage: string,
  memories: MemoryItem[],
  options: MemoryRetrievalOptions = {}
): ScoredMemory[] {
  const {
    limit = 5,
    alwaysIncludePinned = true,
    filterExpired = true,
    onlyApproved = false,
    onlyApprovedForFacts = false,
    traverseGraph = true,
  } = options;

  const now = Date.now();
  const memoryMap = new Map<string, MemoryItem>();

  const activeMemories = (memories || []).filter((m) => {
    if (m.active === false) return false;
    if (m.status === 'archived' || m.status === 'deprecated') return false;
    // 49章: 隔離 (quarantine: 出典不明・未確定) と 破棄候補 (discard_candidate) はプロンプト注入から完全に除外
    if (m.destination === 'quarantine' || m.destination === 'discard_candidate') return false;
    if (filterExpired && m.expiresAt && m.expiresAt < now) return false;
    if (onlyApproved && m.approved === false) return false;
    // 事実性の高いカテゴリ (profile, preference) は承認済みのみに制限 (設計思想 25. 未承認情報を確定事実として使わない)
    if (onlyApprovedForFacts && (m.category === 'profile' || m.category === 'preference') && m.approved === false) {
      return false;
    }
    memoryMap.set(m.id, m);
    return true;
  });

  if (activeMemories.length === 0) return [];

  // クエリのLexicalトークン & Semanticドメインベクトル
  const queryTokens = extractQueryTokens(currentUserMessage);
  const queryVector = calculateDomainVector(currentUserMessage);

  // 1. 各記憶の多層スコアリング (Tier 1 + Tier 2 + Tier 3)
  const initialScored: ScoredMemory[] = activeMemories.map((memory) => {
    const memoryText = `${memory.content} ${(memory.tags || []).join(' ')} ${memory.sourceRef || ''}`;
    const memoryTokens = extractQueryTokens(memoryText);
    const memoryVector = memory.domainVector || calculateDomainVector(memoryText);

    // Tier 1: Lexical N-Gram Match Score
    let keywordMatches = 0;
    const matchReasons: string[] = [];

    queryTokens.forEach((t) => {
      if (memoryTokens.has(t)) {
        keywordMatches++;
        if (matchReasons.length < 3) matchReasons.push(`キーワード: "${t}"`);
      }
    });

    // Tier 2: Semantic Domain Vector Cosine Similarity
    const semanticSim = calculateCosineSimilarity(queryVector, memoryVector);
    if (semanticSim > 0.4) {
      matchReasons.push(`意味類似度: ${(semanticSim * 100).toFixed(0)}%`);
    }

    // Tier 3: Metadata & Feedback & Recency
    const importanceScore = (memory.importance ?? 1) * 1.5;
    const pinnedBonus = memory.pinned ? 8 : 0;
    const usageBonus = Math.min(memory.useCount ?? 0, 5) * 0.5;
    // 承認済み記憶はボーナス付与、未承認記憶は確証度ペナルティ (-2.5) を付与 (設計思想 25)
    const approvedBonus = memory.approved ? 4 : -2.5;

    const good = memory.goodCount ?? 0;
    const bad = memory.badCount ?? 0;
    const feedbackScore = Math.max(-6, Math.min(6, (good - bad) * 2));

    const recencyTimestamp = memory.lastUsedAt ?? memory.updatedAt ?? memory.createdAt ?? 0;
    const recencyScore = recencyTimestamp > 0 ? Math.min(recencyTimestamp / 1e13, 1) : 0;

    const totalScore =
      keywordMatches * 3.0 +
      semanticSim * 6.0 + // 意味類似度ボーナス
      importanceScore +
      pinnedBonus +
      usageBonus +
      approvedBonus +
      feedbackScore +
      recencyScore;

    if (memory.approved === false) {
      matchReasons.push('※未確認・未承認記憶 (仮推論)');
    }
    if (memory.conflictWith && memory.conflictWith.length > 0) {
      matchReasons.push('⚠️別記憶と競合あり');
    }

    return {
      memory,
      score: Number(totalScore.toFixed(2)),
      keywordMatches,
      semanticSimilarity: semanticSim,
      retrievalSource: 'direct_match',
      matchReasons,
    };
  });

  // 初回スコア順ソート
  initialScored.sort((a, b) => b.score - a.score);

  // 2. 知識グラフ依存関係トラバーサル (Knowledge Graph Traversal)
  // ヒットした主要記憶（Seed）の「前提条件(prerequisite)」や「親子関係(parent)」を連鎖的に引き込み
  const scoredMap = new Map<string, ScoredMemory>();
  initialScored.forEach((s) => scoredMap.set(s.memory.id, s));

  const resultList: ScoredMemory[] = [];
  const visitedIds = new Set<string>();

  const addMemoryToResult = (scoredItem: ScoredMemory) => {
    if (visitedIds.has(scoredItem.memory.id)) return;
    visitedIds.add(scoredItem.memory.id);
    resultList.push(scoredItem);

    // グラフ探索が有効な場合、関連ノードを連鎖探索
    if (traverseGraph && resultList.length < limit * 2) {
      const mem = scoredItem.memory;

      // A. 前提条件 (Prerequisites): 最重要（これがないと成立しない前提ルール・上位設定）
      if (mem.prerequisiteMemoryIds && mem.prerequisiteMemoryIds.length > 0) {
        mem.prerequisiteMemoryIds.forEach((prereqId) => {
          if (!visitedIds.has(prereqId) && memoryMap.has(prereqId)) {
            const prereqMem = memoryMap.get(prereqId)!;
            const prereqScored: ScoredMemory = {
              memory: prereqMem,
              score: scoredItem.score * 0.9 + 5, // 前提条件ノードへの優先ブースト
              keywordMatches: 0,
              semanticSimilarity: scoredItem.semanticSimilarity * 0.8,
              retrievalSource: 'prerequisite_dependency',
              linkedFromId: mem.id,
              matchReasons: [`前提条件 (from "${mem.content.substring(0, 12)}...")`],
            };
            addMemoryToResult(prereqScored);
          }
        });
      }

      // B. 親ノード (Parent Context): 上位概念・大枠の仕様
      if (mem.parentMemoryId && !visitedIds.has(mem.parentMemoryId) && memoryMap.has(mem.parentMemoryId)) {
        const parentMem = memoryMap.get(mem.parentMemoryId)!;
        const parentScored: ScoredMemory = {
          memory: parentMem,
          score: scoredItem.score * 0.85 + 3,
          keywordMatches: 0,
          semanticSimilarity: scoredItem.semanticSimilarity * 0.7,
          retrievalSource: 'parent_context',
          linkedFromId: mem.id,
          matchReasons: [`上位親ノード (from "${mem.content.substring(0, 12)}...")`],
        };
        addMemoryToResult(parentScored);
      }

      // C. 横の関連リンク (Related Nodes)
      if (mem.relatedMemoryIds && mem.relatedMemoryIds.length > 0) {
        mem.relatedMemoryIds.forEach((relId) => {
          if (!visitedIds.has(relId) && memoryMap.has(relId)) {
            const relMem = memoryMap.get(relId)!;
            const relScored: ScoredMemory = {
              memory: relMem,
              score: scoredItem.score * 0.7, // 減衰
              keywordMatches: 0,
              semanticSimilarity: scoredItem.semanticSimilarity * 0.6,
              retrievalSource: 'graph_relation',
              linkedFromId: mem.id,
              matchReasons: [`関連リンク (from "${mem.content.substring(0, 12)}...")`],
            };
            addMemoryToResult(relScored);
          }
        });
      }
    }
  };

  // ピン留め記憶を最優先登録
  if (alwaysIncludePinned) {
    initialScored
      .filter((s) => s.memory.pinned)
      .forEach((s) => addMemoryToResult(s));
  }

  // スコア順にSeed記憶を追加
  for (const s of initialScored) {
    if (resultList.length >= limit) break;
    addMemoryToResult(s);
  }

  // 最終ソートと上限切り出し
  resultList.sort((a, b) => b.score - a.score);
  return resultList.slice(0, limit);
}

/** JS全件スキャンに切り替える閾値。これ未満ならFTS5を使わず今まで通り全件スコアリングする。 */
export const FTS_PREFILTER_THRESHOLD = 300;

/**
 * retrieveScoredMemories のハイブリッド版。
 * 記憶件数が FTS_PREFILTER_THRESHOLD 以上、かつ SQLite backend が使える場合のみ、
 * 先に FTS5 で候補を絞り込んでから、その候補集合に対して既存のJS多層スコアリングを実行する。
 * それ以外(件数が少ない/IndexedDB backend/FTS5失敗時)は、従来通り全件をJSスコアリングする。
 */
export async function retrieveScoredMemoriesHybrid(
  currentUserMessage: string,
  memories: MemoryItem[],
  options: MemoryRetrievalOptions = {}
): Promise<ScoredMemory[]> {
  let candidateMemories = memories;

  if (memories.length >= FTS_PREFILTER_THRESHOLD && storageService.supportsFTS()) {
    const candidateIds = await storageService.searchMemoriesFTS(currentUserMessage, 200);
    if (candidateIds && candidateIds.length > 0) {
      const idSet = new Set(candidateIds);
      // pinned(常時表示)な記憶はFTS5でヒットしなくても候補から落とさない
      candidateMemories = memories.filter((m) => idSet.has(m.id) || m.pinned);
    }
    // candidateIds が null(FTS5失敗) or 空の場合は candidateMemories = memories のまま(フォールバック)
  }

  return retrieveScoredMemories(currentUserMessage, candidateMemories, options);
}

/**
 * retrieveRelevantMemories のハイブリッド版。
 */
export async function retrieveRelevantMemoriesHybrid(
  currentUserMessage: string,
  memories: MemoryItem[],
  options: MemoryRetrievalOptions = {}
): Promise<MemoryItem[]> {
  const scored = await retrieveScoredMemoriesHybrid(currentUserMessage, memories, options);
  return scored.map((s) => s.memory);
}

/**
 * 会話で記憶が使用された際に、使用回数と最終利用日時を更新するヘルパー
 */
export function recordMemoryUsage(
  usedMemoryIds: string[],
  memories: MemoryItem[]
): MemoryItem[] {
  const idSet = new Set(usedMemoryIds);
  const now = Date.now();
  return memories.map((m) => {
    if (idSet.has(m.id)) {
      return {
        ...m,
        useCount: (m.useCount ?? 0) + 1,
        lastUsedAt: now,
      };
    }
    return m;
  });
}

/**
 * 記憶アイテムのメタデータ（7階層memoryType、承認状態、根拠、ベクトル等）を完全に補完・正規化する
 */
export function enrichMemoryMetadata(
  item: Partial<MemoryItem> & { content: string },
  options: {
    rawUserText?: string;
    sourceRef?: string;
    existingMemories?: MemoryItem[];
  } = {}
): MemoryItem {
  const content = item.content || '';
  const now = Date.now();

  // 1. memoryType (7階層) の自動判定
  let memoryType = item.memoryType;
  if (!memoryType) {
    const category = item.category || 'chat';
    if (category === 'code' || category === 'vba') {
      memoryType = 'procedural';
    } else if (category === 'gamedev') {
      memoryType = content.includes('手順') || content.includes('ステップ') || content.includes('実装') ? 'procedural' : 'structural';
    } else if (category === 'chat') {
      memoryType = 'episodic';
    } else if (category === 'relationship') {
      memoryType = 'semantic';
    } else if (category === 'preference' || category === 'profile') {
      memoryType = 'semantic';
    } else {
      memoryType = 'semantic';
    }
  }

  // 2. approved (承認状態) の補完 (設計思想 25. 未承認情報を確定事実として使わない)
  // 自動抽出 (source === 'auto') の場合は、importance や pinned に関係なく必ず false とする。
  // ユーザー手動入力 (source === 'manual') や明示的承認 (approved === true) のみ承認とする。
  let approved = false;
  if (item.approved !== undefined) {
    approved = item.approved;
  } else if (item.source === 'manual') {
    approved = true;
  } else if (item.source === 'auto') {
    approved = false;
  } else {
    approved = Boolean(item.pinned && (item.importance ?? 1) >= 5);
  }

  // 3. rawExcerpt (原文抜粋) と sourceRef (根拠参照)
  const rawExcerpt = item.rawExcerpt || options.rawUserText?.slice(0, 150) || content.slice(0, 150);
  const sourceRef = item.sourceRef || options.sourceRef || (item.source === 'auto' ? 'user_chat' : 'user_direct');

  // 4. ドメインベクトル & キーワード
  const domainVector = item.domainVector || calculateDomainVector(content);
  const semanticKeywords = item.semanticKeywords || Array.from(extractQueryTokens(content)).slice(0, 10);

  // 5. 既存記憶との競合・矛盾チェック (conflictWith)
  const conflictWith: string[] = item.conflictWith ? [...item.conflictWith] : [];
  if (options.existingMemories && options.existingMemories.length > 0) {
    const checkText = content.toLowerCase();
    for (const existing of options.existingMemories) {
      if (existing.id === item.id) continue;
      const existText = existing.content.toLowerCase();

      // プロフィールの名前・呼び名の重複競合
      if (item.category === 'profile' && existing.category === 'profile') {
        if (
          (checkText.includes('名前') || checkText.includes('呼んで') || checkText.includes('ニックネーム')) &&
          (existText.includes('名前') || existText.includes('呼んで') || existText.includes('ニックネーム'))
        ) {
          if (!conflictWith.includes(existing.id)) conflictWith.push(existing.id);
        }
      }

      // 好み・デザイン・スタイルの矛盾競合
      if (item.category === 'preference' && existing.category === 'preference') {
        const isStyleConflict =
          (checkText.includes('配色') || checkText.includes('カラー') || checkText.includes('テーマ') || checkText.includes('背景')) &&
          (existText.includes('配色') || existText.includes('カラー') || existText.includes('テーマ') || existText.includes('背景'));
        const isSentimentConflict =
          (checkText.includes('好き') && existText.includes('嫌い')) ||
          (checkText.includes('嫌い') && existText.includes('好き'));

        if (isStyleConflict || isSentimentConflict || (content.length >= 8 && existing.content.includes(content.slice(0, 8)))) {
          if (!conflictWith.includes(existing.id)) conflictWith.push(existing.id);
        }
      }

      // 開発仕様・ボタン・レイアウトの相反
      if ((item.category === 'gamedev' || item.category === 'code') && (existing.category === 'gamedev' || existing.category === 'code')) {
        if (
          (checkText.includes('ボタン') || checkText.includes('角丸') || checkText.includes('サイズ') || checkText.includes('仕様')) &&
          (existText.includes('ボタン') || existText.includes('角丸') || existText.includes('サイズ') || existText.includes('仕様'))
        ) {
          if (!conflictWith.includes(existing.id)) conflictWith.push(existing.id);
        }
      }
    }
  }

  // 6. 49章 経験の保存先ルーターによる9分類判定 (destination)
  let destination = item.destination;
  let quarantineReason = item.quarantineReason;
  let discardReason = item.discardReason;
  let routingFactors = item.routingFactors;

  if (!destination) {
    const routingRes = experienceRouterService.routeExperience(
      {
        ...item,
        content,
        approved,
        memoryType,
        source: item.source || 'auto',
      },
      options.existingMemories || []
    );
    destination = routingRes.destination;
    routingFactors = routingRes.factors;
    if (destination === 'quarantine') {
      quarantineReason = routingRes.reason;
      approved = false; // 隔離は未承認扱い
    } else if (destination === 'discard_candidate') {
      discardReason = routingRes.reason;
    }
  }

  const isActive = item.active ?? (destination !== 'quarantine' && destination !== 'discard_candidate');

  return {
    id: item.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category: item.category || 'preference',
    content,
    importance: item.importance ?? (destination === 'quarantine' ? 1 : item.source === 'auto' ? 2 : 4),
    pinned: item.pinned ?? false,
    active: isActive,
    approved,
    memoryType,
    sourceRef,
    rawExcerpt,
    domainVector,
    semanticKeywords,
    status: item.status || (destination === 'quarantine' ? 'sleeping' : destination === 'discard_candidate' ? 'deprecated' : 'active'),
    conflictWith,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    source: item.source || 'auto',
    tags: item.tags || [item.category || 'memory'],
    relatedMemoryIds: item.relatedMemoryIds || [],
    prerequisiteMemoryIds: item.prerequisiteMemoryIds || [],
    parentMemoryId: item.parentMemoryId,
    useCount: item.useCount ?? 0,
    lastUsedAt: item.lastUsedAt,
    expiresAt: item.expiresAt,
    goodCount: item.goodCount ?? 0,
    badCount: item.badCount ?? 0,
    destination,
    projectScopeId: item.projectScopeId,
    quarantineReason,
    discardReason,
    routingFactors,
    routedAt: item.routedAt || now,
  };
}

/**
 * 記憶配列全体の競合を双方向に検出し、相互に conflictWith を補完するヘルパー
 */
export function detectAndLinkConflicts(memories: MemoryItem[]): MemoryItem[] {
  const result = memories.map((m) => ({
    ...m,
    conflictWith: m.conflictWith ? [...m.conflictWith] : [],
  }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
      if (a.active === false || b.active === false) continue;

      let isConflict = false;
      const textA = a.content.toLowerCase();
      const textB = b.content.toLowerCase();

      if (a.category === 'profile' && b.category === 'profile') {
        if (
          (textA.includes('名前') || textA.includes('呼んで') || textA.includes('ニックネーム')) &&
          (textB.includes('名前') || textB.includes('呼んで') || textB.includes('ニックネーム'))
        ) {
          isConflict = true;
        }
      } else if (a.category === 'preference' && b.category === 'preference') {
        const isStyleConflict =
          (textA.includes('配色') || textA.includes('カラー') || textA.includes('テーマ') || textA.includes('背景')) &&
          (textB.includes('配色') || textB.includes('カラー') || textB.includes('テーマ') || textB.includes('背景'));
        const isSentimentConflict =
          (textA.includes('好き') && textB.includes('嫌い')) ||
          (textA.includes('嫌い') && textB.includes('好き'));
        if (isStyleConflict || isSentimentConflict) {
          isConflict = true;
        }
      }

      if (isConflict) {
        if (!a.conflictWith.includes(b.id)) a.conflictWith.push(b.id);
        if (!b.conflictWith.includes(a.id)) b.conflictWith.push(a.id);
      }
    }
  }

  return result;
}

/**
 * 競合記憶の解決ヘルパー (設計思想 12 & 25)
 * keepId を正（approved: true, active: true）とし、
 * discardId を非アクティブ（active: false）にして相互の conflictWith を解決する
 */
export function resolveMemoryConflict(
  keepId: string,
  discardId: string,
  memories: MemoryItem[]
): MemoryItem[] {
  const now = Date.now();
  return memories.map((m) => {
    if (m.id === keepId) {
      return {
        ...m,
        active: true,
        approved: true,
        conflictWith: (m.conflictWith || []).filter((id) => id !== discardId),
        updatedAt: now,
      };
    }
    if (m.id === discardId) {
      return {
        ...m,
        active: false,
        conflictWith: (m.conflictWith || []).filter((id) => id !== keepId),
        updatedAt: now,
      };
    }
    return m;
  });
}

/**
 * 両方の記憶を生かしたまま、競合フラグを解除するヘルパー
 */
export function dismissMemoryConflict(
  idA: string,
  idB: string,
  memories: MemoryItem[]
): MemoryItem[] {
  const now = Date.now();
  return memories.map((m) => {
    if (m.id === idA) {
      return {
        ...m,
        conflictWith: (m.conflictWith || []).filter((id) => id !== idB),
        updatedAt: now,
      };
    }
    if (m.id === idB) {
      return {
        ...m,
        conflictWith: (m.conflictWith || []).filter((id) => id !== idA),
        updatedAt: now,
      };
    }
    return m;
  });
}

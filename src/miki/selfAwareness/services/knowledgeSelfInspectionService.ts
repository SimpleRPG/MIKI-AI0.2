import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeConnectivityService } from '../../memory/services/knowledgeConnectivityService';
import { worldModelGraphService } from './worldModelGraphService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { dialogueExampleRecallService } from '../../memory/services/dialogueExampleRecallService';
import { teacherLessonRecallService } from '../../memory/services/teacherLessonRecallService';
import { analogyCandidateService } from './analogyCandidateService';
import { procedureChunkingService } from '../../execution/services/procedureChunkingService';

/**
 * P501: 知識と語彙の自己点検。
 *
 * これまでの自己点検は「問題が起きた所」中心だった（矛盾の
 * スキャン、ログの自己レビュー、検索の自己診断）。これは
 * 知識と語彙そのものの健康診断で、辞書の育ち・意味が付いて
 * いない語の残り・世界の関係の仮の割合・知識の接続・学習
 * 待ちの状態を定期的に数え、記録する。
 *
 * 見つけた「意味待ちの語」は、既存の意味学習ループ
 * （UNKNOWN_TERM gap）へ自動で流す。それ以外の所見は
 * 記録とログに残すだけにし、勝手な削除や変更はしない。
 */
export interface KnowledgeSelfInspectionRecord {
  inspectedAt: number;
  personalDictionary: number;
  learnedDictionaryEntries: number;
  lexicalRelations: number;
  paraphrasePairs: number;
  termComponents: number;
  glosslessCount: number;
  glosslessSample: string[];
  worldEntities: number;
  worldRelations: number;
  provisionalRelations: number;
  claims: number;
  connectivity: { total: number; connected: number; weak: number; orphaned: number };
  openGaps: number;
  parkedGaps: number;
  gapsRaised: number;
  materiallessCount: number;
  materiallessSample: string[];
  dialogueMaterialGapsRaised: number;
  analogyCandidatesCreated: number;
  procedureChunksCreated: number;
  findings: string[];
}

const STORAGE_KEY = 'miki_knowledge_self_inspection_v1';
const MAX_RECORDS = 10;
const GLOSSLESS_GAP_LIMIT = 5;
const DIALOGUE_MATERIAL_GAP_LIMIT = 3;

class KnowledgeSelfInspectionService {
  public inspect(): KnowledgeSelfInspectionRecord {
    const findings: string[] = [];

    // 辞書の育ち。
    const personal = japaneseDictionaryService.listPersonal();
    const learned = personal.filter((e) => (e.semanticIds || []).includes('learned:definition')).length;

    // 意味が付いていない用語部品。
    const termComponents = (reusableComponentFactoryService.list() as unknown as Array<Record<string, unknown>>).filter(
      (item) => item.componentKind === 'KNOWLEDGE' && item.componentType === 'TERM_KNOWLEDGE',
    );
    const glosslessTerms = [
      ...new Set(
        termComponents
          .filter((item) => item.needsGloss === true && typeof item.term === 'string' && item.term)
          .map((item) => String(item.term)),
      ),
    ];

    // 意味待ちの語を意味学習へ流す。既に開いている gap（休止中
    // を含む）がある語は再検出しない（休止を勝手に解除しない）。
    const openGaps = knowledgeGapService.listOpen(500);
    const openTargets = new Set(
      openGaps.filter((g) => g.type === 'UNKNOWN_TERM').map((g) => g.identity?.target).filter(Boolean),
    );
    let gapsRaised = 0;
    for (const term of glosslessTerms) {
      if (gapsRaised >= GLOSSLESS_GAP_LIMIT) break;
      if (openTargets.has(term)) continue;
      try {
        knowledgeGapService.detect({
          query: `用語の意味を学ぶ: ${term}`,
          reason: '自己点検で、意味が付いていない用語が残っていることが分かったため。',
          type: 'UNKNOWN_TERM',
          target: term,
          priority: 40,
        });
        gapsRaised++;
      } catch { /* 1語の失敗で点検全体は止めない */ }
    }
    if (glosslessTerms.length > 0) {
      findings.push(`意味が付いていない用語が${glosslessTerms.length}件残っている${gapsRaised > 0 ? `（${gapsRaised}件を意味学習へ流した）` : ''}`);
    }

    // 言い換えの対（自分の言葉で言い直して意味を確かめる力の在庫）。
    const paraphrasePairs = lexicalRelationService.paraphrasePairs().length;
    if (paraphrasePairs === 0) {
      findings.push('言い換えの対が1件も無く、自分の言葉で言い直す検証ができない');
    }

    // 世界の関係。
    const relations = worldModelGraphService.relations();
    const provisional = relations.filter((r) => r.provisional).length;
    if (relations.length >= 20 && provisional / relations.length > 0.6) {
      findings.push(`世界の関係の${Math.round((provisional / relations.length) * 100)}%が仮のままになっている`);
    }

    // 知識と接続。
    const claims = claimDatabaseService.listClaims().length;
    const connectivity = knowledgeConnectivityService.summarize();
    if (connectivity.orphaned > 0) {
      findings.push(`孤立した知識が${connectivity.orphaned}件ある`);
    }

    // 学習待ち。
    const parked = openGaps.filter((g) => knowledgeGapService.isRetryParked(g)).length;
    if (parked > 0) {
      findings.push(`試行上限で休止中の学習待ちが${parked}件ある`);
    }

    // P899: 事実はあるのに話し方の材料が無い話題。知っているのに
    // 上手く話せない状態を、彼女自身の点検で学習の穴に変える。
    const materiallessTopics = this.findTopicsWithoutDialogueMaterial(10);
    const openQueries = new Set(openGaps.map((g) => g.query));
    let dialogueMaterialGapsRaised = 0;
    for (const topic of materiallessTopics) {
      if (dialogueMaterialGapsRaised >= DIALOGUE_MATERIAL_GAP_LIMIT) break;
      const query = `話し方の材料を学ぶ: ${topic}`;
      if (openQueries.has(query)) continue;
      try {
        knowledgeGapService.detect({
          query,
          reason: '自己点検で、事実は知っているのに話し方の材料（会話例・型）が無い話題が分かったため。',
          type: 'INSUFFICIENT_EVIDENCE',
          target: topic,
          missingContent: '会話例や言い回しの型',
          priority: 35,
        });
        dialogueMaterialGapsRaised++;
      } catch { /* 1件の失敗で点検全体は止めない */ }
    }
    if (materiallessTopics.length > 0) {
      findings.push(`事実はあるのに話し方の材料が無い話題が${materiallessTopics.length}件ある${dialogueMaterialGapsRaised > 0 ? `（${dialogueMaterialGapsRaised}件を学習へ流した）` : ''}`);
    }

    // P902: 類推による候補関係の自己生成。点検のついでに、兄弟が
    // 持つ関係を持たない兄弟への候補を作り、予測で検証に回す。
    let analogyCreated = 0;
    try { analogyCreated = analogyCandidateService.generateCandidates(3).length; } catch { /* 補助経路 */ }
    if (analogyCreated > 0) {
      findings.push(`類推で候補関係を${analogyCreated}件作った（予測で検証する）`);
    }

    // P903: 手続きの塊化。観測が溜まっていれば、繰り返し手順を
    // ワークフロー候補として登録する（点検1回につき最大1件）。
    let chunksCreated = 0;
    try { chunksCreated = procedureChunkingService.detectAndChunk(1).length; } catch { /* 補助経路 */ }
    if (chunksCreated > 0) {
      findings.push(`繰り返し手順を${chunksCreated}件、塊として登録した`);
    }

    const record: KnowledgeSelfInspectionRecord = {
      inspectedAt: Date.now(),
      personalDictionary: personal.length,
      learnedDictionaryEntries: learned,
      lexicalRelations: lexicalRelationService.counts().total,
      paraphrasePairs,
      termComponents: termComponents.length,
      glosslessCount: glosslessTerms.length,
      glosslessSample: glosslessTerms.slice(0, 10),
      worldEntities: worldModelGraphService.entities().length,
      worldRelations: relations.length,
      provisionalRelations: provisional,
      claims,
      connectivity: {
        total: connectivity.total,
        connected: connectivity.connected,
        weak: connectivity.weak,
        orphaned: connectivity.orphaned,
      },
      openGaps: openGaps.length,
      parkedGaps: parked,
      gapsRaised,
      materiallessCount: materiallessTopics.length,
      materiallessSample: materiallessTopics.slice(0, 10),
      dialogueMaterialGapsRaised,
      analogyCandidatesCreated: analogyCreated,
      procedureChunksCreated: chunksCreated,
      findings,
    };

    this.saveRecord(record);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🩺 [自己点検] 辞書${record.personalDictionary}件（学習${learned}）／言い換え対${record.paraphrasePairs}件／意味待ち${record.glosslessCount}件／関係${record.worldRelations}件（仮${provisional}）／知識${claims}件（孤立${connectivity.orphaned}）／学習待ち${record.openGaps}件（休止${parked}）／材料なし話題${record.materiallessCount}件`,
    );
    for (const finding of findings) {
      systemLogger.info('SELF_IMPROVEMENT', `🩺 [自己点検] 所見: ${finding}`);
    }
    return record;
  }

  /**
   * P899: 「事実はあるのに話し方の材料が無い話題」の棚卸し。
   * 確定した世界の関係を2件以上持つ実体（＝ある程度知っている
   * 話題）について、会話例と教師レッスンのどちらからも材料が
   * 引けないものを、関係の多い順に最大 limit 件返す。
   */
  public findTopicsWithoutDialogueMaterial(limit = 3): string[] {
    const relations = worldModelGraphService.relations().filter((r) => !r.provisional);
    const counts = new Map<string, number>();
    for (const r of relations) {
      counts.set(r.from, (counts.get(r.from) ?? 0) + 1);
      counts.set(r.to, (counts.get(r.to) ?? 0) + 1);
    }
    const candidates = [...counts.entries()]
      .filter(([name, n]) => name.length >= 2 && n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000)
      .map(([name]) => name);
    const out: string[] = [];
    for (const name of candidates) {
      if (out.length >= limit) break;
      try {
        if (dialogueExampleRecallService.findFor(name)) continue;
        if (teacherLessonRecallService.findFor(name)) continue;
      } catch { continue; }
      out.push(name);
    }
    return out;
  }

  public latest(): KnowledgeSelfInspectionRecord | undefined {
    const records = this.loadRecords();
    return records[records.length - 1];
  }

  private loadRecords(): KnowledgeSelfInspectionRecord[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? (parsed as KnowledgeSelfInspectionRecord[]) : [];
    } catch {
      return [];
    }
  }

  private saveRecord(record: KnowledgeSelfInspectionRecord): void {
    try {
      const records = [...this.loadRecords(), record].slice(-MAX_RECORDS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch { /* 点検記録の保存失敗は点検自体を止めない */ }
  }
}

export const knowledgeSelfInspectionService = new KnowledgeSelfInspectionService();

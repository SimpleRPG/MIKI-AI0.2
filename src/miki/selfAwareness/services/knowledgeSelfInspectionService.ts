import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeConnectivityService } from '../../memory/services/knowledgeConnectivityService';
import { worldModelGraphService } from './worldModelGraphService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';

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
  findings: string[];
}

const STORAGE_KEY = 'miki_knowledge_self_inspection_v1';
const MAX_RECORDS = 10;
const GLOSSLESS_GAP_LIMIT = 5;

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

    const record: KnowledgeSelfInspectionRecord = {
      inspectedAt: Date.now(),
      personalDictionary: personal.length,
      learnedDictionaryEntries: learned,
      lexicalRelations: lexicalRelationService.counts().total,
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
      findings,
    };

    this.saveRecord(record);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🩺 [自己点検] 辞書${record.personalDictionary}件（学習${learned}）／意味待ち${record.glosslessCount}件／関係${record.worldRelations}件（仮${provisional}）／知識${claims}件（孤立${connectivity.orphaned}）／学習待ち${record.openGaps}件（休止${parked}）`,
    );
    for (const finding of findings) {
      systemLogger.info('SELF_IMPROVEMENT', `🩺 [自己点検] 所見: ${finding}`);
    }
    return record;
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

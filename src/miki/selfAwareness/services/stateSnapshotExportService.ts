import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { associationGraphService } from '../../memory/services/associationGraphService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { projectNotebookService } from '../../memory/services/projectNotebookService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { worldModelGraphService } from './worldModelGraphService';
import { knowledgeSelfInspectionService } from './knowledgeSelfInspectionService';
import { reviewReflectionService } from './reviewReflectionService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { roleplaySessionService } from '../../conversation/services/roleplaySessionService';
import { conversationOpenTopicService } from '../../conversation/services/conversationOpenTopicService';
import { userKnowledgeProfileService } from '../../conversation/services/userKnowledgeProfileService';

/**
 * P545: 状態スナップショットの書き出し。ランタイムログは「仕組み
 * が動いたか」しか映さないため、知識や部品の「中身の質」は別途
 * まとめて出せるようにする（CLM-000104 の混在のような中身の
 * 問題は、ログの目印だけでは見つからない）。
 * 書き出し先は P539 と同じ流儀: 自分の保存領域と、ランタイム
 * ログ末尾への区切り印つき追記。サイズが大きい場合は新しい順に
 * 抜粋して truncated を明示する。
 */

const STORAGE_KEY = 'miki_state_snapshot_v1';
const MAX_JSON_CHARS = 350_000;

interface SnapshotCounts {
  claims: number;
  dictionary: number;
  entities: number;
  relations: number;
  components: number;
}

class StateSnapshotExportService {
  private build(limit: number): { snapshot: Record<string, unknown>; counts: SnapshotCounts } {
    const claims = claimDatabaseService.listClaims().slice(-limit).map((c) => ({
      id: c.claim_id,
      statement: c.statement,
      status: c.status,
      kind: (c as { kind?: string }).kind,
      source: c.source,
      archived: Boolean((c as { archived?: boolean }).archived),
    }));
    const dictionary = japaneseDictionaryService.listPersonal().slice(-limit).map((e) => {
      const entry = e as unknown as Record<string, unknown>;
      return {
        surface: String(entry.surface || entry.term || ''),
        gloss: String(entry.gloss || ''),
        semanticIds: Array.isArray(entry.semanticIds) ? entry.semanticIds : [],
      };
    });
    const entities = worldModelGraphService.entities();
    const relations = worldModelGraphService.relations();
    const components = (reusableComponentFactoryService.list() as unknown as Array<Record<string, unknown>>).slice(0, limit).map((c) => ({
      name: String(c.name || c.id || ''),
      status: String(c.status || c.state || ''),
    }));
    const projects = projectNotebookService.listProjects().map((project) => ({
      project,
      decisions: projectNotebookService.listDecisions(project).map((d) => d.text),
      // P560: 作業状態（今の作業・次の手）も監査対象に含める。
      workState: projectNotebookService.getWorkState(project) ?? null,
    }));
    let selfInspection: unknown = null;
    try {
      const latest = knowledgeSelfInspectionService.latest() as unknown as Record<string, unknown> | null;
      if (latest) selfInspection = { findings: Array.isArray(latest.findings) ? latest.findings : [] };
    } catch { /* 点検記録が無ければ null */ }
    const snapshot: Record<string, unknown> = {
      format: 'miki-state-snapshot/1',
      exportedAt: new Date().toISOString(),
      truncated: false,
      claims,
      dictionary,
      lexicalRelations: {
        synonyms: lexicalRelationService.synonymPairs(),
        antonyms: lexicalRelationService.antonymPairs(),
        paraphrases: lexicalRelationService.paraphrasePairs(),
      },
      worldModel: {
        entities: entities.map((e) => e.name),
        relations: relations.map((r) => ({ from: r.from, to: r.to, type: r.type, provisional: Boolean(r.provisional) })),
      },
      components,
      projects,
      roles: roleplaySessionService.listRoles().map((r) => ({ name: r.name, stance: r.stance, world: r.world, lastSummary: r.lastSummary || '' })),
      reflections: reviewReflectionService.list().map((r) => ({ question: r.question, answer: r.answer })),
      openTopic: conversationOpenTopicService.current(),
      // P560: P553 でリスト化された開いた話題を全部含める。
      openTopics: conversationOpenTopicService.listPending(),
      userKnowledge: {
        known: userKnowledgeProfileService.listKnown(),
        unknown: userKnowledgeProfileService.listUnknown(),
      },
      associationEdges: associationGraphService.edgeCount(),
      selfInspection,
    };
    return {
      snapshot,
      counts: {
        claims: claims.length,
        dictionary: dictionary.length,
        entities: entities.length,
        relations: relations.length,
        components: components.length,
      },
    };
  }

  public exportNow(): SnapshotCounts & { truncated: boolean } {
    let { snapshot, counts } = this.build(100_000);
    let json = JSON.stringify(snapshot);
    let truncated = false;
    if (json.length > MAX_JSON_CHARS) {
      truncated = true;
      const rebuilt = this.build(300);
      snapshot = { ...rebuilt.snapshot, truncated: true };
      counts = rebuilt.counts;
      json = JSON.stringify(snapshot);
    }
    const exportedAt = String(snapshot.exportedAt);
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify({ exportedAt, json }));
    } catch { /* 保存できなくてもログ側には出す */ }
    try {
      systemLogger.appendRawBlockToRuntimeLog(`===== MIKI STATE SNAPSHOT exportedAt=${exportedAt} =====\n${json}\n===== END MIKI STATE SNAPSHOT =====`);
    } catch { /* ログに書けなくても保存側は残る */ }
    systemLogger.info('SELF_IMPROVEMENT', `📦 [状態書き出し] Claim ${counts.claims} 件・辞書 ${counts.dictionary} 件・実体 ${counts.entities}・関係 ${counts.relations}・部品 ${counts.components} 件を書き出しました${truncated ? '（抜粋）' : ''}`);
    return { ...counts, truncated };
  }
}

export const stateSnapshotExportService = new StateSnapshotExportService();

import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { associationGraphService } from '../../memory/services/associationGraphService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { projectNotebookService } from '../../memory/services/projectNotebookService';
import { predictionLedgerService } from '../../memory/services/predictionLedgerService';
import { activationService } from '../../memory/services/activationService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { worldModelGraphService } from './worldModelGraphService';
import { knowledgeSelfInspectionService } from './knowledgeSelfInspectionService';
import { reviewReflectionService } from './reviewReflectionService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { roleplaySessionService } from '../../conversation/services/roleplaySessionService';
import { conversationOpenTopicService } from '../../conversation/services/conversationOpenTopicService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
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
      // P611: 受け止めの「外れ」の記録（直後に訂正された分類）。
      // 教師が次のログで点検し、分類の種表や形を見直すための材料。
      receptionReview: (() => { try { return JSON.parse(storageService.getItem('miki_reception_review_v1') || '[]'); } catch { return []; } })(),
      // P610: 動詞クラス表の拡張分（学習・教師で足された分）。
      verbEventClassExtensions: (() => { try { return JSON.parse(storageService.getItem('miki_verb_event_classes_v1') || '{}'); } catch { return {}; } })(),
      // P617: 答えられなかった質問の台帳（調査で解けたら消えていく想定の入口）。
      unansweredQuestions: (() => { try { return JSON.parse(storageService.getItem('miki_unanswered_questions_v1') || '[]'); } catch { return []; } })(),
      // P639: 日々のエピソード（P623）と状態の解消の記録（P634）も
      // 点検材料に含める（実機ログで P623〜P635 を数えるため）。
      episodes: (() => { try { return JSON.parse(storageService.getItem('miki_episodes_v1') || '[]'); } catch { return []; } })(),
      stateResolved: (() => { try { return JSON.parse(storageService.getItem('miki_user_state_resolved_v1') || '{}'); } catch { return {}; } })(),
      // P673: 遊びの状態（しりとり P669・クイズ P670）も点検材料に
      // 含める。実機で遊ばれたかどうか・詰まり方がログで見える。
      play: (() => {
        const read = (key: string) => { try { return JSON.parse(storageService.getItem(key) || 'null'); } catch { return null; } };
        const shiritori = read('miki_shiritori_v1');
        const quiz = read('miki_quiz_v1');
        return {
          shiritori: shiritori ? { active: !!shiritori.active, usedCount: Array.isArray(shiritori.used) ? shiritori.used.length : 0, requiredKana: shiritori.requiredDisplay || '' } : null,
          quiz: quiz ? { active: !!quiz.active, asked: quiz.asked || 0, correct: quiz.correct || 0, remaining: Array.isArray(quiz.queue) ? quiz.queue.length : 0 } : null,
          // P691: 終わった遊びの結果（P688/P689）と、直近の意見の
          // 根拠の記録（P687）も、記録→想起が実機で動いたかの
          // 点検材料に含める。
          quizLastResult: read('miki_quiz_last_result_v1'),
          shiritoriLastResult: read('miki_shiritori_last_result_v1'),
        };
      })(),
      lastOpinion: (() => { try { return JSON.parse(storageService.getItem('miki_last_opinion_v1') || 'null'); } catch { return null; } })(),
      // P699: 「覚えておいて」のメモも、状態の一部として見えるように。
      memos: (() => {
        try {
          const items = JSON.parse(storageService.getItem('miki_user_memos_v1') || '[]') as Array<{ text?: string }>;
          return { count: Array.isArray(items) ? items.length : 0, texts: Array.isArray(items) ? items.slice(-3).map((m) => m.text || '') : [] };
        } catch { return { count: 0, texts: [] }; }
      })(),
      // P811: 開いている知識ギャップも書き出す。教師側の調査
      // パイロット（2026-11-12 承認）で、次のログから Web 検索で
      // 埋められる種別を拾って調べるための材料。route の判定は
      // 読む側で行うので、ここでは種別までをそのまま出す
      // （buildResolutionPlan は状態を更新するので書き出しでは
      // 呼ばない）。
      openGaps: (() => {
        try {
          return knowledgeGapService.listOpen(15).map((g) => ({
            id: g.id,
            target: g.identity?.target || '',
            query: g.query,
            type: g.type,
            priority: g.priority,
            status: g.status,
            // P842: 解決のサブ目標のうち、今いる段（未完了の先頭）。
            // 計画が無いギャップでは空。読み取りのみ（計画は作らない）。
            step: g.resolutionPlan?.steps?.find((s) => s.status !== 'DONE')?.label || '',
          }));
        } catch { return []; }
      })(),
      // P844: 予測の照合状況（立てた予測がどれだけ当たったか）。
      predictions: (() => {
        try { return predictionLedgerService.stats(); } catch { return { open: 0, confirmed: 0, refuted: 0, lastRefutedTarget: '' }; }
      })(),
      // P752: 話してくれた予定の控えも、状態の一部として見えるように。
      plans: (() => {
        try {
          const items = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]') as Array<{ when?: string; text?: string }>;
          return { count: Array.isArray(items) ? items.length : 0, items: Array.isArray(items) ? items.slice(-5).map((p) => ({ when: p.when || '', text: p.text || '' })) : [] };
        } catch { return { count: 0, items: [] }; }
      })(),
      // P840: 話題の舞台（会話状態の currentTopic / recentEntities /
      // lastTopic と、保留スロットの有無）も書き出す。これまで
      // スナップショットに見えていた話題は開いた話題の台帳だけで、
      // 省略解決に実際に効いている舞台は実機で検証できなかった。
      topicStage: (() => {
        try {
          const st = JSON.parse(storageService.getItem('miki_conversation_state') || 'null');
          const has = (k: string) => { try { return Boolean(storageService.getItem(k)); } catch { return false; } };
          return {
            currentTopic: st?.currentTopic || '',
            recentEntities: Array.isArray(st?.recentEntities) ? st.recentEntities.slice(-5) : [],
            lastTopic: st?.lastTopic || '',
            pendingQuestions: Array.isArray(st?.pendingQuestions) ? st.pendingQuestions.length : 0,
            pendingSlots: {
              topicQuestion: has('miki_pending_topic_question_v1'),
              unknownTerm: has('miki_unknown_pending_v1'),
              lastList: has('miki_last_list_answer_v1'),
            },
            // P845: 活性化の高い語（思い出しやすさの上位）。
            activationTop: activationService.top(3).map((x) => x.term),
          };
        } catch { return null; }
      })(),
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

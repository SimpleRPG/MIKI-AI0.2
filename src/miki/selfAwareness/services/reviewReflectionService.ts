import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { knowledgeSelfInspectionService } from './knowledgeSelfInspectionService';
import { worldModelGraphService } from './worldModelGraphService';

/**
 * P537: 振り返りの問い。
 *
 * 教材 TM6-05（kepano の「40の問い」の翻案）の実装側。自己点検
 * （P501）が「件数を数える」のに対して、こちらは決まった問いを
 * 持ち、自分の記録から答えを組み立てて積み重ねる。同じ問いへの
 * 答えの変化が、成長の記録になる。答えは記録にある材料からのみ
 * 組み立て、材料が無ければ「まだ答えられる材料がありません」と
 * 正直に記録する（問いの保持は TM6-04）。
 *
 * 周期は24時間に1回まで、1回に1問をローテーションで選ぶ。
 */

export interface ReviewReflectionRecord {
  questionId: string;
  question: string;
  answer: string;
  at: number;
}

interface ReviewReflectionState {
  records: ReviewReflectionRecord[];
  lastRunAt: number;
}

const STORAGE_KEY = 'miki_review_reflections_v1';
const CADENCE_MS = 24 * 60 * 60_000;
const MAX_RECORDS = 60;
const NO_MATERIAL = 'まだ答えられる材料がありません。';

const QUESTIONS: Array<{ id: string; question: string }> = [
  { id: 'learned', question: '最近いちばん学んだことは何か' },
  { id: 'failure', question: 'いちばんの失敗・課題は何か' },
  { id: 'missing', question: '足りなかったものは何か' },
  { id: 'lesson', question: '学んだ教訓は何か' },
  { id: 'symbol', question: '今の自分を象徴する言葉は何か' },
];

class ReviewReflectionService {
  public questions(): Array<{ id: string; question: string }> {
    return [...QUESTIONS];
  }

  public list(): ReviewReflectionRecord[] {
    return this.load().records;
  }

  public latest(): ReviewReflectionRecord | undefined {
    const records = this.load().records;
    return records[records.length - 1];
  }

  /** 周期が来ていれば1問だけ振り返る。来ていなければ undefined。 */
  public runIfDue(now: number = Date.now()): ReviewReflectionRecord | undefined {
    const state = this.load();
    if (now - state.lastRunAt < CADENCE_MS) return undefined;
    return this.runNow(now);
  }

  /** 周期を無視して今すぐ1問振り返る（手動・検証用）。 */
  public runNow(now: number = Date.now()): ReviewReflectionRecord {
    const state = this.load();
    const spec = QUESTIONS[state.records.length % QUESTIONS.length];
    const answer = this.composeAnswer(spec.id);
    const record: ReviewReflectionRecord = { questionId: spec.id, question: spec.question, answer, at: now };
    state.records = [...state.records, record].slice(-MAX_RECORDS);
    state.lastRunAt = now;
    this.save(state);
    systemLogger.info('SELF_IMPROVEMENT', `🪞 [振り返り] 問い「${spec.question}」→ ${answer}`);
    return record;
  }

  private composeAnswer(questionId: string): string {
    try {
      switch (questionId) {
        case 'learned': {
          const personal = japaneseDictionaryService.listPersonal();
          const entry: any = personal[personal.length - 1];
          if (entry?.surface) {
            const gloss = String(entry.gloss || '').slice(0, 40);
            return `『${entry.surface}』という言葉を覚えました${gloss ? `（${gloss}）` : ''}。`;
          }
          return this.newestVerifiedClaimAnswer() ?? NO_MATERIAL;
        }
        case 'failure': {
          const findings = knowledgeSelfInspectionService.latest()?.findings ?? [];
          return findings.length > 0
            ? `自己点検の所見にあります：${findings[0]}`
            : '目立った失敗は記録されていません。';
        }
        case 'missing': {
          const open: any[] = knowledgeGapService.listOpen() as any[];
          if (open.length === 0) return '今のところ、積み残しはありません。';
          const target = open[0]?.identity?.target;
          return `まだ分かっていないことが${open.length}件あります${target ? `。たとえば『${target}』です` : ''}。`;
        }
        case 'lesson': {
          return this.newestVerifiedClaimAnswer() ?? NO_MATERIAL;
        }
        case 'symbol': {
          const relations = worldModelGraphService.relations();
          if (relations.length === 0) return NO_MATERIAL;
          const counts = new Map<string, number>();
          for (const r of relations) {
            counts.set(r.from, (counts.get(r.from) ?? 0) + 1);
            counts.set(r.to, (counts.get(r.to) ?? 0) + 1);
          }
          const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
          return top ? `今いちばんつながりの多い知識は『${top[0]}』です（関係${top[1]}件）。` : NO_MATERIAL;
        }
        default:
          return NO_MATERIAL;
      }
    } catch {
      return NO_MATERIAL;
    }
  }

  private newestVerifiedClaimAnswer(): string | undefined {
    const claims = claimDatabaseService
      .listClaims()
      .filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED');
    const claim: any = claims[claims.length - 1];
    if (!claim?.statement) return undefined;
    const statement = String(claim.statement).slice(0, 60);
    return `『${statement}』ということを確かめました。`;
  }

  private load(): ReviewReflectionState {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.records)) {
          return { records: parsed.records, lastRunAt: Number(parsed.lastRunAt) || 0 };
        }
      }
    } catch { /* 壊れた記録は初期化する */ }
    return { records: [], lastRunAt: 0 };
  }

  private save(state: ReviewReflectionState): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* 保存は補助経路 */ }
  }
}

export const reviewReflectionService = new ReviewReflectionService();

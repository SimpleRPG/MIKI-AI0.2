import { desireService } from '../../selfAwareness/services/desireService';
import { workingAgendaService } from '../../strategy/services/workingAgendaService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { worldModelService } from '../../selfAwareness/services/worldModelService';
import { autonomousSearchService } from '../../research/services/autonomousSearchService';

/**
 * P3001: アイドル仕事キューと選択器（核）。
 *
 * これまで深い睡眠の Step 6.8〜6.10 は系統ごとに直呼びで、
 * 「宿題→ギャップ」の固定順や進化サイクルの全サブシステム実行が
 * 散らばっていた。ここではアイドル時に回す仕事を1つの待ち行列に
 * 集め、優先順位ルールで選んでから実行側へ渡す。浅い睡眠は
 * 軽量整理のままで、キューに入れない。
 *
 * 優先順位ルール（shared/decisions.md #6）:
 *   1. 影響度 CRITICAL の能力ギャップだけが割り込み可（欲求より先）。
 *   2. 欲求由来を先に置く。LEARN 欲求（知りたい・できるように
 *      なりたい）も欲求に含む。TALK 欲求は会話で持ち出すもので
 *      検索仕事にはならないため、キューには載せない（P3002 の範囲）。
 *   3. きりあ本人の未解決宿題（Working Agenda 由来）を次に置く。
 *   4. CRITICAL でない能力ギャップ。
 *   5. 蒸留・反省・ドリル（進化サイクルのサブシステム）。
 * 同じ段の中では優先度（欲求の強さ・影響度・誤差量を 0..1 に
 * 正規化したもの）の降順。同点は収集順を保つ（安定ソート）。
 */

export type IdleWorkKind =
  | 'RESEARCH_GAP'
  | 'HOMEWORK'
  | 'CAPABILITY_GAP'
  | 'DISTILL'
  | 'REFLECT'
  | 'DRILL';

export type IdleWorkOrigin =
  | 'desire'
  | 'homework'
  | 'capability_gap'
  | 'prediction_error'
  | 'episode'
  | 'weakness';

export interface IdleWorkItem {
  kind: IdleWorkKind;
  /** 表示用の話題。検索系は query に検索クエリを持つ。 */
  topic: string;
  origin: IdleWorkOrigin;
  /** 0..1。高いほど先に選ばれる。 */
  priority: number;
  /** 能力ギャップの場合の影響度。CRITICAL だけが割り込み可。 */
  impact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 24時間の同一未検証検索など、既存の抑制に当たっているか。 */
  suppressed: boolean;
  /** 検索系のクエリ（検索系以外は未設定）。 */
  query?: string;
  /** 参照先のID（ギャップは capabilityId、宿題は agenda id）。 */
  refId?: string;
}

/** 種別ごとの1サイクルあたりの件数上限（現行の固定上限をそのまま引き継ぐ）。 */
export const IDLE_WORK_LIMITS: Record<IdleWorkKind, number> = {
  RESEARCH_GAP: 2,
  HOMEWORK: 2,
  CAPABILITY_GAP: 3,
  DISTILL: 1,
  REFLECT: 1,
  DRILL: 1,
};

/** 検索系の仕事の抑制に使う triggerType（autonomousSearchService と同じ語彙）。 */
export type IdleResearchTriggerType = 'working_agenda' | 'capability_gap' | 'research_gap';

export function idleResearchTriggerFor(kind: IdleWorkKind): IdleResearchTriggerType {
  if (kind === 'HOMEWORK') return 'working_agenda';
  if (kind === 'CAPABILITY_GAP') return 'capability_gap';
  return 'research_gap';
}

/**
 * 優先順位の段。数字が小さいほど先に選ばれる。
 * 決定 #6: CRITICAL ギャップの割り込み > 欲求由来 > 宿題 >
 * 非 CRITICAL ギャップ > 蒸留・反省・ドリル。
 */
export function idleWorkTier(job: IdleWorkItem): number {
  if (job.kind === 'CAPABILITY_GAP' && job.impact === 'CRITICAL') return 0;
  if (job.origin === 'desire') return 1;
  if (job.kind === 'HOMEWORK') return 2;
  if (job.kind === 'CAPABILITY_GAP') return 3;
  return 4;
}

/**
 * 選択器（純関数）。抑制中の仕事を落とし、段→優先度の順に並べ、
 * 種別ごとの件数上限で切る。P898 の rankCapabilityGapsForLearning
 * と同じやり方で、単体で検証できる。
 */
export function selectIdleWork(
  jobs: IdleWorkItem[],
  limits: Record<IdleWorkKind, number> = IDLE_WORK_LIMITS,
): IdleWorkItem[] {
  const counts: Partial<Record<IdleWorkKind, number>> = {};
  return jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !job.suppressed)
    .sort(
      (a, b) =>
        idleWorkTier(a.job) - idleWorkTier(b.job) ||
        b.job.priority - a.job.priority ||
        a.index - b.index,
    )
    .filter(({ job }) => {
      const next = (counts[job.kind] || 0) + 1;
      if (next > (limits[job.kind] ?? 0)) return false;
      counts[job.kind] = next;
      return true;
    })
    .map(({ job }) => job);
}

/** 検索系の仕事だけを取り出す。 */
export function isIdleSearchJob(job: IdleWorkItem): boolean {
  return job.kind === 'RESEARCH_GAP' || job.kind === 'HOMEWORK' || job.kind === 'CAPABILITY_GAP';
}

/** 進化サイクルのサブシステムへ回す仕事だけを取り出す。 */
export function isIdleEvolutionJob(job: IdleWorkItem): boolean {
  return job.kind === 'REFLECT' || job.kind === 'DISTILL' || job.kind === 'DRILL';
}

class IdleWorkQueueService {
  /**
   * 各系統から候補を集めて1つの待ち行列にする。各系統の読み取りが
   * 失敗しても他の系統は止めない（本流はキューが空でも回る）。
   * 抑制は既存の24時間未検証検索の抑制を流用し、構築時に判定する。
   * 実行時にも autonomousSearchService 側で再確認する。
   */
  public buildIdleWorkQueue(personaId: string): IdleWorkItem[] {
    const jobs: IdleWorkItem[] = [];

    // RESEARCH_GAP: LEARN 欲求（知りたい・できるようになりたい）から。
    // TALK 欲求は会話で持ち出すもので、検索仕事にはしない。
    try {
      for (const desire of desireService.compose(personaId)) {
        if (desire.kind !== 'LEARN') continue;
        const query = desire.term.slice(0, 50).trim();
        if (!query) continue;
        jobs.push({
          kind: 'RESEARCH_GAP',
          topic: desire.term,
          origin: 'desire',
          priority: desire.strength,
          suppressed: autonomousSearchService.isSuppressedForIdleResearch(query, 'research_gap'),
          query,
          refId: desire.term,
        });
      }
    } catch { /* 欲求が読めなくても本流は止めない */ }

    // HOMEWORK: Working Agenda の未解決宿題。クエリの組み立ては
    // 従来の performIdleAutonomousLearning と同じ形。
    try {
      for (const hw of workingAgendaService.getHomeworkForAutonomousThought()) {
        const subQuery = (hw.unresolvedQuestions && hw.unresolvedQuestions[0]) || hw.topic;
        const query = `${hw.topic} ${subQuery}`.replace(/[\n\r]/g, ' ').slice(0, 50).trim();
        if (!query) continue;
        jobs.push({
          kind: 'HOMEWORK',
          topic: String(hw.topic || ''),
          origin: 'homework',
          priority: hw.priority === 'high' ? 0.8 : hw.priority === 'low' ? 0.3 : 0.5,
          suppressed: autonomousSearchService.isSuppressedForIdleResearch(query, 'working_agenda'),
          query,
          refId: hw.id,
        });
      }
    } catch { /* 宿題が読めなくても本流は止めない */ }

    // CAPABILITY_GAP: OPEN の能力ギャップ。影響度を優先度に写す。
    try {
      for (const gap of capabilityGapService.getAllGaps().filter((g) => g.status === 'OPEN')) {
        const query = `${gap.capabilityId} ${gap.description || ''}`
          .replace(/[\n\r]/g, ' ')
          .slice(0, 40)
          .trim();
        if (!query) continue;
        const priority =
          gap.impact === 'CRITICAL' ? 1 : gap.impact === 'HIGH' ? 0.75 : gap.impact === 'MEDIUM' ? 0.5 : 0.25;
        jobs.push({
          kind: 'CAPABILITY_GAP',
          topic: String(gap.capabilityId || ''),
          origin: 'capability_gap',
          priority,
          impact: gap.impact,
          suppressed: autonomousSearchService.isSuppressedForIdleResearch(query, 'capability_gap'),
          query,
          refId: gap.capabilityId,
        });
      }
    } catch { /* ギャップが読めなくても本流は止めない */ }

    // REFLECT: 予測誤差 0.35 以上の記録があるときだけ出す
    // （進化サイクル#1 executeCounterfactualReflections と同じ閾値）。
    try {
      const errors = worldModelService.getErrorRecords();
      const worst = errors.reduce(
        (max, rec) => Math.max(max, rec.predictionError ? rec.predictionError.errorMagnitude || 0 : 0),
        0,
      );
      if (worst >= 0.35) {
        jobs.push({
          kind: 'REFLECT',
          topic: 'prediction_error',
          origin: 'prediction_error',
          priority: Math.min(1, worst),
          suppressed: false,
        });
      }
    } catch { /* 誤差が読めなくても本流は止めない */ }

    // DISTILL / DRILL: サブシステム側が自己ゲートする（蒸留は固定
    // ルールの有無、ドリルは接続済みカテゴリのみ）ため、常に1件
    // ずつ低優先度で出す。選ばれなければ実行されない。
    jobs.push({
      kind: 'DISTILL',
      topic: 'heuristic_distillation',
      origin: 'episode',
      priority: 0.2,
      suppressed: false,
    });
    jobs.push({
      kind: 'DRILL',
      topic: 'mastery_drill',
      origin: 'weakness',
      priority: 0.2,
      suppressed: false,
    });

    return jobs;
  }
}

export const idleWorkQueueService = new IdleWorkQueueService();

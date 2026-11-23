import { userActivityService } from '../../../services/userActivityService';
import { taskBlackboardService } from './taskBlackboardService';

/**
 * P2005: 会話優先の判定と、メインスレッド時間予算。
 *
 * 実機（2026-11-23、P2004 導入直後）で、起動直後の取り込みが
 * 捌けた後も自律ループが未知語の調査を回し続け、会話画面で
 * 送信を押すたびに UI が固まった。背景タスクの譲り判定は
 * CORE のサイクル境界にしか無く、1サイクルの中身（調査1回分
 * ＝検索＋ページ読み＋グラフ構築＋Claim 登録の連鎖）は丸ごと
 * 同期的に走り切っていた。ここに「会話が優先されるべき状態
 * か」の単一の判定口と、同期処理を細切れにする時間予算を置き、
 * 自律ループの実行開始ゲートと調査内部の譲りが同じ物差しを
 * 共有する。
 *
 * 「最近の活動」の窓は backgroundWorkerService の
 * USER_ACTIVE_COOLDOWN_MS（60秒）と揃える。刻まれる活動は
 * 会話に紐づくものだけ（userActivityService 参照）。
 */
export const CONVERSATION_ACTIVITY_WINDOW_MS = 60_000;

export const conversationPriorityService = {
  /**
   * 会話が優先されるべき状態か。いずれか1つでも当てはまれば
   * true：会話画面が開いている／会話の応答生成中／直近60秒に
   * 会話側の活動があった／前景（ユーザー要求）のタスクが
   * 黒板で進行中。
   */
  isConversationPriorityActive(): boolean {
    if (userActivityService.isConversationScreenOpen()) return true;
    if (userActivityService.isConversationBusy()) return true;
    if (userActivityService.isRecentlyActive(CONVERSATION_ACTIVITY_WINDOW_MS)) return true;
    return taskBlackboardService.hasActiveForegroundTask('');
  },
};

/** イベントループへ1回返す（描画と入力処理を通す）。 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => { setTimeout(resolve, 0); });
}

/**
 * 同期処理の時間予算。生成時点から limitMs を超えたら
 * yieldIfExceeded がイベントループへ返し、呼び出し側は
 * ループの合間にこれを挟むことで、1回の占有が上限を超えて
 * 連続しないようにする（実機の固まりは数十秒級の同期占有が
 * 主因だったため、上限は描画フレームより少し緩い 24ms）。
 */
export class MainThreadBudget {
  private windowStartedAt = Date.now();

  constructor(private readonly limitMs: number = 24) {}

  exceeded(now: number = Date.now()): boolean {
    return now - this.windowStartedAt >= this.limitMs;
  }

  /** 予算を超えていたらイベントループへ返し、窓を張り直す。返したら true。 */
  async yieldIfExceeded(): Promise<boolean> {
    if (!this.exceeded()) return false;
    await yieldToEventLoop();
    this.windowStartedAt = Date.now();
    return true;
  }
}

/**
 * P2005: ユーザー活動の葉レジストリ（依存ゼロ）。
 *
 * 会話が彼女の主目的なので、自律側の重い仕事（調査ラウンド・
 * 一括学習・検証バッチ）は「会話が今まさに使われている」間は
 * 開始しない／譲る必要がある。その判定材料は各所に散らばって
 * いた（backgroundWorkerService の lastUserActivityTimestamp、
 * App の mobileTab、生成中フラグ、黒板の前景タスク）。判定側が
 * それら全部を import すると循環が起きるため、記録だけを行う
 * 依存ゼロの葉をここに置き、書き手はここへ刻み、読み手
 * （conversationPriorityService）はここだけを見る。
 *
 * 刻まれるのは会話に紐づく活動だけ。一般のタッチ検知
 * （backgroundWorkerService のアイドル検知）は刻まない。改善
 * 画面など会話以外の操作で自律ループが止まり続けるのを避ける
 * ためである。
 */
let lastActivityAtMs = 0;
let conversationScreenOpen = false;
let conversationBusy = false;

export const userActivityService = {
  /** 会話側のユーザー活動（送信など）を刻む。 */
  recordUserActivity(now: number = Date.now()): void {
    lastActivityAtMs = now;
  },

  lastActivityAt(): number {
    return lastActivityAtMs;
  },

  /** 直近 windowMs 以内に会話側の活動があったか。 */
  isRecentlyActive(windowMs: number, now: number = Date.now()): boolean {
    return lastActivityAtMs > 0 && now - lastActivityAtMs < windowMs;
  },

  /** 会話画面が開いているか（App のタブ状態から刻む）。 */
  setConversationScreenOpen(open: boolean): void {
    conversationScreenOpen = open;
  },

  isConversationScreenOpen(): boolean {
    return conversationScreenOpen;
  },

  /** 会話の応答生成中か（backgroundWorkerService.setChatGenerating から刻む）。 */
  setConversationBusy(busy: boolean): void {
    conversationBusy = busy;
  },

  isConversationBusy(): boolean {
    return conversationBusy;
  },
};

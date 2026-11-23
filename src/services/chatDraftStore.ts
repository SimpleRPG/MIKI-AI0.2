/**
 * P2006: 会話入力の下書き保持（依存ゼロの葉）。
 *
 * 会話画面（ChatPanel）はモバイル表示ではタブ切り替えで
 * アンマウントされ、コンポーネント内の useState だけでは
 * 打ちかけの下書きが消えた。下書きの正本をモジュールレベルに
 * 置き、再マウントでは正本から復元される。永続化はしない：
 * アプリ再起動を跨いで下書きを残す必要はなく、キー入力ごとの
 * 保存のような重い処理も入れない（メモリ上の保持のみ）。
 *
 * P2009: 入力欄は非制御（defaultValue で初期値だけ渡す）。
 * 制御コンポーネント（value={state}）では、再描画のたびに React が
 * DOM の現在値と state 値を突き合わせ、異なれば state 値を DOM へ
 * 書き戻す。IME 変換中は DOM に変換文字列が入る一方 state は
 * 確定まで追いつかないことがあり、その書き戻しが変換を破棄して
 * いた（実機 2026-11-23：入力中に文字が出ない／打った文字が
 * 消える。P2006 の state 経由の写しでも解消しなかった）。
 * 非制御化すると再描画は入力欄の DOM 値に一切触れず、変換は
 * React の管轄外で完結する。下書き同期は入力欄の onChange から
 * ここへ直接書く（state を経由しないのでキー入力で再描画も
 * 起きない）。クリアは送信成功時に handleSend が呼ぶ場合のみ。
 */
let draftText = '';

export const chatDraftStore = {
  /** 現在の下書き（再マウント時の初期値）。 */
  getDraft(): string {
    return draftText;
  },

  /** 下書きを写す（入力変更のたびに呼ばれる軽い代入のみ）。 */
  setDraft(text: string): void {
    draftText = text;
  },

  /** 下書きを空にする。 */
  clearDraft(): void {
    draftText = '';
  },

  /**
   * プログラム側からの入力セット（音声入力・提案挿入・修復依頼等）。
   * 正本と入力欄の DOM 値を同時に更新する同期点。入力欄が
   * 非制御のため、DOM への直接代入が唯一の反映経路になる。
   * 引数は DOM 型に依存しない形（{ value } だけ）にして葉を保つ。
   */
  applyProgrammaticText(target: { value: string } | null, text: string): void {
    draftText = text;
    if (target) {
      target.value = text;
    }
  },
};

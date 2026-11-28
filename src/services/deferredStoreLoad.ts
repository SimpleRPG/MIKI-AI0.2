import { storageService } from './storageService';

/**
 * P3022: ストアの「権威ある初回読み込み」を storageService の初期化
 * 完了に合わせるための共有機構（FUSION_DESIGN F1 の中核）。
 *
 * 背景: 各ストアはコンストラクタで同期的に storageService.getItem を
 * 読む。モジュール import がストレージ初期化（IndexedDB ハイドレー
 * ション）より先に走る起動では、実在するキーでも null が返り、
 * 「空＝新規インストール」と誤認したシード投入＋全体保存が実データ
 * を上書きしてきた（P3020/P3021 の存在シグナルガードは、シグナル
 * 自体が未ハイドレーションの起動では盲目になる。2026-11-28 の
 * P3021 デプロイ中に主張ストアで 4 回目・5 回目が発火）。
 *
 * 方針（設計どおり）: 読み取りを待たせるのではなく、「権威ある読み
 * 込みが済むまで破壊を不可能にする」。
 * - 権威ある状態になるまで、ストアは provisional（空）の像で動き、
 *   シード投入も全体保存も行わない。
 * - 権威ある状態になった瞬間に、各ストアが自分の初回読み込み手順
 *   （存在シグナルガードを含む従来手順）をそのまま実行する。
 * - 保留中に受けた登録等は provisional 像に残り、権威ある読み込み
 *   の合体ステップで実データ側へ取り込まれる（各ストア側の実装）。
 *
 * 「権威ある状態」の定義:
 * - storageService.ready が解決済み、かつ
 * - backend が 'memory' の場合は P3009 の遅延アップグレードが武装
 *   されていないこと。武装中は実ストアが裏で読み込み中かもしれず、
 *   「新規」と誤認してシードするとアップグレード時のフラッシュで
 *   実データを上書きする。アップグレードの決着（成功／断念）は
 *   storageService.onBackendUpgradeSettled で通知される。
 *
 * この機構は起動時の読み取りを一切追加しない（判定はフラグのみ、
 * 権威ある読み込みが読むキーは従来コンストラクタが読んでいたもの
 * と同一）。P3009/P3010 の起動プロファイルは不変。
 */
export function isStorageAuthoritativeNow(): boolean {
  if (!storageService.isReadySettled()) return false;
  if (
    storageService.getBackendName() === 'memory' &&
    storageService.isBackendUpgradePending()
  ) {
    return false;
  }
  return true;
}

/**
 * 権威ある状態になったら cb を一度だけ呼ぶ。既に権威ある状態なら
 * 同期的に呼んで true を返す。そうでなければ ready の解決と遅延
 * アップグレードの決着の両方を購読し、権威ある状態になった時点で
 * 呼んで false を返す。
 */
export function runWhenStorageAuthoritative(cb: () => void): boolean {
  if (isStorageAuthoritativeNow()) {
    cb();
    return true;
  }
  let fired = false;
  const fire = (): void => {
    if (fired) return;
    if (!isStorageAuthoritativeNow()) return;
    fired = true;
    cb();
  };
  storageService.onBackendUpgradeSettled(fire);
  void storageService.ready.then(fire);
  return false;
}

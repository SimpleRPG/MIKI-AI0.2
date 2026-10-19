# MIKI-AI0.2 P292 追加監査レポート

基準: P291作業ZIPの実ソースと統合設計正本。GitHub mainとの同期・pushは行っていない。

## 確定した追加不具合

`src/miki/selfDevelopment/services/productionScaleWorkerService.ts` と `durableJobWorkerRuntimeService.ts` の取消経路。

- 実行中のジョブに `cancel()` が呼ばれると `CANCELLING` になるが、実行中の `await runtimeWorkspaceHostAdapterService.execute(...)` が返った後に取消状態を再確認せず、成功したビルドを `COMPLETED` と記録できた。
- 失敗・例外時は、取消済みジョブが `RETRYING` に戻り再実行される可能性があった。
- 再起動回復時も、期限切れの `CANCELLING` を `RETRYING` または `FAILED` に変えていた。

## P292修正

- `CANCELLED` を永続ジョブ状態へ追加。
- 実行await後に保存済み状態を再確認し、取消済みなら成功証明を出さず `CANCELLED` で終端化。
- 例外経路と再起動回復経路も取消を優先し、再試行させない。
- P292の統合設計正本、検証スクリプト、ソース関係台帳を更新。

## 検証

- 取消経路のソース契約検査: 5/5 PASS。
- P291 CORE自律実行回帰: 19/19 PASS。
- Blackboard破損snapshot検査: 4/4 PASS。
- Runtime failure回帰: 153/153 PASS。
- LoRA退役検査: 34/34 PASS。
- P292 source relation ledger: 1,787パスのSHA-256/行数一致、3,814静的import辺、719静的到達可能ソース、37互換ファサード、重複パス0件。
- 変更した2 TypeScriptファイルのNode構文検査: PASS。

## 未検証

- 実行中の取消とworker完了が競合する実時間E2E。
- 全体TypeScript型検査、Vite build、Android build/APK、Galaxy S25実機テスト。
- Android IndexedDB永続化での長時間・強制終了復旧。
- `adaptiveRoutePlannerService` の完全なPlanner E2E（ZIP内の依存 `jszip` 不在でロードできない環境）。
- GitHub mainへの同期・commit・push。

P292は実ソースを含む作業ZIPであり、GitHub mainへ反映済みとは扱わない。

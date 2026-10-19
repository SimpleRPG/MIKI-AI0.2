# MIKI-AI0.2 P291 — CORE自律実行の再調査・修正報告

**基準:** P290 ZIP作業スナップショット。GitHub `main` には同期していません。

## 確定した問題と修正

### 1. Review Packageの誤必須化 — P0
`src/miki/core/services/coreCompletionGateService.ts` のAdaptive完了判定は、計画に `CREATE_REVIEW_PACKAGE` がないタスクでも同操作の完了を要求していました。計画が明示的に要求した場合のみ必須にし、要求済みPackageの未完了は既存のmissing-operation判定で拒否するよう修正しました。

### 2. 成功済みResearchの再投入 — P0
`src/miki/core/services/adaptiveRoutePlannerService.ts` に `EXECUTE_AUTONOMOUS_SEARCH` を処理する分岐が2か所あり、成功済み `RUN_RESEARCH` の後も初回検索へ戻る経路がありました。両分岐を「成功結果がまだない場合だけ初回実行」に限定し、結果がある場合は共通の継続調査・検証判定へ流すよう変更しました。継続検索は既存の `continuationAvailable` と `gapId` による判断を維持します。

### 3. 過去ERRORの未解決扱い — P0
完了判定がタスク履歴の `ERROR` を無条件で未解決と扱っていました。監査履歴は残したまま、後続の成功結果が同一operation instanceを完了した場合、または明示的に失敗instanceをsupersedeした場合だけ解消済みと判定する `unresolvedTaskErrors` を追加しました。再試行にはtarget・command・query・gap・intent由来の `operationScopeKey` を付け、別の検索結果で違う失敗を解消した扱いにしないようにしています。operation instanceを特定できないERRORはfail-closedのままです。

### 4. 回答検証前の成功確定 — P0
`coreTaskIngressService` はP216の意味保持・実行整合性・文法検証の結果をCORE最終化へ渡すよう変更しました。`conversationFinalResponse` を記録し、タスクを `COMPLETED` とし、成功Outcomeを記録するのは、P216検証とCORE完了ゲートの両方が通った場合だけです。P216失敗は `FAILED`、回答は妥当でもタスクの完了条件が未達なら `PAUSED/WAITING` になります。

### 5. Blackboard破損時の元データ上書き — P1
`taskBlackboardService.load()` はJSON解析失敗時にメモリ上のタスクを空にし、後続の保存が元データを上書きする可能性がありました。JSON破損、配列以外のsnapshot、不正task/entryを拒否し、元データを別のquarantine keyに保存して読み戻し照合します。隔離が成功するまで通常保存を許可せず、隔離自体が失敗した場合はそのプロセスの保存をブロックします。これは元データ保全であり、壊れたJSONからの自動レコード復元を意味しません。

## 検証結果

| 検査 | 結果 |
|---|---:|
| 統合ソース台帳 | 1,787件すべてのSHA-256・行数一致 | PASS |
| 静的依存グラフ | 3,814辺、到達可能719、重複パス0 | PASS |
| CORE自律回帰契約 | 19項目 | PASS |
| Blackboard破損データ隔離テスト | 4項目 | PASS |
| 既存Runtime Failure回帰検査 | 153項目 | PASS |
| LoRA退役検査 | 34項目 | PASS |
| 変更対象TypeScript構文検査 | 5ファイル | PASS |

`storageService` は検査環境でIndexedDBを利用できず、メモリfallbackを使用しました。既存153項目の回帰検査は、プロジェクト内 `node_modules` がないためグローバルTypeScriptを解決する検査用loaderで実行しています。

## 未確認事項

- 全体TypeScript型検査、Vite本番build、Android Gradle build/APK
- Plannerを含む全サービスの実行時E2E（依存する `jszip` が作業ZIPにないため未実施）
- Galaxy S25実機での会話・長時間自律処理・強制終了後の復旧
- GitHub `main` への同期、commit、PUSH

したがって、P291はソース修正と限定的な回帰検証を完了した作業ZIPであり、ビルド成功や実機での自律完遂まで証明したものではありません。

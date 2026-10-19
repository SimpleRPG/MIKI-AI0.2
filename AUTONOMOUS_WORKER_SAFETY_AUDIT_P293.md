# MIKI-AI0.2 自律Worker安全監査 — P293

## 確定したコード問題と修正

| 領域 | 問題 | 修正 |
|---|---|---|
| Durable Job状態機械 | 任意状態へ遷移でき、終端ジョブを再開できる | 明示的遷移表、終端保護、取消冪等化 |
| Worker実行競合 | await中に変わった状態を遅着結果で上書きできる | await後に状態再照合し、RUNNING以外の状態を上書きしない。成功証明もRUNNING時だけ |
| 依存ジョブ | 依存先の失敗・取消後も待機ジョブがQUEUEDに残り続ける | 依存先失敗を検知してBLOCKEDへ伝播 |
| Lease／資源・ID | 非RUNNINGや期限切れleaseでもheartbeatでき、資源値検証と同一ミリ秒のID衝突防止がない | owner・状態・期限・TTL・resource・retry budgetを検証し、enqueue連番をIDへ含める |
| 永続履歴 | 破損JSONを空配列として扱い、唯一の履歴を上書きする可能性 | raw bytes隔離、読み戻し検証、隔離失敗時の書込み停止 |
| Durable Job snapshot | 不正snapshotが空キュー扱いになる | snapshot形状検証と隔離 |

## 検証結果

- Worker安全性: 9項目 PASS
- 取消回帰: 5項目 PASS
- CORE自律実行回帰: 19項目 PASS
- Blackboard破損保護: 4項目 PASS
- LoRA退役: 34項目 PASS
- 台帳: 1,787/1,787 SHA-256・行数照合、3,814静的import辺、719静的到達ソース、37互換ファサード、重複パス0件
- TypeScript構文解析: 6/6 PASS
- ZIP整合性: 1,838項目、`testzip()` PASS、展開後の統合検証 PASS

## 未検証の境界

- Node環境にIndexedDBがなく、保存検査はin-memory fallbackで実行。Android永続化の証明ではない。
- 全体TypeScript型検査、Vite build、Android Gradle/APK、Galaxy S25実機、強制終了後の復旧、長時間Worker E2Eは未実施。
- GitHub mainとの同期、commit/PUSHは未実施。
- 台帳は既存1,787パスの固定基準を維持。全tree再帰インベントリを再集計したとは主張しない。

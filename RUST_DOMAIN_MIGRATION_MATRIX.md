# MIKI 17分類 Rust移行表

## 固定原則

- Coreは唯一の統括権限を維持する。
- Rustは18番目の分類ではない。
- 分類内部のRust処理は `Core -> 分類 -> Rust Kernel -> 同じ分類 -> Core` を通る。
- Rust KernelはBlackboardや他分類を直接更新しない。
- 移行後は所有分類、JNI入口、Receipt、検証スクリプトを必須とする。

| 順位 | 分類 | Rust移行対象 | TypeScript/Kotlinに残す責務 | 状態 |
|---:|---|---|---|---|
| 1 | verification | VBA字句・構造検査、禁止構文、SHA、Manifest、証拠整合 | 検証方針、結果統合、Core返却 | COMPLETED_PHASE42 |
| 2 | data | 正規化、大量走査、重複排除、索引、JSON検査 | データ利用方針、分類間調整 | COMPLETED_PHASE44 |
| 3 | execution | DAG、循環検出、依存、状態遷移、Timeout、Receipt | Android実行、WorkManager、開始停止 | COMPLETED_PHASE45 |
| 4 | memory | N-gram索引、一次検索、類似度、重複、Revision比較 | 記憶採否、永続化方針、会話反映 | COMPLETED_PHASE46 |
| 5 | selfDevelopment | Candidate差分、要求追跡、契約検査、構造比較 | 改善方針、候補採否、評価連携 | COMPLETED_PHASE47 |
| 6 | promotion | Manifest、採用Gate、Hash、Rollback条件 | 正式採用状態、監査通知 | COMPLETED_PHASE48 |
| 7 | unknown | 未知語抽出、略語分離、候補順位、信頼度 | 未知扱いの最終判断 | COMPLETED_PHASE48 |
| 8 | research | 候補統合、重複除外、根拠スコア、不足分類 | 調査方針、取得元選択 | COMPLETED_PHASE48 |
| 9 | learning | 学習差分、成功率、失敗パターン、規則候補集計 | 学習採否、失効管理 | COMPLETED_PHASE48 |
| 10 | strategy | 選択肢評価、コスト、優先順位 | 戦略の最終選択と説明 | COMPLETED_PHASE48 |
| 11 | capability | 部品索引、互換性、依存、重複能力 | 能力追加判断、登録 | COMPLETED_PHASE48 |
| 12 | improvement | 改善効果、回帰比較、候補順位 | 改善開始停止、採用判断 | COMPLETED_PHASE48 |
| 13 | autonomy | Goal比較、期限、競合、依存、停止条件 | 自走開始停止、介入判断 | COMPLETED_PHASE48 |
| 14 | selfAwareness | 状態集計、矛盾検出、能力境界 | 意味付け、説明 | COMPLETED_PHASE48 |
| 15 | experience | 成功率、失敗率、頻度、履歴パターン | 経験の意味付け、会話反映 | COMPLETED_PHASE48 |
| 16 | safety | 規則照合、禁止条件、権限Gate、パス安全 | 説明、確認UI、Android権限 | COMPLETED_PHASE48 |
| 17 | conversation | 形態素、否定、数量、因果、照応候補、履歴索引 | 会話目的、最終判断、回答構成、表示 | COMPLETED_PHASE48 |

## 既存Rust移行の所有権監査

- Goal競合・優先順位: Core所有Rust Kernel。17分類を迂回しない。
- 17分類Route整列・重複排除: Core所有Rust Kernel。分類の業務結果は確定しない。
- Hash、ZIP、Workspace走査、差分: execution/data/verificationから利用する共有Rust基盤。
- 今後の分類固有処理は `native/miki-native-core/src/domains/<domain>/` に配置する。

# 判断結果の遅延評価・後悔学習

設計思想8.4に従い、判断は即時成功だけで確定評価しない。

- `IMMEDIATE` / `SESSION_END` / `NEXT_USE` / `SHORT_TERM` / `LONG_TERM`
- `SUCCESS` / `SUBOPTIMAL` / `FAILURE`
- 原因: `DECISION_ERROR` / `INFORMATION_GAP` / `ENVIRONMENT_DRIFT` / `PREFERENCE_CHANGE` / `IMPLEMENTATION_ERROR` / `COMPOSITION_ERROR` / `TEST_GAP`

失敗結果は判断ロジック全体の失敗とはみなさず、原因に応じて検索・評価軸・部品・テスト・環境・嗜好・構成のどこを改善するかへ分類する。

`DecisionLearningService` は観測と改善候補化のみを担当し、安全基準・監査・権限・ロールバック規則を自動変更しない。

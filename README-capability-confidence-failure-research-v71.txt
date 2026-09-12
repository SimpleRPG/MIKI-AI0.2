MIKI-AI0.2 v71 — Capability Confidence + Failure Web Research

目的:
- 成功/失敗率、検証状態、環境一致、実装hash、経験鮮度、失敗リスクを統合して能力の信頼度を自動評価。
- 信頼度はComponentのVERIFIED状態を直接変更せず、Capability Graphのランキングに安全に反映する。
- 古い証拠・実装hash変更・高失敗リスクは再検証要求へ送る。
- 実行失敗をKnowledge Gapへ自動変換し、WEB_SEARCHを明示してEvidence → Claim → Verifier境界へ送る。

追加:
- src/services/capabilityConfidenceService.ts
- src/services/failureUnderstandingService.ts
- scripts/test_capability_confidence_v71.mjs

API:
- GET /api/miki/capability-confidence?componentId=...
- GET /api/miki/capability-confidence/relevant?q=...
- GET /api/miki/failure-understanding

安全境界:
- local LLM runtimeを追加しない。
- eval / new Function / Math.random を新規コードで使用しない。
- Web検索だけでは事実確定しない。既存Verifierの昇格条件を通過したものだけが解決扱いになる。
- 古い成功実績を現在の事実として自動採用しない。

検証:
- scripts/test_capability_confidence_v71.mjs の静的回帰テストを実行。
- npm run lint は依存関係未導入のため既存プロジェクトエラーで完走できない場合がある。

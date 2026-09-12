# MIKI-AI 第13.3節 移管証拠ゲート v49

## 目的
LLM機能を非LLMへ移管する際、想定値や固定値ではなく、実測したシャドー比較だけを根拠に昇格判定する。

## 今回の実装
- `ShadowComparisonRecord` に任意の `naturalnessScore` と `userCorrection` を追加。
- `runShadowComparison()` が実測値をそのまま記録し、自然さ未計測を推測で補完しない。
- ユーザー訂正率を履歴全体から再集計するよう修正。
- `evaluatePromotion()` を追加し、証拠から次の状態を判定する。
  - 3件以上 / accuracy 95%以上 / determinism 95%以上 → `NON_LLM_LIMITED` 候補
  - 10件以上 / accuracy 98%以上 / determinism 99%以上 / correction 2%以下 → `NON_LLM_DEFAULT` 候補
  - 条件不足 → `SHADOW_COMPARISON`
- 判定APIは自動昇格を行わず、不足条件を明示する。

## 検証
`scripts/test_llm_migration_evidence.ts` に10件の合成テストを追加。これは本番性能値ではなく、集計ロジックの回帰試験である。

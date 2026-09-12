# MIKI Test Assertion Protocol v1

## Purpose

`ExecutionRunnerService` の `passed` はRunnerの自己申告であり、Promotionの最終根拠ではない。
`TestAssertionService` が期待条件と実測結果を決定論的に比較し、`PASS / FAIL / INCONCLUSIVE` を返す。

## Explicit assertions

`expected_summary` に以下を指定できる。

- `ASSERT: CONTAINS "text"`
- `ASSERT: NOT_CONTAINS "text"`
- `ASSERT: EQUALS "text"`
- `ASSERT: REGEX "pattern"`
- `ASSERT: NON_EMPTY`
- `ASSERT: EMPTY`

明示的Assertionは自然言語より優先される。

## Conservative natural-language rules

安全に機械判定できる限定的な表現だけを扱う。

- 「正常終了」系: 非空かつエラー/失敗マーカーがない → PASS
- 「空であること」系: 空出力 → PASS
- 「非空」系: 非空出力 → PASS
- 「安全に失敗」「失敗すること」「拒否すること」系: エラー/失敗を示す結果 → PASS
- それ以外 → INCONCLUSIVE

意味論が必要な `postconditions` などは推測でPASSにしない。

## Gate behavior

- `PASS` → `ExecutionEvidence` を検証対象として登録し、通常のDEVICE_TESTED経路へ進む
- `FAIL` → 実行失敗として扱う
- `INCONCLUSIVE` → 実行自体は受領するが、検証成功とは扱わず、RegressionをBLOCKEDへ収束させる

`INCONCLUSIVE` は「失敗」と「成功」を混同しないための状態であり、Promotionには使用できない。

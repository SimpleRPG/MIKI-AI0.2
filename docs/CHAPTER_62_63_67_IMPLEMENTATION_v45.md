# MIKI-AI0.2 第62・63・67章 実装 v45

## 第62章 Knowledge OS
- Source / Claim / Evidence / Concept / Relation / Procedure / Condition / Counterexample / EvaluationQuestion を独立オブジェクト化。
- 出典、根拠、依存、置換、適用条件、信頼度、鮮度を保持。
- provenanceAudit は不足リンクを報告するだけで、真実への自動昇格はしない。
- 鮮度再計算を分離し、大量再索引は将来の充電中ジョブへ接続可能。

## 第63章 Counterfactual Work Simulator
- 実採用経路と未採用候補を仮想比較。
- FAILURE / HIGH_COST / IMPORTANT の場合だけ実行。
- 結果は VIRTUAL_ONLY であり、仮想結果だけで実行経路や記憶を自動変更しない。

## 第67章 Personal API
- NATURAL_LANGUAGE / REST / ANDROID_INTENT / FILE / SCHEDULE を共通入口へ正規化。
- RequestTypeCompilerService を通し、認証・権限・プライバシー境界・監査を共通化。
- REST は既定で LOCAL_TRUSTED の明示トークンなしでは受理しない。
- Android Intent は権限情報なしでは受理しない。

## 検証方針
実機検証は行わない。決定論的な契約テストのみ追加し、最終実装完了後に実機/PC E2E を行う。

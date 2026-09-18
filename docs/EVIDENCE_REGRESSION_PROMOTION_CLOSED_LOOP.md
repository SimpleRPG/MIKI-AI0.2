# Evidence → Regression → Promotion 閉ループ

設計思想9.3/13.5の検証境界を明示する。

1. Component Registryのversion/hashを固定
2. 同一version/hashのimmutable TXT artifact snapshotを固定
3. tests_txtからTest Caseを決定論的に生成
4. Test CaseごとにExecution Requestを発行
5. Runner結果をAssertion EngineでPASS/FAIL/INCONCLUSIVEへ正規化
6. PASSだけをadmissible execution evidenceとして扱う
7. Regression Suiteはcase/request/evidence/artifact/hash/environmentを全件照合
8. Promotion GateはRegression PASS以外を拒否
9. `DEVICE_TESTED -> VERIFIED` 以外の直接昇格を禁止

`INCONCLUSIVE` は「成功」ではなくBLOCKEDとして扱う。シミュレーション、自己採点、単なるコード生成、Web検索結果だけではこの閉ループを完了できない。

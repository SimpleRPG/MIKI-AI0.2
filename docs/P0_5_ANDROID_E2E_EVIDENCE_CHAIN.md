# P0-5 Android実機E2E Evidence Chain

## 目的
設計思想の「実装・テスト定義・検証結果を混同しない」をAndroid Native実機でも維持する。

## 経路
```text
Component ANALYZED
 -> Regression Test Case
 -> ExecutionRequest
 -> MIKINativeRunnerPlugin
 -> allow-list adapter
 -> Sudachi 0.8.1 + SudachiDict 20260723-core
 -> Assertion: EQUALS SUDACHI_SELFTEST_PASS
 -> Execution Evidence
 -> DEVICE_TESTED
 -> Canary
 -> VERIFIED
```

`android.japanese_morphology_selftest` は実機測定前にはANALYZEDのまま。Native Runnerの自己申告 `passed` だけでは昇格しない。

## 安全境界
- arbitrary shell/process/eval/networkは実行しない。
- adapterはNative側allow-listのみ。
- implementation hash / artifact snapshot / test case / environmentをJS側で照合する。
- Assertion PASSがEvidenceの必須条件。
- 実機未実施をDEVICE_TESTED/VERIFIEDと記録しない。

## CI
GitHub Actionsは `scripts/install_android_japanese_morphology.sh` により、Sudachi Java 0.8.1とSudachiDict core 20260723を固定取得し、MainActivityへ両Native Pluginを登録する。辞書SHA-256も固定する。

## 未完了
このリポジトリ変更だけではGalaxy S25上の実測Evidenceは発生しない。GitHub ActionsでAPKを生成し、実機でExecutionRequestを実行して初めてP0-5の外部検証が成立する。

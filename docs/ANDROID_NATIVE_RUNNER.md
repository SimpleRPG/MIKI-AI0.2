# MIKI Android Native Runner Contract v1

## 方針

Termux/localhost Runnerを将来の本番経路から外し、Galaxy S25等のAndroid本体ではCapacitor Native Plugin `MIKINativeRunner` を実行境界にする。

Web/React側は任意コードを実行しない。`ExecutionRequest`をNative Pluginへ渡し、Native側から結果だけを受領して既存の`ExecutionRunnerService.submitResult()`へ戻す。

## Plugin API

### `MIKINativeRunner.execute`

入力:

- `request_id`
- `component_id`
- `implementation_hash`
- `environment = ANDROID`
- `test_category`
- `test_case_id`
- `artifact_snapshot_key`
- `input_summary`

出力:

- `request_id`
- `passed`
- `output_summary`
- `error_message?`
- `duration_ms?`
- `environment = ANDROID`
- `runner_id`
- `implementation_hash`
- `test_case_id`
- `artifact_snapshot_key`

### `MIKINativeRunner.health`（任意）

```json
{"ready":true,"runner_id":"android-native"}
```

## 安全境界

Native側は次を満たす必要がある。

1. 任意shell/process起動を受け付けない。
2. `component_id` が登録済みの安全なAdapterに対応する場合だけ実行する。
3. 実行前に`implementation_hash`を検証する。
4. 入力サイズ・権限・タイムアウトを制限する。
5. 結果に元の`request_id`と`implementation_hash`を必ず返す。
6. `test_case_id`と`artifact_snapshot_key`を結果へそのまま返し、Requestとの一致を壊さない。
7. `VERIFIED`を直接設定しない。結果は既存のVerification/Regression/Promotion Gateへ戻す。

## 実行経路

```text
Regression Coordinator
  -> ExecutionRunnerService.markSubmitted()
  -> AndroidNativeRunnerAdapterService
  -> MIKINativeRunner (Capacitor)
  -> registered native test adapter
  -> result
  -> ExecutionRunnerService.submitResult()
  -> Verification
  -> Regression
  -> Promotion Gate
```

## Termux移行

`TERMUX`環境型は過去データ互換のため当面残すが、Regression CoordinatorのAndroid本体経路では使用しない。`scripts/termux_external_runner.ts` は移行用の旧参照実装として扱う。


## 実装状態
JS側のCapacitor契約とAndroid側Kotlin Pluginソースを分離して管理する。Android platform (`android/`) は生成後に `npm run android:native-runner` でPluginを組み込む。実機でのビルド/疎通が完了するまで `DEVICE_TESTED` / `VERIFIED` とは扱わない。

## P0-5 Smoke Adapter

`android.native_echo` を最小のallow-list Adapterとして登録する。これは入力をそのまま返すだけの決定論的READ_ONLYテストで、任意コード・shell・process・networkを実行しない。

このAdapterの存在や静的契約テストのPASSは、`DEVICE_TESTED` / `VERIFIED` の証拠ではない。実機で `ExecutionRequest -> Native Plugin -> Adapter -> submitResult()` が実測され、Assertion PASSかつ既存のRegression/Promotion Gateを通過した場合のみ、正式な検証結果として扱う。

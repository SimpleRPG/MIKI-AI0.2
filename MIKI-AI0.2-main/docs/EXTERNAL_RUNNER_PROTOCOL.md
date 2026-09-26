# External Runner Protocol v1

MIKIのRegression Runner境界は、任意コードをAndroid/Termux側で直接実行しない。
`ExternalRunnerAdapterService` が `ExecutionRequest` をHTTP POSTし、外部Runnerが実行後に結果JSONを返す。

## Request

```json
{
  "request_id": "RUN-...",
  "component_id": "...",
  "implementation_hash": "...",
  "environment": "ANDROID",
  "test_category": "NORMAL",
  "test_case_id": "TC-...",
  "artifact_snapshot_key": "miki_component_artifact_v2:...",
  "input_summary": "..."
}
```

## Response

```json
{
  "request_id": "RUN-...",
  "passed": true,
  "output_summary": "...",
  "duration_ms": 123,
  "environment": "ANDROID",
  "runner_id": "runner-01",
  "implementation_hash": "...",
  "test_case_id": "TC-...",
  "artifact_snapshot_key": "miki_component_artifact_v2:..."
}
```

`request_id`、`implementation_hash`、`test_case_id`、`artifact_snapshot_key`、`environment` がRequestと一致しない結果は受領しない。

## 安全境界

- Adapter自身はコードを実行しない。
- 外部Runnerは明示的に設定した場合だけ使用する。
- 未設定時はRegression Coordinatorが `SUBMITTED` で停止する。
- PASS結果は既存の `ExecutionRunnerService.submitResult()` → Verification → Regression → Promotion Gate の経路を通る。
- Adapterから `VERIFIED` を直接設定しない。

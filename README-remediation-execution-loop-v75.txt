MIKI-AI0.2 v75 - Research→Remediation→Execution closed loop

追加:
- researchToRemediationServiceで作成されたRegression SuiteをExecutionRunnerへ安全にSUBMITTED投入
- 外部Runner実行結果をExecutionEventBusからRemediationへ戻し、Suite状態を更新
- PASS/FAILをUnified Learning Continuumへ記録
- QUARANTINEDは実行投入しない
- startupでCoordinatorを初期化
- background workerから待機中Remediationを自動投入
- API: POST /api/miki/research-remediation/:id/dispatch
- API: POST /api/miki/research-remediation/dispatch-queued

安全境界:
- 任意コマンド実行なし
- ローカルLLMなし
- eval/new Function/Math.randomなし
- 実際の実行はExternal Runnerからの結果受領に限定

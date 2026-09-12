MIKI-AI0.2 Self-Improvement Closed Loop v1

追加:
- selfImprovementExperimentService.ts
- Self-Improvement前後スナップショット
- ADOPT / HOLD / REJECT 判定
- 失敗率・Knowledge Gap・再利用率・Stable Case・長期記憶件数を比較
- 実験履歴を miki_self_improvement_experiments_v1 に保存

修正:
- OrchestratorStepにimplementation_hashを保持し、過去の実装hashでCase Memoryを固定
- Task Orchestratorのfirst_request参照/重複プロパティを修正
- EvidenceRecordのmetadata型を追加
- Execution Runnerのpromotion判定をComponentVerificationResultの実際のnextStatusに接続
- Recovery OrchestratorのnextRequest typo/async return型を修正

安全性:
- 自動ロールバックはしない
- 任意コード実行はしない
- Component VERIFIED昇格は行わない
- 真偽判定は行わない
- 改善結果は測定して採用/保留/不採用として記録する

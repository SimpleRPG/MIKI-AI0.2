MIKI-AI0.2 Learning-to-Planning Loop v1

今回の層では、実行済みの成功経験を次回のCapability Graph計画へ優先入力する。

Flow:
Execution Event -> Task context -> CapabilityLearningService -> validated reusable/stable case -> CapabilityGraph score boost -> Composition -> Orchestrator

Rules:
- 成功実行だけを計画優先度へ反映。
- Componentが現在VERIFIEDで、保存hashと一致する場合だけ有効。
- FailureMemoryが現在のhashを避ける場合は再利用しない。
- 学習は真実性やVERIFIED状態を決めない。
- 任意コードを自動実行しない。
- 同一goal/environment/component-setの成功が蓄積すると REUSABLE -> STABLE。
- TaskExecutionOrchestratorはCapability Graphで作ったCompositionをそのままcreateRunFromPlanへ渡し、学習結果を含む計画の再計画ズレを減らす。

注:
このZIPは現時点の完全なプロジェクトを含む累積版。依存パッケージは含めず、package.jsonに従って npm install が必要。

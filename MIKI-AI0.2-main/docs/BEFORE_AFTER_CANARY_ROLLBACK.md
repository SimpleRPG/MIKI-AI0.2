# P0-4 Before/After → Canary → downstream impact → Rollback

## 目的

改善候補をRegression Gateだけで即時固定せず、採用前の観測値を保存し、採用後の実利用をCanaryとして観測する。Canaryが悪化した場合は、採用直前に保存した旧版Componentスナップショットへ戻す。

## 境界

1. Regression Gate PASS
2. Before snapshotを取得
3. 改善候補を正式Componentへ反映
4. 新implementation_hashをCanary hashとして固定
5. 同一component/environment/hashの実利用Execution EventだけをCanaryサンプルにする
6. 最低3件、失敗率20%以下、伝播リスク60未満を既定条件として評価
7. PASSならADOPTED、FAILなら旧版スナップショットへRollback

## 重要な安全条件

- Runnerの`passed`だけではCanary PASSにしない。Execution Eventの完了/失敗とhashを照合する。
- 現在版hashがCanary hashと一致しない場合、別変更が混入した可能性があるため自動Rollbackを停止する。
- Rollbackは任意コード実行ではなく、保存済みComponentTxtPackageをRegistryへ復元する。
- Before/Afterは`selfImprovementExperimentService`の同一スナップショット形式を使用する。
- downstream impactは現時点では実行履歴・再利用・Task Caseから算出する近似値であり、完全な依存グラフ伝播ではない。

## 操作API

- `safeImprovementPipelineService.adopt(runId)` → Regression PASS後、CANARYへ移行
- `safeImprovementPipelineService.evaluateCanary(runId)` → Canaryを再評価
- Canary PASS → ADOPTED
- Canary FAIL → Rollbackを実行しROLLED_BACK

実機E2Eはまだ未実施であり、Android Native Runnerが実際にExecution Eventを返すことが次の検証条件となる。

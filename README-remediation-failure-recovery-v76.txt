MIKI-AI0.2 v76 - Remediation Failure Recovery / Design Philosophy Alignment

実装:
- Regression失敗を同一Remediationの成功扱いにせず、新しいKnowledge Gapへ戻す。
- Web再調査は必ず Evidence -> Claim -> Verifier 境界を通る。
- 再調査はfresh evidenceを要求し、最大3パス。
- 検証済み結果だけをResearch->Remediationへ再接続する。
- 同一失敗の自動再試行は3回まで。超過時はQUARANTINED。
- Regression Suiteのrequest_idsで対象失敗を厳密に照合する。
- Unified Learning Continuumへ成功/失敗/検疫結果を戻す。
- 任意コード生成、eval、new Function、Math.randomを使用しない。

設計思想との対応:
- 第121章: 決定論的検証・弱い信号だけで正式採用しない。
- 第123章: 改善を通常実行層から分離し、既存Gateを通す。
- 第126章: Regression/Evidenceを改善根拠にする。
- 第128章: 失敗から再計画し、検証してから再利用する。
- 第130章: 仕様競合は平均化せず検疫する。
- 第142章: QUARANTINED / 誤学習防止 / 反復汚染防止。
- 第145章: 障害から失敗シグネチャと再発防止経路を作る。
- 第159章: 必須条件・失敗条件を保持して再調査する。
- 第160章: 実行結果と学習結果を因果候補として結び付ける。
- 第161章: 外部知識はfreshnessを要求し、再検証する。
- 第172章: 課題検知 -> 探索 -> 検証 -> 回帰 -> lesson化の決定論的ループへ接続。

注:
Master Specificationには歴史的なローカルLLM/モデル生成記述が残る章がある。
現行v76実装では、ユーザー指定に従いローカルLLMランタイムを再導入せず、決定論的/外部教師境界で実装している。

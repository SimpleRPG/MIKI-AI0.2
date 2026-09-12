MIKI-AI0.2 Capability Learning Layer v1

追加:
- src/services/capabilityLearningService.ts
- 実行イベントから成功/失敗の学習ケースを保存
- VERIFIED + 実装hash一致 + 失敗回避条件を満たす成功だけを REUSABLE/STABLE 候補へ昇格
- CapabilityReuse（即時再利用）と学習ケース（経験の蓄積）を分離
- localStorage: miki_capability_learning_v1

同時修正:
- ComponentVerificationService: 実行失敗時にREJECTEDへ実状態遷移
- 実行証拠を今回生成した未紐付け証拠へ限定
- FailureRecoveryServiceのRETRY理由を実際の挙動に合わせて修正

注意:
- VERIFIEDそのものをこの層は決めない
- 任意shell/code executionは行わない
- 完全ビルドは元リポジトリの依存関係を含めて確認する必要あり

MIKI v85 — Unified Cognitive Kernel / Legacy Local-LLM Retirement

実装:
- 会話/RPG/研究/コード/データ/システム/タスクを共通認知カーネルへ統合
- intent → route → evidence → execute → evaluate → learn の共通ループを追加
- 共通認知サイクルを Operational Conformance の trace / uncertainty / terminal に接続
- Unified Experience / Learning Continuum へ同一サイクルを記録
- Chapter 69-90 サービス初期化を server startup に接続
- Integrated Cognition の LLM budget を 0 に固定
- realization の LOCAL_MODEL を明示的にブロック
- 旧 autonomous-web-evolve の合成成功偽装経路を廃止し deterministicSelfImprovementLabService へ委譲
- autonomousContinuousEvolutionService の旧ローカルLLM直接バイパスを削除
- self-coding の generationMethod から llm_local を削除

安全境界:
- ローカルLLMランタイムを復活させない
- 自己改善は候補生成/検証まで。自動本番全反映はしない
- Gemini等の外部モデルは通常認知経路ではなく教師/証拠経路としてのみ扱う

Tests:
- test_miki_v85_kernel.mjs: 11/11 PASS
- test_operational_conformance_v85.mjs: 12/12 PASS

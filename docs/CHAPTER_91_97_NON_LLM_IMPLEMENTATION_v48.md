# MIKI-AI 第91〜97章 非LLM中心実装 v48

## 方針
LLMを能力そのものとして扱わず、能力ごとに実現方式を交換可能にする。既知・決定論・機械検証可能な領域ではNO_LLMを優先する。

## 実装
- `capabilityImplementationRegistryService.ts`: capability / implementation / mode / contract / evidence / observed runs を分離管理。
- `implementationSelectionService.ts`: CompiledRequestTypeから最小実現方式を選択。未確定時のみHYBRID候補。
- `hybridConversationEngineService.ts`: 会話行為→状態→意味→回答骨格→表層の分離。
- `nonLlmCodeSynthesisService.ts`: 要求IR→能力グラフ→検証済み部品→合成計画を機械的に構成。

## 不変条件
1. 実測していない速度・精度を登録しない。
2. 未検証部品を完成コードとして扱わない。
3. LLM出力を最終成果物に直接採用しない。採用する場合も同じ検証ゲートを通す。
4. 非LLMで解けない要求はUNKNOWN/HYBRIDへ戻し、捏造で埋めない。

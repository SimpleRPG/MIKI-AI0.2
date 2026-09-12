# MIKI-AI v52 — Local Generative Runtime Full Replacement

v52 は v51 を親として、残存していたローカル生成ランタイム依存を実行経路から一括置換する。

## Runtime policy
- `EngineMode` は `autonomous_rule` と `gemini_cloud` のみ。
- `autonomous_rule` は `nonLlmCoreService` が実行主体。
- Gemini は任意の外部教師であり、ローカル生成ランタイムの代替実行器ではない。
- GGUF / WebLLM / llama.cpp / llama-swap / Ollama / LM Studio のローカル生成実行は行わない。

## Replacements
- `nativeLlmService.ts` → 削除。`nonLlmRuntimeService.ts` は決定論的互換境界。
- `webLlmService.ts` → 削除。
- `ggufModels.ts` → 削除。モデルカタログは空集合を真実として扱う。
- WebLLM dependency → package manifestから削除。
- Embedding → 決定論的特徴ベクトル。
- GGUF/VRAM UI → Non-LLM実行予算・退役通知へ置換。
- モデルライフサイクル → 空集合を返す退役済みサービスへ置換。

## Invariant
「機能不足を架空の生成結果で埋めない」。既存の検証済み部品がないコード生成・最適化・反省パッチは未解決として扱う。

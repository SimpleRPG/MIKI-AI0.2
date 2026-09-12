# v52 Change Log

- v51を親として累積更新。
- `nativeLlmService.ts` / `webLlmService.ts` / `ggufModels.ts` を削除。
- `@mlc-ai/web-llm` を依存関係から削除。
- `EngineMode` を `autonomous_rule | gemini_cloud` に限定。
- Non-LLM Coreを通常チャットの唯一の端末実行経路に固定。
- Embeddingを決定論的特徴ベクトルへ変更。
- GGUFモデル管理・VRAMモデル管理UIを退役通知/実行予算UIへ変更。
- モデルライフサイクル管理を空集合ベースの退役済みサービスへ変更。
- 自律改善・回帰評価などに残っていたローカル生成呼び出し名を決定論的ストリーム境界へ変更。
- ローカル生成ランタイムの誤案内を検出する `test:no-local-generative-runtime` を追加。

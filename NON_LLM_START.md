# MIKI-AI 0.2 非LLM優先版

## 今回の変更
- 初回のエンジン既定値を `autonomous_rule` に変更。
- `autonomous_rule` 選択時は多段LLMタスク計画をスキップし、非LLM経路へ直行。
- 非LLMパイプラインの型不整合を修正。
- `requestType` 参照を実際の `CompiledRequestType.category/goal` に修正。
- ClaimRecordの存在しない `claimText/confidence` 参照を `statement/status` に修正。
- LatentGoalの存在しない `primaryGoal` を `latentGoal` に修正。
- AffectionDynamicStateの存在しない `currentZone` を `toneStance` に修正。
- 決定論的ハッシュから実行時間を除外。同じ入力・同じ構成なら時間差でハッシュが変わらないようにした。
- NPU/GPUを「実際に動かしている」と偽って表示しないよう変更。現版はCPU決定論的処理を実行し、NPU/GPUは将来Provider用の予約領域。
- エンジン設定キーを `miki_active_engine_mode` に統一。

## 現在の非LLM経路

ユーザー入力
→ 非LLM照応・認識論・要求型解析
→ 決定論的即答（該当時）
→ 非LLM Hardware Pipeline
→ Claim DB / Component Registry / Answer Assembly
→ UI表示

`autonomous_rule` の通常会話経路では、ローカルLLM/WebLLM/Geminiを回答生成の必須経路として呼び出さない。

## 注意
ZIP単体には `node_modules` が含まれていないため、この環境では完全な `npm run build` は再現できない。まず対象端末/開発環境で `npm install` 後、`npm run lint` と `npm run build` を実行すること。

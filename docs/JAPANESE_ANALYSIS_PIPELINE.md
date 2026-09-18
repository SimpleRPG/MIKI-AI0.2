# 日本語解析パイプライン

## 目的
設計思想4.2/12.3の「形態素解析→語義・辞書→対話行為→会話状態」の前段を、LLMなしで決定論的に実行する。

## 実装
- `japaneseAnalysisService.ts`
- Android WebView/現行ブラウザでは `Intl.Segmenter('ja', word)` を優先。
- 非対応環境では機能語辞書＋文字N-gramへフォールバック。
- 出力は `JapaneseAnalysisResult` に固定し、将来Sudachi等をNative/Worker adapterとして差し替え可能。
- `memoryRetrieval` のTier 1へcontent token + bigramを供給。
- `nonLlmCore` の会話状態候補へcontent tokenを供給。

## 学習境界
訂正は「正しい」と自己判定せず、ユーザー訂正が明示され参照対象が解決できた場合のみ correction candidate として記録する。これだけでは知識・能力のVerifiedにはならない。

## 非実装事項
SudachiそのものをWeb bundleへ強制同梱したわけではない。巨大辞書を無条件に端末へ載せることを避け、後からNative/Worker adapterを接続できる契約を先に固定している。

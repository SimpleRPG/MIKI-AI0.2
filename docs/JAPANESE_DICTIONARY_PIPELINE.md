# 日本語辞書パイプライン

## 目的

設計思想書の「SudachiPy/SudachiDict等 + 個人辞書」を、形態素解析器に直結しない辞書レイヤーとして実装する。

## 実装

- `japaneseDictionaryService.ts`
  - 端末常駐の小型コア辞書
  - PERSONAL辞書をStorageへ永続化
  - JMdict / 日本語WordNet / Wiktionary / chiVeを同一正規化スキーマへ取り込むAPI
  - 最長一致検索
  - lemma / reading / POS / semanticIds / gloss / aliases
- `japaneseAnalysisService.ts`
  - 解析tokenへ辞書情報を付与
  - 辞書ヒット数と利用ソースを返す

## 辞書データの扱い

巨大な外部辞書をソースコードへ埋め込まず、`JapaneseDictionaryPackage`として別配布・更新できる設計にする。外部辞書が未導入でも小型コア辞書 + 個人辞書で動作する。

## 個人辞書

ユーザーの明示的な訂正・用語定義から追加する。通常のWeb検索結果やLLM出力だけでは個人辞書へ自動登録しない。候補は未検証として扱い、採用条件を別途通す。

## Sudachiについて

現段階はSudachiそのものを偽装しない。SudachiPy/SudachiDictをNative/Worker adapterとして差し替え可能な契約を先に固定している。これにより、形態素解析器の導入後も辞書層・会話状態・記憶層を再設計せずに済む。

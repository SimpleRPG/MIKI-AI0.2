# 日本語辞書パッケージ契約

設計思想書の「SudachiPy/SudachiDict、個人辞書、日本語WordNet、Wiktionary、JMdict、chiVe」を同じ解析基盤へ接続するための契約。

## 原則
- 辞書データそのものと解析器を分離する。
- 外部辞書を読み込んだだけでは正式知識・Claimへ昇格しない。
- `source` と `version` を保持し、再現性を確保する。
- 個人辞書はPERSONALとして優先するが、外部辞書の事実性を上書きしない。

## JSON
```json
{
  "schemaVersion": 1,
  "source": "JMdict",
  "version": "...",
  "dictionaryName": "...",
  "entries": [
    {
      "surface": "...",
      "normalized": "...",
      "lemma": "...",
      "reading": "...",
      "pos": "NOUN",
      "priority": 60,
      "semanticIds": ["..."],
      "gloss": "...",
      "aliases": []
    }
  ]
}
```

現時点では巨大な第三者辞書データをソースへ直書きしていない。Actions/Android側でライセンス確認済みの辞書パッケージを配置し、`importJson`/`importNormalized`で取り込める。

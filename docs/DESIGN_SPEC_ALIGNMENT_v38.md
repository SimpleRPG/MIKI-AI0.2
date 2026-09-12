# MIKI-AI0.2 設計思想整合 v38

## 今回の実装境界

### 1. 日本語解析

設計思想のパイプラインに合わせ、解析結果を以下まで保持する。

- 正規化
- 形態素
- 辞書形・読み
- 品詞
- 辞書source
- semanticIds
- 助詞ベースの意味役割候補
- 質問・訂正検出

意味役割は決定論的な候補抽出であり、完全な意味役割解析とは名乗らない。

### 2. 日本語辞書

外部辞書は解析器と分離し、JMdict / WordNet / Wiktionary / CHIVE を同一Package契約で取り込む。

v38では取り込んだ外部辞書パッケージもStorageServiceへ永続化し、再起動後に復元する。

### 3. 自律カリキュラムの検証境界

SELF_SIMULATEDだけでは卒業しない。

EXTERNALLY_VERIFIEDへ遷移するには、指定されたEvidence IDが実在し、以下を満たす必要がある。

- kind = EXECUTION
- status = ADMISSIBLE
- assertion_status = PASS
- passed = true

これによりEvidence ID文字列だけを渡して正式能力へ昇格させる抜け道を閉じる。

### 4. Component正式昇格

Regression PASSだけではVERIFIEDにしない。

```text
CANDIDATE / ANALYZED
  ↓
REGRESSION
  ↓
DEVICE_TESTED
  ↓
LIMITED / CANARY
  ↓
実利用観測
  ↓
Canary PASS
  ↓
VERIFIED
```

旧 `promoteIfSafe()` は互換APIとして残すが、Regression PASSだけでVERIFIEDへ遷移させず、LIMITED入口へ変更した。

## 未完了

- Android実機でSudachi解析を実測すること
- 実機Execution Evidenceを生成すること
- Canaryの十分な実利用サンプルを収集すること
- JMdict等の実データをライセンス情報付きで配布パッケージ化すること
- 意味役割解析を将来のより強い日本語解析器へ差し替えること

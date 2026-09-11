# 主張・証拠の認識論的分類（classifyClaimEpistemology）シミュレーション検証レポート

## 1. 概要
- **対象機能**: 主張・言明の認識論的分類（現実/創作/仮定の混同防止）および長期記憶の認識論的監査
- **検証種別**: シミュレーションデータおよび単体テストによるロジック健全性確認（※実機端末での実測ログではありません）
- **配置ファイル**:
  - `src/services/falsificationService.ts` (`classifyClaimEpistemology`)
  - `src/services/memoryAuditService.ts` (`auditEpistemicStatuses`)
  - `src/types.ts` (`ClaimFactStatus`, `EpistemicClaimClassification`, `MemoryItem.factStatus`)
- **呼出配線**:
  - `src/App.tsx`: ユーザー入力直後のシャドー分類ログ出力
  - `src/App.tsx`: モデル応答確定時のシャドー分類ログおよび入力・応答間整合性ログ出力
  - `src/services/memoryAuditService.ts`: `runFullAuditCycle` 内の第5ステップとして定期監査・是正実行

---

## 2. 単体テスト実行生出力（PASS/FAIL全行）

以下は `npx tsx scripts/test_epistemic_classification.ts` の全実行ログです。
4分類（`fictional`, `hypothetical`, `confirmed`, `unverified`）および記憶混同是正処理の全14テストケースを網羅しています。

```
================================================================
🧪 フェーズ2: 主張・証拠の認識論的分類 (現実/創作/仮定) ロジック単体テスト
================================================================

【パターン1: 創作・架空・物語 (fictional)】
  [入力]: "宇宙海賊が未知の惑星を冒険するSFファンタジー物語を創作してほしい"
  [判定]: status=fictional, confidence=1.00, markers=[物語, ファンタジー, 創作して], reasons=[創作・物語表現, 架空・ファンタジー標識, 創作生成依頼]
✅ [PASS] 創作表現が 'fictional' と判定されること: "宇宙海賊が未知の惑星を冒険するSFファン..."
  [入力]: "このキャラ設定として、普段は無口な魔法使いという設定でロールプレイしよう"
  [判定]: status=fictional, confidence=1.00, markers=[キャラ設定, という設定, ロールプレイ], reasons=[設定規定表現, ごっこ遊び・ロールプレイ]
✅ [PASS] 創作表現が 'fictional' と判定されること: "このキャラ設定として、普段は無口な魔法使..."
  [入力]: "昔々ある森に小さなドラゴンが住んでいましたという童話ストーリーを書いてみて"
  [判定]: status=fictional, confidence=1.00, markers=[童話, ストーリー, 書いてみて], reasons=[創作・物語表現, 創作生成依頼]
✅ [PASS] 創作表現が 'fictional' と判定されること: "昔々ある森に小さなドラゴンが住んでいまし..."

【パターン2: 仮定・反実仮想・思考実験 (hypothetical)】
  [入力]: "もしもサーバーがダウンして全ノードが停止したらどうフェイルオーバーする？"
  [判定]: status=hypothetical, confidence=0.90, markers=[もしもサーバーがダウンして全ノードが停止したら, 仮定導入部], reasons=[「もし〜なら」仮定構文, 文頭・文中の仮定導入語]
✅ [PASS] 仮定表現が 'hypothetical' と判定されること: "もしもサーバーがダウンして全ノードが停止..."
  [入力]: "仮にメモリが512MBしかない組み込み環境だったとしたら、どの軽量DBを選ぶ？"
  [判定]: status=hypothetical, confidence=0.90, markers=[仮にメモリが512MBしかない組み込み環境だったとしたら, 仮定導入部], reasons=[「仮に〜としたら」仮想構文, 文頭・文中の仮定導入語]
✅ [PASS] 仮定表現が 'hypothetical' と判定されること: "仮にメモリが512MBしかない組み込み環..."
  [入力]: "仮想的にユーザー数が1000万人に急増した場合をシミュレーションしてみて"
  [判定]: status=hypothetical, confidence=0.90, markers=[シミュレーションして, 仮想的に], reasons=[仮定・想定指示, 仮想標識]
✅ [PASS] 仮定表現が 'hypothetical' と判定されること: "仮想的にユーザー数が1000万人に急増し..."

【パターン3: 客観的事実・確定事項 (confirmed)】
  [入力]: "TypeScript 5.0が正式リリースされた"
  [判定]: status=confirmed, confidence=0.80, markers=[リリースされた], reasons=[完了・存在実証]
✅ [PASS] 確定表現が 'confirmed' と判定されること: "TypeScript 5.0が正式リリー..."
  [入力]: "ポート3000のプロセスを終了し、正常にサーバーが動作した"
  [判定]: status=confirmed, confidence=0.80, markers=[動作した], reasons=[実働検証]
✅ [PASS] 確定表現が 'confirmed' と判定されること: "ポート3000のプロセスを終了し、正常に..."
  [入力]: "チーム会議でデータベースをSQLiteに決定した"
  [判定]: status=confirmed, confidence=0.80, markers=[決定した], reasons=[決定・合意標識]
✅ [PASS] 確定表現が 'confirmed' と判定されること: "チーム会議でデータベースをSQLiteに..."

【パターン4: 未検証・推測・伝聞 (unverified)】
  [入力]: "来週新しいモデルが出るらしいよ"
  [判定]: status=unverified, confidence=0.75, markers=[らしい], reasons=[伝聞・様態接尾辞]
✅ [PASS] 推測・伝聞が 'unverified' と判定されること: "来週新しいモデルが出るらしいよ..."
  [入力]: "パフォーマンスが向上するかもしれない気がする"
  [判定]: status=unverified, confidence=0.85, markers=[かもしれない, 気がする], reasons=[不確定推量「かも」, 主観的所感]
✅ [PASS] 推測・伝聞が 'unverified' と判定されること: "パフォーマンスが向上するかもしれない気が..."
  [入力]: "噂ではそのライブラリは非推奨になるはずだ"
  [判定]: status=unverified, confidence=0.85, markers=[噂では, はずだ], reasons=[未確認伝聞出処, 推量助動詞]
✅ [PASS] 推測・伝聞が 'unverified' と判定されること: "噂ではそのライブラリは非推奨になるはずだ..."

【パターン5: 記憶監査による創作・事実混同是正の検証】
[2026-09-11T06:49:01.662Z]  [WARN ] [PERSISTENCE] 【認識論的監査】1件の創作・仮定記憶が確定事実と混同されていたため是正しました { flaggedMemoryIds: [ 'mem_test_fictional_misclassified' ] }
  [監査結果]: {
  "auditedCount": 1,
  "confirmedCount": 1,
  "hypotheticalCount": 0,
  "fictionalCount": 0,
  "unverifiedCount": 0,
  "fictionalMisclassifiedAsConfirmed": 1,
  "flaggedMemoryIds": [
    "mem_test_fictional_misclassified"
  ]
}
✅ [PASS] 創作物語が確定事実として混同されていた場合に是正フラグが立つこと
✅ [PASS] 是正後の記憶の factStatus が fictional に変更され quarantineReason が記録されていること

================================================================
📊 テスト結果: 14 / 14 通過 (100%)
================================================================
```

---

## 3. 実装の整合性と考察

1. **認識論的ステータスの決定性**:
   - 言語マーカー・構文パターンの優先度順評価（創作 > 仮定 > 推測 > 確定事実 > 中立）により、LLMに依存せず確信度付きで分類できることを確認。
2. **記憶の混同防止と検疫（quarantineReason）**:
   - 創作設定（例: 小説、ロールプレイ）が誤って確定事実（confirmed）として保存された場合、バックグラウンド記憶監査で自動検知され、`fictional` へ是正されるとともに検疫理由（quarantineReason）が記録されることをテストで実証。

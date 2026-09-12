# 第31章 コード理解拡張

v43で31.6〜31.9を実装。

- 31.6 `codeMapService`: CodeUnderstandingIRから決定論的なコード地図を生成。
- 31.7 `changeImpactSimulatorService`: 変更候補の影響をSTATIC_FACT / STATIC_INFERENCE / UNCONFIRMEDに分離。
- 31.8 `codeComprehensionQuizService`: 静的IRから読解確認問題を生成。
- 31.9 `offlineKnowledgePackService`: 公開資料のオフラインパックを版・出典・ライセンス・再検証日付きで登録・検索。

実行結果や実機結果を静的推定へ混ぜない。外部資料は登録しただけで真実として昇格しない。

# Unattended Learning Boundary

## 目的

アプリが放置されている間も、既存の安全な自己改善経路を1サイクルずつ進める。

## 自動で進むもの

- 未解決 Knowledge Gap の研究
- 成功ケースの再利用・長期記憶候補化
- 実行失敗の観測と Failure Memory への反映
- Regression / Canary の既存パイプラインへの投入
- 日本語辞書・解析結果など、検証可能な知識の蓄積
- 鮮度・再利用率・失敗率などの弱点評価

## 自動で「賢くなった」と判定しないもの

- 自己シミュレーションだけで VERIFIED にすること
- Cloud AI の提案だけで能力を正式採用すること
- 実機未検証のコードを DEVICE_TESTED / VERIFIED にすること
- 任意の自己書換えを無制限に実行すること

## 実行経路

`Android/WorkManager -> backgroundWorkerService -> selfImprovementControllerService -> research/case/regression -> Evidence -> Canary -> VERIFIED`

バックグラウンド処理はAndroid OSの制約・電池・温度・ユーザー操作を尊重する。プロセスが完全に終了している場合の再開は、Android WorkManager側の実装・実機検証が必要。

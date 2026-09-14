# MIKI アプリ内・自律改善設定

このパッチは、`EvidenceBasedLoopSubView` にアプリ内設定パネルを追加します。

## できること

- 実行時間: 15分 / 1時間 / 6時間 / 24時間 / ずっと
- サイクル間隔: 5秒以上で設定
- 作業指示書: 画面入力または `.md` / `.txt` ファイルから読み込み
- 指示書の取り込み: 既存 `WorkDirectiveIngestionService` を使用
- 開始 / 停止: 既存 `SelfImprovementControllerService.runOnce()` を繰り返し実行
- 設定: ブラウザ/アプリの `localStorage` に保存

## Termuxで適用

ZIPを展開してリポジトリ直下に置いた後:

```bash
cd ~/MIKI-AI0.2
bash scripts/install-app-autonomous-ui.sh
npm run build
```

問題がなければ通常どおり:

```bash
git status
git add src/components/self_improvement/EvidenceBasedLoopSubView.tsx src/components/self_improvement/AutonomousImprovementSettingsPanel.tsx
git commit -m "Add in-app autonomous improvement settings"
git push origin main
```

## 安全境界

このUIは指示書から任意のシェルコマンドを実行しません。自己改善処理は既存の正規コントローラへ委譲します。

「未知の対応手段」は、今回のUIでは任意コードを無条件に実行する方式にはしていません。未知手段の発見・検証・採用は既存のEvidence/Safety系の仕組みを通す前提です。

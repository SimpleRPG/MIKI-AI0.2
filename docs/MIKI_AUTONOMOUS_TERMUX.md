# MIKI-AI Termux 自律改善ランナー

## 目的

既存の `SelfImprovementControllerService` を正規経路として使い、Termuxから「一定時間だけ」「無期限」で自己改善サイクルを回せるようにする。

この追加はWeb UIを変更せず、既存の作業指示書取り込み・Evidence Gate・排他ロック・自己改善パイプラインを再利用する。

## 1. 1時間だけ回す

```bash
cd ~/MIKI-AI0.2
npx tsx scripts/miki-autonomous-runner.ts --duration 1h
```

## 2. 作業指示書を渡して1時間

```bash
cd ~/MIKI-AI0.2
npx tsx scripts/miki-autonomous-runner.ts \
  --duration 1h \
  --instruction docs/miki-work-directive.md
```

## 3. 無期限

```bash
cd ~/MIKI-AI0.2
npx tsx scripts/miki-autonomous-runner.ts --duration forever
```

停止は `Ctrl+C`。

## 4. 指示書の例

`docs/miki-work-directive.md` はMarkdownでよい。既存の `WorkDirectiveIngestionService` が、目的・対象ファイル・要求・禁止事項・完了条件を抽出する。

```md
# MIKI 自律改善 作業指示

## 目的
自己改善サイクルが途中で止まらず、失敗時に原因を記録して次の試行へ反映できる状態にする。

## 対象
- src/services/selfImprovementControllerService.ts
- src/services/autonomousContinuousEvolutionService.ts

## 実装要求
1. 失敗した試行の原因を記録する
2. 同じ失敗を無限反復しない
3. 改善前後の検証結果を保存する
4. 新しく発見した対応手段を能力インベントリへ記録する

## 禁止事項
- 検証なしの採択
- 作業指示にない破壊的変更
- 任意のshellコマンドを指示書から実行すること

## 完了条件
- 変更後に検証結果が記録される
- 失敗時に安全停止できる
```

## 5. 未知の対応手段

各サイクル開始時に `src/services` を走査し、公開クラス/constとメソッド候補を `runtime/miki_discovered_capabilities.json` に保存する。

`knownStrategy=false` の項目は、現在の既知の自己改善戦略語彙に直接分類できない候補。これは「その機能を自動実行できる」という意味ではなく、既存コードにある未整理の対応手段を発見して次の改善材料にするためのインベントリ。

## 6. TermuxからGitへ戻す

この追加はリポジトリ相対パスを維持しているので、展開後は通常のGit操作でよい。

```bash
cd ~/MIKI-AI0.2
git status
git add scripts/miki-autonomous-runner.ts docs/MIKI_AUTONOMOUS_TERMUX.md docs/miki-work-directive.md
git commit -m "Add Termux autonomous improvement runner"
git push origin main
```

`runtime/miki_discovered_capabilities.json` は実行時生成物なので、通常はコミットしない。必要なら `.gitignore` に `runtime/` を追加する。

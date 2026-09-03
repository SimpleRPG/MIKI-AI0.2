# 実装内容: 良い・悪い評価 (設計思想 24.推奨実装順序 第1世代-7)

`fix-memory-retrieval` (記憶検索 / 使用記憶の記録) の続きとして、
記憶ひとつひとつに対してユーザーが「役に立った(👍) / 見当違いだった(👎)」を
評価できる仕組みを追加した。

## 変更ファイル
- `src/types.ts`
  - `MemoryItem` に `goodCount` / `badCount` を追加。
- `src/components/MemoryModal.tsx`
  - 記憶一覧の各行に 👍 / 👎 ボタンを追加し、評価数をインラインで表示。
  - `handleRate(id, 'good' | 'bad')` で該当記憶のカウントを更新。
- `src/utils/memoryRetrieval.ts`
  - `retrieveRelevantMemories` のスコアリングに
    `feedbackScore = clamp(-6, 6, (goodCount - badCount) * 2)` を追加。
  - 良い評価が多い記憶は次回以降のプロンプトに選ばれやすくなり、
    悪い評価が多い記憶は完全に除外はせず優先度だけを下げる
    (設計思想「不要情報は単に切り捨てず…」の方針に合わせた)。

## 実装内容: TXTファイル取込み機能 (設計思想 24.推奨実装順序 第2世代-4 & 25章)

仕事用PCのVBAコード（`.bas`, `.cls`, `.vbs`）や仕様・設計メモ（`.txt`）をスマホAIに取り込み、
「未承認（`approved: false`）」記憶として安全に蓄積・活用する仕組みを追加。

### 設計思想への準拠
- **24章 (第2世代-4 ファイル取込み)**: 仕事用PCの資産（VBA/マクロ/メモ）をTXTファイル経由で本アプリに取り込み可能に。
- **25章 (未承認情報を確定事実として使わない)**: ファイルから取り込んだ記憶はすべて `approved: false`、`source: 'txt_import'` で作成され、ユーザーが確認・承認するまで推論上の確定事実としては使われない（仮情報としてのみ安全に保持）。
- **4章 (原文と要約の分離)**: 取り込んだ巨大なファイルを1つの記憶にせず、空行2つ以上または800〜1500文字を目安にチャンク分割。要約を `content` に、原文抜粋（最大150字）を `rawExcerpt` に、元ファイル情報とインデックスを `sourceRef`（例: `Module1.bas#1`）に記録。

### 変更ファイル
- `src/utils/memoryRetrieval.ts`
  - `enrichMemoryMetadata` において `source === 'txt_import'` の場合は必ず `approved: false` に強制設定。
- `src/components/MemoryModal.tsx`
  - 「みきに教える」タブに「TXT / VBA ファイルから取り込む」UIを追加。
  - `<input type="file" accept=".txt,.bas,.cls,.vbs,text/plain" multiple>` と `FileReader.readAsText()` による非同期ファイル読み込み。
  - 800〜1500文字を目安にしたインテリジェント・チャンク分割（空行やSub/Functionプロシージャ単位を考慮）。
  - カテゴリ自動判定（`.bas`/`.cls`/`.vbs` や `Sub`/`Function` を含む場合は `vba`、コード系は `code`、その他は `chat`）。
  - 取り込みプレビュー一覧（チェックボックス選択/除外、要約編集、カテゴリ切替、原文プレビュー）。
  - 記憶一覧カードにて `📁 TXT取込み` バッジ、`sourceRef`（出典ファイル名#チャンク番号）、原文抜粋アコーディオンの表示を追加。

### 適用方法
このフォルダの `src/` を既存プロジェクトの `src/` にマージ（上書き）してください。
`App.tsx` 側の変更は不要です。

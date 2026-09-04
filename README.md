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

## 実装内容: 教師教材の端末側効果検証ループ (設計思想13章 ステップ7〜9)

外部教師（Gemini等）から教材（`TeacherGeneratedMaterial`）を受け取った後、
端末モデル（3B/4B相当の端末内エンジン）へ一時注入して「実際に改善するか」を端末内で事前検証してから教材として保存する仕組みを追加。
追加の教師API呼び出しは一切行わず（端末内完結）、無料枠を圧迫しない安全設計。

### 設計思想への準拠
- **13章 (ステップ7〜9 効果検証ループ)**: 教師の回答そのものの品質チェックだけでなく、端末側モデルに教材を与えて「うちの子が実際にうまく話せる・解けるようになるか」を検証。
- **追加の教師API呼び出しゼロ**: 原文ベースライン・教材あり再回答・言い換え問題の生成および評価の全4パスを端末内処理（`autonomous_rule` / CPU自律ルールベース）で完結。
- **安全境界の遵守 (25章・39節)**:
  - 予算枠（`checkBudget` / `recordTeacherUsage`）を浪費しない。
  - 検証に失敗（汎化不足）しても即座に教材を破棄せず、`systemLogger.warn` に記録してユーザー判断用として保持。
  - `approved: false` によるユーザー確認待ちの原則は変更せず維持。

### 実装ステップ
1. **ベースライン回答の取得（材料なし）**: `payload.anonymizedExample`（匿名化済み原文）で端末内モデルの基準回答を取得。
2. **材料ありの再回答**: 教材の `mat.outputTarget` / `mat.reasoningExplanation` を一時的な `MemoryItem`（`source: 'txt_import'`, `active: true`）として注入し再回答を取得。
3. **言い換え問題の生成（1問）**: 端末内処理で「次の質問を意味を変えずに言い換えてください: {anonymizedExample}」を投げて言い換え文を1つ生成。
4. **言い換え問題の回答取得（材料なし/あり）**: 生成した言い換え問題に対してもベースラインと教材注入後の2回答を取得。
5. **改善判定**: `completionJudgeService.evaluateCompletion` を4つの回答（原文×材料なし/あり、言い換え×材料なし/あり）に適用してスコア化。
   ```ts
   const originalImproved = withMaterialScoreOriginal - baselineScoreOriginal >= 10;
   const paraphraseImproved = withMaterialScoreParaphrase - baselineScoreParaphrase >= 10;
   const verifiedEffective = originalImproved && paraphraseImproved;
   ```
6. **結果の反映**:
   - `verifiedEffective === true`: 保存する `TrainingSampleJSONL` に `verifiedEffective: true` と検証スコア差分（例: `原文+18点 / 言い換え+22点`）を記録。
   - `verifiedEffective === false`: 教材は保存しつつ、`systemLogger.warn('SELF_IMPROVEMENT', ...)` に「対策の汎化不足(13章検証不合格)」を明示的に記録。

### 変更ファイル
- `src/types.ts`:
  - `TrainingSampleJSONL` に `verifiedEffective?: boolean;` および `verificationNote?: string;` を追加。
  - `TeacherRequestPayload` に `anonymizedExample?: string;` を追加。
- `src/services/teacherRequestService.ts`:
  - `requestTeacherMaterial` 内の (d) VBA安全性チェック直後に (e) 端末側効果検証ループ（ステップ7〜9）を追加。
  - `buildTeacherRequestPayload` に `anonymizedExample` の出力を追加。
- `src/services/selfImprovementService.ts`:
  - `addTrainingSample` で `verifiedEffective` および `verificationNote` を受け取り新規サンプルへ保存。
- `src/utils/companionEngine.ts`:
  - 端末内モデルにおいて言い換え生成プロンプトの解釈および一時注入教材（`【参照教材・解法指針】`）の解法適用に対応。
- `src/components/ExternalTeacherTab.tsx` / `src/components/SelfImprovementModal.tsx`:
  - 教材生成結果および学習サンプルカードでの効果検証結果（`🧪 13章検証済` / `⚠️ 汎化不足`）とスコア差分メモの表示に対応。

## 実装内容: 統合改訂版 Version 3.2 準拠 (20章・32章・9章・16章)

「Galaxy S25 ローカル個人AI構築・自己改善計画 統合改訂版 Version 3.2」の改訂規定に基づく機能強化。

### 1. 20章: 不確実性駆動の教師利用と対策(回答骨格)生成
- **その場の返信ではなく対策生成**: 教師の役割は返信ではなく「対策（改善した回答骨格・修復パターン）」を作らせ、それを9章の回答骨格・記憶として保存すること。
- **対策骨格の自動保存**: 教師教材受領時に `answerPlanService.createSkeletonFromTeacherMaterial` を実行し、トリガー語彙と回答手順（`response_plan`）を持つ `ResponseSkeleton` を自動生成・保存。該当能力プロファイルの `associatedSkeletons` に自動登録。
- **再送信時の汎化不足検知**: すでに対策骨格が存在する能力において、類似の未知の言い回し（16.1）で再び教師送信条件に該当した場合、回答が正解でも「対策の汎化不足 (`gap_type: generalization_gap`)」として32章の不足能力レジストリへ自動記録。

### 2. 13章 & 32章: 端末側検証不合格時の不足能力レジストリ自動連携
- 13章端末側効果検証ループで `verifiedEffective === false`（改善基準+10点未達＝汎化不足）と判定された場合、教材は安全に承認待ちで保存しつつ、32章の不足能力レジストリ（`capabilityGapService.recordGap`）へ `gap_type: 'generalization_gap'` として正式登録。

### 3. 16.2章: LoRA検討発動条件チェッカー
- 31章の `LORA_TRAINING: DISABLED` を長期維持しつつ、以下の3条件を満たした場合にのみ16.3仮想学習試験へ進む監視ロジックを統合:
  1. 言い換え評価（18章）で意味は同じだが表現を変えた問題に繰り返し失敗（汎化不足GAP >= 2）
  2. 新しい回答骨格を追加しても、類似の未知の言い回しに対する失敗が減らない（登録骨格 >= 5 かつ 汎化不足GAP頻度 >= 3）
  3. 21章の能力状態が、骨格追加を続けても SATURATED にならず WEAK のまま停滞（失敗累積 >= 6）



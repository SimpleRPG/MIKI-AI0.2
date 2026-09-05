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

## MIKI-AI 統合設計思想指示書 v4.0 実装報告

### 【実装内容】
1. **SECTION 1: 即座に修正するバグ(3件)**
   - **バグ1 (重大)**: `src/App.tsx` 内で `engineMode === 'external_gpu'` の `extConfig` 宣言を `try` ブロック外に移動し、`catch` 節で `extConfig?.model` / `extConfig?.endpoint` を安全に参照可能に修正。ReferenceError によるエラー握り潰しを解消。
   - **バグ2 (中)**: `src/App.tsx` の `gamecraft_persona` 読み込み時の `JSON.parse` を try-catch で保護し、破損データや不正文字列が存在しても `DEFAULT_PERSONA` に安全にフォールバックして白画面を防止。
   - **バグ3 (軽微)**: `src/types.ts` の `fallbackDiagnostic` に `rawErrorMessage?: string | null;` を追加。`src/components/ChatPanel.tsx` の診断バーに折りたたみアコーディオン（`<details>`）を設け、生エラー詳細をUI上で直接確認可能に改善。

2. **SECTION 2: 設計思想の改善 (コード変更あり)**
   - **12章「教材要求キュー」優先度スコア計算式**:
     - `src/services/teacherRequestService.ts` に加点・減点方式の `calculateQueuePriority(params)` を新設（加点: ユーザー訂正+30、矛盾+20、意図外れ+20、古い前提+15、複数条件落とし+15、再発+5×(n-1)上限+25、不自然+10、回答長不適切+10 / 減点: 未検証-15、語尾違い-20、重複-30、端末安定-30）。
     - スコアが 0 以下の要求は遅延キューに追加せず自動却下し、ログへ記録。
     - `DelayedTeacherQueueItem` に `priority?: number;` を追加し、未設定アイテムも `priority ?? 0` で後方互換処理。
     - `processDelayedTeacherQueue()` で優先度スコアの高い順（降順）にソートしてバッチ処理。
     - `src/components/ExternalTeacherTab.tsx` の遅延キューカードに「優先度: X点」バッジを表示。

3. **SECTION 3: 設計思想の改善 (ドキュメント仕様照合)**
   - **16.2 LoRA発動条件の結合方式**:
     - `src/services/virtualTrainingService.ts` の `evaluateLoraTriggerCondition()` において、条件2（骨格追加後の再発）を必須とし、`(条件1 AND 条件2) OR (条件3 AND 条件2)` として厳格に保守判定している実装と設計仕様の整合性を確認済み。

### 【変更ファイル】
- `src/App.tsx`: `extConfig` スコープ修正、ペルソナ読み込み try-catch 保護
- `src/types.ts`: `fallbackDiagnostic` に `rawErrorMessage` 追加、`DelayedTeacherQueueItem` に `priority` 追加
- `src/components/ChatPanel.tsx`: 診断バーへの生ログ折りたたみ表示 `<details>` の追加
- `src/services/teacherRequestService.ts`: `calculateQueuePriority` 新設、スコア0以下却下、降順ソート、後方互換対応 (`priority ?? 0`)
- `src/components/ExternalTeacherTab.tsx`: 遅延キューアイテムへの優先度バッジ表示
- `server.ts`: 起動時の即時ポートバインド最適化、`/api/miki/*` コンパニオン API 統合
- `vite.config.ts`: 重複プラグイン削除と高速起動化
- `README.md`: 設計指示書 v4.0 に準拠した実装仕様・変更ファイル・適用方法の記録

### 【適用方法】
1. **アプリケーション起動**: `npm run dev` (または本番 `npm run build && npm start`)。ポート 3000 に即時バインドされ、ヘルスチェック (`/api/health`) も即座に応答します。
2. **型検査・ビルド検証**: `npm run lint` (`tsc --noEmit`), `npm run build` でビルド正常通過確認済み。
3. **後方互換性**: 既存ストレージ内のキューアイテムに `priority` が存在しない場合でも `priority ?? 0` として安全にソート・実行されます。

## MIKI-AI 統合設計思想指示書 v4.3 実装報告 (SECTION 7 追加改善 4件 & 拡張章)

### 【実装内容】
1. **[提案D・最優先] storageService.flushNow() の安全配線 (58章 中断・再開・回復能力 / SECTION 5 データを壊さない境界)**
   - `src/main.tsx` において、`document.addEventListener('visibilitychange')` (`hidden` 遷移時)、`window.addEventListener('pagehide')`、`window.addEventListener('beforeunload')` を購読。
   - バックグラウンド遷移時やアプリ終了時に `storageService.flushNow()` を即座に確定させ、400ms遅延バッチ書き込み待機中の直前データ（会話・記憶・教材・評価ログ）の消失リスクを解消。

2. **[提案B] 端末温度状態の実測化・Androidブリッジ配線 (42章 バックグラウンド改善 / 59章 浅い睡眠と深い睡眠)**
   - `src/services/backgroundWorkerService.ts` に、自作Android APK/WebViewの `JavaScriptInterface` (`AndroidThermalBridge` / `AndroidBridge`) および `android_thermal_changed` イベント通知を自動監視する機構を配線。
   - 実測バッテリー温度（摂氏）から `normal (<38℃)` / `warm (38〜42℃)` / `hot (42〜46℃)` / `critical (>=46℃)` を自動判定する `updateFromTemperatureCelsius()` を実装。
   - 発熱検知時には深い睡眠処理（WorkManager）を安全に即座中断。ブリッジ未接続環境ではテストUI手動シミュレーションに安全にフォールバック。

3. **[提案A] 8章 5.意味検索の llama-server 実埋め込み化 (フォールバック原則維持)**
   - `src/services/nativeLlmService.ts` に `checkEmbeddingAvailability()` および `getEmbedding()` を実装。Termux llama-server (`/embedding`, `/v1/embeddings`) および Ollama (`/api/embeddings`) から実埋め込みベクトルを取得可能に。
   - `src/services/longTermMemoryService.ts` の 7段階検索パイプライン Step 5 (意味検索) において、実埋め込みベクトル（768/1024/1536次元等）を用いた高精度コサイン類似度計算を導入。
   - モデル未起動・タイムアウト・未対応時は、既存の8次元ドメイン概念疎ベクトルへ例外なく自動フォールバック（SECTION 5 フォールバック原則・クラッシュ防止）。
   - `MemoryItem` に `embeddingVector`, `embeddingModelId`, `embeddingDimensions` を追加し、`enrichMemoryEmbeddings()` によりバックグラウンドで未算出記憶を段階的にエンリッチ。

4. **[提案C] 機能フラグ整合化 (31章)**
   - `src/types.ts` および `src/services/featureFlagsService.ts` において、すでに実装済みの `EXPERIENCE_ROUTER` (49章), `SKILL_GRADUATION` (50章) に加え、`VBA_STATIC_VERIFIER` (63〜64章) を機能フラグとして正式定義。

5. **63〜64章 VBA静的検証器 & 11章 教師API無料予算動的適応**
   - 8大スキャナー（Parser, ProcedureScanner, BlockScanner, ForbiddenPatternScanner, DeclarationScanner, SignatureComparator, DependencyScanner, DeliveryVerifier）によるVBA静的解析およびSHA-256配送完全性保証。
   - 11章教材価値指標式と予算残量4大Tier（FULL_EXPANSIVE / STANDARD_CRITIQUE / CONSERVATIVE_PRINCIPLES / WAITING_NEXT_BUDGET）の動的適応UI。

### 【変更ファイル】
- `src/main.tsx`: `flushOnHide` リスナー追加（`visibilitychange`, `pagehide`, `beforeunload`）
- `src/services/backgroundWorkerService.ts`: Androidサーマルブリッジ監視、`updateFromTemperatureCelsius` 実装
- `src/services/nativeLlmService.ts`: `checkEmbeddingAvailability`, `getEmbedding` 実装
- `src/services/longTermMemoryService.ts`: Step 5 実埋め込みコサイン類似度化 + 8次元フォールバック、非同期エンリッチ
- `src/types.ts`: `MemoryItem` 埋め込みフィールド追加、`SystemFeatureFlags` フラグ追加
- `src/services/featureFlagsService.ts`: `VBA_STATIC_VERIFIER` 定義・解説追加
- `README.md`: v4.3 実装仕様および検証記録の追記






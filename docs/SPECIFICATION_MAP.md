# Miki AI 仕様対応マッピング正本 (SPECIFICATION_MAP.md)
**最終更新日:** 2026-09-11  
**適用基準:** 非LLM中心・自己成長型AIコンパニオン 設計思想指示書 (統合版 第1章〜第16章) & Miki AI マスター仕様書 v5.0 (第0章〜第172章、計173章)

---

## 1. 概要と基本方針
本ドキュメントは、**「非LLM中心・自己成長型AIコンパニオン 設計思想指示書（統合版 全16章）」** と、システム全体の詳細章カタログである **「マスター仕様書（第0章〜第172章、計173章 / `src/data/specificationRegistryData.ts`）」** の対応関係を一元管理する公式対応表である。

### 根本原則
1. **非LLM中心 (Deterministic First):**
   推論・状態管理・制約検証・コード合成は決定論的TypeScriptロジック（CSP、AST解析、部品結合）で行い、ローカルLLM（Qwen2.5-3B）は自然言語解釈と最終表現の形成のみに限定する。
2. **モデル生成系ランタイム保護不変則:**
   ローカルモデルの重みパラメータは完全不変（IMMUTABLE）とし、オンライン書き換えを形式制約（CSP）で物理的に遮断する。
3. **幽霊実装の完全排除:**
   すべてのサービスコードは仕様書の章（`responsibleServices`）に正確に紐付けられ、テストスクリプトで実体動作が保証されなければならない。

---

## 2. 統合版（全16章） vs マスター仕様書（全173章）マッピング表

| 統合版 | 章タイトル | マスター仕様書 対応章 | 担当サービス (`responsibleServices`) | 担当UIコンポーネント | 実装ステータス |
|---|---|---|---|---|:---:|
| **第1章** | 根本哲学 (Non-LLM Centered) | 第0章, 第1章, 第170章 | `selfCodeArchitectService.ts`<br>`formalConstraintSolverService.ts` | `NonLlmArchitectureTab.tsx`<br>`SelfCodeArchitectTab.tsx` | **実装済み (COMPLETED)** |
| **第2章** | 8層記憶アーキテクチャ | 第2章, 第24章, 第45章, 第56章 | `memoryService.ts`<br>`storageService.ts`<br>`claimDatabaseService.ts` | `MemoryStudioSubView.tsx`<br>`NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第3章** | 会話状態と照応解析 | 第3章, 第5章, 第44章 | `conversationStateService.ts`<br>`anaphora_resolver_sample.ts` | `ChatInputBar.tsx`<br>`MessageList.tsx` | **実装済み (COMPLETED)** |
| **第4章** | プロンプト設計と文脈圧縮 | 第4章, 第6章, 第33章 | `contextAssemblyService.ts`<br>`promptCompressionService.ts` | `PromptInspectorModal.tsx` | **実装済み (COMPLETED)** |
| **第5章** | 回答生成パイプラインと骨格 | 第7章, 第8章, 第14章 | `answerPlanningService.ts`<br>`deRobotToneService.ts` | `AnswerSkeletonInspector.tsx` | **実装済み (COMPLETED)** |
| **第6章** | 事実DBではなく主張(claim)DB | 第45章 (記憶整合性ガード)<br>第23章, 第47章 | `claimDatabaseService.ts` | `NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第7章** | 世界モデルと状態追跡 | 第52章 (世界モデル完全仕様)<br>第46章, 第75章 | `worldModelService.ts` | `AutonomousSelfImprovementModal.tsx`<br>`NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第8章** | 形式制約ソルバーと不変保護 | 第59章 (形式知識・制約ソルバー)<br>第15章, 第165章 | `formalConstraintSolverService.ts` | `FormalConstraintSolverSubView.tsx` | **実装済み (COMPLETED)** |
| **第9章** | 部品レジストリとコード生成 | 第168章 (形式検証済み部品)<br>第80章, 第92章 | `componentRegistryService.ts` | `NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第10章** | 要求型コンパイラと計画合成 | 第91章 (要求セマンティクス抽出)<br>第83章, 第167章 | `requestTypeCompilerService.ts`<br>`skillIrCompilerService.ts` | `NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第11章** | 失敗シグネチャカタログ | 第51章 (失敗シグネチャ完全体系)<br>第19章, 第50章 | `failureSignatureCatalogService.ts` | `FailureSignatureSubView.tsx` | **実装済み (COMPLETED)** |
| **第12章** | 決定論的自己改善ループ | 第171章, 第172章<br>第12章, 第79章 | `mikiUltraEvolverService.ts`<br>`autonomousSoftwareFactoryService.ts` | `UltraSelfEvolverSubView.tsx`<br>`SelfCodeArchitectTab.tsx` | **実装済み (COMPLETED)** |
| **第13章** | コード意味保持検査・静的解析 | 第94章, 第105章, 第106章 | `astStaticAnalysisService.ts`<br>`mutationTestingService.ts` | `SelfCodeArchitectTab.tsx` | **一部実装 (PARTIAL)** |
| **第14章** | ドメイン特化 (VBA/Termux/TS) | 第110章, 第111章, 第112章 | `componentRegistryService.ts`<br>`vbaValidationEngine.ts` | `NonLlmArchitectureTab.tsx` | **実装済み (COMPLETED)** |
| **第15章** | 認識論的検証・オープンワールド | 第48章, 第49章, 第166章 | `claimDatabaseService.ts`<br>`epistemicAuditEngine.ts` | `NonLlmArchitectureTab.tsx` | **一部実装 (PARTIAL)** |
| **第16章** | 実装完了基準と退行ゼロ保証 | 第16章, 第17章, 第102章 | `regressionGuardService.ts`<br>`automatedCanaryService.ts` | `ZeroRegressionSubView.tsx` | **実装済み (COMPLETED)** |

---

## 3. 主要コアサービスの機能一覧と検証根拠

| サービスファイル | 統合版 | マスター仕様書 | 実装されたコア機能 | テスト検証スクリプト |
|---|:---:|:---:|---|---|
| `claimDatabaseService.ts` | 第6章 | 第45章 | • 世界区分 (REAL/FICTION/HYPOTHETICAL)<br>• 6.7 自己生成情報の自己証明禁止<br>• 非LLM対称的矛盾検出 (detectContradictions)<br>• 上書き改訂 (SUPERSEDED) 追跡<br>• 7段階成熟度管理 | `scripts/test_unified_philosophy_services.ts`<br>(項目1-1〜1-4 パス) |
| `requestTypeCompilerService.ts` | 第10.1節 | 第91章 | • 自然言語から CompiledRequestType への確定コンパイル<br>• GOAL, TARGET, 成果物の抽出<br>• Option Explicit / 上書き禁止等の制約・禁止事項抽出<br>• 副作用・承認クラス判定<br>• 決定論的実行可否 (canExecuteDeterministically) 判定 | `scripts/test_unified_philosophy_services.ts`<br>(項目2 パス) |
| `componentRegistryService.ts` | 第9章 | 第168章 | • TXT部品パッケージ正本管理<br>• 完全一致 & 正規化コードハッシュ重複検査<br>• COLLECTED 〜 VERIFIED 状態遷移<br>• 決定論的VBAマクロ合成エンジン (synthesizeVbaMacro) | `scripts/test_unified_philosophy_services.ts`<br>(項目3-1〜3-2 パス) |
| `worldModelService.ts` | 第7.1〜7.2節 | 第52章 | • 行動前予測 (predictAction: 意図/トーン/記憶/リスク)<br>• 行動後差分計算 (recordOutcomeAndComputeError)<br>• Surprisal & 誤差強度スコア算出<br>• 文字2-gram近似による日本語記憶利用乖離判定 | `scripts/test_unified_philosophy_services.ts`<br>(項目4 パス) |
| `formalConstraintSolverService.ts` | 第8章, 第10.2節 | 第59章 | • CSP二項制約充足判定 (AC-3風ドメイン削減)<br>• モデル生成系ランタイムモデル重み不変保護制約 (UNSAT検出)<br>• プライバシー境界・ローカル隔離検証 | `scripts/test_unified_philosophy_services.ts`<br>(項目5-1〜5-2 パス) |
| `anaphora_resolver_sample.ts` | 第3章 | 第5章 | • 日本語照応解決 (さっきの/前のやつ/これ/それ/あれ)<br>• トピック → 事実 → 直近エンティティ優先順位 | `scripts/test_anaphora_resolution.ts`<br>(全10ケース 100% パス) |

---

## 4. レジストリ進捗サマリー (現在の達成度)

- **全章数:** 173章 (第0章〜第172章)
- **完了章数 (COMPLETED):** **61章** / 173章 (達成率: **35.3%**)
- **未登録・幽霊実装:** **0件** (全サービスが対応章と結合完了)
- **回帰テスト合格率:** **100% (31/31項目)**

---

## 5. 今後の開発・実装フロー指針

1. **新機能実装時:**
   - 統合版（第1章〜第16章）のどの設計思想に該当するかを特定する。
   - マスター仕様書（全173章）の対応章を確認し、`src/data/specificationRegistryData.ts` の `responsibleServices` / `responsibleComponents` に登録する。
2. **検証必須化:**
   - 単体テストスクリプト（`scripts/test_*.ts`）を作成し、実体動作（モック禁止）を検証する。
   - テスト合格をもって初めて `status: "COMPLETED"` に昇格させる。

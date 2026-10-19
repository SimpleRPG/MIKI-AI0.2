# P290 重複サービス実装Authority統合レポート

- 対象: P288のP1優先37組をP289現行ソースで再確認したうえで実装を統合。
- 正本規則: `src/miki/<domain>/services/<service>.ts` が実装・状態・singleton・副作用の唯一の所有者。
- 旧パス: `src/services/<service>.ts` を削除せず、正本への `export *` のみを持つ互換ファサードに変更。
- 結果: 37実装を統合、37ファサードを保持、監査対象37組内の独立した二重実装0組。既存import pathを維持。
- P288の本文一致25組／差分候補12組は履歴資料。P290では固有挙動を正本へ残してから旧本文を置換。
- GitHub main / PUSH / CI / TypeScript全体build / Android build / 実機E2Eは未実施。

## 実施内容

1. 37組の現行ソースを再読し、公開export、private state、singleton、永続化、直接静的import元、差分挙動を確認。
2. `src/services/` の37実装本体を単一re-exportに置換し、以前の呼び出し元パスを維持。
3. 日本語解析の空入力を明示的にguardし、正本側の決定論的fallbackを維持。
4. 統合設計書・統合台帳・検証スクリプトをP290へ更新し、静的依存辺と逆importerを再構築。

## 統合した差分の主な種類

| サービス | 正本側に保持した機能 |
|---|---|
| `longTermMemoryService.ts` | Uses the Miki deterministicRuntimeService embedding contract; legacy copy used nonLlmRuntimeService for the same deterministic feature embedding algorithm. Legacy storage/search API is retained through facade. |
| `requestTypeCompilerService.ts` | Preserves decomposeMultiIntent and intentPlan compilation. |
| `decisionLearningService.ts` | Keeps canonical evaluation flow; legacy difference was a syntax/local-binding rewrite with equivalent iteration semantics. |
| `skillsService.ts` | Preserves deterministic capability candidate graduation and legacy skill-record migration; no dataset/LoRA route is retained. |
| `capabilityGraphService.ts` | Canonical plan API supports exclusion list, environment and allowed component kinds, covering the legacy exclusion/environment parameters. |
| `japaneseDictionaryService.ts` | Keeps semantic dictionary graph lookup, source-priority merge and duplicate suppression. |
| `experienceRouterService.ts` | Keeps verified_candidate routing and routeToCapabilityCandidate; no legacy LoRA destination/export is reintroduced. |
| `featureFlagsService.ts` | Uses the canonical retired-flag policy; persisted old LORA_TRAINING values are only removed during migration. |
| `executionRunnerService.ts` | Keeps counterfactual measurement/review fields and validation, as a superset of the legacy runner contract. |
| `deterministicCapabilityEvolutionService.ts` | Keeps CapabilityLearningCandidate -> deterministic capability patch flow. Legacy TrainingSampleJSONL duplicate implementation is removed; existing active callers use candidate/evidence APIs. |
| `japaneseAnalysisService.ts` | Keeps question-intent and deterministic fallback; explicit empty-input guard now matches the legacy normalization contract. |
| `capabilityGapService.ts` | Keeps source/evidence metadata and promotion, unknown-task decomposition and experience-link integration; optional fields remain backward compatible. |

## 37組の正本・互換パスと監査根拠

| サービス | 互換パスの既存静的import元数 | 正本への直接import元数（互換ファサード除く） | P288履歴判定 | 本文一致（P288） |
|---|---:|---:|---|---|
| `vbaStaticVerifierService.ts` | 0 | 4 | `IDENTICAL_BODY_IMPORT_PATH_ONLY` | Yes |
| `testAssertionService.ts` | 0 | 2 | `IDENTICAL_BODY_IMPORT_PATH_ONLY` | Yes |
| `capabilityImplementationRegistryService.ts` | 0 | 2 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `componentVersionHistoryService.ts` | 1 | 5 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `hardeningRegressionCandidateService.ts` | 1 | 3 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `capabilityConfidenceService.ts` | 1 | 8 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `capabilityLearningService.ts` | 0 | 5 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `experienceFreshnessService.ts` | 0 | 4 | `IDENTICAL_BODY_IMPORT_PATH_ONLY` | Yes |
| `longTermMemoryService.ts` | 3 | 8 | `DEPENDENCY_SEMANTICS_DIVERGENCE` | No |
| `latentIntentMiningService.ts` | 1 | 6 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `failureMemoryService.ts` | 3 | 13 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `unifiedDecisionEngineService.ts` | 1 | 4 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `planOrchestratorService.ts` | 0 | 5 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `taskLineageService.ts` | 0 | 5 | `IDENTICAL_BODY_IMPORT_PATH_ONLY` | Yes |
| `capabilityReuseService.ts` | 2 | 6 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `affectionDynamicsService.ts` | 1 | 5 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE` | Yes |
| `componentArtifactStoreService.ts` | 3 | 8 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY` | Yes |
| `implementationSelectionService.ts` | 1 | 2 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `privacyGuardrailService.ts` | 3 | 10 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE` | Yes |
| `abstractSanitizerService.ts` | 0 | 4 | `IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE` | Yes |
| `deterministicCapabilityExecutionService.ts` | 1 | 2 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `taskExecutionOrchestratorService.ts` | 0 | 7 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `requestTypeCompilerService.ts` | 2 | 6 | `BEHAVIORAL_DIVERGENCE_MIKI_HAS_MULTI_INTENT_PLAN` | No |
| `executionRouteRankingService.ts` | 0 | 2 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `downstreamImpactService.ts` | 1 | 3 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `decisionLearningService.ts` | 0 | 4 | `SMALL_SOURCE_FORMAT_OR_LOCAL_BINDING_DIVERGENCE` | No |
| `nonLlmHardwarePipelineService.ts` | 1 | 1 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `skillsService.ts` | 1 | 5 | `BEHAVIORAL_DIVERGENCE_MIKI_USES_DETERMINISTIC_CANDIDATE_FLOW` | No |
| `capabilityGraphService.ts` | 3 | 5 | `PUBLIC_METHOD_CONTRACT_DIVERGENCE` | No |
| `japaneseDictionaryService.ts` | 0 | 6 | `BEHAVIORAL_DIVERGENCE_MIKI_HAS_SEMANTIC_GRAPH_LOOKUP` | No |
| `experienceRouterService.ts` | 1 | 4 | `BEHAVIORAL_DIVERGENCE_LEGACY_RETAINS_LORA_ROUTE` | No |
| `featureFlagsService.ts` | 0 | 5 | `BEHAVIORAL_DIVERGENCE_FEATURE_FLAG_POLICY` | No |
| `failureRecoveryService.ts` | 0 | 3 | `IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS` | Yes |
| `executionRunnerService.ts` | 8 | 22 | `PUBLIC_CONTRACT_AND_COUNTERFACTUAL_BEHAVIOR_DIVERGENCE` | No |
| `deterministicCapabilityEvolutionService.ts` | 0 | 3 | `INPUT_CONTRACT_DIVERGENCE` | No |
| `japaneseAnalysisService.ts` | 3 | 4 | `BEHAVIORAL_DIVERGENCE_JAPANESE_ANALYSIS` | No |
| `capabilityGapService.ts` | 2 | 25 | `BEHAVIORAL_DIVERGENCE_CAPABILITY_GAP_EVIDENCE_AND_COORDINATION` | No |

## 意図的に保持した同一バイトのパス

- `android-native/.../MIKIJapaneseMorphologyPlugin.kt` と `android/app/.../MIKIJapaneseMorphologyPlugin.kt`: インストールスクリプトが正本テンプレートをアプリ側へコピーするため両方必要。
- `android/app/.../drawable-land-mdpi/splash.png` と `drawable/splash.png`: Androidのresource qualifier別のパス。
- `android/app/.../ic_launcher.xml` と `ic_launcher_round.xml`: Androidのlauncher name別パス。
- `android-native/.../MikiBackgroundWorker.kt` と `android/app/.../MikiBackgroundWorker.kt`: アプリ側がruntimeソース。native側は現行の検証スクリプトが比較対象にしており、インストーラはアプリ側を上書きしないため今回は削除せず、次の用途整理候補として保留。

## 検証結果

| 検証 | 結果 |
|---|---|
| サービスAuthority検証 | PASS — 16項目、37ファサードの転送先・正本契約・LoRA経路を確認 |
| 台帳検証 | PASS — 1,788パスのSHA-256／行数、静的依存・逆importer、到達性、Markdown行数を確認 |
| LoRA退役検証 | PASS — 34項目、識別子4か所は保存済み旧データ／旧Flagの一回限り移行だけ |
| 相対import検査 | 3,398件中1件未解決。`node_modules`未配置により `scripts/analyze_static_bundle_graph.mjs` のTypeScriptライブラリ相対パスが見つからず。TypeScriptはdevDependency宣言済み |
| 全体型検査・ビルド・端末動作 | 未実施 |

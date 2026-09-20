# MIKI-AI0.2 V224 Build Repair

対象: `main` のP0-P3統合後に発生したTypeScript/Vite build failure群。

## 修正した主な契約

- Multi-Intent APIをCORE既存契約へ復元し、`MultiIntentPlan` / `decomposeMultiIntent()` / `selectMultiIntentHypothesis()` / `scoreMultiIntentHypotheses()` を再提供。
- `CoreTaskIngressService` が利用していた `MultiIntentDecompositionService.decompose()` も互換アダプタとして維持。
- `APPROVE_REVIEWED_CANDIDATE` を既存 `DomainCommand` に正式登録。
- `mikiCategoryInteractionRuntime` / `coreTaskIngressService` の payload を `Record<string, unknown>` として固定。
- `coreOrchestratorService` のEnvironment Drift / cognitive state / unresolved/capability collectionの型・実装不整合を修正。
- `ClaimVerificationStatus.UNRESOLVED` のrank漏れを修正。
- `nonLlmCoreService` の説明量適応関数import漏れを修正。
- `SelfImplementationResult.snapshotId` の返却漏れを修正。
- `schemaValidationService` 等の `string | false` filter narrowingを修正。
- Conversation Component / temporal state / provenance / runtime answer selection の型不整合を修正。
- Runtime answer selectionについて、既存の回答候補生成を置き換えず、決定論的selection recordを構築。
- Component Compositionの入出力型判定を既存契約だけで検証する形に修正。

## 検証

- 修正対象20ファイルのTypeScript transpile/syntax diagnostics: PASS
- Multi-Intent runtime smoke test: PASS
- `調べて、修正して、最後に説明して` → 3 intentへ分解できることを確認
- `APPROVE_REVIEWED_CANDIDATE` のDomainCommand契約: PASS

完全な `npm run lint` / `npm run build` はこの作業環境で依存関係取得がタイムアウトしたため実行完了を確認できていません。
Termux側では既存の `npm ci` 状態を利用して `npm run lint` → `npm run build` → `npm run verify:p0-gate` → `npm run test:p123` の順に確認してください。

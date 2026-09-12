MIKI-AI0.2 v63 — SimpleRPG Auto Audit / Auto Learning

目的
- MikiがSimpleRPGの現行参照資産を自動監査し、決定論的RPGアダプタを能力Registryへ同期する。
- 手動で「VERIFIED」を付けるのではなく、実際の自動監査PASS時だけ内部アダプタをVERIFIEDへ同期する。
- 参照ゲームは独立して更新されるため、関連source fileのfingerprintを毎回計算し、更新を検出する。
- 参照ゲームのJSをMikiの実行コードとしてimportしない。

自動処理
1. server起動時にSimpleRPG Auto Auditを実行。
2. reference/simple-rpg の関連ファイルからsource fingerprintを計算。
3. Miki側Rule Engineについて以下を自動確認。
   - eval / new Function / Math.random がない。
   - 同一入力の再実行結果がJSON一致する。
   - 戦闘結果のHP下限など基本不変条件を確認する。
4. PASSした能力群をsimple_rpg.* ComponentとしてRegistryへ同期。
5. FAILした能力群はANALYZEDへ戻し、実行候補から除外。
6. 使用回数は決定論的に記録し、後続の改善判断に利用可能。

重要な境界
- VERIFIEDは「Miki内の決定論的アダプタ契約が自動監査をPASSした」という意味。
- SimpleRPG本体との完全な仕様同一性・byte-for-byte parityを意味しない。
- ゲーム本体の更新を検出しても、参照コードを勝手にMikiへ取り込まない。
- 任意コード生成・eval・new Function・ランダム実行は使わない。

API
GET  /api/miki/rpg/capabilities
POST /api/miki/rpg/capabilities/audit
POST /api/miki/rpg/action

テスト
node scripts/test_simple_rpg_auto_learning_v63.mjs
node scripts/test_simple_rpg_deterministic_v62.mjs
node scripts/test_simple_rpg_recovery_v61.mjs
node scripts/test_deterministic_capability_execution_v59.mjs
node scripts/test_non_llm_pipeline_v58.mjs
node scripts/test_no_local_generative_runtime_v55.mjs
node scripts/test_non_llm_final_boundary_v54.mjs

注意
この環境ではnode_modules/typescriptが利用できないため、full tsc/vite buildの成功は主張しない。

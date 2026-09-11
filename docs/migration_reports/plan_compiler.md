# 要求型と計画（要求コンパイラ・能力契約・制約ソルバー）シミュレーション検証レポート

> **⚠️ 暫定版・シミュレーション検証**
> 本レポートはシミュレーションデータおよび単体テストによるロジック健全性確認レポートです（※実機端末での実測ログではありません）。

---

## 1. 概要
- **対象機能**: 要求コンパイラ（Skill IR VM）、形式制約ソルバー（CSP / 二項制約検証）、能力契約プラグイン（権限診断・安全フォールバック）、および不足能力ギャップ追跡
- **配置ファイル**:
  - `src/services/skillIrCompilerService.ts`（決定論的仮想マシン `executeIR` 前提・後置条件検証ロジックへ改修）
  - `src/services/formalConstraintSolverService.ts`（二項制約 CSP 矛盾検証 `solveCSP`）
  - `src/services/capabilityPluginService.ts`（能力契約、権限診断、未同意プラグインの安全フォールバック）
  - `src/services/capabilityGapService.ts`（不足能力ギャップ記録と代替プラグイン照合）
- **呼出配線**:
  - `src/App.tsx`: 1015, 1017行目（能力契約プラグイン照合・権限診断）
  - `src/App.tsx`: 1032行目（形式制約充足検証 CSP シャドー実行）
  - `src/App.tsx`: 1041行目（技能IR仮想マシンシャドー実行）
  - `src/App.tsx`: 2802, 2803行目（ギャップ記録時の形式制約検査および代替プラグイン照合）
- **検証スクリプト**: `scripts/test_phase4_plan_compiler.ts`

---

## 2. 公開メソッド一覧および配線状況

| ファイル | 行数 | App.tsx 配線状況（`grep -rn` 実測） | 主要公開メソッドと入出力要約 |
|---|---|---|---|
| `src/services/skillIrCompilerService.ts` | 326 | **1件** (1041行目) | `compileToIR(name, rules): CompiledSkillIR`<br>自然言語ルール列を中間表現へ変換。<br>`executeIR(skillId, inputArgs): SkillVmExecutionResult`<br>前提条件・後置条件を検証し、決定論的に結果・トレースを出力。 |
| `src/services/formalConstraintSolverService.ts` | 150 | **2件** (1032行目, 2803行目) | `solveCSP(variables, constraints): ConstraintSolveResult`<br>AC-3アルゴリズムによりドメインを枝刈りし、制約充足 (SAT) か矛盾 (UNSAT) かを出力。<br>`verifyPatchConstraints(ch, deps)`<br>パッチの禁止シンボル抵触を検証。 |
| `src/services/capabilityPluginService.ts` | 662 | **3件** (1015行目, 1017行目, 2802行目) | `findBestPluginForTask(goal): CapabilityPlugin`<br>要求文脈から最適なプラグインを推論。<br>`checkPermissions(pluginId)`<br>未承認権限を診断。<br>`isToolPermitted(toolId)`<br>実行可否を判定。 |
| `src/services/capabilityGapService.ts` | 491 | **4件** (2777行目, 2780行目, 2783行目, 2791行目) | `recordGap(entry): CapabilityGapEntry`<br>不足能力ギャップを採番・記録し習得プロファイルを降格。<br>`recordSuccess(capId): void`<br>成功実績を累積し状態を昇格。 |

---

## 3. 直列構造の有無および型整合性の確認結果

### ① `skillIrCompilerService` → `formalConstraintSolverService` の直列構造の有無
- **確認結果**: **直列構造は存在しない**（事実として確認）
- **理由**: `skillIrCompilerService.compileToIR()` の戻り値は `CompiledSkillIR`（オペコード列 `instructions: SkillInstruction[]`）であり、`formalConstraintSolverService.solveCSP()` の入力型は `variables: Record<string, unknown[]>` と `BinaryConstraint[]` である。
  型の構造が完全に異なり、直列接続を想定したインターフェースにはなっていない。
- **対応**: 直列配線を無理に構築せず、`executeIR()` に「前提条件（Option Explicit有無、システム不変条件）、後置条件（セル反復ループ禁止、モックスタブ禁止）を実際に検査して成功/失敗を判定する」決定論的検証ロジックを実装。また、`formalConstraintSolverService` はシステム変数に対する独立した二項制約検証として単独でシャドー配線を実施。

### ② `capabilityGapService` と `capabilityPluginService` の型整合性
- **確認結果**: **整合確認済み**
- **対応関係**:
  - `capabilityGapService` の `capabilityId`（`cap_abstract_vba_design`, `cap_code_comprehension` 等）およびタスク要求テキストに対し、`capabilityPluginService` の各プラグイン（`plugin_vba_validation`, `plugin_code_analysis` 等）が1対1に対応。
  - ギャップ発生時（`recordGap` 時）に、不足能力を補完・代替できるプラグインが存在するか、またそのプラグインが同意取得済み（`ACTIVE`）であるかを照合可能。

---

## 4. 単体テスト実行生出力（反例ケースを含む全13テスト）

以下は `npx tsx scripts/test_phase4_plan_compiler.ts` の全実行ログです。
前提違反、セル反復ループ検出、不変条件違反、CSPモデル重み矛盾 (UNSAT)、機密外部送信矛盾 (UNSAT)、未同意プラグインの安全フォールバック、ツール実行拒否判定など、すべての意図的反例が正しく検知されることを実証しています。

```
================================================================
🧪 フェーズ4: 要求型と計画 (要求コンパイラ/能力契約/制約ソルバー) 単体テスト
================================================================

【グループ1: skillIrCompilerService 決定論的検証 & 反例検知】
  [1-1 正常系実行]: success=true, 命令数=5
✅ [PASS] 前提条件を満たす入力で executeIR が success: true となること
  [1-2 反例 Option Explicit欠落]: success=false, trace=[OP_ASSERT_PRECONDITION] System Invariants Clear, Option Explicit present (不変条件および型厳格宣言確認) -> FAILED: Option Explicit が宣言されていません
✅ [PASS] Option Explicit 欠落時に前提条件違反で success: false となること
  [1-3 反例 セル反復ループ検知]: success=false, trace=[OP_VALIDATE_POSTCONDITION] No Cell-by-Cell Loop (反復セルアクセス禁止検証) -> FAILED: セル単位反復ループが検出されました
✅ [PASS] セル単位ループ検出時に後置条件違反で success: false となること
  [1-4 反例 システム不変条件違反]: success=false, trace=[OP_ASSERT_PRECONDITION] System Invariants Clear, Option Explicit present (不変条件および型厳格宣言確認) -> FAILED: システム不変条件違反が検知されました
✅ [PASS] システム不変条件違反フラグ検知時に success: false となること

【グループ2: formalConstraintSolverService CSP形式検証 & 矛盾検知】
[2026-09-11T07:02:01.096Z]  [INFO ] [SELF_IMPROVEMENT] [第59章 制約ソルバー] CSP形式検証完了: 充足 (SAT) { contradictions: [], iterations: 2 }
  [2-1 SAT判定]: isSatisfied=true, 矛盾数=0
✅ [PASS] 正当な変数ドメインにおいて CSP が SAT (充足) と判定されること
[2026-09-11T07:02:01.096Z]  [INFO ] [SELF_IMPROVEMENT] [第59章 制約ソルバー] CSP形式検証完了: 矛盾あり (UNSAT) {
  contradictions: [ '変数 [targetModel] と [activeWeights] の間で制約違反: Qwen 3Bモデル重み不変保護制約' ],
  iterations: 2
}
  [2-2 UNSAT Qwen重み保護違反]: isSatisfied=false, 矛盾=[変数 [targetModel] と [activeWeights] の間で制約違反: Qwen 3Bモデル重み不変保護制約]
✅ [PASS] モデル重み保護制約に違反した場合に UNSAT (矛盾) と判定されること
[2026-09-11T07:02:01.097Z]  [INFO ] [SELF_IMPROVEMENT] [第59章 制約ソルバー] CSP形式検証完了: 矛盾あり (UNSAT) {
  contradictions: [
    '変数 [dataPrivacyLevel] と [networkDestination] の間で制約違反: 機密データの外部送信遮断制約'
  ],
  iterations: 2
}
  [2-3 UNSAT 機密外部送信違反]: isSatisfied=false, 矛盾=[変数 [dataPrivacyLevel] と [networkDestination] の間で制約違反: 機密データの外部送信遮断制約]
✅ [PASS] 機密データの非暗号化外部送信時に UNSAT と判定されること

【グループ3: capabilityPluginService 能力契約 & 権限診断】
  [3-1 未同意時フォールバック]: 選定=コード解析・構造診断能力 (MoE & 圧縮) (plugin_code_analysis), 状態=ACTIVE
✅ [PASS] 未同意(TESTED)のWebプラグイン要求に対し安全代替(plugin_code_analysis)へフォールバックすること
  [3-2 カテゴリ検索]: 発見数=1, ID=plugin_web_search
✅ [PASS] カテゴリ検索で plugin_web_search が特定できること
  [3-3 権限チェック]: hasAllPermissions=false, missing=[network_cloud, sensitive_filter]
✅ [PASS] 未同意プラグインの必要権限が正しく未承認(missing)として検出されること
  [3-4 ツール許可チェック]: permitted=false, reason=テストは完了していますが、まだユーザーの権限同意が済んでいません。
✅ [PASS] TESTED段階(未承認)プラグインのツールが実行禁止(permitted: false)となること

【グループ4: capabilityGapService ギャップ記録 & 代替能力照合】
  [4-1 ギャップ登録]: gap_id=GAP-0012, capabilityId=cap_logical_priority
✅ [PASS] 不足能力ギャップが正常に採番・記録されること
  [4-2 代替プラグイン照合]: plugin=VBA静的検証・モダン変換能力, id=plugin_vba_validation
✅ [PASS] VBA不備に対して plugin_vba_validation が代替候補として特定できること

================================================================
📊 テスト結果: 13 / 13 通過 (100%)
================================================================
```

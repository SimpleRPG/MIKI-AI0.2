/**
 * 【フェーズ4検証】要求型と計画（要求コンパイラ・能力契約・形式制約ソルバー）シミュレーション単体テスト
 *
 * 本スクリプトは、以下の4サービスの動作健全性、直列/並列構造の特性、および
 * 意図的な反例（前提違反・制約矛盾・権限不足）に対する堅牢性を検証するためのシミュレーションテストです。
 * - skillIrCompilerService (命令の決定論的検証仮想マシン)
 * - formalConstraintSolverService (CSP制約充足と矛盾検知)
 * - capabilityPluginService (能力契約・権限診断)
 * - capabilityGapService (不足能力と代替プラグイン連携)
 */
import { skillIrCompilerService } from '../src/services/skillIrCompilerService';
import { formalConstraintSolverService } from '../src/services/formalConstraintSolverService';
import { capabilityPluginService } from '../src/services/capabilityPluginService';
import { capabilityGapService } from '../src/services/capabilityGapService';

let passCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    passCount++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

function runPhase4Tests() {
  console.log('================================================================');
  console.log('🧪 フェーズ4: 要求型と計画 (要求コンパイラ/能力契約/制約ソルバー) 単体テスト');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // テストグループ1: skillIrCompilerService の決定論的検証と意図的失敗 (反例) 検知
  // --------------------------------------------------------------------------
  console.log('【グループ1: skillIrCompilerService 決定論的検証 & 反例検知】');

  // 1-1. 正常系: 前提条件（Option Explicit等）を満たすVBA入力
  const validVbaArgs = {
    sourceCode: 'Option Explicit\nSub FastBatch()\n  Dim arr As Variant\n  arr = Range("A1:Z100").Value\nEnd Sub',
    sheetName: 'Sheet1',
    rangeAddress: 'A1:Z100',
  };
  const validResult = skillIrCompilerService.executeIR('skill_vba_batch_array', validVbaArgs);
  console.log(`  [1-1 正常系実行]: success=${validResult.success}, 命令数=${validResult.instructionsExecuted}`);
  assert(validResult.success === true, '前提条件を満たす入力で executeIR が success: true となること');

  // 1-2. 反例1: Option Explicit 欠落による前提条件違反 (OP_ASSERT_PRECONDITION)
  const missingOptionExplicitArgs = {
    sourceCode: 'Sub Slow()\n  Range("A1").Value = 1\nEnd Sub',
  };
  const failOptionExplicit = skillIrCompilerService.executeIR('skill_vba_batch_array', missingOptionExplicitArgs);
  console.log(`  [1-2 反例 Option Explicit欠落]: success=${failOptionExplicit.success}, trace=${failOptionExplicit.executionTrace.slice(-1)[0]}`);
  assert(failOptionExplicit.success === false, 'Option Explicit 欠落時に前提条件違反で success: false となること');

  // 1-3. 反例2: セル単位反復ループによる後置条件違反 (OP_VALIDATE_POSTCONDITION)
  const cellLoopArgs = {
    sourceCode: 'Option Explicit\nSub LoopCells()\n  For Each cell In Range("A1:A100")\n    cell.Value = 1\n  Next cell\nEnd Sub',
  };
  const failCellLoop = skillIrCompilerService.executeIR('skill_vba_batch_array', cellLoopArgs);
  console.log(`  [1-3 反例 セル反復ループ検知]: success=${failCellLoop.success}, trace=${failCellLoop.executionTrace.slice(-1)[0]}`);
  assert(failCellLoop.success === false, 'セル単位ループ検出時に後置条件違反で success: false となること');

  // 1-4. 反例3: システム不変条件違反
  const invariantViolationArgs = {
    sourceCode: 'Option Explicit\nSub Safe()\nEnd Sub',
    __invariant_violation__: true,
  };
  const failInvariant = skillIrCompilerService.executeIR('skill_vba_batch_array', invariantViolationArgs);
  console.log(`  [1-4 反例 システム不変条件違反]: success=${failInvariant.success}, trace=${failInvariant.executionTrace.slice(-1)[0]}`);
  assert(failInvariant.success === false, 'システム不変条件違反フラグ検知時に success: false となること');

  // --------------------------------------------------------------------------
  // テストグループ2: formalConstraintSolverService (CSP形式検証と矛盾検知)
  // --------------------------------------------------------------------------
  console.log('\n【グループ2: formalConstraintSolverService CSP形式検証 & 矛盾検知】');

  // 2-1. 正常系 (SAT): モデル重み不変かつセキュア通信
  const satVars = {
    targetModel: ['Qwen-3B-Base'],
    activeWeights: ['IMMUTABLE'],
    dataPrivacyLevel: ['CONFIDENTIAL'],
    networkDestination: ['INTERNAL', 'EXTERNAL_ENCRYPTED'],
  };
  const satResult = formalConstraintSolverService.solveCSP(satVars);
  console.log(`  [2-1 SAT判定]: isSatisfied=${satResult.isSatisfied}, 矛盾数=${satResult.contradictionsFound.length}`);
  assert(satResult.isSatisfied === true, '正当な変数ドメインにおいて CSP が SAT (充足) と判定されること');

  // 2-2. 反例1 (UNSAT): モデル生成系ランタイム モデル重みが変更可能 (MUTABLE) と指定された矛盾
  const unsatModelVars = {
    targetModel: ['Qwen-3B-Base'],
    activeWeights: ['MUTABLE'],
  };
  const unsatModelResult = formalConstraintSolverService.solveCSP(unsatModelVars);
  console.log(`  [2-2 UNSAT Qwen重み保護違反]: isSatisfied=${unsatModelResult.isSatisfied}, 矛盾=[${unsatModelResult.contradictionsFound.join(', ')}]`);
  assert(unsatModelResult.isSatisfied === false, 'モデル重み保護制約に違反した場合に UNSAT (矛盾) と判定されること');

  // 2-3. 反例2 (UNSAT): 機密データ (CONFIDENTIAL) が暗号化なし外部宛先へ送信される矛盾
  const unsatPrivacyVars = {
    dataPrivacyLevel: ['CONFIDENTIAL'],
    networkDestination: ['EXTERNAL_UNENCRYPTED'],
  };
  const unsatPrivacyResult = formalConstraintSolverService.solveCSP(unsatPrivacyVars);
  console.log(`  [2-3 UNSAT 機密外部送信違反]: isSatisfied=${unsatPrivacyResult.isSatisfied}, 矛盾=[${unsatPrivacyResult.contradictionsFound.join(', ')}]`);
  assert(unsatPrivacyResult.isSatisfied === false, '機密データの非暗号化外部送信時に UNSAT と判定されること');

  // --------------------------------------------------------------------------
  // テストグループ3: capabilityPluginService (能力契約・権限診断・安全フォールバック)
  // --------------------------------------------------------------------------
  console.log('\n【グループ3: capabilityPluginService 能力契約 & 権限診断】');

  // 3-1. 未同意状態での安全フォールバック動作
  const fallbackMatch = capabilityPluginService.findBestPluginForTask('最新のTypeScript仕様をWebで検索して調査したい');
  console.log(`  [3-1 未同意時フォールバック]: 選定=${fallbackMatch?.name} (${fallbackMatch?.plugin_id}), 状態=${fallbackMatch?.status}`);
  assert(
    fallbackMatch?.plugin_id === 'plugin_code_analysis',
    '未同意(TESTED)のWebプラグイン要求に対し安全代替(plugin_code_analysis)へフォールバックすること'
  );

  // 3-2. カテゴリ検索による潜在プラグイン照合
  const webCandidates = capabilityPluginService.findPluginsByCategory('web_search');
  console.log(`  [3-2 カテゴリ検索]: 発見数=${webCandidates.length}, ID=${webCandidates[0]?.plugin_id}`);
  assert(webCandidates[0]?.plugin_id === 'plugin_web_search', 'カテゴリ検索で plugin_web_search が特定できること');

  // 3-3. 権限確認: 未同意プラグインに対するアクセス制限判定
  const permCheck = capabilityPluginService.checkPermissions('plugin_web_search');
  console.log(`  [3-3 権限チェック]: hasAllPermissions=${permCheck.hasAllPermissions}, missing=[${permCheck.missing.join(', ')}]`);
  assert(permCheck.missing.length > 0, '未同意プラグインの必要権限が正しく未承認(missing)として検出されること');

  // 3-4. ツール実行許可チェック
  const toolCheck = capabilityPluginService.isToolPermitted('tool_gemini_cloud_search');
  console.log(`  [3-4 ツール許可チェック]: permitted=${toolCheck.permitted}, reason=${toolCheck.reason || 'OK'}`);
  assert(toolCheck.permitted === false, 'TESTED段階(未承認)プラグインのツールが実行禁止(permitted: false)となること');

  // --------------------------------------------------------------------------
  // テストグループ4: capabilityGapService との連携 (不足能力発生と代替照合)
  // --------------------------------------------------------------------------
  console.log('\n【グループ4: capabilityGapService ギャップ記録 & 代替能力照合】');

  // 4-1. ギャップ登録
  const gap = capabilityGapService.recordGap({
    description: '[テスト] 三重例外の優先順位判定不備',
    gap_type: 'failure',
    capabilityId: 'cap_logical_priority',
    impact: 'HIGH',
    current_workaround: '決定表変換',
    candidate_solution: '決定表骨格配備',
    samplePrompt: 'テスト用プロンプト',
  });
  console.log(`  [4-1 ギャップ登録]: gap_id=${gap.gap_id}, capabilityId=${gap.capabilityId}`);
  assert(gap.gap_id.startsWith('GAP-'), '不足能力ギャップが正常に採番・記録されること');

  // 4-2. ギャップに対する代替プラグイン照合
  const fallbackPlugin = capabilityPluginService.findBestPluginForTask('Excel VBAの数式エラーを修正したい');
  console.log(`  [4-2 代替プラグイン照合]: plugin=${fallbackPlugin?.name}, id=${fallbackPlugin?.plugin_id}`);
  assert(fallbackPlugin?.plugin_id === 'plugin_vba_validation', 'VBA不備に対して plugin_vba_validation が代替候補として特定できること');

  console.log('\n================================================================');
  console.log(`📊 テスト結果: ${passCount} / ${totalCount} 通過 (${Math.round((passCount / totalCount) * 100)}%)`);
  console.log('================================================================');

  if (passCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase4Tests();

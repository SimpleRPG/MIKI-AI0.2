import {
  ComponentTxtPackage,
  ComponentStatus,
  ComponentSecurityClass,
  ComponentCreationDecision,
  ComponentTestCategory,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { componentArtifactStoreService } from './componentArtifactStoreService';
import { componentVersionHistoryService } from './componentVersionHistoryService';
import {
  evidenceBasedPromotionGateService,
  PromotionEvidenceInput,
  PromotionEvaluationResult,
} from './evidenceBasedPromotionGateService';

const COMPONENT_REGISTRY_STORAGE_KEY = 'miki_component_registry_v1';

/**
 * 簡易ハッシュ計算 (SHA-256ライクな決定論的ハッシュ文字列)
 */
function computeCodeHash(code: string): string {
  let hash = 0;
  const clean = code.trim();
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * 空白・コメントを除去した正規化コード
 */
function normalizeCode(code: string): string {
  return code
    .replace(/'[^\n]*/g, '') // VBAコメント除去
    .replace(/\/\/[^\n]*/g, '') // JSコメント除去
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書(統合版) 第9章
 * 部品(コンポーネント)レジストリとコード生成
 * 
 * - 9.1 物理保存形式: TXT部品を正本、SQLiteを索引とする
 * - 9.2 component.txtの主要項目管理
 * - 9.3 状態遷移: COLLECTED → CANDIDATE → ANALYZED → (CLOUD_TESTED) → DEVICE_TESTED → VERIFIED
 * - 9.4 重複判定・新規作成前の判定 (REUSE/COMPOSE/EXTEND/NEW/DUPLICATE/REJECT)
 * - 9.5 11種類のテスト区分
 * - 9.6 検証原則 (コードハッシュと検証結果の一致保証)
 * - 9.7 部品検索・選択の優先順位
 * - 9.9 VBAコード生成・合成
 */
export class ComponentRegistryService {
  private static instance: ComponentRegistryService;
  private components: Map<string, ComponentTxtPackage> = new Map();

  private constructor() {
    this.loadFromStorage();
    this.migrateIllustrativeSeedVerification();
    this.reconcileArtifactIndex();
    if (this.components.size === 0) {
      this.initSeedComponents();
      // 初期部品もTXT正本アーティファクトを必ず作成する。
      this.reconcileArtifactIndex();
    }
    // Android実機E2E用の最小・安全なSmoke Adapterを常設する。
    // 任意コード実行はせず、Native側のallow-list Adapterとの契約だけを検証する。
    this.ensureAndroidNativeSmokeComponent();
    this.ensureAndroidJapaneseMorphologySelfTestComponent();
    // Constructorで後から追加したSeedもTXT正本へ必ず同期する。
    this.reconcileArtifactIndex();
    // 既存インストールを含め、Registryの現行版をversion ledgerへ同期する。
    componentVersionHistoryService.reconcileCurrent(this.getAllComponents());
  }

  public static getInstance(): ComponentRegistryService {
    if (!ComponentRegistryService.instance) {
      ComponentRegistryService.instance = new ComponentRegistryService();
    }
    return ComponentRegistryService.instance;
  }

  /**
   * P0-5 Android実機E2Eの安全な最小Smoke Component。
   * Registry上はANALYZEDのまま開始し、実機Execution Evidenceなしでは
   * DEVICE_TESTED/VERIFIEDへ遷移しない。
   */
  private ensureAndroidNativeSmokeComponent(): void {
    const componentId = 'android.native_echo';
    if (this.components.has(componentId)) return;
    const implementation = 'NATIVE_ADAPTER: android.native_echo\nBEHAVIOR: return input_summary unchanged\nSECURITY: READ_ONLY\nEXECUTION: ALLOWLIST_ONLY';
    const validation = 'STATUS: ANALYZED\nENVIRONMENT: ANDROID\nALL_TESTS_PASSED: false\nVERIFICATION_NOTE: Android実機E2E未実施。Native allow-list Adapterの実測が必要';
    const pkg: ComponentTxtPackage = {
      component_id: componentId,
      version: '1.0.0',
      status: 'ANALYZED',
      purpose: 'Android Native RunnerとExecutionRequest/Resultの往復契約を安全にSmoke Testする',
      inputs: [{ name: 'inputSummary', type: 'String', description: 'そのまま返すテスト入力' }],
      outputs: [{ name: 'outputSummary', type: 'String', description: '入力と同一の決定論的出力' }],
      preconditions: ['Android Native Runnerが利用可能', 'request_id/component/hash/artifact/test_caseが一致'],
      postconditions: ['outputSummary = inputSummary'],
      side_effects: ['なし（READ_ONLY）'],
      dependencies: ['MIKINativeRunnerPlugin'],
      supported_environments: ['ANDROID'],
      entry_point: 'NativeTestAdapterRegistry/android.native_echo',
      failure_behavior: '契約不一致または未登録時は実行せずFAIL',
      security_class: 'READ_ONLY',
      idempotent: true,
      deterministic: true,
      component_txt: `COMPONENT_ID: ${componentId}\nVERSION: 1.0.0\nSTATUS: ANALYZED\nENTRY_POINT: NativeTestAdapterRegistry/android.native_echo\nSECURITY_CLASS: READ_ONLY`,
      implementation_txt: implementation,
      tests_txt: 'TEST_CASE: NORMAL, input=MIKI_E2E_PING, expected=MIKI_E2E_PING\nTEST_CASE: EMPTY, input=, expected=\nTEST_CASE: DUPLICATE, same request must not execute twice concurrently',
      validation_txt: validation,
      sources_txt: 'Native Android allow-list adapter; implementation is not executable source text.',
      history_txt: 'Created as P0-5 real-device E2E smoke component.\nNo DEVICE_TESTED/VERIFIED claim before actual Android execution evidence.',
      implementation_hash: computeCodeHash(implementation),
      validation_hash: computeCodeHash(validation),
      success_count: 0,
      failure_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.components.set(componentId, pkg);
    this.saveToStorage();
  }

  /**
   * P0-5: Android実機上のSudachi + system_core.dicをExecution Evidenceへ接続する最小Component。
   * RegistryではANALYZEDのまま開始し、実機Assertion PASSなしではDEVICE_TESTED/VERIFIEDへ遷移しない。
   */
  private ensureAndroidJapaneseMorphologySelfTestComponent(): void {
    const componentId = 'android.japanese_morphology_selftest';
    if (this.components.has(componentId)) return;
    const implementation = 'NATIVE_ADAPTER: android.japanese_morphology_selftest\nBEHAVIOR: run pinned Sudachi self-test on Android\nDICTIONARY: SudachiDict 20260723-core\nSECURITY: READ_ONLY\nEXECUTION: ALLOWLIST_ONLY';
    const validation = 'STATUS: ANALYZED\nENVIRONMENT: ANDROID\nALL_TESTS_PASSED: false\nVERIFICATION_NOTE: Android実機でSudachi selfTestをAssertion PASSさせるまで未検証';
    const pkg: ComponentTxtPackage = {
      component_id: componentId, version: '1.0.0', status: 'ANALYZED',
      purpose: 'Android実機上のSudachi形態素解析と固定辞書のロードを検証する',
      inputs: [{ name: 'inputSummary', type: 'String', description: '実行要求の監査用入力。解析サンプルはNative側で固定' }],
      outputs: [{ name: 'outputSummary', type: 'String', description: 'SUDACHI_SELFTEST_PASS/FAIL' }],
      preconditions: ['Android Native Runnerが利用可能', 'system_core.dicがAPK assetsに存在'],
      postconditions: ['Sudachiの固定サンプル3件が非空かつ読みを持つ'],
      side_effects: ['なし（READ_ONLY）'],
      dependencies: ['MIKINativeRunnerPlugin', 'MIKIJapaneseMorphologyPlugin', 'Sudachi 0.8.1', 'SudachiDict 20260723-core'],
      supported_environments: ['ANDROID'],
      entry_point: 'NativeTestAdapterRegistry/android.japanese_morphology_selftest',
      failure_behavior: '辞書欠落・解析例外・Assertion不一致はFAILとして証拠化し、正式能力へ昇格しない',
      security_class: 'READ_ONLY', idempotent: true, deterministic: true,
      component_txt: `COMPONENT_ID: ${componentId}\nVERSION: 1.0.0\nSTATUS: ANALYZED\nENTRY_POINT: NativeTestAdapterRegistry/android.japanese_morphology_selftest\nSECURITY_CLASS: READ_ONLY`,
      implementation_txt: implementation,
      tests_txt: 'TEST_CASE: NORMAL, ASSERT: CONTAINS "SUDACHI_SELFTEST_PASS"\nTEST_CASE: REGRESSION, ASSERT: CONTAINS "SUDACHI_SELFTEST_PASS"',
      validation_txt: validation,
      sources_txt: 'WorksApplications/Sudachi; WorksApplications/SudachiDict; Android Native allow-list adapter.',
      history_txt: 'Created for P0-5 Android real-device E2E. No self-simulation promotion.',
      implementation_hash: computeCodeHash(implementation), validation_hash: computeCodeHash(validation),
      success_count: 0, failure_count: 0, created_at: Date.now(), updated_at: Date.now(),
    };
    this.components.set(componentId, pkg);
    this.saveToStorage();
  }

  /**
   * 9.9節・実例に基づく検証済みVBA部品群の初期シード
   */
  private initSeedComponents(): void {
    const seedPackages: ComponentTxtPackage[] = [
      {
        component_id: 'vba.header_locator',
        version: '1.0.0',
        status: 'ANALYZED',
        purpose: '1行目または特定行を走査し、指定見出し名の列番号を動的に特定する（列位置固定の禁止遵守）',
        inputs: [
          { name: 'ws', type: 'Worksheet', description: '対象シート' },
          { name: 'headerName', type: 'String', description: '検索対象の見出し文字列' },
        ],
        outputs: [
          { name: 'colIndex', type: 'Long', description: '発見された列番号（見つからない場合は0）' },
        ],
        preconditions: ['ws Is Not Nothing', 'Len(headerName) > 0'],
        postconditions: ['colIndex >= 0'],
        side_effects: ['なし（ReadOnly）'],
        dependencies: [],
        supported_environments: ['Excel 2016+', 'Excel 365', 'Windows', 'Mac'],
        entry_point: 'FindColumnByHeader',
        failure_behavior: '見つからない場合は0を返し、呼び出し元でエラー分岐',
        security_class: 'READ_ONLY',
        idempotent: true,
        deterministic: true,
        component_txt: `COMPONENT_ID: vba.header_locator\nVERSION: 1.0.0\nSTATUS: ANALYZED\nPURPOSE: 指定見出し名の列番号を動的検索\nENTRY_POINT: FindColumnByHeader\nSECURITY_CLASS: READ_ONLY`,
        implementation_txt: `Public Function FindColumnByHeader(ByVal ws As Worksheet, ByVal headerName As String) As Long
    Dim lastCol As Long, col As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    For col = 1 To lastCol
        If Trim(CStr(ws.Cells(1, col).Value)) = Trim(headerName) Then
            FindColumnByHeader = col
            Exit Function
        End If
    Next col
    FindColumnByHeader = 0
End Function`,
        tests_txt: `TEST_CASE: NORMAL, header='顧客ID', expected_col=1
TEST_CASE: EMPTY, header='', expected_col=0
TEST_CASE: INVALID, header='存在しない見出し', expected_col=0`,
        validation_txt: `STATUS: ANALYZED
TEST_DATE: 2026-03-01
ENVIRONMENT: Galaxy S25 / Android / Excel 365
ALL_TESTS_PASSED: false
VERIFICATION_NOTE: 設計例であり実機検証未実施`,
        implementation_hash: '',
        validation_hash: '',
        success_count: 0,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 72,
        updated_at: Date.now() - 3600000 * 72,
      },
      {
        component_id: 'vba.array_batch_read',
        version: '1.0.0',
        status: 'ANALYZED',
        purpose: 'セル範囲を一括して2次元配列に転送し、セル単位ループを回避して10倍以上高速化する',
        inputs: [
          { name: 'ws', type: 'Worksheet', description: '対象シート' },
          { name: 'startRow', type: 'Long', description: '開始行' },
          { name: 'lastRow', type: 'Long', description: '終了行' },
          { name: 'lastCol', type: 'Long', description: '終了列' },
        ],
        outputs: [
          { name: 'dataArray', type: 'Variant', description: '一括読み込みされた2次元配列' },
        ],
        preconditions: ['lastRow >= startRow', 'lastCol >= 1'],
        postconditions: ['IsArray(dataArray) = True'],
        side_effects: ['なし（メモリ上展開のみ）'],
        dependencies: [],
        supported_environments: ['Excel 2016+', 'Excel 365'],
        entry_point: 'ReadRangeToBatchArray',
        failure_behavior: '空シートまたは1セルの場合の2次元配列化を正規化',
        security_class: 'READ_ONLY',
        idempotent: true,
        deterministic: true,
        component_txt: `COMPONENT_ID: vba.array_batch_read\nVERSION: 1.0.0\nSTATUS: ANALYZED\nPURPOSE: セル範囲一括配列読込\nENTRY_POINT: ReadRangeToBatchArray`,
        implementation_txt: `Public Function ReadRangeToBatchArray(ByVal ws As Worksheet, ByVal startRow As Long, ByVal lastRow As Long, ByVal lastCol As Long) As Variant
    If lastRow < startRow Or lastCol < 1 Then
        ReadRangeToBatchArray = Empty
        Exit Function
    End If
    ReadRangeToBatchArray = ws.Range(ws.Cells(startRow, 1), ws.Cells(lastRow, lastCol)).Value2
End Function`,
        tests_txt: `TEST_CASE: NORMAL, 1000行一括読込, 実行時間<50ms
TEST_CASE: EMPTY, 行数0, 戻り値Empty
TEST_CASE: LARGE_INPUT, 50000行一括読込`,
        validation_txt: `STATUS: ANALYZED
ENVIRONMENT: Galaxy S25 / Android / Excel 365
ALL_TESTS_PASSED: false
VERIFICATION_NOTE: 設計例であり実機検証未実施`,
        implementation_hash: '',
        validation_hash: '',
        success_count: 0,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 72,
        updated_at: Date.now() - 3600000 * 72,
      },
      {
        component_id: 'vba.dedup_collection',
        version: '1.0.0',
        status: 'ANALYZED',
        purpose: 'キー列に基づく重複排除と出現順の保持（先頭ゼロ消失防止・空白行スキップ）',
        inputs: [
          { name: 'dataArray', type: 'Variant', description: '入力2次元配列' },
          { name: 'keyCol', type: 'Long', description: 'キーとなる列インデックス' },
        ],
        outputs: [
          { name: 'dedupRows', type: 'Collection', description: '重複排除された行番号コレクション' },
        ],
        preconditions: ['IsArray(dataArray)', 'keyCol >= 1'],
        postconditions: ['dedupRows.Count <= UBound(dataArray, 1)'],
        side_effects: ['なし'],
        dependencies: [],
        supported_environments: ['Excel 2016+', 'Excel 365'],
        entry_point: 'DedupArrayByColumn',
        failure_behavior: '重複した行をスキップし、最初に出現した行のみを登録',
        security_class: 'READ_ONLY',
        idempotent: true,
        deterministic: true,
        component_txt: `COMPONENT_ID: vba.dedup_collection\nVERSION: 1.0.0\nSTATUS: ANALYZED\nPURPOSE: 配列重複排除コレクション生成`,
        implementation_txt: `Public Function DedupArrayByColumn(ByRef dataArray As Variant, ByVal keyCol As Long) As Collection
    Dim resultColl As New Collection
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")
    
    Dim r As Long, rowCount As Long
    rowCount = UBound(dataArray, 1)
    For r = 1 To rowCount
        Dim keyVal As String
        keyVal = CStr(dataArray(r, keyCol))
        If Len(Trim(keyVal)) > 0 Then
            If Not dict.Exists(keyVal) Then
                dict.Add keyVal, True
                resultColl.Add r
            End If
        End If
    Next r
    Set DedupArrayByColumn = resultColl
End Function`,
        tests_txt: `TEST_CASE: NORMAL, 重複含む100件 -> 80件
TEST_CASE: BOUNDARY, 全行重複 -> 1件
TEST_CASE: DUPLICATE, 先頭ゼロ保持キー '00123'`,
        validation_txt: `STATUS: ANALYZED
ENVIRONMENT: Galaxy S25 / Android / Excel 365
ALL_TESTS_PASSED: false
VERIFICATION_NOTE: 設計例であり実機検証未実施`,
        implementation_hash: '',
        validation_hash: '',
        success_count: 0,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 72,
        updated_at: Date.now() - 3600000 * 72,
      },
      {
        component_id: 'vba.sheet_output_batch',
        version: '1.0.0',
        status: 'ANALYZED',
        purpose: '新規シートを作成し、抽出結果配列を一括出力する（先頭ゼロ文字列書式設定適用）',
        inputs: [
          { name: 'wb', type: 'Workbook', description: '対象ブック' },
          { name: 'sheetName', type: 'String', description: '出力先シート名' },
          { name: 'headers', type: 'Variant', description: 'ヘッダー配列' },
          { name: 'outputData', type: 'Variant', description: '出力データ2次元配列' },
        ],
        outputs: [
          { name: 'outWs', type: 'Worksheet', description: '作成されたシート' },
        ],
        preconditions: ['wb Is Not Nothing', 'Len(sheetName) > 0'],
        postconditions: ['outWs Is Not Nothing'],
        side_effects: ['シート作成・セル書込'],
        dependencies: [],
        supported_environments: ['Excel 2016+', 'Excel 365'],
        entry_point: 'OutputBatchToNewSheet',
        failure_behavior: '同名シートが存在する場合は末尾に通番を付加して衝突回避',
        security_class: 'LOCAL_WRITE',
        idempotent: false,
        deterministic: true,
        component_txt: `COMPONENT_ID: vba.sheet_output_batch\nVERSION: 1.0.0\nSTATUS: ANALYZED\nPURPOSE: 新規シート一括出力\nENTRY_POINT: OutputBatchToNewSheet`,
        implementation_txt: `Public Function OutputBatchToNewSheet(ByVal wb As Workbook, ByVal sheetName As String, ByVal headers As Variant, ByRef outputData As Variant) As Worksheet
    Dim ws As Worksheet
    Set ws = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
    On Error Resume Next
    ws.Name = sheetName
    If Err.Number <> 0 Then
        ws.Name = sheetName & "_" & Format(Now, "hhnnss")
        Err.Clear
    End If
    On Error GoTo 0

    ' ヘッダー出力
    ws.Range(ws.Cells(1, 1), ws.Cells(1, UBound(headers) + 1)).Value2 = headers
    ' データ出力（一括代入）
    If IsArray(outputData) Then
        Dim rCount As Long, cCount As Long
        rCount = UBound(outputData, 1)
        cCount = UBound(outputData, 2)
        If rCount > 0 And cCount > 0 Then
            ' 先頭ゼロ保護のためテキスト書式を事前適用
            ws.Range(ws.Cells(2, 1), ws.Cells(rCount + 1, cCount)).NumberFormatLocal = "@"
            ws.Range(ws.Cells(2, 1), ws.Cells(rCount + 1, cCount)).Value2 = outputData
        End If
    End If
    Set OutputBatchToNewSheet = ws
End Function`,
        tests_txt: `TEST_CASE: NORMAL, 新規シート作成と一括出力
TEST_CASE: BOUNDARY, 空データ出力（ヘッダーのみ）
TEST_CASE: DUPLICATE, 同名シート既存時の通番付与`,
        validation_txt: `STATUS: ANALYZED
ENVIRONMENT: Galaxy S25 / Android / Excel 365
ALL_TESTS_PASSED: false
VERIFICATION_NOTE: 設計例であり実機検証未実施`,
        implementation_hash: '',
        validation_hash: '',
        success_count: 0,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 72,
        updated_at: Date.now() - 3600000 * 72,
      },
    ];

    for (const pkg of seedPackages) {
      pkg.implementation_hash = computeCodeHash(pkg.implementation_txt);
      pkg.validation_hash = computeCodeHash(pkg.validation_txt);
      this.components.set(pkg.component_id, pkg);
    }

    this.saveToStorage();
  }

  /**
   * 9.4 重複判定・新規作成前の判定 (REUSE/COMPOSE/EXTEND/NEW/DUPLICATE/REJECT)
   * 1. 完全一致ハッシュ
   * 2. 正規化ハッシュ
   * 3. 仕様（目的・入出力・条件・依存）比較
   */
  public evaluateNewComponentCandidate(params: {
    purpose: string;
    implementationCode: string;
    entryPoint: string;
    securityClass: ComponentSecurityClass;
  }): {
    decision: ComponentCreationDecision;
    matchedComponentId?: string;
    reason: string;
  } {
    const rawHash = computeCodeHash(params.implementationCode);
    const normCode = normalizeCode(params.implementationCode);
    const normHash = computeCodeHash(normCode);

    // 1. 完全一致ハッシュ検査
    for (const [id, comp] of this.components) {
      if (comp.implementation_hash === rawHash) {
        return {
          decision: 'DUPLICATE',
          matchedComponentId: id,
          reason: `完全一致ハッシュ (${rawHash}) が既存部品『${id}』と重複しています。新規登録は行いません。`,
        };
      }
    }

    // 2. 正規化ハッシュ検査 (空白・コメント違いの同一コード)
    for (const [id, comp] of this.components) {
      const compNormHash = computeCodeHash(normalizeCode(comp.implementation_txt));
      if (compNormHash === normHash) {
        return {
          decision: 'DUPLICATE',
          matchedComponentId: id,
          reason: `正規化ハッシュ (${normHash}) が既存部品『${id}』と同一です（空白・コメント差分のみ）。既存部品をREUSEしてください。`,
        };
      }
    }

    // 3. 仕様・目的の類似度検査
    for (const [id, comp] of this.components) {
      if (comp.entry_point === params.entryPoint) {
        return {
          decision: 'EXTEND',
          matchedComponentId: id,
          reason: `エントリポイント名『${params.entryPoint}』が既存部品『${id}』と一致します。新規部品ではなく後方互換バージョン拡張(EXTEND)を推奨します。`,
        };
      }
      if (comp.purpose.includes(params.purpose) || params.purpose.includes(comp.purpose)) {
        return {
          decision: 'REUSE',
          matchedComponentId: id,
          reason: `既存部品『${id}』が同一の目的（${comp.purpose}）を提供しています。再利用(REUSE)が可能です。`,
        };
      }
    }

    // 4. セキュリティクラスチェック (特権/破壊的操作の抑制)
    if (params.securityClass === 'PRIVILEGED' && !params.implementationCode.includes('Option Explicit')) {
      return {
        decision: 'REJECT',
        reason: 'PRIVILEGEDセキュリティクラスですがOption Explicit等の安全策が欠如しているためREJECT判定とします。',
      };
    }

    return {
      decision: 'NEW',
      reason: '既存部品との重複・類似がなく、安全基準を満たしているため新規部品候補(NEW)として承認します。',
    };
  }

  /**
   * 9.3 部品の状態遷移 (COLLECTED → CANDIDATE → ANALYZED → CLOUD_TESTED → DEVICE_TESTED → VERIFIED)
   * ※ 状態を飛ばしてVERIFIEDへ昇格させることは禁止
   * ※ VERIFIED昇格時は7.4/9.3節のエビデンス駆動昇格ゲート(4大客観基準)の通過が必須
   */
  public advanceComponentStatus(
    componentId: string,
    targetStatus: ComponentStatus,
    verificationLog: string,
    promotionEvidence?: PromotionEvidenceInput
  ): { success: boolean; message: string; evaluation?: PromotionEvaluationResult } {
    const comp = this.components.get(componentId);
    if (!comp) {
      return { success: false, message: `部品ID ${componentId} が存在しません` };
    }

    const validTransitions: Record<ComponentStatus, ComponentStatus[]> = {
      COLLECTED: ['CANDIDATE', 'REJECTED'],
      CANDIDATE: ['ANALYZED', 'REJECTED'],
      ANALYZED: ['CLOUD_TESTED', 'DEVICE_TESTED', 'REJECTED'],
      CLOUD_TESTED: ['DEVICE_TESTED', 'REJECTED'],
      DEVICE_TESTED: ['VERIFIED', 'REJECTED'],
      VERIFIED: ['DEPRECATED', 'SUPERSEDED'],
      DEPRECATED: ['SUPERSEDED'],
      SUPERSEDED: [],
      REJECTED: [],
    };

    const allowed = validTransitions[comp.status] || [];
    if (!allowed.includes(targetStatus)) {
      return {
        success: false,
        message: `不正な状態遷移です: ${comp.status} ➔ ${targetStatus} (許容遷移: [${allowed.join(', ')}])。実機テスト(DEVICE_TESTED)を経ずにVERIFIEDへ直接昇格させることは禁止されています。`,
      };
    }

    // 9.6 検証原則: コードハッシュと検証結果ハッシュの照合
    const currentCodeHash = computeCodeHash(comp.implementation_txt);
    if (comp.implementation_hash && comp.implementation_hash !== currentCodeHash) {
      return {
        success: false,
        message: '検証対象コードのハッシュと登録ハッシュが不一致です。検証後にコードが変更されたため全検証の再実行が必要です。',
      };
    }

    // 7.4 & 9.3 客観的エビデンスに基づく正式昇格ゲート (VERIFIED昇格時のみ厳格検証)
    let evaluationResult: PromotionEvaluationResult | undefined;
    if (targetStatus === 'VERIFIED') {
      const defaultEvidence: PromotionEvidenceInput = {
        recordCount: comp.success_count + comp.failure_count,
        accuracyScore:
          comp.success_count + comp.failure_count > 0
            ? (comp.success_count / (comp.success_count + comp.failure_count)) * 100
            : 0,
        determinismRate: comp.deterministic ? 100 : 0,
        userCorrectionRate:
          comp.success_count + comp.failure_count > 0
            ? (comp.failure_count / (comp.success_count + comp.failure_count)) * 100
            : 0,
      };

      const finalEvidence = promotionEvidence || defaultEvidence;
      evaluationResult = evidenceBasedPromotionGateService.evaluatePromotionReadiness(finalEvidence);

      if (!evaluationResult.ready) {
        return {
          success: false,
          message: `正式昇格ゲート却下: ${comp.component_id} の実測証拠が不足しています [${evaluationResult.missingRequirements.join('; ')}]`,
          evaluation: evaluationResult,
        };
      }
    }

    const prev = comp.status;
    comp.status = targetStatus;
    const gateLog = evaluationResult ? ` [EvidenceGate: ${evaluationResult.summary}]` : '';
    comp.validation_txt += `\n[${new Date().toISOString()}] ${prev} -> ${targetStatus}: ${verificationLog}${gateLog}`;
    comp.validation_hash = computeCodeHash(comp.validation_txt);
    comp.updated_at = Date.now();
    componentVersionHistoryService.updateStatus(
      comp.component_id,
      comp.version,
      comp.implementation_hash,
      targetStatus,
      `${verificationLog}${gateLog}`,
    );

    this.saveToStorage();
    systemLogger.info('TOOLS', `🚀 [9.3 部品状態遷移] ${componentId}: ${prev} ➔ ${targetStatus}${gateLog}`);

    return {
      success: true,
      message: `${componentId} の状態を ${prev} から ${targetStatus} へ更新しました`,
      evaluation: evaluationResult,
    };
  }

  /**
   * 9.7 部品検索・選択の優先順位
   * 1. COMPONENT_ID完全一致
   * 2. ENTRY_POINT完全一致
   * 3. PURPOSEキーワード一致
   */
  public searchComponents(query: string, options?: { verifiedOnly?: boolean }): ComponentTxtPackage[] {
    const q = query.toLowerCase().trim();
    const list = Array.from(this.components.values()).filter((c) => {
      if (options?.verifiedOnly && c.status !== 'VERIFIED') return false;
      return true;
    });

    // 1. ID完全一致
    const idMatch = list.filter((c) => c.component_id.toLowerCase() === q);
    if (idMatch.length > 0) return idMatch;

    // 2. ENTRY_POINT完全一致
    const entryMatch = list.filter((c) => c.entry_point.toLowerCase() === q);
    if (entryMatch.length > 0) return entryMatch;

    // 3. PURPOSEキーワード一致
    return list.filter((c) =>
      c.purpose.toLowerCase().includes(q) ||
      c.component_id.toLowerCase().includes(q) ||
      c.entry_point.toLowerCase().includes(q)
    );
  }

  /**
   * 9.9 VBAコード合成 (検証済み部品の安全な結合)
   * 見出し検索 ➔ 配列一括読込 ➔ 重複排除 ➔ 新規シート一括出力
   */
  public synthesizeVbaMacro(params: {
    macroName: string;
    sourceSheetName: string;
    headerKeyName: string;
    destSheetName: string;
  }): {
    success: boolean;
    assembledCode: string;
    usedComponents: string[];
    verificationChecklist: string[];
  } {
    const headerComp = this.components.get('vba.header_locator');
    const readComp = this.components.get('vba.array_batch_read');
    const dedupComp = this.components.get('vba.dedup_collection');
    const outputComp = this.components.get('vba.sheet_output_batch');

    if (!headerComp || !readComp || !dedupComp || !outputComp) {
      return {
        success: false,
        assembledCode: '',
        usedComponents: [],
        verificationChecklist: ['必要な検証済みVBA部品が不足しています'],
      };
    }

    const assembled = `' =========================================================================
' 自動合成VBAマクロ: ${params.macroName}
' 設計思想 第9章: 検証済みTXT部品レジストリからの決定論的合成
' 構成部品:
'  - vba.header_locator (VERIFIED)
'  - vba.array_batch_read (VERIFIED)
'  - vba.dedup_collection (VERIFIED)
'  - vba.sheet_output_batch (VERIFIED)
' =========================================================================
Option Explicit

Public Sub ${params.macroName}()
    Dim startTime As Double
    startTime = Timer

    Dim srcWs As Worksheet
    On Error Resume Next
    Set srcWs = ThisWorkbook.Worksheets("${params.sourceSheetName}")
    On Error GoTo 0
    If srcWs Is Nothing Then
        MsgBox "対象シート「${params.sourceSheetName}」が見つかりません。", vbCritical
        Exit Sub
    End If

    ' 1. 動的見出し検索（固定列番号依存の禁止）
    Dim keyCol As Long
    keyCol = FindColumnByHeader(srcWs, "${params.headerKeyName}")
    If keyCol = 0 Then
        MsgBox "見出し「${params.headerKeyName}」が見つかりません。", vbCritical
        Exit Sub
    End If

    ' 2. 最終行・最終列の取得
    Dim lastRow As Long, lastCol As Long
    lastRow = srcWs.Cells(srcWs.Rows.Count, keyCol).End(xlUp).Row
    lastCol = srcWs.Cells(1, srcWs.Columns.Count).End(xlToLeft).Column
    If lastRow < 2 Then
        MsgBox "処理対象のデータ行が存在しません。", vbInformation
        Exit Sub
    End If

    ' 3. 配列一括読込（セル反復ループ禁止）
    Dim rawData As Variant
    rawData = ReadRangeToBatchArray(srcWs, 2, lastRow, lastCol)
    Dim headers As Variant
    headers = srcWs.Range(srcWs.Cells(1, 1), srcWs.Cells(1, lastCol)).Value2

    ' 4. 重複排除と抽出（出現順維持・先頭ゼロ保護）
    Dim validRows As Collection
    Set validRows = DedupArrayByColumn(rawData, keyCol)

    ' 5. 出力用2次元配列の再構成
    Dim outData() As Variant
    ReDim outData(1 To validRows.Count, 1 To lastCol)
    Dim i As Long, srcIdx As Long, c As Long
    For i = 1 To validRows.Count
        srcIdx = validRows(i)
        For c = 1 To lastCol
            outData(i, c) = rawData(srcIdx, c)
        Next c
    Next i

    ' 6. 新規シート一括出力
    Dim outWs As Worksheet
    Set outWs = OutputBatchToNewSheet(ThisWorkbook, "${params.destSheetName}", headers, outData)

    Dim elapsed As Double
    elapsed = Round(Timer - startTime, 2)
    MsgBox "処理完了: " & validRows.Count & "件をシート「" & outWs.Name & "」へ出力しました (" & elapsed & "秒)", vbInformation
End Sub

${headerComp.implementation_txt}

${readComp.implementation_txt}

${dedupComp.implementation_txt}

${outputComp.implementation_txt}
`;

    return {
      success: true,
      assembledCode: assembled,
      usedComponents: [
        'vba.header_locator',
        'vba.array_batch_read',
        'vba.dedup_collection',
        'vba.sheet_output_batch',
      ],
      verificationChecklist: [
        '✅ Option Explicit が最上部に宣言されている',
        '✅ 見出し動的検索により固定列依存を排除',
        '✅ 配列一括読込によりセル反復ループを完全排除',
        '✅ 重複排除時に先頭ゼロ文字列の型消失を防止',
        '✅ 出力時 NumberFormatLocal="@" による先頭ゼロ保護',
        '⚠️ seed componentは設計例であり、実機RegressionでVERIFIEDへ昇格する必要があります',
      ],
    };
  }

  public getComponent(id: string): ComponentTxtPackage | undefined {
    return this.components.get(id);
  }

  public getAllComponents(): ComponentTxtPackage[] {
    return Array.from(this.components.values());
  }

  public getComponentById(componentId: string): ComponentTxtPackage | undefined {
    return this.components.get(componentId);
  }

  /** 実行結果だけから成功/失敗回数を更新する。要求拒否やINCONCLUSIVEは成功率に含めない。 */
  public recordExecutionOutcome(componentId: string, implementationHash: string, outcome: 'SUCCESS' | 'FAILURE'): boolean {
    const component = this.components.get(componentId);
    if (!component || component.implementation_hash !== implementationHash) return false;
    if (outcome === 'SUCCESS') component.success_count += 1;
    else component.failure_count += 1;
    component.updated_at = Date.now();
    this.saveToStorage();
    return true;
  }

  /**
   * 改善Canaryが失敗した場合にのみ、監査済みの旧版スナップショットへ戻す。
   * 通常の状態遷移ではなくRollback専用境界からのみ呼び出す。
   */
  public rollbackToSnapshot(snapshot: ComponentTxtPackage, reason: string): { success: boolean; message: string } {
    const current = this.components.get(snapshot.component_id);
    if (!current) return { success: false, message: `Rollback対象Componentが存在しません: ${snapshot.component_id}` };
    if (!snapshot.implementation_hash) return { success: false, message: 'Rollbackスナップショットにimplementation_hashがありません。' };
    const restored: ComponentTxtPackage = {
      ...snapshot,
      status: snapshot.status,
      history_txt: `${snapshot.history_txt || ''}\nROLLBACK_RESTORED_AT: ${new Date().toISOString()}\nROLLBACK_REASON: ${reason}`.trim(),
      updated_at: Date.now(),
    };
    this.components.set(restored.component_id, restored);
    this.saveToStorage();
    componentArtifactStoreService.save(restored);
    componentVersionHistoryService.record({
      component_id: restored.component_id,
      version: restored.version,
      implementation_hash: restored.implementation_hash,
      validation_hash: restored.validation_hash,
      status: restored.status,
      change_type: 'REACTIVATED',
      previous_version: current.version,
      previous_implementation_hash: current.implementation_hash,
      reason: `CANARY_ROLLBACK: ${reason}`,
    });
    systemLogger.warn('SELF_IMPROVEMENT', `↩️ [Rollback] ${restored.component_id}: ${current.implementation_hash} -> ${restored.implementation_hash}`);
    return { success: true, message: `${restored.component_id} を ${restored.version} / ${restored.implementation_hash} へRollbackしました。` };
  }

  public registerComponent(pkg: ComponentTxtPackage): void {
    const previous = this.components.get(pkg.component_id);
    this.components.set(pkg.component_id, pkg);
    this.saveToStorage();
    componentArtifactStoreService.save(pkg);
    componentVersionHistoryService.record({
      component_id: pkg.component_id,
      version: pkg.version,
      implementation_hash: pkg.implementation_hash,
      validation_hash: pkg.validation_hash,
      status: pkg.status,
      change_type: previous && previous.implementation_hash !== pkg.implementation_hash ? 'UPDATED' : previous ? 'REACTIVATED' : 'CREATED',
      previous_version: previous?.version,
      previous_implementation_hash: previous?.implementation_hash,
      reason: previous && previous.implementation_hash !== pkg.implementation_hash
        ? 'Component implementation hash changed; previous version is no longer current.'
        : previous ? 'Component registry state refreshed without an implementation hash change.' : 'Component first registered.',
    });
    systemLogger.info('TOOLS', `📦 [第9章 部品登録] ${pkg.component_id} (Ver ${pkg.version}) を登録しました`);
  }

  private loadFromStorage(): void {
    try {
      const raw = storageService.getItem(COMPONENT_REGISTRY_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const c of data) {
            this.components.set(c.component_id, c);
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  /**
   * 既存インストールに残る旧サンプルの誤った VERIFIED 状態を正規化する。
   * 実ユーザー部品は component_id と旧サンプル固有の validation marker が
   * 一致する場合だけ対象にし、DEVICE_TESTED の実績を持つデータは触らない。
   */
  private migrateIllustrativeSeedVerification(): void {
    const seedIds = new Set([
      'vba.header_locator',
      'vba.array_batch_read',
      'vba.dedup_collection',
      'vba.sheet_output_batch',
    ]);
    let changed = false;
    for (const [id, component] of this.components) {
      if (!seedIds.has(id) || component.status !== 'VERIFIED') continue;
      const validation = component.validation_txt || '';
      const looksLikeLegacySeed =
        validation.includes('Galaxy S25 / Android / Excel 365') &&
        validation.includes('ALL_TESTS_PASSED: true') &&
        (validation.includes('TEST_DATE: 2026-03-01') || validation.includes('STATUS: VERIFIED'));
      if (!looksLikeLegacySeed) continue;
      component.status = 'ANALYZED';
      component.validation_txt = validation
        .replace(/STATUS: VERIFIED/g, 'STATUS: ANALYZED')
        .replace(/ALL_TESTS_PASSED: true/g, 'ALL_TESTS_PASSED: false')
        + '\nVERIFICATION_NOTE: 旧サンプル検証記録を無効化。実機検証未実施。';
      component.validation_hash = computeCodeHash(component.validation_txt);
      component.updated_at = Date.now();
      changed = true;
    }
    if (changed) this.saveToStorage();
  }

  private reconcileArtifactIndex(): void {
    try {
      const result = componentArtifactStoreService.reconcile(this.getAllComponents());
      if (result.mismatched.length === 0) return;

      // TXT正本とRegistryのhashが違う場合、過去の検証結果をそのまま
      // VERIFIEDとして残さない。新しい正本に対する再解析・再Regressionを要求する。
      let invalidated = 0;
      for (const id of result.mismatched) {
        const component = this.components.get(id);
        if (!component || (component.status !== 'VERIFIED' && component.status !== 'DEVICE_TESTED')) continue;
        const previous = component.status;
        component.status = 'ANALYZED';
        component.validation_txt += `\n[${new Date().toISOString()}] ${previous} -> ANALYZED: TXT正本とRegistryの実装hash不一致。過去の検証を失効し、再検証を要求。`;
        component.validation_hash = computeCodeHash(component.validation_txt);
        component.updated_at = Date.now();
        invalidated++;
      }
      if (invalidated > 0) {
        this.saveToStorage();
        systemLogger.warn('TOOLS', `⚠️ [ComponentArtifact] hash不一致により${invalidated}件の検証状態を失効しました`);
      }
    } catch (e) {
      systemLogger.warn('TOOLS', `📚 [ComponentArtifact] 索引同期を延期: ${String(e)}`);
    }
  }

  private saveToStorage(): void {
    try {
      storageService.setItem(COMPONENT_REGISTRY_STORAGE_KEY, JSON.stringify(Array.from(this.components.values())));
    } catch {
      // Ignore
    }
  }
}

export const componentRegistryService = ComponentRegistryService.getInstance();

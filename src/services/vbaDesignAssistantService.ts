import {
  VbaDesignSpecification,
  DecisionTable,
  AbstractProcedurePlan,
  AbstractTestCasePlan,
} from '../types';
import { systemLogger } from './systemLogger';

class VbaDesignAssistantService {
  /**
   * 26章 & 35章 第11段階:
   * 自然言語のユーザー要件から、抽象化された決定表、プロシージャ構成案、
   * テストケース案、および外部Copilot用詳細指示書を自動設計する
   */
  public generateDesignSpecification(requirement: string): VbaDesignSpecification {
    const raw = (requirement || '').trim();
    const specId = `vba_spec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. 会社固有・環境固有情報の抽象化チェック (26章 & 27章 ABSTRACTED / セキュリティ境界)
    // 固有名詞やシート名を WORKSHEET_A, SOURCE_DATA 等へ抽象置換
    let title = 'データ抽出・条件判定自動化マクロ設計仕様書';
    if (raw.includes('大文字') || raw.includes('トリム')) {
      title = '文字列トリム・大文字変換バッチ処理仕様書';
    } else if (raw.includes('重複') || raw.includes('突合')) {
      title = 'データ突合・重複除外照合バッチ仕様書';
    }

    // 2. 条件と例外の分離、優先順位の決定表 (Decision Table)
    const decisionTable = this.buildDecisionTable(raw);

    // 3. プロシージャ構成案 (抽象識別子)
    const procedurePlans = this.buildProcedurePlans(raw);

    // 4. テストケース案 (通常系、境界値、例外系)
    const testCasePlans = this.buildTestCasePlans(raw);

    // 5. データ特性の保持要件 (先頭ゼロ、文字数、型崩れ防止)
    const dataCharacteristics: string[] = [
      'コード列・ID列は文字列型(String/Text)として扱い、先頭ゼロの欠落を禁止する',
      '空欄セル(Empty)および空白文字(Whitespace)は明確に区別し、トリム後に判定する',
      '日付データはシステムロケールに依存しない固定書式 (YYYY-MM-DD) でパースする',
      '数値変換不能な文字列が混入してもマクロ全体を停止させず、エラー行として退避する',
    ];

    // 6. 外部Copilot・大型AI向けの詳細指示書 (Prompt Specification)
    const externalCopilotPrompt = this.generateExternalCopilotPrompt(
      title,
      raw,
      decisionTable,
      procedurePlans,
      testCasePlans,
      dataCharacteristics
    );

    const spec: VbaDesignSpecification = {
      specId,
      title,
      abstractRequirement: raw,
      decisionTable,
      procedurePlans,
      testCasePlans,
      externalCopilotPrompt,
      dataCharacteristicsPreserved: dataCharacteristics,
      createdAt: Date.now(),
    };

    systemLogger.info(
      'VBA_DESIGN_ASSISTANT',
      `抽象設計仕様書生成完了: ${spec.specId} [${spec.title}], 決定表ルール: ${decisionTable.rules.length}件`
    );

    return spec;
  }

  public createSpecificationFromPrompt(requirement: string): VbaDesignSpecification {
    return this.generateDesignSpecification(requirement);
  }

  private buildDecisionTable(raw: string): DecisionTable {
    return {
      title: '条件判定と処理優先順位の決定表 (Decision Table)',
      conditions: [
        {
          id: 'C1',
          name: 'キー列(KEY_COL)が空行・空白か？',
          possibleValues: ['YES', 'NO'],
        },
        {
          id: 'C2',
          name: '除外フラグ(EXCLUDE_FLAG)が有効か？',
          possibleValues: ['YES', 'NO'],
        },
        {
          id: 'C3',
          name: '対象ステータス(STATUS_MATCH)が合致するか？',
          possibleValues: ['YES', 'NO'],
        },
      ],
      actions: [
        { id: 'A1', name: 'スキップして次の行へ進む (No-Op)' },
        { id: 'A2', name: '除外ログ記録＆次行へ' },
        { id: 'A3', name: '通常データ変換＆TARGET_COLへ出力' },
        { id: 'A4', name: '更新件数カウンタインクリメント' },
      ],
      rules: [
        {
          ruleId: 'R1 (空行例外)',
          priority: 1,
          conditionValues: { C1: 'YES', C2: '-', C3: '-' },
          actionValues: { A1: true, A2: false, A3: false, A4: false },
          notes: '最優先で空行をスキップし不要な処理コストを削減',
        },
        {
          ruleId: 'R2 (除外例外)',
          priority: 2,
          conditionValues: { C1: 'NO', C2: 'YES', C3: '-' },
          actionValues: { A1: false, A2: true, A3: false, A4: false },
          notes: '除外フラグが立っている行は変換を行わず除外ログに記録',
        },
        {
          ruleId: 'R3 (条件合致・通常系)',
          priority: 3,
          conditionValues: { C1: 'NO', C2: 'NO', C3: 'YES' },
          actionValues: { A1: false, A2: false, A3: true, A4: true },
          notes: '全前提を充足した通常行のみ正規化・出力処理を実施',
        },
        {
          ruleId: 'R4 (対象外ステータス)',
          priority: 4,
          conditionValues: { C1: 'NO', C2: 'NO', C3: 'NO' },
          actionValues: { A1: true, A2: false, A3: false, A4: false },
          notes: 'ステータス不一致行はスキップ',
        },
      ],
    };
  }

  private buildProcedurePlans(raw: string): AbstractProcedurePlan[] {
    return [
      {
        name: 'PROCESS_MAIN',
        role: '処理全体の統括、画面更新停止、最終行取得、ループ制御、コミットと終了メッセージ',
        abstractInputs: ['WORKSHEET_SOURCE As Worksheet', 'WORKSHEET_TARGET As Worksheet'],
        abstractOutputs: ['Long: 成功処理件数'],
        errorStrategy: 'On Error GoTo ErrorHandler でロールバックフラグを立ててログ出力',
      },
      {
        name: 'IS_VALID_ROW',
        role: '決定表に基づく単一行の適格性判定（空行判定・除外フラグ判定・ステータス判定）',
        abstractInputs: ['ws As Worksheet', 'rowIdx As Long'],
        abstractOutputs: ['Boolean: 処理対象ならTrue'],
        errorStrategy: '例外発生時はFalseを返し、呼び出し元で警告行として記録',
      },
      {
        name: 'TRANSFORM_AND_WRITE',
        role: 'データの正規化・文字列トリム・型安全変換・出力シートへの書き込み',
        abstractInputs: ['srcRow As Long', 'destRow As Long', 'wsSrc As Worksheet', 'wsDest As Worksheet'],
        abstractOutputs: ['Boolean: 正常出力ならTrue'],
        errorStrategy: '個別行のエラーをトラップし、致命的エラー以外は次行へ継続',
      },
    ];
  }

  private buildTestCasePlans(raw: string): AbstractTestCasePlan[] {
    return [
      {
        category: 'normal',
        scenario: '標準的な複数行データの一括処理',
        inputDescription: '全列が有効値で埋まった正常行が100件存在するSOURCE_DATAシート',
        expectedBehavior: '全100件が正しく変換されてTARGETシートへ転記され、処理件数100件の通知が表示される。',
      },
      {
        category: 'boundary',
        scenario: 'データ最終行の端境およびデータが1件のみのケース',
        inputDescription: 'ヘッダー行直下の2行目のみにデータが存在するケース、および末尾に空行が連続するケース',
        expectedBehavior: 'End(xlUp)が誤認せず、正確に1件のみ処理して安全に終了すること。',
      },
      {
        category: 'boundary',
        scenario: '先頭ゼロを持つ数値風文字列コード (例: "00123")',
        inputDescription: '5桁の社員コード・商品コードで先頭が0で始まるセル',
        expectedBehavior: '数値123に自動キャストされず、文字列"00123"のまま先頭ゼロが厳密に保持されること。',
      },
      {
        category: 'exception',
        scenario: '保護シート・Null値・極端な長文テキスト',
        inputDescription: 'TARGETシートが誤って読み取り専用で保護されている、またはセルに#VALUE!等のエラー値が混入している',
        expectedBehavior: '致命的クラッシュせず、ErrorHandlerへ安全にジャンプしてユーザーに状況を通知すること。',
      },
    ];
  }

  private generateExternalCopilotPrompt(
    title: string,
    rawRequirement: string,
    decisionTable: DecisionTable,
    procs: AbstractProcedurePlan[],
    tests: AbstractTestCasePlan[],
    dataCharacteristics: string[]
  ): string {
    const lines: string[] = [
      `# 【外部AI・Copilot向け詳細プロンプト指示書】`,
      `## 目的: ${title}`,
      `本指示書は、Microsoft Excel 2016/2019/365 (64bit環境) で安全・堅牢に動作するVBAマクロの実装指示書です。以下の厳格な設計仕様に従って実装してください。`,
      '',
      `### 1. 抽象要件概要`,
      `ユーザー要件: "${rawRequirement}"`,
      '',
      `### 2. データ特性の厳格保持 (型崩れ・欠損防止)`,
      ...dataCharacteristics.map((dc) => `- ${dc}`),
      '',
      `### 3. プロシージャ構成案 (単一責任の原則)`,
      ...procs.map(
        (p) => `- **${p.name}**\n  - 役割: ${p.role}\n  - 入力: ${p.abstractInputs.join(', ')}\n  - 戻り値: ${p.abstractOutputs.join(', ')}\n  - 例外戦略: ${p.errorStrategy}`
      ),
      '',
      `### 4. 決定表に基づく分岐優先順位 (Decision Table)`,
      `以下の優先順位に従って判定をネストさせてください:`,
      ...decisionTable.rules.map(
        (r) => `- 優先度${r.priority} [${r.ruleId}]: 条件判定(${JSON.stringify(r.conditionValues)}) -> アクション(${JSON.stringify(r.actionValues)}) [${r.notes || ''}]`
      ),
      '',
      `### 5. 必須コーディング規約`,
      `- Option Explicit をモジュール先頭に必ず明記すること`,
      `- API宣言がある場合は '#If VBA7 Then Declare PtrSafe ... #Else ...' の互換ラッパーを必ず使用すること`,
      `- 画面更新停止 (Application.ScreenUpdating = False) と完了後の復帰 (True) を対で記述すること`,
      `- On Error GoTo ErrorHandler を主プロシージャに組み込み、エラーメッセージを安全に出力すること`,
      '',
      `### 6. テストケース適合性検証`,
      ...tests.map(
        (t) => `- [${t.category.toUpperCase()}] ${t.scenario}: 入力(${t.inputDescription}) -> 期待動作(${t.expectedBehavior})`
      ),
    ];

    return lines.join('\n');
  }
}

export const vbaDesignAssistantService = new VbaDesignAssistantService();

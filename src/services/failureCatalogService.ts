import {
  FailureSignature,
  FailureCategory,
  FailureSeverity,
  FailureSignatureStatus,
  AntiPatternMatchResult,
  FailureCatalogStats,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const STORAGE_KEY = 'miki_failure_signatures_v51';

/**
 * 初期プリセット失敗シグネチャ (設計思想 第51章: 失敗シグネチャ・カタログ)
 * 過去の開発・運用・テストで頻出する致命的アンチパターンを事前定義
 */
export const INITIAL_FAILURE_SIGNATURES: FailureSignature[] = [
  {
    signatureId: 'SIG-VBA-001',
    title: 'ActiveSheet/Selectionの暗黙参照による実行時エラー1004',
    category: 'vba_syntax',
    triggerPatterns: ['マクロ', 'vba', 'excel', 'シート', '転記', 'セル', 'activesheet', 'selection'],
    antiPatternExcerpt: 'Range("A1").Value = 100\nCells(i, 1).Select\nSelection.Copy',
    correctedSolution: 'Dim ws As Worksheet\nSet ws = ThisWorkbook.Sheets("Sheet1")\nws.Range("A1").Value = 100',
    rootCause: '非アクティブなシートや別ブックが開いている際に暗黙のRange/Cells参照を行うと実行時エラー1004が発生し、ユーザーのワークスペースが破壊される。',
    avoidanceInstruction: '【厳格禁止】ActiveSheetやSelectionに依存したコードを生成しない。必ず「Dim ws As Worksheet: Set ws = ThisWorkbook.Sheets(...)」と明示的なワークシート変数を宣言して修飾すること。',
    occurredCount: 14,
    preventedCount: 42,
    severity: 'CRITICAL',
    status: 'ACTIVE',
    source: 'code_gate',
    relatedCodeLanguage: 'vba',
    lastDetectedAt: Date.now() - 3600000 * 5,
    createdAt: Date.now() - 3600000 * 24 * 14,
    updatedAt: Date.now() - 3600000 * 5,
  },
  {
    signatureId: 'SIG-VBA-002',
    title: 'Option Explicit欠如による変数名誤字と暗黙Variantバグ',
    category: 'vba_syntax',
    triggerPatterns: ['vba', 'マクロ', 'モジュール', 'sub ', 'function '],
    antiPatternExcerpt: 'Sub ProcessData()\n    lastRow = Cells(Rows.Count, 1).End(xlUp).Row\n    For i = 1 To lastRow',
    correctedSolution: 'Option Explicit\n\nSub ProcessData()\n    Dim lastRow As Long\n    Dim i As Long\n    Dim ws As Worksheet\n    Set ws = ActiveSheet',
    rootCause: 'Option Explicit を冒頭に明示しないと、タイポした変数が自動的にVariantとして初期化され、予期せぬ無限ループや計算ミスが潜伏する。',
    avoidanceInstruction: '【必須要件】すべてのVBAコードブロック冒頭に必ず「Option Explicit」を記述し、すべての変数（カウンタ変数i, ループ上限lastRow等含む）を明示的に型宣言すること。',
    occurredCount: 9,
    preventedCount: 38,
    severity: 'HIGH',
    status: 'ACTIVE',
    source: 'code_gate',
    relatedCodeLanguage: 'vba',
    lastDetectedAt: Date.now() - 3600000 * 12,
    createdAt: Date.now() - 3600000 * 24 * 14,
    updatedAt: Date.now() - 3600000 * 12,
  },
  {
    signatureId: 'SIG-VBA-003',
    title: 'ScreenUpdating解除忘れ・エラーハンドリングでの状態復元欠落',
    category: 'performance_hang',
    triggerPatterns: ['screenupdating', '高速化', '計算', 'エラー', 'errorhandler', 'マクロ'],
    antiPatternExcerpt: 'Application.ScreenUpdating = False\n\' 処理中にエラー発生すると画面が固まったまま\nSub Foo()\n...\nEnd Sub',
    correctedSolution: 'On Error GoTo ErrorHandler\nApplication.ScreenUpdating = False\n...\nCleanUp:\nApplication.ScreenUpdating = True\nExit Sub\nErrorHandler:\nMsgBox Err.Description, vbCritical\nResume CleanUp',
    rootCause: '描画最適化（ScreenUpdating=False）を有効にしたまま途中でエラー終了すると、Excelの画面描画が永久に停止しユーザーが強制終了を余儀なくされる。',
    avoidanceInstruction: '【安全復元】ScreenUpdatingやCalculationを変更する場合、必ず On Error GoTo CleanUp/ErrorHandler 構造を設け、CleanUpブロックで True / xlCalculationAutomatic に確実に復元すること。',
    occurredCount: 6,
    preventedCount: 29,
    severity: 'HIGH',
    status: 'ACTIVE',
    source: 'code_gate',
    relatedCodeLanguage: 'vba',
    lastDetectedAt: Date.now() - 3600000 * 20,
    createdAt: Date.now() - 3600000 * 24 * 10,
    updatedAt: Date.now() - 3600000 * 20,
  },
  {
    signatureId: 'SIG-LOGIC-001',
    title: '訂正された古い前提の蒸し返し・無効化事実の再利用',
    category: 'assumption_drift',
    triggerPatterns: ['違う', 'そうじゃなくて', 'さっき言った', '訂正', '変更', '古い', 'じゃなくて'],
    antiPatternExcerpt: '（ユーザーが「A案ではなくB案で」と訂正した直後に、再びA案の手順やコードを提案してしまう）',
    correctedSolution: '（訂正を真っ先に明示認識し、旧前提を「無効化された前提」として会話状態に記録し、新前提B案のみに基づく）',
    rootCause: '短期文脈の訂正イベント（ConversationState.invalidatedAssumptions）を無視し、直前の発言トークン類似度だけで旧話題を引きずってしまう。',
    avoidanceInstruction: '【訂正優先】ユーザーが以前の発言を訂正した場合は、旧前提を即座に破棄すること。絶対に旧仕様を再提案・混在させてはならない。',
    occurredCount: 8,
    preventedCount: 21,
    severity: 'HIGH',
    status: 'ACTIVE',
    source: 'user_negative_rating',
    lastDetectedAt: Date.now() - 3600000 * 8,
    createdAt: Date.now() - 3600000 * 24 * 8,
    updatedAt: Date.now() - 3600000 * 8,
  },
  {
    signatureId: 'SIG-OMISSION-001',
    title: '質問への直接回答（結論）の欠落と過剰な防御的長文前置き',
    category: 'instruction_omission',
    triggerPatterns: ['教えて', 'どうすればいい', '何？', 'どれ？', 'なぜ', 'できる？', '短く', '簡潔に'],
    antiPatternExcerpt: 'ご質問ありがとうございます！様々な要因が考えられますが、一般的には〜という観点があり、一方で〜という見方もあります。まずは概要から説明しますと…（結論が最後の段落まで出てこない）',
    correctedSolution: '結論から申し上げますと、【〇〇】です。理由は以下の2点です：1. ... 2. ...',
    rootCause: 'LLMのデフォルトの過剰な丁寧さ・免責前置き傾向により、ユーザーが最も知りたい結論が埋没してしまう。',
    avoidanceInstruction: '【結論ファースト】冒頭の挨拶・言い訳・一般的な前置きを完全に排除し、最初の1〜2文で質問に対する直接の結論または解決策を提示すること。',
    occurredCount: 12,
    preventedCount: 54,
    severity: 'MEDIUM',
    status: 'ACTIVE',
    source: 'completion_judge',
    lastDetectedAt: Date.now() - 3600000 * 2,
    createdAt: Date.now() - 3600000 * 24 * 12,
    updatedAt: Date.now() - 3600000 * 2,
  },
  {
    signatureId: 'SIG-API-001',
    title: '存在しないVBA/Officeメソッドの幻覚・他言語構文の混入',
    category: 'hallucinated_api',
    triggerPatterns: ['vba', 'マクロ', 'json', 'split', 'regex', '配列', 'ディクショナリ'],
    antiPatternExcerpt: 'Dim dict As Dictionary\nSet dict = New Dictionary \' (参照設定なしでの事前バインディングエラー)\nDim arr = [1, 2, 3] \' (他言語構文の混入)',
    correctedSolution: 'Dim dict As Object\nSet dict = CreateObject("Scripting.Dictionary") \' 遅延バインディングで安全に生成\nDim arr As Variant\narr = Array(1, 2, 3)',
    rootCause: 'Microsoft Scripting Runtimeの参照設定がない環境で事前バインディングを行ったり、Python/JavaScriptの配列リテラル構文をVBAに混入させてしまう。',
    avoidanceInstruction: '【環境非依存】DictionaryやRegExpを使用する際は、参照設定エラーを防ぐため必ず「CreateObject("Scripting.Dictionary")」等の遅延バインディングを用いること。またVBA構文規則を遵守すること。',
    occurredCount: 5,
    preventedCount: 19,
    severity: 'HIGH',
    status: 'ACTIVE',
    source: 'code_gate',
    relatedCodeLanguage: 'vba',
    lastDetectedAt: Date.now() - 3600000 * 18,
    createdAt: Date.now() - 3600000 * 24 * 7,
    updatedAt: Date.now() - 3600000 * 18,
  },
];

class FailureCatalogService {
  private signatures: FailureSignature[] = [];

  constructor() {
    this.signatures = this.loadSignatures();
  }

  /**
   * シグネチャ一覧の読み込み
   */
  public loadSignatures(): FailureSignature[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load failure signatures from storage:', e);
    }
    // 未保存なら初期プリセットを保存して返却
    this.saveSignatures(INITIAL_FAILURE_SIGNATURES);
    return [...INITIAL_FAILURE_SIGNATURES];
  }

  /**
   * シグネチャ一覧の永続化
   */
  public saveSignatures(list: FailureSignature[]): void {
    this.signatures = list;
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save failure signatures to storage:', e);
    }
  }

  /**
   * 全シグネチャ取得
   */
  public getAllSignatures(): FailureSignature[] {
    return [...this.signatures];
  }

  /**
   * ID指定取得
   */
  public getSignatureById(id: string): FailureSignature | undefined {
    return this.signatures.find((s) => s.signatureId === id);
  }

  /**
   * ユーザープロンプトやコンテキストに関連するアクティブな失敗シグネチャを検索 (事前ガード)
   */
  public findRelevantSignatures(
    prompt: string,
    context?: { isCodeOrVba?: boolean; language?: string }
  ): FailureSignature[] {
    const rawPrompt = (prompt || '').toLowerCase();
    const activeList = this.signatures.filter((s) => s.status === 'ACTIVE');

    const matched = activeList.filter((sig) => {
      // 言語フィルタ
      if (context?.language && sig.relatedCodeLanguage && sig.relatedCodeLanguage !== 'all') {
        if (sig.relatedCodeLanguage !== context.language && !rawPrompt.includes(sig.relatedCodeLanguage)) {
          return false;
        }
      }

      // トリガーパターンのいずれかがプロンプトに含まれるか
      const hitsPattern = sig.triggerPatterns.some((tp) => rawPrompt.includes(tp.toLowerCase()));
      if (hitsPattern) return true;

      // VBAコンテキストならVBA系シグネチャを高確率でヒット
      if (context?.isCodeOrVba && sig.category === 'vba_syntax') {
        return true;
      }

      return false;
    });

    // 重要度（CRITICAL > HIGH > MEDIUM > LOW）順にソートし、最大4件を返す
    const severityOrder: Record<FailureSeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    return matched
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.occurredCount - a.occurredCount)
      .slice(0, 4);
  }

  /**
   * 事前ガード用: プロンプトへ注入する厳格な回避指示文ブロックを生成
   */
  public generateAvoidancePromptBlock(signatures: FailureSignature[]): string {
    if (!signatures || signatures.length === 0) return '';

    const lines: string[] = [
      '【⚠️ 過去の反復失敗から抽出された必須回避ルール (設計思想 第51章 失敗カタログ)】',
      '以下の誤りパターンはユーザー環境で過去に不具合・重大エラーを引き起こしたため、絶対に再現させてはなりません：',
    ];

    signatures.forEach((sig, idx) => {
      lines.push(`${idx + 1}. [${sig.title}] (${sig.severity})`);
      lines.push(`   ・禁止ルール: ${sig.avoidanceInstruction}`);
      if (sig.antiPatternExcerpt) {
        const shortAnti = sig.antiPatternExcerpt.split('\n').slice(0, 2).join(' / ');
        lines.push(`   ・回避すべきアンチパターン例: 「${shortAnti}」`);
      }
    });

    lines.push('上記アンチパターンを徹底的に回避し、堅牢で安全な回答・コードを生成してください。\n');
    return lines.join('\n');
  }

  /**
   * コンテキストやプロンプトから該当するシグネチャを自動抽出し、プロンプト注入用の回避指示文ブロックを生成
   */
  public formatRulesForPrompt(context?: {
    isCodeOrVba?: boolean;
    language?: string;
    userPrompt?: string;
  }): string {
    const matchedSigs = this.findRelevantSignatures(context?.userPrompt || '', {
      isCodeOrVba: context?.isCodeOrVba,
      language: context?.language,
    });
    return this.generateAvoidancePromptBlock(matchedSigs);
  }

  /**
   * 事後スキャン用: 生成された回答・コードをスキャンし、アンチパターン違反がないか検査
   */
  public scanForAntiPatterns(
    text: string,
    context?: { isCodeOrVba?: boolean; language?: string }
  ): AntiPatternMatchResult[] {
    if (!text) return [];

    const results: AntiPatternMatchResult[] = [];
    const activeSignatures = this.signatures.filter((s) => s.status === 'ACTIVE');

    for (const sig of activeSignatures) {
      let violated = false;
      let matchedRule = '';
      let warningMessage = '';

      // 個別ルール別スキャンロジック
      if (sig.signatureId === 'SIG-VBA-001') {
        // ActiveSheet / Selection 暗黙参照の検知
        const vbaBlockRegex = /```(?:vba|vb)?([\s\S]*?)```/gi;
        let match: RegExpExecArray | null;
        while ((match = vbaBlockRegex.exec(text)) !== null) {
          const code = match[1];
          if (/(?:^|\s)(?:Range|Cells)\s*\(/i.test(code) && !/(\w+\.(?:Range|Cells))/i.test(code)) {
            violated = true;
            matchedRule = '修飾されていない暗黙のRange/Cells呼出';
            warningMessage = 'シート名修飾のないRange(...)またはCells(...)が検出されました。Set ws = ThisWorkbook.Sheets(...)で明示してください。';
            break;
          }
          if (/(?:^|\s)Selection\.(?:Copy|Paste|Value|Clear)/i.test(code)) {
            violated = true;
            matchedRule = 'Selectionオブジェクトへの直接依存';
            warningMessage = 'Selectionへの直接操作が検出されました。Rangeオブジェクトを直接指定してください。';
            break;
          }
        }
      } else if (sig.signatureId === 'SIG-VBA-002') {
        // Option Explicit の欠落
        const vbaBlockRegex = /```(?:vba|vb)?([\s\S]*?)```/gi;
        let match: RegExpExecArray | null;
        while ((match = vbaBlockRegex.exec(text)) !== null) {
          const code = match[1];
          if (/Sub\s+\w+\s*\(/i.test(code) && !/Option\s+Explicit/i.test(code)) {
            violated = true;
            matchedRule = 'Option Explicit の宣言欠如';
            warningMessage = 'モジュール冒頭に「Option Explicit」が宣言されていません。';
            break;
          }
        }
      } else if (sig.signatureId === 'SIG-VBA-003') {
        // ScreenUpdating = False かつ 復元なし
        if (/Application\.ScreenUpdating\s*=\s*False/i.test(text)) {
          if (!/Application\.ScreenUpdating\s*=\s*True/i.test(text)) {
            violated = true;
            matchedRule = 'ScreenUpdating = True による画面描画復元の欠落';
            warningMessage = '画面描画の停止後、正常終了・エラーハンドラ内での復元処理（ScreenUpdating = True）が見当たりません。';
          }
        }
      } else if (sig.signatureId === 'SIG-API-001') {
        // Dictionaryの事前バインディング
        if (/Dim\s+\w+\s+As\s+New\s+Dictionary/i.test(text) || /Dim\s+\w+\s+As\s+Dictionary/i.test(text)) {
          if (!/CreateObject\s*\(\s*["']Scripting\.Dictionary["']\s*\)/i.test(text)) {
            violated = true;
            matchedRule = 'Scripting.Dictionaryの事前バインディング参照';
            warningMessage = '参照設定が必要な事前バインディングが検出されました。CreateObject("Scripting.Dictionary") を使用してください。';
          }
        }
      } else if (sig.signatureId === 'SIG-OMISSION-001') {
        // 長大な挨拶と前置き
        if (
          /^(?:ご質問ありがとうございます|ご相談いただきありがとうございます|承知いたしました|了解いたしました)/.test(
            text.trim()
          ) &&
          text.length > 300 &&
          !/結論|結論から|解決策|要点/.test(text.slice(0, 80))
        ) {
          violated = true;
          matchedRule = '結論ファーストの原則違反（過剰な前置き）';
          warningMessage = '結論が冒頭に示されておらず、冗長な前置きで始まっています。';
        }
      } else if (sig.antiPatternExcerpt && sig.antiPatternExcerpt.length > 25) {
        // 汎用テキストマッチング: アンチパターン抜粋の主要フレーズが含まれるか
        const cleanExcerpt = sig.antiPatternExcerpt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 30);
        if (cleanExcerpt && text.includes(cleanExcerpt)) {
          violated = true;
          matchedRule = `アンチパターン断片との一致 (${sig.title})`;
          warningMessage = sig.avoidanceInstruction;
        }
      }

      if (violated) {
        results.push({
          signatureId: sig.signatureId,
          title: sig.title,
          matchedRule,
          category: sig.category,
          severity: sig.severity,
          suggestedFix: sig.correctedSolution,
          warningMessage,
          preventedAt: Date.now(),
        });

        // 抑止カウンターを安全にインクリメント
        sig.preventedCount = (sig.preventedCount || 0) + 1;
        sig.lastDetectedAt = Date.now();
        sig.updatedAt = Date.now();
      }
    }

    if (results.length > 0) {
      this.saveSignatures(this.signatures);
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `[第51章 失敗カタログ] ${results.length} 件のアンチパターン違反を事前検知・抑止しました: ${results.map((r) => r.title).join(', ')}`
      );
    }

    return results;
  }

  /**
   * 新しい失敗からシグネチャを自動または手動で登録
   */
  public registerSignature(params: {
    title: string;
    category: FailureCategory;
    triggerPatterns: string[];
    antiPatternExcerpt: string;
    correctedSolution: string;
    rootCause: string;
    avoidanceInstruction: string;
    severity?: FailureSeverity;
    source?: FailureSignature['source'];
    relatedCodeLanguage?: string;
  }): FailureSignature {
    const signatureId = `SIG-${params.category.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const newSig: FailureSignature = {
      signatureId,
      title: params.title.trim(),
      category: params.category,
      triggerPatterns: params.triggerPatterns.map((t) => t.trim()).filter(Boolean),
      antiPatternExcerpt: params.antiPatternExcerpt.trim(),
      correctedSolution: params.correctedSolution.trim(),
      rootCause: params.rootCause.trim(),
      avoidanceInstruction: params.avoidanceInstruction.trim(),
      occurredCount: 1,
      preventedCount: 0,
      severity: params.severity || 'HIGH',
      status: 'ACTIVE',
      source: params.source || 'manual',
      relatedCodeLanguage: params.relatedCodeLanguage,
      lastDetectedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.signatures.unshift(newSig);
    this.saveSignatures(this.signatures);

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[第51章 失敗カタログ] 新規失敗シグネチャを登録しました: ${newSig.signatureId} (${newSig.title})`
    );

    return newSig;
  }

  /**
   * シグネチャのステータス更新
   */
  public updateStatus(signatureId: string, newStatus: FailureSignatureStatus): boolean {
    const sig = this.signatures.find((s) => s.signatureId === signatureId);
    if (!sig) return false;
    sig.status = newStatus;
    sig.updatedAt = Date.now();
    this.saveSignatures(this.signatures);
    return true;
  }

  /**
   * シグネチャの削除
   */
  public deleteSignature(signatureId: string): boolean {
    const initialLen = this.signatures.length;
    this.signatures = this.signatures.filter((s) => s.signatureId !== signatureId);
    if (this.signatures.length !== initialLen) {
      this.saveSignatures(this.signatures);
      return true;
    }
    return false;
  }

  /**
   * 統計ダッシュボードデータの算出
   */
  public getCatalogStats(): FailureCatalogStats {
    const stats: FailureCatalogStats = {
      totalSignatures: this.signatures.length,
      activeCount: this.signatures.filter((s) => s.status === 'ACTIVE').length,
      totalPrevented: this.signatures.reduce((acc, s) => acc + (s.preventedCount || 0), 0),
      totalOccurred: this.signatures.reduce((acc, s) => acc + (s.occurredCount || 0), 0),
      criticalCount: this.signatures.filter((s) => s.severity === 'CRITICAL' && s.status === 'ACTIVE').length,
      categoryDistribution: {},
    };

    for (const sig of this.signatures) {
      stats.categoryDistribution[sig.category] = (stats.categoryDistribution[sig.category] || 0) + 1;
    }

    return stats;
  }
}

export const failureCatalogService = new FailureCatalogService();

import {
  ComprehensiveCodeVerification,
  CodeLanguageType,
  CodeSafetyRiskItem,
  CodeSafetyLevel,
  CodeReadinessStatus,
} from '../types';

/**
 * 設計思想 10章 & 35章 第5段階:
 * 総合コード・VBA安全準備ゲート & 構文検証サービス (Code & VBA Preparation Gate)
 *
 * 【第5段階 実装要件】:
 * 1. マルチ言語構文整合性チェック（閉じタグ、ブロック対照、未定義・不完全構造の検出）
 * 2. 破壊的・危険命令の多層検出（Shell実行、任意ファイル削除、不正外部通信、自動実行イベント）
 * 3. 動作環境前提（Excel 64bit PtrSafe宣言、Microsoft Scripting Runtime、Canvas 2Dコンテキスト）の明示
 * 4. 実行準備ステータス判定（プレビュー即時可能 / 外部検証必須 / 危険遮断）
 */
export class CodeVerificationService {
  /**
   * テキスト中の全コードブロックを解析し、総合コード安全検証を実施する
   */
  public verifyCode(content: string): ComprehensiveCodeVerification {
    const raw = content || '';
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const blocks: Array<{ lang: string; code: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(raw)) !== null) {
      blocks.push({
        lang: (match[1] || '').trim().toLowerCase(),
        code: match[2] || '',
      });
    }

    if (blocks.length === 0) {
      return {
        hasCode: false,
        languages: [],
        syntaxValid: true,
        syntaxErrors: [],
        safetyLevel: 'PASS_SAFE',
        safetyScore: 100,
        risks: [],
        environmentRequirements: [],
        readiness: 'READY_FOR_PREVIEW',
        reviewedAt: Date.now(),
      };
    }

    const detectedLanguages = new Set<CodeLanguageType>();
    const syntaxErrors: string[] = [];
    const risks: CodeSafetyRiskItem[] = [];
    const envReqs = new Set<string>();

    for (const b of blocks) {
      const lang = this.normalizeLanguage(b.lang, b.code);
      detectedLanguages.add(lang);

      // 1. 構文整合性チェック
      this.checkSyntax(b.code, lang, syntaxErrors);

      // 2. セキュリティ & 危険命令検査
      this.checkRisks(b.code, lang, risks);

      // 3. 動作環境前提の抽出
      this.checkEnvironment(b.code, lang, envReqs);
    }

    // 総合スコアの算出 (初期値100からリスクごとに減点)
    let safetyScore = 100;
    if (syntaxErrors.length > 0) safetyScore -= syntaxErrors.length * 15;
    for (const r of risks) {
      if (r.severity === 'critical') safetyScore -= 50;
      else if (r.severity === 'high') safetyScore -= 30;
      else if (r.severity === 'medium') safetyScore -= 15;
      else safetyScore -= 5;
    }
    safetyScore = Math.max(0, Math.min(100, safetyScore));

    // 安全レベル判定
    let safetyLevel: CodeSafetyLevel = 'PASS_SAFE';
    const hasCritical = risks.some((r) => r.severity === 'critical' || r.severity === 'high');
    const hasMedium = risks.some((r) => r.severity === 'medium');

    if (hasCritical) {
      safetyLevel = 'BLOCKED_HIGH_RISK';
    } else if (hasMedium || syntaxErrors.length > 0) {
      safetyLevel = 'WARN_REVIEW_NEEDED';
    }

    // 準備ステータス判定
    let readiness: CodeReadinessStatus = 'READY_FOR_PREVIEW';
    const isVba = detectedLanguages.has('vba');

    if (safetyLevel === 'BLOCKED_HIGH_RISK') {
      readiness = 'BLOCKED';
    } else if (isVba) {
      readiness = 'EXTERNAL_TEST_REQUIRED'; // VBAはスマホ単体での完全実行不可、PCでのコンパイル・動作確認が必要
    } else if (syntaxErrors.length > 0 || hasMedium) {
      readiness = 'RUNTIME_GUARD_NEEDED';
    }

    return {
      hasCode: true,
      languages: Array.from(detectedLanguages),
      syntaxValid: syntaxErrors.length === 0,
      syntaxErrors,
      safetyLevel,
      safetyScore,
      risks,
      environmentRequirements: Array.from(envReqs),
      readiness,
      reviewedAt: Date.now(),
    };
  }

  /**
   * 言語の正規化と自動推定
   */
  private normalizeLanguage(declaredLang: string, code: string): CodeLanguageType {
    const d = declaredLang.toLowerCase();
    const cLower = code.toLowerCase();

    if (
      d === 'vba' ||
      d === 'vb' ||
      d === 'bas' ||
      d === 'cls' ||
      cLower.includes('sub ') ||
      cLower.includes('function ') && (cLower.includes('dim ') || cLower.includes('end sub') || cLower.includes('cells('))
    ) {
      return 'vba';
    }

    if (d === 'html' || code.includes('<!DOCTYPE') || (code.includes('<html') && code.includes('</html>'))) {
      if (code.includes('<canvas') && (code.includes('requestAnimationFrame') || code.includes('getContext'))) {
        return 'canvas';
      }
      return 'html';
    }

    if (d === 'javascript' || d === 'js' || d === 'jsx' || d === 'ts' || d === 'tsx') {
      if (code.includes('getContext') || code.includes('requestAnimationFrame')) {
        return 'canvas';
      }
      return 'javascript';
    }

    if (d === 'python' || d === 'py' || cLower.includes('def ') && cLower.includes('import ')) {
      return 'python';
    }

    if (d === 'json') return 'json';
    if (d === 'sql') return 'sql';

    return 'other';
  }

  /**
   * 構文整合性チェック
   */
  private checkSyntax(code: string, lang: CodeLanguageType, errors: string[]): void {
    const lines = code.split('\n');

    // 共通: 括弧の整合性 (文字列内部を除く簡易チェック)
    let parenCount = 0;
    let braceCount = 0;
    let bracketCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith("'") || trimmed.startsWith('#')) continue;

      for (const ch of trimmed) {
        if (ch === '(') parenCount++;
        else if (ch === ')') parenCount--;
        else if (ch === '{') braceCount++;
        else if (ch === '}') braceCount--;
        else if (ch === '[') bracketCount++;
        else if (ch === ']') bracketCount--;
      }
    }

    if (parenCount !== 0) errors.push(`丸括弧 () の対応不整合 (差分: ${parenCount})`);
    if (braceCount !== 0 && (lang === 'javascript' || lang === 'canvas' || lang === 'html')) {
      errors.push(`波括弧 {} の対応不整合 (差分: ${braceCount})`);
    }
    if (bracketCount !== 0) errors.push(`角括弧 [] の対応不整合 (差分: ${bracketCount})`);

    // VBA特有のブロックチェック
    if (lang === 'vba') {
      let subCount = 0;
      let funcCount = 0;
      let ifCount = 0;
      let forCount = 0;
      let doCount = 0;

      for (const line of lines) {
        const l = line.trim().toLowerCase();
        if (l.startsWith("'")) continue;

        // Sub / End Sub
        if (/^sub\s+/i.test(l) || /^private\s+sub\s+/i.test(l) || /^public\s+sub\s+/i.test(l)) subCount++;
        if (/^end\s+sub/i.test(l)) subCount--;

        // Function / End Function
        if (/^function\s+/i.test(l) || /^private\s+function\s+/i.test(l) || /^public\s+function\s+/i.test(l)) funcCount++;
        if (/^end\s+function/i.test(l)) funcCount--;

        // If ... Then (単一行Ifは除外)
        if (/^if\s+.*then\s*$/i.test(l)) ifCount++;
        if (/^end\s+if/i.test(l)) ifCount--;

        // For ... Next
        if (/^for\s+/i.test(l)) forCount++;
        if (/^next(\s+.*)?$/i.test(l)) forCount--;

        // Do ... Loop
        if (/^do(\s+.*)?$/i.test(l)) doCount++;
        if (/^loop(\s+.*)?$/i.test(l)) doCount--;
      }

      if (subCount > 0) errors.push(`VBA: End Sub が不足しています (${subCount}箇所)`);
      if (funcCount > 0) errors.push(`VBA: End Function が不足しています (${funcCount}箇所)`);
      if (ifCount > 0) errors.push(`VBA: End If が不足しています (${ifCount}箇所)`);
      if (forCount > 0) errors.push(`VBA: Next が不足しています (${forCount}箇所)`);
      if (doCount > 0) errors.push(`VBA: Loop が不足しています (${doCount}箇所)`);
    }

    // HTML / Canvas 特有のタグ整合性
    if (lang === 'html' || lang === 'canvas') {
      if (code.includes('<canvas') && !code.includes('</canvas>')) {
        errors.push('HTML: <canvas> タグの閉じタグ </canvas> が見当たりません');
      }
      if (code.includes('<script') && !code.includes('</script>')) {
        errors.push('HTML: <script> タグの閉じタグ </script> が見当たりません');
      }
      if (code.includes('<style') && !code.includes('</style>')) {
        errors.push('HTML: <style> タグの閉じタグ </style> が見当たりません');
      }
    }
  }

  /**
   * セキュリティ & 危険命令検査
   */
  private checkRisks(code: string, lang: CodeLanguageType, risks: CodeSafetyRiskItem[]): void {
    const cLower = code.toLowerCase();

    // 1. シェル・コマンド実行（最高危険度）
    if (
      cLower.includes('wscript.shell') ||
      cLower.includes('shell(') ||
      cLower.includes('cmd.exe') ||
      cLower.includes('powershell') ||
      cLower.includes('child_process') ||
      cLower.includes('createobject("wscript.shell")')
    ) {
      risks.push({
        riskType: 'shell_exec',
        severity: 'critical',
        description: '外部シェル(cmd/PowerShell/WScript)の直接呼び出しが検知されました。不正プログラム実行の危険性があります。',
      });
    }

    // 2. 破壊的ファイルシステム操作
    if (
      (lang === 'vba' && (/kill\s+/i.test(code) || /rmdir\s+/i.test(code))) ||
      cLower.includes('deletefile') ||
      cLower.includes('deletefolder') ||
      cLower.includes('unlink(')
    ) {
      risks.push({
        riskType: 'file_system',
        severity: 'high',
        description: 'ローカルファイルの強制削除(Kill/RmDir/DeleteFile)命令が含まれています。データ消失リスクがあります。',
      });
    }

    // 3. 不正ネットワーク通信
    if (
      cLower.includes('winhttp.winhttprequest') ||
      cLower.includes('msxml2.serverxmlhttp') ||
      cLower.includes('urldownloadtofile')
    ) {
      risks.push({
        riskType: 'network',
        severity: 'medium',
        description: '外部サーバーへの直接HTTP通信・ファイルダウンロードAPIが含まれています。送信先と安全性を確認してください。',
      });
    }

    // 4. 自動実行イベント
    if (
      cLower.includes('workbook_open') ||
      cLower.includes('auto_open') ||
      cLower.includes('document_open')
    ) {
      risks.push({
        riskType: 'auto_exec',
        severity: 'medium',
        description: 'ファイルを開いた瞬間に無確認で自動実行されるAuto_Openイベントが定義されています。',
      });
    }

    // 5. 無限ループ危険性
    if (
      (/do\s+while\s+true/i.test(code) || /while\s*\(true\)/i.test(code)) &&
      !code.includes('Exit Do') &&
      !code.includes('break')
    ) {
      risks.push({
        riskType: 'infinite_loop',
        severity: 'high',
        description: '脱出条件のない無限ループ(While True / Do While True)が検知されました。UIの完全フリーズを招きます。',
      });
    }
  }

  /**
   * 動作環境・ライブラリ前提の抽出
   */
  private checkEnvironment(code: string, lang: CodeLanguageType, envReqs: Set<string>): void {
    const cLower = code.toLowerCase();

    if (lang === 'vba') {
      if (cLower.includes('declare ') && !cLower.includes('ptrsafe')) {
        envReqs.add('⚠️ 32bit専用Declare宣言が含まれています (Excel 64bitでは PtrSafe 宣言が必要です)');
      } else if (cLower.includes('declare ptrsafe')) {
        envReqs.add('64-bit Office対応 (Declare PtrSafe 適用済み)');
      }

      if (cLower.includes('scripting.dictionary')) {
        envReqs.add('Microsoft Scripting Runtime 参照設定 または CreateObject("Scripting.Dictionary")');
      }

      if (cLower.includes('adodb.connection') || cLower.includes('adodb.recordset')) {
        envReqs.add('Microsoft ActiveX Data Objects (ADO) 参照設定が必要');
      }

      if (cLower.includes('regexp') || cLower.includes('vbscript.regexp')) {
        envReqs.add('Microsoft VBScript Regular Expressions 5.5 参照設定 または CreateObject');
      }
    }

    if (lang === 'canvas') {
      envReqs.add('HTML5 Canvas対応モダンブラウザ (WebGPU / Canvas2D API)');
      if (code.includes('three.js') || code.includes('three.min.js')) {
        envReqs.add('Three.js WebGL 3Dレンダラー (CDN接続)');
      }
    }
  }
}

export const codeVerificationService = new CodeVerificationService();

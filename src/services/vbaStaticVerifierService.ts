import {
  VbaStaticVerificationResult,
  VbaProcedureDeclaration,
  VbaForbiddenPattern,
  VbaVariableDeclaration,
} from '../types';

/**
 * 設計思想 63章 & 64章: VBA静的検証器 (VBA Static Verifier) 8大スキャナー構成
 *
 * 【63章 生成ルール】:
 * 1. 修正対象プロシージャは全文生成する (省略・差分パッチ禁止)
 * 2. Goto と行ラベルを禁止する
 * 3. If はブロックIfとする (単行If禁止)
 * 4. 既存Public署名を維持する
 * 5. 既存分岐と例外処理を無断削除しない
 *
 * 【64章 8大構成要素】:
 * 1. Parser: コメント・文字列・継続行を考慮して構造を解析する
 * 2. ProcedureScanner: Sub・Function・Propertyの開始・終了を取得する
 * 3. BlockScanner: If・For・Do・Select・Withなどのネストを確認する
 * 4. ForbiddenPatternScanner: Goto・行ラベル・単行If・省略記号を検出する
 * 5. DeclarationScanner: Option Explicit・Dim・Private・Public・Const・型を索引化する
 * 6. SignatureComparator: 既存Publicプロシージャの名前・引数・戻り値を比較する
 * 7. DependencyScanner: Worksheets・Range・イベント・外部関数名を抽出する
 * 8. DeliveryVerifier: 提示文字列そのものを検証し、SHA-256を算出する
 */
export class VbaStaticVerifierService {
  /**
   * 単一文字列のSHA-256チェックサム計算 (Web Crypto API / フォールバック)
   */
  public async computeSha256(text: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // fall through to manual hash
      }
    }
    // 軽量フォールバックハッシュ
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
  }

  /**
   * 64章 1. Parser:
   * コメント・文字列リテラルをマスクし、継続行(` _`)を結合した行単位解析用データを生成
   */
  private parseLines(rawCode: string): Array<{
    originalLineNum: number;
    originalText: string;
    sanitizedText: string; // 文字列リテラルを "" にマスクし、コメントを除去した構文用テキスト
    commentText: string;
  }> {
    const rawLines = rawCode.split(/\r?\n/);
    const parsedLines: Array<{
      originalLineNum: number;
      originalText: string;
      sanitizedText: string;
      commentText: string;
    }> = [];

    let currentCombined = '';
    let currentOriginal = '';
    let startLineNum = 1;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lineNum = i + 1;

      if (!currentCombined) {
        startLineNum = lineNum;
        currentOriginal = line;
      } else {
        currentOriginal += '\n' + line;
      }

      // 文字列とコメントを分離
      let inString = false;
      let sanitized = '';
      let comment = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inString = !inString;
          sanitized += '"';
        } else if (!inString && (char === "'" || (line.substring(c, c + 4).toLowerCase() === 'rem ' && (c === 0 || /\s/.test(line[c - 1]))))) {
          comment = line.substring(c);
          break;
        } else if (!inString) {
          sanitized += char;
        } else {
          // 文字列の内部はマスク
          sanitized += ' ';
        }
      }

      const trimmedSanitized = sanitized.trimEnd();

      // 継続行 (' _') の判定
      if (trimmedSanitized.endsWith(' _')) {
        currentCombined += (currentCombined ? ' ' : '') + trimmedSanitized.slice(0, -2);
      } else {
        const fullSanitized = currentCombined
          ? currentCombined + ' ' + trimmedSanitized
          : trimmedSanitized;

        parsedLines.push({
          originalLineNum: startLineNum,
          originalText: currentOriginal,
          sanitizedText: fullSanitized.trim(),
          commentText: comment.trim(),
        });

        currentCombined = '';
        currentOriginal = '';
      }
    }

    if (currentCombined) {
      parsedLines.push({
        originalLineNum: startLineNum,
        originalText: currentOriginal,
        sanitizedText: currentCombined.trim(),
        commentText: '',
      });
    }

    return parsedLines;
  }

  /**
   * 64章 2. ProcedureScanner:
   * Sub, Function, Property の開始と終端を解析
   */
  private scanProcedures(parsedLines: ReturnType<typeof this.parseLines>): VbaProcedureDeclaration[] {
    const procedures: VbaProcedureDeclaration[] = [];
    const procStartRegex = /^(?:(Public|Private|Friend)\s+)?(?:Static\s+)?(Sub|Function|Property\s+(?:Get|Let|Set))\s+([a-zA-Z0-9_]+)\s*(?:\((.*?)\))?(?:\s+As\s+([a-zA-Z0-9_\[\]]+))?/i;
    const procEndRegex = /^End\s+(Sub|Function|Property)/i;

    let currentProc: VbaProcedureDeclaration | null = null;

    for (const pLine of parsedLines) {
      const match = pLine.sanitizedText.match(procStartRegex);
      if (match && !currentProc) {
        const visibility = (match[1] || 'Default') as VbaProcedureDeclaration['visibility'];
        const kindRaw = match[2];
        let kind: VbaProcedureDeclaration['kind'] = 'Sub';
        if (/^Function$/i.test(kindRaw)) kind = 'Function';
        else if (/^Property\s+Get$/i.test(kindRaw)) kind = 'Property Get';
        else if (/^Property\s+Let$/i.test(kindRaw)) kind = 'Property Let';
        else if (/^Property\s+Set$/i.test(kindRaw)) kind = 'Property Set';

        const name = match[3];
        const rawParams = match[4] || '';
        const returnType = match[5];

        // 引数の簡易パース
        const parameters = rawParams
          .split(',')
          .map((param) => param.trim())
          .filter(Boolean)
          .map((paramStr) => {
            const isOptional = /^\s*Optional\b/i.test(paramStr);
            const isByVal = /\bByVal\b/i.test(paramStr);
            const pMatch = paramStr.match(/(?:Optional\s+)?(?:ByVal\s+|ByRef\s+)?([a-zA-Z0-9_]+)(?:\s+As\s+([a-zA-Z0-9_\[\]]+))?/i);
            return {
              name: pMatch ? pMatch[1] : paramStr,
              type: pMatch && pMatch[2] ? pMatch[2] : 'Variant',
              isByVal,
              isOptional,
            };
          });

        currentProc = {
          name,
          kind,
          visibility,
          parameters,
          returnType,
          startLine: pLine.originalLineNum,
          endLine: pLine.originalLineNum,
          isFullyClosed: false,
        };
      } else if (currentProc && procEndRegex.test(pLine.sanitizedText)) {
        currentProc.endLine = pLine.originalLineNum;
        currentProc.isFullyClosed = true;
        procedures.push(currentProc);
        currentProc = null;
      }
    }

    if (currentProc) {
      // 終端 End Sub/Function がないまま終了
      procedures.push(currentProc);
    }

    return procedures;
  }

  /**
   * 64章 3. BlockScanner:
   * If, For, Do, Select Case, With のブロック整合性と未終了ブロックの検出
   */
  private scanBlocks(parsedLines: ReturnType<typeof this.parseLines>): {
    valid: boolean;
    openBlocks: string[];
  } {
    const blockStack: Array<{ type: string; line: number }> = [];

    for (const p of parsedLines) {
      const text = p.sanitizedText;
      if (!text) continue;

      // Select Case
      if (/^Select\s+Case\b/i.test(text)) {
        blockStack.push({ type: 'Select', line: p.originalLineNum });
      } else if (/^End\s+Select\b/i.test(text)) {
        const last = blockStack.pop();
        if (!last || last.type !== 'Select') {
          return { valid: false, openBlocks: [`行${p.originalLineNum}: 不正な 'End Select'`] };
        }
      }
      // With
      else if (/^With\b/i.test(text)) {
        blockStack.push({ type: 'With', line: p.originalLineNum });
      } else if (/^End\s+With\b/i.test(text)) {
        const last = blockStack.pop();
        if (!last || last.type !== 'With') {
          return { valid: false, openBlocks: [`行${p.originalLineNum}: 不正な 'End With'`] };
        }
      }
      // For
      else if (/^For\b/i.test(text)) {
        blockStack.push({ type: 'For', line: p.originalLineNum });
      } else if (/^Next(?:\s+[a-zA-Z0-9_]+)?\b/i.test(text)) {
        const last = blockStack.pop();
        if (!last || last.type !== 'For') {
          return { valid: false, openBlocks: [`行${p.originalLineNum}: 不正な 'Next'`] };
        }
      }
      // Do
      else if (/^Do(?:\s+(?:While|Until)\b)?/i.test(text)) {
        blockStack.push({ type: 'Do', line: p.originalLineNum });
      } else if (/^Loop(?:\s+(?:While|Until)\b)?/i.test(text)) {
        const last = blockStack.pop();
        if (!last || last.type !== 'Do') {
          return { valid: false, openBlocks: [`行${p.originalLineNum}: 不正な 'Loop'`] };
        }
      }
      // Block If (Then で行が終わるもの)
      else if (/^If\b/i.test(text) && /\bThen$/i.test(text)) {
        blockStack.push({ type: 'If', line: p.originalLineNum });
      } else if (/^End\s+If\b/i.test(text)) {
        const last = blockStack.pop();
        if (!last || last.type !== 'If') {
          return { valid: false, openBlocks: [`行${p.originalLineNum}: 不正な 'End If'`] };
        }
      }
    }

    const openBlocks = blockStack.map((b) => `行${b.line}の '${b.type}' ブロックが閉じられていません`);
    return {
      valid: openBlocks.length === 0,
      openBlocks,
    };
  }

  /**
   * 64章 4. ForbiddenPatternScanner (63章 厳格生成ルール):
   * Goto, 行ラベル, 単行If, 省略記号(...)の検出
   */
  private scanForbiddenPatterns(parsedLines: ReturnType<typeof this.parseLines>): VbaForbiddenPattern[] {
    const forbidden: VbaForbiddenPattern[] = [];

    for (const p of parsedLines) {
      const text = p.sanitizedText;
      const original = p.originalText;
      if (!text) continue;

      // 1. Goto 禁止 (ただし On Error GoTo は VBA標準エラー処理のため除外)
      if (/\bGoto\s+([a-zA-Z0-9_]+)/i.test(text) && !/On\s+Error\s+GoTo\b/i.test(text)) {
        forbidden.push({
          type: 'GOTO',
          line: p.originalLineNum,
          codeSnippet: text,
          explanation: 'Goto 命令は禁止されています (On Error GoTo を除く)。構造化制御構文を使用してください。',
        });
      }

      // 2. 行ラベル禁止 (例: Label: や 100:)
      // Select Case の Case 条件やコロン区切り複数文を除外して判定
      if (/^[a-zA-Z0-9_]+:\s*$/i.test(text) && !/^(?:Case\s+|Default:)/i.test(text)) {
        forbidden.push({
          type: 'LINE_LABEL',
          line: p.originalLineNum,
          codeSnippet: text,
          explanation: '行ラベル (Line Label / 行番号) は禁止されています。',
        });
      }

      // 3. 単行If禁止 (63章: IfはブロックIfとする)
      // If ... Then の後に同一行で文が続いているものを検出
      if (/^If\b/i.test(text) && /\bThen\b/i.test(text) && !/\bThen$/i.test(text)) {
        forbidden.push({
          type: 'SINGLE_LINE_IF',
          line: p.originalLineNum,
          codeSnippet: text,
          explanation: '単行If文が検出されました。63章の生成ルールに基づき、必ずブロックIf (If ... Then ～ End If) で記述してください。',
        });
      }

      // 4. コード省略記号・差分パッチ表記の禁止 (63章: 省略・差分パッチ禁止、全文生成)
      if (
        /\.{3,}/.test(original) ||
        /(?:\/\*|\/\/|')\s*(?:TODO|既存のコード|以下省略|省略|そのまま)/i.test(original) ||
        /^\s*<\w+>\s*$/i.test(original)
      ) {
        forbidden.push({
          type: 'UNHANDLED_DIFF_OMISSION',
          line: p.originalLineNum,
          codeSnippet: original.trim(),
          explanation: 'コード省略記号（... または「既存のコード」等）が検出されました。63章生成ルールに従い、プロシージャは省略せず全文を生成してください。',
        });
      }
    }

    return forbidden;
  }

  /**
   * 64章 5. DeclarationScanner:
   * Option Explicit および 変数・定数宣言の索引化
   */
  private scanDeclarations(
    rawCode: string,
    parsedLines: ReturnType<typeof this.parseLines>,
    procedures: VbaProcedureDeclaration[]
  ): {
    hasOptionExplicit: boolean;
    declarations: VbaVariableDeclaration[];
  } {
    // 最初のプロシージャより前のヘッダー部分で Option Explicit を確認
    const firstProcLine = procedures.length > 0 ? procedures[0].startLine : Infinity;
    const headerLines = parsedLines.filter((p) => p.originalLineNum < firstProcLine);
    const hasOptionExplicit = headerLines.some((p) => /^Option\s+Explicit\b/i.test(p.sanitizedText));

    const declarations: VbaVariableDeclaration[] = [];
    const varDeclRegex = /\b(Dim|Private|Public|Const|Static)\s+([a-zA-Z0-9_]+)(?:\s+As\s+([a-zA-Z0-9_\[\]]+))?/gi;

    for (const p of parsedLines) {
      let m: RegExpExecArray | null;
      while ((m = varDeclRegex.exec(p.sanitizedText)) !== null) {
        declarations.push({
          scope: m[1] as VbaVariableDeclaration['scope'],
          name: m[2],
          type: m[3] || 'Variant (暗黙的型付け)',
          isExplicitType: Boolean(m[3]),
          line: p.originalLineNum,
        });
      }
    }

    return { hasOptionExplicit, declarations };
  }

  /**
   * 64章 6. SignatureComparator:
   * 既存Publicプロシージャのシグネチャ（名前・引数・戻り値）の維持確認
   */
  public compareSignatures(
    baselineProcedures: VbaProcedureDeclaration[],
    newProcedures: VbaProcedureDeclaration[]
  ): { matched: boolean; differences: string[] } {
    const differences: string[] = [];
    const newProcMap = new Map(newProcedures.map((p) => [p.name.toLowerCase(), p]));

    for (const base of baselineProcedures) {
      if (base.visibility !== 'Public') continue;

      const target = newProcMap.get(base.name.toLowerCase());
      if (!target) {
        differences.push(`既存Publicプロシージャ '${base.name}' が削除または名前変更されています`);
        continue;
      }

      if (target.visibility !== 'Public') {
        differences.push(`Publicプロシージャ '${base.name}' の可視性が '${target.visibility}' へ変更されています`);
      }

      if (base.parameters.length !== target.parameters.length) {
        differences.push(
          `プロシージャ '${base.name}' の引数数が一致しません (既存: ${base.parameters.length}, 新規: ${target.parameters.length})`
        );
      }

      if ((base.returnType || '') !== (target.returnType || '')) {
        differences.push(
          `プロシージャ '${base.name}' の戻り値型が異なります (既存: ${base.returnType || 'None'}, 新規: ${target.returnType || 'None'})`
        );
      }
    }

    return {
      matched: differences.length === 0,
      differences,
    };
  }

  /**
   * 64章 7. DependencyScanner:
   * ワークシート、Range、イベント、外部関数の抽出
   */
  private scanDependencies(parsedLines: ReturnType<typeof this.parseLines>): {
    worksheets: string[];
    ranges: string[];
    events: string[];
    externalAPIs: string[];
  } {
    const worksheets = new Set<string>();
    const ranges = new Set<string>();
    const events = new Set<string>();
    const externalAPIs = new Set<string>();

    for (const p of parsedLines) {
      const orig = p.originalText;
      const text = p.sanitizedText;

      // Sheets / Worksheets
      const sheetMatches = orig.match(/(?:Sheets|Worksheets)\s*\(\s*"([^"]+)"\s*\)/gi);
      if (sheetMatches) {
        for (const sm of sheetMatches) {
          const name = sm.match(/"([^"]+)"/);
          if (name) worksheets.add(name[1]);
        }
      }

      // Range / Cells
      const rangeMatches = orig.match(/Range\s*\(\s*"([^"]+)"\s*\)/gi);
      if (rangeMatches) {
        for (const rm of rangeMatches) {
          const addr = rm.match(/"([^"]+)"/);
          if (addr) ranges.add(addr[1]);
        }
      }

      // Excel標準イベント
      const eventMatch = text.match(/\b(Workbook_Open|Workbook_BeforeClose|Worksheet_Change|Worksheet_SelectionChange|Worksheet_Calculate)\b/i);
      if (eventMatch) events.add(eventMatch[1]);

      // Declare PtrSafe (Win32 API等)
      if (/\bDeclare\s+(?:PtrSafe\s+)?(?:Sub|Function)\b/i.test(text)) {
        externalAPIs.add(text.slice(0, 80));
      }
    }

    return {
      worksheets: Array.from(worksheets),
      ranges: Array.from(ranges),
      events: Array.from(events),
      externalAPIs: Array.from(externalAPIs),
    };
  }

  /**
   * 63章 & 64章: VBA静的検証器の総合実行メソッド
   */
  public async verifyVbaCode(
    rawCode: string,
    baselineCodeForSignatureComparison?: string
  ): Promise<VbaStaticVerificationResult> {
    const parsedLines = this.parseLines(rawCode);

    // 2. ProcedureScanner
    const procedures = this.scanProcedures(parsedLines);
    const allProceduresFullyClosed = procedures.length > 0 && procedures.every((p) => p.isFullyClosed);

    // 3. BlockScanner
    const blockResult = this.scanBlocks(parsedLines);

    // 4. ForbiddenPatternScanner
    const forbiddenPatterns = this.scanForbiddenPatterns(parsedLines);

    // 5. DeclarationScanner
    const { hasOptionExplicit, declarations } = this.scanDeclarations(rawCode, parsedLines, procedures);

    // 6. SignatureComparator (比較対象がある場合)
    let signatureComparison: VbaStaticVerificationResult['signatureComparison'];
    if (baselineCodeForSignatureComparison) {
      const baseLines = this.parseLines(baselineCodeForSignatureComparison);
      const baseProcedures = this.scanProcedures(baseLines);
      signatureComparison = this.compareSignatures(baseProcedures, procedures);
    }

    // 7. DependencyScanner
    const dependencies = this.scanDependencies(parsedLines);

    // 8. DeliveryVerifier
    const sha256Checksum = await this.computeSha256(rawCode);
    const hasOmission = forbiddenPatterns.some((f) => f.type === 'UNHANDLED_DIFF_OMISSION');

    // 総合スコア算出 (100点満点減点法)
    let score = 100;
    if (!hasOptionExplicit) score -= 20;
    if (!allProceduresFullyClosed) score -= 25;
    if (!blockResult.valid) score -= 25;
    score -= forbiddenPatterns.length * 15;
    if (signatureComparison && !signatureComparison.matched) score -= 20;
    score = Math.max(0, Math.min(100, score));

    const overallPassed =
      hasOptionExplicit &&
      allProceduresFullyClosed &&
      blockResult.valid &&
      forbiddenPatterns.length === 0 &&
      (!signatureComparison || signatureComparison.matched);

    const summary = overallPassed
      ? `✅ 【VBA静的検証 全合格】Option Explicit確認済、全${procedures.length}プロシージャ終端正常、ブロックネスト正常、禁止パターン0件。SHA-256: ${sha256Checksum.slice(0, 12)}...`
      : `⚠️ 【VBA静的検証 違反検出】スコア: ${score}/100 (Option Explicit: ${hasOptionExplicit ? 'OK' : '未記載'}, 禁止パターン: ${forbiddenPatterns.length}件, 開放ブロック: ${blockResult.openBlocks.length}件)`;

    return {
      hasOptionExplicit,
      procedures,
      allProceduresFullyClosed,
      blockNestingValid: blockResult.valid,
      openBlocks: blockResult.openBlocks,
      forbiddenPatterns,
      declarations,
      dependencies,
      signatureComparison,
      deliveryVerification: {
        isCompleteCode: !hasOmission,
        omissionDetected: hasOmission,
        sha256Checksum,
        lineCount: rawCode.split(/\r?\n/).length,
        charCount: rawCode.length,
      },
      overallPassed,
      verdictScore: score,
      summary,
      verifiedAt: Date.now(),
    };
  }
}

export const vbaStaticVerifierService = new VbaStaticVerifierService();

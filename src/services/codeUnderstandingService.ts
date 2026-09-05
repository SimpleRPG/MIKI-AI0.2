import {
  CodeUnderstandingIR,
  CodeProcedureIR,
  VbaModuleFile,
  CrossModuleCallEdge,
  CrossModuleImpactAnalysis,
  MultiModuleAnalysisResult,
} from '../types';
import { systemLogger } from './systemLogger';

class CodeUnderstandingService {
  /**
   * 23章 & 35章 第10段階: コード理解パイプライン (12ステップ)
   * VBA, JavaScript, TypeScript, Python などのコードスニペットから
   * 構造化中間JSON表現(CodeUnderstandingIR)とコメント矛盾を自動抽出する
   */
  public analyzeCode(snippet: string, languageHint = 'vba'): CodeUnderstandingIR {
    const raw = snippet || '';
    const id = `ir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const lang = languageHint.toLowerCase();

    // 1. コード分割 & 2. プロシージャ一覧
    const procedures = this.extractProcedures(raw, lang);

    // 3. グローバル変数・未解決依存
    const globalVars = this.extractGlobalVariables(raw, lang);
    const unresolvedDeps = this.extractUnresolvedDependencies(raw, lang, procedures);

    // 11. コメントと実装の矛盾検出 (24章 コメントとコードの矛盾検出)
    const contradictions = this.detectCommentCodeContradictions(raw, procedures);

    // 変更影響予測 (24章 変更影響とテストケース選定)
    const impactPredictions = procedures.map((proc) => ({
      targetProcedure: proc.procedureName,
      potentialBreakage: `このプロシージャのシグネチャまたは戻り値型を変更すると、呼出元 (${proc.calls.length > 0 ? proc.calls.join(', ') : '外部エントリ'}) に型不一致や実行時エラーが発生する可能性があります。`,
      affectedCallers: proc.calls,
      testCasesToRerun: [
        `正常系: ${proc.procedureName}の標準引数テスト`,
        `境界系: ${proc.procedureName}の空値/Null/ゼロ行テスト`,
        `異常系: エラーハンドラ (${proc.errorHandling.join(', ') || 'デフォルトエラー'}) 発動テスト`,
      ],
    }));

    // 24章: 読解確認質問13項目の自動生成
    const comprehensionQA = this.generateComprehensionQA(procedures, contradictions);

    // 12. 自然な日本語説明の生成
    const naturalSummary = this.generateNaturalSummary(procedures, contradictions, lang);

    const ir: CodeUnderstandingIR = {
      id,
      sourceLanguage: lang,
      rawSnippet: raw,
      procedures,
      globalVariables: globalVars,
      unresolvedDependencies: unresolvedDeps,
      commentCodeContradictions: contradictions,
      impactPredictions,
      comprehensionQA,
      naturalJapaneseSummary: naturalSummary,
      createdAt: Date.now(),
    };

    systemLogger.info(
      'CODE_UNDERSTANDING',
      `コード理解IR生成完了: ${procedures.length}個のプロシージャ解析, 矛盾検出: ${contradictions.length}件`
    );

    return ir;
  }

  public parseCodeToIR(snippet: string, languageHint = 'vba', _name?: string): CodeUnderstandingIR {
    return this.analyzeCode(snippet, languageHint);
  }

  private extractProcedures(raw: string, lang: string): CodeProcedureIR[] {
    const procedures: CodeProcedureIR[] = [];

    if (lang.includes('vba') || lang.includes('vb')) {
      // VBAプロシージャ正規表現 (Sub / Function)
      const procRegex = /(?:(Public|Private|Friend)\s+)?(Sub|Function)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s+As\s+([a-zA-Z0-9_]+))?([\s\S]*?)End\s+(?:Sub|Function)/gi;
      let match: RegExpExecArray | null;

      while ((match = procRegex.exec(raw)) !== null) {
        const visibility = (match[1] || 'Public').toUpperCase() as any;
        const procType = match[2];
        const name = match[3];
        const rawArgs = match[4] || '';
        const returnType = match[5] || (procType.toLowerCase() === 'function' ? 'Variant' : null);
        const body = match[6] || '';

        // 引数解析
        const inputs = rawArgs.split(',').map((a) => a.trim()).filter(Boolean).map((a) => {
          const isOpt = /Optional/i.test(a);
          const parts = a.replace(/Optional\s+/i, '').split(/\s+As\s+/i);
          return {
            name: parts[0] ? parts[0].trim() : a,
            type: parts[1] ? parts[1].trim() : 'Variant',
            optional: isOpt,
          };
        });

        // 読み取り/書き込み (reads/writes)
        const reads: string[] = [];
        const writes: string[] = [];
        if (/ws\.|Sheets\(|Cells\(|Range\(/.test(body)) {
          reads.push('ワークシートセルデータ (Cells/Range)');
        }
        if (/Value\s*=|Cells\(.*?\)\.Value\s*=|Range\(.*?\)\.Value\s*=/i.test(body)) {
          writes.push('ワークシートセル書き込み (Cells.Value / Range.Value)');
        }
        if (/ThisWorkbook|ActiveWorkbook/.test(body)) {
          reads.push('ブック情報 (ThisWorkbook)');
        }

        // 呼出関係
        const calls: string[] = [];
        const callMatches = body.match(/(?:Call\s+)?([a-zA-Z0-9_]+)\s*\(/gi);
        if (callMatches) {
          for (const cm of callMatches) {
            const called = cm.replace(/Call\s+/i, '').replace(/\(/, '').trim();
            if (!['MsgBox', 'UCase', 'Trim', 'Len', 'If', 'Mid', 'Left', 'Right'].includes(called)) {
              calls.push(called);
            }
          }
        }

        // 条件、ループ、終了条件
        const conditions: string[] = [];
        if (/If\s+(.*?)\s+Then/i.test(body)) {
          const ifMatches = body.match(/If\s+(.*?)\s+Then/gi);
          if (ifMatches) {
            conditions.push(...ifMatches.slice(0, 3).map((m) => m.replace(/Then/i, '').trim()));
          }
        }

        const loops: string[] = [];
        if (/For\s+(.*?)\s+To\s+(.*?)(?:\n|$)/i.test(body)) {
          loops.push('For...To ループ');
        }
        if (/Do\s+While|Do\s+Until/i.test(body)) {
          loops.push('Do While/Until ループ');
        }

        const termConditions: string[] = [];
        if (/Exit\s+Sub|Exit\s+Function|Exit\s+For/i.test(body)) {
          termConditions.push('明示的脱出 (Exit Sub/Function/For)');
        }
        if (/End\s+(?:Sub|Function)/i.test(body)) {
          termConditions.push('プロシージャ終端到達');
        }

        // エラーハンドリング
        const errorHandling: string[] = [];
        if (/On\s+Error\s+GoTo\s+([a-zA-Z0-9_]+)/i.test(body)) {
          errorHandling.push('On Error GoTo ハンドラジャンプ');
        } else if (/On\s+Error\s+Resume\s+Next/i.test(body)) {
          errorHandling.push('On Error Resume Next (エラー無視)');
        } else {
          errorHandling.push('エラー処理未実装 (未保護)');
        }

        // 外部依存
        const extDeps: string[] = [];
        if (/CreateObject\(["']Scripting\.FileSystemObject["']\)/i.test(body)) {
          extDeps.push('Scripting.FileSystemObject');
        }
        if (/CreateObject\(["']ADODB\./i.test(body)) {
          extDeps.push('ADODB.Connection / Recordset');
        }
        if (/CreateObject\(["']WScript\.Shell["']\)/i.test(body)) {
          extDeps.push('WScript.Shell');
        }

        // 副作用
        const sideEffects: string[] = [];
        if (writes.length > 0) sideEffects.push('セルの上書き・変更');
        if (/MsgBox/i.test(body)) sideEffects.push('UIダイアログ表示 (MsgBox)');
        if (/SaveAs|Save/i.test(body)) sideEffects.push('ファイルの保存');

        procedures.push({
          procedureName: name,
          visibility,
          purpose: `${name}プロシージャの自動処理`,
          inputs,
          returns: returnType,
          reads,
          writes,
          calls: Array.from(new Set(calls)),
          conditions,
          loops,
          terminationConditions: termConditions,
          errorHandling,
          side_effects: sideEffects,
          external_dependencies: extDeps,
          unknown_dependencies: [],
        });
      }
    }

    // デフォルトFallback（汎用スクリプトまたは見つからなかった場合）
    if (procedures.length === 0) {
      procedures.push({
        procedureName: 'mainSnippet',
        visibility: 'PUBLIC',
        purpose: 'メインコードブロックの実行',
        inputs: [],
        returns: null,
        reads: ['入力コンテキスト'],
        writes: ['出力データ'],
        calls: [],
        conditions: raw.includes('if') ? ['条件分岐'] : [],
        loops: raw.includes('for') || raw.includes('while') ? ['反復ループ'] : [],
        terminationConditions: ['正常終了'],
        errorHandling: raw.includes('try') || raw.includes('catch') || raw.includes('On Error') ? ['保護例外ブロック'] : ['エラー処理未定義'],
        side_effects: ['状態更新'],
        external_dependencies: [],
        unknown_dependencies: [],
      });
    }

    return procedures;
  }

  private extractGlobalVariables(raw: string, lang: string): string[] {
    const globals: string[] = [];
    const dimMatches = raw.match(/^(?:Public|Global|Dim)\s+([a-zA-Z0-9_]+)\s+As\s+([a-zA-Z0-9_]+)/gim);
    if (dimMatches) {
      globals.push(...dimMatches.map((m) => m.trim()));
    }
    return globals;
  }

  private extractUnresolvedDependencies(raw: string, lang: string, procs: CodeProcedureIR[]): string[] {
    const declaredNames = new Set(procs.map((p) => p.procedureName.toLowerCase()));
    const unresolved: string[] = [];
    for (const proc of procs) {
      for (const call of proc.calls) {
        if (!declaredNames.has(call.toLowerCase())) {
          unresolved.push(`未宣言外部プロシージャ呼び出し: ${call}`);
        }
      }
    }
    return Array.from(new Set(unresolved));
  }

  /**
   * 24章 コメントとコードの矛盾検出
   * 例: コメントに「対象外行は更新しない」とあるのに判定前に無条件書き込みしている等
   */
  private detectCommentCodeContradictions(
    raw: string,
    procs: CodeProcedureIR[]
  ): CodeUnderstandingIR['commentCodeContradictions'] {
    const contradictions: CodeUnderstandingIR['commentCodeContradictions'] = [];

    // パターン1: 「更新しない」「スキップ」と書かれているのに、条件前にセルの代入がある場合
    if (
      /(?:更新しない|スキップ|何もしない|除外)/i.test(raw) &&
      procs.some((p) => p.writes.length > 0 && p.conditions.length === 0)
    ) {
      contradictions.push({
        location: 'プロシージャ内処理',
        commentClaim: 'コメントには「除外・スキップする」と記述されています。',
        actualCodeBehavior: 'コード内に対象外行を判定して脱出する条件分岐が存在せず、無条件に処理が継続されています。',
        severity: 'conflict',
      });
    }

    // パターン2: 「エラー処理」と書いてあるのに On Error Resume Next で黙殺している場合
    if (
      /(?:エラー処理|安全に終了|エラー時は中断)/i.test(raw) &&
      /On\s+Error\s+Resume\s+Next/i.test(raw)
    ) {
      contradictions.push({
        location: 'エラーハンドリング構文',
        commentClaim: 'コメントには「エラー時は安全に処理」と記述されています。',
        actualCodeBehavior: '実際には On Error Resume Next が指定されており、実行時エラーが通知されずに素通り・黙殺されます。',
        severity: 'conflict',
      });
    }

    // パターン3: 「高速化」「画面更新停止」と書いてあるのに ScreenUpdating = False が無い
    if (
      /(?:高速化|画面描画を停止|チラつき防止)/i.test(raw) &&
      !/Application\.ScreenUpdating\s*=\s*False/i.test(raw)
    ) {
      contradictions.push({
        location: 'パフォーマンス設定',
        commentClaim: 'コメントには「画面更新を停止して高速化」と記述されています。',
        actualCodeBehavior: 'Application.ScreenUpdating = False の設定命令がコード内に見当たりません。',
        severity: 'warn',
      });
    }

    return contradictions;
  }

  /**
   * 24章: 読解確認質問13項目の自動生成
   */
  private generateComprehensionQA(
    procs: CodeProcedureIR[],
    contradictions: CodeUnderstandingIR['commentCodeContradictions']
  ): CodeUnderstandingIR['comprehensionQA'] {
    const p1 = procs[0] || {
      procedureName: 'main',
      inputs: [],
      returns: null,
      reads: [],
      writes: [],
      calls: [],
      conditions: [],
      errorHandling: [],
      side_effects: [],
    };

    return [
      {
        question: '1. プロシージャ一覧: このモジュールにはどのようなプロシージャが含まれていますか？',
        answer: procs.map((p) => `${p.visibility} ${p.procedureName}`).join(', '),
        criteria: '宣言されている全プロシージャ名が漏れなく網羅されていること。',
      },
      {
        question: '2. 目的: 主要プロシージャの主目的は何ですか？',
        answer: `${p1.procedureName}において、${p1.reads.join(', ') || '入力'}を読み込み、${p1.writes.join(', ') || '処理結果'}へ反映すること。`,
        criteria: 'プロシージャの責務と終了時の期待状態を平易に説明できていること。',
      },
      {
        question: '3. 引数と戻り値: どのような入力を受け取り、何を返しますか？',
        answer: p1.inputs.length > 0
          ? `引数: ${p1.inputs.map((i) => `${i.name} As ${i.type}`).join(', ')} / 戻り値: ${p1.returns || 'なし(Sub)'}`
          : `引数なし / 戻り値: ${p1.returns || 'なし(Sub)'}`,
        criteria: 'シグネチャの型情報と引数役割を正確に認識していること。',
      },
      {
        question: '4. 呼出関係: プロシージャ間の呼出グラフはどうなっていますか？',
        answer: p1.calls.length > 0 ? `呼出先: ${p1.calls.join(', ')}` : '他の下位プロシージャ呼び出しはありません。',
        criteria: '直接呼び出す外部または内部プロシージャを過不足なく同定すること。',
      },
      {
        question: '5. 読み取るデータ: 外部やシートのどこから値を参照していますか？',
        answer: p1.reads.join(', ') || '明示的な外部データ読み取りはありません。',
        criteria: '参照されるワークシート、セル、グローバル変数が示されていること。',
      },
      {
        question: '6. 書き込むデータ: どのようなデータ更新・出力を行っていますか？',
        answer: p1.writes.join(', ') || 'データの書き込みはありません。',
        criteria: '変更されるセル範囲や出力先が具体的に特定されていること。',
      },
      {
        question: '7. 分岐条件: どのような条件で処理が分岐しますか？',
        answer: p1.conditions.join(', ') || '明示的な分岐条件はありません。',
        criteria: 'IfやSelect Caseの判定式と分岐理由が整理されていること。',
      },
      {
        question: '8. 終了条件: ループやプロシージャはどのように終了しますか？',
        answer: p1.terminationConditions.join(', ') || '通常終了',
        criteria: '無限ループの懸念がなく、終了・脱出条件が明確であること。',
      },
      {
        question: '9. エラーハンドリング: エラー発生時はどのように保護されていますか？',
        answer: p1.errorHandling.join(', '),
        criteria: 'On Errorによるトラップ方針や例外キャッチの有無を明示すること。',
      },
      {
        question: '10. 外部依存: どのようなCOMオブジェクトや外部ライブラリに依存していますか？',
        answer: p1.external_dependencies.join(', ') || '特別な外部参照ライブラリはありません。',
        criteria: 'FSOや正規表現、データベース等の外部依存を検出できていること。',
      },
      {
        question: '11. 不明な依存: 宣言が不明な関数や暗黙の参照はありますか？',
        answer: p1.unknown_dependencies.length > 0 ? p1.unknown_dependencies.join(', ') : '不明な依存関係はありません。',
        criteria: '未定義シンボルや暗黙の型バインディングの検出。',
      },
      {
        question: '12. 副作用: 処理実行に伴う外部への副作用は何ですか？',
        answer: p1.side_effects.join(', ') || '特筆すべき副作用はありません。',
        criteria: 'セル値変更やメッセージ表示などの副作用が列挙されていること。',
      },
      {
        question: '13. 変更影響とコメント整合性: 実装とコメントの矛盾や変更時の注意点は？',
        answer: contradictions.length > 0
          ? `矛盾が検出されました: ${contradictions.map((c) => c.commentClaim + ' vs ' + c.actualCodeBehavior).join('; ')}`
          : 'コメントとコードの矛盾は検出されませんでした。変更時は呼出元と引数整合性の回帰試験が必要です。',
        criteria: 'コメントの嘘・実装のズレを見抜き、安全な改修計画が立てられること。',
      },
    ];
  }

  private generateNaturalSummary(
    procs: CodeProcedureIR[],
    contradictions: CodeUnderstandingIR['commentCodeContradictions'],
    lang: string
  ): string {
    const lines: string[] = [
      `本コードは【${lang.toUpperCase()}】で記述されたプログラムです。`,
      `モジュール内には ${procs.length} 件のプロシージャ (${procs.map((p) => p.procedureName).join(', ')}) が定義されています。`,
    ];

    if (procs[0]?.writes.length) {
      lines.push(`主要な処理として、${procs[0].writes.join(' および ')} が行われます。`);
    }

    if (contradictions.length > 0) {
      lines.push(`⚠️ 注意: コメントと実装の間に ${contradictions.length} 件の矛盾が検出されました。`);
    } else {
      lines.push(`✓ コメントと実装の整合性は良好です。`);
    }

    return lines.join('\n');
  }

  /**
   * 22〜25章: 複数モジュールVBAプロジェクト横断解析 (Cross-Module Call Graph & Impact Analysis)
   *
   * 1. 各モジュール (標準モジュール, クラス, シート, フォーム) を個別にCode IR解析
   * 2. プロシージャシンボル表 (Symbol Table) の構築: Module -> Procedures, Public/Private スコープ
   * 3. 呼び出し関係 (Call Graph) の解決:
   *    - 明示的モジュール修飾呼び出し: Module2.Calc()
   *    - 暗黙的Publicグローバル呼び出し: Calc() -> どのモジュールに定義されているか探索
   * 4. 循環呼び出し (Circular Calls / 循環参照) の検出 (DFS サイクル検知)
   * 5. 変更波及範囲解析 (Cross-Module Impact Analysis):
   *    - プロシージャを変更した場合に影響を受ける直接/間接の呼出元一覧とリスク評価
   * 6. 未解決外部呼び出しの検出 (Unresolved External Dependencies)
   */
  public analyzeMultiModuleProject(modules: VbaModuleFile[]): MultiModuleAnalysisResult {
    const projectId = `vba_proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. 各モジュールを CodeUnderstandingIR に変換
    const moduleIRs = modules.map((mod) => ({
      name: mod.name,
      type: mod.type,
      ir: this.analyzeCode(mod.code, 'vba'),
    }));

    // 2. シンボルテーブル構築
    const symbolMap = new Map<string, Array<{ moduleName: string; proc: CodeProcedureIR }>>();
    let totalProcedures = 0;

    for (const m of moduleIRs) {
      for (const p of m.ir.procedures) {
        totalProcedures++;
        const pNameLower = p.procedureName.toLowerCase();
        if (!symbolMap.has(pNameLower)) {
          symbolMap.set(pNameLower, []);
        }
        symbolMap.get(pNameLower)!.push({ moduleName: m.name, proc: p });
      }
    }

    // 3. モジュール間コールグラフの解決
    const callGraph: CrossModuleCallEdge[] = [];
    const unresolvedCalls: Array<{ callerModule: string; callerProcedure: string; unresolvedName: string }> = [];

    for (const m of moduleIRs) {
      for (const p of m.ir.procedures) {
        for (const rawCall of p.calls) {
          // 明示的修飾呼び出し判定: ModuleName.ProcName
          if (rawCall.includes('.')) {
            const parts = rawCall.split('.');
            const targetModName = parts[0];
            const targetProcName = parts.slice(1).join('.');
            const targetMod = moduleIRs.find((mod) => mod.name.toLowerCase() === targetModName.toLowerCase());

            if (targetMod) {
              callGraph.push({
                callerModule: m.name,
                callerProcedure: p.procedureName,
                calleeModule: targetMod.name,
                calleeProcedure: targetProcName,
                callType: 'explicit_module',
              });
            } else {
              // 外部COM/Excel組み込みオブジェクト (Worksheets, Range, Application, etc) は除外
              if (!['worksheets', 'sheets', 'range', 'cells', 'application', 'thisworkbook', 'msgbox', 'activeworkbook'].includes(targetModName.toLowerCase())) {
                unresolvedCalls.push({
                  callerModule: m.name,
                  callerProcedure: p.procedureName,
                  unresolvedName: rawCall,
                });
              }
            }
          } else {
            // 暗黙的グローバル呼び出し
            const targets = symbolMap.get(rawCall.toLowerCase());
            if (targets && targets.length > 0) {
              // 同一モジュール優先、なければPublicな他モジュール
              const sameMod = targets.find((t) => t.moduleName.toLowerCase() === m.name.toLowerCase());
              if (sameMod) {
                callGraph.push({
                  callerModule: m.name,
                  callerProcedure: p.procedureName,
                  calleeModule: m.name,
                  calleeProcedure: sameMod.proc.procedureName,
                  callType: 'implicit_global',
                });
              } else {
                const publicTarget = targets.find((t) => t.proc.visibility !== 'PRIVATE');
                if (publicTarget) {
                  callGraph.push({
                    callerModule: m.name,
                    callerProcedure: p.procedureName,
                    calleeModule: publicTarget.moduleName,
                    calleeProcedure: publicTarget.proc.procedureName,
                    callType: 'implicit_global',
                  });
                }
              }
            } else {
              // VBA組み込み関数でなければ未解決
              const vbaBuiltins = new Set(['msgbox', 'inputbox', 'cstr', 'clng', 'cint', 'cdbl', 'cdate', 'trim', 'len', 'mid', 'left', 'right', 'replace', 'split', 'join', 'ubound', 'lbound', 'now', 'date', 'time', 'isnumeric', 'isempty', 'isnull', 'isdate', 'format', 'dir', 'instr']);
              if (!vbaBuiltins.has(rawCall.toLowerCase())) {
                unresolvedCalls.push({
                  callerModule: m.name,
                  callerProcedure: p.procedureName,
                  unresolvedName: rawCall,
                });
              }
            }
          }
        }
      }
    }

    // 4. 循環呼び出し (Circular Calls) の検出 (DFS)
    const circularCalls: Array<{ cycle: string[]; severity: 'warn' | 'error'; description: string }> = [];
    const adj = new Map<string, string[]>();

    for (const edge of callGraph) {
      const fromNode = `${edge.callerModule}.${edge.callerProcedure}`;
      const toNode = `${edge.calleeModule}.${edge.calleeProcedure}`;
      if (!adj.has(fromNode)) adj.set(fromNode, []);
      adj.get(fromNode)!.push(toNode);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const currentPath: string[] = [];

    const detectCycles = (node: string) => {
      visited.add(node);
      recStack.add(node);
      currentPath.push(node);

      const neighbors = adj.get(node) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          detectCycles(next);
        } else if (recStack.has(next)) {
          const cycleStart = currentPath.indexOf(next);
          const cycleNodes = [...currentPath.slice(cycleStart), next];
          circularCalls.push({
            cycle: cycleNodes,
            severity: 'error',
            description: `循環呼び出しを検出: ${cycleNodes.join(' ➔ ')} (スタックオーバーフローまたは無限ループのリスク)`,
          });
        }
      }

      currentPath.pop();
      recStack.delete(node);
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        detectCycles(node);
      }
    }

    // 5. 変更影響予測 (Cross-Module Impact Analysis)
    const reverseCallMap = new Map<string, Array<{ module: string; procedure: string }>>();
    for (const edge of callGraph) {
      const calleeKey = `${edge.calleeModule}.${edge.calleeProcedure}`;
      if (!reverseCallMap.has(calleeKey)) reverseCallMap.set(calleeKey, []);
      reverseCallMap.get(calleeKey)!.push({
        module: edge.callerModule,
        procedure: edge.callerProcedure,
      });
    }

    const crossModuleImpacts: CrossModuleImpactAnalysis[] = [];

    for (const m of moduleIRs) {
      for (const p of m.ir.procedures) {
        const procKey = `${m.name}.${p.procedureName}`;
        const direct = reverseCallMap.get(procKey) || [];

        // 間接影響 (2ホップ以上)
        const indirectSet = new Set<string>();
        const queue = [...direct];
        const visitedCallers = new Set<string>(direct.map((d) => `${d.module}.${d.procedure}`));

        while (queue.length > 0) {
          const cur = queue.shift()!;
          const callersOfCur = reverseCallMap.get(`${cur.module}.${cur.procedure}`) || [];
          for (const c of callersOfCur) {
            const cKey = `${c.module}.${c.procedure}`;
            if (!visitedCallers.has(cKey) && cKey !== procKey) {
              visitedCallers.add(cKey);
              indirectSet.add(cKey);
              queue.push(c);
            }
          }
        }

        const indirect = Array.from(indirectSet).map((k) => {
          const [mod, proc] = k.split('.');
          return { module: mod, procedure: proc };
        });

        // リスク評価
        const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
          direct.length >= 3 || indirect.length >= 2 || circularCalls.some((c) => c.cycle.includes(procKey))
            ? 'HIGH'
            : direct.length > 0
            ? 'MEDIUM'
            : 'LOW';

        crossModuleImpacts.push({
          targetModule: m.name,
          targetProcedure: p.procedureName,
          directlyAffectedCallers: direct,
          indirectlyAffectedCallers: indirect,
          riskLevel,
          recommendedTestCases: [
            `${m.name}.${p.procedureName} 単体テスト (正常系/異常系)`,
            ...direct.map((d) => `${d.module}.${d.procedure} の統合回帰テスト`),
          ],
        });
      }
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧩 [22-25章 複数モジュールVBA解析] モジュール: ${modules.length}個, プロシージャ: ${totalProcedures}個, コールエッジ: ${callGraph.length}本, 循環呼出: ${circularCalls.length}件`
    );

    return {
      projectId,
      modulesCount: modules.length,
      totalProceduresCount: totalProcedures,
      modules: moduleIRs,
      callGraph,
      circularCalls,
      crossModuleImpacts,
      unresolvedExternalCalls: unresolvedCalls,
      analyzedAt: Date.now(),
    };
  }
}

export const codeUnderstandingService = new CodeUnderstandingService();

import React, { useState } from 'react';
import {
  Code2,
  FileSpreadsheet,
  AlertTriangle,
  Play,
  CheckCircle2,
  Copy,
  Check,
  HelpCircle,
  Layers,
  Table,
  Workflow,
  Sparkles,
  Search,
} from 'lucide-react';
import { CodeUnderstandingIR, VbaDesignSpecification } from '../../types';
import { codeUnderstandingService } from '../../services/codeUnderstandingService';
import { vbaDesignAssistantService } from '../../services/vbaDesignAssistantService';

export const CodeUnderstandingVbaTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'code_ir' | 'vba_design'>('code_ir');

  // Code IR State
  const [codeInput, setCodeInput] = useState<string>(`' ユーザーリストをループ処理して有効な顧客コードのみ抽出する
' ※注意: 空欄の場合はデフォルトで 99999 を設定すること
Sub ProcessCustomerData()
    Dim ws As Worksheet
    Dim i As Long, lastRow As Long
    Dim custCode As String
    Set ws = ThisWorkbook.Sheets("CustomerData")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

    For i = 2 To lastRow
        custCode = Trim(ws.Cells(i, 1).Value)
        If custCode = "" Then
            ' コメントと矛盾: 実際は空文字のままスキップしている
            Exit For
        End If
        Call SaveTargetRow(custCode, i)
    Next i
End Sub

Sub SaveTargetRow(ByVal code As String, ByVal rowIdx As Long)
    Dim outWs As Worksheet
    Set outWs = ThisWorkbook.Sheets("Output")
    outWs.Cells(rowIdx, 1).Value = "'" & code
End Sub`);

  const [codeLanguage, setCodeLanguage] = useState<string>('vba');
  const [codeIRResult, setCodeIRResult] = useState<CodeUnderstandingIR | null>(null);

  // VBA Design Assistant State
  const [vbaRequirementInput, setVbaRequirementInput] = useState<string>(
    `売上明細シートから、金額が10万円以上かつステータスが「確定」の行だけを抽出し、
別シート「高額確定売上」へ転記したい。
ただし、顧客IDの先頭ゼロ（00123等）が数値変換で消えないようにし、
例外として備考欄に「キャンセル予定」と書いてある行は除外してほしい。`
  );
  const [vbaSpecResult, setVbaSpecResult] = useState<VbaDesignSpecification | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAnalyzeCode = () => {
    const ir = codeUnderstandingService.analyzeCode(codeInput, codeLanguage);
    setCodeIRResult(ir);
  };

  const handleGenerateVbaSpec = () => {
    const spec = vbaDesignAssistantService.generateDesignSpecification(vbaRequirementInput);
    setVbaSpecResult(spec);
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-200">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('code_ir')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSection === 'code_ir'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>22〜25章 コード理解AI (Code IR)</span>
          </button>
          <button
            onClick={() => setActiveSection('vba_design')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSection === 'vba_design'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>26章 抽象VBA設計支援AI (決定表・仕様書)</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: CODE IR ANALYZER */}
      {activeSection === 'code_ir' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/80 border border-sky-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 text-[10.5px]">
                設計思想 22〜25章
              </span>
              <h3 className="font-bold text-slate-100 text-xs">
                コード理解パイプライン (12ステップ中間JSON表現 & コメント矛盾検出)
              </h3>
            </div>
            <p className="text-[11.5px] text-slate-300 leading-relaxed">
              VBAやスクリプトから、構文木に依存しない構造化中間表現(CodeUnderstandingIR)を抽出し、呼出グラフ・大域変数・コメントと実装の矛盾を判定します。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">入力コードスニペット:</span>
              <div className="flex items-center gap-2">
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="vba">VBA (Excel Macro)</option>
                  <option value="javascript">JavaScript / TypeScript</option>
                  <option value="python">Python</option>
                </select>
                <button
                  onClick={handleAnalyzeCode}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded font-bold text-xs flex items-center gap-1 shadow transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>12段階コード解析を実行</span>
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-sky-500 leading-relaxed"
            />
          </div>

          {/* Code IR Results */}
          {codeIRResult && (
            <div className="p-4 bg-slate-950 border border-sky-500/40 rounded-xl space-y-3.5 text-xs shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sky-300 text-xs">{codeIRResult.id}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-sky-200">
                    言語: {codeIRResult.sourceLanguage}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(JSON.stringify(codeIRResult, null, 2), 'code_ir_json')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 border border-slate-700"
                >
                  {copiedId === 'code_ir_json' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>中間IR(JSON)をコピー</span>
                </button>
              </div>

              {/* Natural Japanese Summary */}
              <div className="p-3 bg-black/40 rounded-lg border border-slate-800 space-y-1">
                <div className="text-[10.5px] font-bold text-sky-400">📝 12. 自然な日本語説明:</div>
                <p className="text-slate-300 text-xs leading-relaxed">{codeIRResult.naturalJapaneseSummary}</p>
              </div>

              {/* 24章 コメントと実装の矛盾検出 */}
              {codeIRResult.commentCodeContradictions.length > 0 ? (
                <div className="p-3 bg-amber-950/40 border border-amber-500/60 rounded-lg space-y-2 text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>24章 コメントと実装の矛盾検出 ({codeIRResult.commentCodeContradictions.length}件)</span>
                  </div>
                  {codeIRResult.commentCodeContradictions.map((c, cIdx) => (
                    <div key={cIdx} className="p-2 bg-black/50 rounded border border-amber-800/40 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>対象箇所: {c.location}</span>
                        <span className="text-amber-400 font-bold uppercase text-[9.5px]">[{c.severity}]</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono">コメントの主張: </span>
                        <span className="text-rose-300">{c.commentClaim}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-mono">実際の実装動作: </span>
                        <span className="text-emerald-300">{c.actualCodeBehavior}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/50 rounded-lg text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>コメントとコード実装の矛盾は検出されませんでした (整合良好)</span>
                </div>
              )}

              {/* Procedures Extracted */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>抽出されたプロシージャ構成 ({codeIRResult.procedures.length}件)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {codeIRResult.procedures.map((proc, pIdx) => (
                    <div key={pIdx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-mono font-bold">
                        <span className="text-sky-300">{proc.procedureName}</span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-black/40 text-slate-400 border border-slate-800">
                          {proc.visibility}
                        </span>
                      </div>
                      <div className="text-slate-300">{proc.purpose}</div>
                      <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
                        <div>引数: {proc.inputs.map((inp) => `${inp.name}:${inp.type}`).join(', ') || 'なし'}</div>
                        <div>呼出: {proc.calls.join(', ') || 'なし'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 24章 読解確認質問 13項目 */}
              {codeIRResult.comprehensionQA.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>24章 読解確認質問と自己判定</span>
                  </div>
                  <div className="space-y-1">
                    {codeIRResult.comprehensionQA.map((qa, qIdx) => (
                      <div key={qIdx} className="p-2 bg-black/40 rounded border border-slate-900 text-[10.5px] space-y-0.5">
                        <div className="text-sky-300 font-semibold">Q{qIdx + 1}: {qa.question}</div>
                        <div className="text-emerald-300 font-mono">A: {qa.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: VBA DESIGN ASSISTANT */}
      {activeSection === 'vba_design' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/80 border border-indigo-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 text-[10.5px]">
                設計思想 26章
              </span>
              <h3 className="font-bold text-slate-100 text-xs">
                抽象VBA設計支援AI (決定表・構成案・境界テスト・Copilot指示書)
              </h3>
            </div>
            <p className="text-[11.5px] text-slate-300 leading-relaxed">
              自然言語のユーザー要望から、いきなりコードを書かずに「条件優先順位の決定表」「抽象プロシージャ構成案」「境界値テストケース」「外部Copilot指示書」を先行設計します。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">ユーザー業務要件 (自然言語):</span>
              <button
                onClick={handleGenerateVbaSpec}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded font-bold text-xs flex items-center gap-1 shadow transition-all"
              >
                <Sparkles className="w-3 h-3 fill-current" />
                <span>26章 抽象設計仕様書を自動合成</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={vbaRequirementInput}
              onChange={(e) => setVbaRequirementInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* VBA Spec Results */}
          {vbaSpecResult && (
            <div className="p-4 bg-slate-950 border border-indigo-500/40 rounded-xl space-y-4 text-xs shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="space-y-0.5">
                  <span className="font-bold text-indigo-300 text-sm">{vbaSpecResult.title}</span>
                  <div className="text-[10px] text-slate-400 font-mono">ID: {vbaSpecResult.specId}</div>
                </div>
                <button
                  onClick={() =>
                    handleCopy(vbaSpecResult.externalCopilotPrompt, 'copilot_prompt')
                  }
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  {copiedId === 'copilot_prompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>外部Copilot指示書をコピー</span>
                </button>
              </div>

              {/* Decision Table (決定表) */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-indigo-400" />
                  <span>26章 条件・例外優先順位決定表 (Decision Table)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border border-slate-800 rounded-lg overflow-hidden font-mono">
                    <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                      <tr>
                        <th className="p-2 text-left">ルールID</th>
                        <th className="p-2 text-left">条件 (Conditions)</th>
                        <th className="p-2 text-left">アクション (Actions)</th>
                        <th className="p-2 text-left">優先度</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-black/40">
                      {vbaSpecResult.decisionTable.rules.map((rule) => (
                        <tr key={rule.ruleId} className="hover:bg-slate-900/50">
                          <td className="p-2 font-bold text-indigo-300">{rule.ruleId}</td>
                          <td className="p-2 text-slate-300">
                            {Object.entries(rule.conditionValues)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(' && ')}
                          </td>
                          <td className="p-2 text-emerald-400 font-bold">
                            {Object.entries(rule.actionValues)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')}
                          </td>
                          <td className="p-2 text-amber-400">{rule.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Abstract Procedure Plans */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5 text-sky-400" />
                  <span>抽象プロシージャ構成案</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vbaSpecResult.procedurePlans.map((proc, prIdx) => (
                    <div key={prIdx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1 text-[11px]">
                      <div className="font-mono font-bold text-indigo-300">{proc.name}</div>
                      <div className="text-slate-300">{proc.role}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        入力: {proc.abstractInputs.join(', ')} ➔ 出力: {proc.abstractOutputs.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TestCase Plans */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>テストケース案 (通常系・境界値・例外系)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {vbaSpecResult.testCasePlans.map((tc, tcIdx) => (
                    <div key={tcIdx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1 text-[11px]">
                      <div className="flex items-center justify-between font-mono font-bold">
                        <span className="text-slate-200">{tc.scenario}</span>
                        <span className="text-[9.5px] px-1 py-0.2 rounded bg-black/40 text-amber-300 border border-slate-800">
                          {tc.category}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[10.5px]">入力: {tc.inputDescription}</div>
                      <div className="text-emerald-300 font-semibold text-[10.5px]">期待: {tc.expectedBehavior}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Characteristics */}
              <div className="p-3 bg-black/40 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                <div className="font-bold text-amber-300 text-[10.5px]">📌 データ特性保持要件 (先頭ゼロ・型崩れ防止):</div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {vbaSpecResult.dataCharacteristicsPreserved.map((dc, dcIdx) => (
                    <li key={dcIdx}>{dc}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

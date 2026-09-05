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
  Network,
  GitBranch,
  Boxes,
  FileCode2,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CodeUnderstandingIR,
  VbaDesignSpecification,
  VbaModuleFile,
  MultiModuleAnalysisResult,
  CrossModuleImpactAnalysis,
} from '../../types';
import { codeUnderstandingService } from '../../services/codeUnderstandingService';
import { vbaDesignAssistantService } from '../../services/vbaDesignAssistantService';

const DEFAULT_MODULES: VbaModuleFile[] = [
  {
    id: 'mod_1',
    name: 'M_SalesOrder',
    type: 'standard',
    code: `' 受注処理エントリポイント
Public Sub ProcessOrder(ByVal orderId As String)
    Dim isValid As Boolean
    isValid = M_Validator.ValidateOrder(orderId)
    If isValid Then
        Call M_TaxCalculator.CalculateTax(orderId)
        Call M_Inventory.DeductStock(orderId)
    End If
End Sub`,
  },
  {
    id: 'mod_2',
    name: 'M_TaxCalculator',
    type: 'standard',
    code: `' 税計算モジュール
Public Sub CalculateTax(ByVal orderId As String)
    Dim rate As Double
    rate = 0.1
    Call M_AuditLogger.LogEvent("TaxCalculated: " & orderId)
End Sub`,
  },
  {
    id: 'mod_3',
    name: 'M_Inventory',
    type: 'standard',
    code: `' 在庫引当モジュール
Public Sub DeductStock(ByVal orderId As String)
    Call M_AuditLogger.LogEvent("StockDeducted: " & orderId)
End Sub`,
  },
  {
    id: 'mod_4',
    name: 'M_Validator',
    type: 'standard',
    code: `' バリデーションモジュール
Public Function ValidateOrder(ByVal orderId As String) As Boolean
    ValidateOrder = (Len(Trim(orderId)) > 0)
End Function`,
  },
  {
    id: 'mod_5',
    name: 'M_AuditLogger',
    type: 'standard',
    code: `' 監査ログモジュール
Public Sub LogEvent(ByVal msg As String)
    ' ログ記録処理
End Sub`,
  },
];

const CIRCULAR_SAMPLE_MODULES: VbaModuleFile[] = [
  {
    id: 'cmod_1',
    name: 'M_ReportGenerator',
    type: 'standard',
    code: `' レポート生成
Public Sub GenerateMonthlyReport()
    Call M_Billing.ConsolidateInvoices()
End Sub`,
  },
  {
    id: 'cmod_2',
    name: 'M_Billing',
    type: 'standard',
    code: `' 請求処理 (循環呼び出しの原因)
Public Sub ConsolidateInvoices()
    Call M_Notifier.NotifyBillingComplete()
End Sub`,
  },
  {
    id: 'cmod_3',
    name: 'M_Notifier',
    type: 'standard',
    code: `' 通知モジュール (循環呼び出し完成)
Public Sub NotifyBillingComplete()
    ' 警告: レポート生成を再帰的に呼び戻している
    Call M_ReportGenerator.GenerateMonthlyReport()
End Sub`,
  },
];

export const CodeUnderstandingVbaTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'code_ir' | 'multi_module' | 'vba_design'>('code_ir');

  // Multi-Module State (22-25章)
  const [modules, setModules] = useState<VbaModuleFile[]>(DEFAULT_MODULES);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('mod_1');
  const [multiModuleResult, setMultiModuleResult] = useState<MultiModuleAnalysisResult | null>(null);
  const [selectedImpactProc, setSelectedImpactProc] = useState<string | null>(null);

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

  const handleAnalyzeMultiModule = () => {
    const result = codeUnderstandingService.analyzeMultiModuleProject(modules);
    setMultiModuleResult(result);
    if (result.crossModuleImpacts.length > 0 && !selectedImpactProc) {
      setSelectedImpactProc(`${result.crossModuleImpacts[0].targetModule}.${result.crossModuleImpacts[0].targetProcedure}`);
    }
  };

  const handleAddModule = () => {
    const newId = `mod_${Date.now()}`;
    const newMod: VbaModuleFile = {
      id: newId,
      name: `M_Custom${modules.length + 1}`,
      type: 'standard',
      code: `' 新規VBAモジュール\nPublic Sub RunTask()\n    ' 処理を記述\nEnd Sub`,
    };
    setModules([...modules, newMod]);
    setSelectedModuleId(newId);
  };

  const handleRemoveModule = (id: string) => {
    if (modules.length <= 1) return;
    const remaining = modules.filter((m) => m.id !== id);
    setModules(remaining);
    if (selectedModuleId === id) {
      setSelectedModuleId(remaining[0].id);
    }
  };

  const handleUpdateModuleCode = (id: string, code: string) => {
    setModules(modules.map((m) => (m.id === id ? { ...m, code } : m)));
  };

  const handleUpdateModuleName = (id: string, name: string) => {
    setModules(modules.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  const handleUpdateModuleType = (id: string, type: VbaModuleFile['type']) => {
    setModules(modules.map((m) => (m.id === id ? { ...m, type } : m)));
  };

  const handleLoadCircularSample = () => {
    setModules(CIRCULAR_SAMPLE_MODULES);
    setSelectedModuleId('cmod_1');
    setMultiModuleResult(null);
  };

  const handleLoadStandardSample = () => {
    setModules(DEFAULT_MODULES);
    setSelectedModuleId('mod_1');
    setMultiModuleResult(null);
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-200">
      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSection('code_ir')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSection === 'code_ir'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>22〜25章 単一Code IR</span>
          </button>
          <button
            onClick={() => setActiveSection('multi_module')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSection === 'multi_module'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>22〜25章 複数モジュール & コールグラフ</span>
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
            <span>26章 抽象VBA設計支援AI (決定表)</span>
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

      {/* SECTION: MULTI-MODULE & CALL GRAPH (22-25章) */}
      {activeSection === 'multi_module' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-950/80 border border-teal-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30 text-[10.5px]">
                  設計思想 22〜25章
                </span>
                <h3 className="font-bold text-slate-100 text-xs">
                  複数モジュール横断解析・コールグラフ・循環呼出検知・波及分析
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadStandardSample}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-[11px] flex items-center gap-1 transition-all"
                >
                  <Boxes className="w-3 h-3 text-teal-400" />
                  <span>標準5モジュール読込</span>
                </button>
                <button
                  onClick={handleLoadCircularSample}
                  className="px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 rounded text-[11px] flex items-center gap-1 transition-all"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>循環呼出サンプル読込</span>
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-[11.5px] leading-relaxed">
              実務のVBA資産は標準モジュール・クラス・シート・UserFormに分割されています。本機能はプロジェクト全体からシンボル表を構築し、モジュール間の呼出関係、循環依存（スタック枯渇リスク）、および変更波及先（直接・間接）を自動特定します。
            </p>
          </div>

          {/* Module Management & Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Module selection pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {modules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModuleId(mod.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                      selectedModuleId === mod.id
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>{mod.name}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-teal-300 border border-teal-900">
                      {mod.type === 'standard' ? 'BAS' : mod.type === 'class' ? 'CLS' : mod.type === 'sheet' ? 'SHT' : 'FRM'}
                    </span>
                  </button>
                ))}
                <button
                  onClick={handleAddModule}
                  className="px-2 py-1.5 rounded-lg text-xs bg-slate-900 text-slate-400 hover:text-teal-300 hover:border-teal-500/50 border border-slate-800 transition-all flex items-center gap-1"
                  title="モジュールを追加"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>

              {/* Action execute button */}
              <button
                onClick={handleAnalyzeMultiModule}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-teal-900/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>複数モジュール横断解析を実行</span>
              </button>
            </div>

            {/* Active Module Editor */}
            {(() => {
              const currentMod = modules.find((m) => m.id === selectedModuleId) || modules[0];
              if (!currentMod) return null;
              return (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">モジュール名:</span>
                      <input
                        type="text"
                        value={currentMod.name}
                        onChange={(e) => handleUpdateModuleName(currentMod.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-200 text-xs w-44"
                      />
                      <span className="text-slate-400 ml-2">種別:</span>
                      <select
                        value={currentMod.type}
                        onChange={(e) => handleUpdateModuleType(currentMod.id, e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-200 text-xs"
                      >
                        <option value="standard">標準モジュール (.bas)</option>
                        <option value="class">クラスモジュール (.cls)</option>
                        <option value="sheet">シートモジュール (Sheet)</option>
                        <option value="userform">フォーム (UserForm)</option>
                      </select>
                    </div>

                    {modules.length > 1 && (
                      <button
                        onClick={() => handleRemoveModule(currentMod.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>モジュール削除</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={7}
                    value={currentMod.code}
                    onChange={(e) => handleUpdateModuleCode(currentMod.id, e.target.value)}
                    className="w-full bg-slate-900 font-mono text-xs text-slate-300 p-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              );
            })()}
          </div>

          {/* Analysis Results Display */}
          {multiModuleResult && (
            <div className="space-y-4 pt-2">
              {/* Metric Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-teal-400" />
                    <span>解析モジュール数</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-teal-300">{multiModuleResult.modulesCount}</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>総プロシージャ数</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-sky-300">{multiModuleResult.totalProceduresCount}</div>
                </div>

                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                    <span>コールグラフ結線数</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-indigo-300">{multiModuleResult.callGraph.length}</div>
                </div>

                <div
                  className={`p-3 rounded-xl space-y-1 border ${
                    multiModuleResult.circularCalls.length > 0
                      ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  }`}
                >
                  <div className="text-[11px] flex items-center gap-1.5">
                    {multiModuleResult.circularCalls.length > 0 ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>循環呼出検知 (24章)</span>
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {multiModuleResult.circularCalls.length > 0 ? `${multiModuleResult.circularCalls.length} 件 (要修正)` : '0 件 (安全)'}
                  </div>
                </div>
              </div>

              {/* Circular Dependencies Alert Box */}
              {multiModuleResult.circularCalls.length > 0 && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-700/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-rose-300 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>⚠️ 循環依存（リカーシブコール）の警告</span>
                  </div>
                  <p className="text-rose-200/90 text-[11.5px]">
                    以下の呼び出し経路で無限ループまたはスタックオーバーフロー（VBA実行時エラー28: スタック領域が不足しています）が発生する致命的な循環が検出されました:
                  </p>
                  <div className="space-y-1.5">
                    {multiModuleResult.circularCalls.map((c, cIdx) => (
                      <div key={cIdx} className="p-2 bg-black/60 rounded border border-rose-900/60 font-mono text-rose-300 text-[11px]">
                        {c.cycle.join(' ➔ ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Call Graph & Impact Analysis Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Cross-Module Call Graph */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-teal-400" />
                      <span>モジュール間コールグラフ (呼び出し一覧)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{multiModuleResult.callGraph.length} エッジ</span>
                  </div>

                  {multiModuleResult.callGraph.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">モジュール間のプロシージャ呼出は検出されませんでした</div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {multiModuleResult.callGraph.map((edge, eIdx) => (
                        <div
                          key={eIdx}
                          className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center justify-between text-[11px] font-mono hover:border-teal-700/50 transition-all"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{edge.callerModule}.</span>
                            <span className="text-sky-300 font-bold">{edge.callerProcedure}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{edge.calleeModule}.</span>
                            <span className="text-emerald-300 font-bold">{edge.calleeProcedure}</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-slate-400 border border-slate-800">
                            {edge.callType === 'explicit_module' ? '明示修飾' : '暗黙Global'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Cross-Module Impact Analysis */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Network className="w-4 h-4 text-indigo-400" />
                      <span>24章 変更影響分析 (プロシージャ改修時の波及)</span>
                    </div>
                  </div>

                  {/* Procedure selector for impact */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px] shrink-0">改修対象:</span>
                    <select
                      value={selectedImpactProc || ''}
                      onChange={(e) => setSelectedImpactProc(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200 text-xs font-mono w-full"
                    >
                      {multiModuleResult.crossModuleImpacts.map((imp, iIdx) => (
                        <option key={iIdx} value={`${imp.targetModule}.${imp.targetProcedure}`}>
                          {imp.targetModule}.{imp.targetProcedure} ({imp.directlyAffectedCallers.length} 直接呼出元 / リスク: {imp.riskLevel})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Impact detail card */}
                  {(() => {
                    const currentImpact =
                      multiModuleResult.crossModuleImpacts.find(
                        (i) => `${i.targetModule}.${i.targetProcedure}` === selectedImpactProc
                      ) || multiModuleResult.crossModuleImpacts[0];

                    if (!currentImpact) return null;

                    return (
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-300">
                            {currentImpact.targetModule}.{currentImpact.targetProcedure}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              currentImpact.riskLevel === 'HIGH'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : currentImpact.riskLevel === 'MEDIUM'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            リスク水準: {currentImpact.riskLevel}
                          </span>
                        </div>

                        {/* Directly affected callers */}
                        <div className="space-y-1">
                          <div className="text-slate-400 text-[10.5px]">直近の呼出元 (直接影響・シグネチャ変更で即座に壊れる箇所):</div>
                          {currentImpact.directlyAffectedCallers.length === 0 ? (
                            <div className="text-slate-500 font-mono text-[10.5px]">なし (最上位エントリポイント)</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                              {currentImpact.directlyAffectedCallers.map((c, cIdx) => (
                                <span key={cIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                                  {c.module}.{c.procedure}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Indirectly affected callers */}
                        {currentImpact.indirectlyAffectedCallers.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-slate-400 text-[10.5px]">波及呼出元 (2ホップ以上の間接影響):</div>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                              {currentImpact.indirectlyAffectedCallers.map((c, cIdx) => (
                                <span key={cIdx} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-indigo-300 border border-slate-700">
                                  {c.module}.{c.procedure}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommended test cases */}
                        <div className="space-y-1 pt-1 border-t border-slate-800">
                          <div className="text-amber-300 font-bold text-[10.5px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            <span>推奨回帰テスト計画 (24章):</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10.5px]">
                            {currentImpact.recommendedTestCases.map((tc, tcIdx) => (
                              <li key={tcIdx}>{tc}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Unresolved external calls */}
              {multiModuleResult.unresolvedExternalCalls.length > 0 && (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-slate-400 text-[11px] flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>未定義・外部DLL/COM参照 (Unresolved External References)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10.5px] font-mono">
                    {multiModuleResult.unresolvedExternalCalls.map((u, uIdx) => (
                      <span key={uIdx} className="px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-slate-800">
                        {u.callerModule}.{u.callerProcedure} ➔ 未解決: &quot;{u.unresolvedName}&quot;
                      </span>
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

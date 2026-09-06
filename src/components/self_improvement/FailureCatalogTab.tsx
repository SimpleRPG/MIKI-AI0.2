import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Bug,
  Code,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  FailureSignature,
  FailureCategory,
  FailureSeverity,
  FailureSignatureStatus,
  AntiPatternMatchResult,
} from '../../types';
import { failureCatalogService } from '../../services/failureCatalogService';

interface FailureCatalogTabProps {
  onNotify?: (message: string) => void;
}

export const FailureCatalogTab: React.FC<FailureCatalogTabProps> = ({ onNotify }) => {
  const [signatures, setSignatures] = useState<FailureSignature[]>(() =>
    failureCatalogService.getAllSignatures()
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // スキャナー用ステート
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerInput, setScannerInput] = useState<string>(
    `Sub BadMacro()\n    Range("A1").Value = 100\n    Cells(2, 1).Select\n    Selection.Copy\n    Application.ScreenUpdating = False\nEnd Sub`
  );
  const [scanResults, setScanResults] = useState<AntiPatternMatchResult[] | null>(null);

  // 新規登録モーダル用ステート
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<FailureCategory>('vba_syntax');
  const [newSeverity, setNewSeverity] = useState<FailureSeverity>('HIGH');
  const [newTriggerKeywords, setNewTriggerKeywords] = useState<string>('');
  const [newAntiPattern, setNewAntiPattern] = useState<string>('');
  const [newCorrected, setNewCorrected] = useState<string>('');
  const [newRootCause, setNewRootCause] = useState<string>('');
  const [newInstruction, setNewInstruction] = useState<string>('');

  // 選択されたシグネチャ（詳細展開用）
  const [expandedSigId, setExpandedSigId] = useState<string | null>(null);

  // 再読み込み
  const reloadData = () => {
    setSignatures(failureCatalogService.getAllSignatures());
  };

  // 統計集計
  const stats = useMemo(() => {
    return failureCatalogService.getCatalogStats();
  }, [signatures]);

  // フィルタリング
  const filteredSignatures = useMemo(() => {
    return signatures.filter((sig) => {
      if (selectedCategory !== 'all' && sig.category !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && sig.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'all' && sig.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hitTitle = sig.title.toLowerCase().includes(q);
        const hitId = sig.signatureId.toLowerCase().includes(q);
        const hitTrigger = sig.triggerPatterns.some((t) => t.toLowerCase().includes(q));
        const hitCause = sig.rootCause.toLowerCase().includes(q);
        if (!hitTitle && !hitId && !hitTrigger && !hitCause) return false;
      }
      return true;
    });
  }, [signatures, selectedCategory, selectedSeverity, selectedStatus, searchQuery]);

  // スキャナー実行
  const handleRunScan = () => {
    if (!scannerInput.trim()) return;
    const results = failureCatalogService.scanForAntiPatterns(scannerInput, { isCodeOrVba: true });
    setScanResults(results);
    reloadData();
    if (results.length > 0) {
      onNotify?.(`⚠️ ${results.length} 件のアンチパターン違反を検知しました！`);
    } else {
      onNotify?.('✅ アンチパターン違反は検出されませんでした（安全基準合格）');
    }
  };

  // ステータス変更
  const handleStatusChange = (id: string, newStatus: FailureSignatureStatus) => {
    failureCatalogService.updateStatus(id, newStatus);
    reloadData();
    onNotify?.(`シグネチャ [${id}] の状態を ${newStatus} に更新しました`);
  };

  // 削除
  const handleDelete = (id: string) => {
    if (confirm(`失敗シグネチャ [${id}] をカタログから削除しますか？`)) {
      failureCatalogService.deleteSignature(id);
      reloadData();
      onNotify?.(`シグネチャ [${id}] を削除しました`);
    }
  };

  // 新規登録
  const handleCreateSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newInstruction.trim()) {
      alert('タイトルと回避指示文は必須です。');
      return;
    }

    const keywords = newTriggerKeywords
      .split(/[,、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    failureCatalogService.registerSignature({
      title: newTitle,
      category: newCategory,
      severity: newSeverity,
      triggerPatterns: keywords.length > 0 ? keywords : [newTitle.slice(0, 10)],
      antiPatternExcerpt: newAntiPattern,
      correctedSolution: newCorrected,
      rootCause: newRootCause || '過去の実行時エラーまたはユーザーフィードバックによる検知',
      avoidanceInstruction: newInstruction,
      source: 'manual',
    });

    // フォームリセット
    setNewTitle('');
    setNewTriggerKeywords('');
    setNewAntiPattern('');
    setNewCorrected('');
    setNewRootCause('');
    setNewInstruction('');
    setIsAddModalOpen(false);
    reloadData();
    onNotify?.('✅ 新規失敗シグネチャをカタログに登録しました！');
  };

  const getSeverityBadge = (severity: FailureSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'LOW':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const getCategoryLabel = (category: FailureCategory) => {
    switch (category) {
      case 'vba_syntax':
        return 'VBA構文/参照';
      case 'type_mismatch':
        return '型不一致';
      case 'hallucinated_api':
        return 'API幻覚';
      case 'instruction_omission':
        return '指示不備/前置き';
      case 'assumption_drift':
        return '前提誤認/蒸返し';
      case 'performance_hang':
        return 'フリーズ/無限ループ';
      case 'security_boundary':
        return 'セキュリティ境界';
      case 'logic_error':
        return '論理矛盾';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 51章ヘッダーバナー */}
      <div className="bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-900/50 border border-rose-800/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                設計思想 第51章
              </span>
              <span className="text-xs text-slate-400 font-mono">FAILURE_SIGNATURE_CATALOG</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              失敗シグネチャ・カタログ ＆ 反復誤り自律抑止ゲート
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              過去に発生した構文エラー・型違反・前提蒸し返し・API幻覚などの失敗を「失敗シグネチャ」として構造化登録。
              推論前のプロンプトへの<strong>必須回避ルール注入（事前ガード）</strong>と、
              生成後の<strong>アンチパターン静的スキャン（事後ガード）</strong>により、一度犯した誤りの反復を自律的に根絶します。
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsScannerOpen(!isScannerOpen)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                isScannerOpen
                  ? 'bg-rose-600 text-white shadow-rose-900/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30'
              }`}
            >
              <Bug className="w-4 h-4" />
              {isScannerOpen ? 'スキャナーを閉じる' : 'アンチパターンスキャナー'}
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/30"
            >
              <Plus className="w-4 h-4" />
              シグネチャ手動追加
            </button>
          </div>
        </div>
      </div>

      {/* 4大指標サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            登録シグネチャ総数
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{stats.totalSignatures}</span>
            <span className="text-xs text-emerald-400 font-medium">({stats.activeCount} 件稼働中)</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">推論事前・事後ゲート監視対象</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            累計抑止成功回数
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">{stats.totalPrevented}</span>
            <span className="text-xs text-slate-400 font-medium">回ブロック</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">アンチパターン再発を未然に防止</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            重大リスク(CRITICAL)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono">{stats.criticalCount}</span>
            <span className="text-xs text-amber-500 font-medium">件</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">クラッシュ・データ破壊防止規程</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Code className="w-4 h-4 text-cyan-400" />
            検知・発生回数
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-300 font-mono">{stats.totalOccurred}</span>
            <span className="text-xs text-slate-400 font-medium">回記録</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">過去のエラー・不具合累積数</span>
        </div>
      </div>

      {/* アンチパターンスキャナー（展開時） */}
      {isScannerOpen && (
        <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-rose-400" />
              <h3 className="text-base font-bold text-white">アンチパターン・リアルタイムスキャナー</h3>
              <span className="text-xs text-slate-400">（任意のコードや文章をカタログと照合検証）</span>
            </div>
            <button
              onClick={handleRunScan}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/30"
            >
              <Play className="w-3.5 h-3.5" />
              スキャン実行
            </button>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              検査対象コード / 回答テキスト:
            </label>
            <textarea
              rows={5}
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500 transition-colors"
              placeholder="VBAコードや回答テキストを貼り付けてください..."
            />
          </div>

          {/* スキャン結果 */}
          {scanResults && (
            <div className="mt-3 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                {scanResults.length > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    検知されたアンチパターン ({scanResults.length} 件):
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    アンチパターン違反なし（安全基準合格）
                  </>
                )}
              </h4>

              {scanResults.map((res, i) => (
                <div
                  key={i}
                  className="bg-rose-950/30 border border-rose-700/50 rounded-lg p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      [{res.signatureId}] {res.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getSeverityBadge(res.severity)}`}>
                      {res.severity}
                    </span>
                  </div>
                  <p className="text-slate-300">
                    <span className="text-rose-400 font-semibold">違反ルール:</span> {res.matchedRule}
                  </p>
                  <p className="text-slate-400">
                    <span className="text-amber-400 font-semibold">警告指示:</span> {res.warningMessage}
                  </p>
                  {res.suggestedFix && (
                    <div className="mt-2 bg-slate-950/80 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap">
                      <span className="text-emerald-500 font-bold block mb-1">推奨修正コード:</span>
                      {res.suggestedFix}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* フィルタ & 検索バー */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="タイトル・ID・キーワード・原因で検索..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>カテゴリ:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="all">すべてのカテゴリ</option>
            <option value="vba_syntax">VBA構文/参照</option>
            <option value="type_mismatch">型不一致</option>
            <option value="hallucinated_api">API幻覚</option>
            <option value="instruction_omission">指示不備/前置き</option>
            <option value="assumption_drift">前提誤認/蒸返し</option>
            <option value="performance_hang">フリーズ/無限ループ</option>
            <option value="security_boundary">セキュリティ境界</option>
            <option value="logic_error">論理矛盾</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="all">すべての重大度</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="all">すべてのステータス</option>
            <option value="ACTIVE">ACTIVE (監視中)</option>
            <option value="MONITORING">MONITORING (検証)</option>
            <option value="RESOLVED">RESOLVED (解決)</option>
            <option value="ARCHIVED">ARCHIVED (保管)</option>
          </select>
        </div>
      </div>

      {/* シグネチャ一覧 */}
      <div className="space-y-3.5">
        {filteredSignatures.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
            <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">条件に合致する失敗シグネチャはありません</p>
            <p className="text-xs text-slate-500 mt-1">検索条件を変更するか、新規シグネチャを登録してください</p>
          </div>
        ) : (
          filteredSignatures.map((sig) => {
            const isExpanded = expandedSigId === sig.signatureId;
            return (
              <div
                key={sig.signatureId}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-3"
              >
                {/* カードヘッダー */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-xs text-slate-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                      {sig.signatureId}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getSeverityBadge(sig.severity)}`}>
                      {sig.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {getCategoryLabel(sig.category)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        sig.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : sig.status === 'MONITORING'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-slate-700/30 text-slate-400 border-slate-700'
                      }`}
                    >
                      {sig.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">
                        🛡️ 抑止: <strong className="text-emerald-400 font-mono">{sig.preventedCount}</strong> 回
                      </span>
                      <span className="text-slate-400">
                        ⚠️ 発生: <strong className="text-rose-400 font-mono">{sig.occurredCount}</strong> 回
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedSigId(isExpanded ? null : sig.signatureId)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                      title={isExpanded ? '詳細を折りたたむ' : '詳細を展開'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* タイトル & 根本原因 */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{sig.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{sig.rootCause}</p>
                </div>

                {/* 回避指示文 (プロンプト注入文) */}
                <div className="bg-slate-950/90 border border-rose-900/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    推論時・事前ガード回避指示 (Avoidance Instruction):
                  </div>
                  <p className="text-xs font-mono text-slate-200 whitespace-pre-wrap">{sig.avoidanceInstruction}</p>
                </div>

                {/* 展開時の詳細 (アンチパターン vs 修正コード) */}
                {isExpanded && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* アンチパターン */}
                      <div className="bg-rose-950/20 border border-rose-800/40 rounded-lg p-3 space-y-1.5">
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                          ❌ アンチパターン典型例:
                        </span>
                        <pre className="text-[11px] font-mono text-rose-200 bg-slate-950/70 p-2.5 rounded border border-rose-900/30 overflow-x-auto whitespace-pre-wrap">
                          {sig.antiPatternExcerpt || '（指定なし）'}
                        </pre>
                      </div>

                      {/* 推奨解決策 */}
                      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          ✅ 推奨される正解パターン:
                        </span>
                        <pre className="text-[11px] font-mono text-emerald-200 bg-slate-950/70 p-2.5 rounded border border-emerald-900/30 overflow-x-auto whitespace-pre-wrap">
                          {sig.correctedSolution || '（指定なし）'}
                        </pre>
                      </div>
                    </div>

                    {/* トリガーキーワード */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium">誘発キーワード:</span>
                      {sig.triggerPatterns.map((tp, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {tp}
                        </span>
                      ))}
                    </div>

                    {/* 操作ボタンフッター */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">ステータス変更:</span>
                        <select
                          value={sig.status}
                          onChange={(e) =>
                            handleStatusChange(sig.signatureId, e.target.value as FailureSignatureStatus)
                          }
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="ACTIVE">ACTIVE (監視中)</option>
                          <option value="MONITORING">MONITORING (検証)</option>
                          <option value="RESOLVED">RESOLVED (解決)</option>
                          <option value="ARCHIVED">ARCHIVED (保管)</option>
                        </select>
                      </div>

                      <button
                        onClick={() => handleDelete(sig.signatureId)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        シグネチャ削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 新規シグネチャ登録モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-400" />
                新規失敗シグネチャの登録 (第51章)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSignature} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  タイトル (失敗パターンの簡潔な要約) *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: ActiveSheetの明示なしによる実行時エラー1004"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">カテゴリ</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as FailureCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="vba_syntax">VBA構文/参照 (vba_syntax)</option>
                    <option value="type_mismatch">型不一致 (type_mismatch)</option>
                    <option value="hallucinated_api">API幻覚 (hallucinated_api)</option>
                    <option value="instruction_omission">指示不備/前置き (instruction_omission)</option>
                    <option value="assumption_drift">前提誤認/蒸返し (assumption_drift)</option>
                    <option value="performance_hang">フリーズ/無限ループ (performance_hang)</option>
                    <option value="security_boundary">セキュリティ境界 (security_boundary)</option>
                    <option value="logic_error">論理矛盾 (logic_error)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">重大度 (Severity)</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as FailureSeverity)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="CRITICAL">CRITICAL (致命的・クラッシュ)</option>
                    <option value="HIGH">HIGH (重要・誤動作)</option>
                    <option value="MEDIUM">MEDIUM (中程度・品質低下)</option>
                    <option value="LOW">LOW (軽微)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  トリガーキーワード (カンマまたはスペース区切り)
                </label>
                <input
                  type="text"
                  value={newTriggerKeywords}
                  onChange={(e) => setNewTriggerKeywords(e.target.value)}
                  placeholder="例: マクロ, vba, シート, 転記, Range"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">根本原因の分析</label>
                <textarea
                  rows={2}
                  value={newRootCause}
                  onChange={(e) => setNewRootCause(e.target.value)}
                  placeholder="なぜこの誤りが発生したのか（例: 別ブックが開いていると暗黙のCells参照が誤ったシートを指すため）"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  回避指示文 (推論プロンプトへの注入文) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  placeholder="例: 【厳格禁止】ActiveSheetやSelectionに依存せず、必ず明示的なWorksheet変数を宣言して修飾すること。"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-rose-400 mb-1">アンチパターン典型例</label>
                  <textarea
                    rows={3}
                    value={newAntiPattern}
                    onChange={(e) => setNewAntiPattern(e.target.value)}
                    placeholder="誤ったコード・回答の例"
                    className="w-full bg-slate-950 border border-rose-900/40 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">推奨される正解パターン</label>
                  <textarea
                    rows={3}
                    value={newCorrected}
                    onChange={(e) => setNewCorrected(e.target.value)}
                    placeholder="修正後の正しいコード・回答の例"
                    className="w-full bg-slate-950 border border-emerald-900/40 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-900/30"
                >
                  カタログへ登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Cloud,
  ShieldCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Send,
  Boxes,
  Lock,
  EyeOff,
  Terminal,
} from 'lucide-react';
import {
  cloudAiRestrictedGatewayService,
} from '../../../services/cloudAiRestrictedGatewayService';
import {
  CloudAiEscalationRequest,
  CloudEscalationTrigger,
} from '../../../types';
import { improvementProposalService } from '../../../services/improvementProposalService';

export const CloudGatewaySubView: React.FC = () => {
  const [requests, setRequests] = useState<CloudAiEscalationRequest[]>(() =>
    cloudAiRestrictedGatewayService.getRequests()
  );
  const [selectedReq, setSelectedReq] = useState<CloudAiEscalationRequest | null>(() =>
    requests[0] || null
  );

  // New Request Form State
  const [triggerReason, setTriggerReason] = useState<CloudEscalationTrigger>('UNKNOWN_API_FORMAT');
  const [abstractGoal, setAbstractGoal] = useState('PowerQuery M言語からExcelテーブルへの非同期ロード自動化');
  const [requiredCapability, setRequiredCapability] = useState('vba.powerquery_refresh_connector');
  const [rawContext, setRawContext] = useState('ユーザーの個人フォルダ: C:\\Users\\Yamada\\Projects... 社内秘密キー... 全会話ログ...');

  const refreshList = () => {
    const updated = cloudAiRestrictedGatewayService.getRequests();
    setRequests(updated);
    if (selectedReq) {
      const match = updated.find((r: CloudAiEscalationRequest) => r.escalationId === selectedReq.escalationId);
      if (match) setSelectedReq(match);
    }
  };

  const handleCreateRequest = () => {
    const req = cloudAiRestrictedGatewayService.createEscalationRequest({
      triggerReason,
      abstractGoal,
      requiredCapability,
      rawContextToSanitize: rawContext,
    });
    improvementProposalService.registerEscalation(req.escalationId, requiredCapability, triggerReason, requiredCapability);
    refreshList();
    setSelectedReq(req);
  };

  const handleReceiveDummyProposal = () => {
    if (!selectedReq) return;
    const proposal = {
      candidateCode: `' [提案部品: ${selectedReq.requiredCapability}]\nSub ExecuteAsyncLoad(targetSheet As String)\n    ' Galaxy S25検証用コード\n    MsgBox "Loaded cleanly: " & targetSheet\nEnd Sub`,
      proposedSpec: `${selectedReq.abstractGoal} を端末側で安全に実行する独立部品`,
      testCases: ['NormalExecutionTest', 'EmptyParameterGuardTest', 'SheetExistsAssertion'],
    };
    const received = cloudAiRestrictedGatewayService.receiveProposal(selectedReq.escalationId, proposal);
    if (received) {
      improvementProposalService.receiveAndQueueCandidateByEscalationId(selectedReq.escalationId, proposal, 'ANDROID');
    }
    refreshList();
  };

  const handleRun5StageVerification = () => {
    if (!selectedReq) return;
    cloudAiRestrictedGatewayService.runVerificationPipeline(selectedReq.escalationId);
    refreshList();
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              <Cloud className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-sky-300">
              第11章: クラウドAI限定連携 & 送信監査 (Restricted Cloud Gateway)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">
            常設頭脳ではなく未知問題の部品化担当としてのみ限定稼働
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          全会話・全記憶・社内情報を絶対に送信せず、抽象化した要求型と不足能力のみを送信。
          返却されたコードは直ちに使わず、静的Guard→Candidate隔離→Regression→実機Runner→Promotion Gateを経てから正式部品(VERIFIED)へ昇格させます。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Request List & Creator (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* New Request Box */}
          <div className="p-3 bg-slate-950/90 border border-sky-500/40 rounded-xl space-y-2.5 text-xs">
            <span className="font-bold text-sky-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>限定エスカレーション要求の作成 (送信監査)</span>
            </span>

            <div className="space-y-1.5">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">発動条件 (Trigger):</label>
                <select
                  value={triggerReason}
                  onChange={(e) => setTriggerReason(e.target.value as any)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 outline-none"
                >
                  <option value="UNKNOWN_API_FORMAT">未知API・未知フォーマット</option>
                  <option value="NO_LOCAL_COMPONENT">端末内に対応部品なし</option>
                  <option value="EXPLORATION_LIMIT_EXCEEDED">探索候補数が上限超過</option>
                  <option value="TIMEOUT_EXCEEDED">制限時間内に検証可能案なし</option>
                  <option value="REPEATED_LOCAL_FAILURE">同一能力で再現可能な失敗が頻発</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">抽象化した目的 (Abstract Goal):</label>
                <input
                  type="text"
                  value={abstractGoal}
                  onChange={(e) => setAbstractGoal(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">要求能力ID (Capability ID):</label>
                <input
                  type="text"
                  value={requiredCapability}
                  onChange={(e) => setRequiredCapability(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono outline-none"
                />
              </div>

              <div className="p-2 bg-slate-900 rounded border border-rose-900/40 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1 text-rose-400 font-semibold">
                  <EyeOff className="w-3 h-3" />
                  <span>送信監査ストリッピング (剥奪対象):</span>
                </div>
                <span>全会話履歴、全記憶、個人識別情報、社内認証キーは全自動で完全除去されます</span>
              </div>

              <button
                onClick={handleCreateRequest}
                className="w-full py-1.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>監査・サニタイズして要求作成</span>
              </button>
            </div>
          </div>

          {/* List of Requests */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 font-semibold px-1 block">エスカレーション履歴 ({requests.length}件)</span>
            {requests.map((r) => {
              const isSelected = selectedReq?.escalationId === r.escalationId;
              return (
                <div
                  key={r.escalationId}
                  onClick={() => setSelectedReq(r)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-slate-800 border-sky-500 ring-1 ring-sky-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-slate-200 truncate">{r.abstractGoal}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono shrink-0 ${
                        r.status === 'VERIFIED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                          : r.status === 'PROPOSED'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span className="font-mono text-sky-300">{r.requiredCapability}</span>
                    <span>トークン削減: -{Math.round((1 - r.sanitizationAudit.tokenCountAfter / Math.max(1, r.sanitizationAudit.tokenCountBefore)) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Request Details & 5-Stage Verification Pipeline (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {selectedReq ? (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4 text-xs">
              {/* Request Header */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h5 className="font-bold text-slate-100 text-sm">{selectedReq.abstractGoal}</h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    要求ID: <code className="text-sky-300">{selectedReq.escalationId}</code> | 発動契機: {selectedReq.triggerReason}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500 text-sky-300 font-bold text-[10px]">
                  {selectedReq.status}
                </span>
              </div>

              {/* Sanitization Audit Report */}
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>送信前プライバシー監査合格 (Sanitization Audit Passed)</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">トークン: {selectedReq.sanitizationAudit.tokenCountBefore} ➔ {selectedReq.sanitizationAudit.tokenCountAfter}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
                  <span className="text-slate-500">除去済み機密:</span>
                  {selectedReq.sanitizationAudit.strippedKeys.map((k: string) => (
                    <span key={k} className="px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-900/40">
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              {/* Proposal & 5-Stage Verification */}
              {selectedReq.proposal ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-amber-500/40 space-y-2">
                    <span className="text-xs font-bold text-amber-300 block">
                      📥 クラウド提案候補 (CLOUD_PROPOSED)
                    </span>
                    <pre className="p-2 bg-slate-900 rounded text-[10.5px] font-mono text-emerald-300 overflow-x-auto">
                      {selectedReq.proposal.candidateCode}
                    </pre>
                    <div className="text-[10px] text-slate-400">
                      <span>仕様: {selectedReq.proposal.proposedSpec}</span>
                    </div>
                  </div>

                  {/* 5-Stage Verification Visualizer */}
                  <div className="p-3 bg-slate-950/90 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        端末側 安全改善パイプライン（Regression → 実機Runner → Promotion Gate）
                      </span>
                      <button
                        onClick={handleRun5StageVerification}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10.5px] font-semibold transition"
                      >
                        ローカル事前検査を実行
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] pt-1">
                      <div className={`p-1.5 rounded border ${selectedReq.verificationStages.specInspection ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <span className="block font-bold">1. 仕様検査</span>
                        <span>{selectedReq.verificationStages.specInspection ? '✓ 合格' : '未実施'}</span>
                      </div>
                      <div className={`p-1.5 rounded border ${selectedReq.verificationStages.duplicateCheck ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <span className="block font-bold">2. 重複検査</span>
                        <span>{selectedReq.verificationStages.duplicateCheck ? '✓ 重複無' : '未実施'}</span>
                      </div>
                      <div className={`p-1.5 rounded border ${selectedReq.verificationStages.staticLint ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <span className="block font-bold">3. 静的検査</span>
                        <span>{selectedReq.verificationStages.staticLint ? '✓ Lint通' : '未実施'}</span>
                      </div>
                      <div className={`p-1.5 rounded border ${selectedReq.verificationStages.isolatedTest ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <span className="block font-bold">4. 隔離試験</span>
                        <span>{selectedReq.verificationStages.isolatedTest ? '✓ Test通' : '未実施'}</span>
                      </div>
                      <div className={`p-1.5 rounded border ${selectedReq.verificationStages.deviceVerifiedGalaxyS25 ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <span className="block font-bold">5. 実機検証</span>
                        <span>{selectedReq.verificationStages.deviceVerifiedGalaxyS25 ? '✓ S25合格' : '未実施'}</span>
                      </div>
                    </div>

                    {selectedReq.status === 'VERIFIED' && (
                      <div className="p-2 bg-emerald-950/40 rounded border border-emerald-800/60 text-[10.5px] text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          <strong>正式部品(VERIFIED)へ昇格完了:</strong> 部品ID <code>{selectedReq.promotedComponentId}</code> として登録されました。次回以降はクラウド不要で即時利用可能です！
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-center space-y-2">
                  <span className="text-slate-400 block text-xs">現在クラウドからの提案待ち (PENDING) です</span>
                  <button
                    onClick={handleReceiveDummyProposal}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow transition"
                  >
                    クラウドからの提案を受信 (テストシミュレーション)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              左側から要求を選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

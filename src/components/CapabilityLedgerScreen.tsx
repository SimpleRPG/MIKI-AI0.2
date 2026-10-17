import React, { useState } from 'react';
import {
  capabilityLedgerService,
  type CapabilityLedgerAssessment,
  type CapabilityLedgerSnapshot,
  type CapabilityLedgerState,
} from '../miki/capability/services/capabilityLedgerService';

export interface CapabilityLedgerScreenProps {
  onBack?: () => void;
}

const STATE_LABELS: Record<CapabilityLedgerState, string> = {
  VERIFIED_EVIDENCE: '実行根拠あり',
  VERIFIED_REGISTRY_ONLY: 'Registry上のみ検証済み',
  REVALIDATION_REQUIRED: '再検証が必要',
  IMPLEMENTED_UNVERIFIED: '実装あり・未検証',
  UNASSESSED: '未評価',
};

const STATE_ORDER: CapabilityLedgerState[] = [
  'VERIFIED_EVIDENCE',
  'VERIFIED_REGISTRY_ONLY',
  'REVALIDATION_REQUIRED',
  'IMPLEMENTED_UNVERIFIED',
  'UNASSESSED',
];

export const CapabilityLedgerScreen: React.FC<CapabilityLedgerScreenProps> = ({ onBack }) => {
  const [snapshot, setSnapshot] = useState<CapabilityLedgerSnapshot>(
    () => capabilityLedgerService.getSnapshot(),
  );
  const [goal, setGoal] = useState('');
  const [assessment, setAssessment] = useState<CapabilityLedgerAssessment | null>(null);

  const refresh = () => {
    setSnapshot(capabilityLedgerService.getSnapshot());
    setAssessment(null);
  };

  const exportTxt = () => {
    const blob = new Blob([capabilityLedgerService.toText(snapshot)], {
      type: 'text/plain;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `MIKI_自己能力台帳_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const runAssessment = () => {
    if (!goal.trim()) {
      setAssessment(null);
      return;
    }
    setAssessment(capabilityLedgerService.assessGoal(goal));
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4 pb-24 text-slate-100">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          >
            戻る
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">MIKI-AI</p>
          <h1 className="text-xl font-black">自己能力台帳</h1>
          <p className="mt-1 text-xs text-slate-400">更新: {snapshot.snapshotAt}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          再読込
        </button>
        <button
          type="button"
          onClick={exportTxt}
          className="rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-3 py-2 text-sm text-indigo-200"
        >
          TXT出力
        </button>
      </header>

      <p className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm leading-6 text-slate-300">
        Registryの状態、現在の実装hashと一致する実行根拠、未検証の実装を分けて表示するよ。
        候補が見つからないことだけで、できないとは判断しないよ。
      </p>

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">Registry登録数</p>
          <p className="text-2xl font-black">{snapshot.registryCount}</p>
          <p className="text-xs text-slate-500">評価対象: {snapshot.assessedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">取得した未解決Knowledge Gap</p>
          <p className="text-2xl font-black">
            {snapshot.gapsTruncated ? '500+' : snapshot.openGapCountAtLeast}
          </p>
          <p className="text-xs text-slate-500">OPEN / RESEARCHING</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">メタデータ履歴</p>
          <p className="text-2xl font-black">{snapshot.historyCount}</p>
          <p className="text-xs text-slate-500">最大30件。実装コードは複製しない</p>
        </div>
        {STATE_ORDER.map((state) => (
          <div key={state} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-400">{STATE_LABELS[state]}</p>
            <p className="text-2xl font-black">{snapshot.statusCounts[state]}</p>
          </div>
        ))}
      </section>

      {(snapshot.componentsTruncated || snapshot.gapsTruncated) && (
        <p className="mb-4 text-sm text-amber-300">
          表示上限に達しているため、RegistryまたはGapの全件を表示できていないよ。
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 font-bold">目標と能力候補を照合</h2>
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={3}
          placeholder="みきにやらせたい作業や能力を入力"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={runAssessment}
          className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
        >
          台帳と照合
        </button>

        {assessment && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <p className="text-sm text-slate-300">{assessment.summary}</p>
            {assessment.candidates.length === 0 ? (
              <p className="mt-3 text-sm text-amber-300">
                一致候補は見つからなかったよ。ただし、これは能力が存在しない証拠ではないよ。
                ソース・依存関係・実行手段の追加調査が必要だよ。
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {assessment.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{candidate.id}</p>
                      <span className="text-xs text-slate-400">
                        {STATE_LABELS[candidate.state]} / 語句一致 {candidate.matchScore}%
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{candidate.purpose || '用途の記述なし'}</p>
                    <p className="mt-1 text-xs text-slate-500">{candidate.reason}</p>
                  </div>
                ))}
              </div>
            )}
            {assessment.componentsTruncated && (
              <p className="mt-3 text-xs text-amber-300">
                Registry全体ではなく、評価上限内のコンポーネントだけを照合しているよ。
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">能力一覧（最大100件表示）</h2>
        <div className="space-y-2">
          {snapshot.components.slice(0, 100).map((component) => (
            <div key={component.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-semibold">{component.id}</p>
                <span className="text-xs text-slate-400">{STATE_LABELS[component.state]}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{component.purpose || '用途の記述なし'}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>Registry: {component.registryStatus}</span>
                <span>実行サンプル: {component.sampleCount}</span>
                <span>成功: {component.successes}</span>
                <span>失敗: {component.failures}</span>
                <span>Artifact: {component.artifactAvailable ? 'あり' : '未確認'}</span>
              </div>
              <p className="mt-2 break-words text-xs text-slate-400">{component.reason}</p>
            </div>
          ))}
        </div>
        {snapshot.components.length > 100 && (
          <p className="mt-3 text-xs text-slate-400">
            TXT出力には評価済みの最大500件を含めるよ。
          </p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">未解決Knowledge Gap（最大30件表示）</h2>
        <div className="space-y-2">
          {snapshot.openGaps.slice(0, 30).map((gap) => (
            <div key={gap.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{gap.id}</p>
                <span className="text-xs text-slate-400">{gap.status} / 優先度 {gap.priority}</span>
              </div>
              <p className="mt-1 text-sm">{gap.query}</p>
              <p className="mt-1 text-xs text-slate-400">{gap.type}: {gap.reason}</p>
              {gap.requiredEvidence.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  必要根拠: {gap.requiredEvidence.join(' / ')}
                </p>
              )}
            </div>
          ))}
          {snapshot.openGaps.length === 0 && (
            <p className="text-sm text-slate-400">
              取得範囲ではOPEN / RESEARCHINGのGapは見つからなかったよ。
            </p>
          )}
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-500">
        この画面は観測済み情報の台帳だよ。語句一致だけで能力を認定せず、候補不在だけで能力の不在を確定しない。
        Knowledge GapやCapability Gapを自動解決したり、Claimや部品を自動昇格したりはしないよ。
      </p>
    </div>
  );
};

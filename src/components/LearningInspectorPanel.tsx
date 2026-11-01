import React, { useMemo, useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { mikiUnifiedLearningContinuumService } from '../miki/learning/services/mikiUnifiedLearningContinuumService';
import { outcomePredictionService } from '../miki/core/services/outcomePredictionService';

// P380: a window into what MIKI has learned, and a way to correct
// it. Lists the distilled rules, the prediction calibration, and
// the learned profiles with their confidence, activation, lessons
// and boundaries. Each profile can be forgotten individually —
// the correction path for wrong learning, short of wiping
// everything.
export const LearningInspectorPanel: React.FC = () => {
  const [revision, setRevision] = useState(0);
  const [confirmKey, setConfirmKey] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');

  const snapshot = useMemo(
    () => mikiUnifiedLearningContinuumService.getSnapshot(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision]
  );
  const calibration = useMemo(() => outcomePredictionService.calibration(), [revision]);
  const profiles = useMemo(
    () =>
      [...snapshot.profiles]
        .sort(
          (a, b) =>
            mikiUnifiedLearningContinuumService.activationOf(b) - mikiUnifiedLearningContinuumService.activationOf(a)
        )
        .slice(0, 30),
    [snapshot]
  );

  const forget = (key: string) => {
    if (confirmKey !== key) {
      setConfirmKey(key);
      return;
    }
    const removed = mikiUnifiedLearningContinuumService.forgetProfile(key);
    setMessage(removed ? `「${key}」の学習を消しました` : `「${key}」は見つかりませんでした`);
    setConfirmKey(undefined);
    setRevision(value => value + 1);
  };

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <BookOpen className="h-4 w-4 text-indigo-300" />
          学習の中身（閲覧と訂正）
        </h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-slate-950 p-2">
            <div className="text-base font-bold text-slate-100">{snapshot.profiles.length}</div>
            <div className="text-slate-400">学習プロファイル</div>
          </div>
          <div className="rounded-xl bg-slate-950 p-2">
            <div className="text-base font-bold text-slate-100">{snapshot.generalizedRules.length}</div>
            <div className="text-slate-400">一般化された規則</div>
          </div>
          <div className="rounded-xl bg-slate-950 p-2">
            <div className="text-base font-bold text-slate-100">
              {calibration.accuracy === null ? '—' : `${Math.round(calibration.accuracy * 100)}%`}
            </div>
            <div className="text-slate-400">予測の的中率（{calibration.samples}件）</div>
          </div>
        </div>

        {snapshot.generalizedRules.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs font-bold text-slate-300">一般化された規則</div>
            {snapshot.generalizedRules.slice(0, 10).map(rule => (
              <div key={rule.ruleId} className="rounded-xl bg-slate-950 p-2 text-xs text-slate-300">
                {rule.statement}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold text-slate-300">プロファイル（活性化の高い順・30件まで）</div>
          {profiles.length === 0 && <div className="text-xs text-slate-500">まだ学習プロファイルがありません</div>}
          {profiles.map(profile => {
            const lessons = mikiUnifiedLearningContinuumService.lessonContextFor(profile.key);
            return (
              <div key={profile.key} className="rounded-xl bg-slate-950 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-all font-mono font-bold text-slate-200">{profile.key}</div>
                    <div className="mt-0.5 text-slate-400">
                      確かさ {profile.confidence} / 活性化 {mikiUnifiedLearningContinuumService.activationOf(profile)} /
                      使用 {profile.uses}（成功 {profile.successes}・失敗 {profile.failures}・検証 {profile.verified}）
                    </div>
                  </div>
                  <button
                    onClick={() => forget(profile.key)}
                    className={`shrink-0 rounded-lg px-2 py-1.5 font-bold ${
                      confirmKey === profile.key
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Trash2 className="mr-1 inline h-3 w-3" />
                    {confirmKey === profile.key ? '本当に消す' : '忘れる'}
                  </button>
                </div>
                {profile.lastLesson && <div className="mt-1 text-slate-400">教訓: {profile.lastLesson}</div>}
                {lessons.boundaries[0] && (
                  <div className="mt-0.5 text-amber-300/90">
                    境界: {lessons.boundaries[0].text}（{lessons.boundaries[0].domain}）
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {message && (
          <div role="status" className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
            {message}
          </div>
        )}
      </section>
    </div>
  );
};

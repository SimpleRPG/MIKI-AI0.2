import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Cpu,
  Clock,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { CapabilityPlugin, PluginConsentRequest } from '../types';
import { capabilityPluginService } from '../services/capabilityPluginService';

interface PluginConsentDialogProps {
  request: PluginConsentRequest;
  isOpen: boolean;
  onClose: () => void;
  onConsentGranted: (plugin: CapabilityPlugin) => void;
  onConsentRejected: (plugin: CapabilityPlugin) => void;
}

export const PluginConsentDialog: React.FC<PluginConsentDialogProps> = ({
  request,
  isOpen,
  onClose,
  onConsentGranted,
  onConsentRejected,
}) => {
  if (!isOpen || !request) return null;

  const { plugin, missingPermissions, riskSummary } = request;
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(missingPermissions);
  const [consentNotes, setConsentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePermission = (perm: string) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const handleApprove = () => {
    setIsSubmitting(true);
    try {
      const res = capabilityPluginService.grantConsentAndActivate(
        plugin.plugin_id,
        selectedPermissions,
        consentNotes || 'ユーザーにより明示承認'
      );
      const updated = capabilityPluginService.getPlugin(plugin.plugin_id) || plugin;
      onConsentGranted(updated);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    capabilityPluginService.suspendOrRejectPlugin(
      plugin.plugin_id,
      'ユーザーにより権限承認が拒否されました'
    );
    const updated = capabilityPluginService.getPlugin(plugin.plugin_id) || plugin;
    onConsentRejected(updated);
    onClose();
  };

  const fallback = plugin.fallbackPluginId
    ? capabilityPluginService.getPlugin(plugin.fallbackPluginId)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        {/* ヘッダー */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60">
                設計思想 46章: 権限承認ゲート
              </span>
              <span className="text-xs text-slate-400 font-mono">v{plugin.version}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              能力プラグイン「{plugin.name}」の権限承認
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              プラグインが追加されても、端末内の正式権限は自動追加されません。本プラグインを有効化（ACTIVE）するには、以下の権限を明示的に承認してください。
            </p>
          </div>
        </div>

        {/* プラグイン基本情報 */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400 font-semibold">依頼分類 (category):</span>
            <span className="font-mono text-sky-400 font-bold">{plugin.category}</span>
          </div>
          <p className="text-slate-300 leading-relaxed">{plugin.description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>予算: {plugin.executionBudget.maxTokens || 4000} tok</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>タイムアウト: {plugin.timeoutMs / 1000}秒</span>
            </div>
            <div className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>コスト: {plugin.executionBudget.costPerRun || 0} pts</span>
            </div>
          </div>
        </div>

        {/* 要求されている未承認権限チェックボックス */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
            <span>要求されている端末権限 (チェックして承認):</span>
            <span className="text-[11px] text-amber-400 font-normal">
              {selectedPermissions.length} / {missingPermissions.length} 選択中
            </span>
          </label>
          <div className="space-y-2">
            {missingPermissions.map((perm) => {
              const isChecked = selectedPermissions.includes(perm);
              return (
                <div
                  key={perm}
                  onClick={() => togglePermission(perm)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? 'bg-amber-950/30 border-amber-600/70 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 accent-amber-500 rounded"
                  />
                  <div className="flex-1 text-xs space-y-0.5">
                    <div className="font-mono font-bold text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{perm}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {perm === 'network_cloud' && '外部Gemini Cloudとの通信およびWebリアルタイム検索を行います'}
                      {perm === 'workspace_write' && 'ワークスペース内のソースコード・ファイルの新規作成・上書き'}
                      {perm === 'workspace_read' && 'ワークスペース内の既存ファイルの安全な読み取り'}
                      {perm === 'sensitive_filter' && '通信前に記憶・機密情報の自動フィルタリングを実施'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* リスク要約・代替経路 */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>失敗時・権限拒否時の代替経路 (Fallback):</span>
          </div>
          {fallback ? (
            <div className="flex items-center gap-2 text-slate-400 text-[11px] bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
              <span>「{fallback.name}」へ自動縮退して安全に継続実行します</span>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px]">
              代替経路は設定されていません（実行中止または安全なエラー終了となります）
            </div>
          )}
        </div>

        {/* フッターアクション */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>権限を拒否 (一時停止にする)</span>
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting || selectedPermissions.length === 0}
            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-900/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>承認して有効化 (ACTIVE)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

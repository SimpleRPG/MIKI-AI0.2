import React, { useMemo, useState } from 'react';
import { RotateCcw, Save, Sparkles } from 'lucide-react';
import { typedPersonaUiGatewayService, type PersonaProfile } from '../miki/core/ui/typedPersonaUiGatewayService';

const AVATARS = [
  { id: 'miki-default', label: 'MIKI', icon: 'M' },
  { id: 'miki-circle', label: 'サークル', icon: '●' },
  { id: 'miki-spark', label: 'スパーク', icon: '✦' },
  { id: 'miki-cube', label: 'キューブ', icon: '◆' },
];

export const PersonaSettingsPanel: React.FC = () => {
  const [profile, setProfile] = useState<PersonaProfile>(() => typedPersonaUiGatewayService.getProfile());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const preview = useMemo(() => typedPersonaUiGatewayService.preview(profile), [profile]);

  const save = async () => {
    setBusy(true);
    setNotice('');
    const result = await typedPersonaUiGatewayService.saveProfile(profile);
    setBusy(false);
    setNotice(`${result.summary}${result.taskId ? ` / Task ${result.taskId}` : ''}${result.receipt ? ` / Receipt ${result.receipt.receiptId}` : ''}`);
    if (result.profile) setProfile(result.profile);
  };

  const reset = () => {
    setProfile(typedPersonaUiGatewayService.getDefaultProfile());
    setNotice('初期値を画面へ戻しました。保存するまで確定しません。');
  };

  return <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-4">
    <div><h2 className="text-base font-bold">会話・人格</h2><p className="mt-1 text-xs leading-5 text-slate-400">名前、話し方の性格、既存アイコンだけを設定します。事実判定、安全、Evidence、coreの権限は変更しません。</p></div>
    <label className="block text-sm font-semibold">名前<input value={profile.name} maxLength={40} onChange={e => setProfile(x => ({ ...x, name: e.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3" /></label>
    <label className="block text-sm font-semibold">性格<textarea value={profile.personalityText} maxLength={500} rows={4} onChange={e => setProfile(x => ({ ...x, personalityText: e.target.value }))} placeholder="例: 親しみやすく、率直で、簡潔かつ丁寧" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3" /><span className="mt-1 block text-right text-[11px] text-slate-500">{profile.personalityText.length} / 500</span></label>
    <div><p className="text-sm font-semibold">アイコン</p><div className="mt-2 grid grid-cols-2 gap-3">{AVATARS.map(item => <button key={item.id} type="button" onClick={() => setProfile(x => ({ ...x, avatarId: item.id }))} aria-pressed={profile.avatarId === item.id} className={`min-h-14 rounded-2xl border px-3 text-left ${profile.avatarId === item.id ? 'border-indigo-400 bg-indigo-950' : 'border-slate-700 bg-slate-950'}`}><span className="mr-2 text-lg">{item.icon}</span>{item.label}</button>)}</div></div>
    <div className="rounded-2xl bg-slate-950 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4"/>会話Preview</div><div className="space-y-2 text-xs leading-5 text-slate-300"><p><b>短い返答:</b> {preview.short}</p><p><b>技術説明:</b> {preview.technical}</p><p><b>訂正:</b> {preview.correction}</p><p><b>不明点:</b> {preview.unknown}</p></div></div>
    {notice && <p className="rounded-2xl bg-slate-950 p-3 text-xs text-slate-300">{notice}</p>}
    <div className="grid grid-cols-2 gap-3"><button type="button" onClick={reset} disabled={busy} className="min-h-12 rounded-2xl border border-slate-700 bg-slate-950 font-bold"><RotateCcw className="mr-2 inline h-4 w-4"/>初期値</button><button type="button" onClick={save} disabled={busy || !profile.name.trim() || !profile.personalityText.trim()} className="min-h-12 rounded-2xl bg-indigo-600 font-bold disabled:bg-slate-700"><Save className="mr-2 inline h-4 w-4"/>{busy ? '保存中' : '保存'}</button></div>
  </section>;
};

import React, { useState } from 'react';
import { Send, Dices, Coffee, Wand2, Sparkles, Flame } from 'lucide-react';

interface ActionControlsProps {
  onPerformAction: (actionText: string, requiresRoll?: boolean) => void;
  onRest: () => void;
  onTriggerRandomBattle: () => void;
  suggestedActions: string[];
  disabled: boolean;
  canRest: boolean;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  onPerformAction,
  onRest,
  onTriggerRandomBattle,
  suggestedActions,
  disabled,
  canRest
}) => {
  const [customInput, setCustomInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || disabled) return;
    onPerformAction(customInput.trim(), true);
    setCustomInput('');
  };

  const handleSuggestedClick = (act: string) => {
    if (disabled) return;
    onPerformAction(act, true);
  };

  return (
    <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-4 shadow-xl space-y-3.5">
      {/* Quick Action Pills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Suggested Actions from MIKI
          </span>
          <span className="text-[10px] text-stone-400">Click any option to act</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestedActions.map((action, idx) => (
            <button
              key={idx}
              id={`action-suggested-${idx}`}
              onClick={() => handleSuggestedClick(action)}
              disabled={disabled}
              className="text-left text-xs bg-stone-950/80 hover:bg-amber-950/30 border border-stone-800 hover:border-amber-500/50 p-2.5 rounded-lg text-stone-300 hover:text-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-start gap-2 group shadow-sm"
            >
              <span className="text-amber-500 font-bold group-hover:translate-x-0.5 transition-transform">
                ›
              </span>
              <span className="flex-1 leading-snug line-clamp-2">{action}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Text Prompt Input */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          id="custom-action-input"
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Or describe anything you wish to do... (e.g. 'I inspect the ceiling for hidden runes')"
          disabled={disabled}
          className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-3.5 pr-24 text-xs sm:text-sm text-stone-100 placeholder:text-stone-400 outline-none transition shadow-inner disabled:opacity-50"
        />
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          <button
            type="submit"
            id="send-action-btn"
            disabled={!customInput.trim() || disabled}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 text-stone-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer disabled:cursor-not-allowed disabled:text-stone-400 shadow"
          >
            <span>Act</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Auxiliary Utility Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          {/* Quick D20 Check */}
          <button
            id="quick-d20-btn"
            onClick={() => onPerformAction('Perform an intuition and skill check of my surroundings', true)}
            disabled={disabled}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 px-3 py-1.5 rounded-lg text-stone-200 hover:text-amber-300 font-medium transition cursor-pointer disabled:opacity-50"
            title="Roll a direct d20 skill check with MIKI"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Roll D20 Check</span>
          </button>

          {/* Short Rest */}
          <button
            id="rest-btn"
            onClick={onRest}
            disabled={disabled || !canRest}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 px-3 py-1.5 rounded-lg text-emerald-300 hover:text-emerald-200 font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Camp and recover 30 HP & 20 MP"
          >
            <Coffee className="w-4 h-4 text-emerald-400" />
            <span>Short Rest</span>
          </button>
        </div>

        {/* Encounter Ambush Trigger */}
        <button
          id="hunt-encounter-btn"
          onClick={onTriggerRandomBattle}
          disabled={disabled}
          className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-800/60 px-3 py-1.5 rounded-lg text-red-300 hover:text-red-200 font-medium transition cursor-pointer disabled:opacity-50"
          title="Search for a nearby combat encounter"
        >
          <Flame className="w-3.5 h-3.5 text-red-400" />
          <span>Hunt Monster</span>
        </button>
      </div>
    </div>
  );
};

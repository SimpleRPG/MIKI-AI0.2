import React, { useEffect, useRef } from 'react';
import { Bot, User, Dices, ShieldAlert, Sparkles } from 'lucide-react';
import { StoryEntry } from '../types/rpg';

interface StoryLogProps {
  entries: StoryEntry[];
  isLoading: boolean;
}

export const StoryLog: React.FC<StoryLogProps> = ({ entries, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isLoading]);

  return (
    <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[380px] max-h-[600px] overflow-hidden">
      {/* Story Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-stone-100 text-sm tracking-wide">Adventure Chronicle & MIKI</h2>
        </div>
        <span className="text-[11px] text-stone-400 font-mono">
          {entries.length} Event{entries.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Message Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3.5 pr-2"
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`p-3 rounded-xl border transition-all ${
              entry.speaker === 'player'
                ? 'bg-amber-950/20 border-amber-800/40 text-stone-200 ml-4'
                : entry.speaker === 'monster'
                ? 'bg-red-950/30 border-red-800/50 text-red-200'
                : entry.speaker === 'system'
                ? 'bg-stone-950/80 border-stone-700/50 text-stone-300'
                : 'bg-stone-950/60 border-stone-800 text-stone-100 mr-4'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <div className="flex items-center gap-1.5">
                {entry.speaker === 'player' && (
                  <>
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-semibold">You</span>
                  </>
                )}
                {entry.speaker === 'miki' && (
                  <>
                    <Bot className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 font-semibold">MIKI (Game Master)</span>
                  </>
                )}
                {entry.speaker === 'monster' && (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400 font-semibold">Hostile Encounter</span>
                  </>
                )}
                {entry.speaker === 'system' && (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-400 font-semibold">Chronicle Notice</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-stone-400 font-mono">{entry.timestamp}</span>
            </div>

            {/* Dice Roll Ribbon */}
            {entry.rollResult && (
              <div className="my-2 p-1.5 bg-stone-900 border border-stone-700 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-stone-300 font-mono">
                  <Dices className="w-4 h-4 text-amber-400 animate-spin-slow" />
                  <span>D20 Roll ({entry.rollResult.dice}) + Mod ({entry.rollResult.mod})</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-bold font-mono ${
                    entry.rollResult.isCrit
                      ? 'bg-amber-500 text-stone-950 animate-bounce'
                      : entry.rollResult.isFail
                      ? 'bg-red-700 text-white'
                      : 'bg-stone-800 text-amber-300'
                  }`}
                >
                  Total: {entry.rollResult.total}
                  {entry.rollResult.isCrit && ' ★ NATURAL 20!'}
                  {entry.rollResult.isFail && ' ⚠️ CRITICAL FAIL!'}
                </span>
              </div>
            )}

            {/* Narrative text */}
            <p className="text-xs sm:text-sm leading-relaxed text-stone-200 whitespace-pre-wrap">
              {entry.text}
            </p>

            {/* MIKI companion side-commentary */}
            {entry.mikiComment && (
              <div className="mt-2.5 pt-2 border-t border-stone-800/80 flex items-start gap-2 bg-amber-500/5 p-2 rounded-lg border-l-2 border-l-amber-500">
                <span className="text-sm">💬</span>
                <p className="text-xs italic text-amber-300/90 font-medium">
                  <strong className="not-italic text-amber-400">MIKI:</strong> "{entry.mikiComment}"
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Typing / Thinking indicator */}
        {isLoading && (
          <div className="p-3 bg-stone-950/60 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-300 text-xs animate-pulse">
            <Bot className="w-4 h-4 text-amber-400 animate-spin" />
            <span>MIKI is weaving the next chapter of your fate...</span>
          </div>
        )}
      </div>
    </div>
  );
};

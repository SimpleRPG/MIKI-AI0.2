import React, { useEffect, useState } from 'react';
import { Dices, Sparkles, AlertCircle } from 'lucide-react';

interface DiceRollOverlayProps {
  rollValue: number;
  modifier: number;
  label?: string;
  onComplete: () => void;
}

export const DiceRollOverlay: React.FC<DiceRollOverlayProps> = ({
  rollValue,
  modifier,
  label = 'Skill Check',
  onComplete
}) => {
  const [displayNumber, setDisplayNumber] = useState(1);
  const [isDone, setIsDone] = useState(false);

  const total = rollValue + modifier;
  const isCrit = rollValue === 20;
  const isFail = rollValue === 1;

  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
      frame++;
      if (frame > 14) {
        clearInterval(interval);
        setDisplayNumber(rollValue);
        setIsDone(true);
        setTimeout(() => {
          onComplete();
        }, 1200);
      }
    }, 55);

    return () => clearInterval(interval);
  }, [rollValue, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in pointer-events-none">
      <div className="bg-stone-900/95 border border-amber-500/60 rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center gap-3 max-w-xs w-full animate-scale-up">
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold uppercase tracking-wider">
          <Dices className="w-4 h-4 animate-spin-slow" />
          <span>{label}</span>
        </div>

        {/* 3D Dice Container */}
        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center border-2 shadow-2xl transition-all duration-300 ${
          isDone
            ? isCrit
              ? 'bg-gradient-to-br from-amber-500 to-yellow-300 border-amber-200 text-stone-950 scale-110'
              : isFail
              ? 'bg-gradient-to-br from-red-800 to-red-600 border-red-400 text-white'
              : 'bg-stone-950 border-amber-500/80 text-amber-300'
            : 'bg-stone-950 border-stone-700 text-stone-300 animate-pulse'
        }`}>
          <span className="text-4xl font-extrabold font-mono tracking-tighter">
            {displayNumber}
          </span>
        </div>

        {/* Modifier and result calculation */}
        {isDone && (
          <div className="space-y-1 animate-fade-in">
            <div className="text-xs text-stone-400 font-mono">
              Roll ({rollValue}) + Modifier ({modifier >= 0 ? `+${modifier}` : modifier})
            </div>
            <div className="text-xl font-bold text-stone-100 font-mono">
              Total: <span className="text-amber-400">{total}</span>
            </div>
            {isCrit && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950 border border-amber-500 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5" /> CRITICAL SUCCESS (20)
              </span>
            )}
            {isFail && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-950 border border-red-500 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" /> CRITICAL FAILURE (1)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { 
  Shield, 
  Heart, 
  Sparkles, 
  Swords, 
  Zap, 
  Award, 
  PlusCircle,
  Brain,
  MessageSquare
} from 'lucide-react';
import { Character, CharacterStats } from '../types/rpg';

interface CharacterCardProps {
  character: Character;
  onUpgradeStat: (statKey: keyof CharacterStats) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, onUpgradeStat }) => {
  const hpPercent = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));
  const mpPercent = Math.max(0, Math.min(100, (character.mp / character.maxMp) * 100));
  const xpPercent = Math.max(0, Math.min(100, (character.xp / character.maxXp) * 100));

  return (
    <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      {/* Header Info */}
      <div className="flex items-center gap-3 border-b border-stone-800 pb-3">
        <div className="text-3xl p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-inner">
          {character.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-stone-100 text-base truncate">{character.name}</h2>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2 py-0.5 rounded-full font-bold">
              LVL {character.level}
            </span>
          </div>
          <p className="text-xs text-amber-400/90 truncate font-medium">{character.classTitle}</p>
        </div>
      </div>

      {/* Health, Mana, XP Gauges */}
      <div className="space-y-2.5">
        {/* HP Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-red-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /> HP
            </span>
            <span className="text-stone-300 font-mono text-[11px]">
              {character.hp} / {character.maxHp}
            </span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-2.5 overflow-hidden border border-red-900/40">
            <div
              className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-300"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* MP Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-blue-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> MP
            </span>
            <span className="text-stone-300 font-mono text-[11px]">
              {character.mp} / {character.maxMp}
            </span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-2.5 overflow-hidden border border-blue-900/40">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${mpPercent}%` }}
            />
          </div>
        </div>

        {/* XP Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-amber-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" /> EXP
            </span>
            <span className="text-stone-400 font-mono text-[11px]">
              {character.xp} / {character.maxXp} XP
            </span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden border border-stone-800">
            <div
              className="bg-gradient-to-r from-amber-600 to-yellow-400 h-full transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Available Points Alert */}
      {character.availableStatPoints > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2 text-center animate-pulse">
          <p className="text-xs text-amber-300 font-bold">
            ✨ {character.availableStatPoints} Stat Point{character.availableStatPoints > 1 ? 's' : ''} Available!
          </p>
        </div>
      )}

      {/* Primary Attributes */}
      <div className="bg-stone-950/60 border border-stone-800/80 rounded-lg p-2.5">
        <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
          Attributes & Masteries
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* STR */}
          <div className="flex items-center justify-between bg-stone-900/80 p-1.5 rounded border border-stone-800">
            <span className="text-stone-300 flex items-center gap-1">
              <Swords className="w-3.5 h-3.5 text-red-400" /> STR
            </span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-amber-400 font-mono">{character.stats.strength}</span>
              {character.availableStatPoints > 0 && (
                <button
                  onClick={() => onUpgradeStat('strength')}
                  className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Upgrade Strength"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DEX */}
          <div className="flex items-center justify-between bg-stone-900/80 p-1.5 rounded border border-stone-800">
            <span className="text-stone-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> DEX
            </span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-amber-400 font-mono">{character.stats.dexterity}</span>
              {character.availableStatPoints > 0 && (
                <button
                  onClick={() => onUpgradeStat('dexterity')}
                  className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Upgrade Dexterity"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* INT */}
          <div className="flex items-center justify-between bg-stone-900/80 p-1.5 rounded border border-stone-800">
            <span className="text-stone-300 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-blue-400" /> INT
            </span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-amber-400 font-mono">{character.stats.intelligence}</span>
              {character.availableStatPoints > 0 && (
                <button
                  onClick={() => onUpgradeStat('intelligence')}
                  className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Upgrade Intelligence"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CHA */}
          <div className="flex items-center justify-between bg-stone-900/80 p-1.5 rounded border border-stone-800">
            <span className="text-stone-300 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> CHA
            </span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-amber-400 font-mono">{character.stats.charisma}</span>
              {character.availableStatPoints > 0 && (
                <button
                  onClick={() => onUpgradeStat('charisma')}
                  className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Upgrade Charisma"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Total Defense */}
        <div className="mt-2 flex items-center justify-between bg-stone-900/80 p-1.5 rounded border border-stone-800 text-xs">
          <span className="text-stone-300 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Total Armor & Ward
          </span>
          <span className="font-bold text-emerald-400 font-mono">
            {character.stats.defense + (character.armor?.defense || 0) + (character.accessory?.defense || 0)}
          </span>
        </div>
      </div>

      {/* Equipped Gear summary */}
      <div className="border-t border-stone-800 pt-2 text-xs space-y-1.5">
        <h4 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
          Equipped Loadout
        </h4>
        <div className="space-y-1 text-stone-300">
          <div className="flex items-center justify-between bg-stone-950/40 px-2 py-1 rounded">
            <span className="text-stone-400">Weapon:</span>
            <span className="text-amber-300 font-medium truncate max-w-[140px]">
              {character.weapon?.name || 'Unarmed'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-stone-950/40 px-2 py-1 rounded">
            <span className="text-stone-400">Armor:</span>
            <span className="text-cyan-300 font-medium truncate max-w-[140px]">
              {character.armor?.name || 'Simple Clothes'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-stone-950/40 px-2 py-1 rounded">
            <span className="text-stone-400">Relic:</span>
            <span className="text-purple-300 font-medium truncate max-w-[140px]">
              {character.accessory?.name || 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

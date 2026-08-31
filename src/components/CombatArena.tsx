import React, { useState } from 'react';
import { 
  Swords, 
  Sparkles, 
  Shield, 
  Heart, 
  HeartPulse, 
  Flame, 
  Dices, 
  Bot, 
  Skull, 
  Trophy, 
  Undo2,
  Zap
} from 'lucide-react';
import { Character, Monster, Item } from '../types/rpg';

interface CombatArenaProps {
  character: Character;
  monster: Monster;
  onPlayerMove: (move: string, rollResult?: { dice: number; mod: number; total: number }) => Promise<void>;
  onUseItemInCombat: (item: Item) => void;
  onFlee: () => void;
  onVictory: (monster: Monster) => void;
  combatLog: string[];
  isResolving: boolean;
}

export const CombatArena: React.FC<CombatArenaProps> = ({
  character,
  monster,
  onPlayerMove,
  onUseItemInCombat,
  onFlee,
  onVictory,
  combatLog,
  isResolving
}) => {
  const [showItemPicker, setShowItemPicker] = useState(false);

  const monsterHpPercent = Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100));
  const characterHpPercent = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));
  const isMonsterDead = monster.hp <= 0;
  const isPlayerDead = character.hp <= 0;

  const handleStandardAttack = () => {
    if (isResolving || isMonsterDead || isPlayerDead) return;
    const dice = Math.floor(Math.random() * 20) + 1;
    const mod = Math.floor(character.stats.strength / 2);
    const total = dice + mod;
    onPlayerMove(
      `Melee Strike with ${character.weapon?.name || 'Fists'}`,
      { dice, mod, total }
    );
  };

  const handleCastSpell = () => {
    if (isResolving || isMonsterDead || isPlayerDead || character.mp < 15) return;
    const dice = Math.floor(Math.random() * 20) + 1;
    const mod = Math.floor(character.stats.intelligence / 2);
    const total = dice + mod;
    onPlayerMove(
      'Channel Arcane Blast',
      { dice, mod, total }
    );
  };

  const handleDefend = () => {
    if (isResolving || isMonsterDead || isPlayerDead) return;
    onPlayerMove('Take Defensive Guard and Brace for Impact');
  };

  const handleParleyOrFlee = () => {
    if (isResolving || isMonsterDead || isPlayerDead) return;
    const dice = Math.floor(Math.random() * 20) + 1;
    const mod = Math.floor(character.stats.dexterity / 2);
    const total = dice + mod;
    if (total >= 12) {
      onFlee();
    } else {
      onPlayerMove(
        'Attempt Tactical Retreat',
        { dice, mod, total }
      );
    }
  };

  const usableCombatItems = character.inventory.filter(i => i.type === 'consumable');

  return (
    <div className="bg-stone-900 border border-red-900/60 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Combat Header */}
      <div className="flex items-center justify-between border-b border-red-900/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-red-950/80 border border-red-700/60 rounded-lg text-red-400">
            <Swords className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-red-300 tracking-wide flex items-center gap-2">
              Turn-Based Combat Arena
            </h2>
            <p className="text-xs text-stone-400">MIKI is orchestrating tactical resolution</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-red-950/90 text-red-400 border border-red-800 rounded-full">
          HOSTILE THREAT
        </span>
      </div>

      {/* Battle Field (Player vs Monster Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Player Status Card */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                {character.avatar}
              </span>
              <div>
                <h3 className="font-bold text-stone-100 text-sm">{character.name}</h3>
                <p className="text-xs text-amber-400">Lvl {character.level} {character.classTitle}</p>
              </div>
            </div>
            <span className="text-xs text-stone-400 font-mono">Hero</span>
          </div>

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
            <div className="w-full bg-stone-900 rounded-full h-3 overflow-hidden border border-red-950">
              <div
                className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-300"
                style={{ width: `${characterHpPercent}%` }}
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
            <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-blue-950">
              <div
                className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full transition-all duration-300"
                style={{ width: `${(character.mp / character.maxMp) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Monster Card */}
        <div className="bg-stone-950/80 border border-red-900/60 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 bg-red-950/60 border border-red-700/60 rounded-lg">
                👹
              </span>
              <div>
                <h3 className="font-bold text-red-200 text-sm">{monster.name}</h3>
                <p className="text-xs text-stone-400 line-clamp-1">{monster.description}</p>
              </div>
            </div>
            <span className="text-xs text-red-400 font-mono">Enemy</span>
          </div>

          {/* Monster HP Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-red-400 flex items-center gap-1">
                <Skull className="w-3.5 h-3.5 text-red-400" /> Enemy Health
              </span>
              <span className="text-red-300 font-mono text-[11px]">
                {Math.max(0, monster.hp)} / {monster.maxHp}
              </span>
            </div>
            <div className="w-full bg-stone-900 rounded-full h-3 overflow-hidden border border-red-950">
              <div
                className="bg-gradient-to-r from-red-700 via-red-500 to-amber-500 h-full transition-all duration-300"
                style={{ width: `${monsterHpPercent}%` }}
              />
            </div>
          </div>

          {/* Monster Stats preview */}
          <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-800/80">
            <span>Atk: <strong className="text-red-300">{monster.attack}</strong></span>
            <span>Def: <strong className="text-stone-300">{monster.defense}</strong></span>
            {monster.specialMove && (
              <span className="text-amber-400 font-medium truncate max-w-[130px]">
                ⚡ {monster.specialMove}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Combat Log */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
        {combatLog.length === 0 ? (
          <p className="text-stone-500 italic text-center py-2">
            The tension mounts. Choose your first tactical move!
          </p>
        ) : (
          combatLog.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-stone-300">
              <span className="text-amber-500 font-bold">›</span>
              <span className="leading-relaxed">{log}</span>
            </div>
          ))
        )}
        {isResolving && (
          <div className="flex items-center gap-2 text-amber-300 animate-pulse">
            <Bot className="w-4 h-4 animate-spin" />
            <span>MIKI is resolving the turn clash...</span>
          </div>
        )}
      </div>

      {/* Victory / Defeat Overlays */}
      {isMonsterDead && (
        <div className="bg-amber-950/50 border border-amber-500/60 rounded-xl p-4 text-center space-y-3 animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-lg">
            <Trophy className="w-6 h-6 animate-bounce" />
            <span>VICTORY ACHIEVED!</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-300">
            You defeated <strong>{monster.name}</strong>! Earned <strong>+{monster.xpReward} XP</strong> and <strong>+{monster.goldReward} Gold</strong>!
          </p>
          <button
            id="claim-victory-btn"
            onClick={() => onVictory(monster)}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-5 py-2 rounded-xl text-sm transition cursor-pointer shadow-lg active:scale-95"
          >
            Claim Spoils & Continue Adventure
          </button>
        </div>
      )}

      {isPlayerDead && (
        <div className="bg-red-950/60 border border-red-700 rounded-xl p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-lg">
            <Skull className="w-6 h-6" />
            <span>YOU HAVE FALLEN IN BATTLE</span>
          </div>
          <p className="text-xs text-stone-300">
            MIKI manages to drag your unconscious body back to the safety of the Haven camp.
          </p>
          <button
            onClick={onFlee}
            className="bg-red-700 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl text-sm transition cursor-pointer"
          >
            Revive at Haven Camp
          </button>
        </div>
      )}

      {/* Action Command Controls */}
      {!isMonsterDead && !isPlayerDead && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Attack Button */}
            <button
              id="combat-attack-btn"
              onClick={handleStandardAttack}
              disabled={isResolving}
              className="flex flex-col items-center justify-center gap-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-700/60 p-3 rounded-xl text-red-200 transition cursor-pointer disabled:opacity-50 active:scale-95 shadow"
            >
              <Swords className="w-5 h-5 text-red-400" />
              <span className="font-bold text-xs">Attack</span>
              <span className="text-[10px] text-stone-400">Weapon strike</span>
            </button>

            {/* Spell Button */}
            <button
              id="combat-spell-btn"
              onClick={handleCastSpell}
              disabled={isResolving || character.mp < 15}
              className="flex flex-col items-center justify-center gap-1.5 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/60 p-3 rounded-xl text-blue-200 transition cursor-pointer disabled:opacity-50 active:scale-95 shadow"
            >
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-xs">Arcane Blast</span>
              <span className="text-[10px] text-blue-300/80">15 MP Cost</span>
            </button>

            {/* Item Button */}
            <button
              id="combat-item-btn"
              onClick={() => setShowItemPicker(!showItemPicker)}
              disabled={isResolving || usableCombatItems.length === 0}
              className="flex flex-col items-center justify-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 p-3 rounded-xl text-emerald-200 transition cursor-pointer disabled:opacity-50 active:scale-95 shadow"
            >
              <HeartPulse className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-xs">Use Item</span>
              <span className="text-[10px] text-stone-400">
                {usableCombatItems.length} Potions
              </span>
            </button>

            {/* Defend / Flee */}
            <button
              id="combat-defend-btn"
              onClick={handleDefend}
              disabled={isResolving}
              className="flex flex-col items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 p-3 rounded-xl text-stone-200 transition cursor-pointer disabled:opacity-50 active:scale-95 shadow"
            >
              <Shield className="w-5 h-5 text-stone-300" />
              <span className="font-bold text-xs">Guard / Parry</span>
              <span className="text-[10px] text-stone-400">-60% Dmg + MP</span>
            </button>
          </div>

          {/* Item Quick Drawer */}
          {showItemPicker && usableCombatItems.length > 0 && (
            <div className="mt-3 p-3 bg-stone-950 border border-emerald-800/60 rounded-xl space-y-2 animate-fade-in">
              <div className="flex justify-between items-center text-xs font-semibold text-emerald-400">
                <span>Select Potion to Consume:</span>
                <button
                  onClick={() => setShowItemPicker(false)}
                  className="text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {usableCombatItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onUseItemInCombat(item);
                      setShowItemPicker(false);
                    }}
                    className="flex items-center justify-between p-2 bg-stone-900 hover:bg-emerald-950 border border-stone-800 hover:border-emerald-600 rounded-lg text-xs text-left cursor-pointer transition"
                  >
                    <div>
                      <div className="font-medium text-stone-200">{item.name}</div>
                      <div className="text-[10px] text-emerald-400">
                        {item.healHp ? `+${item.healHp} HP ` : ''}
                        {item.healMp ? `+${item.healMp} MP` : ''}
                      </div>
                    </div>
                    <span className="text-emerald-400 text-xs font-bold">Use</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Flee Retreat option */}
          <div className="mt-3 text-center">
            <button
              id="combat-flee-btn"
              onClick={handleParleyOrFlee}
              disabled={isResolving}
              className="text-xs text-stone-400 hover:text-red-400 transition cursor-pointer inline-flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Attempt to Escape (D20 Check)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

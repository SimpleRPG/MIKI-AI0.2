import React, { useState } from 'react';
import { UserPlus, Sparkles, X, Swords } from 'lucide-react';
import { Character } from '../types/rpg';
import { CHARACTER_PRESETS, STARTER_ITEMS } from '../data/initialState';

interface CharacterCreationModalProps {
  onClose: () => void;
  onCreateCharacter: (newChar: Character) => void;
}

const AVATAR_OPTIONS = ['⚔️', '🔮', '🗡️', '🛡️', '🏹', '🧝', '🧙', '🐉', '🤖', '🥷'];

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({
  onClose,
  onCreateCharacter
}) => {
  const [name, setName] = useState('Aiden Starweaver');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [selectedAvatar, setSelectedAvatar] = useState('⚔️');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const preset = CHARACTER_PRESETS[selectedPresetIdx];
    const newCharacter: Character = {
      id: 'char-' + Date.now(),
      name: name.trim(),
      classTitle: preset.classTitle,
      avatar: selectedAvatar,
      level: 1,
      xp: 0,
      maxXp: 100,
      hp: 80,
      maxHp: 80,
      mp: 40,
      maxMp: 40,
      gold: 50,
      stats: { ...preset.stats },
      availableStatPoints: 0,
      weapon: STARTER_ITEMS[0],
      armor: STARTER_ITEMS[1],
      accessory: STARTER_ITEMS[4],
      inventory: [
        STARTER_ITEMS[2],
        STARTER_ITEMS[2],
        STARTER_ITEMS[3]
      ]
    };

    onCreateCharacter(newCharacter);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <UserPlus className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-amber-300 text-base">Forge New Adventurer</h2>
              <p className="text-xs text-stone-400">Begin a fresh chronicle with MIKI AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Hero Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 outline-none"
              placeholder="e.g. Lyra Sunstrider"
            />
          </div>

          {/* Avatar Icon Picker */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Avatar Crest
            </label>
            <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-stone-950 border border-stone-800 rounded-xl">
              {AVATAR_OPTIONS.map((av, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedAvatar(av)}
                  className={`text-xl p-2 rounded-lg transition cursor-pointer shrink-0 ${
                    selectedAvatar === av
                      ? 'bg-amber-500/20 border border-amber-500 scale-110'
                      : 'hover:bg-stone-800 border border-transparent'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Class Preset Options */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Choose Archetype Class
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CHARACTER_PRESETS.map((preset, idx) => {
                const isSelected = selectedPresetIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedPresetIdx(idx);
                      setSelectedAvatar(preset.avatar);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-950/30 border-amber-500 text-stone-100 shadow'
                        : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{preset.avatar}</span>
                        <h4 className="font-bold text-xs text-amber-300">{preset.classTitle}</h4>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-snug">{preset.description}</p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-2 mt-2 border-t border-stone-800/80">
                      <span>STR {preset.stats.strength}</span>
                      <span>DEX {preset.stats.dexterity}</span>
                      <span>INT {preset.stats.intelligence}</span>
                      <span>DEF {preset.stats.defense}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              <span>Embark as {name || 'Hero'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

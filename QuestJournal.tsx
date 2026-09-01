import React, { useState } from 'react';
import { 
  Scroll, 
  CheckCircle2, 
  Circle, 
  Coins, 
  Award, 
  Sparkles, 
  Wand2, 
  Bot, 
  X,
  Target,
  Swords
} from 'lucide-react';
import { Quest, Character } from '../types/rpg';

interface QuestJournalProps {
  quests: Quest[];
  character: Character;
  onClose: () => void;
  onGenerateQuest: (setting: string, difficulty: string) => Promise<void>;
  onCompleteObjective: (questId: string, objId: string) => void;
  isGenerating: boolean;
}

export const QuestJournal: React.FC<QuestJournalProps> = ({
  quests,
  character,
  onClose,
  onGenerateQuest,
  onCompleteObjective,
  isGenerating
}) => {
  const [selectedSetting, setSelectedSetting] = useState('High Fantasy Realm');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [showGenerator, setShowGenerator] = useState(false);

  const handleGenerate = async () => {
    await onGenerateQuest(selectedSetting, selectedDifficulty);
    setShowGenerator(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Scroll className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-amber-300 text-base">Quest Chronicles & Bounties</h2>
              <p className="text-xs text-stone-400">Manage ongoing tasks and AI-generated contracts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* AI Generator Toggle Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 to-stone-950 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-xs sm:text-sm text-amber-200">
                  Commission Dynamic AI Quest from MIKI
                </h3>
                <p className="text-[11px] text-stone-400">
                  Generate tailored challenges, objectives, and boss encounters for Level {character.level}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGenerator(!showGenerator)}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0"
            >
              {showGenerator ? 'Close Tool' : 'New Quest'}
            </button>
          </div>

          {/* AI Generation Form */}
          {showGenerator && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-400 mb-1 font-medium">World Theme / Setting</label>
                  <select
                    value={selectedSetting}
                    onChange={(e) => setSelectedSetting(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-200 outline-none focus:border-amber-500"
                  >
                    <option value="High Fantasy Realm">High Fantasy & Ancient Magic</option>
                    <option value="Dark Eldritch Crypts">Dark Eldritch & Lovecraftian Crypts</option>
                    <option value="Cyber-Arcane Undercity">Cyber-Arcane Neon Undercity</option>
                    <option value="Celestial Void Citadel">Celestial Void & Astral Citadel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1 font-medium">Encounter Difficulty</label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-200 outline-none focus:border-amber-500"
                  >
                    <option value="Easy">Easy (Skirmish)</option>
                    <option value="Medium">Medium (Balanced)</option>
                    <option value="Hard">Hard (Deadly Trials)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Bot className="w-4 h-4 animate-spin" />
                    <span>MIKI is forging the questline...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate & Accept Quest</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quests List */}
          <div className="space-y-3">
            {quests.length === 0 ? (
              <p className="text-stone-500 text-center py-6 text-xs italic">
                Your quest journal is currently empty. Ask MIKI for a new bounty!
              </p>
            ) : (
              quests.map((quest) => (
                <div
                  key={quest.id}
                  className={`bg-stone-950/80 border rounded-xl p-4 transition space-y-3 ${
                    quest.completed
                      ? 'border-emerald-700/50 bg-emerald-950/10'
                      : 'border-stone-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-stone-100 text-sm">{quest.title}</h4>
                        {quest.completed && (
                          <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-600">
                            COMPLETED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{quest.synopsis}</p>
                    </div>
                    <span className="text-[11px] text-amber-400 font-mono bg-stone-900 px-2 py-1 rounded border border-stone-800">
                      {quest.location}
                    </span>
                  </div>

                  {/* Objectives Checklist */}
                  <div className="space-y-1.5 bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80">
                    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                      Key Objectives
                    </span>
                    {quest.objectives.map((obj) => (
                      <div
                        key={obj.id}
                        onClick={() => onCompleteObjective(quest.id, obj.id)}
                        className="flex items-center gap-2 text-xs text-stone-300 hover:text-stone-100 cursor-pointer py-0.5"
                      >
                        {obj.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-stone-500 shrink-0 hover:text-amber-400" />
                        )}
                        <span className={obj.completed ? 'line-through text-stone-500' : ''}>
                          {obj.desc}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Rewards Footer */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-800/80 text-stone-400 flex-wrap gap-2">
                    <span className="font-medium text-stone-400">Bounty Rewards:</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-amber-400 font-semibold font-mono">
                        <Coins className="w-3.5 h-3.5" /> +{quest.rewardGold} Gold
                      </span>
                      <span className="flex items-center gap-1 text-blue-400 font-semibold font-mono">
                        <Award className="w-3.5 h-3.5" /> +{quest.rewardXp} XP
                      </span>
                      {quest.rewardItem && (
                        <span className="flex items-center gap-1 text-purple-400 font-medium">
                          ✨ {quest.rewardItem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

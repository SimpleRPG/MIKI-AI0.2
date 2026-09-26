import React from 'react';
import { 
  Compass, 
  Backpack, 
  Scroll, 
  MapPin, 
  Coins, 
  Sparkles, 
  UserPlus, 
  Volume2, 
  VolumeX,
  Bot
} from 'lucide-react';
import { Character, WorldLocation } from '../types/rpg';

interface NavbarProps {
  character: Character;
  worldLocation: WorldLocation;
  onOpenInventory: () => void;
  onOpenQuests: () => void;
  onOpenMap: () => void;
  onOpenCompanion: () => void;
  onNewCharacter: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  character,
  worldLocation,
  onOpenInventory,
  onOpenQuests,
  onOpenMap,
  onOpenCompanion,
  onNewCharacter,
  soundEnabled,
  onToggleSound,
  hasApiKey
}) => {
  return (
    <header className="sticky top-0 z-30 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 shadow-lg px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Location */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg shadow-inner">
              🧙‍♀️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-amber-400 tracking-wide text-base sm:text-lg flex items-center gap-1.5">
                  MIKI AI
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    RPG Master
                  </span>
                </h1>
                {hasApiKey ? (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" /> Gemini Live
                  </span>
                ) : (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-stone-400 bg-stone-800 border border-stone-700 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" /> Built-in AI
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span className="font-medium text-stone-300">{worldLocation.name}</span>
                <span className="text-[10px] text-amber-500/90">({worldLocation.dangerLevel})</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Gold Display */}
          <div className="flex items-center gap-1.5 bg-stone-950/80 border border-amber-500/30 px-3 py-1.5 rounded-lg text-amber-400 font-semibold text-xs sm:text-sm shadow-sm">
            <Coins className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{character.gold}</span>
            <span className="text-[10px] text-amber-500/70 uppercase">Gold</span>
          </div>

          {/* Quests Button */}
          <button
            id="nav-quests-btn"
            onClick={onOpenQuests}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50 px-3 py-1.5 rounded-lg text-stone-200 hover:text-amber-300 text-xs sm:text-sm font-medium transition cursor-pointer active:scale-95"
            title="Open Quest Log"
          >
            <Scroll className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Quests</span>
          </button>

          {/* Map Button */}
          <button
            id="nav-map-btn"
            onClick={onOpenMap}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50 px-3 py-1.5 rounded-lg text-stone-200 hover:text-amber-300 text-xs sm:text-sm font-medium transition cursor-pointer active:scale-95"
            title="Open World Map"
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">World Map</span>
          </button>

          {/* Inventory Button */}
          <button
            id="nav-inventory-btn"
            onClick={onOpenInventory}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50 px-3 py-1.5 rounded-lg text-stone-200 hover:text-amber-300 text-xs sm:text-sm font-medium transition cursor-pointer active:scale-95"
            title="Open Inventory & Shop"
          >
            <Backpack className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Inventory</span>
            <span className="text-[10px] bg-stone-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              {character.inventory.length}
            </span>
          </button>

          {/* Companion Chat */}
          <button
            id="nav-companion-btn"
            onClick={onOpenCompanion}
            className="flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 px-3 py-1.5 rounded-lg text-amber-300 text-xs sm:text-sm font-medium transition cursor-pointer active:scale-95"
            title="Chat directly with MIKI Companion"
          >
            <Bot className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Ask MIKI</span>
          </button>

          {/* Sound Toggle */}
          <button
            id="nav-sound-toggle"
            onClick={onToggleSound}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-400 hover:text-amber-300 transition cursor-pointer"
            title={soundEnabled ? "Mute SFX" : "Enable SFX"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* New Character */}
          <button
            id="nav-new-char-btn"
            onClick={onNewCharacter}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-400 hover:text-amber-300 transition cursor-pointer"
            title="Create New Character"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

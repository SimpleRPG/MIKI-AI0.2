import React from 'react';
import { Compass, MapPin, X, AlertTriangle, ShieldCheck, Flame, Trees, Castle, Home } from 'lucide-react';
import { WorldLocation } from '../types/rpg';
import { WORLD_LOCATIONS } from '../data/initialState';

interface WorldMapModalProps {
  currentLocation: WorldLocation;
  onClose: () => void;
  onSelectLocation: (loc: WorldLocation) => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  currentLocation,
  onClose,
  onSelectLocation
}) => {
  const getLocationIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home': return <Home className="w-6 h-6 text-amber-400" />;
      case 'Trees': return <Trees className="w-6 h-6 text-emerald-400" />;
      case 'Castle': return <Castle className="w-6 h-6 text-cyan-400" />;
      case 'Flame': return <Flame className="w-6 h-6 text-red-500" />;
      default: return <MapPin className="w-6 h-6 text-amber-400" />;
    }
  };

  const getDangerBadge = (level: WorldLocation['dangerLevel']) => {
    switch (level) {
      case 'Safe':
        return 'bg-emerald-950 text-emerald-400 border-emerald-700';
      case 'Moderate':
        return 'bg-yellow-950 text-yellow-400 border-yellow-700';
      case 'Dangerous':
        return 'bg-orange-950 text-orange-400 border-orange-700';
      case 'Deadly':
        return 'bg-red-950 text-red-400 border-red-700 animate-pulse';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-amber-300 text-base">Realm Cartography & Fast Travel</h2>
              <p className="text-xs text-stone-400">Select an outpost or dungeon sector to venture towards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locations List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1">
          {WORLD_LOCATIONS.map((loc) => {
            const isCurrent = loc.id === currentLocation.id;
            return (
              <div
                key={loc.id}
                className={`bg-stone-950 border rounded-xl p-4 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-amber-500/80 bg-amber-950/15 shadow-md'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-stone-900 border border-stone-800 rounded-xl shrink-0">
                    {getLocationIcon(loc.icon)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-stone-100">{loc.name}</h3>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${getDangerBadge(loc.dangerLevel)}`}>
                        {loc.dangerLevel} Threat
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono bg-stone-900 px-1.5 py-0.5 rounded">
                        {loc.biome}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed max-w-md">
                      {loc.description}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex justify-end">
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Current Location
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer active:scale-95 shadow"
                    >
                      Travel Here
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

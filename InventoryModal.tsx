import React, { useState } from 'react';
import { 
  Backpack, 
  Store, 
  X, 
  Coins, 
  Shield, 
  Sword, 
  Heart, 
  Sparkles, 
  Flame, 
  Wand, 
  ShieldCheck, 
  HeartPulse,
  Trash2
} from 'lucide-react';
import { Character, Item } from '../types/rpg';
import { SHOP_ITEMS } from '../data/initialState';

interface InventoryModalProps {
  character: Character;
  onClose: () => void;
  onEquipItem: (item: Item) => void;
  onUnequipItem: (slot: 'weapon' | 'armor' | 'accessory') => void;
  onUsePotion: (item: Item) => void;
  onBuyItem: (item: Item) => void;
  onSellItem: (item: Item) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  character,
  onClose,
  onEquipItem,
  onUnequipItem,
  onUsePotion,
  onBuyItem,
  onSellItem
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'shop'>('inventory');

  const renderItemIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sword': return <Sword className="w-5 h-5 text-red-400" />;
      case 'Shield': return <Shield className="w-5 h-5 text-cyan-400" />;
      case 'Heart': return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
      case 'HeartPulse': return <HeartPulse className="w-5 h-5 text-rose-400" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'Flame': return <Flame className="w-5 h-5 text-amber-500" />;
      case 'Wand': return <Wand className="w-5 h-5 text-blue-400" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      default: return <Sparkles className="w-5 h-5 text-stone-400" />;
    }
  };

  const getRarityBadge = (rarity: Item['rarity']) => {
    switch (rarity) {
      case 'common': return 'border-stone-700 text-stone-400';
      case 'uncommon': return 'border-emerald-700 text-emerald-400 bg-emerald-950/30';
      case 'rare': return 'border-blue-700 text-blue-400 bg-blue-950/30';
      case 'epic': return 'border-purple-700 text-purple-400 bg-purple-950/30';
      case 'legendary': return 'border-amber-500 text-amber-400 bg-amber-950/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 bg-stone-900 p-1 rounded-xl border border-stone-800">
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-amber-600 text-stone-950 shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Backpack className="w-4 h-4" />
                <span>Backpack & Equipment</span>
              </button>
              <button
                onClick={() => setActiveTab('shop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'shop'
                    ? 'bg-amber-600 text-stone-950 shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Haven Merchant Shop</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-stone-950 px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-400 font-mono text-xs font-bold">
              <Coins className="w-3.5 h-3.5" />
              <span>{character.gold} Gold</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'inventory' ? (
            <>
              {/* Equipped Slots Grid */}
              <div>
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  Active Equipped Gear
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Weapon Slot */}
                  <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-red-950/60 border border-red-800/40 rounded-lg">
                        <Sword className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-500 uppercase font-semibold">Weapon</div>
                        <div className="text-xs font-bold text-stone-200 truncate">
                          {character.weapon ? character.weapon.name : 'Empty Slot'}
                        </div>
                        {character.weapon && (
                          <div className="text-[10px] text-amber-400 font-mono">
                            Power +{character.weapon.power}
                          </div>
                        )}
                      </div>
                    </div>
                    {character.weapon && (
                      <button
                        onClick={() => onUnequipItem('weapon')}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 bg-stone-900 border border-stone-800 rounded cursor-pointer"
                      >
                        Unequip
                      </button>
                    )}
                  </div>

                  {/* Armor Slot */}
                  <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-cyan-950/60 border border-cyan-800/40 rounded-lg">
                        <Shield className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-500 uppercase font-semibold">Armor</div>
                        <div className="text-xs font-bold text-stone-200 truncate">
                          {character.armor ? character.armor.name : 'Empty Slot'}
                        </div>
                        {character.armor && (
                          <div className="text-[10px] text-cyan-400 font-mono">
                            Def +{character.armor.defense}
                          </div>
                        )}
                      </div>
                    </div>
                    {character.armor && (
                      <button
                        onClick={() => onUnequipItem('armor')}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 bg-stone-900 border border-stone-800 rounded cursor-pointer"
                      >
                        Unequip
                      </button>
                    )}
                  </div>

                  {/* Accessory Slot */}
                  <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-lg">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-500 uppercase font-semibold">Relic / Accessory</div>
                        <div className="text-xs font-bold text-stone-200 truncate">
                          {character.accessory ? character.accessory.name : 'Empty Slot'}
                        </div>
                        {character.accessory && (
                          <div className="text-[10px] text-purple-400 font-mono">
                            Def +{character.accessory.defense}
                          </div>
                        )}
                      </div>
                    </div>
                    {character.accessory && (
                      <button
                        onClick={() => onUnequipItem('accessory')}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 bg-stone-900 border border-stone-800 rounded cursor-pointer"
                      >
                        Unequip
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Backpack Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    Backpack Inventory ({character.inventory.length} Items)
                  </h3>
                  <span className="text-[11px] text-stone-500">Sell price is 50% value</span>
                </div>

                {character.inventory.length === 0 ? (
                  <div className="bg-stone-950/40 border border-dashed border-stone-800 rounded-xl p-8 text-center text-xs text-stone-500">
                    Your backpack is empty. Defeat monsters, complete quests, or visit the shop!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {character.inventory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-stone-950 border rounded-xl p-3 flex flex-col justify-between gap-2.5 ${getRarityBadge(item.rarity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-stone-900 border border-stone-800 rounded-lg shrink-0">
                            {renderItemIcon(item.icon)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-xs text-stone-100 truncate">{item.name}</h4>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border border-stone-700 text-stone-400">
                                {item.type}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">{item.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                              {item.power && <span className="text-amber-400">Power: +{item.power}</span>}
                              {item.defense && <span className="text-cyan-400">Defense: +{item.defense}</span>}
                              {item.healHp && <span className="text-rose-400">Heal: +{item.healHp} HP</span>}
                              {item.healMp && <span className="text-blue-400">Restore: +{item.healMp} MP</span>}
                            </div>
                          </div>
                        </div>

                        {/* Item action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-stone-800/80">
                          <span className="text-[11px] text-amber-400 font-mono font-medium">
                            {item.value} Gold
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.type === 'consumable' ? (
                              <button
                                onClick={() => onUsePotion(item)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold px-3 py-1 rounded-lg text-xs transition cursor-pointer"
                              >
                                Drink
                              </button>
                            ) : (
                              <button
                                onClick={() => onEquipItem(item)}
                                className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-3 py-1 rounded-lg text-xs transition cursor-pointer"
                              >
                                Equip
                              </button>
                            )}
                            <button
                              onClick={() => onSellItem(item)}
                              className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded-lg text-xs transition cursor-pointer"
                              title="Sell item for 50% gold"
                            >
                              Sell (+{Math.floor(item.value / 2)})
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Haven Merchant Shop View */
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
                Welcome, brave adventurer! Browse mastercrafted arms, armor, and enchanted potions.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SHOP_ITEMS.map((item) => {
                  const canAfford = character.gold >= item.value;
                  return (
                    <div
                      key={item.id}
                      className={`bg-stone-950 border rounded-xl p-3 flex flex-col justify-between gap-2.5 ${getRarityBadge(item.rarity)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-stone-900 border border-stone-800 rounded-lg shrink-0">
                          {renderItemIcon(item.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-stone-100 truncate">{item.name}</h4>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border border-stone-700 text-stone-400">
                              {item.rarity}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">{item.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                            {item.power && <span className="text-amber-400">Power: +{item.power}</span>}
                            {item.defense && <span className="text-cyan-400">Defense: +{item.defense}</span>}
                            {item.healHp && <span className="text-rose-400">Heal: +{item.healHp} HP</span>}
                            {item.healMp && <span className="text-blue-400">Restore: +{item.healMp} MP</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-800/80">
                        <span className="text-xs text-amber-400 font-mono font-bold">
                          {item.value} Gold
                        </span>
                        <button
                          onClick={() => onBuyItem(item)}
                          disabled={!canAfford}
                          className="bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-bold px-3 py-1 rounded-lg text-xs transition cursor-pointer disabled:cursor-not-allowed disabled:text-stone-600"
                        >
                          {canAfford ? 'Purchase' : 'Need Gold'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

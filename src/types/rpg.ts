/**
 * SimpleRPG Type Definitions
 */

export interface CharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  charisma: number;
  defense: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'accessory';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  value: number;
  power?: number;
  defense?: number;
  healHp?: number;
  healMp?: number;
  icon?: string;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  specialMove: string;
  description: string;
  xpReward: number;
  goldReward: number;
  icon?: string;
}

export interface QuestObjective {
  id: string;
  desc: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  desc: string;
  locationId: string;
  rewardXp: number;
  rewardGold: number;
  boss?: Monster;
  objectives: QuestObjective[];
  completed: boolean;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  dangerLevel: 'Safe' | 'Moderate' | 'Dangerous' | 'Deadly';
  biome: string;
  icon: string;
}

export interface Character {
  id: string;
  name: string;
  classTitle: string;
  avatar: string;
  level: number;
  xp: number;
  maxXp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  stats: CharacterStats;
  availableStatPoints: number;
  weapon?: Item;
  armor?: Item;
  accessory?: Item;
  inventory: Item[];
}

export interface StoryEntry {
  id: string;
  timestamp: number;
  text: string;
  type?: 'system' | 'combat' | 'dialogue' | 'exploration' | string;
  speaker?: string;
}

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
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'quest';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  value: number;
  power?: number;
  defense?: number;
  healHp?: number;
  healMp?: number;
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
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
  inventory: Item[];
}

export interface Monster {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  specialMove?: string;
  description: string;
  xpReward: number;
  goldReward: number;
  lootDrop?: Item;
}

export interface QuestObjective {
  id: string;
  desc: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  synopsis: string;
  location: string;
  rewardGold: number;
  rewardXp: number;
  rewardItem?: string;
  boss?: Monster;
  objectives: QuestObjective[];
  completed: boolean;
}

export interface StoryEntry {
  id: string;
  speaker: 'miki' | 'player' | 'system' | 'monster';
  text: string;
  timestamp: string;
  rollResult?: {
    dice: number;
    mod: number;
    total: number;
    isCrit?: boolean;
    isFail?: boolean;
  };
  mikiComment?: string;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  dangerLevel: 'Safe' | 'Moderate' | 'Dangerous' | 'Deadly';
  biome: string;
  icon: string;
}

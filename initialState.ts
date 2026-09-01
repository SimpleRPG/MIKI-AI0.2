import { Character, Item, WorldLocation, Quest } from '../types/rpg';

export const STARTER_ITEMS: Item[] = [
  {
    id: 'wpn-iron-sword',
    name: 'Iron Broadsword',
    type: 'weapon',
    rarity: 'common',
    description: 'A reliable steel blade forged with balance and precision.',
    value: 25,
    power: 8,
    icon: 'Sword'
  },
  {
    id: 'arm-leather-tunic',
    name: 'Reinforced Leather Jerkin',
    type: 'armor',
    rarity: 'common',
    description: 'Treated boiled leather that absorbs blunt impacts.',
    value: 20,
    defense: 6,
    icon: 'Shield'
  },
  {
    id: 'pot-health-1',
    name: 'Minor Health Draught',
    type: 'consumable',
    rarity: 'common',
    description: 'A crimson tincture that restores 35 Hit Points.',
    value: 15,
    healHp: 35,
    icon: 'Heart'
  },
  {
    id: 'pot-mana-1',
    name: 'Glinting Mana Flask',
    type: 'consumable',
    rarity: 'common',
    description: 'Liquid starlight that restores 30 Mana Points.',
    value: 15,
    healMp: 30,
    icon: 'Sparkles'
  },
  {
    id: 'acc-silver-ring',
    name: 'Ring of Minor Warding',
    type: 'accessory',
    rarity: 'uncommon',
    description: 'Inscribed with protective glyphs. Boosts Defense by 2.',
    value: 40,
    defense: 2,
    icon: 'Sparkles'
  }
];

export const SHOP_ITEMS: Item[] = [
  ...STARTER_ITEMS,
  {
    id: 'wpn-flame-blade',
    name: 'Flamebrand Longsword',
    type: 'weapon',
    rarity: 'rare',
    description: 'Crackles with residual elemental embers. Deals heavy physical & burn damage.',
    value: 120,
    power: 18,
    icon: 'Flame'
  },
  {
    id: 'wpn-arcane-staff',
    name: 'Staff of the Arch-Mage',
    type: 'weapon',
    rarity: 'rare',
    description: 'Carved from an ancient elderwood bough, pulsing with arcane resonance.',
    value: 135,
    power: 20,
    icon: 'Wand'
  },
  {
    id: 'arm-mithril-plate',
    name: 'Mithril Aegis Cuirass',
    type: 'armor',
    rarity: 'epic',
    description: 'Featherlight dwarven craft boasting impenetrable warding.',
    value: 200,
    defense: 16,
    icon: 'ShieldCheck'
  },
  {
    id: 'pot-great-health',
    name: 'Elixir of Rejuvenation',
    type: 'consumable',
    rarity: 'uncommon',
    description: 'Completely cures wounds, restoring 80 HP.',
    value: 45,
    healHp: 80,
    icon: 'HeartPulse'
  }
];

export const WORLD_LOCATIONS: WorldLocation[] = [
  {
    id: 'loc-oakvale',
    name: 'Oakvale Crossroads & Haven',
    description: 'A cozy frontier encampment sheltered by colossal ancient oak trees. Merchants and mercenaries gather here.',
    dangerLevel: 'Safe',
    biome: 'Town / Frontier',
    icon: 'Home'
  },
  {
    id: 'loc-whispering-woods',
    name: 'The Whispering Forest',
    description: 'Enchanted woods wrapped in persistent silver mist. Rumors tell of restless spirits and goblin raiders.',
    dangerLevel: 'Moderate',
    biome: 'Mystic Forest',
    icon: 'Trees'
  },
  {
    id: 'loc-sunken-spire',
    name: 'Sunken Ruins of Aethelgard',
    description: 'Flooded marble colonnades and subterranean crypts holding forgotten forbidden sorcery.',
    dangerLevel: 'Dangerous',
    biome: 'Ancient Ruins',
    icon: 'Castle'
  },
  {
    id: 'loc-dragons-peak',
    name: 'Dragoncrest Precipice',
    description: 'A jagged volcanic spire where magma drakes nest among superheated basalt crags.',
    dangerLevel: 'Deadly',
    biome: 'Volcanic Mountain',
    icon: 'Flame'
  }
];

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'quest-goblin-raiders',
    title: 'Cleansing the Whispering Forest',
    synopsis: 'Goblin marauders led by an aggressive Chieftain have blocked the merchant caravan trail through the woods.',
    location: 'The Whispering Forest',
    rewardGold: 100,
    rewardXp: 180,
    rewardItem: 'Ranger Scout Boots',
    boss: {
      name: 'Goblin Chieftain Skarrak',
      hp: 65,
      maxHp: 65,
      attack: 15,
      defense: 5,
      specialMove: 'Crushing Club Slam',
      description: 'A hulking brute adorned in scavenged armor plates.',
      xpReward: 120,
      goldReward: 60
    },
    objectives: [
      { id: 'obj-1', desc: 'Track the goblin scout tracks near the stream', completed: true },
      { id: 'obj-2', desc: 'Rescue the trapped caravan merchant', completed: false },
      { id: 'obj-3', desc: 'Defeat Goblin Chieftain Skarrak', completed: false }
    ],
    completed: false
  }
];

export const DEFAULT_CHARACTER: Character = {
  id: 'hero-1',
  name: 'Valen Shadowstride',
  classTitle: 'Spellblade Adventurer',
  avatar: '⚔️',
  level: 1,
  xp: 40,
  maxXp: 100,
  hp: 75,
  maxHp: 75,
  mp: 40,
  maxMp: 40,
  gold: 85,
  stats: {
    strength: 14,
    dexterity: 13,
    intelligence: 12,
    charisma: 11,
    defense: 8
  },
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

export const CHARACTER_PRESETS = [
  {
    classTitle: 'Spellblade Adventurer',
    avatar: '⚔️',
    description: 'Balances swift martial strikes with versatile elemental spells.',
    stats: { strength: 14, dexterity: 13, intelligence: 12, charisma: 11, defense: 8 }
  },
  {
    classTitle: 'Arcane Elementalist',
    avatar: '🔮',
    description: 'Master of cataclysmic spellcraft, shielding barriers, and ancient lore.',
    stats: { strength: 8, dexterity: 10, intelligence: 18, charisma: 12, defense: 5 }
  },
  {
    classTitle: 'Shadow Assassin',
    avatar: '🗡️',
    description: 'A lethal rogue utilizing stealth, critical daggers, and evasive acrobatics.',
    stats: { strength: 11, dexterity: 18, intelligence: 10, charisma: 12, defense: 6 }
  },
  {
    classTitle: 'Holy Paladin Crusader',
    avatar: '🛡️',
    description: 'An unstoppable armored fortress wielding divine light and radiant healing.',
    stats: { strength: 16, dexterity: 9, intelligence: 10, charisma: 14, defense: 14 }
  }
];

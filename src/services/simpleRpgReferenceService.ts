import { storageService } from './storageService';

export interface SimpleRpgReferenceCapability {
  id: string;
  label: string;
  keywords: string[];
  sourceFiles: string[];
  executableInMiki: false;
}

const STORAGE_KEY = 'miki_simple_rpg_reference_usage_v61';

/**
 * SimpleRPGの旧実装を「実行コード」として取り込むのではなく、
 * 検証可能な参照資産として決定論的に索引化する。
 * 旧ゲームはブラウザwindow/global状態に依存するため、Miki本体へ直接importしない。
 */
const CAPABILITIES: SimpleRpgReferenceCapability[] = [
  { id: 'simple_rpg_combat', label: '戦闘・敵スキル', keywords: ['戦闘', 'バトル', '敵', 'スキル', 'combat'], sourceFiles: ['game-core-1.js', 'game-core-2.js', 'game-core-3.js', 'game-core-4.js', 'game-core-5.js', 'enemy-data.js', 'enemy-skills.js'], executableInMiki: false },
  { id: 'simple_rpg_gather', label: '採取・採取拠点', keywords: ['採取', '素材', '探索', 'gather'], sourceFiles: ['gather-data.js', 'gather-base.js', 'gather-equip-data.js', 'gather-stats-ui.js'], executableInMiki: false },
  { id: 'simple_rpg_craft', label: 'クラフト・料理', keywords: ['クラフト', '製作', '料理', '調合', 'craft', 'cook'], sourceFiles: ['craft-core.js', 'craft-actions.js', 'craft-data.js', 'craft-item-data.js', 'cook-data.js'], executableInMiki: false },
  { id: 'simple_rpg_equipment', label: '装備・強化・修理', keywords: ['装備', '強化', '修理', '武器', '防具'], sourceFiles: ['combat-equip-data.js', 'equip-api.js', 'equip-enhance.js', 'repair-core.js', 'equipment-prefix-data.js'], executableInMiki: false },
  { id: 'simple_rpg_farm_fishing', label: '農園・釣り', keywords: ['農園', '畑', '釣り', '魚', '肥料'], sourceFiles: ['farm-core.js', 'farm-seed-data.js', 'fertilizer-core.js', 'fish-data.js'], executableInMiki: false },
  { id: 'simple_rpg_pet', label: 'ペット', keywords: ['ペット', 'pet'], sourceFiles: ['pet.js', 'pet-equip-data.js', 'pet-ui.js'], executableInMiki: false },
  { id: 'simple_rpg_guild', label: 'ギルド・職業・スキル', keywords: ['ギルド', '職業', 'スキルツリー', 'guild', 'job'], sourceFiles: ['guild.js', 'guild2.js', 'guild-quests.js', 'guildskill.js', 'jobs.js', 'skill-core-1.js', 'skill-core-2.js', 'skilltree.js'], executableInMiki: false },
  { id: 'simple_rpg_market', label: '市場・売買', keywords: ['市場', 'マーケット', '売買', '買い注文', 'market'], sourceFiles: ['market-core.js', 'market-core1.js', 'market-core2.js', 'server.js'], executableInMiki: false },
  { id: 'simple_rpg_housing', label: '拠点・ハウジング', keywords: ['拠点', 'ハウジング', '家具', 'housing'], sourceFiles: ['housing-core.js', 'housing-furniture-data.js', 'housing-ui-grid.js'], executableInMiki: false },
  { id: 'simple_rpg_save', label: 'セーブ・状態永続化', keywords: ['セーブ', '保存', 'ロード', 'save', 'load'], sourceFiles: ['save-system.js'], executableInMiki: false },
  { id: 'simple_rpg_teto', label: 'テト自動テストプレイヤー', keywords: ['テト', '自動テスト', 'テストプレイヤー', 'teto'], sourceFiles: ['teto-ai.js', 'teto-ai2.js', 'teto-ai3.js', 'teto-ai4.js', 'teto-ai5.js'], executableInMiki: false },
];

class SimpleRpgReferenceService {
  public listCapabilities(): SimpleRpgReferenceCapability[] {
    return CAPABILITIES.map(c => ({ ...c, keywords: [...c.keywords], sourceFiles: [...c.sourceFiles] }));
  }

  public match(prompt: string): SimpleRpgReferenceCapability[] {
    const q = String(prompt || '').trim().toLowerCase();
    if (!q) return [];
    const ranked = CAPABILITIES.map(cap => {
      const score = cap.keywords.reduce((sum, keyword) => sum + (q.includes(keyword.toLowerCase()) ? 1 : 0), 0);
      return { cap, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.cap.id.localeCompare(b.cap.id));
    return ranked.map(x => x.cap);
  }

  public describeForPlanning(prompt: string): { matched: SimpleRpgReferenceCapability[]; note: string } {
    const matched = this.match(prompt);
    if (!matched.length) return { matched, note: 'SimpleRPG参照資産との明示的な対応はありません。' };
    return {
      matched,
      note: `SimpleRPGの既存実装を参照候補として特定しました（${matched.map(x => x.label).join(' / ')}）。ただし参照資産はMikiの実行部品へ自動昇格しません。`,
    };
  }

  public recordReferenceUse(capabilityIds: string[]): void {
    if (!capabilityIds.length) return;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
      for (const id of capabilityIds) counts[id] = (counts[id] || 0) + 1;
      storageService.setItem(STORAGE_KEY, JSON.stringify(counts));
    } catch {
      // 記録失敗は実行経路を壊さない。
    }
  }
}

export const simpleRpgReferenceService = new SimpleRpgReferenceService();

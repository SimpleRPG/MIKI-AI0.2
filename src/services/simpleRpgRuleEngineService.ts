import { Character, Item, Monster, Quest, WorldLocation } from '../types/rpg';
import { storageService } from './storageService';

export type RpgAction =
  | 'gather' | 'craft' | 'cook' | 'equip' | 'enhance' | 'repair'
  | 'farm' | 'fertilize' | 'fish' | 'pet' | 'guild' | 'job'
  | 'skill' | 'market_buy' | 'market_sell' | 'housing' | 'save' | 'load';

export interface RpgActionInput {
  action: RpgAction;
  character?: Partial<Character>;
  item?: Partial<Item>;
  quantity?: number;
  value?: number;
  target?: string;
  slot?: 'weapon' | 'armor' | 'accessory';
  seed?: number;
}

export interface RpgActionResult {
  ok: boolean;
  action: RpgAction;
  message: string;
  character?: Character;
  state?: Record<string, unknown>;
  changes: Record<string, number | string | boolean>;
}

const SAVE_KEY = 'miki_deterministic_rpg_state_v63';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

function hash(raw: string): number {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function deterministicRoll(seed: number | undefined, key: string, max: number): number {
  return hash(`${seed ?? 0}|${key}`) % Math.max(1, max);
}

function normalizeCharacter(input?: Partial<Character>): Character {
  const c = input || {};
  const stats = c.stats || { strength: 10, dexterity: 10, intelligence: 10, charisma: 10, defense: 5 };
  return {
    id: c.id || 'player', name: c.name || '冒険者', classTitle: c.classTitle || '冒険者', avatar: c.avatar || '',
    level: num(c.level, 1), xp: num(c.xp), maxXp: num(c.maxXp, 100), hp: num(c.hp, 100), maxHp: num(c.maxHp, 100),
    mp: num(c.mp, 30), maxMp: num(c.maxMp, 30), gold: num(c.gold, 100), stats,
    availableStatPoints: num(c.availableStatPoints), weapon: c.weapon || null, armor: c.armor || null,
    accessory: c.accessory || null, inventory: [...(c.inventory || [])],
  };
}

export class SimpleRpgRuleEngineService {
  public chat(message: string, character?: Partial<Character>, world?: Partial<WorldLocation>): string {
    const c = normalizeCharacter(character); const loc = world?.name || '拠点'; const q = String(message || '').trim();
    if (/疲れ|休|hp|体力/i.test(q)) return `${c.name}、${loc}ならまずHPを確認して安全を優先しよう。HP ${c.hp}/${c.maxHp} だよ。`;
    if (/装備|武器|防具/i.test(q)) return `${c.name}、装備は攻撃力・防御力と今の目的を見て決めよう。無理な強化は避けてね。`;
    if (/採取|素材|クラフト/i.test(q)) return `${c.name}、必要素材を先に確認してから採取→製作の順で進めると無駄が少ないよ。`;
    if (/戦闘|敵|バトル/i.test(q)) return `${c.name}、敵の攻撃力と自分のHPを確認して、危険なら回復や撤退を選ぼう。`;
    return `${c.name}、${loc}での行動を一つずつ確実に進めよう。状態を確認してから次の行動を決めれば大丈夫だよ。`;
  }

  public narrate(action: string, character?: Partial<Character>, world?: Partial<WorldLocation>, seed?: number) {
    const c = normalizeCharacter(character); const loc = world?.name || '拠点';
    const r = deterministicRoll(seed, `${c.id}|${loc}|${action}`, 100);
    const reward = 5 + (r % 6); const xp = 8 + (r % 8);
    return { narration: `${c.name}は${loc}で「${action || '前進'}」を実行した。周囲を確認しながら慎重に進んだ。`, mikiComment: r < 20 ? '足元と周囲をもう一度確認しよう。' : '順調だよ。このまま一つずつ進めよう！', suggestedActions: ['周囲を探索する', '装備を確認する', '一旦休憩する'], hpDelta: 0, mpDelta: 0, goldDelta: reward, xpDelta: xp };
  }

  public quest(setting = '未知の迷宮', difficulty = 'Normal', character?: Partial<Character>, seed?: number): Quest {
    const c = normalizeCharacter(character); const d = String(difficulty).toLowerCase();
    const scale = d.includes('hard') || d.includes('高') ? 2 : d.includes('easy') || d.includes('低') ? 0.7 : 1;
    const base = hash(`${setting}|${difficulty}|${c.id}|${seed ?? 0}`);
    const gold = Math.round(120 * scale) + (base % 31); const xp = Math.round(40 * scale) + (base % 21);
    return { id: `q_${base.toString(16)}`, title: `${setting}の調査`, synopsis: `${setting}を探索し、指定された手がかりを集める。`, location: setting, rewardGold: gold, rewardXp: xp, rewardItem: '探索報酬', objectives: [{ id: 'explore', desc: `${setting}を探索する`, completed: false }, { id: 'report', desc: '結果を報告する', completed: false }], completed: false };
  }

  public combat(playerMove: string, character?: Partial<Character>, monster?: Partial<Monster>, seed?: number) {
    const c = normalizeCharacter(character); const m: Monster = { name: monster?.name || 'モンスター', hp: num(monster?.hp, 50), maxHp: num(monster?.maxHp, num(monster?.hp, 50)), attack: num(monster?.attack, 8), defense: num(monster?.defense, 2), specialMove: monster?.specialMove, description: monster?.description || '', xpReward: num(monster?.xpReward, 20), goldReward: num(monster?.goldReward, 10), lootDrop: monster?.lootDrop };
    const roll = deterministicRoll(seed, `${c.id}|${m.name}|${playerMove}`, 100); const critical = roll >= 85;
    const power = num(c.weapon?.power, 0) + c.stats.strength; const damage = Math.max(1, power - m.defense + (critical ? Math.ceil(power * 0.5) : 0));
    const incoming = Math.max(0, m.attack - c.stats.defense + (roll % 3));
    return { narrative: `${c.name}の「${playerMove || '攻撃'}」が命中し、${m.name}に${damage}ダメージ！`, playerDamage: incoming, monsterDamage: damage, isCritical: critical, mikiComment: critical ? 'クリティカル！大きな一撃だよ！' : 'いい攻撃！', monsterRemainingHp: Math.max(0, m.hp - damage), playerRemainingHp: Math.max(0, c.hp - incoming), defeated: m.hp - damage <= 0 };
  }

  public execute(input: RpgActionInput): RpgActionResult {
    const action = input.action; const c = normalizeCharacter(input.character); const qty = clamp(Math.floor(num(input.quantity, 1)), 1, 999); const changes: Record<string, number | string | boolean> = {};
    const item = input.item ? { id: input.item.id || `item_${hash(JSON.stringify(input.item)).toString(16)}`, name: input.item.name || '素材', type: input.item.type || 'consumable', rarity: input.item.rarity || 'common', description: input.item.description || '', value: num(input.item.value, 10), icon: input.item.icon || '', power: input.item.power, defense: input.item.defense, healHp: input.item.healHp, healMp: input.item.healMp } as Item : undefined;
    switch (action) {
      case 'gather': c.inventory.push(...Array.from({ length: qty }, () => item || this.material('素材', 5))); changes.items = qty; break;
      case 'craft': case 'cook': { if (!item) return this.fail(action, '製作物の定義が必要です。'); const cost = item.value * qty; if (c.gold < cost) return this.fail(action, 'ゴールドが不足しています。'); c.gold -= cost; c.inventory.push(...Array.from({ length: qty }, () => ({ ...item }))); changes.gold = -cost; changes.items = qty; break; }
      case 'equip': { if (!item) return this.fail(action, '装備対象が必要です。'); const slot = input.slot || (item.type === 'weapon' ? 'weapon' : item.type === 'armor' ? 'armor' : 'accessory'); c[slot] = item; changes.equipped = slot; break; }
      case 'enhance': { const slot = input.slot || 'weapon'; const target = c[slot]; if (!target) return this.fail(action, '強化対象がありません。'); const cost = Math.max(10, (target.power || target.defense || 1) * 10) * qty; if (c.gold < cost) return this.fail(action, '強化費用が不足しています。'); c.gold -= cost; if (slot === 'weapon') target.power = num(target.power) + qty; else target.defense = num(target.defense) + qty; changes.gold = -cost; changes.levels = qty; break; }
      case 'repair': { const cost = 15 * qty; if (c.gold < cost) return this.fail(action, '修理費用が不足しています。'); c.gold -= cost; changes.gold = -cost; changes.repaired = true; break; }
      case 'farm': case 'fertilize': case 'fish': case 'pet': case 'guild': case 'job': case 'skill': case 'housing': { const cost = action === 'housing' ? 25 : 0; if (c.gold < cost) return this.fail(action, '必要資金が不足しています。'); c.gold -= cost; changes.progress = qty; changes.gold = -cost; changes.target = input.target || action; break; }
      case 'market_buy': { if (!item) return this.fail(action, '購入対象が必要です。'); const cost = Math.max(1, item.value) * qty; if (c.gold < cost) return this.fail(action, 'ゴールドが不足しています。'); c.gold -= cost; c.inventory.push(...Array.from({ length: qty }, () => ({ ...item }))); changes.gold = -cost; changes.items = qty; break; }
      case 'market_sell': { const price = Math.max(1, num(item?.value, input.value || 10)) * qty; c.gold += price; changes.gold = price; changes.items = -qty; if (item) { let left = qty; c.inventory = c.inventory.filter(x => { if (left > 0 && x.id === item.id) { left--; return false; } return true; }); } break; }
      case 'save': storageService.setItem(SAVE_KEY, JSON.stringify(c)); changes.saved = true; break;
      case 'load': { const raw = storageService.getItem(SAVE_KEY); if (!raw) return this.fail(action, '保存データがありません。'); return { ok: true, action, message: '保存データを読み込みました。', character: normalizeCharacter(JSON.parse(raw)), changes: { loaded: true } }; }
    }
    return { ok: true, action, message: `${action} を決定論的に実行しました。`, character: c, changes };
  }

  private material(name: string, value: number): Item { return { id: `mat_${hash(name).toString(16)}`, name, type: 'quest', rarity: 'common', description: '決定論的に生成された素材', value, icon: 'material' }; }
  private fail(action: RpgAction, message: string): RpgActionResult { return { ok: false, action, message, changes: {} }; }
}

export const simpleRpgRuleEngineService = new SimpleRpgRuleEngineService();

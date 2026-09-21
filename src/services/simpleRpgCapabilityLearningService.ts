import fs from 'node:fs';
import path from 'node:path';
import { ComponentTxtPackage } from '../types';
import { componentRegistryService } from './componentRegistryService';
import { simpleRpgRuleEngineService, RpgAction } from './simpleRpgRuleEngineService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const STATE_KEY = 'miki_simple_rpg_auto_learning_v1';
const REFERENCE_DIR = path.join(process.cwd(), 'reference', 'simple-rpg');

interface AuditState {
  sourceFingerprint: string;
  lastAuditAt: number;
  passed: string[];
  failed: string[];
  usage: Record<string, number>;
}

const GROUPS: Array<{ id: string; label: string; actions: RpgAction[]; keywords: string[]; sourceFiles: string[] }> = [
  { id: 'combat', label: '戦闘', actions: [], keywords: ['戦闘', 'バトル', '敵', 'combat'], sourceFiles: ['game-core-1.js', 'game-core-2.js', 'game-core-3.js', 'game-core-4.js', 'game-core-5.js'] },
  { id: 'gather', label: '採取', actions: ['gather'], keywords: ['採取', '素材', 'gather'], sourceFiles: ['gather-data.js', 'gather-base.js', 'gather-equip-data.js'] },
  { id: 'craft', label: 'クラフト・料理', actions: ['craft', 'cook'], keywords: ['クラフト', '製作', '料理', 'craft', 'cook'], sourceFiles: ['craft-core.js', 'craft-actions.js', 'craft-data.js', 'cook-data.js'] },
  { id: 'equipment', label: '装備・強化・修理', actions: ['equip', 'enhance', 'repair'], keywords: ['装備', '強化', '修理'], sourceFiles: ['combat-equip-data.js', 'equip-api.js', 'equip-enhance.js', 'repair-core.js'] },
  { id: 'farm', label: '農園・肥料・釣り', actions: ['farm', 'fertilize', 'fish'], keywords: ['農園', '畑', '肥料', '釣り'], sourceFiles: ['farm-core.js', 'farm-seed-data.js', 'fertilizer-core.js', 'fish-data.js'] },
  { id: 'pet', label: 'ペット', actions: ['pet'], keywords: ['ペット', 'pet'], sourceFiles: ['pet.js', 'pet-equip-data.js', 'pet-ui.js'] },
  { id: 'guild', label: 'ギルド・職業・スキル', actions: ['guild', 'job', 'skill'], keywords: ['ギルド', '職業', 'スキル'], sourceFiles: ['guild.js', 'guild2.js', 'guild-quests.js', 'guildskill.js', 'jobs.js', 'skill-core-1.js', 'skill-core-2.js', 'skilltree.js'] },
  { id: 'market', label: '市場', actions: ['market_buy', 'market_sell'], keywords: ['市場', '売買', 'market'], sourceFiles: ['market-core.js', 'market-core1.js', 'market-core2.js'] },
  { id: 'housing', label: 'ハウジング', actions: ['housing'], keywords: ['拠点', 'ハウジング', '家具'], sourceFiles: ['housing-core.js', 'housing-furniture-data.js', 'housing-ui-grid.js'] },
  { id: 'save', label: '保存・復元', actions: ['save', 'load'], keywords: ['保存', 'セーブ', 'ロード'], sourceFiles: ['save-system.js'] },
];

function hash(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function sourceFingerprint(files: string[]): string {
  const parts = files.sort().map(file => {
    const full = path.join(REFERENCE_DIR, file);
    try { return `${file}:${hash(fs.readFileSync(full, 'utf8'))}`; } catch { return `${file}:MISSING`; }
  });
  return hash(parts.join('|'));
}

function baseCharacter() {
  return {
    id: 'auto-auditor', name: '自動監査役', classTitle: 'Tester', level: 5, xp: 0, maxXp: 100,
    hp: 100, maxHp: 100, mp: 30, maxMp: 30, gold: 1000,
    stats: { strength: 20, dexterity: 15, intelligence: 15, charisma: 10, defense: 8 },
    availableStatPoints: 0, weapon: null, armor: null, accessory: null, inventory: [],
  };
}

class SimpleRpgCapabilityLearningService {
  private state: AuditState = { sourceFingerprint: '', lastAuditAt: 0, passed: [], failed: [], usage: {} };

  constructor() { this.load(); }

  private load() {
    try { const raw = storageService.getItem(STATE_KEY); if (raw) this.state = { ...this.state, ...JSON.parse(raw) }; } catch { /* safe defaults */ }
  }

  private save() { try { storageService.setItem(STATE_KEY, JSON.stringify(this.state)); } catch { /* non-fatal */ } }

  public listCapabilities() {
    return GROUPS.map(g => ({
      id: `simple_rpg.${g.id}`,
      label: g.label,
      actions: [...g.actions],
      keywords: [...g.keywords],
      sourceFiles: [...g.sourceFiles],
      sourceFingerprint: sourceFingerprint(g.sourceFiles),
      status: componentRegistryService.getComponent(`simple_rpg.${g.id}`)?.status || 'UNREGISTERED',
    }));
  }

  public audit(): { ok: boolean; sourceChanged: boolean; passed: string[]; failed: string[]; checkedAt: number } {
    const allFiles = Array.from(new Set(GROUPS.flatMap(g => g.sourceFiles)));
    const currentFingerprint = sourceFingerprint(allFiles);
    const sourceChanged = Boolean(this.state.sourceFingerprint && this.state.sourceFingerprint !== currentFingerprint);
    const passed: string[] = []; const failed: string[] = [];

    // Miki側の安全境界そのものも監査する。動的コード実行は禁止。
    const implementation = fs.existsSync(path.join(process.cwd(), 'src/services/simpleRpgRuleEngineService.ts'))
      ? fs.readFileSync(path.join(process.cwd(), 'src/services/simpleRpgRuleEngineService.ts'), 'utf8') : '';
    if (/\beval\s*\(|new\s+Function\s*\(/.test(implementation) || /Math\.random\s*\(/.test(implementation)) {
      failed.push('simple_rpg.security');
    } else passed.push('simple_rpg.security');

    for (const group of GROUPS) {
      let ok = true;
      const c = baseCharacter();
      for (const action of group.actions) {
        const input: any = { action, character: c, quantity: 1, seed: 42, target: 'auto-audit', item: { id: `audit-${action}`, name: '監査アイテム', type: action === 'equip' ? 'weapon' : 'consumable', rarity: 'common', value: 10, power: 5, defense: 2 } };
        if (action === 'enhance') { c.weapon = input.item; }
        const a = simpleRpgRuleEngineService.execute(input);
        const b = simpleRpgRuleEngineService.execute(input);
        if (!a.ok || JSON.stringify(a) !== JSON.stringify(b)) ok = false;
      }
      if (group.id === 'combat') {
        const a = simpleRpgRuleEngineService.combat('攻撃', c, { name: '監査敵', hp: 30, maxHp: 30, attack: 4, defense: 1 }, 42);
        const b = simpleRpgRuleEngineService.combat('攻撃', c, { name: '監査敵', hp: 30, maxHp: 30, attack: 4, defense: 1 }, 42);
        if (JSON.stringify(a) !== JSON.stringify(b) || a.playerRemainingHp < 0 || a.monsterRemainingHp < 0) ok = false;
      }
      const id = `simple_rpg.${group.id}`;
      if (ok) { passed.push(id); this.registerVerified(group, currentFingerprint); }
      else { failed.push(id); this.registerAnalyzed(group, currentFingerprint, '自動監査FAIL'); }
    }

    this.state.sourceFingerprint = currentFingerprint;
    this.state.lastAuditAt = Date.now();
    this.state.passed = passed; this.state.failed = failed; this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🔁 [SimpleRPG Auto Audit] pass=${passed.length} fail=${failed.length} sourceChanged=${sourceChanged}`);
    return { ok: failed.length === 0, sourceChanged, passed, failed, checkedAt: this.state.lastAuditAt };
  }

  public recordUsage(action: string) {
    this.state.usage[action] = (this.state.usage[action] || 0) + 1;
    this.save();
  }

  public getState() { return { ...this.state, usage: { ...this.state.usage } }; }

  private registerVerified(group: typeof GROUPS[number], fingerprint: string) {
    const id = `simple_rpg.${group.id}`;
    const implementation = `ADAPTER: SimpleRpgRuleEngine/${group.id}\nACTIONS: ${group.actions.join(',') || 'combat'}\nEXECUTION: deterministic in-process adapter\nDYNAMIC_CODE: forbidden\nSOURCE_FINGERPRINT: ${fingerprint}`;
    const validation = `AUTO_AUDIT: PASS\nSOURCE_FINGERPRINT: ${fingerprint}\nNOTE: This verifies Miki's deterministic adapter contract; it does not claim byte-for-byte parity with the separately evolving game.`;
    const pkg: ComponentTxtPackage = this.makePackage(group, 'VERIFIED', implementation, validation, fingerprint);
    componentRegistryService.registerComponent(pkg);
  }

  private registerAnalyzed(group: typeof GROUPS[number], fingerprint: string, reason: string) {
    const id = `simple_rpg.${group.id}`;
    const implementation = `ADAPTER: SimpleRpgRuleEngine/${group.id}\nACTIONS: ${group.actions.join(',') || 'combat'}\nEXECUTION: deterministic in-process adapter\nDYNAMIC_CODE: forbidden\nSOURCE_FINGERPRINT: ${fingerprint}`;
    const validation = `AUTO_AUDIT: FAIL\nSOURCE_FINGERPRINT: ${fingerprint}\nREASON: ${reason}`;
    componentRegistryService.registerComponent(this.makePackage(group, 'ANALYZED', implementation, validation, fingerprint));
  }

  private makePackage(group: typeof GROUPS[number], status: 'VERIFIED' | 'ANALYZED', implementation: string, validation: string, fingerprint: string): ComponentTxtPackage {
    const id = `simple_rpg.${group.id}`;
    const existing = componentRegistryService.getComponent(id);
    return {
      component_id: id, version: `auto-${fingerprint}`, status,
      purpose: `${group.label}をMikiの決定論的RPGアダプタとして利用する。ゲーム本体の更新とは独立して現行契約を再監査する。`,
      inputs: [{ name: 'RpgActionInput', type: 'RpgActionInput', description: `SimpleRpgRuleEngineの${group.label}入力` }],
      outputs: [{ name: 'RpgActionResult', type: 'RpgActionResult', description: '決定論的な実行結果' }],
      preconditions: ['SimpleRpgRuleEngineが利用可能', '入力契約が成立している'],
      postconditions: ['結果は同一入力に対して決定論的', '失敗時はok=falseで停止'],
      side_effects: group.actions.some(a => ['save'].includes(a)) ? ['状態ストレージ更新の可能性あり'] : ['入力キャラクターのコピー上で状態を更新'],
      dependencies: ['simpleRpgRuleEngineService'], supported_environments: ['MIKI_RUNTIME', 'ANDROID'],
      entry_point: `SimpleRpgRuleEngine/${group.id}`, failure_behavior: '契約不成立または監査失敗時は実行しない', security_class: 'LOCAL_WRITE',
      idempotent: false, deterministic: true,
      component_txt: `COMPONENT_ID: ${id}\nVERSION: auto-${fingerprint}\nSTATUS: ${status}\nENTRY_POINT: SimpleRpgRuleEngine/${group.id}`,
      implementation_txt: implementation,
      tests_txt: `AUTO_TEST: repeat same input => identical JSON\nAUTO_TEST: forbidden dynamic code => absent\nACTIONS: ${group.actions.join(',') || 'combat'}`,
      validation_txt: validation,
      sources_txt: `Reference source files: ${group.sourceFiles.join(', ')}\nSource fingerprint: ${fingerprint}\nReference files are inspected for change detection; their browser/global implementation is not imported into Miki.`,
      history_txt: 'Auto-generated and re-audited by SimpleRpgCapabilityLearningService.',
      implementation_hash: hash(implementation), validation_hash: hash(validation), success_count: existing?.success_count || 0, failure_count: existing?.failure_count || 0,
      created_at: existing?.created_at || Date.now(), updated_at: Date.now(),
    };
  }
}

export const simpleRpgCapabilityLearningService = new SimpleRpgCapabilityLearningService();

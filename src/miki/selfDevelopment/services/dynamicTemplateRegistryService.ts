import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { DETERMINISTIC_DEVELOPMENT_SEMANTICS } from '../../core/data/codeKnowledge/deterministicDevelopmentSemantics';

/**
 * [P444] 動的テンプレートレジストリ。
 *
 * テンプレート一覧はこれまで deterministicDevelopmentSemantics.ts の
 * `atomicTemplates`（as const の静的配列）と、capabilityContractSynthesisService
 * の正規表現分岐に決め打ちだった。新しいテンプレートをみきが作れる
 * ようにするため、一覧と選択規則を永続化された動的なものにする。
 *
 * 不変条件:
 * - 合成で選べるのは VERIFIED のテンプレートだけ。CANDIDATE の
 *   テンプレートは、自分の部品を作るための仕様・実処理コードの参照
 *   には使えるが、他の部品の合成の選択肢にはならない。
 * - 既存10個は初期登録分（BUILTIN・VERIFIED）。実処理の仕様は
 *   generatedComponentTemplateSpecService の TEMPLATE_SPECS が
 *   正本で、ここには置かない（重複させない）。このサービスが持つのは
 *   選択規則と、提案されたテンプレートの仕様・実処理コードだけ。
 * - 選択規則は builtin の規則が先、提案された規則が後。提案は
 *   builtin を上書きしない（新しい操作の穴を埋めるもの）。
 * - 規則は、含む操作テンプレートがすべて使える（VERIFIED）ときに
 *   だけ発火する。1つでも CANDIDATE ならその規則は飛ばす。
 * - どの規則にも当たらない操作は既定の ['TS_FUNCTION_CREATE',
 *   'TEST_UNIQUENESS'] になり、その操作をテンプレート不足（gap）
 *   として記録する（P439 の不足記録と同じ考え方）。黙って既定に
 *   するのではなく、不足が見えるようにする。
 */
export type TemplateRegistryKind = 'TS' | 'JSON' | 'CSV' | 'CONFIG' | 'TEST';

export interface TemplateRegistryEntry {
  templateId: string;
  kind: TemplateRegistryKind;
  params: string[];
  fixtureParams: Record<string, unknown>;
  /** 実処理コード（文字列操作）。TEST 種別は ''。 */
  operationCode: string;
  /** このテンプレートを選ぶ操作名の正規表現ソース。null なら規則なし。 */
  selectionPattern: string | null;
  status: 'CANDIDATE' | 'VERIFIED';
  origin: 'BUILTIN' | 'PROPOSED';
  /** このテンプレートの部品の componentId（VERIFIED への連動用）。 */
  sourceComponentId: string | null;
  /** なぜこのテンプレートが必要か（根拠の記録）。 */
  rationale: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateSelectionRule {
  pattern: string;
  templateIds: string[];
  status: 'CANDIDATE' | 'VERIFIED';
  origin: 'BUILTIN' | 'PROPOSED';
  /** 提案された規則の場合、そのテンプレートID。 */
  sourceTemplateId: string | null;
}

export interface TemplateGapRecord {
  operation: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

interface TemplateRegistryStore {
  version: 1;
  templates: TemplateRegistryEntry[];
  rules: TemplateSelectionRule[];
  gaps: TemplateGapRecord[];
}

const TEMPLATE_REGISTRY_STORAGE_KEY = 'miki_template_registry_v1';

const DEFAULT_TEMPLATES = ['TS_FUNCTION_CREATE', 'TEST_UNIQUENESS'];

/**
 * builtin の選択規則。capabilityContractSynthesisService.templates()
 * の旧・正規表現分岐をそのまま移行したもの（順序も同じ意味）。
 * ただし JSON/CSV は P444 で前に置いた。JSON_DATA_EXPANSION と
 * CSV_DATA_EXPANSION は 'EXPANSION' を含むため、ITEM|EXPANSION の
 * 規則より後ろだとそちらに取られてしまう。旧い能力名に JSON/CSV を
 * 含むものはないため、既存の選択は変わらない。
 */
const BUILTIN_RULES: TemplateSelectionRule[] = [
  { pattern: 'MIGRATION|PERSISTENCE|ROUNDTRIP', templateIds: ['TS_FUNCTION_CREATE', 'TEST_ROUNDTRIP'], status: 'VERIFIED', origin: 'BUILTIN', sourceTemplateId: null },
  { pattern: 'JSON', templateIds: ['JSON_ARRAY_APPEND', 'JSON_PROPERTY_ADD', 'TEST_UNIQUENESS'], status: 'VERIFIED', origin: 'BUILTIN', sourceTemplateId: null },
  { pattern: 'CSV', templateIds: ['CSV_ROW_APPEND', 'TEST_UNIQUENESS'], status: 'VERIFIED', origin: 'BUILTIN', sourceTemplateId: null },
  { pattern: 'ITEM|EXPANSION|REGISTRY', templateIds: ['TS_ARRAY_APPEND', 'TS_OBJECT_PROPERTY_APPEND', 'REGISTRY_EXPORT_CONNECT', 'TEST_UNIQUENESS'], status: 'VERIFIED', origin: 'BUILTIN', sourceTemplateId: null },
  { pattern: 'UI', templateIds: ['TS_IMPORT_ADD', 'TS_FUNCTION_CREATE'], status: 'VERIFIED', origin: 'BUILTIN', sourceTemplateId: null },
];

/**
 * 既存10個の種別（一覧表示用）。実処理の仕様の正本は
 * generatedComponentTemplateSpecService.TEMPLATE_SPECS で、ここは
 * 種別の一覧だけを持つ。TEMPLATE_SPECS を変えたらここも変えること。
 */
const BUILTIN_TEMPLATE_KINDS: Record<string, TemplateRegistryKind> = {
  TS_ARRAY_APPEND: 'TS',
  TS_OBJECT_PROPERTY_APPEND: 'TS',
  TS_FUNCTION_CREATE: 'TS',
  TS_IMPORT_ADD: 'TS',
  JSON_ARRAY_APPEND: 'JSON',
  JSON_PROPERTY_ADD: 'JSON',
  CSV_ROW_APPEND: 'CSV',
  REGISTRY_EXPORT_CONNECT: 'TS',
  TEST_UNIQUENESS: 'TEST',
  TEST_ROUNDTRIP: 'TEST',
};

class DynamicTemplateRegistryService {
  private store: TemplateRegistryStore | null = null;

  private load(): TemplateRegistryStore {
    if (this.store) return this.store;
    const raw = storageService.getItem(TEMPLATE_REGISTRY_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as TemplateRegistryStore;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.templates) && Array.isArray(parsed.rules) && Array.isArray(parsed.gaps)) {
          this.store = parsed;
          return this.store;
        }
      } catch {
        // 壊れた保存データは捨てて初期状態に戻す（部品レジストリと違い、
        // テンプレートの正本はコード側にあるため再生成できる）。
      }
      systemLogger.warn('SELF_IMPROVEMENT', '⚠️ [P444] テンプレートレジストリの保存データが読めないため初期状態に戻します');
    }
    this.store = { version: 1, templates: [], rules: BUILTIN_RULES.map((rule) => ({ ...rule, templateIds: [...rule.templateIds] })), gaps: [] };
    this.save();
    return this.store;
  }

  private save(): void {
    if (!this.store) return;
    storageService.setItem(TEMPLATE_REGISTRY_STORAGE_KEY, JSON.stringify(this.store));
  }

  /** 既存10個のテンプレートIDかどうか。 */
  public isBuiltinTemplateId(templateId: string): boolean {
    return (DETERMINISTIC_DEVELOPMENT_SEMANTICS.atomicTemplates as readonly string[]).includes(templateId);
  }

  /** 合成で選べるかどうか。builtin は VERIFIED、提案は部品が VERIFIED のものだけ。 */
  public isUsable(templateId: string): boolean {
    if (this.isBuiltinTemplateId(templateId)) return true;
    const entry = this.getTemplate(templateId);
    return !!entry && entry.status === 'VERIFIED';
  }

  /** 提案されたテンプレート1件。builtin はここにはない（仕様は TEMPLATE_SPECS が正本）。 */
  public getTemplate(templateId: string): TemplateRegistryEntry | undefined {
    return this.load().templates.find((entry) => entry.templateId === templateId);
  }

  /** 一覧。builtin 10個＋提案されたもの。verifiedOnly なら使えるものだけ。 */
  public listTemplates(options?: { verifiedOnly?: boolean }): TemplateRegistryEntry[] {
    const store = this.load();
    const builtins: TemplateRegistryEntry[] = (DETERMINISTIC_DEVELOPMENT_SEMANTICS.atomicTemplates as readonly string[]).map((templateId) => ({
      templateId,
      kind: BUILTIN_TEMPLATE_KINDS[templateId] ?? 'TS',
      params: [],
      fixtureParams: {},
      operationCode: '',
      selectionPattern: null,
      status: 'VERIFIED' as const,
      origin: 'BUILTIN' as const,
      sourceComponentId: null,
      rationale: 'builtin template',
      createdAt: 0,
      updatedAt: 0,
    }));
    const all = [...builtins, ...store.templates];
    if (options?.verifiedOnly) return all.filter((entry) => entry.status === 'VERIFIED');
    return all;
  }

  /**
   * 操作名からテンプレートを選ぶ。builtin の規則が先、提案された規則が後。
   * 規則は、含む操作テンプレートがすべて使えるときにだけ発火する。
   * どの規則にも当たらなければ既定を返し、その操作を不足として記録する。
   */
  public selectTemplates(operation: string): string[] {
    const store = this.load();
    for (const rule of store.rules) {
      if (rule.status !== 'VERIFIED') continue;
      let matches = false;
      try {
        matches = new RegExp(rule.pattern).test(operation);
      } catch {
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [P444] テンプレート選択規則のパターンが不正です: ${rule.pattern}`);
        continue;
      }
      if (!matches) continue;
      const notUsable = rule.templateIds.filter((id) => !this.isUsable(id));
      if (notUsable.length > 0) {
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [P444] ${operation}: 規則 ${rule.pattern} を飛ばします（テンプレート ${notUsable.join(',')} が未検証）`);
        continue;
      }
      return [...rule.templateIds];
    }
    this.recordGap(operation);
    return [...DEFAULT_TEMPLATES];
  }

  /** どの規則にも当たらなかった操作を不足として記録する。 */
  public recordGap(operation: string): void {
    const store = this.load();
    const now = Date.now();
    const existing = store.gaps.find((gap) => gap.operation === operation);
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
    } else {
      store.gaps.push({ operation, count: 1, firstSeenAt: now, lastSeenAt: now });
    }
    this.save();
    systemLogger.info('TOOLS', `🔍 [P444] テンプレート不足: 操作 ${operation} に合う選択規則がなく既定を使いました（新しいテンプレートの提案材料）`);
  }

  public listGaps(): TemplateGapRecord[] {
    return this.load().gaps.map((gap) => ({ ...gap }));
  }

  /**
   * 提案されたテンプレートを CANDIDATE として保存し、選択規則も
   * CANDIDATE で追加する。検証（入力の妥当性）は templateCreationService
   * が行う。ここでは重複だけを弾く。
   */
  public storeProposal(entry: TemplateRegistryEntry): { accepted: boolean; reason: string } {
    if (this.isBuiltinTemplateId(entry.templateId)) {
      return { accepted: false, reason: `BUILTIN_TEMPLATE_EXISTS: ${entry.templateId}` };
    }
    if (this.getTemplate(entry.templateId)) {
      return { accepted: false, reason: `TEMPLATE_ALREADY_PROPOSED: ${entry.templateId}` };
    }
    const store = this.load();
    store.templates.push({ ...entry, fixtureParams: { ...entry.fixtureParams }, params: [...entry.params] });
    if (entry.selectionPattern) {
      store.rules.push({
        pattern: entry.selectionPattern,
        templateIds: [entry.templateId, 'TEST_UNIQUENESS'],
        status: 'CANDIDATE',
        origin: 'PROPOSED',
        sourceTemplateId: entry.templateId,
      });
    }
    this.save();
    systemLogger.info('TOOLS', `🧩 [P444] テンプレートを提案として登録しました: ${entry.templateId} (CANDIDATE、部品 ${entry.sourceComponentId})`);
    return { accepted: true, reason: 'PROPOSED' };
  }

  /**
   * 登録ゲート。部品が VERIFIED になったら、その部品が作った
   * テンプレートを VERIFIED にする。promoteIfSafeForCanary の成功直後
   * に呼ぶ（新しい昇格入口は作らない。ここは昇格ではなく登録）。
   */
  public activateTemplateForComponent(componentId: string): string[] {
    const store = this.load();
    const activated: string[] = [];
    for (const entry of store.templates) {
      if (entry.sourceComponentId !== componentId || entry.status !== 'CANDIDATE') continue;
      entry.status = 'VERIFIED';
      entry.updatedAt = Date.now();
      for (const rule of store.rules) {
        if (rule.sourceTemplateId === entry.templateId && rule.status === 'CANDIDATE') rule.status = 'VERIFIED';
      }
      activated.push(entry.templateId);
      systemLogger.info('TOOLS', `🧩 [P444] テンプレートを有効化しました: ${entry.templateId} (部品 ${componentId} が VERIFIED)`);
    }
    if (activated.length > 0) this.save();
    return activated;
  }
}

export const dynamicTemplateRegistryService = new DynamicTemplateRegistryService();

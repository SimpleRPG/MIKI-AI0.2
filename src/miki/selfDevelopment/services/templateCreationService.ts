import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { systemLogger } from '../../../services/systemLogger';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { dynamicTemplateRegistryService, TemplateRegistryEntry, TemplateRegistryKind } from './dynamicTemplateRegistryService';
import { atomicComponentTemplateSynthesisService, SynthesizedComponent } from './atomicComponentTemplateSynthesisService';
import { multiIntentDevelopmentTransactionCoordinatorService } from './multiIntentDevelopmentTransactionCoordinatorService';
import type { CapabilityContract } from './capabilityContractSynthesisService';

/**
 * [P444] テンプレート作成フロー。
 *
 * みきが今の10個にない操作を必要としたとき、新しいテンプレートを
 * 「名前＋実装＋テスト」の部品として作り、検証の梯子（VALIDATE →
 * Regression → Canary → VERIFIED）を通してから一覧に登録する。
 *
 * 流れ:
 * 1. proposeTemplate: 提案の検証（名前・種別・パラメータ・実処理
 *    コードの決定性・選択パターン・根拠）。通ればレジストリへ
 *    CANDIDATE として保存する（この時点では合成で選ばれない）。
 * 2. buildTemplateComponent: そのテンプレートだけの契約を作り、
 *    atomic synthesis で部品を合成する。実処理コードはレジストリの
 *    CANDIDATE 仕様から読む（自分の部品を作るための参照）。
 * 3. driveTemplateComponent: コーディネータの共有経路でサンドボックス
 *    実行→登録→正式ルートへ載せる（DEVICE_TESTED まで）。
 * 4. Canary → promoteIfSafeForCanary（既存の正式昇格のみ）が通ると、
 *    その成功直後にレジストリがテンプレートを VERIFIED にする
 *    （登録ゲート。新しい昇格入口は作らない）。
 *
 * 線引き:
 * - 提案の実処理コードは提案と一緒に届く（教師からの供給や Muse の
 *   追加など）。このサービスはコードを発明しない。検出した不足
 *   （selectTemplates の gap 記録）に対して、コードなしの名前だけの
 *   テンプレートは作らない。
 * - 検証のゲートは緩めない。CANDIDATE のテンプレートは合成で選べない。
 * - 生成するコードは決定論的であること。検証は登録時の静的検査と
 *   同じ条件（Date.now / Math.random / fetch( / XMLHttpRequest /
 *   eval( を含まないこと）。
 */
export const TEMPLATE_COMPONENT_PREFIX = 'generated.template.';

export function templateComponentId(templateId: string): string {
  return `${TEMPLATE_COMPONENT_PREFIX}${templateId.toLowerCase()}`;
}

const TEMPLATE_ID_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const PARAM_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** 登録時の静的検査と同じ決定性の条件。 */
const NON_DETERMINISTIC_PATTERN = /Date\.now|Math\.random|fetch\(|XMLHttpRequest|eval\(/;
/** 選択パターンの広さの探り。既存の代表的な操作名のうち3つ以上に当たるものは広すぎるとして却下する。 */
const BROADNESS_PROBE_OPERATIONS = ['SCHEMA_MIGRATION', 'ITEM_EXPANSION', 'UI_FEATURE', 'SOMETHING_ELSE'];

export interface TemplateProposalInput {
  templateId: string;
  kind: TemplateRegistryKind;
  params: string[];
  fixtureParams: Record<string, unknown>;
  operationCode: string;
  selectionPattern: string | null;
  rationale: string;
}

export interface TemplateProposalResult {
  accepted: boolean;
  templateId: string;
  reason: string;
}

export interface TemplateComponentResult {
  accepted: boolean;
  templateId: string;
  synthesized?: SynthesizedComponent;
  reason: string;
}

class TemplateCreationService {
  public proposeTemplate(input: TemplateProposalInput): TemplateProposalResult {
    const templateId = input.templateId;
    if (!TEMPLATE_ID_PATTERN.test(templateId)) {
      return { accepted: false, templateId, reason: `INVALID_TEMPLATE_ID: ${templateId}` };
    }
    if (dynamicTemplateRegistryService.isBuiltinTemplateId(templateId)) {
      return { accepted: false, templateId, reason: `BUILTIN_TEMPLATE_EXISTS: ${templateId}` };
    }
    if (dynamicTemplateRegistryService.getTemplate(templateId)) {
      return { accepted: false, templateId, reason: `TEMPLATE_ALREADY_PROPOSED: ${templateId}` };
    }
    const kinds: TemplateRegistryKind[] = ['TS', 'JSON', 'CSV', 'CONFIG', 'TEST'];
    if (!kinds.includes(input.kind)) {
      return { accepted: false, templateId, reason: `INVALID_TEMPLATE_KIND: ${String(input.kind)}` };
    }
    if (!input.rationale || input.rationale.trim().length === 0) {
      return { accepted: false, templateId, reason: 'RATIONALE_REQUIRED' };
    }
    if (input.kind === 'TEST') {
      // TEST 種別は編集ではなくテスト要件のため、操作コードもパラメータも持たない。
      if (input.params.length > 0 || input.operationCode.length > 0 || Object.keys(input.fixtureParams).length > 0) {
        return { accepted: false, templateId, reason: 'TEST_TEMPLATE_MUST_BE_EMPTY' };
      }
    } else {
      if (input.params.length === 0) {
        return { accepted: false, templateId, reason: 'PARAMS_REQUIRED' };
      }
      const seen = new Set<string>();
      for (const param of input.params) {
        if (!PARAM_NAME_PATTERN.test(param) || seen.has(param)) {
          return { accepted: false, templateId, reason: `INVALID_PARAM: ${param}` };
        }
        seen.add(param);
      }
      // フィクスチャは全パラメータを覆うこと。覆わないとサンドボックスの
      // 標準入力が REQUEST_INCOMPLETE になり、梯子を上れない。
      const fixtureKeys = Object.keys(input.fixtureParams);
      if (fixtureKeys.length !== input.params.length || !input.params.every((param) => fixtureKeys.includes(param))) {
        return { accepted: false, templateId, reason: 'FIXTURE_MUST_COVER_ALL_PARAMS' };
      }
      if (input.operationCode.length === 0) {
        return { accepted: false, templateId, reason: 'OPERATION_CODE_REQUIRED' };
      }
      if (NON_DETERMINISTIC_PATTERN.test(input.operationCode)) {
        return { accepted: false, templateId, reason: 'NON_DETERMINISTIC_OPERATION_CODE' };
      }
    }
    if (input.selectionPattern !== null) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(input.selectionPattern);
      } catch {
        return { accepted: false, templateId, reason: `INVALID_SELECTION_PATTERN: ${input.selectionPattern}` };
      }
      const matched = BROADNESS_PROBE_OPERATIONS.filter((operation) => pattern.test(operation)).length;
      if (matched >= 3) {
        return { accepted: false, templateId, reason: `SELECTION_PATTERN_TOO_BROAD: ${input.selectionPattern}` };
      }
    }
    const now = Date.now();
    const entry: TemplateRegistryEntry = {
      templateId,
      kind: input.kind,
      params: [...input.params],
      fixtureParams: { ...input.fixtureParams },
      operationCode: input.operationCode,
      selectionPattern: input.selectionPattern,
      status: 'CANDIDATE',
      origin: 'PROPOSED',
      sourceComponentId: templateComponentId(templateId),
      rationale: input.rationale,
      createdAt: now,
      updatedAt: now,
    };
    const stored = dynamicTemplateRegistryService.storeProposal(entry);
    if (!stored.accepted) return { accepted: false, templateId, reason: stored.reason };
    systemLogger.info('TOOLS', `🧩 [P444] テンプレート提案を受け付けました: ${templateId} (${input.kind}、根拠: ${input.rationale})`);
    return { accepted: true, templateId, reason: 'PROPOSED' };
  }

  /**
   * テンプレートの部品を作る。契約はそのテンプレートだけのもので、
   * 契約の capabilityId が部品IDになる（決定論的で、提案時に記録した
   * sourceComponentId と一致する）。
   */
  public buildTemplateComponent(templateId: string): TemplateComponentResult {
    const entry = dynamicTemplateRegistryService.getTemplate(templateId);
    if (!entry) return { accepted: false, templateId, reason: `TEMPLATE_NOT_FOUND: ${templateId}` };
    if (entry.origin === 'BUILTIN') return { accepted: false, templateId, reason: `BUILTIN_TEMPLATE: ${templateId}` };
    const componentId = templateComponentId(templateId);
    const contract: CapabilityContract = {
      contractId: `CCON-${canonicalSha256({ template: templateId, component: componentId }).slice(0, 24)}`,
      capabilityId: componentId,
      purpose: `Template ${templateId}: ${entry.rationale}`,
      inputs: ['SOURCE_DOCUMENT', 'STRUCTURED_CHANGE_REQUEST'],
      outputs: ['CANDIDATE_DOCUMENT', 'VALIDATION_REPORT'],
      preconditions: ['BASELINE_SHA_MATCH', 'SUPPORTED_ARTIFACT', 'UNIQUE_STRUCTURAL_ANCHOR'],
      postconditions: ['PARSE_VALID', 'REQUEST_SATISFIED', 'NO_UNRELATED_CHANGE'],
      securityClass: 'LOCAL_WRITE',
      deterministic: true,
      templateIds: [templateId, 'TEST_UNIQUENESS'],
    };
    const synthesized = atomicComponentTemplateSynthesisService.synthesize(contract);
    return { accepted: true, templateId, synthesized, reason: 'SYNTHESIZED' };
  }

  /**
   * テンプレートの部品を梯子へ載せる。コーディネータの共有経路
   * （サンドボックス実行→登録→正式ルート）を使う。VERIFIED 昇格は
   * ここではしない（Regression Gate + Canary を通った
   * promoteIfSafeForCanary のみ）。
   */
  public async driveTemplateComponent(synthesized: SynthesizedComponent): Promise<{ componentId: string; passed: boolean; reachedDeviceTested: boolean }> {
    return multiIntentDevelopmentTransactionCoordinatorService.driveGeneratedComponent(synthesized);
  }

  /**
   * 回復用の同期。CANDIDATE のテンプレートのうち、部品がすでに
   * VERIFIED になっているものがあれば有効化する（登録ゲートの
   * 通常経路は promoteIfSafeForCanary 直後のフック）。
   */
  public syncRegistrations(): string[] {
    const activated: string[] = [];
    const candidates = dynamicTemplateRegistryService
      .listTemplates()
      .filter((entry) => entry.origin === 'PROPOSED' && entry.status === 'CANDIDATE' && entry.sourceComponentId);
    for (const entry of candidates) {
      const component = componentRegistryService.getComponent(entry.sourceComponentId as string);
      if (component && component.status === 'VERIFIED') {
        activated.push(...dynamicTemplateRegistryService.activateTemplateForComponent(entry.sourceComponentId as string));
      }
    }
    return activated;
  }
}

export const templateCreationService = new TemplateCreationService();

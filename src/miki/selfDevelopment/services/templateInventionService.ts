import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { dynamicTemplateRegistryService, BUILTIN_RULES, REMOVE_ACTION_RE } from './dynamicTemplateRegistryService';
import type { TemplateRegistryKind } from './dynamicTemplateRegistryService';
import { templateCreationService } from './templateCreationService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { TEMPLATE_SPECS, TS_FIXTURE_SOURCE, CSV_FIXTURE_SOURCE, isOperationTemplate } from './generatedComponentTemplateSpecService';

/**
 * [P448] テンプレートの発明。
 *
 * P444 の作成フローは「提案はコード付きで届くこと」が前提で、みき自身は
 * 操作コードを発明できなかった。このサービスは、不足した操作名から
 * 新しいテンプレートを「規則による導出」で考え出し、既存の P444 フロー
 * （提案→部品化→梯子→登録ゲート）へ載せる。
 *
 * 導出の規則（第1の規則 R-REMOVE。将来の規則はここへ足す）:
 * - 操作名が除去の行動の語（語幹 REMOV|DELET|DROP|UNSET|DISCONNECT）
 *   を含む。REMOVAL は REMOVE を含まないため語幹で判定する。
 * - 行動の語を除いた残りが builtin の選択規則のどれかに当たる。
 * - 当たった規則の操作テンプレート（TEST 系を除く）すべてに逆操作の
 *   生成器がある（INVERSE_SPECS）。なければ導出しない。
 * - 逆操作は、元の操作ブロックと同じ形（パラメータ検証→アンカー探索→
 *   冪等チェック→編集＋括弧バランス検査）で、既存の共通ヘルパーだけで
 *   書く。投げない。決定論のみ。推測で操作の意味は決めない
 *   （導出できない不足はエスカレーションする）。
 * - 導出は規則単位（1つの選択規則に1〜3テンプレート＋TEST_UNIQUENESS）。
 *   規則は全テンプレートが VERIFIED になったときに有効化される。
 *
 * 発明のきっかけ: selectTemplates が記録した不足（listGaps）のうち
 * count が 3回以上（P440 D1 の閾値と同じ）のもの。1回の駆動では
 * 1件までの発明を試みる（梯子は重い処理のため）。
 *
 * 失敗時の扱い:
 * - 導出・提案の却下は決定論的なため、繰り返しても結果は変わらない。
 *   試行回数を消費せず、その場でエスカレーションする（教師供給へ）。
 * - 梯子の失敗（サンドボックス失敗など）は1不足あたり3回まで再試行する。
 *   3回失敗したらエスカレーションする。
 * - エスカレーションは capabilityGapService.recordGap
 *   （capabilityId self_development、gap_type failure）で記録する。
 *
 * 検証の通し方: 発明したテンプレートも P444 フローと同じ梯子を通す。
 * 新しい昇格入口は作らない。成功の定義は、導出した全テンプレートの
 * 部品が DEVICE_TESTED に到達すること（VERIFIED は Canary＋昇格の
 * 通常フローで後からつく）。
 *
 * 駆動: autonomousCapabilityInnovationService と同じ形のタイマー周期駆動
 * （既定：有効、360分ごと、1周期1件まで）。起動直後には走らない。
 * domainIntegrationBootstrapService から initialize() を呼ぶ。
 */
export interface TemplateInventionAttempt {
  operation: string;
  templateIds: string[];
  sourceTemplateIds: string[];
  derivation: 'INVERSE';
  /** 梯子の失敗の回数（導出・提案の却下は決定論的なため数えない）。 */
  attempts: number;
  lastResult: string;
  status: 'PENDING' | 'DRIVEN' | 'SUCCEEDED' | 'ESCALATED';
  firstAttemptedAt: number;
  lastAttemptedAt: number;
}

export interface TemplateInventionBudget {
  enabled: boolean;
  intervalMinutes: number;
  maxInventionsPerCycle: number;
}

export interface DerivedTemplateSpec {
  templateId: string;
  kind: TemplateRegistryKind;
  params: string[];
  fixtureParams: Record<string, unknown>;
  operationCode: string;
  fixtureSeedSource: string;
  derivedFrom: string;
}

export interface DerivedRule {
  operation: string;
  pattern: string;
  templates: DerivedTemplateSpec[];
  templateIds: string[];
  rationale: string;
}

const INVENTION_ATTEMPT_KEY = 'miki_template_invention_attempt_v1';
const INVENTION_CONFIG_KEY = 'miki_template_invention_config_v1';
/** 発明を試みる不足の最低回数（P440 D1 の集計の閾値3回と同じ）。 */
const MIN_GAP_COUNT = 3;
/** 1不足あたりの梯子の再試行の上限。 */
const MAX_ATTEMPTS_PER_GAP = 3;
const MAX_STORED_ATTEMPTS = 2000;
/** 選択パターンに使う行動の語の並び。REMOVE_ACTION_RE と同じ集合（語幹）。 */
const INVENTION_ACTION_GROUP = '(REMOV|DELET|DROP|UNSET|DISCONNECT)';

/**
 * 逆操作の実処理コード。generatedComponentTemplateSpecService の
 * operationCodeFor が返すブロックと同じ形（{ ... } のブロック、
 * ops["<id>"]、isRec、report に <id>_FAILED:<理由> / <id>_SKIPPED /
 * <id>_APPLIED を積む）。除去は冪等な操作のため、要素がない場合は
 * SKIPPED（失敗ではない）。アンカー（配列・オブジェクト自体）が
 * ない場合だけ UNIQUE_AST_ANCHOR_NOT_FOUND で失敗する。
 * 決定論のみ（Date.now / Math.random / fetch( / XMLHttpRequest /
 * eval( を含まない）。String.raw で書くため、中の \n は生成コードの
 * 文字としてそのまま残る（既存ブロックと同じ書き方）。
 */
const TS_ARRAY_REMOVE_CODE = String.raw`{ // TS_ARRAY_REMOVE
  const p = ops["TS_ARRAY_REMOVE"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const val = isRec(p) ? p["valueSource"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof val !== "string" || val.length === 0) { report.push("TS_ARRAY_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const blk = findVarBlock(candidate, sym, "[", "]");
    if (!blk) { report.push("TS_ARRAY_REMOVE_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
    else {
      const inner = candidate.slice(blk.open + 1, blk.close);
      if (!hasValue(inner, val)) { report.push("TS_ARRAY_REMOVE_SKIPPED"); }
      else {
        const parts = splitTop(inner).filter(function (e) { return !hasValue(e, val); });
        const kept = parts.map(function (e) { return e.trim(); }).filter(function (e) { return e.length > 0; });
        const newInner = kept.length === 0 ? "" : "\n  " + kept.join(",\n  ") + "\n";
        const next = candidate.slice(0, blk.open + 1) + newInner + candidate.slice(blk.close);
        if (!isBalanced(next)) { report.push("TS_ARRAY_REMOVE_FAILED:OUTPUT_PARSE_FAILED"); }
        else { candidate = next; report.push("TS_ARRAY_REMOVE_APPLIED"); }
      }
    }
  }
}`;

const TS_OBJECT_PROPERTY_REMOVE_CODE = String.raw`{ // TS_OBJECT_PROPERTY_REMOVE
  const p = ops["TS_OBJECT_PROPERTY_REMOVE"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const prop = isRec(p) ? p["propertyName"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof prop !== "string" || prop.length === 0) { report.push("TS_OBJECT_PROPERTY_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const blk = findVarBlock(candidate, sym, "{", "}");
    if (!blk) { report.push("TS_OBJECT_PROPERTY_REMOVE_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
    else {
      const inner = candidate.slice(blk.open + 1, blk.close);
      if (!hasProp(inner, prop)) { report.push("TS_OBJECT_PROPERTY_REMOVE_SKIPPED"); }
      else {
        const parts = splitTop(inner).filter(function (e) { return !hasProp(e, prop); });
        const kept = parts.map(function (e) { return e.trim(); }).filter(function (e) { return e.length > 0; });
        const newInner = kept.length === 0 ? "" : "\n  " + kept.join(",\n  ") + "\n";
        const next = candidate.slice(0, blk.open + 1) + newInner + candidate.slice(blk.close);
        if (!isBalanced(next)) { report.push("TS_OBJECT_PROPERTY_REMOVE_FAILED:OUTPUT_PARSE_FAILED"); }
        else { candidate = next; report.push("TS_OBJECT_PROPERTY_REMOVE_APPLIED"); }
      }
    }
  }
}`;

const TS_FUNCTION_REMOVE_CODE = String.raw`{ // TS_FUNCTION_REMOVE
  const p = ops["TS_FUNCTION_REMOVE"];
  const name = isRec(p) ? p["functionName"] : undefined;
  if (typeof name !== "string" || name.length === 0) { report.push("TS_FUNCTION_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    let at = -1;
    let from = 0;
    while (true) {
      const found = candidate.indexOf("function " + name, from);
      if (found < 0) { break; }
      const afterName = candidate[found + "function ".length + name.length];
      if (afterName === "(") { at = found; break; }
      from = found + 1;
    }
    if (at < 0) { report.push("TS_FUNCTION_REMOVE_SKIPPED"); }
    else {
      const brace = candidate.indexOf("{", at);
      const close = brace < 0 ? -1 : matchClose(candidate, brace, "{", "}");
      if (close < 0) { report.push("TS_FUNCTION_REMOVE_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
      else {
        let start = at;
        while (start > 0 && candidate[start - 1] !== "\n") { start--; }
        let end = close + 1;
        if (candidate[end] === "\n") { end++; }
        const next = candidate.slice(0, start) + candidate.slice(end);
        if (!isBalanced(next)) { report.push("TS_FUNCTION_REMOVE_FAILED:OUTPUT_PARSE_FAILED"); }
        else { candidate = next; report.push("TS_FUNCTION_REMOVE_APPLIED"); }
      }
    }
  }
}`;

const TS_IMPORT_REMOVE_CODE = String.raw`{ // TS_IMPORT_REMOVE
  const p = ops["TS_IMPORT_REMOVE"];
  const mod = isRec(p) ? p["moduleSpecifier"] : undefined;
  if (typeof mod !== "string" || mod.length === 0) { report.push("TS_IMPORT_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const marker = "from " + JSON.stringify(mod);
    const at = candidate.indexOf(marker);
    if (at < 0) { report.push("TS_IMPORT_REMOVE_SKIPPED"); }
    else {
      let start = at;
      while (start > 0 && candidate[start - 1] !== "\n") { start--; }
      let end = candidate.indexOf("\n", at);
      if (end < 0) { end = candidate.length; } else { end = end + 1; }
      const next = candidate.slice(0, start) + candidate.slice(end);
      if (!isBalanced(next)) { report.push("TS_IMPORT_REMOVE_FAILED:OUTPUT_PARSE_FAILED"); }
      else { candidate = next; report.push("TS_IMPORT_REMOVE_APPLIED"); }
    }
  }
}`;

const REGISTRY_EXPORT_DISCONNECT_CODE = String.raw`{ // REGISTRY_EXPORT_DISCONNECT
  const p = ops["REGISTRY_EXPORT_DISCONNECT"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const mod = isRec(p) ? p["moduleSpecifier"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof mod !== "string" || mod.length === 0) { report.push("REGISTRY_EXPORT_DISCONNECT_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const line = "export { " + sym + " } from " + JSON.stringify(mod) + ";";
    const at = candidate.indexOf(line);
    if (at < 0) { report.push("REGISTRY_EXPORT_DISCONNECT_SKIPPED"); }
    else {
      let start = at;
      while (start > 0 && candidate[start - 1] !== "\n") { start--; }
      let end = candidate.indexOf("\n", at);
      if (end < 0) { end = candidate.length; } else { end = end + 1; }
      const next = candidate.slice(0, start) + candidate.slice(end);
      if (!isBalanced(next)) { report.push("REGISTRY_EXPORT_DISCONNECT_FAILED:OUTPUT_PARSE_FAILED"); }
      else { candidate = next; report.push("REGISTRY_EXPORT_DISCONNECT_APPLIED"); }
    }
  }
}`;

const JSON_ARRAY_REMOVE_CODE = String.raw`{ // JSON_ARRAY_REMOVE
  const p = ops["JSON_ARRAY_REMOVE"];
  const key = isRec(p) ? p["key"] : undefined;
  const pv = isRec(p) ? p["value"] : undefined;
  const hasVal = isRec(p) && Object.prototype.hasOwnProperty.call(p, "value");
  if (typeof key !== "string" || key.length === 0 || !hasVal) { report.push("JSON_ARRAY_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    let doc: unknown = null;
    let parsed = true;
    try { doc = JSON.parse(candidate); } catch { parsed = false; }
    if (!parsed) { report.push("JSON_ARRAY_REMOVE_FAILED:INVALID_JSON"); }
    else {
      const tgt = getPath(doc, key);
      if (!tgt.found) { report.push("JSON_ARRAY_REMOVE_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
      else if (!Array.isArray(tgt.value)) { report.push("JSON_ARRAY_REMOVE_FAILED:TARGET_NOT_ARRAY"); }
      else if (!(tgt.value as unknown[]).some(function (el) { return JSON.stringify(el) === JSON.stringify(pv); })) { report.push("JSON_ARRAY_REMOVE_SKIPPED"); }
      else {
        const kept = (tgt.value as unknown[]).filter(function (el) { return JSON.stringify(el) !== JSON.stringify(pv); });
        (tgt.parent as Record<string, unknown>)[tgt.last] = kept;
        candidate = JSON.stringify(doc, null, 2);
        report.push("JSON_ARRAY_REMOVE_APPLIED");
      }
    }
  }
}`;

const JSON_PROPERTY_REMOVE_CODE = String.raw`{ // JSON_PROPERTY_REMOVE
  const p = ops["JSON_PROPERTY_REMOVE"];
  const key = isRec(p) ? p["key"] : undefined;
  const prop = isRec(p) ? p["propertyName"] : undefined;
  if (typeof key !== "string" || key.length === 0 || typeof prop !== "string" || prop.length === 0) { report.push("JSON_PROPERTY_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    let doc: unknown = null;
    let parsed = true;
    try { doc = JSON.parse(candidate); } catch { parsed = false; }
    if (!parsed) { report.push("JSON_PROPERTY_REMOVE_FAILED:INVALID_JSON"); }
    else {
      const tgt = getPath(doc, key);
      if (!tgt.found) { report.push("JSON_PROPERTY_REMOVE_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
      else if (!isRec(tgt.value)) { report.push("JSON_PROPERTY_REMOVE_FAILED:TARGET_NOT_OBJECT"); }
      else if (!Object.prototype.hasOwnProperty.call(tgt.value, prop)) { report.push("JSON_PROPERTY_REMOVE_SKIPPED"); }
      else { delete (tgt.value as Record<string, unknown>)[prop]; candidate = JSON.stringify(doc, null, 2); report.push("JSON_PROPERTY_REMOVE_APPLIED"); }
    }
  }
}`;

const CSV_ROW_REMOVE_CODE = String.raw`{ // CSV_ROW_REMOVE
  const p = ops["CSV_ROW_REMOVE"];
  const row = isRec(p) ? p["row"] : undefined;
  const rowOk = Array.isArray(row) && row.length > 0 && row.every(function (c) { return typeof c === "string"; });
  if (!rowOk) { report.push("CSV_ROW_REMOVE_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const cells = row as string[];
    const line = cells.map(function (c) {
      if (c.indexOf(",") >= 0 || c.indexOf("\"") >= 0 || c.indexOf("\n") >= 0) { return "\"" + c.split("\"").join("\"\"") + "\""; }
      return c;
    }).join(",");
    const lines = candidate === "" ? [] : candidate.split("\n");
    const at = lines.indexOf(line);
    if (at < 0) { report.push("CSV_ROW_REMOVE_SKIPPED"); }
    else {
      lines.splice(at, 1);
      candidate = lines.join("\n");
      report.push("CSV_ROW_REMOVE_APPLIED");
    }
  }
}`;

/** CSV の行の整形。CSV_ROW_APPEND と同じ引用符の規則（生成側の写し）。 */
function csvLineFor(row: unknown): string {
  const cells = row as string[];
  return cells.map((c) => {
    if (c.indexOf(',') >= 0 || c.indexOf('"') >= 0 || c.indexOf('\n') >= 0) return '"' + c.split('"').join('""') + '"';
    return c;
  }).join(',');
}

interface InverseSpec {
  sourceId: string;
  targetId: string;
  /** 逆操作ブロックが実際に使うパラメータだけ（元のテンプレートと同じものだけを使う）。 */
  params: string[];
  operationCode: string;
  /**
   * 種文書（fixtureSeedSource）。元のフィクスチャ値から、除去する
   * 要素が入った文書を作る。標準フィクスチャは空の文書のため、
   * 種がないと NORMAL が SKIPPED になって梯子を上れない。
   */
  seedSource: (sourceFixture: Record<string, unknown>) => string;
}

/**
 * 逆操作の導出表。builtin の操作テンプレート8個すべてに逆操作がある。
 * 種は元のフィクスチャ値から作る（元の操作が入れるものと同じ形）。
 * - TS_ARRAY_REMOVE の種: 配列に要素を入れた文書。
 * - TS_OBJECT_PROPERTY_REMOVE の種: 項目を入れたオブジェクト。
 *   APPEND は項目を JSON.stringify(prop) + ": " + val で入れるため、
 *   種も同じ形（"generated": 'yes'）。
 * - TS_FUNCTION_REMOVE の種: 標準フィクスチャ＋関数。
 *   CREATE は export function name() { body } を追加するため同じ形。
 * - TS_IMPORT_REMOVE の種: import 行＋標準フィクスチャ。
 * - REGISTRY_EXPORT_DISCONNECT の種: 標準フィクスチャ＋export 行。
 * - JSON_ARRAY_REMOVE / JSON_PROPERTY_REMOVE の種: 要素・項目を入れた JSON。
 * - CSV_ROW_REMOVE の種: 行を入れた CSV。
 */
const INVERSE_SPECS: InverseSpec[] = [
  {
    sourceId: 'TS_ARRAY_APPEND',
    targetId: 'TS_ARRAY_REMOVE',
    params: ['symbol', 'valueSource'],
    operationCode: TS_ARRAY_REMOVE_CODE,
    seedSource: (f) => `export const ${String(f.symbol)}: string[] = [${String(f.valueSource)}];\nexport const generatedConfig: Record<string, unknown> = {};\n`,
  },
  {
    sourceId: 'TS_OBJECT_PROPERTY_APPEND',
    targetId: 'TS_OBJECT_PROPERTY_REMOVE',
    params: ['symbol', 'propertyName'],
    operationCode: TS_OBJECT_PROPERTY_REMOVE_CODE,
    seedSource: (f) => `export const generatedItems: string[] = [];\nexport const ${String(f.symbol)} = {\n  ${JSON.stringify(String(f.propertyName))}: ${String(f.valueSource)},\n};\n`,
  },
  {
    sourceId: 'TS_FUNCTION_CREATE',
    targetId: 'TS_FUNCTION_REMOVE',
    params: ['functionName'],
    operationCode: TS_FUNCTION_REMOVE_CODE,
    seedSource: (f) => `${TS_FIXTURE_SOURCE}\nexport function ${String(f.functionName)}() {\n${String(f.functionBody ?? '')}\n}\n`,
  },
  {
    sourceId: 'TS_IMPORT_ADD',
    targetId: 'TS_IMPORT_REMOVE',
    params: ['moduleSpecifier'],
    operationCode: TS_IMPORT_REMOVE_CODE,
    seedSource: (f) => `import { ${(f.importNames as string[]).join(', ')} } from ${JSON.stringify(String(f.moduleSpecifier))};\n${TS_FIXTURE_SOURCE}`,
  },
  {
    sourceId: 'REGISTRY_EXPORT_CONNECT',
    targetId: 'REGISTRY_EXPORT_DISCONNECT',
    params: ['symbol', 'moduleSpecifier'],
    operationCode: REGISTRY_EXPORT_DISCONNECT_CODE,
    seedSource: (f) => `${TS_FIXTURE_SOURCE}export { ${String(f.symbol)} } from ${JSON.stringify(String(f.moduleSpecifier))};\n`,
  },
  {
    sourceId: 'JSON_ARRAY_APPEND',
    targetId: 'JSON_ARRAY_REMOVE',
    params: ['key', 'value'],
    operationCode: JSON_ARRAY_REMOVE_CODE,
    seedSource: (f) => `{${JSON.stringify(String(f.key))}: [${JSON.stringify(f.value)}], "generatedConfig": {}}`,
  },
  {
    sourceId: 'JSON_PROPERTY_ADD',
    targetId: 'JSON_PROPERTY_REMOVE',
    params: ['key', 'propertyName'],
    operationCode: JSON_PROPERTY_REMOVE_CODE,
    seedSource: (f) => `{"generatedItems": [], ${JSON.stringify(String(f.key))}: {${JSON.stringify(String(f.propertyName))}: ${JSON.stringify(f.value)}}}`,
  },
  {
    sourceId: 'CSV_ROW_APPEND',
    targetId: 'CSV_ROW_REMOVE',
    params: ['row'],
    operationCode: CSV_ROW_REMOVE_CODE,
    seedSource: (f) => `${CSV_FIXTURE_SOURCE}${csvLineFor(f.row)}\n`,
  },
];

class TemplateInventionService {
  private timer: ReturnType<typeof setInterval> | undefined;

  /**
   * 不足した操作名から、逆操作の導出規則（R-REMOVE）を適用する。
   * 導出できない場合は理由を返す（推測で操作の意味は決めない）。
   */
  public deriveRuleForOperation(operation: string): { accepted: true; rule: DerivedRule } | { accepted: false; reason: string } {
    const segments = operation.split('_');
    const actionIndex = segments.findIndex((segment) => REMOVE_ACTION_RE.test(segment));
    if (actionIndex < 0) {
      return { accepted: false, reason: `NOT_REMOVE_FAMILY: ${operation}` };
    }
    // 行動の語を含む部分だけを取り除いた残りで、builtin の選択規則に当てる。
    const stem = [...segments.slice(0, actionIndex), ...segments.slice(actionIndex + 1)].join('_');
    const baseRule = BUILTIN_RULES.find((rule) => {
      try {
        return new RegExp(rule.pattern).test(stem);
      } catch {
        return false;
      }
    });
    if (!baseRule) {
      return { accepted: false, reason: `NO_BASE_RULE: ${operation}` };
    }
    const sourceIds = baseRule.templateIds.filter((id) => isOperationTemplate(id));
    const templates: DerivedTemplateSpec[] = [];
    for (const sourceId of sourceIds) {
      const inverse = INVERSE_SPECS.find((spec) => spec.sourceId === sourceId);
      if (!inverse) {
        return { accepted: false, reason: `NO_INVERSE_GENERATOR: ${sourceId}` };
      }
      const sourceSpec = TEMPLATE_SPECS[sourceId];
      if (!sourceSpec) {
        return { accepted: false, reason: `NO_SOURCE_SPEC: ${sourceId}` };
      }
      // フィクスチャは使うパラメータだけを元のフィクスチャ値から写す。
      // 提案の検証（FIXTURE_MUST_COVER_ALL_PARAMS）は、パラメータと
      // フィクスチャがちょうど一致することを求める。
      const fixtureParams: Record<string, unknown> = {};
      for (const param of inverse.params) fixtureParams[param] = sourceSpec.fixtureParams[param];
      templates.push({
        templateId: inverse.targetId,
        kind: sourceSpec.kind,
        params: [...inverse.params],
        fixtureParams,
        operationCode: inverse.operationCode,
        fixtureSeedSource: inverse.seedSource(sourceSpec.fixtureParams),
        derivedFrom: sourceId,
      });
    }
    if (templates.length === 0) {
      return { accepted: false, reason: `NO_BASE_RULE: ${operation}` };
    }
    // 選択パターンは、行動の語の部分全体を除去の行動の並びに置き換える。
    // （例：ITEM_REMOVAL → ITEM_(REMOV|DELET|DROP|UNSET|DISCONNECT)。
    // 行動の語だけを置き換えると REMOVAL の残り 'AL' が残ってしまい、
    // ITEM_DELETE のような同じ幹の操作に当たらなくなるため、部分ごと置き換える。
    // 並びは語幹で書く（REMOVE では REMOVAL に当たらないため）。）
    const pattern = [...segments.slice(0, actionIndex), INVENTION_ACTION_GROUP, ...segments.slice(actionIndex + 1)].join('_');
    const rationale = `P448 逆操作の導出: 不足した操作 ${operation} に対し、builtin の選択規則 ${baseRule.pattern} の操作テンプレート ${sourceIds.join(',')} の逆操作として導出。元のテンプレート: ${sourceIds.join(',')}。`;
    return {
      accepted: true,
      rule: {
        operation,
        pattern,
        templates,
        templateIds: templates.map((template) => template.templateId),
        rationale,
      },
    };
  }

  /** 発明の試行の台帳（永続化）。 */
  public listAttempts(): TemplateInventionAttempt[] {
    try {
      const value = JSON.parse(storageService.getItem(INVENTION_ATTEMPT_KEY) || '[]');
      return Array.isArray(value) ? (value as TemplateInventionAttempt[]) : [];
    } catch {
      return [];
    }
  }

  private getAttempt(operation: string): TemplateInventionAttempt | undefined {
    return this.listAttempts().find((attempt) => attempt.operation === operation);
  }

  private saveAttempt(attempt: TemplateInventionAttempt): void {
    const rows = [attempt, ...this.listAttempts().filter((item) => item.operation !== attempt.operation)].slice(0, MAX_STORED_ATTEMPTS);
    storageService.setItem(INVENTION_ATTEMPT_KEY, JSON.stringify(rows));
  }

  public getBudget(): TemplateInventionBudget {
    try {
      return { ...this.defaults(), ...JSON.parse(storageService.getItem(INVENTION_CONFIG_KEY) || '{}') };
    } catch {
      return this.defaults();
    }
  }

  public setBudget(value: Partial<TemplateInventionBudget>): TemplateInventionBudget {
    const next = { ...this.getBudget(), ...value };
    storageService.setItem(INVENTION_CONFIG_KEY, JSON.stringify(next));
    this.initialize();
    return next;
  }

  private defaults(): TemplateInventionBudget {
    return { enabled: true, intervalMinutes: 360, maxInventionsPerCycle: 1 };
  }

  /**
   * 不足の記録から発明を駆動する。1回の駆動では予算（既定1件）までの
   * 発明を試みる。導出・提案の却下は決定論的なためその場で
   * エスカレーションし、梯子の失敗だけ3回まで再試行する。
   */
  public async driveInventions(): Promise<{ attempted: number; driven: number; escalated: number; skipped: number }> {
    const budget = this.getBudget();
    let attempted = 0;
    let driven = 0;
    let escalated = 0;
    let skipped = 0;
    if (!budget.enabled) return { attempted, driven, escalated, skipped };
    // 回復用の同期。部品がすでに VERIFIED になっているものがあれば
    // 有効化する（登録ゲートの通常経路は promoteIfSafeForCanary 直後）。
    templateCreationService.syncRegistrations();
    const gaps = dynamicTemplateRegistryService.listGaps();
    for (const gap of gaps) {
      const attempt = this.getAttempt(gap.operation);
      if (attempt && (attempt.status === 'SUCCEEDED' || attempt.status === 'ESCALATED')) {
        skipped++;
        continue;
      }
      if (attempt && attempt.status === 'DRIVEN') {
        // 全テンプレートが VERIFIED になったら成功にする。
        if (attempt.templateIds.length > 0 && attempt.templateIds.every((id) => dynamicTemplateRegistryService.isUsable(id))) {
          this.saveAttempt({ ...attempt, status: 'SUCCEEDED', lastResult: 'ALL_VERIFIED', lastAttemptedAt: Date.now() });
          systemLogger.info('TOOLS', `🧩 [P448] 発明したテンプレートがすべて VERIFIED になりました: 操作 ${gap.operation} (${attempt.templateIds.join(',')})`);
        }
        skipped++;
        continue;
      }
      if (gap.count < MIN_GAP_COUNT) {
        skipped++;
        continue;
      }
      if (attempt && attempt.attempts >= MAX_ATTEMPTS_PER_GAP) {
        this.escalate(gap.operation, 'MAX_ATTEMPTS_REACHED', attempt.templateIds, attempt.sourceTemplateIds);
        escalated++;
        continue;
      }
      if (attempted >= budget.maxInventionsPerCycle) break;
      attempted++;
      systemLogger.info('TOOLS', `🧩 [P448] テンプレート不足の発明を試みます: 操作 ${gap.operation} (count=${gap.count})`);
      const derived = this.deriveRuleForOperation(gap.operation);
      if (derived.accepted === false) {
        this.escalate(gap.operation, derived.reason);
        escalated++;
        continue;
      }
      const rule = derived.rule;
      const sourceTemplateIds = rule.templates.map((template) => template.derivedFrom);
      let failedReason: string | null = null;
      let driveFailures = attempt?.attempts ?? 0;
      for (const template of rule.templates) {
        const proposed = templateCreationService.proposeTemplate({
          templateId: template.templateId,
          kind: template.kind,
          params: template.params,
          fixtureParams: template.fixtureParams,
          operationCode: template.operationCode,
          selectionPattern: null,
          rationale: rule.rationale,
          fixtureSeedSource: template.fixtureSeedSource,
          derivedFrom: template.derivedFrom,
        });
        if (!proposed.accepted && proposed.reason.startsWith('TEMPLATE_ALREADY_PROPOSED')) {
          // 既に提案済みのテンプレートは作り直さず再利用する。
          systemLogger.info('TOOLS', `🧩 [P448] テンプレートは既に提案済みのため再利用します: ${template.templateId}`);
        } else if (!proposed.accepted) {
          failedReason = proposed.reason;
          break;
        }
        const built = templateCreationService.buildTemplateComponent(template.templateId);
        if (!built.accepted || !built.synthesized) {
          failedReason = built.reason;
          break;
        }
        const drivenResult = await templateCreationService.driveTemplateComponent(built.synthesized);
        if (!drivenResult.passed || !drivenResult.reachedDeviceTested) {
          driveFailures += 1;
          failedReason = `DRIVE_FAILED: passed=${drivenResult.passed} reachedDeviceTested=${drivenResult.reachedDeviceTested}`;
          break;
        }
        systemLogger.info('TOOLS', `🧩 [P448] テンプレートを発明しました: ${template.templateId} (元: ${template.derivedFrom}、規則: INVERSE)`);
      }
      if (failedReason) {
        if (failedReason.startsWith('DRIVE_FAILED')) {
          // 梯子の失敗は環境や実行に依存しうるため、3回まで再試行する。
          if (driveFailures >= MAX_ATTEMPTS_PER_GAP) {
            this.escalate(gap.operation, `MAX_ATTEMPTS_REACHED: ${failedReason}`, rule.templateIds, sourceTemplateIds);
            escalated++;
          } else {
            this.saveAttempt({
              operation: gap.operation,
              templateIds: rule.templateIds,
              sourceTemplateIds,
              derivation: 'INVERSE',
              attempts: driveFailures,
              lastResult: failedReason,
              status: 'PENDING',
              firstAttemptedAt: attempt?.firstAttemptedAt ?? Date.now(),
              lastAttemptedAt: Date.now(),
            });
          }
        } else {
          // 提案・部品化の却下は決定論的なため、その場でエスカレーションする。
          this.escalate(gap.operation, failedReason, rule.templateIds, sourceTemplateIds);
          escalated++;
        }
        continue;
      }
      // 全テンプレートの部品が DEVICE_TESTED に到達したら、選択規則を
      // 提案として登録する。規則は全テンプレートが VERIFIED になった
      // ときに有効化される（登録ゲート）。
      const stored = dynamicTemplateRegistryService.storeRule({
        pattern: rule.pattern,
        templateIds: [...rule.templateIds, 'TEST_UNIQUENESS'],
        sourceTemplateIds: rule.templateIds,
      });
      if (!stored.accepted && !stored.reason.startsWith('RULE_ALREADY_EXISTS')) {
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [P448] 選択規則の登録に失敗しました: ${rule.pattern} (${stored.reason})`);
      }
      this.saveAttempt({
        operation: gap.operation,
        templateIds: rule.templateIds,
        sourceTemplateIds,
        derivation: 'INVERSE',
        attempts: driveFailures,
        lastResult: 'DRIVEN',
        status: 'DRIVEN',
        firstAttemptedAt: attempt?.firstAttemptedAt ?? Date.now(),
        lastAttemptedAt: Date.now(),
      });
      driven++;
    }
    return { attempted, driven, escalated, skipped };
  }

  /**
   * 発明できない不足を教師供給へ回す。capabilityGapService に不足を
   * 記録し、試行の台帳を ESCALATED にする（同じ不足を無限に試行しない）。
   */
  private escalate(operation: string, reason: string, templateIds: string[] = [], sourceTemplateIds: string[] = []): void {
    const attempt = this.getAttempt(operation);
    this.saveAttempt({
      operation,
      templateIds: templateIds.length > 0 ? templateIds : (attempt?.templateIds ?? []),
      sourceTemplateIds: sourceTemplateIds.length > 0 ? sourceTemplateIds : (attempt?.sourceTemplateIds ?? []),
      derivation: 'INVERSE',
      attempts: attempt?.attempts ?? 0,
      lastResult: reason,
      status: 'ESCALATED',
      firstAttemptedAt: attempt?.firstAttemptedAt ?? Date.now(),
      lastAttemptedAt: Date.now(),
    });
    capabilityGapService.recordGap({
      description: `テンプレートの発明ができませんでした: 操作 ${operation}（理由: ${reason}）。教師による操作コードの供給が必要です。`,
      gap_type: 'failure',
      capabilityId: 'self_development',
      impact: 'MEDIUM',
      current_workaround: '既定のテンプレート（TS_FUNCTION_CREATE）で代用するが、除去の操作には合わない',
      candidate_solution: '教師による操作コードの供給（除去操作の実処理コード付きのテンプレート提案）',
      samplePrompt: operation,
    });
    systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [P448] 発明をエスカレーションしました: 操作 ${operation} (理由: ${reason})`);
  }

  /** タイマー周期駆動を始める（innovation service と同じ形）。起動直後には走らない。 */
  public initialize(): void {
    this.dispose();
    const budget = this.getBudget();
    if (budget.enabled) {
      this.timer = setInterval(() => {
        void this.driveInventions();
      }, budget.intervalMinutes * 60000);
    }
  }

  public dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

export const templateInventionService = new TemplateInventionService();

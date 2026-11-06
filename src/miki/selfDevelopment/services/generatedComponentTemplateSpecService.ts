/**
 * [P443] G3: テンプレートごとの実処理仕様テーブル。
 *
 * テンプレート（deterministicDevelopmentSemantics.ts の atomicTemplates）
 * は操作の名前だけだった。ここでは各テンプレートに「パラメータ」
 * 「実処理コード（文字列操作）」「サンドボックス用の標準フィクスチャ」
 * を対応づける。生成部品の実装はこのテーブルから作られ、サンドボックス
 * の入力も同じテーブルから作られる（実装と試験が同じ仕様を見る）。
 *
 * 設計の線引き:
 * - 生成コードは文字列操作だけ。サンドボックス（vmワーカー）には
 *   typescript も require もないため、ASTサービスの実装は流用できない。
 *   ただし意味は ASTサービス (atomicAstTransformationComponentService)
 *   と合わせる: アンカー探索・カンマ処理・冪等チェック・安全な失敗。
 *   完全なパーサではない（文字列・コメントを避ける近似スキャナ）ため、
 *   アンカーが見つからない場合は編集せず理由を返す。誤った編集はしない。
 * - パラメータは input.request.operations[<templateId>] から読む。
 *   構造化された変更要求がそのまま部品の入力になる。
 * - 検証は投げない。パラメータ不足・型違い・アンカー不在・出力の
 *   括弧崩れはすべて report の理由として返し、candidate はその操作に
 *   ついては変更しない（安全な失敗）。サーバは1入力でも投げると
 *   全体を失敗にするため、生成関数は決して throw しない。
 * - 決定論のみ。Date.now / Math.random / fetch( / XMLHttpRequest /
 *   eval( は生成コードに含めない（登録時の静的検査と同じ条件）。
 * - JSON/CSV の3個は P444 で能力オントロジーに名前ができ、選択規則も
 *   動的レジストリに入った（capabilityContractSynthesisService は
 *   レジストリの selectTemplates を読む）。
 * - TEST_UNIQUENESS / TEST_ROUNDTRIP は編集ではなくテスト要件のため
 *   操作コードは作らない。往復性はサーバの2回実行・決定性照合で、
 *   一意性は冪等チェック（同じ要求の再適用は無変更）で担保する。
 * - [P444] 提案されたテンプレートの仕様は動的レジストリ
 *   (dynamicTemplateRegistryService) から読む。TEMPLATE_SPECS は
 *   既存10個の正本で、提案はここに書かない。getTemplateSpec /
 *   operationCodeFor は、静的テーブルにないIDをレジストリで引く。
 *   仕様の参照はゲートではない（選べるのは VERIFIED だけ、という
 *   ゲートは選択規則側）。自分の部品を作るときは CANDIDATE の
 *   仕様も読む（そうしないと部品が作れない）。
 * - [P444] CONFIG 種別は KEY_VALUE 文書（.env/.ini など）の操作。
 *   repositoryArtifactAdapterService が CONFIG 文書を編集可能な
 *   KEY_VALUE 文書と分類しているのが根拠。CONFIG_KEY_SET のような
 *   新しいテンプレートは作成フローで提案する。
 */
import { dynamicTemplateRegistryService } from './dynamicTemplateRegistryService';

export type TemplateKind = 'TS' | 'JSON' | 'CSV' | 'CONFIG' | 'TEST';

export interface TemplateOperationSpec {
  kind: TemplateKind;
  /** input.request.operations[<templateId>] に必要なパラメータ名。 */
  params: string[];
  /** サンドボックス用の決定論的な標準パラメータ（試験用フィクスチャ）。 */
  fixtureParams: Record<string, unknown>;
}

/**
 * テンプレートごとの仕様。パラメータの意味:
 * - TS_ARRAY_APPEND: symbol=配列変数名、valueSource=追加する要素のコード表記。
 * - TS_OBJECT_PROPERTY_APPEND: symbol=オブジェクト変数名、propertyName=項目名、valueSource=値のコード表記。
 * - TS_FUNCTION_CREATE: functionName=関数名、functionBody=関数本体（任意。なければ空）。
 * - TS_IMPORT_ADD: moduleSpecifier=モジュール、importNames=読み込む名前の配列。
 * - REGISTRY_EXPORT_CONNECT: symbol=公開する名前、moduleSpecifier=由来モジュール。
 *   `export { <name> } from '<module>';` を追加する（ASTサービスの
 *   ADD_EXPORT は型だけで実装がないため、ここで初めて設計する）。
 * - JSON_ARRAY_APPEND: key=配列へのドットパス（例: generatedItems）、value=追加する JSON 値。
 * - JSON_PROPERTY_ADD: key=対象オブジェクトへのドットパス、propertyName=項目名、value=値。
 * - CSV_ROW_APPEND: row=セルの配列。引用符は CSV の規則で付ける。
 */
export const TEMPLATE_SPECS: Record<string, TemplateOperationSpec> = {
  TS_ARRAY_APPEND: {
    kind: 'TS',
    params: ['symbol', 'valueSource'],
    fixtureParams: { symbol: 'generatedItems', valueSource: "'generated_item'" },
  },
  TS_OBJECT_PROPERTY_APPEND: {
    kind: 'TS',
    params: ['symbol', 'propertyName', 'valueSource'],
    fixtureParams: { symbol: 'generatedConfig', propertyName: 'generated', valueSource: "'yes'" },
  },
  TS_FUNCTION_CREATE: {
    kind: 'TS',
    params: ['functionName'],
    fixtureParams: { functionName: 'generatedFunction', functionBody: '  return "generated";' },
  },
  TS_IMPORT_ADD: {
    kind: 'TS',
    params: ['moduleSpecifier', 'importNames'],
    fixtureParams: { moduleSpecifier: './generated', importNames: ['generatedHelper'] },
  },
  REGISTRY_EXPORT_CONNECT: {
    kind: 'TS',
    params: ['symbol', 'moduleSpecifier'],
    fixtureParams: { symbol: 'generatedItem', moduleSpecifier: './generated' },
  },
  JSON_ARRAY_APPEND: {
    kind: 'JSON',
    params: ['key', 'value'],
    fixtureParams: { key: 'generatedItems', value: 'generated_item' },
  },
  JSON_PROPERTY_ADD: {
    kind: 'JSON',
    params: ['key', 'propertyName', 'value'],
    fixtureParams: { key: 'generatedConfig', propertyName: 'generated', value: 'yes' },
  },
  CSV_ROW_APPEND: {
    kind: 'CSV',
    params: ['row'],
    fixtureParams: { row: ['2', 'generated'] },
  },
  TEST_UNIQUENESS: { kind: 'TEST', params: [], fixtureParams: {} },
  TEST_ROUNDTRIP: { kind: 'TEST', params: [], fixtureParams: {} },
};

export function templateKind(templateId: string): TemplateKind {
  return getTemplateSpec(templateId)?.kind ?? 'TS';
}

/**
 * [P444] テンプレートの仕様。静的テーブルにないIDは動的レジストリ
 * （提案されたテンプレート）から読む。見つからなければ undefined。
 */
export function getTemplateSpec(templateId: string): TemplateOperationSpec | undefined {
  const builtin = TEMPLATE_SPECS[templateId];
  if (builtin) return builtin;
  const proposed = dynamicTemplateRegistryService.getTemplate(templateId);
  if (!proposed) return undefined;
  return { kind: proposed.kind, params: [...proposed.params], fixtureParams: { ...proposed.fixtureParams } };
}

export function isOperationTemplate(templateId: string): boolean {
  return templateKind(templateId) !== 'TEST';
}

/** 契約の先頭の操作テンプレート（TEST 系は除く）。なければ undefined。 */
export function firstOperationTemplate(templateIds: string[]): string | undefined {
  return templateIds.find((id) => isOperationTemplate(id));
}

/** 標準ソース（NORMAL/INVALID/PERMISSION 入力用）。種別は先頭の操作テンプレートで決める。 */
export const TS_FIXTURE_SOURCE =
  'export const generatedItems: string[] = [];\nexport const generatedConfig: Record<string, unknown> = {};\n';
export const JSON_FIXTURE_SOURCE = '{"generatedItems": [], "generatedConfig": {}}';
export const CSV_FIXTURE_SOURCE = 'id,name\n1,alpha\n';
export const CONFIG_FIXTURE_SOURCE = 'EXISTING_KEY=existing\n';

export interface SandboxFixture {
  kind: TemplateKind;
  /** NORMAL / INVALID / PERMISSION 入力の source。 */
  normalSource: string;
  /** BOUNDARY 入力の source（4096文字超の有効な文書）。 */
  boundarySource: string;
  /** NORMAL / EMPTY / BOUNDARY 入力の request。 */
  normalRequest: Record<string, unknown>;
  /** PERMISSION 入力の request（allowed: false の拒否）。 */
  permissionRequest: Record<string, unknown>;
}

/**
 * 契約のテンプレート一覧からサンドボックス入力の素材を作る。
 * 標準パラメータは試験用フィクスチャ（固定値）で、生成関数そのものは
 * 任意の request.operations を受け付ける汎用実装である。
 * 契約は選択上つねに単一種別（TS/JSON/CSV/CONFIG のいずれか）なので、種別が
 * 混ざる契約は先頭の操作テンプレートの種別で文書を作り、他種別の操作
 * は安全に失敗する（INVALID_JSON 等）。推測で混在契約は作らない。
 */
export function buildSandboxFixture(templateIds: string[]): SandboxFixture {
  const kind = templateKind(firstOperationTemplate(templateIds) ?? templateIds[0] ?? 'TS_FUNCTION_CREATE');
  const operations: Record<string, Record<string, unknown>> = {};
  for (const id of templateIds) {
    const spec = getTemplateSpec(id);
    if (spec && isOperationTemplate(id)) operations[id] = { ...spec.fixtureParams };
  }
  const normalRequest: Record<string, unknown> = { operations };
  const permissionRequest: Record<string, unknown> = { allowed: false, operations };
  let normalSource = TS_FIXTURE_SOURCE;
  let boundarySource = TS_FIXTURE_SOURCE + '// ' + 'x'.repeat(4096) + '\n';
  if (kind === 'JSON') {
    normalSource = JSON_FIXTURE_SOURCE;
    const pad = Array.from({ length: 1200 }, () => '"x"').join(',');
    boundarySource = '{"generatedItems": [' + pad + '], "generatedConfig": {}}';
  } else if (kind === 'CSV') {
    normalSource = CSV_FIXTURE_SOURCE;
    let rows = '';
    for (let n = 1000; n < 1500; n++) rows += n + ',pad\n';
    boundarySource = CSV_FIXTURE_SOURCE + rows;
  } else if (kind === 'CONFIG') {
    // [P444] KEY_VALUE 文書。境界入力はコメント行で水増しする（操作は
    // コメント行を見ないため、NORMAL と同じく先頭操作が APPLIED になる）。
    normalSource = CONFIG_FIXTURE_SOURCE;
    boundarySource = CONFIG_FIXTURE_SOURCE + '# ' + 'x'.repeat(4096) + '\n';
  }
  return { kind, normalSource, boundarySource, normalRequest, permissionRequest };
}

/**
 * 生成される実装に埋め込む共通ヘルパー。String.raw で書くため、
 * 中の \n や \\ はエスケープされず、そのまま生成コードの文字になる。
 * 使うのは文字列・配列・JSON の操作だけで、サンドボックスの制限
 * （typescript / require / Date / Math.random なし）にかからない。
 * 近似である点: 文字列・コメントの中の括弧は数えないが、正規表現
 * リテラルやテンプレートリテラル ${} の中までは見ない。完全な
 * パーサではないため、アンカー探索に失敗したら編集せず理由を返す。
 */
export const GENERATED_HELPERS_CODE = String.raw`function isRec(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function isQ(c: string): boolean { return c === "'" || c === '"' || c.charCodeAt(0) === 96; }
function skipWs(s: string, i: number): number { while (i < s.length && (s[i] === " " || s[i] === "\t" || s[i] === "\n" || s[i] === "\r")) { i++; } return i; }
function isIdCh(c: string): boolean { return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_" || c === "$"; }
function matchClose(s: string, openPos: number, openCh: string, closeCh: string): number {
  let depth = 0;
  let i = openPos;
  while (i < s.length) {
    const c = s[i];
    if (isQ(c)) {
      const q = c;
      i++;
      while (i < s.length && s[i] !== q) { if (s[i] === "\\") { i++; } i++; }
      i++;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") { i += 2; while (i < s.length && s[i] !== "\n") { i++; } continue; }
    if (c === "/" && s[i + 1] === "*") { i += 2; while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) { i++; } i += 2; continue; }
    if (c === openCh) { depth++; }
    else if (c === closeCh) { depth--; if (depth === 0) { return i; } }
    i++;
  }
  return -1;
}
function findVarBlock(s: string, symbol: string, openCh: string, closeCh: string): { open: number; close: number } | null {
  let from = 0;
  while (true) {
    const at = s.indexOf(symbol, from);
    if (at < 0) { return null; }
    if (at > 0 && isIdCh(s[at - 1])) { from = at + symbol.length; continue; }
    const after = at + symbol.length;
    if (after < s.length && isIdCh(s[after])) { from = at + symbol.length; continue; }
    let i = after;
    let foundEq = false;
    while (i < s.length && s[i] !== ";" && s[i] !== "\n") { if (s[i] === "=") { foundEq = true; break; } i++; }
    if (!foundEq) { from = at + symbol.length; continue; }
    i = skipWs(s, i + 1);
    if (s[i] !== openCh) { from = at + symbol.length; continue; }
    const close = matchClose(s, i, openCh, closeCh);
    if (close < 0) { return null; }
    return { open: i, close: close };
  }
}
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (isQ(c)) { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\") { i++; } i++; } i++; continue; }
    if (c === "[" || c === "{" || c === "(") { depth++; }
    else if (c === "]" || c === "}" || c === ")") { depth--; }
    else if (c === "," && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
    i++;
  }
  parts.push(s.slice(start));
  return parts;
}
function hasValue(inner: string, value: string): boolean {
  const parts = splitTop(inner);
  for (let k = 0; k < parts.length; k++) { if (parts[k].trim() === value.trim()) { return true; } }
  return false;
}
function hasProp(inner: string, name: string): boolean {
  const parts = splitTop(inner);
  for (let k = 0; k < parts.length; k++) {
    const t = parts[k].trim();
    if (t === "") { continue; }
    if (t.indexOf(name + ":") === 0) { return true; }
    if (t.indexOf("\"" + name + "\":") === 0) { return true; }
    if (t.indexOf("'" + name + "':") === 0) { return true; }
  }
  return false;
}
function isBalanced(s: string): boolean {
  let r = 0;
  let b = 0;
  let c = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (isQ(ch)) { const q = ch; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\") { i++; } i++; } i++; continue; }
    if (ch === "/" && s[i + 1] === "/") { i += 2; while (i < s.length && s[i] !== "\n") { i++; } continue; }
    if (ch === "/" && s[i + 1] === "*") { i += 2; while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) { i++; } i += 2; continue; }
    if (ch === "(") { r++; }
    else if (ch === ")") { r--; if (r < 0) { return false; } }
    else if (ch === "[") { b++; }
    else if (ch === "]") { b--; if (b < 0) { return false; } }
    else if (ch === "{") { c++; }
    else if (ch === "}") { c--; if (c < 0) { return false; } }
    i++;
  }
  return r === 0 && b === 0 && c === 0;
}
function getPath(doc: unknown, key: string): { found: boolean; parent: Record<string, unknown> | null; last: string; value: unknown } {
  const steps = key.split(".");
  let cur: unknown = doc;
  for (let k = 0; k < steps.length - 1; k++) {
    if (!isRec(cur)) { return { found: false, parent: null, last: "", value: undefined }; }
    cur = cur[steps[k]];
  }
  if (!isRec(cur)) { return { found: false, parent: null, last: "", value: undefined }; }
  const last = steps[steps.length - 1];
  if (!Object.prototype.hasOwnProperty.call(cur, last)) { return { found: false, parent: cur, last: last, value: undefined }; }
  return { found: true, parent: cur, last: last, value: cur[last] };
}`;

/**
 * 1テンプレート分の実処理コード（生成関数の本体に埋め込むブロック）。
 * 返す文字列は { ... } のブロック。TEST 系は操作がないため空文字。
 * 失敗時は `<id>_FAILED:<理由>` を、冪等な無変更時は `<id>_SKIPPED` を、
 * 適用時は `<id>_APPLIED` を report に積む。理由は ASTサービスのものと
 * 同じ語彙（UNIQUE_AST_ANCHOR_NOT_FOUND / OUTPUT_PARSE_FAILED 等）に
 * REQUEST_INCOMPLETE（要求の検証失敗）と INVALID_JSON / TARGET_NOT_* を加えたもの。
 */
export function operationCodeFor(templateId: string): string {
  switch (templateId) {
    case 'TS_ARRAY_APPEND':
      return String.raw`{ // TS_ARRAY_APPEND
  const p = ops["TS_ARRAY_APPEND"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const val = isRec(p) ? p["valueSource"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof val !== "string" || val.length === 0) { report.push("TS_ARRAY_APPEND_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const blk = findVarBlock(candidate, sym, "[", "]");
    if (!blk) { report.push("TS_ARRAY_APPEND_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
    else {
      const inner = candidate.slice(blk.open + 1, blk.close);
      if (hasValue(inner, val)) { report.push("TS_ARRAY_APPEND_SKIPPED"); }
      else {
        const next = candidate.slice(0, blk.close) + (inner.trim() === "" ? val : ",\n" + val) + candidate.slice(blk.close);
        if (!isBalanced(next)) { report.push("TS_ARRAY_APPEND_FAILED:OUTPUT_PARSE_FAILED"); }
        else { candidate = next; report.push("TS_ARRAY_APPEND_APPLIED"); }
      }
    }
  }
}`;
    case 'TS_OBJECT_PROPERTY_APPEND':
      return String.raw`{ // TS_OBJECT_PROPERTY_APPEND
  const p = ops["TS_OBJECT_PROPERTY_APPEND"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const prop = isRec(p) ? p["propertyName"] : undefined;
  const val = isRec(p) ? p["valueSource"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof prop !== "string" || prop.length === 0 || typeof val !== "string" || val.length === 0) { report.push("TS_OBJECT_PROPERTY_APPEND_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const blk = findVarBlock(candidate, sym, "{", "}");
    if (!blk) { report.push("TS_OBJECT_PROPERTY_APPEND_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
    else {
      const inner = candidate.slice(blk.open + 1, blk.close);
      if (hasProp(inner, prop)) { report.push("TS_OBJECT_PROPERTY_APPEND_SKIPPED"); }
      else {
        const entry = JSON.stringify(prop) + ": " + val;
        const next = candidate.slice(0, blk.close) + (inner.trim() === "" ? entry : ",\n" + entry) + candidate.slice(blk.close);
        if (!isBalanced(next)) { report.push("TS_OBJECT_PROPERTY_APPEND_FAILED:OUTPUT_PARSE_FAILED"); }
        else { candidate = next; report.push("TS_OBJECT_PROPERTY_APPEND_APPLIED"); }
      }
    }
  }
}`;
    case 'TS_FUNCTION_CREATE':
      return String.raw`{ // TS_FUNCTION_CREATE
  const p = ops["TS_FUNCTION_CREATE"];
  const name = isRec(p) ? p["functionName"] : undefined;
  const body = isRec(p) && typeof p["functionBody"] === "string" ? p["functionBody"] : "";
  if (typeof name !== "string" || name.length === 0) { report.push("TS_FUNCTION_CREATE_FAILED:REQUEST_INCOMPLETE"); }
  else if (candidate.indexOf("function " + name) >= 0) { report.push("TS_FUNCTION_CREATE_SKIPPED"); }
  else {
    const next = candidate.trimEnd() + "\n\nexport function " + name + "() {\n" + body + "\n}\n";
    if (!isBalanced(next)) { report.push("TS_FUNCTION_CREATE_FAILED:OUTPUT_PARSE_FAILED"); }
    else { candidate = next; report.push("TS_FUNCTION_CREATE_APPLIED"); }
  }
}`;
    case 'TS_IMPORT_ADD':
      return String.raw`{ // TS_IMPORT_ADD
  const p = ops["TS_IMPORT_ADD"];
  const mod = isRec(p) ? p["moduleSpecifier"] : undefined;
  const names = isRec(p) ? p["importNames"] : undefined;
  const namesOk = Array.isArray(names) && names.length > 0 && names.every(function (n) { return typeof n === "string" && n.length > 0; });
  if (typeof mod !== "string" || mod.length === 0 || !namesOk) { report.push("TS_IMPORT_ADD_FAILED:REQUEST_INCOMPLETE"); }
  else if (candidate.indexOf("from " + JSON.stringify(mod)) >= 0) { report.push("TS_IMPORT_ADD_SKIPPED"); }
  else {
    const next = "import { " + (names as string[]).join(", ") + " } from " + JSON.stringify(mod) + ";\n" + candidate;
    if (!isBalanced(next)) { report.push("TS_IMPORT_ADD_FAILED:OUTPUT_PARSE_FAILED"); }
    else { candidate = next; report.push("TS_IMPORT_ADD_APPLIED"); }
  }
}`;
    case 'REGISTRY_EXPORT_CONNECT':
      return String.raw`{ // REGISTRY_EXPORT_CONNECT
  const p = ops["REGISTRY_EXPORT_CONNECT"];
  const sym = isRec(p) ? p["symbol"] : undefined;
  const mod = isRec(p) ? p["moduleSpecifier"] : undefined;
  if (typeof sym !== "string" || sym.length === 0 || typeof mod !== "string" || mod.length === 0) { report.push("REGISTRY_EXPORT_CONNECT_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const line = "export { " + sym + " } from " + JSON.stringify(mod) + ";";
    if (candidate.indexOf(line) >= 0) { report.push("REGISTRY_EXPORT_CONNECT_SKIPPED"); }
    else {
      const next = candidate.trimEnd() + "\n" + line + "\n";
      if (!isBalanced(next)) { report.push("REGISTRY_EXPORT_CONNECT_FAILED:OUTPUT_PARSE_FAILED"); }
      else { candidate = next; report.push("REGISTRY_EXPORT_CONNECT_APPLIED"); }
    }
  }
}`;
    case 'JSON_ARRAY_APPEND':
      return String.raw`{ // JSON_ARRAY_APPEND
  const p = ops["JSON_ARRAY_APPEND"];
  const key = isRec(p) ? p["key"] : undefined;
  const pv = isRec(p) ? p["value"] : undefined;
  const hasVal = isRec(p) && Object.prototype.hasOwnProperty.call(p, "value");
  if (typeof key !== "string" || key.length === 0 || !hasVal) { report.push("JSON_ARRAY_APPEND_FAILED:REQUEST_INCOMPLETE"); }
  else {
    let doc: unknown = null;
    let parsed = true;
    try { doc = JSON.parse(candidate); } catch { parsed = false; }
    if (!parsed) { report.push("JSON_ARRAY_APPEND_FAILED:INVALID_JSON"); }
    else {
      const tgt = getPath(doc, key);
      if (!tgt.found) { report.push("JSON_ARRAY_APPEND_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
      else if (!Array.isArray(tgt.value)) { report.push("JSON_ARRAY_APPEND_FAILED:TARGET_NOT_ARRAY"); }
      else if ((tgt.value as unknown[]).some(function (el) { return JSON.stringify(el) === JSON.stringify(pv); })) { report.push("JSON_ARRAY_APPEND_SKIPPED"); }
      else { (tgt.value as unknown[]).push(pv); candidate = JSON.stringify(doc, null, 2); report.push("JSON_ARRAY_APPEND_APPLIED"); }
    }
  }
}`;
    case 'JSON_PROPERTY_ADD':
      return String.raw`{ // JSON_PROPERTY_ADD
  const p = ops["JSON_PROPERTY_ADD"];
  const key = isRec(p) ? p["key"] : undefined;
  const prop = isRec(p) ? p["propertyName"] : undefined;
  const pv = isRec(p) ? p["value"] : undefined;
  const hasVal = isRec(p) && Object.prototype.hasOwnProperty.call(p, "value");
  if (typeof key !== "string" || key.length === 0 || typeof prop !== "string" || prop.length === 0 || !hasVal) { report.push("JSON_PROPERTY_ADD_FAILED:REQUEST_INCOMPLETE"); }
  else {
    let doc: unknown = null;
    let parsed = true;
    try { doc = JSON.parse(candidate); } catch { parsed = false; }
    if (!parsed) { report.push("JSON_PROPERTY_ADD_FAILED:INVALID_JSON"); }
    else {
      const tgt = getPath(doc, key);
      if (!tgt.found) { report.push("JSON_PROPERTY_ADD_FAILED:UNIQUE_AST_ANCHOR_NOT_FOUND"); }
      else if (!isRec(tgt.value)) { report.push("JSON_PROPERTY_ADD_FAILED:TARGET_NOT_OBJECT"); }
      else if (Object.prototype.hasOwnProperty.call(tgt.value, prop)) { report.push("JSON_PROPERTY_ADD_SKIPPED"); }
      else { (tgt.value as Record<string, unknown>)[prop] = pv; candidate = JSON.stringify(doc, null, 2); report.push("JSON_PROPERTY_ADD_APPLIED"); }
    }
  }
}`;
    case 'CSV_ROW_APPEND':
      return String.raw`{ // CSV_ROW_APPEND
  const p = ops["CSV_ROW_APPEND"];
  const row = isRec(p) ? p["row"] : undefined;
  const rowOk = Array.isArray(row) && row.length > 0 && row.every(function (c) { return typeof c === "string"; });
  if (!rowOk) { report.push("CSV_ROW_APPEND_FAILED:REQUEST_INCOMPLETE"); }
  else {
    const cells = row as string[];
    const line = cells.map(function (c) {
      if (c.indexOf(",") >= 0 || c.indexOf("\"") >= 0 || c.indexOf("\n") >= 0) { return "\"" + c.split("\"").join("\"\"") + "\""; }
      return c;
    }).join(",");
    const lines = candidate === "" ? [] : candidate.split("\n");
    if (lines.indexOf(line) >= 0) { report.push("CSV_ROW_APPEND_SKIPPED"); }
    else {
      const next = (candidate === "" ? "" : (candidate.charAt(candidate.length - 1) === "\n" ? candidate : candidate + "\n")) + line + "\n";
      candidate = next; report.push("CSV_ROW_APPEND_APPLIED");
    }
  }
}`;
    default:
      // [P444] 静的テーブルにないIDは動的レジストリ（提案された
      // テンプレート）の実処理コード。なければ空文字（TEST 系と同じ扱い）。
      return dynamicTemplateRegistryService.getTemplate(templateId)?.operationCode ?? '';
  }
}

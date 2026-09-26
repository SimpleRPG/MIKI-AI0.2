export interface ParsedDirectiveText {
  title: string;
  objective: string;
  targetFiles: string[];
  requirements: string[];
  prohibitions: string[];
  invariants: string[];
  validationRequirements: string[];
  deliveryRequirements: string[];
  relatedIssueIds: string[];
}

type JsonRecord = Record<string, unknown>;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asStringArray = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value.split(/\r?\n|[,、]/).map((item) => item.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item.trim()];
    if (item && typeof item === 'object') {
      const record = item as JsonRecord;
      for (const key of ['value', 'text', 'path', 'file', 'name']) {
        const candidate = asString(record[key]);
        if (candidate) return [candidate];
      }
    }
    return [];
  }).filter(Boolean);
};

const unique = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

const stripBullet = (value: string): string => value.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();

const firstPrefixed = (lines: string[], labels: string[]): string => {
  const normalized = labels.map((label) => label.toLowerCase());
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hit = normalized.find((label) => lower.startsWith(`${label}:`) || lower.startsWith(`${label}=`) || lower.startsWith(`${label}：`));
    if (hit) return line.replace(/^[^:=：]+[:=：]\s*/, '').trim();
  }
  return '';
};

const prefixedAll = (lines: string[], labels: string[]): string[] => {
  const normalized = labels.map((label) => label.toLowerCase());
  return unique(lines.flatMap((line) => {
    const lower = line.toLowerCase();
    const hit = normalized.find((label) => lower.startsWith(`${label}:`) || lower.startsWith(`${label}=`) || lower.startsWith(`${label}：`));
    return hit ? [stripBullet(line.replace(/^[^:=：]+[:=：]\s*/, ''))] : [];
  }));
};

const sectionAll = (lines: string[], patterns: RegExp[]): string[] => {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const heading = lines[i].replace(/^#{1,6}\s*/, '').trim();
    if (!patterns.some((pattern) => pattern.test(heading))) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^#{1,6}\s+/.test(lines[j])) break;
      const value = stripBullet(lines[j]);
      if (value) result.push(value);
    }
  }
  return unique(result);
};

const extractTargets = (rawText: string): string[] => {
  const targets: string[] = [];
  for (const match of rawText.matchAll(/([A-Za-z0-9_.@/\-]+\.(?:ts|tsx|js|jsx|json|txt|md|markdown|yaml|yml))/g)) {
    const value = match[1];
    if (!value.startsWith('http')) targets.push(value);
  }
  for (const raw of rawText.split(/\r?\n/)) {
    const line = stripBullet(raw.trim());
    if (/^(src|android|scripts|docs|reference)\//.test(line)) targets.push(line);
  }
  return unique(targets);
};

const titleFrom = (lines: string[], sourceFileName: string): string => {
  const heading = lines.find((line) => /^#\s+/.test(line) && !/^#\s*(目的|概要|OBJECTIVE|GOAL|対象|TARGET)/i.test(line));
  if (heading) return heading.replace(/^#\s+/, '').trim();
  const explicit = firstPrefixed(lines, ['TITLE', 'タイトル', '指示書タイトル']);
  if (explicit) return explicit;
  const fileTitle = sourceFileName.replace(/\.(txt|md|markdown|json|yaml|yml)$/i, '').replace(/[_-]+/g, ' ').trim();
  if (fileTitle && !/^(pasted|manual|imported|directive)$/i.test(fileTitle)) return fileTitle;
  const meaningful = lines.find((line) => line.length >= 8 && !/^[#【\[\]{}*-]/.test(line));
  return meaningful || `作業指示 (${new Date().toLocaleDateString('ja-JP')} 受領)`;
};

const parseJson = (rawText: string, sourceFileName: string): ParsedDirectiveText | null => {
  let parsed: unknown;
  try { parsed = JSON.parse(rawText); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const root = parsed as JsonRecord;
  const nested = root.directive && typeof root.directive === 'object' && !Array.isArray(root.directive)
    ? root.directive as JsonRecord
    : root;
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = asString(nested.title) || asString(nested.name) || asString(nested.subject) || titleFrom(lines, sourceFileName);
  return {
    title,
    objective: asString(nested.objective) || asString(nested.goal) || asString(nested.purpose) || asString(nested.description) || title,
    targetFiles: unique([
      ...asStringArray(nested.targetFiles), ...asStringArray(nested.targets), ...asStringArray(nested.target),
      ...asStringArray(nested.target_files), ...asStringArray(nested['対象ファイル']),
    ]),
    requirements: unique([
      ...asStringArray(nested.requirements), ...asStringArray(nested.requirement), ...asStringArray(nested.tasks),
      ...asStringArray(nested['要件']), ...asStringArray(nested['要求事項']), ...asStringArray(nested['実装要求']),
    ]),
    prohibitions: unique([
      ...asStringArray(nested.prohibitions), ...asStringArray(nested.prohibition), ...asStringArray(nested.forbidden),
      ...asStringArray(nested.forbiddenBehaviors), ...asStringArray(nested['禁止']), ...asStringArray(nested['禁止事項']),
    ]),
    invariants: unique([...asStringArray(nested.invariants), ...asStringArray(nested['不変条件'])]),
    validationRequirements: unique([
      ...asStringArray(nested.validationRequirements), ...asStringArray(nested.validation), ...asStringArray(nested.verification),
      ...asStringArray(nested.acceptanceCriteria), ...asStringArray(nested['検証条件']), ...asStringArray(nested['検証']),
    ]),
    deliveryRequirements: unique([
      ...asStringArray(nested.deliveryRequirements), ...asStringArray(nested.delivery), ...asStringArray(nested.deliveryCriteria),
      ...asStringArray(nested['納品条件']), ...asStringArray(nested['納品']),
    ]),
    relatedIssueIds: unique([...asStringArray(nested.relatedIssueIds), ...asStringArray(nested.issueIds), ...asStringArray(nested.issues)]),
  };
};

export const parseDirectiveText = (rawText: string, sourceFileName = 'pasted-directive.txt'): ParsedDirectiveText => {
  const json = parseJson(rawText, sourceFileName);
  if (json) return json;
  const lines = rawText.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const title = titleFrom(lines, sourceFileName);
  const objective = firstPrefixed(lines, ['OBJECTIVE', 'GOAL', 'PURPOSE', '目的', '概要', '目標'])
    || sectionAll(lines, [/^(目的|概要|objective|goal|scope|スコープ)$/i])[0]
    || lines.find((line) => line.length >= 10 && !/^#{1,6}\s/.test(line) && !/^(?:[-*•]|\d+[.)])\s/.test(line))
    || title;
  return {
    title,
    objective,
    targetFiles: unique([...prefixedAll(lines, ['TARGET_FILE', 'TARGET_FILES', 'TARGET', '対象ファイル', '対象']), ...extractTargets(rawText)]),
    requirements: unique([...prefixedAll(lines, ['REQUIREMENT', 'REQUIREMENTS', '要件', '要求事項', '実装要求']), ...sectionAll(lines, [/要求|要件|仕様|タスク|実装内容/i])]),
    prohibitions: unique([...prefixedAll(lines, ['PROHIBITION', 'PROHIBITIONS', 'FORBIDDEN', '禁止', '禁止事項']), ...sectionAll(lines, [/禁止|forbidden|don't|やってはいけない/i])]),
    invariants: unique([...prefixedAll(lines, ['INVARIANT', 'INVARIANTS', '不変条件']), ...sectionAll(lines, [/不変条件|invariant/i])]),
    validationRequirements: unique([...prefixedAll(lines, ['VALIDATION', 'VERIFY', 'VERIFICATION', '検証条件', '検証']), ...sectionAll(lines, [/検証|validation|verification|受入/i])]),
    deliveryRequirements: unique([...prefixedAll(lines, ['DELIVERY', 'DELIVERY_REQUIREMENT', '納品条件', '納品']), ...sectionAll(lines, [/納品|delivery|提出/i])]),
    relatedIssueIds: unique(prefixedAll(lines, ['ISSUE', 'ISSUES', 'ISSUE_ID', '関連Issue'])),
  };
};

import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';

/*
 * P433: 不足部品の一周（不足特定→作る→検証→VERIFIED登録）の
 * 第1段「不足を名前・インターフェース付きで特定する」と、
 * 第2段「組み立ての中で作る」のうち、検証済み部品からの
 * つなぎ（再エクスポート）だけを担当する。
 *
 * 安全ルール:
 * - 仕様は candidateGenerationGap の記録済み内訳（契約欄・
 *   constructionGaps・unknownQuestions）からだけ導出する。
 *   導出できないものは仕様を作らない（捏造しない）。
 * - つなぎは、検証済み（VERIFIED）部品がその名前を既に
 *   公開している場合だけ作る。推測で呼び出し先を決めない。
 * - ここで作るものは全て CANDIDATE（検証待ち）として登録され、
 *   composition の材料にはならない。検証は既存の梯子
 *   （VALIDATE_CANDIDATE → Regression → Canary → VERIFIED）が
 *   駆動する。状態の飛ばし・VERIFIED直行はしない。
 */
export interface MissingComponentSpec {
  name: string;
  targetPath: string;
  inputKinds: string[];
  expectedBehavior: string;
  source: 'MISSING_COMPONENT_ID' | 'MISSING_SLOT';
  knowledgeId?: string;
  slotName?: string;
  missingComponentId?: string;
}

export interface MissingComponentGapContractInput {
  targets?: Array<{
    path: string;
    exports: string[];
    signatures: Array<{ name: string; kind: string; parameters: string[]; returnType?: string }>;
    imports: string[];
  }>;
  missingSlots?: Array<{ knowledgeId: string; slotName: string; inputKinds: string[] }>;
  missingComponentIds?: string[];
}

export interface MissingComponentGapInput {
  constructionGaps: string[];
  unknownQuestions: string[];
  contract?: MissingComponentGapContractInput;
  targetPaths: string[];
}

export interface MissingComponentAdapterDraft {
  implementation: string;
  tests: string;
  validation: string;
  sourceComponentId: string;
}

class MissingComponentSpecService {
  deriveMissingComponentSpecs(gap: MissingComponentGapInput): MissingComponentSpec[] {
    const specs: MissingComponentSpec[] = [];
    const seen = new Set<string>();
    const singleTarget = gap.targetPaths.length === 1 ? gap.targetPaths[0] : undefined;

    const push = (spec: MissingComponentSpec): void => {
      if (!spec.name || seen.has(spec.name)) return;
      seen.add(spec.name);
      specs.push(spec);
    };

    const targetForId = (id: string): string | undefined => {
      for (const target of gap.contract?.targets ?? []) {
        if (!target || typeof target.path !== 'string' || !target.path) continue;
        if (
          (Array.isArray(target.exports) && target.exports.includes(id)) ||
          (Array.isArray(target.signatures) && target.signatures.some((signature) => signature?.name === id))
        ) {
          return target.path;
        }
      }
      return singleTarget;
    };

    const expectedBehaviorFor = (key: string): string =>
      (gap.unknownQuestions ?? []).find((question) => question.includes(key)) || '';

    for (const id of gap.contract?.missingComponentIds ?? []) {
      if (typeof id !== 'string' || !id.trim()) continue;
      const name = sanitizeIdentifier(id);
      if (!name) continue;
      const targetPath = targetForId(id);
      if (!targetPath) continue;
      push({
        name,
        targetPath,
        inputKinds: [],
        expectedBehavior: expectedBehaviorFor(id),
        source: 'MISSING_COMPONENT_ID',
        missingComponentId: id,
      });
    }

    for (const slot of gap.contract?.missingSlots ?? []) {
      if (!slot || typeof slot.slotName !== 'string' || !slot.slotName || typeof slot.knowledgeId !== 'string' || !slot.knowledgeId) continue;
      const name = sanitizeIdentifier(`missing_${slot.knowledgeId}_${slot.slotName}`);
      if (!name) continue;
      // スロットには対象ファイルが付いていない。対象が1件のときだけ
      // 仕様化し、複数ある場合は推測で対象を決めない。
      if (!singleTarget) continue;
      push({
        name,
        targetPath: singleTarget,
        inputKinds: Array.isArray(slot.inputKinds) ? slot.inputKinds.filter((value): value is string => typeof value === 'string') : [],
        expectedBehavior: expectedBehaviorFor(slot.slotName),
        source: 'MISSING_SLOT',
        knowledgeId: slot.knowledgeId,
        slotName: slot.slotName,
      });
    }

    for (const raw of gap.constructionGaps ?? []) {
      if (typeof raw !== 'string') continue;
      const body = raw.startsWith('CONSTRUCTION_GAP:') ? raw.slice('CONSTRUCTION_GAP:'.length) : raw;
      const match = body.match(/^(?:CODE_COMPONENT_MISSING|CONSTRUCTION_DEFINITION_MISSING|CODE_COMPONENT_UNLINKED):(.+)$/);
      if (!match) continue;
      const id = match[1].trim();
      if (!id) continue;
      const name = sanitizeIdentifier(id);
      if (!name) continue;
      const targetPath = targetForId(id);
      if (!targetPath) continue;
      push({
        name,
        targetPath,
        inputKinds: [],
        expectedBehavior: expectedBehaviorFor(id),
        source: 'MISSING_COMPONENT_ID',
        missingComponentId: id,
      });
    }

    return specs.slice(0, 8);
  }

  /*
   * 検証済み部品からのつなぎ。不足している名前を、VERIFIED部品が
   * 既に公開している場合だけ、その対象ファイルへ再エクスポートする
   * 1行を足した候補本文を作る。公開している部品が0件・複数件の
   * 場合は作らない（どちらを呼ぶか推測しない）。候補本文は対象
   * ファイルの現在内容そのままで、つなぎの1行だけが新しい。
   */
  buildAdapterDraft(
    spec: MissingComponentSpec,
    targetContent: string,
    validationRequirements: string[],
  ): MissingComponentAdapterDraft | undefined {
    if (!spec.name || !spec.targetPath || !targetContent.trim()) return undefined;
    if (targetExportsName(targetContent, spec.name)) return undefined;
    const source = this.findVerifiedExporter(spec.name, spec.targetPath);
    if (!source) return undefined;
    const relativePath = relativeImportPath(spec.targetPath, source.entryPoint);
    if (!relativePath) return undefined;
    const line = `export { ${spec.name} } from '${relativePath}';`;
    if (targetContent.includes(line)) return undefined;
    const implementation = `${targetContent.trimEnd()}\n${line}\n`;
    return {
      implementation,
      tests: `Missing component ${spec.name} is re-exported from VERIFIED ${source.componentId}; the import must resolve and the export must exist.`,
      validation: [
        `MISSING_COMPONENT_SPEC=${spec.name}`,
        `MISSING_COMPONENT_ADAPTER=${spec.name}`,
        `SOURCE_VERIFIED_COMPONENT=${source.componentId}`,
        ...(spec.expectedBehavior ? [`EXPECTED_BEHAVIOR=${spec.expectedBehavior}`] : []),
        ...validationRequirements,
      ].join('\n'),
      sourceComponentId: source.componentId,
    };
  }

  private findVerifiedExporter(
    name: string,
    excludeTargetPath: string,
  ): { componentId: string; entryPoint: string } | undefined {
    let found: { componentId: string; entryPoint: string } | undefined;
    for (const component of componentRegistryService.getAllComponents()) {
      if (component.status !== 'VERIFIED') continue;
      if (!component.entry_point || component.entry_point === excludeTargetPath) continue;
      const artifact = componentArtifactStoreService.get(component.component_id);
      if (!artifact) continue;
      const content = extractFileContent(artifact.implementation_txt);
      if (!content) continue;
      if (!exportedNames(content).has(name)) continue;
      // 公開している部品が複数ある場合は、どちらか推測しない。
      if (found) return undefined;
      found = { componentId: component.component_id, entryPoint: component.entry_point };
    }
    return found;
  }
}

function sanitizeIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^(\d)/, '_$1').slice(0, 100);
  return cleaned.replace(/^_+$/, '') ? cleaned : '';
}

function extractFileContent(implementationTxt: string): string {
  const begin = implementationTxt.indexOf('FILE_CONTENT_BEGIN');
  const end = implementationTxt.indexOf('FILE_CONTENT_END');
  if (begin < 0 || end <= begin) return '';
  return implementationTxt.slice(begin + 'FILE_CONTENT_BEGIN'.length, end).trim();
}

function exportedNames(content: string): Set<string> {
  const names = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)/g,
    /export\s*\{([^}]*)\}/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (pattern.source.includes('\\{')) {
        for (const part of match[1].split(',')) {
          const alias = part.split(/\s+as\s+/).map((value) => value.trim()).filter(Boolean);
          const exported = alias.length > 1 ? alias[1] : alias[0];
          if (exported) names.add(exported);
        }
      } else if (match[1]) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

function targetExportsName(content: string, name: string): boolean {
  if (exportedNames(content).has(name)) return true;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`export\\s+default\\s+${escaped}\\b`).test(content);
}

function relativeImportPath(fromPath: string, toPath: string): string {
  const fromParts = fromPath.split('/').slice(0, -1);
  const toParts = toPath.replace(/\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/, '').split('/');
  if (fromParts.length === 0 || toParts.length === 0) return '';
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common++;
  const up = fromParts.length - common;
  const relative = [...Array<string>(up).fill('..'), ...toParts.slice(common)].join('/');
  if (!relative) return '';
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export const missingComponentSpecService = new MissingComponentSpecService();

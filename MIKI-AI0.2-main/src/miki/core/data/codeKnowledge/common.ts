export interface CodeConstructionSlot {
  name: string;
  inputKinds: string[];
  required: boolean;
  multiple?: boolean;
}

export interface CodeConstructionProfile {
  kind: 'STATEMENT'|'EXPRESSION'|'DECLARATION'|'TYPE'|'CALL'|'MODULE'|'ASYNC';
  syntaxTemplate: string;
  outputKinds?: string[];
  slots: CodeConstructionSlot[];
  constraints: string[];
  adaptationRules: string[];
}

export interface CodeConstructionNode {
  nodeId: string;
  knowledgeComponentId: string;
  codeComponentId?: string;
  registryComponentId?: string;
  implementationTemplate?: string;
  componentType: string;
  purpose: string;
  profile: CodeConstructionProfile;
}

export interface CodeConstructionBinding {
  targetNodeId: string;
  slotName: string;
  sourceNodeId?: string;
  value?: string;
  valueKind?: string;
}

export interface CodeConstructionGraph {
  graphId: string;
  goal: string;
  rootNodeId?: string;
  nodes: CodeConstructionNode[];
  bindings: CodeConstructionBinding[];
  unresolvedSlots?: string[];
  contractErrors?: string[];
}

export function normalizeConstructionKind(kind: string): string {
  return String(kind || '').trim().toLowerCase();
}

/**
 * Construction Graph専用の決定論的I/O互換判定。
 * 完全一致を基本とし、安全に一般化できる型だけを明示的に互換扱いする。
 */
export function isCompatibleConstructionKind(
  actualKind: string,
  expectedKind: string,
): boolean {
  const actual = normalizeConstructionKind(actualKind);
  const expected = normalizeConstructionKind(expectedKind);

  if (!actual || !expected) return false;
  if (actual === expected) return true;

  // expression は具体的 expression 型を受け取れる一般契約。
  if (
    expected === 'expression' &&
    (actual === 'expression' || actual.endsWith('-expression'))
  ) {
    return true;
  }

  // JSX child は JSX expression / text を子として利用できる。
  if (
    expected === 'jsx-child' &&
    ['jsx-child', 'jsx-expression', 'jsx-text'].includes(actual)
  ) {
    return true;
  }

  // Iterableな式は、for-of等のiterable-expression入力へ接続できる。
  if (
    expected === 'iterable-expression' &&
    ['array-expression', 'string-expression', 'iterable-expression'].includes(actual)
  ) {
    return true;
  }

  return false;
}

export interface CodeKnowledgeDefinition {
  id: string;
  componentType: string;
  purpose: string;
  summary: string;
  concepts: string[];
  inputs: string[];
  outputs: string[];
  appliesWhen: string[];
  doesNotApplyWhen: string[];
  sourceUrls: string[];
  sourceArtifactIds: string[];
  constructionProfile?: CodeConstructionProfile;
}

export interface CodeComponentDefinition {
  knowledgeId: string;
  componentType: string;
  purpose: string;
  implementation: string;
  targetPath: string;
  inputs: string[];
  outputs: string[];
  prerequisites: string[];
  dependencies: string[];
  supportedEnvironments: string[];
  entryPoint: string;
  securityClass: 'READ_ONLY'|'STANDARD';
  exports: string[];
  imports: string[];
  publicInterfaces: string[];
  tests: string;
  validation: string;
}

export const commonCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.common.variables',
    componentType: 'CODE_CONCEPT',
    purpose: '変数と定数を適切に使い分ける',
    summary: '値を保持する名前付き領域を扱い、再代入が不要な値には定数を優先する。',
    concepts: ['variable', 'constant', 'scope', 'assignment', 'immutability'],
    inputs: ['value', 'scope'],
    outputs: ['named value binding'],
    appliesWhen: ['値を保持する', '状態を表現する', '設定値を定義する'],
    doesNotApplyWhen: ['単なる一時的な式評価だけで名前付けが不要な場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Grammar_and_types'],
    sourceArtifactIds: ['mdn-javascript-guide-grammar-types'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'const {name} = {value};',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'name must be a valid identifier',
        'prefer const when reassignment is unnecessary'
      ],
      adaptationRules: [
        'use let when reassignment is required'
      ],
    },
  },
  {
    id: 'code.common.functions',
    componentType: 'CODE_CONCEPT',
    purpose: '入力と処理と結果を関数として分離する',
    summary: '関数は処理の境界を作り、入力・出力・副作用を明確にして再利用可能な単位にする。',
    concepts: ['function', 'parameter', 'return', 'scope', 'side-effect'],
    inputs: ['arguments'],
    outputs: ['return value'],
    appliesWhen: ['処理を再利用する', '責務を分離する'],
    doesNotApplyWhen: ['極端に単純で分離による意味が増えない式'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Functions'],
    sourceArtifactIds: ['mdn-javascript-guide-functions'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'function {name}({parameters}) {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true},
        {name: 'body', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: [
        'parameters must be declared before use',
        'return values must satisfy the function contract'
      ],
      adaptationRules: [
        'use an arrow function when expression-style or callback form is required'
      ],
    },
  },
  {
    id: 'code.common.collections',
    componentType: 'CODE_CONCEPT',
    purpose: '複数データを適切なコレクションで表現する',
    summary: 'Array、Object、Map、Setなどをデータの性質と操作目的に応じて選択する。',
    concepts: ['Array', 'Object', 'Map', 'Set', 'iteration'],
    inputs: ['multiple values'],
    outputs: ['structured collection'],
    appliesWhen: ['複数値を扱う', '検索・列挙・重複排除が必要'],
    doesNotApplyWhen: ['単一値だけを表現する場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Indexed_collections'],
    sourceArtifactIds: ['mdn-javascript-collections'],
  },
  {
    id: 'code.common.error-handling',
    componentType: 'CODE_CONCEPT',
    purpose: '失敗を通常結果と区別して安全に処理する',
    summary: '例外、戻り値、失敗状態を設計し、失敗を成功として扱わない。',
    concepts: ['throw', 'try', 'catch', 'error', 'failure-path'],
    inputs: ['operation'],
    outputs: ['success or explicit failure'],
    appliesWhen: ['外部入力', 'I/O', '解析', 'ネットワーク', '不確実な処理'],
    doesNotApplyWhen: ['失敗しないことが構造的に保証される単純な計算'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Control_flow_and_error_handling'],
    sourceArtifactIds: ['mdn-javascript-error-handling'],
  },
  {
    id: 'code.common.modules',
    componentType: 'CODE_CONCEPT',
    purpose: 'コードをモジュール境界で分割し依存関係を明示する',
    summary: 'モジュールは責務と依存関係を分離し、公開するものだけをexportする。',
    concepts: ['module', 'import', 'export', 'dependency', 'boundary'],
    inputs: ['module dependency'],
    outputs: ['isolated module'],
    appliesWhen: ['複数ファイルで構成する', '依存関係を明示する'],
    doesNotApplyWhen: ['単一の短いスクリプトで分割が不要な場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds: ['typescript-handbook-modules'],
  },
  {
    id: 'code.common.async',
    componentType: 'CODE_CONCEPT',
    purpose: '非同期処理の開始・完了・失敗を明確に扱う',
    summary: 'Promiseなどを使い、非同期処理の結果を明示的な成功・失敗経路として扱う。',
    concepts: ['async', 'await', 'Promise', 'resolution', 'rejection'],
    inputs: ['asynchronous operation'],
    outputs: ['eventual result'],
    appliesWhen: ['ネットワーク', 'ファイル', '非同期API', '並行処理'],
    doesNotApplyWhen: ['同期処理だけで完結する場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Using_promises'],
    sourceArtifactIds: ['mdn-javascript-promises'],
  },
];

export const additionalCommonCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.common.immutability',
    componentType: 'CODE_DESIGN_CONCEPT',
    purpose: '状態変更を必要最小限にして予測可能な処理を作る',
    summary: '入力データを不用意に変更せず、変更が必要な境界を明示する。',
    concepts: ['immutability', 'mutation', 'copy', 'state'],
    inputs: ['state'],
    outputs: ['updated state'],
    appliesWhen: ['状態管理', '共有データ', '再利用可能Component'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Glossary/Immutable'],
    sourceArtifactIds: ['mdn-immutable-glossary'],
  },
  {
    id: 'code.common.data-transformation',
    componentType: 'CODE_DESIGN_CONCEPT',
    purpose: '入力データと内部データの変換境界を明確にする',
    summary: '外部入力をそのまま内部状態に流さず、必要な形へ変換してから処理する。',
    concepts: ['mapping', 'transformation', 'normalization', 'boundary'],
    inputs: ['external or raw data'],
    outputs: ['normalized data'],
    appliesWhen: ['API', 'ファイル', 'ユーザー入力', 'Component接続'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Glossary/Serialization'],
    sourceArtifactIds: ['mdn-data-boundary'],
  },
  {
    id: 'code.common.dependency-boundary',
    componentType: 'CODE_DESIGN_CONCEPT',
    purpose: '外部依存を処理本体から分離する',
    summary: '外部サービスやストレージへの依存を境界に置き、内部処理を再利用・検証しやすくする。',
    concepts: ['dependency', 'adapter', 'boundary', 'separation'],
    inputs: ['external dependency'],
    outputs: ['isolated domain operation'],
    appliesWhen: ['サービス統合', 'テスト', 'Component設計'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Glossary/Abstraction'],
    sourceArtifactIds: ['mdn-abstraction-glossary'],
  },
];

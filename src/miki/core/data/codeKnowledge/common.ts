export interface CodeKnowledgeSeed {
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
}

export const commonCodeKnowledge: CodeKnowledgeSeed[] = [
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

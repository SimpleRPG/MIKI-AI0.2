import type { CodeKnowledgeDefinition, CodeComponentDefinition } from './common';

export const javascriptCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.javascript.syntax-and-types',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'JavaScriptの基本構文と実行時型を理解する',
    summary: 'JavaScriptの宣言、値、型、スコープなどの基本構造を扱う。',
    concepts: ['let', 'const', 'string', 'number', 'boolean', 'null', 'undefined', 'scope'],
    inputs: ['JavaScript source'],
    outputs: ['runtime values'],
    appliesWhen: ['JavaScriptコードを解析・生成する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Grammar_and_types'],
    sourceArtifactIds: ['mdn-javascript-guide-grammar-types'],
  },
  {
    id: 'code.javascript.control-flow',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: '条件分岐と反復をJavaScriptで構成する',
    summary: 'if、switch、for、while、for-ofなどで処理経路を構成する。',
    concepts: ['if', 'switch', 'for', 'while', 'for-of', 'break', 'continue'],
    inputs: ['condition', 'iterable'],
    outputs: ['controlled execution flow'],
    appliesWhen: ['条件によって処理を変える', '集合を反復する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Control_flow_and_error_handling'],
    sourceArtifactIds: ['mdn-javascript-control-flow'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'if ({condition}) {\\n{thenBody}\\n} else {\\n{elseBody}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'condition', inputKinds: ['boolean-expression'], required: true},
        {name: 'thenBody', inputKinds: ['statement'], required: true, multiple: true},
        {name: 'elseBody', inputKinds: ['statement'], required: false, multiple: true},
      ],
      constraints: [
        'condition must be boolean-compatible',
        'branches must contain valid statements'
      ],
      adaptationRules: [
        'omit else when no alternate branch is required',
        'use switch when multiple discrete cases are clearer'
      ],
    },
  },
  {
    id: 'code.javascript.arrays',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'JavaScript Arrayを変換・検索・反復に利用する',
    summary: 'Arrayは順序付き集合として扱い、map/filter/reduceなど目的に応じた操作を選ぶ。',
    concepts: ['Array', 'map', 'filter', 'reduce', 'find', 'forEach'],
    inputs: ['array'],
    outputs: ['transformed or selected data'],
    appliesWhen: ['順序付きデータ集合を扱う'],
    doesNotApplyWhen: ['キーによる一意検索が主目的の場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Indexed_collections'],
    sourceArtifactIds: ['mdn-javascript-arrays'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.{operation}({callback})',
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'operation', inputKinds: ['map|filter|reduce|find|forEach'], required: true},
        {name: 'callback', inputKinds: ['function-expression'], required: true},
      ],
      constraints: [
        'operation must match the intended output contract'
      ],
      adaptationRules: [
        'use forEach when no transformed collection is required',
        'use map/filter/reduce according to output semantics'
      ],
    },
  },
  {
    id: 'code.javascript.objects',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'JavaScript Objectで関連する値と振る舞いをまとめる',
    summary: 'オブジェクトのプロパティとメソッドを使ってデータと振る舞いを構造化する。',
    concepts: ['object', 'property', 'method', 'prototype', 'destructuring'],
    inputs: ['related values'],
    outputs: ['structured object'],
    appliesWhen: ['関連するデータをまとめる'],
    doesNotApplyWhen: ['単純な順序付き集合だけを扱う場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Working_with_objects'],
    sourceArtifactIds: ['mdn-javascript-objects'],
  },
  {
    id: 'code.javascript.promise',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'Promiseによる非同期処理を構成する',
    summary: 'Promiseのresolve/rejectとthen/catch/finallyを使い、非同期結果を連鎖・合成する。',
    concepts: ['Promise', 'then', 'catch', 'finally', 'Promise.all', 'Promise.allSettled'],
    inputs: ['async operations'],
    outputs: ['Promise result'],
    appliesWhen: ['複数の非同期処理', '非同期エラー処理'],
    doesNotApplyWhen: ['完全な同期処理'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Using_promises'],
    sourceArtifactIds: ['mdn-javascript-promises'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'const {result} = await {operation};',
      outputKinds: ['statement'],
      slots: [
        {name: 'result', inputKinds: ['identifier'], required: false},
        {name: 'operation', inputKinds: ['promise-expression'], required: true},
      ],
      constraints: [
        'await must be inside an async function or supported async context'
      ],
      adaptationRules: [
        'use Promise.all for independent concurrent operations'
      ],
    },
  },
  {
    id: 'code.javascript.modules',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'JavaScript ES Modulesで依存関係を分離する',
    summary: 'import/exportを利用してモジュール間の公開境界を明示する。',
    concepts: ['import', 'export', 'default', 'named export', 'module boundary'],
    inputs: ['module definitions'],
    outputs: ['module dependency graph'],
    appliesWhen: ['複数モジュールを構成する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Modules'],
    sourceArtifactIds: ['mdn-javascript-modules'],
  }
];

export const additionalJavascriptCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.javascript.destructuring',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: '配列・オブジェクトから必要な値だけを明示的に取り出す',
    summary: 'Destructuring assignmentを使ってデータ構造と利用する値の対応を明確にする。',
    concepts: ['destructuring', 'object', 'array', 'rest'],
    inputs: ['object or array'],
    outputs: ['named values'],
    appliesWhen: ['引数', 'レスポンス', '設定値', '構造化データ'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring'],
    sourceArtifactIds: ['mdn-js-destructuring'],
  },
  {
    id: 'code.javascript.optional-chaining',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: '存在しない可能性のある値を安全に参照する',
    summary: 'Optional chainingでnullishな中間値による例外を避け、存在しない値を明示的に扱う。',
    concepts: ['optional chaining', 'null', 'undefined', '?.'],
    inputs: ['possibly-null value'],
    outputs: ['value or undefined'],
    appliesWhen: ['外部入力', 'APIレスポンス', 'optional data'],
    doesNotApplyWhen: ['値の存在が必須で検証済みの場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining'],
    sourceArtifactIds: ['mdn-js-optional-chaining'],
  },
  {
    id: 'code.javascript.nullish-coalescing',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'nullまたはundefinedの場合だけ既定値へフォールバックする',
    summary: 'Nullish coalescing operatorを使い、falsy全般とnullishを区別して既定値を選択する。',
    concepts: ['nullish coalescing', 'null', 'undefined', 'default'],
    inputs: ['possibly-null value'],
    outputs: ['resolved value'],
    appliesWhen: ['既定値', 'optional configuration'],
    doesNotApplyWhen: ['falseや0や空文字も既定値扱いしたい場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing'],
    sourceArtifactIds: ['mdn-js-nullish-coalescing'],
  },
  {
    id: 'code.javascript.closure',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: '関数が外側のスコープを参照する仕組みを利用する',
    summary: 'Closureにより関数とその関数が参照する外部状態を組み合わせて扱える。',
    concepts: ['closure', 'lexical scope', 'function', 'encapsulation'],
    inputs: ['outer scope'],
    outputs: ['function with retained access'],
    appliesWhen: ['状態保持', 'callback', 'factory'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures'],
    sourceArtifactIds: ['mdn-js-closures'],
  },
  {
    id: 'code.javascript.event-loop',
    componentType: 'RUNTIME_CONCEPT',
    purpose: 'JavaScriptの非同期実行順序を理解する',
    summary: 'Call stack、job queue、event loopの関係を理解し、同期処理と非同期処理の実行順序を判断する。',
    concepts: ['event loop', 'call stack', 'job queue', 'microtask', 'task'],
    inputs: ['scheduled operations'],
    outputs: ['execution ordering'],
    appliesWhen: ['Promise', 'timer', 'イベント', '非同期デバッグ'],
    doesNotApplyWhen: ['同期処理のみ'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model'],
    sourceArtifactIds: ['mdn-js-execution-model'],
  },

  {
        id: 'code.javascript.const-declaration',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '再代入しない値をconstとして宣言する',
        summary: 'JavaScriptのconst宣言による名前付き値の定義。',
        concepts: ['const', 'variable', 'binding', 'scope'],
        inputs: ['identifier', 'expression'],
        outputs: ['statement'],
        appliesWhen: ['値を定義する', '再代入しない値を宣言する'],
        doesNotApplyWhen: ['再代入が必要な変数'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Grammar_and_types'],
        sourceArtifactIds: ['mdn-const-declaration'],
        constructionProfile: {
          kind: 'DECLARATION',
          syntaxTemplate: 'const {name} = {value};',
          outputKinds: ['statement'],
          slots: [
            { name: 'name', inputKinds: ['identifier'], required: true },
            { name: 'value', inputKinds: ['expression'], required: true },
          ],
          constraints: ['name must be a valid identifier'],
          adaptationRules: ['use let when reassignment is required'],
        },
      },
  {
        id: 'code.javascript.function-declaration',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '入力と処理を関数として再利用可能な単位にする',
        summary: '関数宣言によって処理境界と入出力を明示する。',
        concepts: ['function', 'parameter', 'return', 'scope'],
        inputs: ['identifier', 'parameter', 'statement'],
        outputs: ['statement'],
        appliesWhen: ['再利用可能な処理を定義する'],
        doesNotApplyWhen: ['単一式だけで関数化が不要な場合'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Functions'],
        sourceArtifactIds: ['mdn-functions'],
        constructionProfile: {
          kind: 'DECLARATION',
          syntaxTemplate: 'function {name}({parameters}) {\\n{body}\\n}',
          outputKinds: ['statement'],
          slots: [
            { name: 'name', inputKinds: ['identifier'], required: true },
            { name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true },
            { name: 'body', inputKinds: ['statement'], required: true, multiple: true },
          ],
          constraints: ['function name must be a valid identifier'],
          adaptationRules: ['use async function when the body requires await'],
        },
      },
  {
        id: 'code.javascript.if-statement',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '条件に応じて処理を分岐する',
        summary: 'boolean条件に基づくif/else分岐。',
        concepts: ['if', 'condition', 'branch'],
        inputs: ['boolean-expression', 'statement'],
        outputs: ['statement'],
        appliesWhen: ['条件分岐が必要'],
        doesNotApplyWhen: ['条件評価自体が不要'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Statements/if...else'],
        sourceArtifactIds: ['mdn-if-else'],
        constructionProfile: {
          kind: 'STATEMENT',
          syntaxTemplate: 'if ({condition}) {\\n{thenBody}\\n} else {\\n{elseBody}\\n}',
          outputKinds: ['statement'],
          slots: [
            { name: 'condition', inputKinds: ['boolean-expression'], required: true },
            { name: 'thenBody', inputKinds: ['statement'], required: true, multiple: true },
            { name: 'elseBody', inputKinds: ['statement'], required: false, multiple: true },
          ],
          constraints: ['condition must evaluate to boolean-compatible value'],
          adaptationRules: ['remove else when no alternate branch is required'],
        },
      },
  {
        id: 'code.javascript.for-of',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '反復可能なデータを順番に処理する',
        summary: 'for...ofによるiterableの順次処理。',
        concepts: ['for-of', 'iteration', 'iterable'],
        inputs: ['identifier', 'iterable-expression', 'statement'],
        outputs: ['statement'],
        appliesWhen: ['配列やiterableを順次処理する'],
        doesNotApplyWhen: ['indexが必要な特別な処理'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Statements/for...of'],
        sourceArtifactIds: ['mdn-for-of'],
        constructionProfile: {
          kind: 'STATEMENT',
          syntaxTemplate: 'for (const {item} of {iterable}) {\\n{body}\\n}',
          outputKinds: ['statement'],
          slots: [
            { name: 'item', inputKinds: ['identifier'], required: true },
            { name: 'iterable', inputKinds: ['iterable-expression'], required: true },
            { name: 'body', inputKinds: ['statement'], required: true, multiple: true },
          ],
          constraints: ['iterable must implement the iterable protocol'],
          adaptationRules: ['use index-based loop only when index semantics are required'],
        },
      },
  {
        id: 'code.javascript.array-map',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '配列要素を変換して新しい配列を作る',
        summary: 'Array.prototype.mapによる要素変換。',
        concepts: ['Array.map', 'array', 'transformation'],
        inputs: ['array-expression', 'function-expression'],
        outputs: ['array-expression'],
        appliesWhen: ['各要素を変換して新しい配列を作る'],
        doesNotApplyWhen: ['副作用だけが目的の反復'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/map'],
        sourceArtifactIds: ['mdn-array-map'],
        constructionProfile: {
          kind: 'EXPRESSION',
          syntaxTemplate: '{array}.map({mapper})',
          outputKinds: ['array-expression'],
          slots: [
            { name: 'array', inputKinds: ['array-expression'], required: true },
            { name: 'mapper', inputKinds: ['function-expression'], required: true },
          ],
          constraints: ['mapper receives element, index and array'],
          adaptationRules: ['use forEach when no transformed array is required'],
        },
      },
  {
        id: 'code.javascript.array-filter',
        componentType: 'CODE_CONSTRUCTION',
        purpose: '条件を満たす配列要素だけを抽出する',
        summary: 'Array.prototype.filterによる選択。',
        concepts: ['Array.filter', 'predicate', 'array'],
        inputs: ['array-expression', 'function-expression'],
        outputs: ['array-expression'],
        appliesWhen: ['条件に一致する要素を抽出する'],
        doesNotApplyWhen: ['要素変換が主目的'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/filter'],
        sourceArtifactIds: ['mdn-array-filter'],
        constructionProfile: {
          kind: 'EXPRESSION',
          syntaxTemplate: '{array}.filter({predicate})',
          outputKinds: ['array-expression'],
          slots: [
            { name: 'array', inputKinds: ['array-expression'], required: true },
            { name: 'predicate', inputKinds: ['function-expression'], required: true },
          ],
          constraints: ['predicate must return a truthy/falsy value'],
          adaptationRules: ['use map when every element should be transformed'],
        },
      },
  {
        id: 'code.javascript.async-await',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'Promise結果をawaitして順序制御する',
        summary: 'async/awaitによる非同期処理の構造化。',
        concepts: ['async', 'await', 'Promise'],
        inputs: ['identifier', 'promise-expression'],
        outputs: ['statement'],
        appliesWhen: ['Promise結果を順序立てて扱う'],
        doesNotApplyWhen: ['同期処理のみで完結する'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Statements/async_function'],
        sourceArtifactIds: ['mdn-async-function'],
        constructionProfile: {
          kind: 'ASYNC',
          syntaxTemplate: 'const {result} = await {operation};',
          outputKinds: ['statement'],
          slots: [
            { name: 'result', inputKinds: ['identifier'], required: false },
            { name: 'operation', inputKinds: ['promise-expression'], required: true },
          ],
          constraints: ['await must be inside an async execution context'],
          adaptationRules: ['omit result binding when only completion is needed'],
        },
      },
  {
        id: 'code.javascript.json-parse',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'JSON文字列をJavaScript値へ変換する',
        summary: 'JSON.parseによる構造化データの解析。',
        concepts: ['JSON.parse', 'JSON', 'parsing'],
        inputs: ['string-expression'],
        outputs: ['expression'],
        appliesWhen: ['JSON文字列をオブジェクトへ変換する'],
        doesNotApplyWhen: ['入力がJSONではない'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse'],
        sourceArtifactIds: ['mdn-json-parse'],
        constructionProfile: {
          kind: 'CALL',
          syntaxTemplate: 'JSON.parse({text})',
          outputKinds: ['expression'],
          slots: [
            { name: 'text', inputKinds: ['string-expression'], required: true },
          ],
          constraints: ['input must be valid JSON text'],
          adaptationRules: ['add reviver only when explicitly required'],
        },
      },
  {
        id: 'code.javascript.node-read-file',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'Node.js fs/promisesでファイルを非同期読み込みする',
        summary: 'Node.js公式APIのreadFileによる非同期ファイル読み込み。',
        concepts: ['Node.js', 'fs/promises', 'readFile', 'Promise'],
        inputs: ['string-expression'],
        outputs: ['promise-expression'],
        appliesWhen: ['Node.js環境でファイルを読む'],
        doesNotApplyWhen: ['ブラウザ専用環境'],
        sourceUrls: ['https://nodejs.org/api/fs'],
        sourceArtifactIds: ['node-fs-readfile'],
        constructionProfile: {
          kind: 'CALL',
syntaxTemplate: "readFile({path}, 'utf8')",
          outputKinds: ['promise-expression'],
          slots: [
            { name: 'path', inputKinds: ['string-expression'], required: true },
          ],
          constraints: ['filesystem access must be allowed'],
          adaptationRules: ['add encoding/options only when required'],
        },
      },

  {
    id: 'code.javascript.arrow-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数を式として定義しcallbackや値として渡せる形にする',
    summary: 'Arrow Functionを使って関数式を構成する。',
    concepts: ['arrow function', 'callback', 'function expression'],
    inputs: ['parameter', 'expression'],
    outputs: ['function-expression', 'expression'],
    appliesWhen: ['callbackを作る', '関数を値として渡す', '短い関数を定義する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions'],
    sourceArtifactIds: ['mdn-arrow-functions'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '({parameters}) => {body}',
      outputKinds: ['function-expression', 'expression'],
      slots: [
        {name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true},
        {name: 'body', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'body must be a valid expression',
        'parameters must be valid function parameters'
      ],
      adaptationRules: [
        'use block body when multiple statements are required'
      ],
    },
  },
  {
    id: 'code.javascript.function-call',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存関数やComponentを引数付きで呼び出す',
    summary: '関数呼び出し式を構成し、その結果を後続処理へ渡す。',
    concepts: ['function call', 'arguments', 'invocation'],
    inputs: ['expression'],
    outputs: ['expression', 'statement'],
    appliesWhen: ['関数を呼び出す', '既存Componentを利用する'],
    doesNotApplyWhen: ['関数呼び出し自体が不要な処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof'],
    sourceArtifactIds: ['mdn-function-call-expression'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{callee}({arguments})',
      outputKinds: ['expression', 'statement'],
      slots: [
        {name: 'callee', inputKinds: ['function-expression', 'identifier', 'expression'], required: true},
        {name: 'arguments', inputKinds: ['expression'], required: false, multiple: true},
      ],
      constraints: [
        'callee must be callable',
        'arguments must satisfy the function contract'
      ],
      adaptationRules: [
        'omit parentheses arguments when none are required'
      ],
    },
  },
  {
    id: 'code.javascript.return',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数処理の結果をreturnで返す',
    summary: '関数の出力値を明示するreturn文を構成する。',
    concepts: ['return', 'function result'],
    inputs: ['expression'],
    outputs: ['statement'],
    appliesWhen: ['関数から結果を返す', '処理結果を後段へ渡す'],
    doesNotApplyWhen: ['戻り値を持たない処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return'],
    sourceArtifactIds: ['mdn-return'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'return {value};',
      outputKinds: ['statement'],
      slots: [
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'return must occur inside a function body'
      ],
      adaptationRules: [
        'use return; when no value is intentionally returned'
      ],
    },
  },
  {
    id: 'code.javascript.assignment',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存の変数やプロパティへ値を代入する',
    summary: '代入式を構成し、状態更新を明示する。',
    concepts: ['assignment', 'mutation', 'binding'],
    inputs: ['identifier', 'expression'],
    outputs: ['statement', 'expression'],
    appliesWhen: ['状態を更新する', '変数へ再代入する'],
    doesNotApplyWhen: ['再代入が不要な定数定義'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Assignment'],
    sourceArtifactIds: ['mdn-assignment-operator'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{target} = {value};',
      outputKinds: ['statement', 'expression'],
      slots: [
        {name: 'target', inputKinds: ['identifier', 'property-expression'], required: true},
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'target must be assignable'
      ],
      adaptationRules: [
        'use const instead when reassignment is not required'
      ],
    },
  },
  {
    id: 'code.javascript.comparison',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '値同士を比較してboolean条件を作る',
    summary: '等価・大小などの比較演算から条件式を構成する。',
    concepts: ['comparison', 'strict equality', 'relational operator', 'boolean'],
    inputs: ['expression', 'operator'],
    outputs: ['boolean-expression', 'expression'],
    appliesWhen: ['条件判定', '値を比較する', 'if条件を作る'],
    doesNotApplyWhen: ['比較を必要としない固定条件'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators'],
    sourceArtifactIds: ['mdn-comparison-operators'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{left} {operator} {right}',
      outputKinds: ['boolean-expression', 'expression'],
      slots: [
        {name: 'left', inputKinds: ['expression'], required: true},
        {name: 'operator', inputKinds: ['comparison-operator'], required: true},
        {name: 'right', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'operator must be compatible with operand types'
      ],
      adaptationRules: [
        'prefer strict equality when equality comparison is intended'
      ],
    },
  },
  {
    id: 'code.javascript.logical',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数条件を論理演算で組み合わせる',
    summary: 'AND、OR、NOTなどでboolean条件を構成する。',
    concepts: ['logical operator', 'AND', 'OR', 'NOT', 'boolean'],
    inputs: ['boolean-expression'],
    outputs: ['boolean-expression', 'expression'],
    appliesWhen: ['複数条件を組み合わせる', '条件を否定する'],
    doesNotApplyWhen: ['単一条件だけで判定できる場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators'],
    sourceArtifactIds: ['mdn-logical-operators'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{left} {operator} {right}',
      outputKinds: ['boolean-expression', 'expression'],
      slots: [
        {name: 'left', inputKinds: ['boolean-expression'], required: true},
        {name: 'operator', inputKinds: ['logical-operator'], required: true},
        {name: 'right', inputKinds: ['boolean-expression'], required: false},
      ],
      constraints: [
        'AND and OR require compatible condition expressions'
      ],
      adaptationRules: [
        'use unary ! when only negation is required'
      ],
    },
  },
  {
    id: 'code.javascript.array-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数の値からArrayを構成する',
    summary: 'Array literalを構成し、後続のmap/filter/for-of等へ渡せる集合を作る。',
    concepts: ['Array', 'array literal', 'elements'],
    inputs: ['expression'],
    outputs: ['array-expression', 'expression'],
    appliesWhen: ['配列を作る', '複数値をまとめる'],
    doesNotApplyWhen: ['単一値だけを扱う場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Indexed_collections'],
    sourceArtifactIds: ['mdn-array-literals'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '[{elements}]',
      outputKinds: ['array-expression', 'expression'],
      slots: [
        {name: 'elements', inputKinds: ['expression'], required: false, multiple: true},
      ],
      constraints: [
        'elements must form a valid array literal'
      ],
      adaptationRules: [
        'allow empty array when no initial elements are required'
      ],
    },
  },
  {
    id: 'code.javascript.object-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関連する値からObjectを構成する',
    summary: 'Object literalを構成し、構造化されたデータを作る。',
    concepts: ['Object', 'object literal', 'property'],
    inputs: ['property-assignment'],
    outputs: ['object-expression', 'expression'],
    appliesWhen: ['構造化データを作る', 'API payloadを作る'],
    doesNotApplyWhen: ['単一値だけを返す場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer'],
    sourceArtifactIds: ['mdn-object-initializer'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '({properties})',
      outputKinds: ['object-expression', 'expression'],
      slots: [
        {name: 'properties', inputKinds: ['property-assignment'], required: false, multiple: true},
      ],
      constraints: [
        'property names must be valid object literal properties'
      ],
      adaptationRules: [
        'omit properties when constructing an empty object'
      ],
    },
  },
  {
    id: 'code.javascript.property-access',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Objectや配列などから特定プロパティを参照する',
    summary: 'プロパティアクセスを構成し、既存データを後続処理へ渡す。',
    concepts: ['property access', 'member expression', 'object'],
    inputs: ['expression', 'identifier'],
    outputs: ['property-expression', 'expression'],
    appliesWhen: ['プロパティを取得する', 'レスポンスから値を取り出す'],
    doesNotApplyWhen: ['直接値を扱う場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects'],
    sourceArtifactIds: ['mdn-property-access'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{object}.{property}',
      outputKinds: ['property-expression', 'expression'],
      slots: [
        {name: 'object', inputKinds: ['object-expression', 'array-expression', 'expression'], required: true},
        {name: 'property', inputKinds: ['identifier'], required: true},
      ],
      constraints: [
        'property access must match the available object contract'
      ],
      adaptationRules: [
        'use bracket notation when the property name is dynamic'
      ],
    },
  },
  {
    id: 'code.javascript.try-catch',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '失敗する可能性のある処理をtry/catchで安全に扱う',
    summary: '例外発生可能な処理と失敗時処理を分離して構成する。',
    concepts: ['try', 'catch', 'exception', 'error handling'],
    inputs: ['statement'],
    outputs: ['statement'],
    appliesWhen: ['I/O', '解析', 'ネットワーク', '例外処理'],
    doesNotApplyWhen: ['失敗が構造的に発生しない単純処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch'],
    sourceArtifactIds: ['mdn-try-catch'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'try {\\n{tryBody}\\n} catch ({error}) {\\n{catchBody}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'tryBody', inputKinds: ['statement'], required: true, multiple: true},
        {name: 'error', inputKinds: ['identifier'], required: true},
        {name: 'catchBody', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: [
        'tryBody and catchBody must contain valid statements'
      ],
      adaptationRules: [
        'add finally only when cleanup is required'
      ],
    },
  },
  {
    id: 'code.javascript.throw',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '異常状態を明示的に例外として送出する',
    summary: 'throw文によって失敗を通常結果と区別する。',
    concepts: ['throw', 'exception', 'failure'],
    inputs: ['expression'],
    outputs: ['statement'],
    appliesWhen: ['入力不正', '回復不能な失敗', '契約違反'],
    doesNotApplyWhen: ['通常の戻り値として扱うべき状態'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw'],
    sourceArtifactIds: ['mdn-throw'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'throw {error};',
      outputKinds: ['statement'],
      slots: [
        {name: 'error', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'thrown value should identify the failure condition'
      ],
      adaptationRules: [
        'prefer Error objects for application failures'
      ],
    },
  },
  {
    id: 'code.javascript.json-stringify',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'JavaScript値をJSON文字列へ変換する',
    summary: 'JSON.stringifyを使って外部送信や保存用の文字列表現を構成する。',
    concepts: ['JSON.stringify', 'serialization', 'JSON'],
    inputs: ['expression'],
    outputs: ['string-expression', 'expression'],
    appliesWhen: ['API body', 'JSON保存', 'データ送信'],
    doesNotApplyWhen: ['既に文字列化済みのデータ'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify'],
    sourceArtifactIds: ['mdn-json-stringify'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'JSON.stringify({value})',
      outputKinds: ['string-expression', 'expression'],
      slots: [
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'value must be serializable to JSON'
      ],
      adaptationRules: [
        'add replacer or space only when explicitly required'
      ],
    },
  },
  {
    id: 'code.javascript.template-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列と式を組み合わせた可読性の高い文字列を作る',
    summary: 'Template literalで文字列と埋め込み式を構成する。',
    concepts: ['template literal', 'string', 'interpolation'],
    inputs: ['expression'],
    outputs: ['string-expression', 'expression'],
    appliesWhen: ['動的文字列', 'ログ', 'URL', 'メッセージ生成'],
    doesNotApplyWhen: ['固定文字列だけで完結する場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals'],
    sourceArtifactIds: ['mdn-template-literals'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '`{parts}`',
      outputKinds: ['string-expression', 'expression'],
      slots: [
        {name: 'parts', inputKinds: ['expression'], required: false, multiple: true},
      ],
      constraints: [
        'embedded expressions must be valid JavaScript expressions'
      ],
      adaptationRules: [
        'prefer plain string literals when interpolation is unnecessary'
      ],
    },
  },
{
    id: 'code.javascript.array-find',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に合う配列要素を最初の1件として取得する',
    summary: 'Array.findを使って条件に一致する最初の要素を取得する。',
    concepts: ['Array.find', 'find', 'predicate', 'callback'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['expression'],
    appliesWhen: ['最初に条件を満たす要素を取得する', 'findを使う'],
    doesNotApplyWhen: ['一致するすべての要素を取得する場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find'],
    sourceArtifactIds: ['mdn-array-find'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.find({predicate})',
      outputKinds: ['expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: [
        'predicate must produce a boolean-compatible result'
      ],
      adaptationRules: [
        'use filter when multiple matching elements are required'
      ],
    },
  },
  {
    id: 'code.javascript.array-some',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列に条件を満たす要素が存在するか判定する',
    summary: 'Array.someを使って少なくとも1件の条件一致をbooleanで判定する。',
    concepts: ['Array.some', 'some', 'predicate', 'boolean'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['条件を満たす要素が存在するか判定する', 'someを使う'],
    doesNotApplyWhen: ['一致する要素自体が必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some'],
    sourceArtifactIds: ['mdn-array-some'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.some({predicate})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: [
        'predicate must produce a boolean-compatible result'
      ],
      adaptationRules: [
        'use find when the matching element itself is required'
      ],
    },
  },


  {
    id: 'code.javascript.array-every',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列のすべての要素が条件を満たすか判定する',
    summary: 'Array.prototype.everyによる全要素条件判定。',
    concepts: ['Array.every', 'predicate', 'boolean', 'array'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['すべての要素が条件を満たすか判定する', 'everyを使う'],
    doesNotApplyWhen: ['1件でも一致すればよい場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every'],
    sourceArtifactIds: ['mdn-array-every'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.every({predicate})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: [
        'predicate must produce a truthy/falsy result'
      ],
      adaptationRules: [
        'use some when only one matching element is sufficient'
      ],
    },
  },
  {
    id: 'code.javascript.array-reduce',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列を畳み込んで単一の値へ変換する',
    summary: 'Array.prototype.reduceによる累積処理。',
    concepts: ['Array.reduce', 'reducer', 'accumulator', 'array'],
    inputs: ['array-expression', 'function-expression', 'expression'],
    outputs: ['expression'],
    appliesWhen: ['配列を集約する', '合計値を計算する', '累積結果を作る', 'reduceを使う'],
    doesNotApplyWhen: ['単純な要素変換だけが目的の場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce'],
    sourceArtifactIds: ['mdn-array-reduce'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.reduce({reducer}, {initialValue})',
      outputKinds: ['expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'reducer', inputKinds: ['function-expression'], required: true},
        {name: 'initialValue', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'reducer must return the next accumulator value',
        'initialValue is required for deterministic construction'
      ],
      adaptationRules: [
        'prefer map or filter when a reducer is unnecessary'
      ],
    },
  },
  {
    id: 'code.javascript.array-includes',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列に指定した値が含まれるか判定する',
    summary: 'Array.prototype.includesによる値存在判定。',
    concepts: ['Array.includes', 'membership', 'boolean', 'array'],
    inputs: ['array-expression', 'expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['配列に値が存在するか判定する', 'includesを使う'],
    doesNotApplyWhen: ['条件関数による複雑な探索が必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes'],
    sourceArtifactIds: ['mdn-array-includes'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.includes({value})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [
        'value must be comparable with the array element values'
      ],
      adaptationRules: [
        'use some when predicate-based matching is required'
      ],
    },
  },
  {
    id: 'code.javascript.array-find-index',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に合う配列要素の最初の位置を取得する',
    summary: 'Array.prototype.findIndexによる最初の一致位置の取得。',
    concepts: ['Array.findIndex', 'index', 'predicate', 'array'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['number-expression'],
    appliesWhen: ['条件に合う要素の位置を取得する', 'findIndexを使う'],
    doesNotApplyWhen: ['要素そのものが必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex'],
    sourceArtifactIds: ['mdn-array-find-index'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.findIndex({predicate})',
      outputKinds: ['number-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: [
        'predicate must produce a boolean-compatible result'
      ],
      adaptationRules: [
        'use find when the element itself is required'
      ],
    },
  },
  {
    id: 'code.javascript.string-includes',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列に指定した文字列が含まれるか判定する',
    summary: 'String.prototype.includesによる部分文字列判定。',
    concepts: ['String.includes', 'string', 'boolean', 'search'],
    inputs: ['string-expression', 'string-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['文字列を検索する', '部分文字列の存在を判定する'],
    doesNotApplyWhen: ['正規表現による複雑な検索が必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes'],
    sourceArtifactIds: ['mdn-string-includes'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.includes({search})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'text', inputKinds: ['string-expression'], required: true},
        {name: 'search', inputKinds: ['string-expression'], required: true},
      ],
      constraints: [
        'comparison is case-sensitive'
      ],
      adaptationRules: [
        'use startsWith when only the prefix matters'
      ],
    },
  },
  {
    id: 'code.javascript.string-split',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を区切って配列へ分割する',
    summary: 'String.prototype.splitによる文字列分割。',
    concepts: ['String.split', 'string', 'array', 'separator'],
    inputs: ['string-expression', 'string-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['文字列を区切り文字で分割する', 'splitを使う'],
    doesNotApplyWhen: ['単純な文字列検索だけが必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split'],
    sourceArtifactIds: ['mdn-string-split'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.split({separator})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'text', inputKinds: ['string-expression'], required: true},
        {name: 'separator', inputKinds: ['string-expression'], required: true},
      ],
      constraints: [
        'separator must be a valid split pattern'
      ],
      adaptationRules: [
        'use includes when an array result is not required'
      ],
    },
  },


  {
    id: 'code.javascript.let-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '再代入可能な値をletとして宣言する',
    summary: '再代入が必要なローカル変数をletで宣言する。',
    concepts: ['let', 'variable', 'binding', 'scope'],
    inputs: ['identifier', 'expression'],
    outputs: ['statement'],
    appliesWhen: ['再代入が必要な値を宣言する'],
    doesNotApplyWhen: ['再代入しない値'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/let'],
    sourceArtifactIds: ['mdn-let-declaration'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'let {name} = {value};',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: ['name must be a valid identifier'],
      adaptationRules: ['use const when reassignment is unnecessary'],
    },
  },
  {
    id: 'code.javascript.switch-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数の離散条件に応じて処理を分岐する',
    summary: 'switch/case/defaultによる複数分岐。',
    concepts: ['switch', 'case', 'default', 'break'],
    inputs: ['expression', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['複数の固定値による分岐'],
    doesNotApplyWhen: ['複雑な範囲条件'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/switch'],
    sourceArtifactIds: ['mdn-switch-statement'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'switch ({expression}) {\\n{cases}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'expression', inputKinds: ['expression'], required: true},
        {name: 'cases', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: ['case branches must have valid statements'],
      adaptationRules: ['use if when range or compound conditions are primary'],
    },
  },
  {
    id: 'code.javascript.for-index',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'インデックスを利用して配列を反復処理する',
    summary: 'index-based for loopによる反復。',
    concepts: ['for', 'index', 'iteration', 'array'],
    inputs: ['identifier', 'expression', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['インデックスが必要な反復'],
    doesNotApplyWhen: ['値だけを順番に処理する場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/for'],
    sourceArtifactIds: ['mdn-for-statement'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'for (let {index} = 0; {index} < {length}; {index}++) {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'index', inputKinds: ['identifier'], required: true},
        {name: 'length', inputKinds: ['number-expression'], required: true},
        {name: 'body', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: ['index must be numeric'],
      adaptationRules: ['use for-of when index semantics are unnecessary'],
    },
  },
  {
    id: 'code.javascript.while-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件が成立している間処理を反復する',
    summary: 'whileによる条件付き反復。',
    concepts: ['while', 'loop', 'condition'],
    inputs: ['boolean-expression', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['終了条件が動的に決まる反復'],
    doesNotApplyWhen: ['反復回数が明確な場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/while'],
    sourceArtifactIds: ['mdn-while-statement'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'while ({condition}) {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'condition', inputKinds: ['boolean-expression'], required: true},
        {name: 'body', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: ['loop condition must eventually become false or use an explicit exit'],
      adaptationRules: ['use for when initialization and iteration are clearer'],
    },
  },
  {
    id: 'code.javascript.break-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'ループまたはswitchから処理を終了する',
    summary: 'breakによる現在の制御構造からの脱出。',
    concepts: ['break', 'loop', 'switch'],
    inputs: [],
    outputs: ['statement'],
    appliesWhen: ['ループやswitchを途中終了する'],
    doesNotApplyWhen: ['通常の継続処理'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/break'],
    sourceArtifactIds: ['mdn-break-statement'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'break;',
      outputKinds: ['statement'],
      slots: [],
      constraints: ['must occur inside an enclosing loop or switch'],
      adaptationRules: ['prefer structured loop conditions when possible'],
    },
  },
  {
    id: 'code.javascript.continue-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '現在の反復だけを終了して次の反復へ進む',
    summary: 'continueによるループ反復のスキップ。',
    concepts: ['continue', 'loop', 'iteration'],
    inputs: [],
    outputs: ['statement'],
    appliesWhen: ['特定条件の要素をスキップする'],
    doesNotApplyWhen: ['ループ全体を終了する'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/continue'],
    sourceArtifactIds: ['mdn-continue-statement'],
    constructionProfile: {
      kind: 'STATEMENT',
      syntaxTemplate: 'continue;',
      outputKinds: ['statement'],
      slots: [],
      constraints: ['must occur inside an enclosing loop'],
      adaptationRules: ['use an inverted condition when it improves readability'],
    },
  },
  {
    id: 'code.javascript.ternary-expression',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '単純な条件によって式の値を選択する',
    summary: '条件演算子による値選択。',
    concepts: ['ternary', 'condition', 'expression'],
    inputs: ['boolean-expression', 'expression'],
    outputs: ['expression'],
    appliesWhen: ['単純な値の条件選択'],
    doesNotApplyWhen: ['複数文の分岐'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/Conditional_operator'],
    sourceArtifactIds: ['mdn-conditional-operator'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{condition} ? {whenTrue} : {whenFalse}',
      outputKinds: ['expression'],
      slots: [
        {name: 'condition', inputKinds: ['boolean-expression'], required: true},
        {name: 'whenTrue', inputKinds: ['expression'], required: true},
        {name: 'whenFalse', inputKinds: ['expression'], required: true},
      ],
      constraints: ['both branches must produce compatible expression results'],
      adaptationRules: ['use if for multi-statement branches'],
    },
  },
  {
    id: 'code.javascript.arithmetic',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '数値や互換性のある値を算術演算する',
    summary: '加減乗除などの算術式を構成する。',
    concepts: ['+', '-', '*', '/', '%', 'arithmetic'],
    inputs: ['expression', 'arithmetic-operator'],
    outputs: ['expression'],
    appliesWhen: ['数値計算'],
    doesNotApplyWhen: ['boolean条件の組み合わせ'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Expressions_and_operators'],
    sourceArtifactIds: ['mdn-arithmetic-operators'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{left} {operator} {right}',
      outputKinds: ['expression', 'number-expression'],
      slots: [
        {name: 'left', inputKinds: ['expression'], required: true},
        {name: 'operator', inputKinds: ['arithmetic-operator'], required: true},
        {name: 'right', inputKinds: ['expression'], required: true},
      ],
      constraints: ['operator must match operand semantics'],
      adaptationRules: ['use explicit parentheses when precedence could be unclear'],
    },
  },
  {
    id: 'code.javascript.typeof',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '値のJavaScript上の型名を取得する',
    summary: 'typeof演算子による実行時型判定。',
    concepts: ['typeof', 'runtime type'],
    inputs: ['expression'],
    outputs: ['string-expression'],
    appliesWhen: ['実行時の型判定'],
    doesNotApplyWhen: ['TypeScriptの静的型検査そのもの'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/typeof'],
    sourceArtifactIds: ['mdn-typeof'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: 'typeof {value}',
      outputKinds: ['string-expression'],
      slots: [
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use explicit value validation when runtime type semantics require more than typeof'],
    },
  },
  {
    id: 'code.javascript.optional-chain-access',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'nullishな中間値を安全に辿ってプロパティを参照する',
    summary: 'optional chainingによる安全なメンバーアクセス。',
    concepts: ['?.', 'optional chaining', 'property access'],
    inputs: ['expression', 'identifier'],
    outputs: ['expression'],
    appliesWhen: ['optionalなネストデータを参照する'],
    doesNotApplyWhen: ['存在が保証された値'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/Optional_chaining'],
    sourceArtifactIds: ['mdn-optional-chain-access'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{object}?.{property}',
      outputKinds: ['expression', 'property-expression'],
      slots: [
        {name: 'object', inputKinds: ['expression'], required: true},
        {name: 'property', inputKinds: ['identifier'], required: true},
      ],
      constraints: ['property access must be valid for the intended object contract'],
      adaptationRules: ['combine with nullish coalescing when a fallback is required'],
    },
  },
  {
    id: 'code.javascript.nullish-fallback',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'nullまたはundefinedだけを既定値へ置換する',
    summary: '??によるnullish fallback。',
    concepts: ['??', 'null', 'undefined', 'fallback'],
    inputs: ['expression'],
    outputs: ['expression'],
    appliesWhen: ['optional値に既定値を設定する'],
    doesNotApplyWhen: ['falseや0や空文字もfallback対象にする場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing'],
    sourceArtifactIds: ['mdn-nullish-fallback'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{value} ?? {fallback}',
      outputKinds: ['expression'],
      slots: [
        {name: 'value', inputKinds: ['expression'], required: true},
        {name: 'fallback', inputKinds: ['expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use || only when all falsy values should trigger fallback'],
    },
  },
  {
    id: 'code.javascript.string-trim',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列の前後の空白を除去する',
    summary: 'String.prototype.trimによる文字列正規化。',
    concepts: ['String.trim', 'string', 'normalization'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['入力文字列の前後空白を除去する'],
    doesNotApplyWhen: ['内部空白の変更が目的'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/trim'],
    sourceArtifactIds: ['mdn-string-trim'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.trim()',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}],
      constraints: [],
      adaptationRules: ['use trimStart or trimEnd when only one side should change'],
    },
  },
  {
    id: 'code.javascript.string-replace',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列の一部を置換して新しい文字列を作る',
    summary: 'String.prototype.replaceによる文字列変換。',
    concepts: ['String.replace', 'replacement', 'string'],
    inputs: ['string-expression', 'expression'],
    outputs: ['string-expression'],
    appliesWhen: ['文字列の一部を置換する'],
    doesNotApplyWhen: ['単純な分割だけが必要'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/replace'],
    sourceArtifactIds: ['mdn-string-replace'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.replace({pattern}, {replacement})',
      outputKinds: ['string-expression'],
      slots: [
        {name: 'text', inputKinds: ['string-expression'], required: true},
        {name: 'pattern', inputKinds: ['expression'], required: true},
        {name: 'replacement', inputKinds: ['expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use replaceAll when all matching occurrences must be replaced'],
    },
  },
  {
    id: 'code.javascript.array-join',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列要素を区切り文字で連結して文字列にする',
    summary: 'Array.prototype.joinによる文字列化。',
    concepts: ['Array.join', 'array', 'string'],
    inputs: ['array-expression', 'string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['配列から区切り文字付き文字列を作る'],
    doesNotApplyWhen: ['配列を保持したい場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/join'],
    sourceArtifactIds: ['mdn-array-join'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.join({separator})',
      outputKinds: ['string-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'separator', inputKinds: ['string-expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use an empty separator when direct concatenation is intended'],
    },
  },
  {
    id: 'code.javascript.array-push',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列末尾へ値を追加する',
    summary: 'Array.prototype.pushによる要素追加。',
    concepts: ['Array.push', 'array', 'mutation'],
    inputs: ['array-expression', 'expression'],
    outputs: ['number-expression'],
    appliesWhen: ['既存配列へ要素を追加する'],
    doesNotApplyWhen: ['入力配列を変更しない設計が必要'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/push'],
    sourceArtifactIds: ['mdn-array-push'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.push({value})',
      outputKinds: ['number-expression', 'expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'value', inputKinds: ['expression'], required: true},
      ],
      constraints: ['array must be mutable for the intended operation'],
      adaptationRules: ['use spread or concat when immutability is required'],
    },
  },
  {
    id: 'code.javascript.object-keys',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Objectの列挙可能な自身のキーを配列として取得する',
    summary: 'Object.keysによるキー列挙。',
    concepts: ['Object.keys', 'object', 'keys'],
    inputs: ['object-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['Objectのキーを列挙する'],
    doesNotApplyWhen: ['値だけを列挙する場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/keys'],
    sourceArtifactIds: ['mdn-object-keys'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Object.keys({object})',
      outputKinds: ['array-expression'],
      slots: [{name: 'object', inputKinds: ['object-expression', 'expression'], required: true}],
      constraints: [],
      adaptationRules: ['use Object.entries when both key and value are required'],
    },
  },
  {
    id: 'code.javascript.object-values',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Objectの列挙可能な自身の値を配列として取得する',
    summary: 'Object.valuesによる値列挙。',
    concepts: ['Object.values', 'object', 'values'],
    inputs: ['object-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['Objectの値を列挙する'],
    doesNotApplyWhen: ['キーが必要な場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/values'],
    sourceArtifactIds: ['mdn-object-values'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Object.values({object})',
      outputKinds: ['array-expression'],
      slots: [{name: 'object', inputKinds: ['object-expression', 'expression'], required: true}],
      constraints: [],
      adaptationRules: ['use Object.entries when keys are also required'],
    },
  },
  {
    id: 'code.javascript.object-entries',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Objectのキーと値をペア配列として取得する',
    summary: 'Object.entriesによるキー値ペア列挙。',
    concepts: ['Object.entries', 'object', 'entries'],
    inputs: ['object-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['キーと値を同時に反復する'],
    doesNotApplyWhen: ['キーだけが必要'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/entries'],
    sourceArtifactIds: ['mdn-object-entries'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Object.entries({object})',
      outputKinds: ['array-expression'],
      slots: [{name: 'object', inputKinds: ['object-expression', 'expression'], required: true}],
      constraints: [],
      adaptationRules: ['use for-of over entries when sequential key/value processing is required'],
    },
  },


  {
    id: 'code.javascript.promise-all-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数のPromiseを並行して待つ',
    summary: 'Promise.allで複数非同期処理をまとめて完了させる。',
    concepts: ['Promise.all', 'parallel', 'Promise'],
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['複数の独立した非同期処理'],
    doesNotApplyWhen: ['前処理結果に依存する逐次処理'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/all'],
    sourceArtifactIds: ['mdn-promise-all'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'Promise.all([{promises}])',
      outputKinds: ['promise-expression'],
      slots: [{name: 'promises', inputKinds: ['promise-expression'], required: true, multiple: true}],
      constraints: ['all inputs must be awaitable'],
      adaptationRules: ['use sequential await when operations depend on one another'],
    },
  },
  {
    id: 'code.javascript.promise-all-settled-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Promiseの成功失敗を個別に収集する',
    summary: 'Promise.allSettledで全処理のsettled結果を取得する。',
    concepts: ['Promise.allSettled', 'rejection', 'result'],
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['一部失敗しても全結果が必要'],
    doesNotApplyWhen: ['1件の失敗で全体を失敗させる場合'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled'],
    sourceArtifactIds: ['mdn-promise-all-settled'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'Promise.allSettled([{promises}])',
      outputKinds: ['promise-expression'],
      slots: [{name: 'promises', inputKinds: ['promise-expression'], required: true, multiple: true}],
      constraints: ['inputs must be awaitable'],
      adaptationRules: ['use Promise.all when failure should reject the combined operation'],
    },
  },
  {
    id: 'code.javascript.array-flat-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'ネストした配列を平坦化する',
    summary: 'Array.flatでネスト配列を指定深度まで平坦化する。',
    concepts: ['Array.flat', 'array', 'flatten'],
    inputs: ['array-expression', 'number-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['ネスト配列を平坦化する'],
    doesNotApplyWhen: ['ネスト構造を保持する'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/flat'],
    sourceArtifactIds: ['mdn-array-flat'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.flat({depth})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'depth', inputKinds: ['number-expression'], required: true},
      ],
      constraints: ['depth must be a valid flat depth'],
      adaptationRules: ['use flatMap when flattening is directly tied to mapping'],
    },
  },
  {
    id: 'code.javascript.array-flat-map-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '要素変換と一段階の平坦化を組み合わせる',
    summary: 'Array.flatMapによるmap + flatten。',
    concepts: ['Array.flatMap', 'map', 'flatten'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['変換結果が配列になり一段階平坦化が必要'],
    doesNotApplyWhen: ['単純なmap'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap'],
    sourceArtifactIds: ['mdn-array-flat-map'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.flatMap({callback})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'callback', inputKinds: ['function-expression'], required: true},
      ],
      constraints: ['callback must return a compatible value'],
      adaptationRules: ['use map when flattening is not required'],
    },
  },
  {
    id: 'code.javascript.array-slice-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列の一部を非破壊的に取り出す',
    summary: 'Array.sliceで部分配列を作る。',
    concepts: ['Array.slice', 'array', 'copy'],
    inputs: ['array-expression', 'number-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['配列の範囲をコピーする'],
    doesNotApplyWhen: ['元配列を直接変更する'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/slice'],
    sourceArtifactIds: ['mdn-array-slice'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.slice({start}, {end})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'start', inputKinds: ['number-expression'], required: true},
        {name: 'end', inputKinds: ['number-expression'], required: false},
      ],
      constraints: [],
      adaptationRules: ['use splice only when mutation is intentionally required'],
    },
  },
  {
    id: 'code.javascript.array-sort-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列を比較関数に従って並べ替える',
    summary: 'Array.sortによる並べ替え。',
    concepts: ['Array.sort', 'comparison', 'mutation'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['配列の順序を並べ替える'],
    doesNotApplyWhen: ['入力配列を変更したくない場合はコピーを先に作る'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/sort'],
    sourceArtifactIds: ['mdn-array-sort'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{array}.sort({compare})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression'], required: true},
        {name: 'compare', inputKinds: ['function-expression'], required: false},
      ],
      constraints: ['comparison function must return ordering semantics'],
      adaptationRules: ['use toSorted when non-mutating semantics are required'],
    },
  },
  {
    id: 'code.javascript.string-trim-start-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列先頭の空白を除去する',
    summary: 'String.trimStartによる先頭空白除去。',
    concepts: ['String.trimStart', 'string'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['先頭だけ正規化する'],
    doesNotApplyWhen: ['末尾だけ、または両側を処理する'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/trimStart'],
    sourceArtifactIds: ['mdn-string-trim-start'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.trimStart()',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}],
      constraints: [],
      adaptationRules: ['use trim for both sides'],
    },
  },
  {
    id: 'code.javascript.string-trim-end-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列末尾の空白を除去する',
    summary: 'String.trimEndによる末尾空白除去。',
    concepts: ['String.trimEnd', 'string'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['末尾だけ正規化する'],
    doesNotApplyWhen: ['先頭だけ、または両側を処理する'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/trimEnd'],
    sourceArtifactIds: ['mdn-string-trim-end'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.trimEnd()',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}],
      constraints: [],
      adaptationRules: ['use trim for both sides'],
    },
  },
  {
    id: 'code.javascript.string-replace-all-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列中の一致箇所をすべて置換する',
    summary: 'String.replaceAllによる全置換。',
    concepts: ['String.replaceAll', 'replacement'],
    inputs: ['string-expression', 'expression'],
    outputs: ['string-expression'],
    appliesWhen: ['すべての一致箇所を置換する'],
    doesNotApplyWhen: ['最初の一致だけでよい'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll'],
    sourceArtifactIds: ['mdn-string-replace-all'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.replaceAll({pattern}, {replacement})',
      outputKinds: ['string-expression'],
      slots: [
        {name: 'text', inputKinds: ['string-expression'], required: true},
        {name: 'pattern', inputKinds: ['expression'], required: true},
        {name: 'replacement', inputKinds: ['expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use replace when only one replacement is intended'],
    },
  },
  {
    id: 'code.javascript.string-to-lower-case-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を小文字化する',
    summary: 'String.toLowerCaseによる文字列正規化。',
    concepts: ['String.toLowerCase', 'normalization'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['大文字小文字を統一する'],
    doesNotApplyWhen: ['元の表記を保持する必要がある'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/toLowerCase'],
    sourceArtifactIds: ['mdn-string-to-lower-case'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.toLowerCase()',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}],
      constraints: [],
      adaptationRules: ['use locale-aware conversion when locale-specific behavior is required'],
    },
  },
  {
    id: 'code.javascript.string-to-upper-case-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を大文字化する',
    summary: 'String.toUpperCaseによる文字列正規化。',
    concepts: ['String.toUpperCase', 'normalization'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['大文字へ統一する'],
    doesNotApplyWhen: ['元の表記を保持する必要がある'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/toUpperCase'],
    sourceArtifactIds: ['mdn-string-to-upper-case'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.toUpperCase()',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}],
      constraints: [],
      adaptationRules: ['use locale-aware conversion when locale-specific behavior is required'],
    },
  },
  {
    id: 'code.javascript.string-starts-with-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列が指定文字列から始まるか判定する',
    summary: 'String.startsWithによるprefix判定。',
    concepts: ['String.startsWith', 'string', 'boolean'],
    inputs: ['string-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['prefix判定'],
    doesNotApplyWhen: ['部分一致やsuffix判定'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith'],
    sourceArtifactIds: ['mdn-string-starts-with'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.startsWith({search})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'text', inputKinds: ['string-expression'], required: true},
        {name: 'search', inputKinds: ['string-expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use includes for arbitrary substring search'],
    },
  },
  {
    id: 'code.javascript.object-assign-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Objectのプロパティを一つのObjectへコピーする',
    summary: 'Object.assignによるObjectの合成。',
    concepts: ['Object.assign', 'object', 'merge'],
    inputs: ['object-expression'],
    outputs: ['object-expression'],
    appliesWhen: ['Objectを合成する'],
    doesNotApplyWhen: ['深い再帰的mergeが必要'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/assign'],
    sourceArtifactIds: ['mdn-object-assign'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Object.assign({target}, {sources})',
      outputKinds: ['object-expression'],
      slots: [
        {name: 'target', inputKinds: ['object-expression'], required: true},
        {name: 'sources', inputKinds: ['object-expression'], required: true, multiple: true},
      ],
      constraints: ['sources must be compatible with object assignment'],
      adaptationRules: ['use spread syntax for straightforward shallow object construction'],
    },
  },
  {
    id: 'code.javascript.object-has-own-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Object自身が指定プロパティを持つか安全に判定する',
    summary: 'Object.hasOwnによるown property判定。',
    concepts: ['Object.hasOwn', 'property', 'object'],
    inputs: ['object-expression', 'string-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['Object自身のプロパティ存在確認'],
    doesNotApplyWhen: ['prototype chainも含めた判定'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn'],
    sourceArtifactIds: ['mdn-object-has-own'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Object.hasOwn({object}, {property})',
      outputKinds: ['boolean-expression'],
      slots: [
        {name: 'object', inputKinds: ['object-expression', 'expression'], required: true},
        {name: 'property', inputKinds: ['string-expression'], required: true},
      ],
      constraints: [],
      adaptationRules: ['use in when inherited properties should also count'],
    },
  },

  {
    id: 'code.javascript.string-ends-with',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列が指定文字列で終わるか判定する',
    summary: 'String.endsWithによるsuffix判定。',
    concepts: ['String.endsWith', 'string', 'suffix'],
    inputs: ['string-expression'],
    outputs: ['boolean-expression'],
    appliesWhen: ['文字列の末尾判定'],
    doesNotApplyWhen: ['先頭判定'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith'],
    sourceArtifactIds: ['mdn-string-ends-with'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.endsWith({search})',
      outputKinds: ['boolean-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}, {name: 'search', inputKinds: ['string-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.string-repeat',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を指定回数繰り返す',
    summary: 'String.repeatによる文字列反復。',
    concepts: ['String.repeat', 'string', 'repeat'],
    inputs: ['string-expression', 'number-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['同じ文字列を複数回生成'],
    doesNotApplyWhen: ['配列要素の反復処理'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/repeat'],
    sourceArtifactIds: ['mdn-string-repeat'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.repeat({count})',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}, {name: 'count', inputKinds: ['number-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.string-substring',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列の指定範囲を取り出す',
    summary: 'String.substringによる部分文字列取得。',
    concepts: ['String.substring', 'string', 'substring'],
    inputs: ['string-expression', 'number-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['文字列の範囲抽出'],
    doesNotApplyWhen: ['配列の範囲抽出'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/substring'],
    sourceArtifactIds: ['mdn-string-substring'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{text}.substring({start}, {end})',
      outputKinds: ['string-expression'],
      slots: [{name: 'text', inputKinds: ['string-expression'], required: true}, {name: 'start', inputKinds: ['number-expression'], required: true}, {name: 'end', inputKinds: ['number-expression'], required: false}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.array-pop',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列末尾の要素を取り出す',
    summary: 'Array.popによる末尾要素取得。',
    concepts: ['Array.pop', 'array', 'mutation'],
    inputs: ['array-expression'],
    outputs: ['expression'],
    appliesWhen: ['配列末尾から要素を取り出す'],
    doesNotApplyWhen: ['元配列を変更しない取得'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/pop'],
    sourceArtifactIds: ['mdn-array-pop'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.pop()',
      outputKinds: ['expression'],
      slots: [{name: 'array', inputKinds: ['array-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.array-shift',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列先頭の要素を取り出す',
    summary: 'Array.shiftによる先頭要素取得。',
    concepts: ['Array.shift', 'array', 'mutation'],
    inputs: ['array-expression'],
    outputs: ['expression'],
    appliesWhen: ['配列先頭から要素を取り出す'],
    doesNotApplyWhen: ['末尾操作'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/shift'],
    sourceArtifactIds: ['mdn-array-shift'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.shift()',
      outputKinds: ['expression'],
      slots: [{name: 'array', inputKinds: ['array-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.array-unshift',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列先頭へ要素を追加する',
    summary: 'Array.unshiftによる先頭追加。',
    concepts: ['Array.unshift', 'array', 'mutation'],
    inputs: ['array-expression', 'expression'],
    outputs: ['number-expression'],
    appliesWhen: ['配列先頭への追加'],
    doesNotApplyWhen: ['末尾への追加'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift'],
    sourceArtifactIds: ['mdn-array-unshift'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.unshift({value})',
      outputKinds: ['number-expression'],
      slots: [{name: 'array', inputKinds: ['array-expression'], required: true}, {name: 'value', inputKinds: ['expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.promise-race',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Promiseのうち最初にsettleした結果を利用する',
    summary: 'Promise.raceによる非同期競合。',
    concepts: ['Promise.race', 'Promise', 'async'],
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['最初に完了した処理を採用'],
    doesNotApplyWhen: ['最初に成功した処理を採用'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/race'],
    sourceArtifactIds: ['mdn-promise-race'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'Promise.race([{promises}])',
      outputKinds: ['promise-expression'],
      slots: [{name: 'promises', inputKinds: ['promise-expression'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.javascript.promise-any',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Promiseのうち最初に成功した結果を利用する',
    summary: 'Promise.anyによる成功結果選択。',
    concepts: ['Promise.any', 'Promise', 'async'],
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['最初に成功した処理を採用'],
    doesNotApplyWhen: ['最初にsettleした処理を採用'],
    sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/any'],
    sourceArtifactIds: ['mdn-promise-any'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'Promise.any([{promises}])',
      outputKinds: ['promise-expression'],
      slots: [{name: 'promises', inputKinds: ['promise-expression'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  }
,
{
  id: "code.javascript.parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript関数のparameterを構成する",
  summary: "名前付き引数を関数へ渡すためのparameter宣言。",
  concepts: ["parameter", "function", "argument"],
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  appliesWhen: ["関数引数", "callback引数"],
  doesNotApplyWhen: ["不要な引数"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions"],
  sourceArtifactIds: ["mdn-js-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.default-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "既定値付きparameterを構成する",
  summary: "引数が省略された場合の既定値を指定する。",
  concepts: ["default parameter", "function"],
  inputs: ["identifier", "expression"],
  outputs: ["parameter"],
  appliesWhen: ["省略可能な引数", "設定値"],
  doesNotApplyWhen: ["必須引数"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters"],
  sourceArtifactIds: ["mdn-js-default-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name} = {value}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.rest-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "可変長parameterを構成する",
  summary: "複数の引数を配列として受け取るparameter。",
  concepts: ["rest parameter", "arguments"],
  inputs: ["identifier"],
  outputs: ["parameter"],
  appliesWhen: ["可変長引数"],
  doesNotApplyWhen: ["固定引数だけで十分"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters"],
  sourceArtifactIds: ["mdn-js-rest-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "...{name}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.object-spread",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Objectをspreadして複製・統合する",
  summary: "オブジェクトプロパティを展開して新しいObjectを構成する。",
  concepts: ["object spread", "object", "copy"],
  inputs: ["object-expression"],
  outputs: ["object-expression"],
  appliesWhen: ["Object統合", "部分更新"],
  doesNotApplyWhen: ["配列処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax"],
  sourceArtifactIds: ["mdn-js-object-spread"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{ ...{inputObject} }", outputKinds: ["object-expression"], slots: [{ name: "inputObject", inputKinds: ["object-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.array-spread",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Arrayをspreadして統合する",
  summary: "配列要素を展開して新しいArrayを構成する。",
  concepts: ["array spread", "array", "copy"],
  inputs: ["array-expression"],
  outputs: ["array-expression"],
  appliesWhen: ["配列統合", "コピー"],
  doesNotApplyWhen: ["単一要素だけの処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax"],
  sourceArtifactIds: ["mdn-js-array-spread"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "[...{inputArray}]", outputKinds: ["array-expression"], slots: [{ name: "inputArray", inputKinds: ["array-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.strict-equality",
  componentType: "CODE_CONSTRUCTION",
  purpose: "厳密等価比較を構成する",
  summary: "===による型変換を伴わない比較。",
  concepts: ["strict equality", "===", "comparison"],
  inputs: ["expression", "expression"],
  outputs: ["boolean-expression"],
  appliesWhen: ["厳密比較"],
  doesNotApplyWhen: ["文字列パターン判定"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality"],
  sourceArtifactIds: ["mdn-js-strict-equality"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{left} === {right}", outputKinds: ["boolean-expression"], slots: [{ name: "left", inputKinds: ["expression"], required: true, multiple: false }, { name: "right", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.logical-not",
  componentType: "CODE_CONSTRUCTION",
  purpose: "論理否定を構成する",
  summary: "boolean式を反転する。",
  concepts: ["logical NOT", "!", "boolean"],
  inputs: ["boolean-expression"],
  outputs: ["boolean-expression"],
  appliesWhen: ["条件反転"],
  doesNotApplyWhen: ["値変換"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_NOT"],
  sourceArtifactIds: ["mdn-js-logical-not"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "!{condition}", outputKinds: ["boolean-expression"], slots: [{ name: "condition", inputKinds: ["boolean-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.modulo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "剰余演算を構成する",
  summary: "数値の余りを計算する。",
  concepts: ["modulo", "remainder", "arithmetic"],
  inputs: ["number-expression", "number-expression"],
  outputs: ["number-expression"],
  appliesWhen: ["偶奇判定", "周期処理"],
  doesNotApplyWhen: ["文字列処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder"],
  sourceArtifactIds: ["mdn-js-modulo"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{left} % {right}", outputKinds: ["number-expression"], slots: [{ name: "left", inputKinds: ["number-expression"], required: true, multiple: false }, { name: "right", inputKinds: ["number-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.increment",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値を1増加させる",
  summary: "インクリメント演算。",
  concepts: ["increment", "++"],
  inputs: ["identifier"],
  outputs: ["number-expression"],
  appliesWhen: ["カウンタ", "反復"],
  doesNotApplyWhen: ["値を任意量変更"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Increment"],
  sourceArtifactIds: ["mdn-js-increment"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{value}++", outputKinds: ["number-expression"], slots: [{ name: "value", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.decrement",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値を1減少させる",
  summary: "デクリメント演算。",
  concepts: ["decrement", "--"],
  inputs: ["identifier"],
  outputs: ["number-expression"],
  appliesWhen: ["カウンタ減少"],
  doesNotApplyWhen: ["値を任意量変更"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Decrement"],
  sourceArtifactIds: ["mdn-js-decrement"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{value}--", outputKinds: ["number-expression"], slots: [{ name: "value", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.new-expression",
  componentType: "CODE_CONSTRUCTION",
  purpose: "constructorから新しいインスタンスを生成する",
  summary: "new演算子によるインスタンス生成。",
  concepts: ["new", "constructor", "instance"],
  inputs: ["identifier", "expression"],
  outputs: ["expression"],
  appliesWhen: ["クラス", "組み込み型生成"],
  doesNotApplyWhen: ["静的関数呼び出し"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new"],
  sourceArtifactIds: ["mdn-js-new-expression"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "new {name}({arguments})", outputKinds: ["expression"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "arguments", inputKinds: ["expression"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.map-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapを生成する",
  summary: "キーと値を持つMapインスタンスを構成する。",
  concepts: ["Map", "collection", "key-value"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["キーによる集合管理"],
  doesNotApplyWhen: ["順序付き配列処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map"],
  sourceArtifactIds: ["mdn-js-map-constructor"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "new Map()", outputKinds: ["expression"], slots: [{ name: "arguments", inputKinds: ["expression"], required: false, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.map-set",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapへ値を登録する",
  summary: "Map.setによってキーと値を登録する。",
  concepts: ["Map.set", "Map", "mutation"],
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["Map更新"],
  doesNotApplyWhen: ["配列末尾追加"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set"],
  sourceArtifactIds: ["mdn-js-map-set"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "{map}.set({key}, {value})", outputKinds: ["expression"], slots: [{ name: "map", inputKinds: ["expression"], required: true, multiple: false }, { name: "key", inputKinds: ["expression"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.map-get",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapから値を取得する",
  summary: "Map.getによるキー検索。",
  concepts: ["Map.get", "Map", "lookup"],
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["Map検索"],
  doesNotApplyWhen: ["配列検索"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get"],
  sourceArtifactIds: ["mdn-js-map-get"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "{map}.get({key})", outputKinds: ["expression"], slots: [{ name: "map", inputKinds: ["expression"], required: true, multiple: false }, { name: "key", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.set-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setを生成する",
  summary: "重複を排除した値集合を構成する。",
  concepts: ["Set", "collection", "unique"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["重複排除", "集合"],
  doesNotApplyWhen: ["キーと値のMap"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set"],
  sourceArtifactIds: ["mdn-js-set-constructor"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "new Set({values})", outputKinds: ["expression"], slots: [{ name: "values", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.set-add",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setへ値を追加する",
  summary: "Set.addによる集合更新。",
  concepts: ["Set.add", "Set", "mutation"],
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["集合追加"],
  doesNotApplyWhen: ["Map更新"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/add"],
  sourceArtifactIds: ["mdn-js-set-add"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "{set}.add({value})", outputKinds: ["expression"], slots: [{ name: "set", inputKinds: ["expression"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.set-has",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setに値が存在するか判定する",
  summary: "Set.hasによる存在確認。",
  concepts: ["Set.has", "Set", "lookup"],
  inputs: ["expression", "expression"],
  outputs: ["boolean-expression"],
  appliesWhen: ["集合存在判定"],
  doesNotApplyWhen: ["配列変換"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/has"],
  sourceArtifactIds: ["mdn-js-set-has"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "{set}.has({value})", outputKinds: ["boolean-expression"], slots: [{ name: "set", inputKinds: ["expression"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.promise-then",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise成功結果を連鎖処理する",
  summary: "thenによる非同期成功経路の連鎖。",
  concepts: ["Promise.then", "async", "chain"],
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  appliesWhen: ["非同期変換", "結果連鎖"],
  doesNotApplyWhen: ["同期結果だけの処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then"],
  sourceArtifactIds: ["mdn-js-promise-then"],
  constructionProfile: { kind: "ASYNC", syntaxTemplate: "{promise}.then({handler})", outputKinds: ["promise-expression"], slots: [{ name: "promise", inputKinds: ["promise-expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.promise-catch",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise失敗結果を処理する",
  summary: "catchによる非同期エラー経路。",
  concepts: ["Promise.catch", "async", "error"],
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  appliesWhen: ["非同期エラー処理"],
  doesNotApplyWhen: ["成功経路だけ"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch"],
  sourceArtifactIds: ["mdn-js-promise-catch"],
  constructionProfile: { kind: "ASYNC", syntaxTemplate: "{promise}.catch({handler})", outputKinds: ["promise-expression"], slots: [{ name: "promise", inputKinds: ["promise-expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.promise-finally",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise完了時処理を構成する",
  summary: "成功失敗に関係なく実行されるfinally処理。",
  concepts: ["Promise.finally", "cleanup", "async"],
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  appliesWhen: ["cleanup", "後処理"],
  doesNotApplyWhen: ["成功時だけの処理"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally"],
  sourceArtifactIds: ["mdn-js-promise-finally"],
  constructionProfile: { kind: "ASYNC", syntaxTemplate: "{promise}.finally({handler})", outputKinds: ["promise-expression"], slots: [{ name: "promise", inputKinds: ["promise-expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.set-timeout",
  componentType: "CODE_CONSTRUCTION",
  purpose: "遅延実行を構成する",
  summary: "setTimeoutによる遅延処理。",
  concepts: ["setTimeout", "timer", "async"],
  inputs: ["function-expression", "number-expression"],
  outputs: ["timer-expression"],
  appliesWhen: ["遅延", "再試行", "タイマー"],
  doesNotApplyWhen: ["即時実行"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/API/setTimeout"],
  sourceArtifactIds: ["mdn-js-set-timeout"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "setTimeout({handler}, {delay})", outputKinds: ["timer-expression"], slots: [{ name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "delay", inputKinds: ["number-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.clear-timeout",
  componentType: "CODE_CONSTRUCTION",
  purpose: "タイマーを解除する",
  summary: "clearTimeoutによるタイマーキャンセル。",
  concepts: ["clearTimeout", "timer", "cancel"],
  inputs: ["timer-expression"],
  outputs: ["expression"],
  appliesWhen: ["タイマーキャンセル"],
  doesNotApplyWhen: ["タイマー開始"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/API/clearTimeout"],
  sourceArtifactIds: ["mdn-js-clear-timeout"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "clearTimeout({timer})", outputKinds: ["expression"], slots: [{ name: "timer", inputKinds: ["timer-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.date-now",
  componentType: "CODE_CONSTRUCTION",
  purpose: "現在時刻を取得する",
  summary: "Date.nowによるtimestamp取得。",
  concepts: ["Date.now", "time", "timestamp"],
  inputs: [],
  outputs: ["number-expression"],
  appliesWhen: ["時刻取得"],
  doesNotApplyWhen: ["固定値生成"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now"],
  sourceArtifactIds: ["mdn-js-date-now"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "Date.now()", outputKinds: ["number-expression"], slots: [], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.regexp-test",
  componentType: "CODE_CONSTRUCTION",
  purpose: "正規表現で文字列を判定する",
  summary: "RegExp.testによるパターン判定。",
  concepts: ["RegExp", "test", "pattern"],
  inputs: ["string-expression", "regexp-expression"],
  outputs: ["boolean-expression"],
  appliesWhen: ["入力検証", "パターン検索"],
  doesNotApplyWhen: ["単純な部分文字列検索"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test"],
  sourceArtifactIds: ["mdn-js-regexp-test"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "{pattern}.test({text})", outputKinds: ["boolean-expression"], slots: [{ name: "pattern", inputKinds: ["regexp-expression"], required: true, multiple: false }, { name: "text", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.console-log",
  componentType: "CODE_CONSTRUCTION",
  purpose: "ログを出力する",
  summary: "console.logによる診断情報出力。",
  concepts: ["console.log", "logging", "debug"],
  inputs: ["expression"],
  outputs: ["statement"],
  appliesWhen: ["診断", "進捗", "開発ログ"],
  doesNotApplyWhen: ["機密情報の無制限出力"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/API/console/log_static"],
  sourceArtifactIds: ["mdn-js-console-log"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "console.log({value})", outputKinds: ["statement"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.console-error",
  componentType: "CODE_CONSTRUCTION",
  purpose: "エラーログを出力する",
  summary: "console.errorによる失敗情報出力。",
  concepts: ["console.error", "logging", "error"],
  inputs: ["expression"],
  outputs: ["statement"],
  appliesWhen: ["エラー診断"],
  doesNotApplyWhen: ["成功ログ"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/API/console/error_static"],
  sourceArtifactIds: ["mdn-js-console-error"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "console.error({error})", outputKinds: ["statement"], slots: [{ name: "error", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.error-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Errorインスタンスを生成する",
  summary: "失敗理由をErrorオブジェクトとして表現する。",
  concepts: ["Error", "exception", "message"],
  inputs: ["string-expression"],
  outputs: ["expression"],
  appliesWhen: ["例外", "失敗結果"],
  doesNotApplyWhen: ["単純な文字列だけ"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error"],
  sourceArtifactIds: ["mdn-js-error-constructor"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "new Error({message})", outputKinds: ["expression"], slots: [{ name: "message", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.import-named",
  componentType: "CODE_CONSTRUCTION",
  purpose: "名前付きexportをimportする",
  summary: "ES Moduleのnamed import。",
  concepts: ["import", "named export", "module"],
  inputs: ["string-expression"],
  outputs: ["statement"],
  appliesWhen: ["モジュール依存"],
  doesNotApplyWhen: ["単一default import"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import"],
  sourceArtifactIds: ["mdn-js-import-named"],
  constructionProfile: { kind: "MODULE", syntaxTemplate: "import { {name} } from {module}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "module", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.import-default",
  componentType: "CODE_CONSTRUCTION",
  purpose: "default exportをimportする",
  summary: "ES Moduleのdefault import。",
  concepts: ["import", "default export", "module"],
  inputs: ["string-expression"],
  outputs: ["statement"],
  appliesWhen: ["モジュール依存"],
  doesNotApplyWhen: ["named importのみ"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import"],
  sourceArtifactIds: ["mdn-js-import-default"],
  constructionProfile: { kind: "MODULE", syntaxTemplate: "import {name} from {module}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "module", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.export-named",
  componentType: "CODE_CONSTRUCTION",
  purpose: "名前付きexportを構成する",
  summary: "値や関数をnamed exportとして公開する。",
  concepts: ["export", "named export", "module"],
  inputs: ["expression"],
  outputs: ["statement"],
  appliesWhen: ["モジュール公開"],
  doesNotApplyWhen: ["内部専用値"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export"],
  sourceArtifactIds: ["mdn-js-export-named"],
  constructionProfile: { kind: "MODULE", syntaxTemplate: "export {value}", outputKinds: ["statement"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.export-default",
  componentType: "CODE_CONSTRUCTION",
  purpose: "default exportを構成する",
  summary: "単一の主要な値をdefault exportする。",
  concepts: ["export default", "module"],
  inputs: ["expression"],
  outputs: ["statement"],
  appliesWhen: ["単一主要export"],
  doesNotApplyWhen: ["複数named export"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export"],
  sourceArtifactIds: ["mdn-js-export-default"],
  constructionProfile: { kind: "MODULE", syntaxTemplate: "export default {value}", outputKinds: ["statement"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.class-declaration",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript classを構成する",
  summary: "状態と振る舞いを持つclass宣言。",
  concepts: ["class", "object", "method"],
  inputs: ["identifier", "statement"],
  outputs: ["statement"],
  appliesWhen: ["状態と振る舞いの集約"],
  doesNotApplyWhen: ["単純関数だけで十分"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes"],
  sourceArtifactIds: ["mdn-js-class-declaration"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "class {name} {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.class-method",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript class methodを構成する",
  summary: "class内部のmethod定義。",
  concepts: ["class", "method", "this"],
  inputs: ["identifier", "parameter", "statement"],
  outputs: ["statement"],
  appliesWhen: ["class振る舞い"],
  doesNotApplyWhen: ["独立関数"],
  sourceUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions"],
  sourceArtifactIds: ["mdn-js-class-method"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}({parameters}) {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameters", inputKinds: ["parameter"], required: false, multiple: true }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.node-write-file",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.jsでファイルを非同期書き込みする",
  summary: "fs/promises.writeFileによるファイル生成更新。",
  concepts: ["Node.js", "writeFile", "filesystem", "I/O"],
  inputs: ["string-expression", "string-expression"],
  outputs: ["promise-expression"],
  appliesWhen: ["自律コード生成", "ファイル保存"],
  doesNotApplyWhen: ["読み取りだけ"],
  sourceUrls: ["https://nodejs.org/api/fs.html"],
  sourceArtifactIds: ["node-fs-write-file"],
  constructionProfile: { kind: "ASYNC", syntaxTemplate: "writeFile({path}, {content}, 'utf8')", outputKinds: ["promise-expression"], slots: [{ name: "path", inputKinds: ["string-expression"], required: true, multiple: false }, { name: "content", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.node-mkdir",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.jsでディレクトリを作成する",
  summary: "fs/promises.mkdirによるディレクトリ生成。",
  concepts: ["Node.js", "mkdir", "filesystem"],
  inputs: ["string-expression"],
  outputs: ["promise-expression"],
  appliesWhen: ["workspace", "生成先準備"],
  doesNotApplyWhen: ["既存ディレクトリ不要"],
  sourceUrls: ["https://nodejs.org/api/fs.html"],
  sourceArtifactIds: ["node-fs-mkdir"],
  constructionProfile: { kind: "ASYNC", syntaxTemplate: "mkdir({path}, {options})", outputKinds: ["promise-expression"], slots: [{ name: "path", inputKinds: ["string-expression"], required: true, multiple: false }, { name: "options", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.node-path-join",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.js pathを安全に結合する",
  summary: "path.joinによるOS依存区切りを考慮したパス構築。",
  concepts: ["Node.js", "path.join", "filesystem"],
  inputs: ["string-expression"],
  outputs: ["string-expression"],
  appliesWhen: ["workspace path", "target path"],
  doesNotApplyWhen: ["URL結合"],
  sourceUrls: ["https://nodejs.org/api/path.html"],
  sourceArtifactIds: ["node-path-join"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "join({parts})", outputKinds: ["string-expression"], slots: [{ name: "parts", inputKinds: ["string-expression"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.javascript.node-env-access",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.js process.envから環境値を取得する",
  summary: "実行環境設定値の読み取り。",
  concepts: ["Node.js", "process.env", "configuration"],
  inputs: ["string-expression"],
  outputs: ["string-expression"],
  appliesWhen: ["API key", "設定", "runtime config"],
  doesNotApplyWhen: ["秘密値のログ出力"],
  sourceUrls: ["https://nodejs.org/api/process.html"],
  sourceArtifactIds: ["node-process-env"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "process.env[{name}]", outputKinds: ["string-expression"], slots: [{ name: "name", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  "id": "code.javascript.if-else-statement",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "if/else条件分岐を構成する",
  "summary": "if/else条件分岐を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "if",
    "else",
    "statement",
    "boolean-expression"
  ],
  "inputs": [
    "boolean-expression",
    "statement",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "if/else条件分岐を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.if-else-statement"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "if ({condition}) {\\n{thenBody}\\n} else {\\n{elseBody}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "condition",
        "inputKinds": [
          "boolean-expression"
        ],
        "required": true
      },
      {
        "name": "thenBody",
        "inputKinds": [
          "statement"
        ],
        "required": true
      },
      {
        "name": "elseBody",
        "inputKinds": [
          "statement"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.for-statement",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "初期化・条件・更新を持つfor反復を構成する",
  "summary": "初期化・条件・更新を持つfor反復を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "for",
    "statement",
    "boolean-expression",
    "expression"
  ],
  "inputs": [
    "statement",
    "boolean-expression",
    "expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "初期化・条件・更新を持つfor反復を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.for-statement"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "for ({initializer}; {condition}; {update}) {\\n{body}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "initializer",
        "inputKinds": [
          "statement"
        ],
        "required": false
      },
      {
        "name": "condition",
        "inputKinds": [
          "boolean-expression"
        ],
        "required": false
      },
      {
        "name": "update",
        "inputKinds": [
          "expression"
        ],
        "required": false
      },
      {
        "name": "body",
        "inputKinds": [
          "statement"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.try-catch-finally",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "catchとfinallyを含む例外処理を構成する",
  "summary": "catchとfinallyを含む例外処理を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "try",
    "catch",
    "finally",
    "statement",
    "identifier"
  ],
  "inputs": [
    "statement",
    "identifier",
    "statement",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "catchとfinallyを含む例外処理を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.try-catch-finally"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "try {\\n{tryBody}\\n} catch ({error}) {\\n{catchBody}\\n} finally {\\n{finallyBody}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "tryBody",
        "inputKinds": [
          "statement"
        ],
        "required": true
      },
      {
        "name": "error",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "catchBody",
        "inputKinds": [
          "statement"
        ],
        "required": true
      },
      {
        "name": "finallyBody",
        "inputKinds": [
          "statement"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.ternary",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "条件によって2つの式から値を選択する",
  "summary": "条件によって2つの式から値を選択する。既存Construction Graphで再利用する。",
  "concepts": [
    "ternary",
    "boolean-expression",
    "expression"
  ],
  "inputs": [
    "boolean-expression",
    "expression",
    "expression"
  ],
  "outputs": [
    "expression"
  ],
  "appliesWhen": [
    "条件によって2つの式から値を選択する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.ternary"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "({condition}) ? ({whenTrue}) : ({whenFalse})",
    "outputKinds": [
      "expression"
    ],
    "slots": [
      {
        "name": "condition",
        "inputKinds": [
          "boolean-expression"
        ],
        "required": true
      },
      {
        "name": "whenTrue",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "whenFalse",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.object-destructuring",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Objectから複数propertyをdestructureする",
  "summary": "Objectから複数propertyをdestructureする。既存Construction Graphで再利用する。",
  "concepts": [
    "object",
    "destructuring",
    "identifier",
    "object-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "object-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Objectから複数propertyをdestructureする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.object-destructuring"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "const { {properties} } = {object};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "properties",
        "inputKinds": [
          "identifier"
        ],
        "required": true,
        "multiple": true
      },
      {
        "name": "object",
        "inputKinds": [
          "object-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.array-destructuring",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Arrayから値をdestructureする",
  "summary": "Arrayから値をdestructureする。既存Construction Graphで再利用する。",
  "concepts": [
    "array",
    "destructuring",
    "identifier",
    "array-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "array-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Arrayから値をdestructureする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.array-destructuring"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "const [{items}] = {array};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "items",
        "inputKinds": [
          "identifier"
        ],
        "required": true,
        "multiple": true
      },
      {
        "name": "array",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.array-flat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ネストしたArrayを指定深度まで平坦化する",
  "summary": "ネストしたArrayを指定深度まで平坦化する。既存Construction Graphで再利用する。",
  "concepts": [
    "array",
    "flat",
    "array-expression",
    "number-expression"
  ],
  "inputs": [
    "array-expression",
    "number-expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "appliesWhen": [
    "ネストしたArrayを指定深度まで平坦化する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.array-flat"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{array}.flat({depth})",
    "outputKinds": [
      "array-expression"
    ],
    "slots": [
      {
        "name": "array",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      },
      {
        "name": "depth",
        "inputKinds": [
          "number-expression"
        ],
        "required": false
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.array-flat-map",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "mapしてから配列を平坦化する",
  "summary": "mapしてから配列を平坦化する。既存Construction Graphで再利用する。",
  "concepts": [
    "array",
    "flat",
    "map",
    "array-expression",
    "function-expression"
  ],
  "inputs": [
    "array-expression",
    "function-expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "appliesWhen": [
    "mapしてから配列を平坦化する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.array-flat-map"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{array}.flatMap({mapper})",
    "outputKinds": [
      "array-expression"
    ],
    "slots": [
      {
        "name": "array",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      },
      {
        "name": "mapper",
        "inputKinds": [
          "function-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.string-replace-all",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列中の一致箇所をすべて置換する",
  "summary": "文字列中の一致箇所をすべて置換する。既存Construction Graphで再利用する。",
  "concepts": [
    "string",
    "replace",
    "all",
    "string-expression"
  ],
  "inputs": [
    "string-expression",
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "文字列中の一致箇所をすべて置換する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.string-replace-all"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{text}.replaceAll({search}, {replacement})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "text",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "search",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "replacement",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.promise-all",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Promiseをすべて待機する",
  "summary": "複数Promiseをすべて待機する。既存Construction Graphで再利用する。",
  "concepts": [
    "promise",
    "all",
    "array-expression",
    "promise-expression"
  ],
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "複数Promiseをすべて待機する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.promise-all"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "Promise.all({promises})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "promises",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.promise-all-settled",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Promiseの成功失敗結果をすべて待機する",
  "summary": "複数Promiseの成功失敗結果をすべて待機する。既存Construction Graphで再利用する。",
  "concepts": [
    "promise",
    "all",
    "settled",
    "array-expression",
    "promise-expression"
  ],
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "複数Promiseの成功失敗結果をすべて待機する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.promise-all-settled"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "Promise.allSettled({promises})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "promises",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.async-function",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "async functionを構成する",
  "summary": "async functionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "async",
    "function",
    "identifier",
    "parameter",
    "statement"
  ],
  "inputs": [
    "identifier",
    "parameter",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "async functionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.async-function"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "async function {name}({parameters}) {\\n{body}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "name",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "parameters",
        "inputKinds": [
          "parameter"
        ],
        "required": false,
        "multiple": true
      },
      {
        "name": "body",
        "inputKinds": [
          "statement"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.javascript.object-assign",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Objectを結合してtargetへ代入する",
  "summary": "複数Objectを結合してtargetへ代入する。既存Construction Graphで再利用する。",
  "concepts": [
    "object",
    "assign",
    "object-expression"
  ],
  "inputs": [
    "object-expression",
    "object-expression"
  ],
  "outputs": [
    "object-expression"
  ],
  "appliesWhen": [
    "複数Objectを結合してtargetへ代入する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.object-assign"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "Object.assign({target}, {sources})",
    "outputKinds": [
      "object-expression"
    ],
    "slots": [
      {
        "name": "target",
        "inputKinds": [
          "object-expression"
        ],
        "required": true
      },
      {
        "name": "sources",
        "inputKinds": [
          "object-expression"
        ],
        "required": true,
        "multiple": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},
{
  "id": "code.javascript.promise-resolve",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promiseを成功状態へ変換する",
  "summary": "Promiseを成功状態へ変換する。既存Construction Graphで再利用する。",
  "concepts": [
    "promise",
    "resolve",
    "expression",
    "promise-expression"
  ],
  "inputs": [
    "expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "Promiseを成功状態へ変換する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.promise-resolve"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "Promise.resolve({value})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.promise-reject",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promiseを失敗状態へ変換する",
  "summary": "Promiseを失敗状態へ変換する。既存Construction Graphで再利用する。",
  "concepts": [
    "promise",
    "reject",
    "expression",
    "promise-expression"
  ],
  "inputs": [
    "expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "Promiseを失敗状態へ変換する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.promise-reject"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "Promise.reject({error})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "error",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.abort-controller",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "非同期処理のキャンセル制御を構成する",
  "summary": "非同期処理のキャンセル制御を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "abort",
    "controller",
    "identifier",
    "statement"
  ],
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "非同期処理のキャンセル制御を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.abort-controller"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "const {name} = new AbortController();",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "name",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.throw-error",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Error objectを生成して送出する",
  "summary": "Error objectを生成して送出する。既存Construction Graphで再利用する。",
  "concepts": [
    "throw",
    "error",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Error objectを生成して送出する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.throw-error"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "throw new Error({message});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "message",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.logical-assignment-or",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "OR論理代入を構成する",
  "summary": "OR論理代入を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "logical",
    "assignment",
    "or",
    "expression",
    "statement"
  ],
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "OR論理代入を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.logical-assignment-or"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "{target} ||= {value};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "target",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.logical-assignment-and",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "AND論理代入を構成する",
  "summary": "AND論理代入を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "logical",
    "assignment",
    "and",
    "expression",
    "statement"
  ],
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "AND論理代入を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.logical-assignment-and"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "{target} &&= {value};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "target",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.logical-assignment-nullish",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Nullish論理代入を構成する",
  "summary": "Nullish論理代入を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "logical",
    "assignment",
    "nullish",
    "expression",
    "statement"
  ],
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Nullish論理代入を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.logical-assignment-nullish"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "{target} ??= {value};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "target",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.array-concat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Arrayを結合する",
  "summary": "複数Arrayを結合する。既存Construction Graphで再利用する。",
  "concepts": [
    "array",
    "concat",
    "array-expression",
    "expression"
  ],
  "inputs": [
    "array-expression",
    "expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "appliesWhen": [
    "複数Arrayを結合する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.array-concat"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{array}.concat({items})",
    "outputKinds": [
      "array-expression"
    ],
    "slots": [
      {
        "name": "array",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      },
      {
        "name": "items",
        "inputKinds": [
          "expression"
        ],
        "required": false,
        "multiple": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.string-slice",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列の一部を抽出する",
  "summary": "文字列の一部を抽出する。既存Construction Graphで再利用する。",
  "concepts": [
    "string",
    "slice",
    "string-expression",
    "number-expression"
  ],
  "inputs": [
    "string-expression",
    "number-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "文字列の一部を抽出する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.string-slice"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{text}.slice({start}, {end})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "text",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "start",
        "inputKinds": [
          "number-expression"
        ],
        "required": true
      },
      {
        "name": "end",
        "inputKinds": [
          "number-expression"
        ],
        "required": false
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.string-to-lower-case",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列を小文字化する",
  "summary": "文字列を小文字化する。既存Construction Graphで再利用する。",
  "concepts": [
    "string",
    "to",
    "lower",
    "case",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "文字列を小文字化する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.string-to-lower-case"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{text}.toLowerCase()",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "text",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.string-to-upper-case",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列を大文字化する",
  "summary": "文字列を大文字化する。既存Construction Graphで再利用する。",
  "concepts": [
    "string",
    "to",
    "upper",
    "case",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "文字列を大文字化する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.string-to-upper-case"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "{text}.toUpperCase()",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "text",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.object-from-entries",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "entry配列からObjectを構成する",
  "summary": "entry配列からObjectを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "object",
    "from",
    "entries",
    "array-expression",
    "object-expression"
  ],
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "object-expression"
  ],
  "appliesWhen": [
    "entry配列からObjectを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.object-from-entries"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "Object.fromEntries({entries})",
    "outputKinds": [
      "object-expression"
    ],
    "slots": [
      {
        "name": "entries",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.javascript.dynamic-import",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "動的Module importを構成する",
  "summary": "動的Module importを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "dynamic",
    "import",
    "string-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "動的Module importを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.javascript.dynamic-import"
  ],
  "constructionProfile": {
    "kind": "MODULE",
    "syntaxTemplate": "import({module})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "module",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-read-file",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルを非同期で読み込む",
  "summary": "ファイルを非同期で読み込む。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "read",
    "file",
    "string-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ファイルを非同期で読み込む"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-read-file"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.readFile({path}, {encoding})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "encoding",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-write-file",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルへ非同期で書き込む",
  "summary": "ファイルへ非同期で書き込む。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "write",
    "file",
    "string-expression",
    "expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression",
    "expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ファイルへ非同期で書き込む"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-write-file"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.writeFile({path}, {data}, {encoding})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "data",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "encoding",
        "inputKinds": [
          "string-expression"
        ],
        "required": false
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-readdir",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ディレクトリ内容を取得する",
  "summary": "ディレクトリ内容を取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "readdir",
    "string-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ディレクトリ内容を取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-readdir"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.readdir({path})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-stat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイル状態を取得する",
  "summary": "ファイル状態を取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "stat",
    "string-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ファイル状態を取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-stat"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.stat({path})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-mkdir",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ディレクトリを作成する",
  "summary": "ディレクトリを作成する。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "mkdir",
    "string-expression",
    "object-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression",
    "object-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ディレクトリを作成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-mkdir"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.mkdir({path}, {options})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "options",
        "inputKinds": [
          "object-expression"
        ],
        "required": false
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-rename",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルまたはディレクトリを移動する",
  "summary": "ファイルまたはディレクトリを移動する。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "rename",
    "string-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ファイルまたはディレクトリを移動する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-rename"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.rename({from}, {to})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "from",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "to",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.fs-rm",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルまたはディレクトリを削除する",
  "summary": "ファイルまたはディレクトリを削除する。既存Construction Graphで再利用する。",
  "concepts": [
    "fs",
    "rm",
    "string-expression",
    "object-expression",
    "promise-expression"
  ],
  "inputs": [
    "string-expression",
    "object-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "appliesWhen": [
    "ファイルまたはディレクトリを削除する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.fs-rm"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "fs.rm({path}, {options})",
    "outputKinds": [
      "promise-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "options",
        "inputKinds": [
          "object-expression"
        ],
        "required": false
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.path-join",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "パスを安全に結合する",
  "summary": "パスを安全に結合する。既存Construction Graphで再利用する。",
  "concepts": [
    "path",
    "join",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "パスを安全に結合する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.path-join"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "path.join({parts})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "parts",
        "inputKinds": [
          "string-expression"
        ],
        "required": true,
        "multiple": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.path-resolve",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "絶対パスを解決する",
  "summary": "絶対パスを解決する。既存Construction Graphで再利用する。",
  "concepts": [
    "path",
    "resolve",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "絶対パスを解決する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.path-resolve"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "path.resolve({parts})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "parts",
        "inputKinds": [
          "string-expression"
        ],
        "required": true,
        "multiple": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.path-dirname",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "親ディレクトリを取得する",
  "summary": "親ディレクトリを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "path",
    "dirname",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "親ディレクトリを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.path-dirname"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "path.dirname({path})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.path-basename",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイル名部分を取得する",
  "summary": "ファイル名部分を取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "path",
    "basename",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "ファイル名部分を取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.path-basename"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "path.basename({path})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.path-extname",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "拡張子を取得する",
  "summary": "拡張子を取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "path",
    "extname",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "拡張子を取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.path-extname"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "path.extname({path})",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "path",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.node.process-env",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "環境変数を取得する",
  "summary": "環境変数を取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "process",
    "env",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "環境変数を取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference"
  ],
  "sourceArtifactIds": [
    "js:code.node.process-env"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "process.env[{name}]",
    "outputKinds": [
      "string-expression"
    ],
    "slots": [
      {
        "name": "name",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      }
    ],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},

  {
    id: 'code.javascript.node-readdir',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js fs/promisesでディレクトリ内容を非同期列挙する',
    summary: 'readdirによってディレクトリのエントリ一覧をPromiseとして取得する。',
    concepts: ['Node.js', 'fs/promises', 'readdir', 'directory'],
    inputs: ['string-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['ディレクトリ内容を列挙する'],
    doesNotApplyWhen: ['ブラウザ専用環境'],
    sourceUrls: ['https://nodejs.org/api/fs.html#fspromisesreaddirpath-options'],
    sourceArtifactIds: ['node-fs-readdir'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'readdir({path})',
      outputKinds: ['promise-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['filesystem access must be allowed'],
      adaptationRules: ['use explicit options only when required'],
    },
  },
  {
    id: 'code.javascript.node-stat',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js fs/promisesでファイルやディレクトリの状態を取得する',
    summary: 'statによって対象パスのmetadataをPromiseとして取得する。',
    concepts: ['Node.js', 'fs/promises', 'stat'],
    inputs: ['string-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['ファイルやディレクトリの状態取得'],
    doesNotApplyWhen: ['ブラウザ専用環境'],
    sourceUrls: ['https://nodejs.org/api/fs.html#fspromisesstatpath-options'],
    sourceArtifactIds: ['node-fs-stat'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'stat({path})',
      outputKinds: ['promise-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['filesystem access must be allowed'],
      adaptationRules: ['inspect Stats only after awaiting the Promise'],
    },
  },
  {
    id: 'code.javascript.node-rename',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js fs/promisesでファイルやディレクトリを移動・改名する',
    summary: 'renameによるfilesystem mutationを構成する。',
    concepts: ['Node.js', 'fs/promises', 'rename'],
    inputs: ['string-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['ファイル移動', 'ファイル名変更'],
    doesNotApplyWhen: ['読み取り専用処理'],
    sourceUrls: ['https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath'],
    sourceArtifactIds: ['node-fs-rename'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'rename({from}, {to})',
      outputKinds: ['promise-expression'],
      slots: [
        { name: 'from', inputKinds: ['string-expression'], required: true },
        { name: 'to', inputKinds: ['string-expression'], required: true },
      ],
      constraints: ['source and destination must be valid filesystem paths'],
      adaptationRules: ['resolve collision policy before mutation'],
    },
  },
  {
    id: 'code.javascript.node-rm',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js fs/promisesでファイルやディレクトリを削除する',
    summary: 'rmによるfilesystem削除処理を構成する。',
    concepts: ['Node.js', 'fs/promises', 'rm'],
    inputs: ['string-expression'],
    outputs: ['promise-expression'],
    appliesWhen: ['filesystem entryの削除'],
    doesNotApplyWhen: ['削除禁止処理'],
    sourceUrls: ['https://nodejs.org/api/fs.html#fspromisesrmpath-options'],
    sourceArtifactIds: ['node-fs-rm'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'rm({path})',
      outputKinds: ['promise-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['deletion must be allowed by the safety contract'],
      adaptationRules: ['recursive deletion requires explicit requirement'],
    },
  },
  {
    id: 'code.javascript.node-path-resolve',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js path.resolveで絶対パスを構成する',
    summary: 'path fragmentから正規化された絶対パスを作る。',
    concepts: ['Node.js', 'path', 'resolve'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['絶対パスが必要'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://nodejs.org/api/path.html#pathresolvepaths'],
    sourceArtifactIds: ['node-path-resolve'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'resolve({parts})',
      outputKinds: ['string-expression'],
      slots: [{ name: 'parts', inputKinds: ['string-expression'], required: true, multiple: true }],
      constraints: ['path fragments must be strings'],
      adaptationRules: ['prefer path APIs over manual separators'],
    },
  },
  {
    id: 'code.javascript.node-path-dirname',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js path.dirnameで親ディレクトリを取得する',
    summary: 'pathから親ディレクトリを抽出する。',
    concepts: ['Node.js', 'path', 'dirname'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['親ディレクトリの導出'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://nodejs.org/api/path.html#pathdirnamepath'],
    sourceArtifactIds: ['node-path-dirname'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'dirname({path})',
      outputKinds: ['string-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['path must be a string'],
      adaptationRules: ['use path APIs instead of string slicing'],
    },
  },
  {
    id: 'code.javascript.node-path-basename',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js path.basenameで末尾の名前部分を取得する',
    summary: 'pathからbasenameを抽出する。',
    concepts: ['Node.js', 'path', 'basename'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['ファイル名取得'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://nodejs.org/api/path.html#pathbasenamepath-suffix'],
    sourceArtifactIds: ['node-path-basename'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'basename({path})',
      outputKinds: ['string-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['path must be a string'],
      adaptationRules: ['use suffix handling only when required'],
    },
  },
  {
    id: 'code.javascript.node-path-extname',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js path.extnameで拡張子を取得する',
    summary: 'pathから拡張子を抽出する。',
    concepts: ['Node.js', 'path', 'extname'],
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    appliesWhen: ['拡張子判定'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://nodejs.org/api/path.html#pathextnamepath'],
    sourceArtifactIds: ['node-path-extname'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'extname({path})',
      outputKinds: ['string-expression'],
      slots: [{ name: 'path', inputKinds: ['string-expression'], required: true }],
      constraints: ['path must be a string'],
      adaptationRules: ['normalize case separately when needed'],
    },
  },
  {
    "id": "code.javascript.array-flat-map",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Arrayの各要素を変換して平坦化する",
    "summary": "Array.flatMapによる変換と平坦化。",
    "concepts": [
      "Array.flatMap",
      "array",
      "callback"
    ],
    "inputs": [
      "array-expression",
      "function-expression"
    ],
    "outputs": [
      "array-expression"
    ],
    "appliesWhen": [
      "配列を変換しつつ一段階平坦化する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.javascript.array-flat-map"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "{array}.flatMap({callback})",
      "outputKinds": [
        "array-expression"
      ],
      "slots": [
        {
          "name": "array",
          "inputKinds": [
            "array-expression"
          ],
          "required": true
        },
        {
          "name": "callback",
          "inputKinds": [
            "function-expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.javascript.logical-assignment",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "nullishや論理値に応じて変数を条件付き更新する",
    "summary": "論理代入演算子による条件付き代入。",
    "concepts": [
      "&&=",
      "||=",
      "??="
    ],
    "inputs": [
      "identifier",
      "expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "既存値に応じて再代入する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.javascript.logical-assignment"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "{target} ??= {value};",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "target",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "value",
          "inputKinds": [
            "expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.javascript.error-cause",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Errorへ原因情報を保持する",
    "summary": "Error options causeによるエラー来歴保持。",
    "concepts": [
      "Error",
      "cause",
      "error chain"
    ],
    "inputs": [
      "string-expression",
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "エラー原因を保持する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.javascript.error-cause"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "new Error({message}, { cause: {cause} })",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "message",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        },
        {
          "name": "cause",
          "inputKinds": [
            "expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  }
,
  {
    id: 'code.javascript.array-from',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Iterableを配列へ変換して後続のArray系Componentへ接続する',
    summary: 'Array.fromを使い、Iterableな入力をarray-expressionへ変換する。',
    concepts: ['Array.from', 'iterable', 'array'],
    inputs: ['iterable-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['Iterableを配列化する', '配列操作へ接続する'],
    doesNotApplyWhen: ['入力がすでに配列で変換が不要な場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from'],
    sourceArtifactIds: ['mdn-array-from'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: 'Array.from({iterable})',
      outputKinds: ['array-expression'],
      slots: [
        {
          name: 'iterable',
          inputKinds: ['iterable-expression'],
          required: true,
        },
      ],
      constraints: ['iterable must be convertible to an array'],
      adaptationRules: [
        'reuse the original iterable when downstream code already accepts iterable-expression',
      ],
    },
  }

];

export const additionalJavascriptCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: 'code.javascript.array-from',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Iterableを配列へ変換する',
    implementation: 'Array.from({iterable})',
    targetPath: 'generated.ts',
    inputs: ['iterable-expression'],
    outputs: ['array-expression'],
    prerequisites: ['iterable is available'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-from',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-from\ninputs=['iterable-expression']\noutputs=['array-expression']\nimplementation_template='Array.from({iterable})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax', 'iterable contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.javascript.const-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '再代入しない値をconstとして宣言する',
    implementation: 'const {name} = {value};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'expression'],
    outputs: ['statement'],
    prerequisites: ['valid identifier', 'expression is available'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.const-declaration',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.const-declaration\ninputs=['identifier', 'expression']\noutputs=['statement']\nprerequisites=['valid identifier', 'expression is available']\nimplementation_template='const {name} = {value};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax', 'identifier contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.function-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '入力と処理を関数として再利用可能な単位にする',
    implementation: 'function {name}({parameters}) {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'parameter', 'statement'],
    outputs: ['statement'],
    prerequisites: ['valid function name'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.function-declaration',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.function-declaration\ninputs=['identifier', 'parameter', 'statement']\noutputs=['statement']\nprerequisites=['valid function name']\nimplementation_template='function {name}({parameters}) {\\\\n{body}\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax', 'parameter binding', 'body contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.if-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に応じて処理を分岐する',
    implementation: 'if ({condition}) {\\n{thenBody}\\n} else {\\n{elseBody}\\n}',
    targetPath: 'generated.ts',
    inputs: ['boolean-expression', 'statement'],
    outputs: ['statement'],
    prerequisites: ['condition expression'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.if-statement',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.if-statement\ninputs=['boolean-expression', 'statement']\noutputs=['statement']\nprerequisites=['condition expression']\nimplementation_template='if ({condition}) {\\\\n{thenBody}\\\\n} else {\\\\n{elseBody}\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax', 'branch completeness']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.for-of',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '反復可能なデータを順番に処理する',
    implementation: 'for (const {item} of {iterable}) {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'iterable-expression', 'statement'],
    outputs: ['statement'],
    prerequisites: ['iterable expression'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.for-of',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.for-of\ninputs=['identifier', 'iterable-expression', 'statement']\noutputs=['statement']\nprerequisites=['iterable expression']\nimplementation_template='for (const {item} of {iterable}) {\\\\n{body}\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax', 'iterable contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-map',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列要素を変換して新しい配列を作る',
    implementation: '{array}.map({mapper})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    prerequisites: ['array expression', 'mapper function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-map',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-map\ninputs=['array-expression', 'function-expression']\noutputs=['array-expression']\nprerequisites=['array expression', 'mapper function']\nimplementation_template='{array}.map({mapper})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['expression syntax', 'mapper contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-filter',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件を満たす配列要素だけを抽出する',
    implementation: '{array}.filter({predicate})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    prerequisites: ['array expression', 'predicate function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-filter',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-filter\ninputs=['array-expression', 'function-expression']\noutputs=['array-expression']\nprerequisites=['array expression', 'predicate function']\nimplementation_template='{array}.filter({predicate})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['expression syntax', 'predicate contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.async-await',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Promise結果をawaitして順序制御する',
    implementation: 'const {result} = await {operation};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'promise-expression'],
    outputs: ['statement'],
    prerequisites: ['Promise expression', 'async context'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.async-await',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.async-await\ninputs=['identifier', 'promise-expression']\noutputs=['statement']\nprerequisites=['Promise expression', 'async context']\nimplementation_template='const {result} = await {operation};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['async context', 'Promise contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.json-parse',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'JSON文字列をJavaScript値へ変換する',
    implementation: 'JSON.parse({text})',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['expression'],
    prerequisites: ['JSON text'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.json-parse',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.json-parse\ninputs=['string-expression']\noutputs=['expression']\nprerequisites=['JSON text']\nimplementation_template='JSON.parse({text})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['JSON syntax', 'input type']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.node-read-file',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Node.js fs/promisesでファイルを非同期読み込みする',
    implementation: "readFile({path}, 'utf8')",
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['Node.js runtime', 'filesystem permission'],
    dependencies: ['node:fs/promises'],
    supportedEnvironments: ['MIKI_RUNTIME'],
    entryPoint: 'CodeConstruction/code.javascript.node-read-file',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['node:fs/promises'],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.node-read-file\ninputs=['string-expression']\noutputs=['promise-expression']\nprerequisites=['Node.js runtime', 'filesystem permission']\nimplementation_template=\"readFile({path}, 'utf8')\"",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['Node API contract', 'filesystem policy']\ndependencies=['node:fs/promises']\nsupportedEnvironments=['MIKI_RUNTIME']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.javascript.arrow-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数を式として定義しcallbackや値として渡せる形にする',
    implementation: '({parameters}) => {body}',
    targetPath: 'generated.ts',
    inputs: ['parameter', 'expression'],
    outputs: ['function-expression', 'expression'],
    prerequisites: ['valid parameters', 'valid expression body'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.arrow-function',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.arrow-function\ninputs=['parameter', 'expression']\noutputs=['function-expression', 'expression']\nimplementation_template='({parameters}) => {body}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['function expression syntax', 'parameter contract', 'body expression']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.function-call',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存関数やComponentを引数付きで呼び出す',
    implementation: '{callee}({arguments})',
    targetPath: 'generated.ts',
    inputs: ['function-expression', 'expression'],
    outputs: ['expression', 'statement'],
    prerequisites: ['callable target'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.function-call',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.function-call\ninputs=['function-expression', 'expression']\noutputs=['expression', 'statement']\nimplementation_template='{callee}({arguments})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['call target contract', 'argument contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.return',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数処理の結果をreturnで返す',
    implementation: 'return {value};',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['statement'],
    prerequisites: ['inside function body'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.return',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.return\ninputs=['expression']\noutputs=['statement']\nimplementation_template='return {value};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['return syntax', 'function contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.assignment',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存の変数やプロパティへ値を代入する',
    implementation: '{target} = {value};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'expression'],
    outputs: ['statement', 'expression'],
    prerequisites: ['assignable target'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.assignment',
    securityClass: 'STANDARD',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.assignment\ninputs=['identifier', 'expression']\noutputs=['statement', 'expression']\nimplementation_template='{target} = {value};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['assignment target', 'value contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.comparison',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '値同士を比較してboolean条件を作る',
    implementation: '{left} {operator} {right}',
    targetPath: 'generated.ts',
    inputs: ['expression', 'comparison-operator'],
    outputs: ['boolean-expression', 'expression'],
    prerequisites: ['compatible operand types'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.comparison',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.comparison\ninputs=['expression','comparison-operator']\noutputs=['boolean-expression','expression']\nimplementation_template='{left} {operator} {right}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['operand type compatibility','operator contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.logical',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数条件を論理演算で組み合わせる',
    implementation: '{left} {operator} {right}',
    targetPath: 'generated.ts',
    inputs: ['boolean-expression', 'logical-operator'],
    outputs: ['boolean-expression', 'expression'],
    prerequisites: ['boolean-compatible conditions'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.logical',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.logical\ninputs=['boolean-expression','logical-operator']\noutputs=['boolean-expression','expression']\nimplementation_template='{left} {operator} {right}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['boolean condition contract','operator contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数の値からArrayを構成する',
    implementation: '[{elements}]',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['array-expression', 'expression'],
    prerequisites: ['valid expressions'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-literal',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-literal\ninputs=['expression']\noutputs=['array-expression','expression']\nimplementation_template='[{elements}]'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['array literal syntax','element expression contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.object-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関連する値からObjectを構成する',
    implementation: '({properties})',
    targetPath: 'generated.ts',
    inputs: ['property-assignment'],
    outputs: ['object-expression', 'expression'],
    prerequisites: ['valid object properties'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-literal',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.object-literal\ninputs=['property-assignment']\noutputs=['object-expression','expression']\nimplementation_template='({properties})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['object literal syntax','property contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.property-access',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Objectや配列などから特定プロパティを参照する',
    implementation: '{object}.{property}',
    targetPath: 'generated.ts',
    inputs: ['expression', 'identifier'],
    outputs: ['property-expression', 'expression'],
    prerequisites: ['valid object contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.property-access',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.property-access\ninputs=['expression','identifier']\noutputs=['property-expression','expression']\nimplementation_template='{object}.{property}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['member access syntax','property contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.try-catch',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '失敗する可能性のある処理をtry/catchで安全に扱う',
    implementation: 'try {\\n{tryBody}\\n} catch ({error}) {\\n{catchBody}\\n}',
    targetPath: 'generated.ts',
    inputs: ['statement', 'identifier'],
    outputs: ['statement'],
    prerequisites: ['throwing or failure-prone operation'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.try-catch',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.try-catch\ninputs=['statement','identifier']\noutputs=['statement']\nimplementation_template='try {\\\\n{tryBody}\\\\n} catch ({error}) {\\\\n{catchBody}\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['try/catch syntax','failure path contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.throw',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '異常状態を明示的に例外として送出する',
    implementation: 'throw {error};',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['statement'],
    prerequisites: ['explicit failure condition'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.throw',
    securityClass: 'STANDARD',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.throw\ninputs=['expression']\noutputs=['statement']\nimplementation_template='throw {error};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['throw syntax','failure contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.json-stringify',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'JavaScript値をJSON文字列へ変換する',
    implementation: 'JSON.stringify({value})',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['string-expression', 'expression'],
    prerequisites: ['JSON-serializable value'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.json-stringify',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.json-stringify\ninputs=['expression']\noutputs=['string-expression','expression']\nimplementation_template='JSON.stringify({value})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['JSON serialization contract','value contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.template-literal',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列と式を組み合わせた可読性の高い文字列を作る',
    implementation: '`{parts}`',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['string-expression', 'expression'],
    prerequisites: ['valid embedded expressions'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.template-literal',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.template-literal\ninputs=['expression']\noutputs=['string-expression','expression']\nimplementation_template='`{parts}`'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['template literal syntax','interpolation contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.javascript.array-find',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に合う配列要素を最初の1件として取得する',
    implementation: '{array}.find({predicate})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['expression'],
    prerequisites: ['array expression', 'predicate function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-find',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-find\ninputs=['array-expression', 'function-expression']\noutputs=['expression']\nimplementation_template='{array}.find({predicate})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['expression syntax', 'predicate contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-some',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件を満たす配列要素が存在するか判定する',
    implementation: '{array}.some({predicate})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['array expression', 'predicate function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-some',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-some\ninputs=['array-expression', 'function-expression']\noutputs=['boolean-expression']\nimplementation_template='{array}.some({predicate})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['expression syntax', 'predicate contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.javascript.array-every',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列のすべての要素が条件を満たすか判定する',
    implementation: '{array}.every({predicate})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['array expression', 'predicate function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-every',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.array-every\\ninputs=['array-expression', 'function-expression']\\noutputs=['boolean-expression']\\nimplementation_template='{array}.every({predicate})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'predicate contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-reduce',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列を畳み込んで単一の値へ変換する',
    implementation: '{array}.reduce({reducer}, {initialValue})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression', 'expression'],
    outputs: ['expression'],
    prerequisites: ['array expression', 'reducer function', 'initial value'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-reduce',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.array-reduce\\ninputs=['array-expression', 'function-expression', 'expression']\\noutputs=['expression']\\nimplementation_template='{array}.reduce({reducer}, {initialValue})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'reducer contract', 'initial value contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-includes',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列に指定した値が含まれるか判定する',
    implementation: '{array}.includes({value})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['array expression', 'search value'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-includes',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.array-includes\\ninputs=['array-expression', 'expression']\\noutputs=['boolean-expression']\\nimplementation_template='{array}.includes({value})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'membership contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-find-index',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に合う配列要素の最初の位置を取得する',
    implementation: '{array}.findIndex({predicate})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['number-expression'],
    prerequisites: ['array expression', 'predicate function'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-find-index',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.array-find-index\\ninputs=['array-expression', 'function-expression']\\noutputs=['number-expression']\\nimplementation_template='{array}.findIndex({predicate})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'predicate contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.string-includes',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列に指定した文字列が含まれるか判定する',
    implementation: '{text}.includes({search})',
    targetPath: 'generated.ts',
    inputs: ['string-expression', 'string-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['string expression', 'search string'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-includes',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.string-includes\\ninputs=['string-expression', 'string-expression']\\noutputs=['boolean-expression']\\nimplementation_template='{text}.includes({search})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'string search contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.string-split',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を区切って配列へ分割する',
    implementation: '{text}.split({separator})',
    targetPath: 'generated.ts',
    inputs: ['string-expression', 'string-expression'],
    outputs: ['array-expression'],
    prerequisites: ['string expression', 'separator string'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-split',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.javascript.string-split\\ninputs=['string-expression', 'string-expression']\\noutputs=['array-expression']\\nimplementation_template='{text}.split({separator})'",
    validation: "VALIDATION_SPEC:\\nrequiredValidation=['expression syntax', 'separator contract']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.javascript.let-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'let declarationを構成する',
    implementation: 'let {name} = {value};',
    targetPath: 'generated.ts',
    inputs: ['identifier','expression'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.let-declaration',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.let-declaration\ninputs=['identifier','expression']\noutputs=['statement']\nimplementation_template='let {name} = {value};'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.switch-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'switch statementを構成する',
    implementation: 'switch ({expression}) {\n{cases}\n}',
    targetPath: 'generated.ts',
    inputs: ['expression','statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.switch-statement',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.switch-statement\ninputs=['expression','statement']\noutputs=['statement']\nimplementation_template='switch ({expression}) {\n{cases}\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.for-index',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'index loopを構成する',
    implementation: 'for (let {index} = 0; {index} < {length}; {index}++) {\n{body}\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier','number-expression','statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.for-index',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.for-index\ninputs=['identifier','number-expression','statement']\noutputs=['statement']\nimplementation_template='for (let {index} = 0; {index} < {length}; {index}++) {\n{body}\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.while-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'while loopを構成する',
    implementation: 'while ({condition}) {\n{body}\n}',
    targetPath: 'generated.ts',
    inputs: ['boolean-expression','statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.while-statement',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.while-statement\ninputs=['boolean-expression','statement']\noutputs=['statement']\nimplementation_template='while ({condition}) {\n{body}\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.break-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'break statementを構成する',
    implementation: 'break;',
    targetPath: 'generated.ts',
    inputs: [],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.break-statement',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.break-statement\ninputs=[]\noutputs=['statement']\nimplementation_template='break;'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.continue-statement',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'continue statementを構成する',
    implementation: 'continue;',
    targetPath: 'generated.ts',
    inputs: [],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.continue-statement',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.continue-statement\ninputs=[]\noutputs=['statement']\nimplementation_template='continue;'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.ternary-expression',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'conditional expressionを構成する',
    implementation: '{condition} ? {whenTrue} : {whenFalse}',
    targetPath: 'generated.ts',
    inputs: ['boolean-expression','expression'],
    outputs: ['expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.ternary-expression',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.ternary-expression\ninputs=['boolean-expression','expression']\noutputs=['expression']\nimplementation_template='{condition} ? {whenTrue} : {whenFalse}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.arithmetic',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'arithmetic expressionを構成する',
    implementation: '{left} {operator} {right}',
    targetPath: 'generated.ts',
    inputs: ['expression','arithmetic-operator'],
    outputs: ['expression','number-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.arithmetic',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.arithmetic\ninputs=['expression','arithmetic-operator']\noutputs=['expression','number-expression']\nimplementation_template='{left} {operator} {right}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.typeof',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'typeof expressionを構成する',
    implementation: 'typeof {value}',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.typeof',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.typeof\ninputs=['expression']\noutputs=['string-expression']\nimplementation_template='typeof {value}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.optional-chain-access',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'optional chainingを構成する',
    implementation: '{object}?.{property}',
    targetPath: 'generated.ts',
    inputs: ['expression','identifier'],
    outputs: ['expression','property-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.optional-chain-access',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.optional-chain-access\ninputs=['expression','identifier']\noutputs=['expression','property-expression']\nimplementation_template='{object}?.{property}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.nullish-fallback',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'nullish fallbackを構成する',
    implementation: '{value} ?? {fallback}',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.nullish-fallback',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.nullish-fallback\ninputs=['expression']\noutputs=['expression']\nimplementation_template='{value} ?? {fallback}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.string-trim',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'string trimを構成する',
    implementation: '{text}.trim()',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-trim',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.string-trim\ninputs=['string-expression']\noutputs=['string-expression']\nimplementation_template='{text}.trim()'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.string-replace',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'string replaceを構成する',
    implementation: '{text}.replace({pattern}, {replacement})',
    targetPath: 'generated.ts',
    inputs: ['string-expression','expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-replace',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.string-replace\ninputs=['string-expression','expression']\noutputs=['string-expression']\nimplementation_template='{text}.replace({pattern}, {replacement})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-join',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'array joinを構成する',
    implementation: '{array}.join({separator})',
    targetPath: 'generated.ts',
    inputs: ['array-expression','string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-join',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-join\ninputs=['array-expression','string-expression']\noutputs=['string-expression']\nimplementation_template='{array}.join({separator})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.array-push',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'array pushを構成する',
    implementation: '{array}.push({value})',
    targetPath: 'generated.ts',
    inputs: ['array-expression','expression'],
    outputs: ['number-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-push',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.array-push\ninputs=['array-expression','expression']\noutputs=['number-expression']\nimplementation_template='{array}.push({value})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.object-keys',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'object keysを構成する',
    implementation: 'Object.keys({object})',
    targetPath: 'generated.ts',
    inputs: ['object-expression','expression'],
    outputs: ['array-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-keys',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.object-keys\ninputs=['object-expression','expression']\noutputs=['array-expression']\nimplementation_template='Object.keys({object})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.object-values',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'object valuesを構成する',
    implementation: 'Object.values({object})',
    targetPath: 'generated.ts',
    inputs: ['object-expression','expression'],
    outputs: ['array-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-values',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.object-values\ninputs=['object-expression','expression']\noutputs=['array-expression']\nimplementation_template='Object.values({object})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.javascript.object-entries',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'object entriesを構成する',
    implementation: 'Object.entries({object})',
    targetPath: 'generated.ts',
    inputs: ['object-expression','expression'],
    outputs: ['array-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-entries',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.javascript.object-entries\ninputs=['object-expression','expression']\noutputs=['array-expression']\nimplementation_template='Object.entries({object})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['syntax contract','input/output contract']\ndependencies=[]\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },


  {
    knowledgeId: 'code.javascript.promise-all-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Promise.allを生成する',
    implementation: 'Promise.all([{promises}])',
    targetPath: 'generated.ts',
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['awaitable inputs'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.promise-all-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'PROMISE_ALL_CONTRACT_TEST',
    validation: 'VALIDATE_PROMISE_ALL',
  },
  {
    knowledgeId: 'code.javascript.promise-all-settled-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Promise.allSettledを生成する',
    implementation: 'Promise.allSettled([{promises}])',
    targetPath: 'generated.ts',
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['awaitable inputs'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.promise-all-settled-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'PROMISE_ALL_SETTLED_CONTRACT_TEST',
    validation: 'VALIDATE_PROMISE_ALL_SETTLED',
  },
  {
    knowledgeId: 'code.javascript.array-flat-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Array.flatを生成する',
    implementation: '{array}.flat({depth})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'number-expression'],
    outputs: ['array-expression'],
    prerequisites: ['array input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-flat-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'ARRAY_FLAT_CONTRACT_TEST',
    validation: 'VALIDATE_ARRAY_FLAT',
  },
  {
    knowledgeId: 'code.javascript.array-flat-map-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Array.flatMapを生成する',
    implementation: '{array}.flatMap({callback})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    prerequisites: ['callback'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-flat-map-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'ARRAY_FLAT_MAP_CONTRACT_TEST',
    validation: 'VALIDATE_ARRAY_FLAT_MAP',
  },
  {
    knowledgeId: 'code.javascript.array-slice-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Array.sliceを生成する',
    implementation: '{array}.slice({start}, {end})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'number-expression'],
    outputs: ['array-expression'],
    prerequisites: ['array input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-slice-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'ARRAY_SLICE_CONTRACT_TEST',
    validation: 'VALIDATE_ARRAY_SLICE',
  },
  {
    knowledgeId: 'code.javascript.array-sort-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Array.sortを生成する',
    implementation: '{array}.sort({compare})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    prerequisites: ['array input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-sort-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'ARRAY_SORT_CONTRACT_TEST',
    validation: 'VALIDATE_ARRAY_SORT',
  },
  {
    knowledgeId: 'code.javascript.string-trim-start-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.trimStartを生成する',
    implementation: '{text}.trimStart()',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-trim-start-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_TRIM_START_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_TRIM_START',
  },
  {
    knowledgeId: 'code.javascript.string-trim-end-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.trimEndを生成する',
    implementation: '{text}.trimEnd()',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-trim-end-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_TRIM_END_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_TRIM_END',
  },
  {
    knowledgeId: 'code.javascript.string-replace-all-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.replaceAllを生成する',
    implementation: '{text}.replaceAll({pattern}, {replacement})',
    targetPath: 'generated.ts',
    inputs: ['string-expression', 'expression'],
    outputs: ['string-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-replace-all-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_REPLACE_ALL_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_REPLACE_ALL',
  },
  {
    knowledgeId: 'code.javascript.string-to-lower-case-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.toLowerCaseを生成する',
    implementation: '{text}.toLowerCase()',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-to-lower-case-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_LOWER_CASE_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_LOWER_CASE',
  },
  {
    knowledgeId: 'code.javascript.string-to-upper-case-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.toUpperCaseを生成する',
    implementation: '{text}.toUpperCase()',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['string-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-to-upper-case-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_UPPER_CASE_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_UPPER_CASE',
  },
  {
    knowledgeId: 'code.javascript.string-starts-with-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'String.startsWithを生成する',
    implementation: '{text}.startsWith({search})',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['string input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-starts-with-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'STRING_STARTS_WITH_CONTRACT_TEST',
    validation: 'VALIDATE_STRING_STARTS_WITH',
  },
  {
    knowledgeId: 'code.javascript.object-assign-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Object.assignを生成する',
    implementation: 'Object.assign({target}, {sources})',
    targetPath: 'generated.ts',
    inputs: ['object-expression'],
    outputs: ['object-expression'],
    prerequisites: ['object inputs'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-assign-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'OBJECT_ASSIGN_CONTRACT_TEST',
    validation: 'VALIDATE_OBJECT_ASSIGN',
  },
  {
    knowledgeId: 'code.javascript.object-has-own-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Object.hasOwnを生成する',
    implementation: 'Object.hasOwn({object}, {property})',
    targetPath: 'generated.ts',
    inputs: ['object-expression', 'string-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['object input'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.object-has-own-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'OBJECT_HAS_OWN_CONTRACT_TEST',
    validation: 'VALIDATE_OBJECT_HAS_OWN',
  },

  {
    knowledgeId: 'code.javascript.string-ends-with',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列が指定文字列で終わるか判定する',
    implementation: '{text}.endsWith({search})',
    targetPath: 'generated.ts',
    inputs: ['string-expression'],
    outputs: ['boolean-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-ends-with',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.string-repeat',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列を指定回数繰り返す',
    implementation: '{text}.repeat({count})',
    targetPath: 'generated.ts',
    inputs: ['string-expression', 'number-expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-repeat',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.string-substring',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列の指定範囲を取り出す',
    implementation: '{text}.substring({start}, {end})',
    targetPath: 'generated.ts',
    inputs: ['string-expression', 'number-expression'],
    outputs: ['string-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.string-substring',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.array-pop',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列末尾の要素を取り出す',
    implementation: '{array}.pop()',
    targetPath: 'generated.ts',
    inputs: ['array-expression'],
    outputs: ['expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-pop',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.array-shift',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列先頭の要素を取り出す',
    implementation: '{array}.shift()',
    targetPath: 'generated.ts',
    inputs: ['array-expression'],
    outputs: ['expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-shift',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.array-unshift',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '配列先頭へ要素を追加する',
    implementation: '{array}.unshift({value})',
    targetPath: 'generated.ts',
    inputs: ['array-expression', 'expression'],
    outputs: ['number-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.array-unshift',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.promise-race',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Promiseのうち最初にsettleした結果を利用する',
    implementation: 'Promise.race([{promises}])',
    targetPath: 'generated.ts',
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.promise-race',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.javascript.promise-any',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数Promiseのうち最初に成功した結果を利用する',
    implementation: 'Promise.any([{promises}])',
    targetPath: 'generated.ts',
    inputs: ['promise-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.javascript.promise-any',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  }
,
{
  knowledgeId: "code.javascript.parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript関数のparameterを構成する",
  implementation: "{name}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.parameter",
},

{
  knowledgeId: "code.javascript.default-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "既定値付きparameterを構成する",
  implementation: "{name} = {value}",
  targetPath: "generated.ts",
  inputs: ["identifier", "expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.default-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.default-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.default-parameter",
},

{
  knowledgeId: "code.javascript.rest-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "可変長parameterを構成する",
  implementation: "...{name}",
  targetPath: "generated.ts",
  inputs: ["identifier"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.rest-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.rest-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.rest-parameter",
},

{
  knowledgeId: "code.javascript.object-spread",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Objectをspreadして複製・統合する",
  implementation: "{ ...{inputObject} }",
  targetPath: "generated.ts",
  inputs: ["object-expression"],
  outputs: ["object-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.object-spread",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.object-spread",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.object-spread",
},

{
  knowledgeId: "code.javascript.array-spread",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Arrayをspreadして統合する",
  implementation: "[...{inputArray}]",
  targetPath: "generated.ts",
  inputs: ["array-expression"],
  outputs: ["array-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.array-spread",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.array-spread",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-spread",
},

{
  knowledgeId: "code.javascript.strict-equality",
  componentType: "CODE_CONSTRUCTION",
  purpose: "厳密等価比較を構成する",
  implementation: "{left} === {right}",
  targetPath: "generated.ts",
  inputs: ["expression", "expression"],
  outputs: ["boolean-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.strict-equality",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.strict-equality",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.strict-equality",
},

{
  knowledgeId: "code.javascript.logical-not",
  componentType: "CODE_CONSTRUCTION",
  purpose: "論理否定を構成する",
  implementation: "!{condition}",
  targetPath: "generated.ts",
  inputs: ["boolean-expression"],
  outputs: ["boolean-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.logical-not",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.logical-not",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.logical-not",
},

{
  knowledgeId: "code.javascript.modulo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "剰余演算を構成する",
  implementation: "{left} % {right}",
  targetPath: "generated.ts",
  inputs: ["number-expression", "number-expression"],
  outputs: ["number-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.modulo",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.modulo",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.modulo",
},

{
  knowledgeId: "code.javascript.increment",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値を1増加させる",
  implementation: "{value}++",
  targetPath: "generated.ts",
  inputs: ["identifier"],
  outputs: ["number-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.increment",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.increment",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.increment",
},

{
  knowledgeId: "code.javascript.decrement",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値を1減少させる",
  implementation: "{value}--",
  targetPath: "generated.ts",
  inputs: ["identifier"],
  outputs: ["number-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.decrement",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.decrement",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.decrement",
},

{
  knowledgeId: "code.javascript.new-expression",
  componentType: "CODE_CONSTRUCTION",
  purpose: "constructorから新しいインスタンスを生成する",
  implementation: "new {name}({arguments})",
  targetPath: "generated.ts",
  inputs: ["identifier", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.new-expression",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.new-expression",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.new-expression",
},

{
  knowledgeId: "code.javascript.map-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapを生成する",
  implementation: "new Map()",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.map-constructor",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.map-constructor",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.map-constructor",
},

{
  knowledgeId: "code.javascript.map-set",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapへ値を登録する",
  implementation: "{map}.set({key}, {value})",
  targetPath: "generated.ts",
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.map-set",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.map-set",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.map-set",
},

{
  knowledgeId: "code.javascript.map-get",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Mapから値を取得する",
  implementation: "{map}.get({key})",
  targetPath: "generated.ts",
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.map-get",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.map-get",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.map-get",
},

{
  knowledgeId: "code.javascript.set-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setを生成する",
  implementation: "new Set({values})",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.set-constructor",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.set-constructor",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.set-constructor",
},

{
  knowledgeId: "code.javascript.set-add",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setへ値を追加する",
  implementation: "{set}.add({value})",
  targetPath: "generated.ts",
  inputs: ["expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.set-add",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.set-add",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.set-add",
},

{
  knowledgeId: "code.javascript.set-has",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Setに値が存在するか判定する",
  implementation: "{set}.has({value})",
  targetPath: "generated.ts",
  inputs: ["expression", "expression"],
  outputs: ["boolean-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.set-has",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.set-has",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.set-has",
},

{
  knowledgeId: "code.javascript.promise-then",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise成功結果を連鎖処理する",
  implementation: "{promise}.then({handler})",
  targetPath: "generated.ts",
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.promise-then",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.promise-then",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-then",
},

{
  knowledgeId: "code.javascript.promise-catch",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise失敗結果を処理する",
  implementation: "{promise}.catch({handler})",
  targetPath: "generated.ts",
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.promise-catch",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.promise-catch",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-catch",
},

{
  knowledgeId: "code.javascript.promise-finally",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Promise完了時処理を構成する",
  implementation: "{promise}.finally({handler})",
  targetPath: "generated.ts",
  inputs: ["promise-expression", "function-expression"],
  outputs: ["promise-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.promise-finally",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.promise-finally",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-finally",
},

{
  knowledgeId: "code.javascript.set-timeout",
  componentType: "CODE_CONSTRUCTION",
  purpose: "遅延実行を構成する",
  implementation: "setTimeout({handler}, {delay})",
  targetPath: "generated.ts",
  inputs: ["function-expression", "number-expression"],
  outputs: ["timer-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.set-timeout",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.set-timeout",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.set-timeout",
},

{
  knowledgeId: "code.javascript.clear-timeout",
  componentType: "CODE_CONSTRUCTION",
  purpose: "タイマーを解除する",
  implementation: "clearTimeout({timer})",
  targetPath: "generated.ts",
  inputs: ["timer-expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.clear-timeout",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.clear-timeout",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.clear-timeout",
},

{
  knowledgeId: "code.javascript.date-now",
  componentType: "CODE_CONSTRUCTION",
  purpose: "現在時刻を取得する",
  implementation: "Date.now()",
  targetPath: "generated.ts",
  inputs: [],
  outputs: ["number-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.date-now",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.date-now",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.date-now",
},

{
  knowledgeId: "code.javascript.regexp-test",
  componentType: "CODE_CONSTRUCTION",
  purpose: "正規表現で文字列を判定する",
  implementation: "{pattern}.test({text})",
  targetPath: "generated.ts",
  inputs: ["string-expression", "regexp-expression"],
  outputs: ["boolean-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.regexp-test",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.regexp-test",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.regexp-test",
},

{
  knowledgeId: "code.javascript.console-log",
  componentType: "CODE_CONSTRUCTION",
  purpose: "ログを出力する",
  implementation: "console.log({value})",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.console-log",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.console-log",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.console-log",
},

{
  knowledgeId: "code.javascript.console-error",
  componentType: "CODE_CONSTRUCTION",
  purpose: "エラーログを出力する",
  implementation: "console.error({error})",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.console-error",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.console-error",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.console-error",
},

{
  knowledgeId: "code.javascript.error-constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Errorインスタンスを生成する",
  implementation: "new Error({message})",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.error-constructor",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.error-constructor",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.error-constructor",
},

{
  knowledgeId: "code.javascript.import-named",
  componentType: "CODE_CONSTRUCTION",
  purpose: "名前付きexportをimportする",
  implementation: "import { {name} } from {module}",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.import-named",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.import-named",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.import-named",
},

{
  knowledgeId: "code.javascript.import-default",
  componentType: "CODE_CONSTRUCTION",
  purpose: "default exportをimportする",
  implementation: "import {name} from {module}",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.import-default",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.import-default",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.import-default",
},

{
  knowledgeId: "code.javascript.export-named",
  componentType: "CODE_CONSTRUCTION",
  purpose: "名前付きexportを構成する",
  implementation: "export {value}",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.export-named",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.export-named",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.export-named",
},

{
  knowledgeId: "code.javascript.export-default",
  componentType: "CODE_CONSTRUCTION",
  purpose: "default exportを構成する",
  implementation: "export default {value}",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.export-default",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.export-default",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.export-default",
},

{
  knowledgeId: "code.javascript.class-declaration",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript classを構成する",
  implementation: "class {name} {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.class-declaration",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.class-declaration",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.class-declaration",
},

{
  knowledgeId: "code.javascript.class-method",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JavaScript class methodを構成する",
  implementation: "{name}({parameters}) {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "parameter", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.javascript.class-method",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.class-method",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.class-method",
},

{
  knowledgeId: "code.javascript.node-write-file",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.jsでファイルを非同期書き込みする",
  implementation: "writeFile({path}, {content}, 'utf8')",
  targetPath: "generated.ts",
  inputs: ["string-expression", "string-expression"],
  outputs: ["promise-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["node:fs/promises"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.javascript.node-write-file",
  securityClass: "STANDARD",
  exports: [],
  imports: ["node:fs/promises"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.node-write-file",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.node-write-file",
},

{
  knowledgeId: "code.javascript.node-mkdir",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.jsでディレクトリを作成する",
  implementation: "mkdir({path}, {options})",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["promise-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["node:fs/promises"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.javascript.node-mkdir",
  securityClass: "STANDARD",
  exports: [],
  imports: ["node:fs/promises"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.node-mkdir",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.node-mkdir",
},

{
  knowledgeId: "code.javascript.node-path-join",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.js pathを安全に結合する",
  implementation: "join({parts})",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["string-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["node:path"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.javascript.node-path-join",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["node:path"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.node-path-join",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.node-path-join",
},

{
  knowledgeId: "code.javascript.node-env-access",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Node.js process.envから環境値を取得する",
  implementation: "process.env[{name}]",
  targetPath: "generated.ts",
  inputs: ["string-expression"],
  outputs: ["string-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.javascript.node-env-access",
  securityClass: "STANDARD",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.javascript.node-env-access",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.javascript.node-env-access",
},

{
  "knowledgeId": "code.javascript.if-else-statement",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "if/else条件分岐を構成する",
  "implementation": "if ({condition}) {\\n{thenBody}\\n} else {\\n{elseBody}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "boolean-expression",
    "statement",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.if-else-statement",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.if-else-statement",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.if-else-statement"
},

{
  "knowledgeId": "code.javascript.for-statement",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "初期化・条件・更新を持つfor反復を構成する",
  "implementation": "for ({initializer}; {condition}; {update}) {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "statement",
    "boolean-expression",
    "expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.for-statement",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.for-statement",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.for-statement"
},

{
  "knowledgeId": "code.javascript.try-catch-finally",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "catchとfinallyを含む例外処理を構成する",
  "implementation": "try {\\n{tryBody}\\n} catch ({error}) {\\n{catchBody}\\n} finally {\\n{finallyBody}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "statement",
    "identifier",
    "statement",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.try-catch-finally",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.try-catch-finally",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.try-catch-finally"
},

{
  "knowledgeId": "code.javascript.ternary",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "条件によって2つの式から値を選択する",
  "implementation": "({condition}) ? ({whenTrue}) : ({whenFalse})",
  "targetPath": "generated.ts",
  "inputs": [
    "boolean-expression",
    "expression",
    "expression"
  ],
  "outputs": [
    "expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.ternary",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.ternary",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.ternary"
},

{
  "knowledgeId": "code.javascript.optional-chaining",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "存在する場合だけpropertyを参照する",
  "implementation": "{object}?.{property}",
  "targetPath": "generated.ts",
  "inputs": [
    "object-expression",
    "identifier"
  ],
  "outputs": [
    "expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.optional-chaining",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.optional-chaining",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.optional-chaining"
},

{
  "knowledgeId": "code.javascript.nullish-coalescing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "nullまたはundefinedの場合に代替値を使う",
  "implementation": "({value}) ?? ({fallback})",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.nullish-coalescing",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.nullish-coalescing",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.nullish-coalescing"
},

{
  "knowledgeId": "code.javascript.object-destructuring",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Objectから複数propertyをdestructureする",
  "implementation": "const { {properties} } = {object};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "object-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.object-destructuring",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.object-destructuring",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.object-destructuring"
},

{
  "knowledgeId": "code.javascript.array-destructuring",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Arrayから値をdestructureする",
  "implementation": "const [{items}] = {array};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "array-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.array-destructuring",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.array-destructuring",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-destructuring"
},

{
  "knowledgeId": "code.javascript.array-flat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ネストしたArrayを指定深度まで平坦化する",
  "implementation": "{array}.flat({depth})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression",
    "number-expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.array-flat",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.array-flat",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-flat"
},

{
  "knowledgeId": "code.javascript.array-flat-map",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "mapしてから配列を平坦化する",
  "implementation": "{array}.flatMap({mapper})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression",
    "function-expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.array-flat-map",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.array-flat-map",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-flat-map"
},

{
  "knowledgeId": "code.javascript.string-replace-all",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列中の一致箇所をすべて置換する",
  "implementation": "{text}.replaceAll({search}, {replacement})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.string-replace-all",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.string-replace-all",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.string-replace-all"
},

{
  "knowledgeId": "code.javascript.promise-all",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Promiseをすべて待機する",
  "implementation": "Promise.all({promises})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.promise-all",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.promise-all",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-all"
},

{
  "knowledgeId": "code.javascript.promise-all-settled",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Promiseの成功失敗結果をすべて待機する",
  "implementation": "Promise.allSettled({promises})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.promise-all-settled",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.promise-all-settled",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-all-settled"
},

{
  "knowledgeId": "code.javascript.async-function",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "async functionを構成する",
  "implementation": "async function {name}({parameters}) {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "parameter",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.async-function",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.async-function",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.async-function"
},

{
  "knowledgeId": "code.javascript.object-assign",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Objectを結合してtargetへ代入する",
  "implementation": "Object.assign({target}, {sources})",
  "targetPath": "generated.ts",
  "inputs": [
    "object-expression",
    "object-expression"
  ],
  "outputs": [
    "object-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.javascript.object-assign",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.object-assign",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.object-assign"
},
{
  "knowledgeId": "code.javascript.promise-resolve",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promiseを成功状態へ変換する",
  "implementation": "Promise.resolve({value})",
  "targetPath": "generated.ts",
  "inputs": [
    "expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.promise-resolve",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.promise-resolve",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-resolve"
},
{
  "knowledgeId": "code.javascript.promise-reject",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promiseを失敗状態へ変換する",
  "implementation": "Promise.reject({error})",
  "targetPath": "generated.ts",
  "inputs": [
    "expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.promise-reject",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.promise-reject",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.promise-reject"
},
{
  "knowledgeId": "code.javascript.abort-controller",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "非同期処理のキャンセル制御を構成する",
  "implementation": "const {name} = new AbortController();",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.abort-controller",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.abort-controller",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.abort-controller"
},
{
  "knowledgeId": "code.javascript.throw-error",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Error objectを生成して送出する",
  "implementation": "throw new Error({message});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.throw-error",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.throw-error",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.throw-error"
},
{
  "knowledgeId": "code.javascript.logical-assignment-or",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "OR論理代入を構成する",
  "implementation": "{target} ||= {value};",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.logical-assignment-or",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.logical-assignment-or",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.logical-assignment-or"
},
{
  "knowledgeId": "code.javascript.logical-assignment-and",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "AND論理代入を構成する",
  "implementation": "{target} &&= {value};",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.logical-assignment-and",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.logical-assignment-and",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.logical-assignment-and"
},
{
  "knowledgeId": "code.javascript.logical-assignment-nullish",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Nullish論理代入を構成する",
  "implementation": "{target} ??= {value};",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.logical-assignment-nullish",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.logical-assignment-nullish",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.logical-assignment-nullish"
},
{
  "knowledgeId": "code.javascript.array-concat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数Arrayを結合する",
  "implementation": "{array}.concat({items})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression",
    "expression"
  ],
  "outputs": [
    "array-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.array-concat",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.array-concat",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-concat"
},
{
  "knowledgeId": "code.javascript.string-slice",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列の一部を抽出する",
  "implementation": "{text}.slice({start}, {end})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "number-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.string-slice",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.string-slice",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.string-slice"
},
{
  "knowledgeId": "code.javascript.string-to-lower-case",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列を小文字化する",
  "implementation": "{text}.toLowerCase()",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.string-to-lower-case",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.string-to-lower-case",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.string-to-lower-case"
},
{
  "knowledgeId": "code.javascript.string-to-upper-case",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "文字列を大文字化する",
  "implementation": "{text}.toUpperCase()",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.string-to-upper-case",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.string-to-upper-case",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.string-to-upper-case"
},
{
  "knowledgeId": "code.javascript.object-from-entries",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "entry配列からObjectを構成する",
  "implementation": "Object.fromEntries({entries})",
  "targetPath": "generated.ts",
  "inputs": [
    "array-expression"
  ],
  "outputs": [
    "object-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.object-from-entries",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.object-from-entries",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.object-from-entries"
},
{
  "knowledgeId": "code.javascript.dynamic-import",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "動的Module importを構成する",
  "implementation": "import({module})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.javascript.dynamic-import",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.javascript.dynamic-import",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.dynamic-import"
},
{
  "knowledgeId": "code.node.fs-read-file",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルを非同期で読み込む",
  "implementation": "fs.readFile({path}, {encoding})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-read-file",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-read-file",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-read-file"
},
{
  "knowledgeId": "code.node.fs-write-file",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルへ非同期で書き込む",
  "implementation": "fs.writeFile({path}, {data}, {encoding})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-write-file",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-write-file",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-write-file"
},
{
  "knowledgeId": "code.node.fs-readdir",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ディレクトリ内容を取得する",
  "implementation": "fs.readdir({path})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-readdir",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-readdir",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-readdir"
},
{
  "knowledgeId": "code.node.fs-stat",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイル状態を取得する",
  "implementation": "fs.stat({path})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-stat",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-stat",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-stat"
},
{
  "knowledgeId": "code.node.fs-mkdir",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ディレクトリを作成する",
  "implementation": "fs.mkdir({path}, {options})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "object-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-mkdir",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-mkdir",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-mkdir"
},
{
  "knowledgeId": "code.node.fs-rename",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルまたはディレクトリを移動する",
  "implementation": "fs.rename({from}, {to})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-rename",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-rename",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-rename"
},
{
  "knowledgeId": "code.node.fs-rm",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイルまたはディレクトリを削除する",
  "implementation": "fs.rm({path}, {options})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "object-expression"
  ],
  "outputs": [
    "promise-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:fs/promises"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.fs-rm",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:fs/promises"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.fs-rm",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.fs-rm"
},
{
  "knowledgeId": "code.node.path-join",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "パスを安全に結合する",
  "implementation": "path.join({parts})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:path"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.path-join",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:path"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.path-join",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.path-join"
},
{
  "knowledgeId": "code.node.path-resolve",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "絶対パスを解決する",
  "implementation": "path.resolve({parts})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:path"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.path-resolve",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:path"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.path-resolve",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.path-resolve"
},
{
  "knowledgeId": "code.node.path-dirname",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "親ディレクトリを取得する",
  "implementation": "path.dirname({path})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:path"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.path-dirname",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:path"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.path-dirname",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.path-dirname"
},
{
  "knowledgeId": "code.node.path-basename",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ファイル名部分を取得する",
  "implementation": "path.basename({path})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:path"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.path-basename",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:path"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.path-basename",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.path-basename"
},
{
  "knowledgeId": "code.node.path-extname",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "拡張子を取得する",
  "implementation": "path.extname({path})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "node:path"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.path-extname",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "node:path"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.path-extname",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.path-extname"
},
{
  "knowledgeId": "code.node.process-env",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "環境変数を取得する",
  "implementation": "process.env[{name}]",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.node.process-env",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.node.process-env",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.process-env"
}

  {
    id: 'code.javascript.destructuring',
    componentType: 'CODE_CONCEPT',
    purpose: '配列やオブジェクトを分解して値を取り出す',
    summary: 'destructuring assignmentによる構造分解。',
    concepts: ['destructuring', 'array-pattern', 'object-pattern'],
    inputs: ['source-expression'],
    outputs: ['bindings'],
    appliesWhen: ['配列やオブジェクトから複数の値を取り出す'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring'],
    sourceArtifactIds: ['mdn-javascript-destructuring'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'const {pattern} = {source};',
      outputKinds: ['statement'],
      slots: [
        {name: 'pattern', inputKinds: ['identifier', 'pattern'], required: true},
        {name: 'source', inputKinds: ['expression'], required: true},
      ],
      constraints: ['pattern must be valid destructuring syntax'],
      adaptationRules: ['use an array pattern for iterable values and an object pattern for object properties'],
    },
  },
  {
    id: 'code.javascript.spread-syntax',
    componentType: 'CODE_CONCEPT',
    purpose: '配列やオブジェクトを展開して合成する',
    summary: 'spread syntaxによる値の展開。',
    concepts: ['spread', 'array', 'object'],
    inputs: ['source-expression'],
    outputs: ['expression'],
    appliesWhen: ['配列やオブジェクトを展開して新しい値を構成する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax'],
    sourceArtifactIds: ['mdn-javascript-spread'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{container}[{spread}{source}]',
      outputKinds: ['expression'],
      slots: [
        {name: 'container', inputKinds: ['identifier'], required: false},
        {name: 'spread', inputKinds: ['token'], required: true},
        {name: 'source', inputKinds: ['expression'], required: true},
      ],
      constraints: ['source must be spread-compatible'],
      adaptationRules: ['use object spread in object literals and array spread in array literals'],
    },
  },
  {
    id: 'code.javascript.array-map',
    componentType: 'CODE_CONCEPT',
    purpose: '配列の各要素を変換する',
    summary: 'Array.prototype.mapによる配列変換。',
    concepts: ['Array.map', 'array', 'callback'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['配列を別の配列へ変換する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map'],
    sourceArtifactIds: ['mdn-array-map'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.map({callback})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression', 'expression'], required: true},
        {name: 'callback', inputKinds: ['function-expression'], required: true},
      ],
      constraints: ['callback must return the mapped value'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.javascript.array-filter',
    componentType: 'CODE_CONCEPT',
    purpose: '条件に一致する配列要素だけを残す',
    summary: 'Array.prototype.filterによる配列選別。',
    concepts: ['Array.filter', 'predicate', 'array'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['array-expression'],
    appliesWhen: ['配列から条件に合う要素を抽出する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter'],
    sourceArtifactIds: ['mdn-array-filter'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.filter({predicate})',
      outputKinds: ['array-expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression', 'expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: ['predicate must produce a boolean-compatible result'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.javascript.array-reduce',
    componentType: 'CODE_CONCEPT',
    purpose: '配列を累積して単一の結果へ変換する',
    summary: 'Array.prototype.reduceによる累積処理。',
    concepts: ['Array.reduce', 'accumulator', 'callback'],
    inputs: ['array-expression', 'function-expression', 'expression'],
    outputs: ['expression'],
    appliesWhen: ['配列を累積して1つの結果へ変換する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce'],
    sourceArtifactIds: ['mdn-array-reduce'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.reduce({callback}, {initialValue})',
      outputKinds: ['expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression', 'expression'], required: true},
        {name: 'callback', inputKinds: ['function-expression'], required: true},
        {name: 'initialValue', inputKinds: ['expression'], required: false},
      ],
      constraints: ['callback must implement accumulator semantics'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.javascript.array-find',
    componentType: 'CODE_CONCEPT',
    purpose: '条件に一致する最初の配列要素を取得する',
    summary: 'Array.prototype.findによる検索。',
    concepts: ['Array.find', 'predicate', 'array'],
    inputs: ['array-expression', 'function-expression'],
    outputs: ['expression'],
    appliesWhen: ['配列から条件に一致する最初の要素を探す'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find'],
    sourceArtifactIds: ['mdn-array-find'],
    constructionProfile: {
      kind: 'CALL',
      syntaxTemplate: '{array}.find({predicate})',
      outputKinds: ['expression'],
      slots: [
        {name: 'array', inputKinds: ['array-expression', 'expression'], required: true},
        {name: 'predicate', inputKinds: ['function-expression'], required: true},
      ],
      constraints: ['result may be undefined when no element matches'],
      adaptationRules: [],
    },
  },
  {
    "knowledgeId": "code.javascript.array-flat-map",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "配列を一括変換して平坦化する",
    "implementation": "{array}.flatMap({callback})",
    "targetPath": "generated.ts",
    "inputs": [
      "array-expression",
      "function-expression"
    ],
    "outputs": [
      "array-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.javascript.array-flat-map",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.javascript.array-flat-map",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.array-flat-map"
  },
  {
    "knowledgeId": "code.javascript.logical-assignment",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "条件付き再代入を構成する",
    "implementation": "{target} ??= {value};",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
      "expression"
    ],
    "outputs": [
      "statement"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.javascript.logical-assignment",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.javascript.logical-assignment",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.logical-assignment"
  },
  {
    "knowledgeId": "code.javascript.error-cause",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Errorへ原因情報を保持する",
    "implementation": "new Error({message}, { cause: {cause} })",
    "targetPath": "generated.ts",
    "inputs": [
      "string-expression",
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.javascript.error-cause",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.javascript.error-cause",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.javascript.error-cause"
  }

];

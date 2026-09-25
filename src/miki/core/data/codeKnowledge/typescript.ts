import type { CodeKnowledgeDefinition, CodeComponentDefinition } from './common';

export const typescriptCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.typescript.everyday-types',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'TypeScriptの基本型を使ってJavaScriptコードの契約を明示する',
    summary: 'string、number、boolean、array、objectなどの型を宣言し、静的型チェックに利用する。',
    concepts: ['string', 'number', 'boolean', 'array', 'object', 'union'],
    inputs: ['JavaScript-compatible value'],
    outputs: ['statically checked value'],
    appliesWhen: ['TypeScriptコードを設計・生成する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds: ['typescript-handbook-everyday-types'],
  },
  {
    id: 'code.typescript.interfaces',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'interfaceでオブジェクトの契約を表現する',
    summary: 'オブジェクトの形状を名前付き契約として定義し、入力・出力の整合性を明確にする。',
    concepts: ['interface', 'property', 'optional-property', 'readonly'],
    inputs: ['object contract'],
    outputs: ['named type contract'],
    appliesWhen: ['サービス境界', 'DTO', 'Component契約'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-handbook-object-types'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'interface {name} {\\n{members}\\n}',
      outputKinds: ['type-declaration'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'members', inputKinds: ['property-signature'], required: true, multiple: true},
      ],
      constraints: [
        'members must form a valid object contract'
      ],
      adaptationRules: [
        'use type alias when unions/intersections are the primary abstraction'
      ],
    },
  },
  {
    id: 'code.typescript.unions-and-narrowing',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'Union型を実行時条件で安全に絞り込む',
    summary: 'typeof、in、instanceof、ユーザー定義type predicateなどで型をnarrowingする。',
    concepts: ['union', 'typeof', 'in', 'instanceof', 'type predicate', 'narrowing'],
    inputs: ['union typed value'],
    outputs: ['narrowed type'],
    appliesWhen: ['複数の入力型を受け取る', '安全な分岐が必要'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/narrowing.html'],
    sourceArtifactIds: ['typescript-handbook-narrowing'],
  },
  {
    id: 'code.typescript.generics',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'Genericで型安全な再利用可能処理を作る',
    summary: '型パラメータを使い、異なる型に同じ処理構造を安全に適用する。',
    concepts: ['generic', 'type parameter', 'generic function', 'generic interface'],
    inputs: ['typed value'],
    outputs: ['type-preserving result'],
    appliesWhen: ['汎用サービス', '再利用可能な型安全処理'],
    doesNotApplyWhen: ['具体型だけで十分な処理'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/generics.html'],
    sourceArtifactIds: ['typescript-handbook-generics'],
  },
  {
    id: 'code.typescript.modules',
    componentType: 'LANGUAGE_CONCEPT',
    purpose: 'TypeScriptのモジュール境界と依存関係を設計する',
    summary: 'ES Modulesを基礎としてimport/exportを構成し、依存方向を明示する。',
    concepts: ['module', 'import', 'export', 'dependency', 'ESM'],
    inputs: ['module graph'],
    outputs: ['typed module graph'],
    appliesWhen: ['TypeScriptプロジェクトの構造化'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds: ['typescript-handbook-modules'],
  },
  {
    id: 'code.typescript.javascript-reuse',
    componentType: 'LANGUAGE_RELATION',
    purpose: 'JavaScript共通知識をTypeScriptでも再利用する',
    summary: 'TypeScriptはJavaScriptの構文・実行モデルを基礎に型システムを追加するため、共通知識を別Componentとして再利用する。',
    concepts: ['JavaScript', 'TypeScript', 'shared knowledge', 'type layer'],
    inputs: ['JavaScript concept'],
    outputs: ['TypeScript-compatible concept'],
    appliesWhen: ['JSからTSへ変換する', '既存JS知識をTSコード生成へ流用する'],
    doesNotApplyWhen: ['TypeScript固有型機能だけを扱う場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/intro.html'],
    sourceArtifactIds: ['typescript-handbook-introduction'],
  },

  {
    id: 'code.typescript.type-alias-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '名前付きTypeScript型を定義する',
    summary: 'type aliasでプリミティブ、オブジェクト、union、intersectionなどを名前付き型として定義する。',
    concepts: ['type', 'alias', 'named-type'],
    inputs: ['identifier', 'type-expression'],
    outputs: ['type-declaration'],
    appliesWhen: ['再利用する型を定義する', 'union型を名前付けする'],
    doesNotApplyWhen: ['interfaceが明確なオブジェクト契約'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds: ['typescript-type-alias-component'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'type {name} = {type};',
      outputKinds: ['type-declaration'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['type expression must be valid TypeScript'],
      adaptationRules: ['use interface for extendable object contracts'],
    },
  },
  {
    id: 'code.typescript.union-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数候補のいずれかを表すUnion型を定義する',
    summary: 'A | B形式で値が複数型のいずれかであることを表現する。',
    concepts: ['union', '|', 'type'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['入力や状態に複数の型候補がある'],
    doesNotApplyWhen: ['すべての型を同時に要求する場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds: ['typescript-union-component'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '{left} | {right}',
      outputKinds: ['type-expression'],
      slots: [
        {name: 'left', inputKinds: ['type-expression'], required: true},
        {name: 'right', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['both sides must be valid types'],
      adaptationRules: ['use intersection when both contracts must be satisfied'],
    },
  },
  {
    id: 'code.typescript.intersection-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複数の型契約を合成する',
    summary: 'A & B形式で複数の型要件を同時に満たす型を作る。',
    concepts: ['intersection', '&', 'composition'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['複数の型契約を合成する'],
    doesNotApplyWhen: ['排他的な型候補を表す場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-intersection-component'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '{left} & {right}',
      outputKinds: ['type-expression'],
      slots: [
        {name: 'left', inputKinds: ['type-expression'], required: true},
        {name: 'right', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['both sides must be valid types'],
      adaptationRules: ['use union when alternatives are intended'],
    },
  },
  {
    id: 'code.typescript.generic-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '型パラメータを持つ再利用可能な関数を生成する',
    summary: 'Generic type parameterを関数に付与し、入力型と出力型の関係を保持する。',
    concepts: ['generic', 'type-parameter', 'function'],
    inputs: ['identifier', 'type-parameter', 'parameter', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['型安全な汎用関数'],
    doesNotApplyWhen: ['具体型だけで十分な関数'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/generics.html'],
    sourceArtifactIds: ['typescript-generic-function'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'function {name}<{typeParameter}>({parameters}) {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'typeParameter', inputKinds: ['type-parameter'], required: true},
        {name: 'parameters', inputKinds: ['parameter'], required: true, multiple: true},
        {name: 'body', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: ['type parameters must be valid identifiers'],
      adaptationRules: ['add constraints when generic operations require specific capabilities'],
    },
  },
  {
    id: 'code.typescript.optional-property',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '存在しない可能性があるプロパティを型で表現する',
    summary: 'property?: Type形式でoptional propertyを定義する。',
    concepts: ['optional-property', '?', 'interface'],
    inputs: ['identifier', 'type-expression'],
    outputs: ['property-signature'],
    appliesWhen: ['設定値や入力値が省略可能'],
    doesNotApplyWhen: ['必須入力'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-optional-property'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '{name}?: {type};',
      outputKinds: ['property-signature'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['property name must be valid'],
      adaptationRules: ['use required property when absence is invalid'],
    },
  },
  {
    id: 'code.typescript.readonly-property',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '型上で再代入不可のプロパティを定義する',
    summary: 'readonly propertyで意図しない再代入を型レベルで防ぐ。',
    concepts: ['readonly', 'property', 'immutability'],
    inputs: ['identifier', 'type-expression'],
    outputs: ['property-signature'],
    appliesWhen: ['公開契約で再代入を許可しない'],
    doesNotApplyWhen: ['更新可能なプロパティ'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-readonly-property'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'readonly {name}: {type};',
      outputKinds: ['property-signature'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['readonly applies to property declarations'],
      adaptationRules: ['omit readonly when mutation is part of the contract'],
    },
  },
  {
    id: 'code.typescript.import-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '別モジュールの値や型をimportする',
    summary: 'ES Module importを生成してファイル間依存を明示する。',
    concepts: ['import', 'module', 'dependency'],
    inputs: ['identifier', 'module-specifier'],
    outputs: ['module-statement'],
    appliesWhen: ['別ファイルのComponentや型を利用する'],
    doesNotApplyWhen: ['同一ファイル内だけで完結する'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds: ['typescript-import-declaration'],
    constructionProfile: {
      kind: 'MODULE',
      syntaxTemplate: 'import { {name} } from {module};',
      outputKinds: ['module-statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true, multiple: true},
        {name: 'module', inputKinds: ['module-specifier'], required: true},
      ],
      constraints: ['module specifier must be valid'],
      adaptationRules: ['use type-only import when only types are consumed'],
    },
  },
  {
    id: 'code.typescript.export-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'モジュールから値や型を公開する',
    summary: 'export declarationでファイルの公開境界を構成する。',
    concepts: ['export', 'module', 'public-api'],
    inputs: ['identifier'],
    outputs: ['module-statement'],
    appliesWhen: ['他ファイルから利用するAPIを公開する'],
    doesNotApplyWhen: ['内部専用の宣言'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds: ['typescript-export-declaration'],
    constructionProfile: {
      kind: 'MODULE',
      syntaxTemplate: 'export { {name} };',
      outputKinds: ['module-statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true, multiple: true},
      ],
      constraints: ['exported identifiers must exist in module scope'],
      adaptationRules: ['use export default only when a module has a clear single primary export'],
    },
  },
  {
    id: 'code.typescript.async-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Promiseを返す非同期TypeScript関数を生成する',
    summary: 'async functionと型付きPromise戻り値を組み合わせる。',
    concepts: ['async', 'Promise', 'return-type'],
    inputs: ['identifier', 'parameter', 'type-expression', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['非同期処理を関数境界にする'],
    doesNotApplyWhen: ['同期処理'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/functions.html'],
    sourceArtifactIds: ['typescript-async-function'],
    constructionProfile: {
      kind: 'ASYNC',
      syntaxTemplate: 'async function {name}({parameters}): Promise<{type}> {\\n{body}\\n}',
      outputKinds: ['statement', 'async-function'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
        {name: 'body', inputKinds: ['statement'], required: true, multiple: true},
      ],
      constraints: ['async function returns Promise'],
      adaptationRules: ['use synchronous function when no asynchronous operation exists'],
    },
  },
  {
    id: 'code.typescript.type-guard-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'unknown値を安全に型判定するtype guardを生成する',
    summary: 'value is Type形式のpredicateを持つ関数を構成する。',
    concepts: ['type-guard', 'unknown', 'is', 'narrowing'],
    inputs: ['identifier', 'type-expression', 'boolean-expression'],
    outputs: ['statement'],
    appliesWhen: ['外部入力やunknown値を検証する'],
    doesNotApplyWhen: ['入力型が既に確定している'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/narrowing.html'],
    sourceArtifactIds: ['typescript-type-guard-component'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'function {name}(value: unknown): value is {type} {\\nreturn {check};\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
        {name: 'check', inputKinds: ['boolean-expression'], required: true},
      ],
      constraints: ['runtime check must support the claimed predicate'],
      adaptationRules: ['compose primitive checks for object contracts'],
    },
  }
];

export const additionalTypescriptCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.typescript.utility-types',
    componentType: 'TYPE_SYSTEM_CONCEPT',
    purpose: '既存型から用途別の型を派生させる',
    summary: 'Partial、Required、Pick、Omit、RecordなどのUtility Typeで型定義の重複を減らす。',
    concepts: ['Partial', 'Required', 'Pick', 'Omit', 'Record'],
    inputs: ['existing type'],
    outputs: ['derived type'],
    appliesWhen: ['DTO', '設定', '部分更新', '型変換'],
    doesNotApplyWhen: ['派生型より独立した契約の方が明確な場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/utility-types.html'],
    sourceArtifactIds: ['typescript-handbook-utility-types'],
  },
  {
    id: 'code.typescript.type-alias',
    componentType: 'TYPE_SYSTEM_CONCEPT',
    purpose: '複雑な型を名前付き型として再利用する',
    summary: 'type aliasでUnion、Intersection、オブジェクト型などを名前付きの契約として定義する。',
    concepts: ['type alias', 'union', 'intersection', 'named type'],
    inputs: ['type expression'],
    outputs: ['named type'],
    appliesWhen: ['複雑な型', '再利用する型契約'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds: ['typescript-handbook-type-aliases'],
  },
  {
    id: 'code.typescript.intersection',
    componentType: 'TYPE_SYSTEM_CONCEPT',
    purpose: '複数の型契約を同時に満たす型を表現する',
    summary: 'Intersection typeで複数の型を組み合わせ、Component間の複合契約を表現する。',
    concepts: ['intersection', '&', 'composition'],
    inputs: ['multiple types'],
    outputs: ['composed type'],
    appliesWhen: ['複数契約の合成', 'Component metadata'],
    doesNotApplyWhen: ['排他的な選択肢を表す場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-handbook-intersections'],
  },
  {
    id: 'code.typescript.type-guards',
    componentType: 'TYPE_SYSTEM_CONCEPT',
    purpose: '実行時条件からTypeScript型を安全に判定する',
    summary: 'ユーザー定義type predicateなどで実行時チェックと静的型推論を接続する。',
    concepts: ['type guard', 'type predicate', 'is', 'runtime validation'],
    inputs: ['unknown value'],
    outputs: ['narrowed value'],
    appliesWhen: ['外部入力', 'unknown', '型判定'],
    doesNotApplyWhen: ['型がコンパイル時点で確定している場合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/narrowing.html'],
    sourceArtifactIds: ['typescript-handbook-type-guards'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: 'function {name}(value: unknown): value is {type} {\\n{returnExpression}\\n}',
      outputKinds: ['statement'],
      slots: [
        {name: 'name', inputKinds: ['identifier'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
        {name: 'returnExpression', inputKinds: ['boolean-expression'], required: true},
      ],
      constraints: [
        'the predicate must correspond to the runtime check'
      ],
      adaptationRules: [
        'use typeof/in/instanceof according to the runtime value shape'
      ],
    },
  },
  {
    id: 'code.typescript.strictness',
    componentType: 'TYPE_SYSTEM_CONCEPT',
    purpose: 'TypeScriptの型チェックを厳格にして潜在的な不整合を早期検出する',
    summary: 'strict系コンパイラ設定を利用して暗黙のanyやnull関連などの型問題を早期に検出する。',
    concepts: ['strict', 'strictNullChecks', 'noImplicitAny', 'static analysis'],
    inputs: ['TypeScript project'],
    outputs: ['stricter compile-time contract'],
    appliesWhen: ['新規TypeScriptプロジェクト', '品質改善'],
    doesNotApplyWhen: ['既存コードとの段階的移行が必要な場合は設定を段階導入する'],
    sourceUrls: ['https://www.typescriptlang.org/tsconfig/strict.html'],
    sourceArtifactIds: ['typescript-tsconfig-strict'],
  },

  {
        id: 'code.typescript.interface',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'TypeScriptのオブジェクト契約をinterfaceで定義する',
        summary: 'interfaceによる構造型契約。',
        concepts: ['interface', 'type', 'property', 'contract'],
        inputs: ['identifier', 'property-signature'],
        outputs: ['type-declaration'],
        appliesWhen: ['オブジェクト構造の公開契約を定義する'],
        doesNotApplyWhen: ['単純なunion/type aliasが適切'],
        sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types'],
        sourceArtifactIds: ['typescript-interface'],
        constructionProfile: {
          kind: 'TYPE',
          syntaxTemplate: 'interface {name} {\\n{members}\\n}',
          outputKinds: ['type-declaration'],
          slots: [
            { name: 'name', inputKinds: ['identifier'], required: true },
            { name: 'members', inputKinds: ['property-signature'], required: true, multiple: true },
          ],
          constraints: ['member signatures must be valid TypeScript'],
          adaptationRules: ['use type alias for unions and mapped-type-heavy contracts'],
        },
      },

  {
    id: 'code.typescript.enum',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '名前付きの有限な値集合を定義する',
    summary: 'TypeScript enumによる列挙型。',
    concepts: ['enum', 'enumeration', 'named-values'],
    inputs: ['identifier', 'enum-member'],
    outputs: ['type-declaration'],
    appliesWhen: ['名前付き定数集合'],
    doesNotApplyWhen: ['自由な文字列集合'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/enums.html'],
    sourceArtifactIds: ['typescript-enum'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'enum {name} {\\n{members}\\n}',
      outputKinds: ['type-declaration'],
      slots: [{name: 'name', inputKinds: ['identifier'], required: true}, {name: 'members', inputKinds: ['enum-member'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.tuple',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '固定位置ごとに型を持つTuple型を定義する',
    summary: 'TypeScript tupleによる固定構造。',
    concepts: ['tuple', 'array', 'type'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['位置ごとに型が決まる配列'],
    doesNotApplyWhen: ['可変長の同一型配列'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds: ['typescript-tuple'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '[{members}]',
      outputKinds: ['type-expression'],
      slots: [{name: 'members', inputKinds: ['type-expression'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.class',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '状態と振る舞いを持つclassを定義する',
    summary: 'TypeScript classによる構造化。',
    concepts: ['class', 'constructor', 'method'],
    inputs: ['identifier', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['状態と振る舞いをまとめる'],
    doesNotApplyWhen: ['単純な関数だけで十分'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/classes.html'],
    sourceArtifactIds: ['typescript-class'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'class {name} {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [{name: 'name', inputKinds: ['identifier'], required: true}, {name: 'body', inputKinds: ['statement'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.extends',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存classを継承するclassを定義する',
    summary: 'extendsによるclass継承。',
    concepts: ['extends', 'inheritance', 'class'],
    inputs: ['identifier', 'identifier', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['既存classを拡張'],
    doesNotApplyWhen: ['interface契約だけを実装'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/classes.html'],
    sourceArtifactIds: ['typescript-extends'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'class {name} extends {base} {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [{name: 'name', inputKinds: ['identifier'], required: true}, {name: 'base', inputKinds: ['identifier'], required: true}, {name: 'body', inputKinds: ['statement'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.implements',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'classへinterface契約を適用する',
    summary: 'implementsによる契約実装。',
    concepts: ['implements', 'interface', 'class'],
    inputs: ['identifier', 'identifier', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['interface契約をclassで実装'],
    doesNotApplyWhen: ['class継承'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/classes.html'],
    sourceArtifactIds: ['typescript-implements'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'class {name} implements {contract} {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [{name: 'name', inputKinds: ['identifier'], required: true}, {name: 'contract', inputKinds: ['identifier'], required: true}, {name: 'body', inputKinds: ['statement'], required: true, multiple: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.function-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数の入力と出力の型契約を定義する',
    summary: 'TypeScript function type。',
    concepts: ['function type', 'callback', 'type'],
    inputs: ['parameter', 'type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['callbackや関数値の型を定義'],
    doesNotApplyWhen: ['実装本体を生成'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/functions.html'],
    sourceArtifactIds: ['typescript-function-type'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '({parameters}) => {returnType}',
      outputKinds: ['type-expression'],
      slots: [{name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true}, {name: 'returnType', inputKinds: ['type-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.type-assertion',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '式を特定のTypeScript型として扱う',
    summary: 'as構文による型アサーション。',
    concepts: ['as', 'type assertion', 'type'],
    inputs: ['expression', 'type-expression'],
    outputs: ['expression'],
    appliesWhen: ['型情報を明示する必要がある'],
    doesNotApplyWhen: ['実行時の型変換が必要'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds: ['typescript-type-assertion'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{value} as {type}',
      outputKinds: ['expression'],
      slots: [{name: 'value', inputKinds: ['expression'], required: true}, {name: 'type', inputKinds: ['type-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.record-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'キーと値の型からObject型を定義する',
    summary: 'Record utility type。',
    concepts: ['Record', 'mapped type', 'object'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['キー型と値型が決まったObject'],
    doesNotApplyWhen: ['固定プロパティ構造だけで十分'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/utility-types.html'],
    sourceArtifactIds: ['typescript-record-type'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'Record<{keyType}, {valueType}>',
      outputKinds: ['type-expression'],
      slots: [{name: 'keyType', inputKinds: ['type-expression'], required: true}, {name: 'valueType', inputKinds: ['type-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.partial-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存Object型のプロパティをoptional化する',
    summary: 'Partial utility type。',
    concepts: ['Partial', 'utility type', 'optional'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['既存型を部分更新用にする'],
    doesNotApplyWhen: ['全プロパティ必須'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/utility-types.html'],
    sourceArtifactIds: ['typescript-partial-type'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'Partial<{type}>',
      outputKinds: ['type-expression'],
      slots: [{name: 'type', inputKinds: ['type-expression'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.pick-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存型から必要なプロパティだけを抽出する',
    summary: 'Pick utility type。',
    concepts: ['Pick', 'utility type', 'projection'],
    inputs: ['type-expression', 'property-key'],
    outputs: ['type-expression'],
    appliesWhen: ['型の一部だけ公開'],
    doesNotApplyWhen: ['プロパティを除外する'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/utility-types.html'],
    sourceArtifactIds: ['typescript-pick-type'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'Pick<{type}, {keys}>',
      outputKinds: ['type-expression'],
      slots: [{name: 'type', inputKinds: ['type-expression'], required: true}, {name: 'keys', inputKinds: ['property-key'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  },
  {
    id: 'code.typescript.omit-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存型から指定プロパティを除外する',
    summary: 'Omit utility type。',
    concepts: ['Omit', 'utility type', 'projection'],
    inputs: ['type-expression', 'property-key'],
    outputs: ['type-expression'],
    appliesWhen: ['型から特定項目を除外'],
    doesNotApplyWhen: ['必要項目だけ抽出'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/utility-types.html'],
    sourceArtifactIds: ['typescript-omit-type'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: 'Omit<{type}, {keys}>',
      outputKinds: ['type-expression'],
      slots: [{name: 'type', inputKinds: ['type-expression'], required: true}, {name: 'keys', inputKinds: ['property-key'], required: true}],
      constraints: ['inputs must satisfy the construction contract'],
      adaptationRules: ['prefer the simplest compatible construction'],
    },
  }
,
{
  id: "code.typescript.typed-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きparameterを構成する",
  summary: "関数引数にTypeScript型を付与する。",
  concepts: ["parameter", "type", "function"],
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  appliesWhen: ["型安全な関数", "callback"],
  doesNotApplyWhen: ["any依存"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-typed-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}: {type}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.optional-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "省略可能なtyped parameterを構成する",
  summary: "parameter?による任意引数。",
  concepts: ["optional parameter", "TypeScript"],
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  appliesWhen: ["optional option"],
  doesNotApplyWhen: ["必須入力"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-optional-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}?: {type}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.rest-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きrest parameterを構成する",
  summary: "可変長引数を型付き配列として受け取る。",
  concepts: ["rest parameter", "array"],
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  appliesWhen: ["可変長引数"],
  doesNotApplyWhen: ["固定引数のみ"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-rest-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "...{name}: {type}[]", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.default-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きdefault parameterを構成する",
  summary: "型注釈付き既定値引数。",
  concepts: ["default parameter", "TypeScript"],
  inputs: ["identifier", "type-expression", "expression"],
  outputs: ["parameter"],
  appliesWhen: ["既定値", "設定"],
  doesNotApplyWhen: ["明示必須入力"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-default-parameter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}: {type} = {value}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.property-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "interface/type内のproperty signatureを構成する",
  summary: "Object契約のプロパティ型定義。",
  concepts: ["property signature", "interface", "type"],
  inputs: ["identifier", "type-expression"],
  outputs: ["property-signature"],
  appliesWhen: ["型契約", "DTO"],
  doesNotApplyWhen: ["実行時property"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/objects.html"],
  sourceArtifactIds: ["typescript-property-signature"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "{name}: {type};", outputKinds: ["property-signature"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.method-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "interface内のmethod signatureを構成する",
  summary: "型契約としてのmethod宣言。",
  concepts: ["method signature", "interface"],
  inputs: ["identifier", "parameter", "type-expression"],
  outputs: ["method-signature"],
  appliesWhen: ["service contract", "interface"],
  doesNotApplyWhen: ["実装本体"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/objects.html"],
  sourceArtifactIds: ["typescript-method-signature"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "{name}({parameters}): {returnType};", outputKinds: ["method-signature"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameters", inputKinds: ["parameter"], required: false, multiple: true }, { name: "returnType", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "class constructorを構成する",
  summary: "classの初期化処理を定義する。",
  concepts: ["constructor", "class", "initialization"],
  inputs: ["parameter", "statement"],
  outputs: ["statement"],
  appliesWhen: ["状態初期化"],
  doesNotApplyWhen: ["constructor不要なclass"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-constructor"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "constructor({parameters}) {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "parameters", inputKinds: ["parameter"], required: false, multiple: true }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.class-property",
  componentType: "CODE_CONSTRUCTION",
  purpose: "class propertyを構成する",
  summary: "class内部の状態propertyに型を付与する。",
  concepts: ["class property", "field", "type"],
  inputs: ["identifier", "type-expression"],
  outputs: ["statement"],
  appliesWhen: ["状態保持"],
  doesNotApplyWhen: ["関数だけの設計"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-class-property"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}: {type};", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.class-method",
  componentType: "CODE_CONSTRUCTION",
  purpose: "typed class methodを構成する",
  summary: "class内部のmethodにparameterと戻り値型を付与する。",
  concepts: ["class method", "method", "type"],
  inputs: ["identifier", "parameter", "type-expression", "statement"],
  outputs: ["statement"],
  appliesWhen: ["class behavior"],
  doesNotApplyWhen: ["独立関数"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-class-method"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "{name}({parameters}): {returnType} {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameters", inputKinds: ["parameter"], required: false, multiple: true }, { name: "returnType", inputKinds: ["type-expression"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.generic-interface",
  componentType: "CODE_CONSTRUCTION",
  purpose: "generic interfaceを構成する",
  summary: "型パラメータを持つinterface契約。",
  concepts: ["generic", "interface", "type parameter"],
  inputs: ["identifier", "type-parameter", "property-signature"],
  outputs: ["type-declaration"],
  appliesWhen: ["再利用可能な型契約"],
  doesNotApplyWhen: ["固定型契約"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/generics.html"],
  sourceArtifactIds: ["typescript-generic-interface"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "interface {name}<{parameter}> {\\n{members}\\n}", outputKinds: ["type-declaration"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameter", inputKinds: ["type-parameter"], required: true, multiple: false }, { name: "members", inputKinds: ["property-signature"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.generic-type-alias",
  componentType: "CODE_CONSTRUCTION",
  purpose: "generic type aliasを構成する",
  summary: "型パラメータ付きtype alias。",
  concepts: ["generic", "type alias", "type parameter"],
  inputs: ["identifier", "type-parameter", "type-expression"],
  outputs: ["type-declaration"],
  appliesWhen: ["汎用データ型"],
  doesNotApplyWhen: ["具体型だけで十分"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/generics.html"],
  sourceArtifactIds: ["typescript-generic-type-alias"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "type {name}<{parameter}> = {type};", outputKinds: ["type-declaration"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameter", inputKinds: ["type-parameter"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.keyof-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "keyofによるkey union型を構成する",
  summary: "Object型のキー集合を型として取得する。",
  concepts: ["keyof", "type", "keys"],
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  appliesWhen: ["property key typing"],
  doesNotApplyWhen: ["値取得"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/keyof-types.html"],
  sourceArtifactIds: ["typescript-keyof"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "keyof {type}", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.typeof-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "typeofによる型レベル参照を構成する",
  summary: "既存valueから対応するTypeScript型を取得する。",
  concepts: ["typeof", "type query"],
  inputs: ["identifier"],
  outputs: ["type-expression"],
  appliesWhen: ["value-derived type"],
  doesNotApplyWhen: ["runtime typeof判定"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/typeof-types.html"],
  sourceArtifactIds: ["typescript-typeof-type"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "typeof {value}", outputKinds: ["type-expression"], slots: [{ name: "value", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.as-const",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値をliteral readonly型として固定する",
  summary: "as constによるliteral narrowing。",
  concepts: ["as const", "literal", "readonly"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["configuration", "constant object"],
  doesNotApplyWhen: ["変更可能状態"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/everyday-types.html"],
  sourceArtifactIds: ["typescript-as-const"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{value} as const", outputKinds: ["expression"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.satisfies",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値が型契約を満たすことを検証する",
  summary: "satisfies operatorで型を確認しつつ推論情報を保持する。",
  concepts: ["satisfies", "type contract"],
  inputs: ["expression", "type-expression"],
  outputs: ["expression"],
  appliesWhen: ["configuration validation", "typed objects"],
  doesNotApplyWhen: ["runtime validation代替"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/objects.html"],
  sourceArtifactIds: ["typescript-satisfies"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{value} satisfies {type}", outputKinds: ["expression"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.readonly-array",
  componentType: "CODE_CONSTRUCTION",
  purpose: "readonly array型を構成する",
  summary: "変更不可Array型。",
  concepts: ["readonly", "array", "type"],
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  appliesWhen: ["immutable input"],
  doesNotApplyWhen: ["mutationが必要"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/objects.html"],
  sourceArtifactIds: ["typescript-readonly-array"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "readonly {type}[]", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.index-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "index signatureを構成する",
  summary: "動的property keyを持つObject契約。",
  concepts: ["index signature", "object", "dictionary"],
  inputs: ["identifier", "type-expression"],
  outputs: ["property-signature"],
  appliesWhen: ["dictionary", "record-like data"],
  doesNotApplyWhen: ["固定propertyのみ"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/objects.html"],
  sourceArtifactIds: ["typescript-index-signature"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "[{name}: string]: {type};", outputKinds: ["property-signature"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.required-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Partial型などのoptional propertyをrequired化する",
  summary: "Required utility type。",
  concepts: ["Required", "utility type"],
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  appliesWhen: ["完全な設定値"],
  doesNotApplyWhen: ["partial update object"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/utility-types.html"],
  sourceArtifactIds: ["typescript-required-type"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "Required<{type}>", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.readonly-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Object型のpropertyをreadonly化する",
  summary: "Readonly utility type。",
  concepts: ["Readonly", "utility type"],
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  appliesWhen: ["immutable contract"],
  doesNotApplyWhen: ["mutable DTO"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/utility-types.html"],
  sourceArtifactIds: ["typescript-readonly-type"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "Readonly<{type}>", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.nonnullable-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "nullとundefinedを除外する型を構成する",
  summary: "NonNullable utility type。",
  concepts: ["NonNullable", "utility type"],
  inputs: ["null", "undefined"],
  outputs: ["type-expression"],
  appliesWhen: ["validated value"],
  doesNotApplyWhen: ["nullish valueを許可"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/utility-types.html"],
  sourceArtifactIds: ["typescript-nonnullable-type"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "NonNullable<{type}>", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.abstract-class",
  componentType: "CODE_CONSTRUCTION",
  purpose: "abstract classを構成する",
  summary: "抽象classの共通実装境界。",
  concepts: ["abstract class", "inheritance", "contract"],
  inputs: ["identifier", "statement"],
  outputs: ["statement"],
  appliesWhen: ["共通基底処理"],
  doesNotApplyWhen: ["単一具体class"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-abstract-class"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "abstract class {name} {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.getter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "getter methodを構成する",
  summary: "class propertyを計算値として公開する。",
  concepts: ["getter", "accessor", "class"],
  inputs: ["identifier", "type-expression", "statement"],
  outputs: ["statement"],
  appliesWhen: ["computed property"],
  doesNotApplyWhen: ["単純field"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-getter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "get {name}(): {type} {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.setter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "setter methodを構成する",
  summary: "class propertyへの代入境界を定義する。",
  concepts: ["setter", "accessor", "class"],
  inputs: ["identifier", "parameter", "statement"],
  outputs: ["statement"],
  appliesWhen: ["validated assignment"],
  doesNotApplyWhen: ["直接field更新"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-setter"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "set {name}({parameter}) {\\n{body}\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameter", inputKinds: ["parameter"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.overload",
  componentType: "CODE_CONSTRUCTION",
  purpose: "関数overload signatureを構成する",
  summary: "複数の呼び出し形式を一つのimplementationへ束ねる。",
  concepts: ["overload", "function", "signature"],
  inputs: ["identifier", "parameter", "type-expression"],
  outputs: ["statement"],
  appliesWhen: ["API overload"],
  doesNotApplyWhen: ["単一signature"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-overload"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "function {name}({parameters}): {returnType};", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "parameters", inputKinds: ["parameter"], required: false, multiple: true }, { name: "returnType", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.parameter-property",
  componentType: "CODE_CONSTRUCTION",
  purpose: "constructor parameter propertyを構成する",
  summary: "constructor引数からclass fieldを自動定義する。",
  concepts: ["parameter property", "constructor", "private", "readonly"],
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  appliesWhen: ["class state initialization"],
  doesNotApplyWhen: ["通常parameter"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/classes.html"],
  sourceArtifactIds: ["typescript-parameter-property"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "private readonly {name}: {type}", outputKinds: ["parameter"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.typescript.return-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "明示的な関数return typeを構成する",
  summary: "関数の戻り値型契約。",
  concepts: ["return type", "function"],
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  appliesWhen: ["API contract", "type safety"],
  doesNotApplyWhen: ["型推論で十分"],
  sourceUrls: ["https://www.typescriptlang.org/docs/handbook/2/functions.html"],
  sourceArtifactIds: ["typescript-return-type"],
  constructionProfile: { kind: "TYPE", syntaxTemplate: "{type}", outputKinds: ["type-expression"], slots: [{ name: "type", inputKinds: ["type-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  "id": "code.typescript.union-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数候補を表すUnion Typeを構成する",
  "summary": "複数候補を表すUnion Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "union",
    "type",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "複数候補を表すUnion Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.union-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name} = {left} | {right};",
    "outputKinds": [
      "type-expression"
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
        "name": "left",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "right",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.intersection-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数型を同時に満たすIntersection Typeを構成する",
  "summary": "複数型を同時に満たすIntersection Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "intersection",
    "type",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "複数型を同時に満たすIntersection Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.intersection-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name} = {left} & {right};",
    "outputKinds": [
      "type-expression"
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
        "name": "left",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "right",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.generic-interface-constraint",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic Interfaceに型制約を付ける",
  "summary": "Generic Interfaceに型制約を付ける。既存Construction Graphで再利用する。",
  "concepts": [
    "generic",
    "interface",
    "constraint",
    "identifier",
    "type-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "type-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Generic Interfaceに型制約を付ける"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.generic-interface-constraint"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "interface {name}<T extends {constraint}> {\\n{body}\\n}",
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
        "name": "constraint",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
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
  "id": "code.typescript.typeof-type-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "既存valueの型をType位置で取得する",
  "summary": "既存valueの型をType位置で取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "typeof",
    "type",
    "query",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "既存valueの型をType位置で取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.typeof-type-query"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name} = typeof {value};",
    "outputKinds": [
      "type-expression"
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
        "name": "value",
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.typescript.keyof-type-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Typeのproperty key Unionを取得する",
  "summary": "Typeのproperty key Unionを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "keyof",
    "type",
    "query",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Typeのproperty key Unionを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.keyof-type-query"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name}<T> = keyof T;",
    "outputKinds": [
      "type-expression"
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.typescript.union-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "UnionをtypeofでNarrowingする",
  "summary": "UnionをtypeofでNarrowingする。既存Construction Graphで再利用する。",
  "concepts": [
    "union",
    "narrowing",
    "identifier",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "string-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "UnionをtypeofでNarrowingする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.union-narrowing"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "if (typeof {value} === '{typeName}') {\\n{body}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "value",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "typeName",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
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
  "id": "code.typescript.instanceof-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "instanceofによる型Narrowingを構成する",
  "summary": "instanceofによる型Narrowingを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "instanceof",
    "narrowing",
    "expression",
    "identifier",
    "statement"
  ],
  "inputs": [
    "expression",
    "identifier",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "instanceofによる型Narrowingを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.instanceof-narrowing"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "if ({value} instanceof {constructor}) {\\n{body}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "constructor",
        "inputKinds": [
          "identifier"
        ],
        "required": true
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
  "id": "code.typescript.as-type-assertion",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "値を指定型として扱うType Assertionを構成する",
  "summary": "値を指定型として扱うType Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "as",
    "type",
    "assertion",
    "expression",
    "type-expression"
  ],
  "inputs": [
    "expression",
    "type-expression"
  ],
  "outputs": [
    "expression"
  ],
  "appliesWhen": [
    "値を指定型として扱うType Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.as-type-assertion"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "{value} as {type}",
    "outputKinds": [
      "expression"
    ],
    "slots": [
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "type",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.const-type-parameter",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic parameterをconstとして推論する",
  "summary": "Generic parameterをconstとして推論する。既存Construction Graphで再利用する。",
  "concepts": [
    "const",
    "type",
    "parameter",
    "identifier",
    "statement"
  ],
  "inputs": [
    "identifier",
    "parameter"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Generic parameterをconstとして推論する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.const-type-parameter"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "function {name}<const T>({parameter}: T): T {\\n  return {parameter};\\n}",
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
        "name": "parameter",
        "inputKinds": [
          "parameter"
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
  "id": "code.typescript.this-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "現在のObject型をThisTypeで表現する",
  "summary": "現在のObject型をThisTypeで表現する。既存Construction Graphで再利用する。",
  "concepts": [
    "this",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "現在のObject型をThisTypeで表現する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.this-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "ThisType<{type}>",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "type",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.declare-const",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "外部runtime値の型宣言を構成する",
  "summary": "外部runtime値の型宣言を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "declare",
    "const",
    "identifier",
    "type-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "type-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "外部runtime値の型宣言を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.declare-const"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "declare const {name}: {type};",
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
        "name": "type",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.namespace-import",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Module全体をnamespaceとしてimportする",
  "summary": "Module全体をnamespaceとしてimportする。既存Construction Graphで再利用する。",
  "concepts": [
    "namespace",
    "import",
    "identifier",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Module全体をnamespaceとしてimportする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.namespace-import"
  ],
  "constructionProfile": {
    "kind": "MODULE",
    "syntaxTemplate": "import * as {name} from {module};",
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.typescript.namespace-export",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "namespace全体をexportする",
  "summary": "namespace全体をexportする。既存Construction Graphで再利用する。",
  "concepts": [
    "namespace",
    "export",
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
    "namespace全体をexportする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.namespace-export"
  ],
  "constructionProfile": {
    "kind": "MODULE",
    "syntaxTemplate": "export * from {module};",
    "outputKinds": [
      "statement"
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},
{
  "id": "code.typescript.interface-extends",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "既存interfaceを拡張する",
  "summary": "既存interfaceを拡張する。既存Construction Graphで再利用する。",
  "concepts": [
    "interface",
    "extends",
    "identifier",
    "statement"
  ],
  "inputs": [
    "identifier",
    "identifier",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "既存interfaceを拡張する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.interface-extends"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "interface {name} extends {base} {\\n{body}\\n}",
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
        "name": "base",
        "inputKinds": [
          "identifier"
        ],
        "required": true,
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.class-implements",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "classのimplements契約を構成する",
  "summary": "classのimplements契約を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "class",
    "implements",
    "identifier",
    "statement"
  ],
  "inputs": [
    "identifier",
    "identifier",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "classのimplements契約を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.class-implements"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "class {name} implements {contracts} {\\n{body}\\n}",
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
        "name": "contracts",
        "inputKinds": [
          "identifier"
        ],
        "required": true,
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.generic-class",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic classを構成する",
  "summary": "Generic classを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "generic",
    "class",
    "identifier",
    "statement"
  ],
  "inputs": [
    "identifier",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Generic classを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.generic-class"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "class {name}<T> {\\n{body}\\n}",
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.generic-method",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic methodを構成する",
  "summary": "Generic methodを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "generic",
    "method",
    "identifier",
    "parameter",
    "type-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "parameter",
    "type-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Generic methodを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.generic-method"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "{name}<T>({parameters}): {returnType} {\\n{body}\\n}",
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
        "name": "returnType",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.discriminated-union",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "判別可能Unionを構成する",
  "summary": "判別可能Unionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "discriminated",
    "union",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "判別可能Unionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.discriminated-union"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name} = {members};",
    "outputKinds": [
      "type-expression"
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
        "name": "members",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.in-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "in演算子による型Narrowingを構成する",
  "summary": "in演算子による型Narrowingを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "in",
    "narrowing",
    "string-expression",
    "expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "in演算子による型Narrowingを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.in-narrowing"
  ],
  "constructionProfile": {
    "kind": "STATEMENT",
    "syntaxTemplate": "if ({property} in {value}) {\\n{body}\\n}",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "property",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "value",
        "inputKinds": [
          "expression"
        ],
        "required": true
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.type-predicate",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "user-defined type predicateを構成する",
  "summary": "user-defined type predicateを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "type",
    "predicate",
    "identifier",
    "type-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "identifier",
    "type-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "user-defined type predicateを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.type-predicate"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "function {name}({value}: unknown): value is {type} {\\n{body}\\n}",
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
        "name": "value",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "type",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.conditional-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Conditional Typeを構成する",
  "summary": "Conditional Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "conditional",
    "type",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Conditional Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.conditional-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name}<T> = T extends {condition} ? {whenTrue} : {whenFalse};",
    "outputKinds": [
      "type-expression"
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
        "name": "condition",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "whenTrue",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "whenFalse",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.mapped-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Mapped Typeを構成する",
  "summary": "Mapped Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "mapped",
    "type",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Mapped Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.mapped-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name}<T> = { [K in keyof T]: T[K] };",
    "outputKinds": [
      "type-expression"
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
  "id": "code.typescript.template-literal-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Template Literal Typeを構成する",
  "summary": "Template Literal Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "template",
    "literal",
    "type",
    "identifier",
    "type-expression"
  ],
  "inputs": [
    "identifier",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Template Literal Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.template-literal-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "type {name} = `{prefix}${{value}}`;",
    "outputKinds": [
      "type-expression"
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
        "name": "value",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.infer-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Conditional Type内のinferを構成する",
  "summary": "Conditional Type内のinferを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "infer",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Conditional Type内のinferを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.infer-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "T extends {pattern}<infer U> ? U : never",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "pattern",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.indexed-access-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Indexed Access Typeを構成する",
  "summary": "Indexed Access Typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "indexed",
    "access",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Indexed Access Typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.indexed-access-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "{type}[{key}]",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "type",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "key",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.awaited-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Awaited utility typeを構成する",
  "summary": "Awaited utility typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "awaited",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Awaited utility typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.awaited-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "Awaited<{type}>",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "type",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.parameters-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Parameters utility typeを構成する",
  "summary": "Parameters utility typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "parameters",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Parameters utility typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.parameters-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "Parameters<{functionType}>",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "functionType",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.exclude-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Exclude utility typeを構成する",
  "summary": "Exclude utility typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "exclude",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Exclude utility typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.exclude-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "Exclude<{union}, {excluded}>",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "union",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "excluded",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.extract-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Extract utility typeを構成する",
  "summary": "Extract utility typeを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "extract",
    "type",
    "type-expression"
  ],
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "Extract utility typeを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.extract-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "Extract<{union}, {target}>",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [
      {
        "name": "union",
        "inputKinds": [
          "type-expression"
        ],
        "required": true
      },
      {
        "name": "target",
        "inputKinds": [
          "type-expression"
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
  "id": "code.typescript.unknown-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "unknown型を構成する",
  "summary": "unknown型を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "unknown",
    "type",
    "type-expression"
  ],
  "inputs": [],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "unknown型を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.unknown-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "unknown",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.never-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "never型を構成する",
  "summary": "never型を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "never",
    "type",
    "type-expression"
  ],
  "inputs": [],
  "outputs": [
    "type-expression"
  ],
  "appliesWhen": [
    "never型を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.never-type"
  ],
  "constructionProfile": {
    "kind": "TYPE",
    "syntaxTemplate": "never",
    "outputKinds": [
      "type-expression"
    ],
    "slots": [],
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.typescript.import-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "type-only importを構成する",
  "summary": "type-only importを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "import",
    "type",
    "identifier",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "type-only importを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://www.typescriptlang.org/docs/handbook/"
  ],
  "sourceArtifactIds": [
    "ts:code.typescript.import-type"
  ],
  "constructionProfile": {
    "kind": "MODULE",
    "syntaxTemplate": "import type { {names} } from {module};",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "names",
        "inputKinds": [
          "identifier"
        ],
        "required": true,
        "multiple": true
      },
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
    id: 'code.typescript.generic-function-constraint',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Generic関数へ型制約を付ける',
    summary: '型パラメータへextends制約を付与する。',
    concepts: ['TypeScript', 'generic', 'constraint', 'extends'],
    inputs: ['identifier', 'type-parameter', 'type-expression', 'parameter', 'statement'],
    outputs: ['statement'],
    appliesWhen: ['Generic関数に型条件が必要'],
    doesNotApplyWhen: ['型制約が不要'],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints'],
    sourceArtifactIds: ['typescript-generic-constraints'],
    constructionProfile: {
      kind: 'DECLARATION',
      syntaxTemplate: 'function {name}<{typeParameter} extends {constraint}>({parameters}) {\\n{body}\\n}',
      outputKinds: ['statement'],
      slots: [
        { name: 'name', inputKinds: ['identifier'], required: true },
        { name: 'typeParameter', inputKinds: ['type-parameter'], required: true },
        { name: 'constraint', inputKinds: ['type-expression'], required: true },
        { name: 'parameters', inputKinds: ['parameter'], required: false, multiple: true },
        { name: 'body', inputKinds: ['statement'], required: true, multiple: true },
      ],
      constraints: ['type parameter must satisfy constraint'],
      adaptationRules: ['add constraint only when implementation requires it'],
    },
  },
];

export const additionalTypescriptCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: 'code.typescript.interface',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'TypeScriptのオブジェクト契約をinterfaceで定義する',
    implementation: 'interface {name} {\\n{members}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'property-signature'],
    outputs: ['type-declaration'],
    prerequisites: ['valid TypeScript member signatures'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.interface',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.typescript.interface\ninputs=['identifier', 'property-signature']\noutputs=['type-declaration']\nprerequisites=['valid TypeScript member signatures']\nimplementation_template='interface {name} {\\\\n{members}\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['TypeScript syntax', 'property contract']\ndependencies=['TypeScript']\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.typescript.type-alias-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '名前付きTypeScript型を生成する',
    implementation: 'type {name} = {type};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'type-expression'],
    outputs: ['type-declaration'],
    prerequisites: ['valid TypeScript type'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.type-alias-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'TYPE_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_TYPE_ALIAS',
  },
  {
    knowledgeId: 'code.typescript.union-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Union型を生成する',
    implementation: '{left} | {right}',
    targetPath: 'generated.ts',
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['valid TypeScript types'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.union-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'TYPE_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_UNION',
  },
  {
    knowledgeId: 'code.typescript.intersection-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Intersection型を生成する',
    implementation: '{left} & {right}',
    targetPath: 'generated.ts',
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['valid TypeScript types'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.intersection-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'TYPE_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_INTERSECTION',
  },
  {
    knowledgeId: 'code.typescript.generic-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Generic関数を生成する',
    implementation: 'function {name}<{typeParameter}>({parameters}) {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'type-parameter', 'parameter', 'statement'],
    outputs: ['statement'],
    prerequisites: ['valid generic contract'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.generic-function',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'GENERIC_FUNCTION_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_GENERIC',
  },
  {
    knowledgeId: 'code.typescript.optional-property',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Optional propertyを生成する',
    implementation: '{name}?: {type};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'type-expression'],
    outputs: ['property-signature'],
    prerequisites: ['valid property type'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.optional-property',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'OPTIONAL_PROPERTY_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_OPTIONAL_PROPERTY',
  },
  {
    knowledgeId: 'code.typescript.readonly-property',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'readonly propertyを生成する',
    implementation: 'readonly {name}: {type};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'type-expression'],
    outputs: ['property-signature'],
    prerequisites: ['valid property type'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.readonly-property',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'READONLY_PROPERTY_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_READONLY_PROPERTY',
  },
  {
    knowledgeId: 'code.typescript.import-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'ES Module importを生成する',
    implementation: 'import { {name} } from {module};',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'module-specifier'],
    outputs: ['module-statement'],
    prerequisites: ['valid module specifier'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.import-declaration',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'MODULE_IMPORT_CONTRACT_TEST',
    validation: 'VALIDATE_MODULE_IMPORT',
  },
  {
    knowledgeId: 'code.typescript.export-declaration',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'ES Module exportを生成する',
    implementation: 'export { {name} };',
    targetPath: 'generated.ts',
    inputs: ['identifier'],
    outputs: ['module-statement'],
    prerequisites: ['exported identifier exists'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.export-declaration',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'MODULE_EXPORT_CONTRACT_TEST',
    validation: 'VALIDATE_MODULE_EXPORT',
  },
  {
    knowledgeId: 'code.typescript.async-function',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '型付きasync functionを生成する',
    implementation: 'async function {name}({parameters}): Promise<{type}> {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'parameter', 'type-expression', 'statement'],
    outputs: ['statement', 'async-function'],
    prerequisites: ['valid Promise return contract'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.async-function',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'ASYNC_FUNCTION_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_ASYNC_FUNCTION',
  },
  {
    knowledgeId: 'code.typescript.type-guard-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Type guard関数を生成する',
    implementation: 'function {name}(value: unknown): value is {type} {\\nreturn {check};\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'type-expression', 'boolean-expression'],
    outputs: ['statement'],
    prerequisites: ['runtime-compatible predicate'],
    dependencies: ['TypeScript'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.type-guard-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'TYPE_GUARD_CONTRACT_TEST',
    validation: 'VALIDATE_TYPESCRIPT_TYPE_GUARD',
  },

  {
    knowledgeId: 'code.typescript.enum',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '名前付きの有限な値集合を定義する',
    implementation: 'enum {name} {\\n{members}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'enum-member'],
    outputs: ['type-declaration'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.enum',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.tuple',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '固定位置ごとに型を持つTuple型を定義する',
    implementation: '[{members}]',
    targetPath: 'generated.ts',
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.tuple',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.class',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '状態と振る舞いを持つclassを定義する',
    implementation: 'class {name} {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.class',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.extends',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存classを継承するclassを定義する',
    implementation: 'class {name} extends {base} {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'identifier', 'statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.extends',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.implements',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'classへinterface契約を適用する',
    implementation: 'class {name} implements {contract} {\\n{body}\\n}',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'identifier', 'statement'],
    outputs: ['statement'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.implements',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.function-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '関数の入力と出力の型契約を定義する',
    implementation: '({parameters}) => {returnType}',
    targetPath: 'generated.ts',
    inputs: ['parameter', 'type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.function-type',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.type-assertion',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '式を特定のTypeScript型として扱う',
    implementation: '{value} as {type}',
    targetPath: 'generated.ts',
    inputs: ['expression', 'type-expression'],
    outputs: ['expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.type-assertion',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.record-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'キーと値の型からObject型を定義する',
    implementation: 'Record<{keyType}, {valueType}>',
    targetPath: 'generated.ts',
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.record-type',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.partial-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存Object型のプロパティをoptional化する',
    implementation: 'Partial<{type}>',
    targetPath: 'generated.ts',
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.partial-type',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.pick-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存型から必要なプロパティだけを抽出する',
    implementation: 'Pick<{type}, {keys}>',
    targetPath: 'generated.ts',
    inputs: ['type-expression', 'property-key'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.pick-type',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  },
  {
    knowledgeId: 'code.typescript.omit-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存型から指定プロパティを除外する',
    implementation: 'Omit<{type}, {keys}>',
    targetPath: 'generated.ts',
    inputs: ['type-expression', 'property-key'],
    outputs: ['type-expression'],
    prerequisites: ['compatible input contract'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.typescript.omit-type',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: 'CONTRACT_TEST',
    validation: 'VALIDATE_CODE_CONSTRUCTION_CONTRACT',
  }
,
{
  knowledgeId: "code.typescript.typed-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きparameterを構成する",
  implementation: "{name}: {type}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.typed-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.typed-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.typed-parameter",
},

{
  knowledgeId: "code.typescript.optional-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "省略可能なtyped parameterを構成する",
  implementation: "{name}?: {type}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.optional-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.optional-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.optional-parameter",
},

{
  knowledgeId: "code.typescript.rest-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きrest parameterを構成する",
  implementation: "...{name}: {type}[]",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.rest-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.rest-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.rest-parameter",
},

{
  knowledgeId: "code.typescript.default-parameter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "型付きdefault parameterを構成する",
  implementation: "{name}: {type} = {value}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression", "expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.default-parameter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.default-parameter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.default-parameter",
},

{
  knowledgeId: "code.typescript.property-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "interface/type内のproperty signatureを構成する",
  implementation: "{name}: {type};",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["property-signature"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.property-signature",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.property-signature",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.property-signature",
},

{
  knowledgeId: "code.typescript.method-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "interface内のmethod signatureを構成する",
  implementation: "{name}({parameters}): {returnType};",
  targetPath: "generated.ts",
  inputs: ["identifier", "parameter", "type-expression"],
  outputs: ["method-signature"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.method-signature",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.method-signature",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.method-signature",
},

{
  knowledgeId: "code.typescript.constructor",
  componentType: "CODE_CONSTRUCTION",
  purpose: "class constructorを構成する",
  implementation: "constructor({parameters}) {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["parameter", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.constructor",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.constructor",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.constructor",
},

{
  knowledgeId: "code.typescript.class-property",
  componentType: "CODE_CONSTRUCTION",
  purpose: "class propertyを構成する",
  implementation: "{name}: {type};",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.class-property",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.class-property",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.class-property",
},

{
  knowledgeId: "code.typescript.class-method",
  componentType: "CODE_CONSTRUCTION",
  purpose: "typed class methodを構成する",
  implementation: "{name}({parameters}): {returnType} {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "parameter", "type-expression", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.class-method",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.class-method",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.class-method",
},

{
  knowledgeId: "code.typescript.generic-interface",
  componentType: "CODE_CONSTRUCTION",
  purpose: "generic interfaceを構成する",
  implementation: "interface {name}<{parameter}> {\\n{members}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-parameter", "property-signature"],
  outputs: ["type-declaration"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.generic-interface",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.generic-interface",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.generic-interface",
},

{
  knowledgeId: "code.typescript.generic-type-alias",
  componentType: "CODE_CONSTRUCTION",
  purpose: "generic type aliasを構成する",
  implementation: "type {name}<{parameter}> = {type};",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-parameter", "type-expression"],
  outputs: ["type-declaration"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.generic-type-alias",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.generic-type-alias",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.generic-type-alias",
},

{
  knowledgeId: "code.typescript.keyof-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "keyofによるkey union型を構成する",
  implementation: "keyof {type}",
  targetPath: "generated.ts",
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.keyof-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.keyof-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.keyof-type",
},

{
  knowledgeId: "code.typescript.typeof-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "typeofによる型レベル参照を構成する",
  implementation: "typeof {value}",
  targetPath: "generated.ts",
  inputs: ["identifier"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.typeof-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.typeof-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.typeof-type",
},

{
  knowledgeId: "code.typescript.as-const",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値をliteral readonly型として固定する",
  implementation: "{value} as const",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.as-const",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.as-const",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.as-const",
},

{
  knowledgeId: "code.typescript.satisfies",
  componentType: "CODE_CONSTRUCTION",
  purpose: "値が型契約を満たすことを検証する",
  implementation: "{value} satisfies {type}",
  targetPath: "generated.ts",
  inputs: ["expression", "type-expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.satisfies",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.satisfies",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.satisfies",
},

{
  knowledgeId: "code.typescript.readonly-array",
  componentType: "CODE_CONSTRUCTION",
  purpose: "readonly array型を構成する",
  implementation: "readonly {type}[]",
  targetPath: "generated.ts",
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.readonly-array",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.readonly-array",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.readonly-array",
},

{
  knowledgeId: "code.typescript.index-signature",
  componentType: "CODE_CONSTRUCTION",
  purpose: "index signatureを構成する",
  implementation: "[{name}: string]: {type};",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["property-signature"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.index-signature",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.index-signature",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.index-signature",
},

{
  knowledgeId: "code.typescript.required-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Partial型などのoptional propertyをrequired化する",
  implementation: "Required<{type}>",
  targetPath: "generated.ts",
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.required-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.required-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.required-type",
},

{
  knowledgeId: "code.typescript.readonly-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Object型のpropertyをreadonly化する",
  implementation: "Readonly<{type}>",
  targetPath: "generated.ts",
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.readonly-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.readonly-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.readonly-type",
},

{
  knowledgeId: "code.typescript.nonnullable-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "nullとundefinedを除外する型を構成する",
  implementation: "NonNullable<{type}>",
  targetPath: "generated.ts",
  inputs: ["null", "undefined"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.nonnullable-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.nonnullable-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.nonnullable-type",
},

{
  knowledgeId: "code.typescript.abstract-class",
  componentType: "CODE_CONSTRUCTION",
  purpose: "abstract classを構成する",
  implementation: "abstract class {name} {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.abstract-class",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.abstract-class",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.abstract-class",
},

{
  knowledgeId: "code.typescript.getter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "getter methodを構成する",
  implementation: "get {name}(): {type} {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.getter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.getter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.getter",
},

{
  knowledgeId: "code.typescript.setter",
  componentType: "CODE_CONSTRUCTION",
  purpose: "setter methodを構成する",
  implementation: "set {name}({parameter}) {\\n{body}\\n}",
  targetPath: "generated.ts",
  inputs: ["identifier", "parameter", "statement"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.setter",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.setter",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.setter",
},

{
  knowledgeId: "code.typescript.overload",
  componentType: "CODE_CONSTRUCTION",
  purpose: "関数overload signatureを構成する",
  implementation: "function {name}({parameters}): {returnType};",
  targetPath: "generated.ts",
  inputs: ["identifier", "parameter", "type-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.overload",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.overload",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.overload",
},

{
  knowledgeId: "code.typescript.parameter-property",
  componentType: "CODE_CONSTRUCTION",
  purpose: "constructor parameter propertyを構成する",
  implementation: "private readonly {name}: {type}",
  targetPath: "generated.ts",
  inputs: ["identifier", "type-expression"],
  outputs: ["parameter"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.parameter-property",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.parameter-property",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.parameter-property",
},

{
  knowledgeId: "code.typescript.return-type",
  componentType: "CODE_CONSTRUCTION",
  purpose: "明示的な関数return typeを構成する",
  implementation: "{type}",
  targetPath: "generated.ts",
  inputs: ["type-expression"],
  outputs: ["type-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: [],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.typescript.return-type",
  securityClass: "READ_ONLY",
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.typescript.return-type",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.typescript.return-type",
},

{
  "knowledgeId": "code.typescript.union-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数候補を表すUnion Typeを構成する",
  "implementation": "type {name} = {left} | {right};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.typescript.union-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.union-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.union-type"
},

{
  "knowledgeId": "code.typescript.intersection-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "複数型を同時に満たすIntersection Typeを構成する",
  "implementation": "type {name} = {left} & {right};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.typescript.intersection-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.intersection-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.intersection-type"
},

{
  "knowledgeId": "code.typescript.generic-interface-constraint",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic Interfaceに型制約を付ける",
  "implementation": "interface {name}<T extends {constraint}> {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression",
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
  "entryPoint": "CodeConstruction/code.typescript.generic-interface-constraint",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.generic-interface-constraint",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.generic-interface-constraint"
},

{
  "knowledgeId": "code.typescript.typeof-type-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "既存valueの型をType位置で取得する",
  "implementation": "type {name} = typeof {value};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.typescript.typeof-type-query",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.typeof-type-query",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.typeof-type-query"
},

{
  "knowledgeId": "code.typescript.keyof-type-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Typeのproperty key Unionを取得する",
  "implementation": "type {name}<T> = keyof T;",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.typescript.keyof-type-query",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.keyof-type-query",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.keyof-type-query"
},

{
  "knowledgeId": "code.typescript.union-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "UnionをtypeofでNarrowingする",
  "implementation": "if (typeof {value} === '{typeName}') {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "string-expression",
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
  "entryPoint": "CodeConstruction/code.typescript.union-narrowing",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.union-narrowing",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.union-narrowing"
},

{
  "knowledgeId": "code.typescript.instanceof-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "instanceofによる型Narrowingを構成する",
  "implementation": "if ({value} instanceof {constructor}) {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "identifier",
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
  "entryPoint": "CodeConstruction/code.typescript.instanceof-narrowing",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.instanceof-narrowing",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.instanceof-narrowing"
},

{
  "knowledgeId": "code.typescript.as-type-assertion",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "値を指定型として扱うType Assertionを構成する",
  "implementation": "{value} as {type}",
  "targetPath": "generated.ts",
  "inputs": [
    "expression",
    "type-expression"
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
  "entryPoint": "CodeConstruction/code.typescript.as-type-assertion",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.as-type-assertion",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.as-type-assertion"
},

{
  "knowledgeId": "code.typescript.const-type-parameter",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic parameterをconstとして推論する",
  "implementation": "function {name}<const T>({parameter}: T): T {\\n  return {parameter};\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "parameter"
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
  "entryPoint": "CodeConstruction/code.typescript.const-type-parameter",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.const-type-parameter",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.const-type-parameter"
},

{
  "knowledgeId": "code.typescript.this-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "現在のObject型をThisTypeで表現する",
  "implementation": "ThisType<{type}>",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.typescript.this-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.this-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.this-type"
},

{
  "knowledgeId": "code.typescript.declare-const",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "外部runtime値の型宣言を構成する",
  "implementation": "declare const {name}: {type};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression"
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
  "entryPoint": "CodeConstruction/code.typescript.declare-const",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.declare-const",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.declare-const"
},

{
  "knowledgeId": "code.typescript.namespace-import",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Module全体をnamespaceとしてimportする",
  "implementation": "import * as {name} from {module};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "string-expression"
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
  "entryPoint": "CodeConstruction/code.typescript.namespace-import",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.namespace-import",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.namespace-import"
},

{
  "knowledgeId": "code.typescript.namespace-export",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "namespace全体をexportする",
  "implementation": "export * from {module};",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
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
  "entryPoint": "CodeConstruction/code.typescript.namespace-export",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.namespace-export",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.namespace-export"
},
{
  "knowledgeId": "code.typescript.interface-extends",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "既存interfaceを拡張する",
  "implementation": "interface {name} extends {base} {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "identifier",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.interface-extends",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.interface-extends",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.interface-extends"
},
{
  "knowledgeId": "code.typescript.class-implements",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "classのimplements契約を構成する",
  "implementation": "class {name} implements {contracts} {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "identifier",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.class-implements",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.class-implements",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.class-implements"
},
{
  "knowledgeId": "code.typescript.generic-class",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic classを構成する",
  "implementation": "class {name}<T> {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.generic-class",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.generic-class",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.generic-class"
},
{
  "knowledgeId": "code.typescript.generic-method",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Generic methodを構成する",
  "implementation": "{name}<T>({parameters}): {returnType} {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "parameter",
    "type-expression",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.generic-method",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.generic-method",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.generic-method"
},
{
  "knowledgeId": "code.typescript.discriminated-union",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "判別可能Unionを構成する",
  "implementation": "type {name} = {members};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.discriminated-union",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.discriminated-union",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.discriminated-union"
},
{
  "knowledgeId": "code.typescript.in-narrowing",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "in演算子による型Narrowingを構成する",
  "implementation": "if ({property} in {value}) {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "expression",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.in-narrowing",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.in-narrowing",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.in-narrowing"
},
{
  "knowledgeId": "code.typescript.type-predicate",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "user-defined type predicateを構成する",
  "implementation": "function {name}({value}: unknown): value is {type} {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "identifier",
    "type-expression",
    "statement"
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
  "entryPoint": "CodeConstruction/code.typescript.type-predicate",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.type-predicate",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.type-predicate"
},
{
  "knowledgeId": "code.typescript.conditional-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Conditional Typeを構成する",
  "implementation": "type {name}<T> = T extends {condition} ? {whenTrue} : {whenFalse};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression",
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.conditional-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.conditional-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.conditional-type"
},
{
  "knowledgeId": "code.typescript.mapped-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Mapped Typeを構成する",
  "implementation": "type {name}<T> = { [K in keyof T]: T[K] };",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.mapped-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.mapped-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.mapped-type"
},
{
  "knowledgeId": "code.typescript.template-literal-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Template Literal Typeを構成する",
  "implementation": "type {name} = `{prefix}${{value}}`;",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.template-literal-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.template-literal-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.template-literal-type"
},
{
  "knowledgeId": "code.typescript.infer-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Conditional Type内のinferを構成する",
  "implementation": "T extends {pattern}<infer U> ? U : never",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.infer-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.infer-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.infer-type"
},
{
  "knowledgeId": "code.typescript.indexed-access-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Indexed Access Typeを構成する",
  "implementation": "{type}[{key}]",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.indexed-access-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.indexed-access-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.indexed-access-type"
},
{
  "knowledgeId": "code.typescript.awaited-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Awaited utility typeを構成する",
  "implementation": "Awaited<{type}>",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.awaited-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.awaited-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.awaited-type"
},
{
  "knowledgeId": "code.typescript.parameters-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Parameters utility typeを構成する",
  "implementation": "Parameters<{functionType}>",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.parameters-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.parameters-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.parameters-type"
},
{
  "knowledgeId": "code.typescript.exclude-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Exclude utility typeを構成する",
  "implementation": "Exclude<{union}, {excluded}>",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.exclude-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.exclude-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.exclude-type"
},
{
  "knowledgeId": "code.typescript.extract-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Extract utility typeを構成する",
  "implementation": "Extract<{union}, {target}>",
  "targetPath": "generated.ts",
  "inputs": [
    "type-expression",
    "type-expression"
  ],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.extract-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.extract-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.extract-type"
},
{
  "knowledgeId": "code.typescript.unknown-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "unknown型を構成する",
  "implementation": "unknown",
  "targetPath": "generated.ts",
  "inputs": [],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.unknown-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.unknown-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.unknown-type"
},
{
  "knowledgeId": "code.typescript.never-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "never型を構成する",
  "implementation": "never",
  "targetPath": "generated.ts",
  "inputs": [],
  "outputs": [
    "type-expression"
  ],
  "prerequisites": [],
  "dependencies": [],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.typescript.never-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.never-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.never-type"
},
{
  "knowledgeId": "code.typescript.import-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "type-only importを構成する",
  "implementation": "import type { {names} } from {module};",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
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
  "entryPoint": "CodeConstruction/code.typescript.import-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.typescript.import-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.typescript.import-type"
},

{
  knowledgeId: 'code.typescript.generic-function-constraint',
  componentType: 'CODE_CONSTRUCTION',
  purpose: 'Generic関数へ型制約を付ける',
  implementation: 'function {name}<{typeParameter} extends {constraint}>({parameters}) {\n{body}\n}',
  targetPath: 'generated.ts',
  inputs: ['identifier', 'type-parameter', 'type-expression', 'parameter', 'statement'],
  outputs: ['statement'],
  prerequisites: ['valid TypeScript generic type parameter', 'valid TypeScript constraint'],
  dependencies: ['TypeScript'],
  supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
  entryPoint: 'CodeConstruction/code.typescript.generic-function-constraint',
  securityClass: 'READ_ONLY',
  exports: [],
  imports: [],
  publicInterfaces: [],
  tests: 'GENERIC_FUNCTION_CONSTRAINT_CONTRACT_TEST',
  validation: 'VALIDATE_TYPESCRIPT_GENERIC_CONSTRAINT',
},


  {
    id: 'code.typescript.conditional-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '条件に応じて型を選択する',
    summary: 'conditional typeによる型レベル分岐。',
    concepts: ['conditional type', 'extends', 'true-branch', 'false-branch'],
    inputs: ['type-expression', 'type-expression', 'type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['型条件によって結果型を切り替える'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/conditional-types.html'],
    sourceArtifactIds: ['typescript-conditional-types'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '{check} extends {constraint} ? {trueType} : {falseType}',
      outputKinds: ['type-expression'],
      slots: [
        {name: 'check', inputKinds: ['type-expression'], required: true},
        {name: 'constraint', inputKinds: ['type-expression'], required: true},
        {name: 'trueType', inputKinds: ['type-expression'], required: true},
        {name: 'falseType', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['all branches must be valid TypeScript types'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.typescript.mapped-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '既存型のキーを変換して新しい型を構成する',
    summary: 'mapped typeによる型変換。',
    concepts: ['mapped type', 'keyof', 'property modifier'],
    inputs: ['identifier', 'type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['既存型のプロパティを一括変換する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/mapped-types.html'],
    sourceArtifactIds: ['typescript-mapped-types'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '{ [K in keyof {source}]: {valueType} }',
      outputKinds: ['type-expression'],
      slots: [
        {name: 'source', inputKinds: ['type-expression'], required: true},
        {name: 'valueType', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['mapped key expression must be valid TypeScript syntax'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.typescript.template-literal-type',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '文字列パターンから型を構成する',
    summary: 'template literal typeによる文字列リテラル型生成。',
    concepts: ['template literal type', 'literal type', 'interpolation'],
    inputs: ['type-expression'],
    outputs: ['type-expression'],
    appliesWhen: ['文字列形式を型として制約する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html'],
    sourceArtifactIds: ['typescript-template-literal-types'],
    constructionProfile: {
      kind: 'TYPE',
      syntaxTemplate: '`${{type}}`',
      outputKinds: ['type-expression'],
      slots: [
        {name: 'type', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['interpolated type must be compatible with template literal type syntax'],
      adaptationRules: [],
    },
  },
  {
    id: 'code.typescript.satisfies',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '式が期待する型を満たすことを検証する',
    summary: 'satisfies operatorによる型制約検証。',
    concepts: ['satisfies', 'type checking', 'expression'],
    inputs: ['expression', 'type-expression'],
    outputs: ['expression'],
    appliesWhen: ['値の推論を保ちながら型制約を検証する'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html'],
    sourceArtifactIds: ['typescript-satisfies-operator'],
    constructionProfile: {
      kind: 'EXPRESSION',
      syntaxTemplate: '{expression} satisfies {type}',
      outputKinds: ['expression'],
      slots: [
        {name: 'expression', inputKinds: ['expression'], required: true},
        {name: 'type', inputKinds: ['type-expression'], required: true},
      ],
      constraints: ['type must be valid TypeScript syntax'],
      adaptationRules: [],
    },
  },

];

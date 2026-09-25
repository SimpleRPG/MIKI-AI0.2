import type { CodeKnowledgeDefinition, CodeComponentDefinition } from './common';

export const testingCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.testing.contract',
    componentType: 'TESTING_CONCEPT',
    purpose: 'コードの入力・出力・副作用・エラーという契約をテストする',
    summary: '実装内部ではなく呼び出し側から見える契約を中心にテストケースを作る。',
    concepts: ['contract', 'input', 'output', 'side effect', 'error'],
    inputs: ['component contract'],
    outputs: ['test cases'],
    appliesWhen: ['新規Component', '修正', 'リファクタリング'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://vitest.dev/guide/learn/testing-in-practice'],
    sourceArtifactIds: ['vitest-testing-in-practice'],
  },
  {
    id: 'code.testing.assertion',
    componentType: 'TESTING_CONCEPT',
    purpose: '期待結果を明示的なAssertionとして表現する',
    summary: 'テストが何を保証するかをexpect等のAssertionで明示する。',
    concepts: ['test', 'expect', 'assertion', 'pass', 'fail'],
    inputs: ['actual result', 'expected result'],
    outputs: ['test verdict'],
    appliesWhen: ['単体テスト', 'Regression Test'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://vitest.dev/guide/learn/writing-tests'],
    sourceArtifactIds: ['vitest-writing-tests'],
  },
  {
    id: 'code.testing.mocking',
    componentType: 'TESTING_CONCEPT',
    purpose: '外部依存を制御して対象Componentを隔離してテストする',
    summary: 'vi.fnやvi.spyOnなどを使い、外部通信や副作用を制御して対象処理を検証する。',
    concepts: ['mock', 'spy', 'vi.fn', 'vi.spyOn', 'dependency isolation'],
    inputs: ['dependency'],
    outputs: ['controlled dependency'],
    appliesWhen: ['外部依存', '再現困難な失敗', '副作用分離'],
    doesNotApplyWhen: ['実依存との統合動作自体を検証する場合'],
    sourceUrls: ['https://vitest.dev/guide/mocking.html'],
    sourceArtifactIds: ['vitest-mocking'],
  },
  {
    id: 'code.testing.async',
    componentType: 'TESTING_CONCEPT',
    purpose: '非同期処理の成功・失敗・Promise結果をテストする',
    summary: '非同期結果を待ってからAssertionし、resolveとrejectの両方を検証する。',
    concepts: ['async test', 'await', 'Promise', 'resolve', 'reject'],
    inputs: ['async operation'],
    outputs: ['async test verdict'],
    appliesWhen: ['Promise', 'fetch', '非同期サービス'],
    doesNotApplyWhen: ['同期処理だけの場合'],
    sourceUrls: ['https://vitest.dev/guide/learn/mock-functions'],
    sourceArtifactIds: ['vitest-mock-functions'],
  },
  {
    id: 'code.testing.regression',
    componentType: 'TESTING_CONCEPT',
    purpose: '変更によって既存契約が壊れていないことを確認する',
    summary: '既知の正常系・異常系をRegressionとして残し、変更前後の振る舞いを比較する。',
    concepts: ['regression', 'baseline', 'known behavior', 'compatibility'],
    inputs: ['existing behavior'],
    outputs: ['regression verdict'],
    appliesWhen: ['既存コード変更', 'Component更新', '自己改善'],
    doesNotApplyWhen: ['完全に新規で既存契約がない場合'],
    sourceUrls: ['https://vitest.dev/guide/learn/testing-in-practice'],
    sourceArtifactIds: ['vitest-testing-in-practice'],
  },
];

export const additionalTestingCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.testing.fixtures',
    componentType: 'TESTING_CONCEPT',
    purpose: 'テストに必要な初期状態を再現可能にする',
    summary: 'テストデータや初期化処理を整理し、各テストの前提条件を明確にする。',
    concepts: ['fixture', 'setup', 'teardown', 'test data'],
    inputs: ['test prerequisites'],
    outputs: ['repeatable test state'],
    appliesWhen: ['複数テスト', '複雑な初期状態'],
    doesNotApplyWhen: ['単純な単一入力テスト'],
    sourceUrls: ['https://vitest.dev/guide/learn/writing-tests'],
    sourceArtifactIds: ['vitest-test-fixtures'],
  },
  {
    id: 'code.testing.edge-cases',
    componentType: 'TESTING_CONCEPT',
    purpose: '境界値や異常入力による失敗を検出する',
    summary: '空値、最小・最大値、不正形式、存在しないデータなど通常系以外の入力をテストする。',
    concepts: ['edge case', 'boundary value', 'invalid input', 'negative test'],
    inputs: ['boundary or invalid input'],
    outputs: ['failure behavior verification'],
    appliesWhen: ['入力検証', '外部データ', '自己改善'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://vitest.dev/guide/learn/testing-in-practice'],
    sourceArtifactIds: ['vitest-edge-case-testing'],
  },
  {
    id: 'code.testing.integration-boundary',
    componentType: 'TESTING_CONCEPT',
    purpose: 'Component間の接続契約をテストする',
    summary: '単体内部だけでなく、入力Componentから出力Componentまでの契約が成立することを確認する。',
    concepts: ['integration', 'interface contract', 'adapter', 'boundary'],
    inputs: ['connected components'],
    outputs: ['integration verdict'],
    appliesWhen: ['Component composition', 'サービス接続'],
    doesNotApplyWhen: ['単一関数内部だけを検証する場合'],
    sourceUrls: ['https://vitest.dev/guide/learn/testing-in-practice'],
    sourceArtifactIds: ['vitest-integration-testing'],
  },
  {
    id: 'code.testing.determinism',
    componentType: 'TESTING_CONCEPT',
    purpose: '同じ入力に対して期待される結果が再現されることを確認する',
    summary: '時刻、乱数、外部状態などの不確定要素を制御し、再現可能なテストを構成する。',
    concepts: ['determinism', 'repeatability', 'mock time', 'controlled state'],
    inputs: ['same test input'],
    outputs: ['repeatable result'],
    appliesWhen: ['決定的処理', 'CORE', 'Component verification'],
    doesNotApplyWhen: ['本質的にランダム性を検証するテスト'],
    sourceUrls: ['https://vitest.dev/guide/mocking'],
    sourceArtifactIds: ['vitest-deterministic-tests'],
  },
  {
    id: 'code.testing.failure-feedback',
    componentType: 'TESTING_CONCEPT',
    purpose: 'テスト失敗を次の改善入力として構造化する',
    summary: '失敗したテスト、期待値、実際値、再現条件を保持し、修正候補生成の入力として再利用する。',
    concepts: ['failure evidence', 'feedback', 'regression', 'repair input'],
    inputs: ['test failure'],
    outputs: ['structured improvement feedback'],
    appliesWhen: ['自律改善', 'Regression failure', '修正候補生成'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://vitest.dev/guide/learn/testing-in-practice'],
    sourceArtifactIds: ['vitest-failure-feedback'],
  },,
{
  "id": "code.testing.describe",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest test suiteを構成する",
  "summary": "Vitest test suiteを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "describe",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Vitest test suiteを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.describe"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "describe({name}, () => {\\n{body}\\n});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "name",
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
  "id": "code.testing.it",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest test caseを構成する",
  "summary": "Vitest test caseを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "it",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Vitest test caseを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.it"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "it({name}, async () => {\\n{body}\\n});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "name",
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
  "id": "code.testing.expect",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest Assertion対象を構成する",
  "summary": "Vitest Assertion対象を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "expression",
    "assertion-expression"
  ],
  "inputs": [
    "expression"
  ],
  "outputs": [
    "assertion-expression"
  ],
  "appliesWhen": [
    "Vitest Assertion対象を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "expect({actual})",
    "outputKinds": [
      "assertion-expression"
    ],
    "slots": [
      {
        "name": "actual",
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
  "id": "code.testing.expect-to-be",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "厳密一致Assertionを構成する",
  "summary": "厳密一致Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "to",
    "be",
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
    "厳密一致Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect-to-be"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "expect({actual}).toBe({expected})",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "actual",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "expected",
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
  "id": "code.testing.expect-to-equal",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "構造一致Assertionを構成する",
  "summary": "構造一致Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "to",
    "equal",
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
    "構造一致Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect-to-equal"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "expect({actual}).toEqual({expected})",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "actual",
        "inputKinds": [
          "expression"
        ],
        "required": true
      },
      {
        "name": "expected",
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
  "id": "code.testing.expect-to-throw",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "例外Assertionを構成する",
  "summary": "例外Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "to",
    "throw",
    "function-expression",
    "statement"
  ],
  "inputs": [
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "例外Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect-to-throw"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "expect({operation}).toThrow()",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "operation",
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.testing.expect-resolves",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promise成功Assertionを構成する",
  "summary": "Promise成功Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "resolves",
    "promise-expression",
    "expression",
    "statement"
  ],
  "inputs": [
    "promise-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Promise成功Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect-resolves"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "await expect({operation}).resolves.toEqual({expected})",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "operation",
        "inputKinds": [
          "promise-expression"
        ],
        "required": true
      },
      {
        "name": "expected",
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
  "id": "code.testing.expect-rejects",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promise失敗Assertionを構成する",
  "summary": "Promise失敗Assertionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "expect",
    "rejects",
    "promise-expression",
    "statement"
  ],
  "inputs": [
    "promise-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Promise失敗Assertionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.expect-rejects"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "await expect({operation}).rejects.toThrow()",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "operation",
        "inputKinds": [
          "promise-expression"
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
  "id": "code.testing.before-each",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "各test前のsetupを構成する",
  "summary": "各test前のsetupを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "before",
    "each",
    "statement"
  ],
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "各test前のsetupを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.before-each"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "beforeEach(() => {\\n{body}\\n});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "body",
        "inputKinds": [
          "statement"
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
  "id": "code.testing.after-each",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "各test後のcleanupを構成する",
  "summary": "各test後のcleanupを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "after",
    "each",
    "statement"
  ],
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "各test後のcleanupを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.after-each"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "afterEach(() => {\\n{body}\\n});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "body",
        "inputKinds": [
          "statement"
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
  "id": "code.testing.vi-fn",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest mock functionを構成する",
  "summary": "Vitest mock functionを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "vi",
    "fn",
    "function-expression"
  ],
  "inputs": [
    "function-expression"
  ],
  "outputs": [
    "function-expression"
  ],
  "appliesWhen": [
    "Vitest mock functionを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.vi-fn"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "vi.fn({implementation})",
    "outputKinds": [
      "function-expression"
    ],
    "slots": [
      {
        "name": "implementation",
        "inputKinds": [
          "function-expression"
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
  "id": "code.testing.vi-spy-on",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest spyを構成する",
  "summary": "Vitest spyを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "vi",
    "spy",
    "on",
    "object-expression",
    "string-expression",
    "mock-expression"
  ],
  "inputs": [
    "object-expression",
    "string-expression"
  ],
  "outputs": [
    "mock-expression"
  ],
  "appliesWhen": [
    "Vitest spyを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.vi-spy-on"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "vi.spyOn({object}, {method})",
    "outputKinds": [
      "mock-expression"
    ],
    "slots": [
      {
        "name": "object",
        "inputKinds": [
          "object-expression"
        ],
        "required": true
      },
      {
        "name": "method",
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
  "id": "code.testing.vi-mock",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest module mockを構成する",
  "summary": "Vitest module mockを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "vi",
    "mock",
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
    "Vitest module mockを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://vitest.dev/api/"
  ],
  "sourceArtifactIds": [
    "testing:code.testing.vi-mock"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "vi.mock({module})",
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
  {
    "id": "code.testing.mock-function",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "依存処理をモック関数へ置き換える",
    "summary": "テスト用mock関数。",
    "concepts": [
      "mock",
      "stub",
      "test double"
    ],
    "inputs": [
      "function-expression"
    ],
    "outputs": [
      "function-expression"
    ],
    "appliesWhen": [
      "外部依存をテスト用実装に差し替える"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.testing.mock-function"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "mockFn({implementation})",
      "outputKinds": [
        "function-expression"
      ],
      "slots": [
        {
          "name": "implementation",
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
    "id": "code.testing.spy",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "既存処理の呼び出しを監視する",
    "summary": "spyによる呼び出し記録。",
    "concepts": [
      "spy",
      "call count",
      "arguments"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "実処理を残したまま呼び出しを検証する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.testing.spy"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "spyOn({target}, {method})",
      "outputKinds": [
        "expression"
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
          "name": "method",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.testing.parameterized-case",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "入力ケース集合から同一テストを反復する",
    "summary": "パラメータ化テスト。",
    "concepts": [
      "parameterized test",
      "test cases",
      "table test"
    ],
    "inputs": [
      "array-expression",
      "function-expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "複数ケースで同じ契約を検証する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.testing.parameterized-case"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "test.each({cases})({testName}, {testBody})",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "cases",
          "inputKinds": [
            "array-expression"
          ],
          "required": true
        },
        {
          "name": "testName",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        },
        {
          "name": "testBody",
          "inputKinds": [
            "function-expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  }

];

export const additionalTestingCodeComponents: CodeComponentDefinition[] = [
{
  "knowledgeId": "code.testing.describe",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest test suiteを構成する",
  "implementation": "describe({name}, () => {\\n{body}\\n});",
  "targetPath": "generated.test.ts",
  "inputs": [
    "string-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.describe",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.describe",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.describe"
},
{
  "knowledgeId": "code.testing.it",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest test caseを構成する",
  "implementation": "it({name}, async () => {\\n{body}\\n});",
  "targetPath": "generated.test.ts",
  "inputs": [
    "string-expression",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.it",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.it",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.it"
},
{
  "knowledgeId": "code.testing.expect",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest Assertion対象を構成する",
  "implementation": "expect({actual})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "expression"
  ],
  "outputs": [
    "assertion-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect"
},
{
  "knowledgeId": "code.testing.expect-to-be",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "厳密一致Assertionを構成する",
  "implementation": "expect({actual}).toBe({expected})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect-to-be",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect-to-be",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect-to-be"
},
{
  "knowledgeId": "code.testing.expect-to-equal",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "構造一致Assertionを構成する",
  "implementation": "expect({actual}).toEqual({expected})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect-to-equal",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect-to-equal",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect-to-equal"
},
{
  "knowledgeId": "code.testing.expect-to-throw",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "例外Assertionを構成する",
  "implementation": "expect({operation}).toThrow()",
  "targetPath": "generated.test.ts",
  "inputs": [
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect-to-throw",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect-to-throw",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect-to-throw"
},
{
  "knowledgeId": "code.testing.expect-resolves",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promise成功Assertionを構成する",
  "implementation": "await expect({operation}).resolves.toEqual({expected})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "promise-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect-resolves",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect-resolves",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect-resolves"
},
{
  "knowledgeId": "code.testing.expect-rejects",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Promise失敗Assertionを構成する",
  "implementation": "await expect({operation}).rejects.toThrow()",
  "targetPath": "generated.test.ts",
  "inputs": [
    "promise-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.expect-rejects",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.expect-rejects",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.expect-rejects"
},
{
  "knowledgeId": "code.testing.before-each",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "各test前のsetupを構成する",
  "implementation": "beforeEach(() => {\\n{body}\\n});",
  "targetPath": "generated.test.ts",
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.before-each",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.before-each",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.before-each"
},
{
  "knowledgeId": "code.testing.after-each",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "各test後のcleanupを構成する",
  "implementation": "afterEach(() => {\\n{body}\\n});",
  "targetPath": "generated.test.ts",
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.after-each",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.after-each",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.after-each"
},
{
  "knowledgeId": "code.testing.vi-fn",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest mock functionを構成する",
  "implementation": "vi.fn({implementation})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "function-expression"
  ],
  "outputs": [
    "function-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.vi-fn",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.vi-fn",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.vi-fn"
},
{
  "knowledgeId": "code.testing.vi-spy-on",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest spyを構成する",
  "implementation": "vi.spyOn({object}, {method})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "object-expression",
    "string-expression"
  ],
  "outputs": [
    "mock-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.vi-spy-on",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.vi-spy-on",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.vi-spy-on"
},
{
  "knowledgeId": "code.testing.vi-mock",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Vitest module mockを構成する",
  "implementation": "vi.mock({module})",
  "targetPath": "generated.test.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "vitest"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.testing.vi-mock",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "vitest"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.testing.vi-mock",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.vi-mock"
},
  {
    "knowledgeId": "code.testing.mock-function",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "モック関数を構成する",
    "implementation": "mockFn({implementation})",
    "targetPath": "generated.ts",
    "inputs": [
      "function-expression"
    ],
    "outputs": [
      "function-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.testing.mock-function",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.testing.mock-function",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.mock-function"
  },
  {
    "knowledgeId": "code.testing.spy",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "スパイを構成する",
    "implementation": "spyOn({target}, {method})",
    "targetPath": "generated.ts",
    "inputs": [
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
    "entryPoint": "CodeConstruction/code.testing.spy",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.testing.spy",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.spy"
  },
  {
    "knowledgeId": "code.testing.parameterized-case",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "テストケースを反復して検証する",
    "implementation": "test.each({cases})({testName}, {testBody})",
    "targetPath": "generated.ts",
    "inputs": [
      "array-expression",
      "function-expression"
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
    "entryPoint": "CodeConstruction/code.testing.parameterized-case",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.testing.parameterized-case",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.testing.parameterized-case"
  }

];

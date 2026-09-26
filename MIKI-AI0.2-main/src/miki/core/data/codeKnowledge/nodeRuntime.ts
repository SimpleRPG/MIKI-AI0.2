import type { CodeComponentDefinition, CodeKnowledgeDefinition } from './common';

/**
 * Node.js Runtime
 * Knowledge と直接再利用可能な CODE Component を同一カテゴリで管理する。
 * platformCodeKnowledge.ts から分離した静的な登録元。
 */
export const nodeRuntimeCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
      id: 'code.node-runtime.http-server',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node HTTP server',
      summary: 'Node HTTP serverをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['http', 'http-server'],
      inputs: ['input'],
      outputs: ['http server'],
      appliesWhen: ['node-runtime', 'http-server'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const server = http.createServer({handler});',
        outputKinds: ['http server'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.http-request',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node HTTP request',
      summary: 'Node HTTP requestをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['http', 'http-request'],
      inputs: ['input'],
      outputs: ['http request'],
      appliesWhen: ['node-runtime', 'http-request'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'http.request({options}, {callback});',
        outputKinds: ['http request'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.https-request',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node HTTPS request',
      summary: 'Node HTTPS requestをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['https', 'https-request'],
      inputs: ['input'],
      outputs: ['https request'],
      appliesWhen: ['node-runtime', 'https-request'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'https.request({options}, {callback});',
        outputKinds: ['https request'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.url-api',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node URL API',
      summary: 'Node URL APIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['url', 'url-api'],
      inputs: ['input'],
      outputs: ['url object'],
      appliesWhen: ['node-runtime', 'url-api'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'new URL({input}, {base});',
        outputKinds: ['url object'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.event-emitter',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node EventEmitter',
      summary: 'Node EventEmitterをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['events', 'event-emitter'],
      inputs: ['input'],
      outputs: ['event emitter'],
      appliesWhen: ['node-runtime', 'event-emitter'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {emitter} = new EventEmitter();',
        outputKinds: ['event emitter'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.stream-readable',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Readable stream',
      summary: 'Readable streamをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['stream', 'stream-readable'],
      inputs: ['input'],
      outputs: ['readable stream'],
      appliesWhen: ['node-runtime', 'stream-readable'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'Readable.from({source});',
        outputKinds: ['readable stream'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.stream-writable',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Writable stream',
      summary: 'Writable streamをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['stream', 'stream-writable'],
      inputs: ['input'],
      outputs: ['writable stream'],
      appliesWhen: ['node-runtime', 'stream-writable'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'Writable.toWeb({stream});',
        outputKinds: ['writable stream'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.stream-transform',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Transform stream',
      summary: 'Transform streamをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['stream', 'stream-transform'],
      inputs: ['input'],
      outputs: ['transform stream'],
      appliesWhen: ['node-runtime', 'stream-transform'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'new Transform({transform});',
        outputKinds: ['transform stream'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.buffer',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node Buffer',
      summary: 'Node BufferをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['buffer', 'buffer'],
      inputs: ['input'],
      outputs: ['buffer'],
      appliesWhen: ['node-runtime', 'buffer'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'Buffer.from({value});',
        outputKinds: ['buffer'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.os-info',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node OS information',
      summary: 'Node OS informationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['os', 'os-info'],
      inputs: ['input'],
      outputs: ['os value'],
      appliesWhen: ['node-runtime', 'os-info'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'os.{operation}();',
        outputKinds: ['os value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.util-promisify',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Promisify callback API',
      summary: 'Promisify callback APIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['util', 'util-promisify'],
      inputs: ['input'],
      outputs: ['async function'],
      appliesWhen: ['node-runtime', 'util-promisify'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'promisify({function});',
        outputKinds: ['async function'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.crypto-hash',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Cryptographic hash',
      summary: 'Cryptographic hashをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['crypto', 'crypto-hash'],
      inputs: ['input'],
      outputs: ['hash'],
      appliesWhen: ['node-runtime', 'crypto-hash'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'createHash({algorithm}).update({value}).digest({encoding});',
        outputKinds: ['hash'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.crypto-random',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Cryptographically secure random',
      summary: 'Cryptographically secure randomをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['crypto', 'crypto-random'],
      inputs: ['input'],
      outputs: ['random bytes'],
      appliesWhen: ['node-runtime', 'crypto-random'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'randomBytes({size});',
        outputKinds: ['random bytes'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.child-process',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Child process execution',
      summary: 'Child process executionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['child_process', 'child-process'],
      inputs: ['input'],
      outputs: ['child process'],
      appliesWhen: ['node-runtime', 'child-process'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'execFile({command}, {args}, {callback});',
        outputKinds: ['child process'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.worker-thread',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Worker thread',
      summary: 'Worker threadをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['worker_threads', 'worker-thread'],
      inputs: ['input'],
      outputs: ['worker'],
      appliesWhen: ['node-runtime', 'worker-thread'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'new Worker({filename});',
        outputKinds: ['worker'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.zlib-compression',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Compression',
      summary: 'CompressionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['zlib', 'zlib-compression'],
      inputs: ['input'],
      outputs: ['compressed data'],
      appliesWhen: ['node-runtime', 'zlib-compression'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{compress}({input});',
        outputKinds: ['compressed data'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.readline',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Readline interface',
      summary: 'Readline interfaceをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['readline', 'readline'],
      inputs: ['input'],
      outputs: ['readline interface'],
      appliesWhen: ['node-runtime', 'readline'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'createInterface({input}, {output});',
        outputKinds: ['readline interface'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.assert',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Node assertion',
      summary: 'Node assertionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['assert', 'assert'],
      inputs: ['input'],
      outputs: ['assertion'],
      appliesWhen: ['node-runtime', 'assert'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'assert.{method}({actual}, {expected});',
        outputKinds: ['assertion'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.node-runtime.timers-promises',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Promise timer',
      summary: 'Promise timerをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['timers/promises', 'timers-promises'],
      inputs: ['input'],
      outputs: ['promise'],
      appliesWhen: ['node-runtime', 'timers-promises'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-node-runtime'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'await setTimeout({delay});',
        outputKinds: ['promise'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
    "id": "code.node.event-emitter",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.js内のイベント購読と発火を構成する",
    "summary": "EventEmitterによるイベント駆動。",
    "concepts": [
      "EventEmitter",
      "on",
      "emit"
    ],
    "inputs": [
      "identifier",
      "function-expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "Node.jsでイベント駆動処理を構成する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.node.event-emitter"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "{emitter}.on({event}, {handler})",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "emitter",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "event",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        },
        {
          "name": "handler",
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
    "id": "code.node.child-process-spawn",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "子プロセスを起動する",
    "summary": "child_process.spawnによるプロセス起動。",
    "concepts": [
      "child_process",
      "spawn",
      "process"
    ],
    "inputs": [
      "string-expression",
      "array-expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "外部コマンドを子プロセスとして起動する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.node.child-process-spawn"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "spawn({command}, {args})",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "command",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        },
        {
          "name": "args",
          "inputKinds": [
            "array-expression"
          ],
          "required": false
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.node.stream-pipeline",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsストリームを安全に連結する",
    "summary": "stream.pipelineによるストリーム接続。",
    "concepts": [
      "stream",
      "pipeline",
      "backpressure"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "promise-expression"
    ],
    "appliesWhen": [
      "複数ストリームを連結する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.node.stream-pipeline"
    ],
    "constructionProfile": {
      "kind": "ASYNC",
      "syntaxTemplate": "pipeline({streams})",
      "outputKinds": [
        "promise-expression"
      ],
      "slots": [
        {
          "name": "streams",
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
    "id": "code.node.process-argv",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsのコマンドライン引数を取得する",
    "summary": "process.argvによるCLI入力取得。",
    "concepts": [
      "process.argv",
      "CLI"
    ],
    "inputs": [],
    "outputs": [
      "array-expression"
    ],
    "appliesWhen": [
      "CLI引数を解析する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.node.process-argv"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "process.argv",
      "outputKinds": [
        "array-expression"
      ],
      "slots": [],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.node.process-exit-code",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsプロセスの終了コードを設定する",
    "summary": "process.exitCodeによる終了状態設定。",
    "concepts": [
      "process.exitCode",
      "exit code"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "CLIやバッチ処理の終了状態を示す"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.node.process-exit-code"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "process.exitCode = {code};",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "code",
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
    "id": "code.node.url",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.js URL APIを利用する",
    "summary": "URL標準APIによるURL操作。",
    "concepts": [
      "URL",
      "URLSearchParams"
    ],
    "inputs": [
      "string-expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "Node.js側でURLを解析・構成する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.node.url"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "new URL({value})",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "value",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.node.buffer",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Bufferを利用してバイト列を扱う",
    "summary": "Node.js Buffer API。",
    "concepts": [
      "Buffer",
      "bytes",
      "encoding"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "バイナリデータをNode.jsで扱う"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.node.buffer"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "Buffer.from({value})",
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
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  }

];

export const nodeRuntimeCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: "code.node-runtime.http-server",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node HTTP server",
    implementation: "const server = http.createServer({handler});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['http server'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.http-server",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.http-server\\ninputs=['input']\\noutputs=['http server']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const server = http.createServer({handler});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.http-server\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.http-request",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node HTTP request",
    implementation: "http.request({options}, {callback});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['http request'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.http-request",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.http-request\\ninputs=['input']\\noutputs=['http request']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=http.request({options}, {callback});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.http-request\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.https-request",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node HTTPS request",
    implementation: "https.request({options}, {callback});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['https request'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.https-request",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.https-request\\ninputs=['input']\\noutputs=['https request']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=https.request({options}, {callback});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.https-request\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.url-api",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node URL API",
    implementation: "new URL({input}, {base});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['url object'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.url-api",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.url-api\\ninputs=['input']\\noutputs=['url object']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=new URL({input}, {base});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.url-api\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.event-emitter",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node EventEmitter",
    implementation: "const {emitter} = new EventEmitter();",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['event emitter'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.event-emitter",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.event-emitter\\ninputs=['input']\\noutputs=['event emitter']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {emitter} = new EventEmitter();",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.event-emitter\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.stream-readable",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Readable stream",
    implementation: "Readable.from({source});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['readable stream'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.stream-readable",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.stream-readable\\ninputs=['input']\\noutputs=['readable stream']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=Readable.from({source});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.stream-readable\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.stream-writable",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Writable stream",
    implementation: "Writable.toWeb({stream});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['writable stream'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.stream-writable",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.stream-writable\\ninputs=['input']\\noutputs=['writable stream']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=Writable.toWeb({stream});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.stream-writable\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.stream-transform",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Transform stream",
    implementation: "new Transform({transform});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['transform stream'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.stream-transform",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.stream-transform\\ninputs=['input']\\noutputs=['transform stream']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=new Transform({transform});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.stream-transform\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.buffer",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node Buffer",
    implementation: "Buffer.from({value});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['buffer'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.buffer",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.buffer\\ninputs=['input']\\noutputs=['buffer']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=Buffer.from({value});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.buffer\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.os-info",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node OS information",
    implementation: "os.{operation}();",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['os value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.os-info",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.os-info\\ninputs=['input']\\noutputs=['os value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=os.{operation}();",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.os-info\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.util-promisify",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Promisify callback API",
    implementation: "promisify({function});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['async function'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.util-promisify",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.util-promisify\\ninputs=['input']\\noutputs=['async function']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=promisify({function});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.util-promisify\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.crypto-hash",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Cryptographic hash",
    implementation: "createHash({algorithm}).update({value}).digest({encoding});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['hash'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.crypto-hash",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.crypto-hash\\ninputs=['input']\\noutputs=['hash']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=createHash({algorithm}).update({value}).digest({encoding});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.crypto-hash\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.crypto-random",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Cryptographically secure random",
    implementation: "randomBytes({size});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['random bytes'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.crypto-random",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.crypto-random\\ninputs=['input']\\noutputs=['random bytes']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=randomBytes({size});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.crypto-random\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.child-process",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Child process execution",
    implementation: "execFile({command}, {args}, {callback});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['child process'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.child-process",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.child-process\\ninputs=['input']\\noutputs=['child process']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=execFile({command}, {args}, {callback});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.child-process\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.worker-thread",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Worker thread",
    implementation: "new Worker({filename});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['worker'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.worker-thread",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.worker-thread\\ninputs=['input']\\noutputs=['worker']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=new Worker({filename});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.worker-thread\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.zlib-compression",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Compression",
    implementation: "{compress}({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['compressed data'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.zlib-compression",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.zlib-compression\\ninputs=['input']\\noutputs=['compressed data']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={compress}({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.zlib-compression\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.readline",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Readline interface",
    implementation: "createInterface({input}, {output});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['readline interface'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.readline",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.readline\\ninputs=['input']\\noutputs=['readline interface']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=createInterface({input}, {output});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.readline\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.assert",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Node assertion",
    implementation: "assert.{method}({actual}, {expected});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['assertion'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.assert",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.assert\\ninputs=['input']\\noutputs=['assertion']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=assert.{method}({actual}, {expected});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.assert\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.node-runtime.timers-promises",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Promise timer",
    implementation: "await setTimeout({delay});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['promise'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.node-runtime.timers-promises",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.node-runtime.timers-promises\\ninputs=['input']\\noutputs=['promise']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=await setTimeout({delay});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.node-runtime.timers-promises\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.node-runtime.path-join',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'ファイルパスを安全に連結する',
    implementation: 'path.join({paths})',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['expression'],
    prerequisites: ['node:path'],
    dependencies: ['node:path'],
    supportedEnvironments: ['NODE'],
    entryPoint: 'path.join',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['node:path'],
    publicInterfaces: ['path.join'],
    tests: 'CONTRACT_TEST:code.node-runtime.path-join',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.node-runtime.path-join',
  },
  {
    knowledgeId: 'code.node-runtime.buffer-from',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '入力からBufferを構成する',
    implementation: 'Buffer.from({value})',
    targetPath: 'generated.ts',
    inputs: ['expression'],
    outputs: ['expression'],
    prerequisites: ['node:buffer'],
    dependencies: ['node:buffer'],
    supportedEnvironments: ['NODE'],
    entryPoint: 'Buffer.from',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['node:buffer'],
    publicInterfaces: ['Buffer.from'],
    tests: 'CONTRACT_TEST:code.node-runtime.buffer-from',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.node-runtime.buffer-from',
  },
  {
    knowledgeId: 'code.node-runtime.process-env',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '実行環境変数を読み取る',
    implementation: 'process.env.{name}',
    targetPath: 'generated.ts',
    inputs: ['identifier'],
    outputs: ['expression'],
    prerequisites: ['Node.js process'],
    dependencies: ['node:process'],
    supportedEnvironments: ['NODE'],
    entryPoint: 'process.env',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: ['node:process'],
    publicInterfaces: ['process.env'],
    tests: 'CONTRACT_TEST:code.node-runtime.process-env',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.node-runtime.process-env',
  },
  {
    "knowledgeId": "code.node.event-emitter",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "イベント購読を登録する",
    "implementation": "{emitter}.on({event}, {handler})",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
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
    "entryPoint": "CodeConstruction/code.node.event-emitter",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.event-emitter",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.event-emitter"
  },
  {
    "knowledgeId": "code.node.child-process-spawn",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsから子プロセスを生成する",
    "implementation": "spawn({command}, {args})",
    "targetPath": "generated.ts",
    "inputs": [
      "string-expression",
      "array-expression"
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
    "entryPoint": "CodeConstruction/code.node.child-process-spawn",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.child-process-spawn",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.child-process-spawn"
  },
  {
    "knowledgeId": "code.node.stream-pipeline",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "ストリームの入出力を連結する",
    "implementation": "pipeline({streams})",
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
    "entryPoint": "CodeConstruction/code.node.stream-pipeline",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.stream-pipeline",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.stream-pipeline"
  },
  {
    "knowledgeId": "code.node.process-argv",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsのコマンドライン引数を取得する",
    "implementation": "process.argv",
    "targetPath": "generated.ts",
    "inputs": [],
    "outputs": [
      "array-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.node.process-argv",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.process-argv",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.process-argv"
  },
  {
    "knowledgeId": "code.node.process-exit-code",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.jsプロセスの終了コードを設定する",
    "implementation": "process.exitCode = {code};",
    "targetPath": "generated.ts",
    "inputs": [
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
    "entryPoint": "CodeConstruction/code.node.process-exit-code",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.process-exit-code",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.process-exit-code"
  },
  {
    "knowledgeId": "code.node.url",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Node.js URL APIを利用する",
    "implementation": "new URL({value})",
    "targetPath": "generated.ts",
    "inputs": [
      "string-expression"
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
    "entryPoint": "CodeConstruction/code.node.url",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.url",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.url"
  },
  {
    "knowledgeId": "code.node.buffer",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Bufferを利用してバイト列を扱う",
    "implementation": "Buffer.from({value})",
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
    "entryPoint": "CodeConstruction/code.node.buffer",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.node.buffer",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.node.buffer"
  }

];

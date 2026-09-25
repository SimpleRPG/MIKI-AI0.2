import type { CodeComponentDefinition, CodeKnowledgeDefinition } from './common';

/**
 * Database / Persistence
 * Knowledge と直接再利用可能な CODE Component を同一カテゴリで管理する。
 * platformCodeKnowledge.ts から分離した静的な登録元。
 */
export const databasePersistenceCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
      id: 'code.database.sql-select',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'SQL SELECT',
      summary: 'SQL SELECTをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['SQL', 'sql-select'],
      inputs: ['input'],
      outputs: ['rows'],
      appliesWhen: ['database', 'sql-select'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'SELECT {columns} FROM {table} WHERE {condition};',
        outputKinds: ['rows'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.sql-insert',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'SQL INSERT',
      summary: 'SQL INSERTをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['SQL', 'sql-insert'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['database', 'sql-insert'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'INSERT INTO {table} ({columns}) VALUES ({values});',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.sql-update',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'SQL UPDATE',
      summary: 'SQL UPDATEをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['SQL', 'sql-update'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['database', 'sql-update'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'UPDATE {table} SET {assignments} WHERE {condition};',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.sql-delete',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'SQL DELETE',
      summary: 'SQL DELETEをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['SQL', 'sql-delete'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['database', 'sql-delete'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'DELETE FROM {table} WHERE {condition};',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.prepared-statement',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Prepared statement',
      summary: 'Prepared statementをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['prepared statement', 'prepared-statement'],
      inputs: ['input'],
      outputs: ['statement'],
      appliesWhen: ['database', 'prepared-statement'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {statement} = db.prepare({sql});',
        outputKinds: ['statement'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.parameter-binding',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Parameterized query',
      summary: 'Parameterized queryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['parameter binding', 'parameter-binding'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['database', 'parameter-binding'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{statement}.run({parameters});',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.transaction',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Database transaction',
      summary: 'Database transactionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['transaction', 'transaction'],
      inputs: ['input'],
      outputs: ['transaction result'],
      appliesWhen: ['database', 'transaction'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'db.transaction(() => { {body} })();',
        outputKinds: ['transaction result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.migration',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Schema migration',
      summary: 'Schema migrationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['migration', 'migration'],
      inputs: ['input'],
      outputs: ['migration result'],
      appliesWhen: ['database', 'migration'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'migration.{up}({database});',
        outputKinds: ['migration result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.index',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Database index',
      summary: 'Database indexをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['index', 'index'],
      inputs: ['input'],
      outputs: ['schema change'],
      appliesWhen: ['database', 'index'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'CREATE INDEX {name} ON {table} ({columns});',
        outputKinds: ['schema change'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.sqlite',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'SQLite connection',
      summary: 'SQLite connectionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['SQLite', 'sqlite'],
      inputs: ['input'],
      outputs: ['database'],
      appliesWhen: ['database', 'sqlite'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {database} = new Database({path});',
        outputKinds: ['database'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.postgres',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'PostgreSQL query',
      summary: 'PostgreSQL queryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['PostgreSQL', 'postgres'],
      inputs: ['input'],
      outputs: ['query result'],
      appliesWhen: ['database', 'postgres'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'await {client}.query({sql}, {parameters});',
        outputKinds: ['query result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.redis-kv',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Redis key value',
      summary: 'Redis key valueをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Redis', 'redis-kv'],
      inputs: ['input'],
      outputs: ['value'],
      appliesWhen: ['database', 'redis-kv'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'await {redis}.{operation}({key}, {value});',
        outputKinds: ['value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.database.repository-persistence',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Persistence repository',
      summary: 'Persistence repositoryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['repository', 'repository-persistence'],
      inputs: ['input'],
      outputs: ['entity/result'],
      appliesWhen: ['database', 'repository-persistence'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-database'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'await {repository}.{operation}({entity});',
        outputKinds: ['entity/result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
    "id": "code.database-persistence.transaction",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "複数DB操作を1トランザクションとして実行する",
    "summary": "汎用トランザクション境界。",
    "concepts": [
      "transaction",
      "atomicity",
      "rollback"
    ],
    "inputs": [
      "identifier",
      "function-expression"
    ],
    "outputs": [
      "promise-expression"
    ],
    "appliesWhen": [
      "複数永続化操作を原子的に扱う"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.database-persistence.transaction"
    ],
    "constructionProfile": {
      "kind": "ASYNC",
      "syntaxTemplate": "{db}.transaction(async (tx) => { {body} })",
      "outputKinds": [
        "promise-expression"
      ],
      "slots": [
        {
          "name": "db",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "body",
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
    "id": "code.database-persistence.upsert",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "存在時更新・未存在時作成を1操作として扱う",
    "summary": "汎用upsert操作。",
    "concepts": [
      "upsert",
      "insert",
      "update"
    ],
    "inputs": [
      "identifier",
      "expression"
    ],
    "outputs": [
      "promise-expression"
    ],
    "appliesWhen": [
      "キーの存在に応じて作成または更新する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.database-persistence.upsert"
    ],
    "constructionProfile": {
      "kind": "ASYNC",
      "syntaxTemplate": "{repository}.upsert({record})",
      "outputKinds": [
        "promise-expression"
      ],
      "slots": [
        {
          "name": "repository",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "record",
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
    "id": "code.database-persistence.pagination",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "大量データをページ単位で取得する",
    "summary": "limit/offset等によるページング。",
    "concepts": [
      "pagination",
      "limit",
      "offset",
      "cursor"
    ],
    "inputs": [
      "identifier",
      "expression"
    ],
    "outputs": [
      "promise-expression"
    ],
    "appliesWhen": [
      "大量データを分割取得する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.database-persistence.pagination"
    ],
    "constructionProfile": {
      "kind": "ASYNC",
      "syntaxTemplate": "{repository}.findPage({page})",
      "outputKinds": [
        "promise-expression"
      ],
      "slots": [
        {
          "name": "repository",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "page",
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

export const databasePersistenceCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: "code.database.sql-select",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "SQL SELECT",
    implementation: "SELECT {columns} FROM {table} WHERE {condition};",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['rows'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.sql-select",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.sql-select\\ninputs=['input']\\noutputs=['rows']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=SELECT {columns} FROM {table} WHERE {condition};",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.sql-select\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.sql-insert",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "SQL INSERT",
    implementation: "INSERT INTO {table} ({columns}) VALUES ({values});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.sql-insert",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.sql-insert\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=INSERT INTO {table} ({columns}) VALUES ({values});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.sql-insert\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.sql-update",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "SQL UPDATE",
    implementation: "UPDATE {table} SET {assignments} WHERE {condition};",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.sql-update",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.sql-update\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=UPDATE {table} SET {assignments} WHERE {condition};",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.sql-update\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.sql-delete",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "SQL DELETE",
    implementation: "DELETE FROM {table} WHERE {condition};",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.sql-delete",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.sql-delete\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=DELETE FROM {table} WHERE {condition};",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.sql-delete\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.prepared-statement",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Prepared statement",
    implementation: "const {statement} = db.prepare({sql});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['statement'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.prepared-statement",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.prepared-statement\\ninputs=['input']\\noutputs=['statement']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {statement} = db.prepare({sql});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.prepared-statement\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.parameter-binding",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Parameterized query",
    implementation: "{statement}.run({parameters});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.parameter-binding",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.parameter-binding\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={statement}.run({parameters});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.parameter-binding\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.transaction",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Database transaction",
    implementation: "db.transaction(() => { {body} })();",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['transaction result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.transaction",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.transaction\\ninputs=['input']\\noutputs=['transaction result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=db.transaction(() => { {body} })();",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.transaction\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.migration",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Schema migration",
    implementation: "migration.{up}({database});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['migration result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.migration",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.migration\\ninputs=['input']\\noutputs=['migration result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=migration.{up}({database});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.migration\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.index",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Database index",
    implementation: "CREATE INDEX {name} ON {table} ({columns});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['schema change'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.index",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.index\\ninputs=['input']\\noutputs=['schema change']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=CREATE INDEX {name} ON {table} ({columns});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.index\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.sqlite",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "SQLite connection",
    implementation: "const {database} = new Database({path});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['database'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.sqlite",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.sqlite\\ninputs=['input']\\noutputs=['database']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {database} = new Database({path});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.sqlite\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.postgres",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "PostgreSQL query",
    implementation: "await {client}.query({sql}, {parameters});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['query result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.postgres",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.postgres\\ninputs=['input']\\noutputs=['query result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=await {client}.query({sql}, {parameters});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.postgres\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.redis-kv",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Redis key value",
    implementation: "await {redis}.{operation}({key}, {value});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.redis-kv",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.redis-kv\\ninputs=['input']\\noutputs=['value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=await {redis}.{operation}({key}, {value});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.redis-kv\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.database.repository-persistence",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Persistence repository",
    implementation: "await {repository}.{operation}({entity});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['entity/result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.database.repository-persistence",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.database.repository-persistence\\ninputs=['input']\\noutputs=['entity/result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=await {repository}.{operation}({entity});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.database.repository-persistence\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    "knowledgeId": "code.database-persistence.transaction",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "トランザクション境界を構成する",
    "implementation": "{db}.transaction(async (tx) => { {body} })",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
      "function-expression"
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
    "entryPoint": "CodeConstruction/code.database-persistence.transaction",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.database-persistence.transaction",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.database-persistence.transaction"
  },
  {
    "knowledgeId": "code.database-persistence.upsert",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "upsert操作を構成する",
    "implementation": "{repository}.upsert({record})",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
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
    "entryPoint": "CodeConstruction/code.database-persistence.upsert",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.database-persistence.upsert",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.database-persistence.upsert"
  },
  {
    "knowledgeId": "code.database-persistence.pagination",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "ページングされた検索を構成する",
    "implementation": "{repository}.findPage({page})",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
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
    "entryPoint": "CodeConstruction/code.database-persistence.pagination",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.database-persistence.pagination",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.database-persistence.pagination"
  }

];

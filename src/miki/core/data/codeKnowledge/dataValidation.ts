import type { CodeComponentDefinition, CodeKnowledgeDefinition } from './common';

/**
 * Data / Validation / Serialization
 * Knowledge と直接再利用可能な CODE Component を同一カテゴリで管理する。
 * platformCodeKnowledge.ts から分離した静的な登録元。
 */
export const dataValidationCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
      id: 'code.data-validation.schema-definition',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Runtime schema',
      summary: 'Runtime schemaをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['schema', 'schema-definition'],
      inputs: ['input'],
      outputs: ['schema'],
      appliesWhen: ['data-validation', 'schema-definition'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {schema} = defineSchema({shape});',
        outputKinds: ['schema'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.runtime-validation',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Runtime validation',
      summary: 'Runtime validationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['validation', 'runtime-validation'],
      inputs: ['input'],
      outputs: ['validated data'],
      appliesWhen: ['data-validation', 'runtime-validation'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {result} = {schema}.parse({input});',
        outputKinds: ['validated data'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.safe-parse',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Safe parsing',
      summary: 'Safe parsingをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['validation', 'safe-parse'],
      inputs: ['input'],
      outputs: ['parse result'],
      appliesWhen: ['data-validation', 'safe-parse'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {result} = {schema}.safeParse({input});',
        outputKinds: ['parse result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.type-guard',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Runtime type guard',
      summary: 'Runtime type guardをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['type guard', 'type-guard'],
      inputs: ['input'],
      outputs: ['boolean'],
      appliesWhen: ['data-validation', 'type-guard'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'function is{Type}({value}) { return {condition}; }',
        outputKinds: ['boolean'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.normalization',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Data normalization',
      summary: 'Data normalizationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['normalization', 'normalization'],
      inputs: ['input'],
      outputs: ['normalized data'],
      appliesWhen: ['data-validation', 'normalization'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {normalized} = normalize({input});',
        outputKinds: ['normalized data'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.serialization',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Serialization',
      summary: 'SerializationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['serialization', 'serialization'],
      inputs: ['input'],
      outputs: ['string'],
      appliesWhen: ['data-validation', 'serialization'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'JSON.stringify({value});',
        outputKinds: ['string'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.deserialization',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Deserialization',
      summary: 'DeserializationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['deserialization', 'deserialization'],
      inputs: ['input'],
      outputs: ['value'],
      appliesWhen: ['data-validation', 'deserialization'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'JSON.parse({value});',
        outputKinds: ['value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.dto-transform',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'DTO transformation',
      summary: 'DTO transformationをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['DTO', 'dto-transform'],
      inputs: ['input'],
      outputs: ['DTO'],
      appliesWhen: ['data-validation', 'dto-transform'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {dto} = toDto({domain});',
        outputKinds: ['DTO'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.defaulting',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Default value resolution',
      summary: 'Default value resolutionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['defaulting', 'defaulting'],
      inputs: ['input'],
      outputs: ['value'],
      appliesWhen: ['data-validation', 'defaulting'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {result} = {value} ?? {defaultValue};',
        outputKinds: ['value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.coercion',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Input coercion',
      summary: 'Input coercionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['coercion', 'coercion'],
      inputs: ['input'],
      outputs: ['coerced value'],
      appliesWhen: ['data-validation', 'coercion'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {value} = coerce({input});',
        outputKinds: ['coerced value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.result-type',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Result success/failure',
      summary: 'Result success/failureをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Result', 'result-type'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['data-validation', 'result-type'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'return {ok: {success}, value: {value}};',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.data-validation.validation-error',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Validation error',
      summary: 'Validation errorをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['validation error', 'validation-error'],
      inputs: ['input'],
      outputs: ['error'],
      appliesWhen: ['data-validation', 'validation-error'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-data-validation'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'throw new ValidationError({message}, {issues});',
        outputKinds: ['error'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
    "id": "code.data-validation.safe-parse-result",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "例外を外へ投げず成功/失敗結果として扱う",
    "summary": "安全なparse結果の標準化。",
    "concepts": [
      "safe parse",
      "success",
      "failure"
    ],
    "inputs": [
      "function-expression",
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "入力解析の成功失敗を値として扱う"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.data-validation.safe-parse-result"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "(() => { try { return { success: true, data: ({parser})({input}) }; } catch (error) { return { success: false, error }; } })()",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "parser",
          "inputKinds": [
            "function-expression"
          ],
          "required": true
        },
        {
          "name": "input",
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
    "id": "code.data-validation.discriminated-union",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "判別キーで入力バリアントを検証する",
    "summary": "discriminated unionによる入力分岐。",
    "concepts": [
      "discriminator",
      "union",
      "validation"
    ],
    "inputs": [
      "expression",
      "string-expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "入力の種類を判別して適切な形を選択する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.data-validation.discriminated-union"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "switch ({value}.{key}) { {cases} }",
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
          "name": "key",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "cases",
          "inputKinds": [
            "statement"
          ],
          "required": true,
          "multiple": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.data-validation.coerce",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "入力値を検証前に安全な型へ変換する",
    "summary": "検証前のcoercion処理。",
    "concepts": [
      "coercion",
      "normalization",
      "validation"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "文字列等の入力を期待型へ正規化する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.data-validation.coerce"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "coerce({input})",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "input",
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
    "id": "code.data-validation.assert",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "検証失敗時に明示的に処理を停止する",
    "summary": "assertによる契約検証。",
    "concepts": [
      "assertion",
      "contract",
      "validation"
    ],
    "inputs": [
      "boolean-expression",
      "string-expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "必須条件を実行時に保証する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.data-validation.assert"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "assert({condition}, {message})",
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
          "name": "message",
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
    "id": "code.data-validation.normalize",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "入力値を検証可能な正規形へ整える",
    "summary": "入力正規化処理。",
    "concepts": [
      "normalization",
      "trim",
      "canonicalization"
    ],
    "inputs": [
      "expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "検証前の入力を正規化する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.data-validation.normalize"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "normalize({input})",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "input",
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

export const dataValidationCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: "code.data-validation.schema-definition",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Runtime schema",
    implementation: "const {schema} = defineSchema({shape});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['schema'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.schema-definition",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.schema-definition\\ninputs=['input']\\noutputs=['schema']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {schema} = defineSchema({shape});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.schema-definition\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.runtime-validation",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Runtime validation",
    implementation: "const {result} = {schema}.parse({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['validated data'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.runtime-validation",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.runtime-validation\\ninputs=['input']\\noutputs=['validated data']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {result} = {schema}.parse({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.runtime-validation\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.safe-parse",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Safe parsing",
    implementation: "const {result} = {schema}.safeParse({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['parse result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.safe-parse",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.safe-parse\\ninputs=['input']\\noutputs=['parse result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {result} = {schema}.safeParse({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.safe-parse\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.type-guard",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Runtime type guard",
    implementation: "function is{Type}({value}) { return {condition}; }",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['boolean'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.type-guard",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.type-guard\\ninputs=['input']\\noutputs=['boolean']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=function is{Type}({value}) { return {condition}; }",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.type-guard\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.normalization",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Data normalization",
    implementation: "const {normalized} = normalize({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['normalized data'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.normalization",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.normalization\\ninputs=['input']\\noutputs=['normalized data']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {normalized} = normalize({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.normalization\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.serialization",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Serialization",
    implementation: "JSON.stringify({value});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['string'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.serialization",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.serialization\\ninputs=['input']\\noutputs=['string']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=JSON.stringify({value});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.serialization\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.deserialization",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Deserialization",
    implementation: "JSON.parse({value});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.deserialization",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.deserialization\\ninputs=['input']\\noutputs=['value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=JSON.parse({value});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.deserialization\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.dto-transform",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "DTO transformation",
    implementation: "const {dto} = toDto({domain});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['DTO'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.dto-transform",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.dto-transform\\ninputs=['input']\\noutputs=['DTO']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {dto} = toDto({domain});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.dto-transform\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.defaulting",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Default value resolution",
    implementation: "const {result} = {value} ?? {defaultValue};",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.defaulting",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.defaulting\\ninputs=['input']\\noutputs=['value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {result} = {value} ?? {defaultValue};",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.defaulting\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.coercion",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Input coercion",
    implementation: "const {value} = coerce({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['coerced value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.coercion",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.coercion\\ninputs=['input']\\noutputs=['coerced value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {value} = coerce({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.coercion\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.result-type",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Result success/failure",
    implementation: "return {ok: {success}, value: {value}};",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.result-type",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.result-type\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=return {ok: {success}, value: {value}};",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.result-type\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.data-validation.validation-error",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Validation error",
    implementation: "throw new ValidationError({message}, {issues});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['error'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.data-validation.validation-error",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.data-validation.validation-error\\ninputs=['input']\\noutputs=['error']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=throw new ValidationError({message}, {issues});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.data-validation.validation-error\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    "knowledgeId": "code.data-validation.safe-parse-result",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "解析結果をResult形式へ包む",
    "implementation": "(() => { try { return { success: true, data: ({parser})({input}) }; } catch (error) { return { success: false, error }; } })()",
    "targetPath": "generated.ts",
    "inputs": [
      "function-expression",
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
    "entryPoint": "CodeConstruction/code.data-validation.safe-parse-result",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.data-validation.safe-parse-result",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.data-validation.safe-parse-result"
  },
  {
    "knowledgeId": "code.data-validation.discriminated-union",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "判別キーを使った入力検証を構成する",
    "implementation": "switch ({value}.{key}) { {cases} }",
    "targetPath": "generated.ts",
    "inputs": [
      "expression",
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
    "entryPoint": "CodeConstruction/code.data-validation.discriminated-union",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.data-validation.discriminated-union",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.data-validation.discriminated-union"
  },
  {
    "knowledgeId": "code.data-validation.coerce",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "入力値を検証前に安全な型へ変換する",
    "implementation": "coerce({input})",
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
    "entryPoint": "CodeConstruction/code.data-validation.coerce",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.data-validation.coerce",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.data-validation.coerce"
  },
  {
    "knowledgeId": "code.data-validation.assert",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "検証失敗時に明示的に処理を停止する",
    "implementation": "assert({condition}, {message})",
    "targetPath": "generated.ts",
    "inputs": [
      "boolean-expression",
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
    "entryPoint": "CodeConstruction/code.data-validation.assert",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.data-validation.assert",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.data-validation.assert"
  },
  {
    "knowledgeId": "code.data-validation.normalize",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "入力値を検証可能な正規形へ整える",
    "implementation": "normalize({input})",
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
    "entryPoint": "CodeConstruction/code.data-validation.normalize",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.data-validation.normalize",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.data-validation.normalize"
  }

];

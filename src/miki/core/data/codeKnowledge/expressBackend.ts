import type { CodeComponentDefinition, CodeKnowledgeDefinition } from './common';

/**
 * Express / Backend
 * Knowledge と直接再利用可能な CODE Component を同一カテゴリで管理する。
 * platformCodeKnowledge.ts から分離した静的な登録元。
 */
export const expressBackendCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
      id: 'code.backend.express-router',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express Router',
      summary: 'Express RouterをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'express-router'],
      inputs: ['input'],
      outputs: ['router'],
      appliesWhen: ['backend', 'express-router'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {router} = Router();',
        outputKinds: ['router'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.route-params',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express route parameters',
      summary: 'Express route parametersをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'route-params'],
      inputs: ['input'],
      outputs: ['route'],
      appliesWhen: ['backend', 'route-params'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'router.get({path}, {handler});',
        outputKinds: ['route'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.query-params',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express query parameters',
      summary: 'Express query parametersをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'query-params'],
      inputs: ['input'],
      outputs: ['value'],
      appliesWhen: ['backend', 'query-params'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{request}.query.{name}',
        outputKinds: ['value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.request-body',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express request body',
      summary: 'Express request bodyをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'request-body'],
      inputs: ['input'],
      outputs: ['value'],
      appliesWhen: ['backend', 'request-body'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{request}.body',
        outputKinds: ['value'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.request-headers',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express request headers',
      summary: 'Express request headersをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'request-headers'],
      inputs: ['input'],
      outputs: ['string'],
      appliesWhen: ['backend', 'request-headers'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{request}.get({name});',
        outputKinds: ['string'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.response-json',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express JSON response',
      summary: 'Express JSON responseをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'response-json'],
      inputs: ['input'],
      outputs: ['response'],
      appliesWhen: ['backend', 'response-json'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{response}.json({value});',
        outputKinds: ['response'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.response-status',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express status response',
      summary: 'Express status responseをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'response-status'],
      inputs: ['input'],
      outputs: ['response'],
      appliesWhen: ['backend', 'response-status'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{response}.status({status});',
        outputKinds: ['response'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.middleware',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express middleware',
      summary: 'Express middlewareをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'middleware'],
      inputs: ['input'],
      outputs: ['middleware'],
      appliesWhen: ['backend', 'middleware'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'router.use({middleware});',
        outputKinds: ['middleware'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.error-middleware',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Express error middleware',
      summary: 'Express error middlewareをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Express', 'error-middleware'],
      inputs: ['input'],
      outputs: ['middleware'],
      appliesWhen: ['backend', 'error-middleware'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'app.use((error, request, response, next) => { {body} });',
        outputKinds: ['middleware'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.cors',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'CORS middleware',
      summary: 'CORS middlewareをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['CORS', 'cors'],
      inputs: ['input'],
      outputs: ['middleware'],
      appliesWhen: ['backend', 'cors'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'app.use(cors({options}));',
        outputKinds: ['middleware'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.rate-limit',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Rate limiting middleware',
      summary: 'Rate limiting middlewareをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['rate limit', 'rate-limit'],
      inputs: ['input'],
      outputs: ['middleware'],
      appliesWhen: ['backend', 'rate-limit'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'app.use(rateLimit({options}));',
        outputKinds: ['middleware'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.backend-validation',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Request validation boundary',
      summary: 'Request validation boundaryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['validation', 'backend-validation'],
      inputs: ['input'],
      outputs: ['validated data'],
      appliesWhen: ['backend', 'backend-validation'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {validated} = validate({request});',
        outputKinds: ['validated data'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.controller-service',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Controller/service boundary',
      summary: 'Controller/service boundaryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['backend architecture', 'controller-service'],
      inputs: ['input'],
      outputs: ['result'],
      appliesWhen: ['backend', 'controller-service'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'return {service}.execute({input});',
        outputKinds: ['result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.backend.repository',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Repository boundary',
      summary: 'Repository boundaryをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['repository', 'repository'],
      inputs: ['input'],
      outputs: ['persistence result'],
      appliesWhen: ['backend', 'repository'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-backend'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'return {repository}.{operation}({input});',
        outputKinds: ['persistence result'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
    "id": "code.express.request-header",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "HTTPリクエストヘッダを取得する",
    "summary": "Express Request#getによるヘッダ取得。",
    "concepts": [
      "Request",
      "get",
      "header"
    ],
    "inputs": [
      "identifier",
      "string-expression"
    ],
    "outputs": [
      "string-expression"
    ],
    "appliesWhen": [
      "リクエストヘッダを読む"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.express.request-header"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "{request}.get({name})",
      "outputKinds": [
        "string-expression"
      ],
      "slots": [
        {
          "name": "request",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "name",
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
    "id": "code.express.route-params",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "ルートパラメータを取得する",
    "summary": "Express req.paramsの利用。",
    "concepts": [
      "params",
      "route parameter"
    ],
    "inputs": [
      "identifier",
      "string-expression"
    ],
    "outputs": [
      "expression"
    ],
    "appliesWhen": [
      "URLパスパラメータを利用する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.express.route-params"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "{request}.params.{name}",
      "outputKinds": [
        "expression"
      ],
      "slots": [
        {
          "name": "request",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "name",
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
    "id": "code.express.response-cookie",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "HTTPレスポンスCookieを設定する",
    "summary": "Express Response#cookieによるCookie設定。",
    "concepts": [
      "cookie",
      "Response",
      "httpOnly",
      "secure"
    ],
    "inputs": [
      "identifier",
      "string-expression",
      "expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "セッション等のCookieを設定する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.express.response-cookie"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "{response}.cookie({name}, {value}, {options})",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "response",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "name",
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
          "name": "options",
          "inputKinds": [
            "expression"
          ],
          "required": false
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.express.json-middleware",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "JSONリクエストボディを解析する",
    "summary": "Express JSON middleware。",
    "concepts": [
      "express.json",
      "middleware",
      "JSON"
    ],
    "inputs": [],
    "outputs": [
      "middleware-expression"
    ],
    "appliesWhen": [
      "JSON APIのリクエスト本文を解析する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.express.json-middleware"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "express.json()",
      "outputKinds": [
        "middleware-expression"
      ],
      "slots": [],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.express.response-status-send",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "HTTPステータスと本文を返す",
    "summary": "Response.status/sendによる応答。",
    "concepts": [
      "status",
      "send",
      "HTTP response"
    ],
    "inputs": [
      "identifier",
      "expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "HTTP APIレスポンスを明示する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.express.response-status-send"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "{response}.status({status}).send({body})",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "response",
          "inputKinds": [
            "identifier"
          ],
          "required": true
        },
        {
          "name": "status",
          "inputKinds": [
            "expression"
          ],
          "required": true
        },
        {
          "name": "body",
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
    "id": "code.express.static-middleware",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "静的ファイルを配信する",
    "summary": "Express static middleware。",
    "concepts": [
      "express.static",
      "static files"
    ],
    "inputs": [
      "string-expression"
    ],
    "outputs": [
      "middleware-expression"
    ],
    "appliesWhen": [
      "静的アセットを配信する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.express.static-middleware"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "express.static({root})",
      "outputKinds": [
        "middleware-expression"
      ],
      "slots": [
        {
          "name": "root",
          "inputKinds": [
            "string-expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  }

];

export const expressBackendCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: "code.backend.express-router",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express Router",
    implementation: "const {router} = Router();",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['router'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.express-router",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.express-router\\ninputs=['input']\\noutputs=['router']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {router} = Router();",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.express-router\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.route-params",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express route parameters",
    implementation: "router.get({path}, {handler});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['route'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.route-params",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.route-params\\ninputs=['input']\\noutputs=['route']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=router.get({path}, {handler});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.route-params\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.query-params",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express query parameters",
    implementation: "{request}.query.{name}",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.query-params",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.query-params\\ninputs=['input']\\noutputs=['value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={request}.query.{name}",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.query-params\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.request-body",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express request body",
    implementation: "{request}.body",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['value'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.request-body",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.request-body\\ninputs=['input']\\noutputs=['value']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={request}.body",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.request-body\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.request-headers",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express request headers",
    implementation: "{request}.get({name});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['string'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.request-headers",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.request-headers\\ninputs=['input']\\noutputs=['string']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={request}.get({name});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.request-headers\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.response-json",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express JSON response",
    implementation: "{response}.json({value});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['response'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.response-json",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.response-json\\ninputs=['input']\\noutputs=['response']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={response}.json({value});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.response-json\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.response-status",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express status response",
    implementation: "{response}.status({status});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['response'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.response-status",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.response-status\\ninputs=['input']\\noutputs=['response']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={response}.status({status});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.response-status\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.middleware",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express middleware",
    implementation: "router.use({middleware});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['middleware'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.middleware",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.middleware\\ninputs=['input']\\noutputs=['middleware']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=router.use({middleware});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.middleware\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.error-middleware",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Express error middleware",
    implementation: "app.use((error, request, response, next) => { {body} });",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['middleware'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.error-middleware",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.error-middleware\\ninputs=['input']\\noutputs=['middleware']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=app.use((error, request, response, next) => { {body} });",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.error-middleware\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.cors",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "CORS middleware",
    implementation: "app.use(cors({options}));",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['middleware'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.cors",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.cors\\ninputs=['input']\\noutputs=['middleware']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=app.use(cors({options}));",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.cors\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.rate-limit",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Rate limiting middleware",
    implementation: "app.use(rateLimit({options}));",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['middleware'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.rate-limit",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.rate-limit\\ninputs=['input']\\noutputs=['middleware']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=app.use(rateLimit({options}));",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.rate-limit\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.backend-validation",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Request validation boundary",
    implementation: "const {validated} = validate({request});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['validated data'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.backend-validation",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.backend-validation\\ninputs=['input']\\noutputs=['validated data']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {validated} = validate({request});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.backend-validation\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.controller-service",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Controller/service boundary",
    implementation: "return {service}.execute({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.controller-service",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.controller-service\\ninputs=['input']\\noutputs=['result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=return {service}.execute({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.controller-service\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.backend.repository",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Repository boundary",
    implementation: "return {repository}.{operation}({input});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['persistence result'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.backend.repository",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.backend.repository\\ninputs=['input']\\noutputs=['persistence result']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=return {repository}.{operation}({input});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.backend.repository\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.express.middleware',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Expressのリクエスト処理へmiddlewareを接続する',
    implementation: 'router.use({middleware});',
    targetPath: 'generated.ts',
    inputs: ['function-expression'],
    outputs: ['statement'],
    prerequisites: ['Express Router'],
    dependencies: ['express'],
    supportedEnvironments: ['NODE'],
    entryPoint: 'Router.use',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['express'],
    publicInterfaces: ['Router.use'],
    tests: 'CONTRACT_TEST:code.express.middleware',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.express.middleware',
  },
  {
    knowledgeId: 'code.express.error-middleware',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Expressのエラー処理middlewareを構成する',
    implementation: 'router.use(({error}, {request}, {response}, {next}) => {body});',
    targetPath: 'generated.ts',
    inputs: ['identifier', 'identifier', 'identifier', 'identifier', 'statement'],
    outputs: ['statement'],
    prerequisites: ['Express Router'],
    dependencies: ['express'],
    supportedEnvironments: ['NODE'],
    entryPoint: 'Router.use',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['express'],
    publicInterfaces: ['Router.use'],
    tests: 'CONTRACT_TEST:code.express.error-middleware',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.express.error-middleware',
  },
  {
    "knowledgeId": "code.express.request-header",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "HTTPリクエストヘッダを取得する",
    "implementation": "{request}.get({name})",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
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
    "entryPoint": "CodeConstruction/code.express.request-header",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.request-header",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.request-header"
  },
  {
    "knowledgeId": "code.express.route-params",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "ルートパラメータを取得する",
    "implementation": "{request}.params.{name}",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
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
    "entryPoint": "CodeConstruction/code.express.route-params",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.route-params",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.route-params"
  },
  {
    "knowledgeId": "code.express.response-cookie",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Cookieをレスポンスへ追加する",
    "implementation": "{response}.cookie({name}, {value}, {options})",
    "targetPath": "generated.ts",
    "inputs": [
      "identifier",
      "string-expression",
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
    "entryPoint": "CodeConstruction/code.express.response-cookie",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.response-cookie",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.response-cookie"
  },
  {
    "knowledgeId": "code.express.json-middleware",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "JSONリクエストボディを解析する",
    "implementation": "express.json()",
    "targetPath": "generated.ts",
    "inputs": [],
    "outputs": [
      "middleware-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.express.json-middleware",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.json-middleware",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.json-middleware"
  },
  {
    "knowledgeId": "code.express.response-status-send",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "HTTPステータスと本文を返す",
    "implementation": "{response}.status({status}).send({body})",
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
    "entryPoint": "CodeConstruction/code.express.response-status-send",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.response-status-send",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.response-status-send"
  },
  {
    "knowledgeId": "code.express.static-middleware",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "静的ファイルを配信する",
    "implementation": "express.static({root})",
    "targetPath": "generated.ts",
    "inputs": [
      "string-expression"
    ],
    "outputs": [
      "middleware-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.express.static-middleware",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.express.static-middleware",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.express.static-middleware"
  }

];

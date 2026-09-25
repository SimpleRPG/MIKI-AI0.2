import type { CodeComponentDefinition, CodeKnowledgeDefinition } from './common';

/**
 * React / UI / Accessibility
 * Knowledge と直接再利用可能な CODE Component を同一カテゴリで管理する。
 * platformCodeKnowledge.ts から分離した静的な登録元。
 */
export const reactUiAccessibilityCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
      id: 'code.react-ui.react-component',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React component',
      summary: 'React componentをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['React', 'react-component'],
      inputs: ['input'],
      outputs: ['React component'],
      appliesWhen: ['react-ui', 'react-component'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'function {name}({props}) { return {jsx}; }',
        outputKinds: ['React component'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.react-props',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React props',
      summary: 'React propsをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['React props', 'react-props'],
      inputs: ['input'],
      outputs: ['component'],
      appliesWhen: ['react-ui', 'react-props'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'function {name}({{props}}) { {body} }',
        outputKinds: ['component'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.react-state',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React state',
      summary: 'React stateをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['useState', 'react-state'],
      inputs: ['input'],
      outputs: ['state'],
      appliesWhen: ['react-ui', 'react-state'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const [{state}, set{State}] = useState({initial});',
        outputKinds: ['state'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.react-effect',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React effect',
      summary: 'React effectをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['useEffect', 'react-effect'],
      inputs: ['input'],
      outputs: ['effect'],
      appliesWhen: ['react-ui', 'react-effect'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'useEffect(() => { {body} }, [{dependencies}]);',
        outputKinds: ['effect'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.react-memo',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Memoized component',
      summary: 'Memoized componentをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['memo', 'react-memo'],
      inputs: ['input'],
      outputs: ['component'],
      appliesWhen: ['react-ui', 'react-memo'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'memo({component});',
        outputKinds: ['component'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.react-context',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React Context',
      summary: 'React ContextをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['Context', 'react-context'],
      inputs: ['input'],
      outputs: ['context'],
      appliesWhen: ['react-ui', 'react-context'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'const {context} = createContext({defaultValue});',
        outputKinds: ['context'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.custom-hook',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Custom React hook',
      summary: 'Custom React hookをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['React Hook', 'custom-hook'],
      inputs: ['input'],
      outputs: ['hook'],
      appliesWhen: ['react-ui', 'custom-hook'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'function use{Name}({params}) { {body} }',
        outputKinds: ['hook'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.form-ui',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'React form',
      summary: 'React formをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['form', 'form-ui'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'form-ui'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<form onSubmit={{handler}}>{{children}}</form>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.loading-state',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Loading state',
      summary: 'Loading stateをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['loading state', 'loading-state'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'loading-state'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{loading} ? <Loading /> : {content}',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.error-state',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Error state',
      summary: 'Error stateをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['error state', 'error-state'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'error-state'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{error} ? <ErrorView error={{error}} /> : {content}',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.empty-state',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Empty state',
      summary: 'Empty stateをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['empty state', 'empty-state'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'empty-state'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '{empty} ? <EmptyState /> : {content}',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.modal',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Modal/dialog',
      summary: 'Modal/dialogをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['dialog', 'modal'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'modal'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<dialog open={{open}}>{{children}}</dialog>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.table',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Data table',
      summary: 'Data tableをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['table', 'table'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'table'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<table>{{header}}{{rows}}</table>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.tabs',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Tabs UI',
      summary: 'Tabs UIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['tabs', 'tabs'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'tabs'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<Tabs value={{value}} onChange={{handler}} />',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.select',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Select UI',
      summary: 'Select UIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['select', 'select'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'select'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<select value={{value}} onChange={{handler}}>{{options}}</select>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.checkbox',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Checkbox UI',
      summary: 'Checkbox UIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['checkbox', 'checkbox'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'checkbox'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<input type="checkbox" checked={{checked}} onChange={{handler}} />',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.textarea',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Textarea UI',
      summary: 'Textarea UIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['textarea', 'textarea'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'textarea'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<textarea value={{value}} onChange={{handler}} />',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.responsive-layout',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Responsive layout',
      summary: 'Responsive layoutをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['responsive layout', 'responsive-layout'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'responsive-layout'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<div className={{className}}>{{children}}</div>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.keyboard-interaction',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Keyboard interaction',
      summary: 'Keyboard interactionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['keyboard', 'keyboard-interaction'],
      inputs: ['input'],
      outputs: ['event handler'],
      appliesWhen: ['react-ui', 'keyboard-interaction'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: 'onKeyDown={{handler}}',
        outputKinds: ['event handler'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.accessibility',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'Accessible UI',
      summary: 'Accessible UIをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['accessibility', 'accessibility'],
      inputs: ['input'],
      outputs: ['accessible JSX'],
      appliesWhen: ['react-ui', 'accessibility'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<button aria-label={{label}}>{{children}}</button>',
        outputKinds: ['accessible JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
      id: 'code.react-ui.ui-animation',
      componentType: 'CODE_PLATFORM_KNOWLEDGE',
      purpose: 'UI transition',
      summary: 'UI transitionをMIKIの汎用コード構築語彙として扱う。',
      concepts: ['animation', 'ui-animation'],
      inputs: ['input'],
      outputs: ['JSX'],
      appliesWhen: ['react-ui', 'ui-animation'],
      doesNotApplyWhen: [],
      sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      sourceArtifactIds: ['platform-catalog-react-ui'],
      constructionProfile: {
        kind: 'CALL',
        syntaxTemplate: '<div className={{transitionClass}}>{{children}}</div>',
        outputKinds: ['JSX'],
        slots: [
          {name: 'input', inputKinds: ['expression'], required: true},
        ],
        constraints: ['Use the canonical API or architecture represented by this knowledge item.'],
        adaptationRules: ['Adapt arguments and surrounding syntax to the target project contract.'],
      },
    },
  {
    "id": "code.react-ui.memo",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "不要な再レンダーを避けるためコンポーネントをメモ化する",
    "summary": "React.memoによるコンポーネントメモ化。",
    "concepts": [
      "React.memo",
      "memoization",
      "props"
    ],
    "inputs": [
      "component-expression"
    ],
    "outputs": [
      "component-expression"
    ],
    "appliesWhen": [
      "propsが同一なら再利用したいコンポーネント"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.react-ui.memo"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "memo({component})",
      "outputKinds": [
        "component-expression"
      ],
      "slots": [
        {
          "name": "component",
          "inputKinds": [
            "component-expression"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.react-ui.use-layout-effect",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "DOM反映直前の副作用処理を構成する",
    "summary": "useLayoutEffectによる同期的レイアウト副作用。",
    "concepts": [
      "useLayoutEffect",
      "layout",
      "effect"
    ],
    "inputs": [
      "function-expression"
    ],
    "outputs": [
      "statement"
    ],
    "appliesWhen": [
      "DOM計測やレイアウト同期が必要なUI"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.react-ui.use-layout-effect"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "useLayoutEffect({effect}, [{dependencies}])",
      "outputKinds": [
        "statement"
      ],
      "slots": [
        {
          "name": "effect",
          "inputKinds": [
            "function-expression"
          ],
          "required": true
        },
        {
          "name": "dependencies",
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
    "id": "code.react-ui.controlled-input",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Reactのcontrolled inputを構成する",
    "summary": "value/onChangeによる入力値制御。",
    "concepts": [
      "controlled input",
      "value",
      "onChange"
    ],
    "inputs": [
      "expression",
      "function-expression"
    ],
    "outputs": [
      "jsx-child"
    ],
    "appliesWhen": [
      "入力値をReact state等で制御する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "generated-code.react-ui.controlled-input"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "<input value={value} onChange={onChange} />",
      "outputKinds": [
        "jsx-child"
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
          "name": "onChange",
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
    "id": "code.react-ui.list-key",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Reactリスト要素へ安定したkeyを付与する",
    "summary": "リストレンダリングの識別キー。",
    "concepts": [
      "key",
      "list rendering",
      "identity"
    ],
    "inputs": [
      "expression",
      "jsx-child"
    ],
    "outputs": [
      "jsx-child"
    ],
    "appliesWhen": [
      "配列からUIリストを生成する"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.react-ui.list-key"
    ],
    "constructionProfile": {
      "kind": "STATEMENT",
      "syntaxTemplate": "<>{items}</>",
      "outputKinds": [
        "jsx-child"
      ],
      "slots": [
        {
          "name": "items",
          "inputKinds": [
            "jsx-child"
          ],
          "required": true
        }
      ],
      "constraints": [],
      "adaptationRules": []
    }
  },
  {
    "id": "code.react-ui.lazy",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "コンポーネントを遅延ロードする",
    "summary": "React.lazyによるcode splitting。",
    "concepts": [
      "React.lazy",
      "lazy loading",
      "Suspense"
    ],
    "inputs": [
      "function-expression"
    ],
    "outputs": [
      "component-expression"
    ],
    "appliesWhen": [
      "大きなUI部品を遅延ロードする"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.react-ui.lazy"
    ],
    "constructionProfile": {
      "kind": "EXPRESSION",
      "syntaxTemplate": "lazy({loader})",
      "outputKinds": [
        "component-expression"
      ],
      "slots": [
        {
          "name": "loader",
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
    "id": "code.react-ui.use-id",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "アクセシビリティ用の安定したIDを生成する",
    "summary": "useIdによる一意ID生成。",
    "concepts": [
      "useId",
      "accessibility",
      "id"
    ],
    "inputs": [],
    "outputs": [
      "string-expression"
    ],
    "appliesWhen": [
      "labelとinput等を安定したIDで関連付ける"
    ],
    "doesNotApplyWhen": [],
    "sourceUrls": [
      "https://developer.mozilla.org/"
    ],
    "sourceArtifactIds": [
      "construction-code.react-ui.use-id"
    ],
    "constructionProfile": {
      "kind": "CALL",
      "syntaxTemplate": "useId()",
      "outputKinds": [
        "string-expression"
      ],
      "slots": [],
      "constraints": [],
      "adaptationRules": []
    }
  }

];

export const reactUiAccessibilityCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: "code.react-ui.react-component",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React component",
    implementation: "function {name}({props}) { return {jsx}; }",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['React component'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-component",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-component\\ninputs=['input']\\noutputs=['React component']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=function {name}({props}) { return {jsx}; }",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-component\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.react-props",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React props",
    implementation: "function {name}({{props}}) { {body} }",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['component'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-props",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-props\\ninputs=['input']\\noutputs=['component']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=function {name}({{props}}) { {body} }",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-props\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.react-state",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React state",
    implementation: "const [{state}, set{State}] = useState({initial});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['state'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-state",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-state\\ninputs=['input']\\noutputs=['state']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const [{state}, set{State}] = useState({initial});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-state\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.react-effect",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React effect",
    implementation: "useEffect(() => { {body} }, [{dependencies}]);",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['effect'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-effect",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-effect\\ninputs=['input']\\noutputs=['effect']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=useEffect(() => { {body} }, [{dependencies}]);",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-effect\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.react-memo",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Memoized component",
    implementation: "memo({component});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['component'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-memo",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-memo\\ninputs=['input']\\noutputs=['component']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=memo({component});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-memo\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.react-context",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React Context",
    implementation: "const {context} = createContext({defaultValue});",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['context'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.react-context",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.react-context\\ninputs=['input']\\noutputs=['context']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=const {context} = createContext({defaultValue});",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.react-context\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.custom-hook",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Custom React hook",
    implementation: "function use{Name}({params}) { {body} }",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['hook'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.custom-hook",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.custom-hook\\ninputs=['input']\\noutputs=['hook']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=function use{Name}({params}) { {body} }",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.custom-hook\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.form-ui",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "React form",
    implementation: "<form onSubmit={{handler}}>{{children}}</form>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.form-ui",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.form-ui\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<form onSubmit={{handler}}>{{children}}</form>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.form-ui\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.loading-state",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Loading state",
    implementation: "{loading} ? <Loading /> : {content}",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.loading-state",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.loading-state\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={loading} ? <Loading /> : {content}",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.loading-state\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.error-state",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Error state",
    implementation: "{error} ? <ErrorView error={{error}} /> : {content}",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.error-state",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.error-state\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={error} ? <ErrorView error={{error}} /> : {content}",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.error-state\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.empty-state",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Empty state",
    implementation: "{empty} ? <EmptyState /> : {content}",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.empty-state",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.empty-state\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template={empty} ? <EmptyState /> : {content}",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.empty-state\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.modal",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Modal/dialog",
    implementation: "<dialog open={{open}}>{{children}}</dialog>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.modal",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.modal\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<dialog open={{open}}>{{children}}</dialog>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.modal\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.table",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Data table",
    implementation: "<table>{{header}}{{rows}}</table>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.table",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.table\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<table>{{header}}{{rows}}</table>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.table\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.tabs",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Tabs UI",
    implementation: "<Tabs value={{value}} onChange={{handler}} />",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.tabs",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.tabs\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<Tabs value={{value}} onChange={{handler}} />",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.tabs\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.select",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Select UI",
    implementation: "<select value={{value}} onChange={{handler}}>{{options}}</select>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.select",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.select\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<select value={{value}} onChange={{handler}}>{{options}}</select>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.select\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.checkbox",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Checkbox UI",
    implementation: "<input type=\"checkbox\" checked={{checked}} onChange={{handler}} />",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.checkbox",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.checkbox\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<input type=\"checkbox\" checked={{checked}} onChange={{handler}} />",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.checkbox\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.textarea",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Textarea UI",
    implementation: "<textarea value={{value}} onChange={{handler}} />",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.textarea",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.textarea\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<textarea value={{value}} onChange={{handler}} />",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.textarea\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.responsive-layout",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Responsive layout",
    implementation: "<div className={{className}}>{{children}}</div>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.responsive-layout",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.responsive-layout\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<div className={{className}}>{{children}}</div>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.responsive-layout\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.keyboard-interaction",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Keyboard interaction",
    implementation: "onKeyDown={{handler}}",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['event handler'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.keyboard-interaction",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.keyboard-interaction\\ninputs=['input']\\noutputs=['event handler']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=onKeyDown={{handler}}",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.keyboard-interaction\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.accessibility",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "Accessible UI",
    implementation: "<button aria-label={{label}}>{{children}}</button>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['accessible JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.accessibility",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.accessibility\\ninputs=['input']\\noutputs=['accessible JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<button aria-label={{label}}>{{children}}</button>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.accessibility\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: "code.react-ui.ui-animation",
    componentType: 'CODE_CONSTRUCTION',
    purpose: "UI transition",
    implementation: "<div className={{transitionClass}}>{{children}}</div>",
    targetPath: 'generated.ts',
    inputs: ['input'],
    outputs: ['JSX'],
    prerequisites: ['Use the canonical API or architecture represented by this knowledge item.'],
    dependencies: [],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: "CodeConstruction/code.react-ui.ui-animation",
    securityClass: 'READ_ONLY',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\\nknowledge=code.react-ui.ui-animation\\ninputs=['input']\\noutputs=['JSX']\\nprerequisites=constructionProfile.constraints\\nimplementation_template=<div className={{transitionClass}}>{{children}}</div>",
    validation: "VALIDATION_SPEC:\\nknowledge=code.react-ui.ui-animation\\nrequiredValidation=['Use the canonical API or architecture represented by this knowledge item.']\\ndependencies=[]\\nsupportedEnvironments=['MIKI_RUNTIME','ANDROID']\\ninitialStatus=CANDIDATE\\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },

  {
    knowledgeId: 'code.react-ui.use-reducer',
    componentType: 'CODE_CONSTRUCTION',
    purpose: '複雑なUI状態をreducerで管理する',
    implementation: 'const [{stateName}, {dispatchName}] = useReducer({reducer}, {initialState});',
    targetPath: 'generated.tsx',
    inputs: ['identifier', 'identifier', 'function-expression', 'expression'],
    outputs: ['statement'],
    prerequisites: ['React useReducer'],
    dependencies: ['react'],
    supportedEnvironments: ['BROWSER', 'ANDROID'],
    entryPoint: 'useReducer',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['useReducer'],
    publicInterfaces: ['useReducer'],
    tests: 'CONTRACT_TEST:code.react-ui.use-reducer',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.react-ui.use-reducer',
  },
  {
    knowledgeId: 'code.react-ui.use-ref',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'DOMまたは永続的な参照値を保持する',
    implementation: 'const {name} = useRef({initialValue});',
    targetPath: 'generated.tsx',
    inputs: ['identifier', 'expression'],
    outputs: ['statement'],
    prerequisites: ['React useRef'],
    dependencies: ['react'],
    supportedEnvironments: ['BROWSER', 'ANDROID'],
    entryPoint: 'useRef',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['useRef'],
    publicInterfaces: ['useRef'],
    tests: 'CONTRACT_TEST:code.react-ui.use-ref',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.react-ui.use-ref',
  },
  {
    knowledgeId: 'code.react-ui.use-context',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'React Contextから共有値を取得する',
    implementation: 'const {name} = useContext({context});',
    targetPath: 'generated.tsx',
    inputs: ['identifier', 'expression'],
    outputs: ['statement'],
    prerequisites: ['React useContext'],
    dependencies: ['react'],
    supportedEnvironments: ['BROWSER', 'ANDROID'],
    entryPoint: 'useContext',
    securityClass: 'STANDARD',
    exports: [],
    imports: ['useContext'],
    publicInterfaces: ['useContext'],
    tests: 'CONTRACT_TEST:code.react-ui.use-context',
    validation: 'VALIDATE_CODE_CONSTRUCTION:code.react-ui.use-context',
  },
  {
    "knowledgeId": "code.react-ui.memo",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "コンポーネントをメモ化する",
    "implementation": "memo({component})",
    "targetPath": "generated.ts",
    "inputs": [
      "component-expression"
    ],
    "outputs": [
      "component-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.react-ui.memo",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.memo",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.memo"
  },
  {
    "knowledgeId": "code.react-ui.use-layout-effect",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "レイアウト効果を登録する",
    "implementation": "useLayoutEffect({effect}, [{dependencies}])",
    "targetPath": "generated.ts",
    "inputs": [
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
    "entryPoint": "CodeConstruction/code.react-ui.use-layout-effect",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.use-layout-effect",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.use-layout-effect"
  },
  {
    "knowledgeId": "code.react-ui.controlled-input",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "controlled inputを構成する",
    "implementation": "<input value={value} onChange={onChange} />",
    "targetPath": "generated.ts",
    "inputs": [
      "expression",
      "function-expression"
    ],
    "outputs": [
      "jsx-child"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.react-ui.controlled-input",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.controlled-input",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.controlled-input"
  },
  {
    "knowledgeId": "code.react-ui.list-key",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "Reactリスト要素へ安定したkeyを付与する",
    "implementation": "<>{items}</>",
    "targetPath": "generated.ts",
    "inputs": [
      "expression",
      "jsx-child"
    ],
    "outputs": [
      "jsx-child"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.react-ui.list-key",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.list-key",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.list-key"
  },
  {
    "knowledgeId": "code.react-ui.lazy",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "コンポーネントを遅延ロードする",
    "implementation": "lazy({loader})",
    "targetPath": "generated.ts",
    "inputs": [
      "function-expression"
    ],
    "outputs": [
      "component-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.react-ui.lazy",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.lazy",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.lazy"
  },
  {
    "knowledgeId": "code.react-ui.use-id",
    "componentType": "CODE_CONSTRUCTION",
    "purpose": "アクセシビリティ用の安定したIDを生成する",
    "implementation": "useId()",
    "targetPath": "generated.ts",
    "inputs": [],
    "outputs": [
      "string-expression"
    ],
    "prerequisites": [],
    "dependencies": [],
    "supportedEnvironments": [
      "ANDROID",
      "MIKI_RUNTIME"
    ],
    "entryPoint": "CodeConstruction/code.react-ui.use-id",
    "securityClass": "READ_ONLY",
    "exports": [],
    "imports": [],
    "publicInterfaces": [],
    "tests": "CONTRACT_TEST:code.react-ui.use-id",
    "validation": "VALIDATE_CODE_CONSTRUCTION:code.react-ui.use-id"
  }

];

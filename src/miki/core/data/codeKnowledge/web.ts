import type { CodeKnowledgeDefinition, CodeComponentDefinition } from './common';

export const webCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.web.fetch',
    componentType: 'WEB_API_CONCEPT',
    purpose: 'Fetch APIでHTTPリソースを取得する',
    summary: 'fetchはPromiseを返し、Responseを受け取った後に本文を解析する。HTTPエラーを成功HTTP応答と区別して扱う必要がある。',
    concepts: ['fetch', 'Request', 'Response', 'Promise', 'HTTP', 'CORS'],
    inputs: ['URL', 'Request options'],
    outputs: ['Response'],
    appliesWhen: ['HTTP通信', 'API呼び出し', 'Webリソース取得'],
    doesNotApplyWhen: ['ローカル計算だけで完結する処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
    sourceArtifactIds: ['mdn-fetch-api'],
  },
  {
    id: 'code.web.http-status',
    componentType: 'WEB_API_CONCEPT',
    purpose: 'HTTPステータスを結果判定に利用する',
    summary: 'ネットワーク通信成功とアプリケーション上の成功を混同せず、Responseの状態を確認して処理を分岐する。',
    concepts: ['HTTP status', 'Response.ok', 'client error', 'server error'],
    inputs: ['Response'],
    outputs: ['validated HTTP result'],
    appliesWhen: ['API通信', '外部サービス連携'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
    sourceArtifactIds: ['mdn-fetch-api'],
  },
  {
    id: 'code.web.request-response',
    componentType: 'WEB_API_CONCEPT',
    purpose: 'RequestとResponseを境界としてWeb通信を設計する',
    summary: '通信入力と通信結果を明示的なデータ境界として扱い、本文解析とエラー処理を分離する。',
    concepts: ['Request', 'Response', 'headers', 'body', 'JSON'],
    inputs: ['request'],
    outputs: ['response data'],
    appliesWhen: ['Web API設計', '外部データ取得'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
    sourceArtifactIds: ['mdn-fetch-api'],
  },
  {
    id: 'code.web.dom-events',
    componentType: 'WEB_API_CONCEPT',
    purpose: 'DOMイベントをUI入力と処理の境界として扱う',
    summary: 'イベント発生と処理を分離し、イベントハンドラからドメイン処理へ明示的に値を渡す。',
    concepts: ['DOM', 'event', 'event handler', 'target', 'listener'],
    inputs: ['DOM event'],
    outputs: ['application action'],
    appliesWhen: ['ブラウザUI', 'ユーザー操作'],
    doesNotApplyWhen: ['非UIバックエンド処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener'],
    sourceArtifactIds: ['mdn-eventtarget-listener'],
  },
  {
    id: 'code.web.api-boundary',
    componentType: 'WEB_ARCHITECTURE_CONCEPT',
    purpose: '外部APIとの境界を内部ドメイン処理から分離する',
    summary: '外部通信形式をそのまま内部ロジックへ流さず、入力検証と変換を境界で行う。',
    concepts: ['adapter', 'validation', 'DTO', 'external API', 'domain boundary'],
    inputs: ['external response'],
    outputs: ['validated domain input'],
    appliesWhen: ['外部API連携', 'サービス統合'],
    doesNotApplyWhen: ['完全に内部だけの処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
    sourceArtifactIds: ['mdn-fetch-api'],
  }
];

export const additionalWebCodeKnowledge: CodeKnowledgeDefinition[] = [
  {
    id: 'code.web.json',
    componentType: 'WEB_DATA_CONCEPT',
    purpose: 'JSONをWeb APIのデータ交換形式として安全に扱う',
    summary: 'JSON文字列とJavaScript値の変換を明示し、外部データを内部契約へ変換してから利用する。',
    concepts: ['JSON', 'JSON.parse', 'JSON.stringify', 'validation'],
    inputs: ['JSON text'],
    outputs: ['JavaScript value'],
    appliesWhen: ['API', '設定ファイル', 'データ交換'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON'],
    sourceArtifactIds: ['mdn-json'],
  },
  {
    id: 'code.web.abort-controller',
    componentType: 'WEB_API_CONCEPT',
    purpose: '不要になった非同期Webリクエストをキャンセルする',
    summary: 'AbortControllerとAbortSignalを利用してFetchなどの処理をキャンセル可能にする。',
    concepts: ['AbortController', 'AbortSignal', 'cancel', 'fetch'],
    inputs: ['async operation'],
    outputs: ['cancelable operation'],
    appliesWhen: ['検索', '画面遷移', 'タイムアウト', '不要リクエスト'],
    doesNotApplyWhen: ['キャンセルが不要な処理'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/AbortController'],
    sourceArtifactIds: ['mdn-abort-controller'],
  },
  {
    id: 'code.web.url-search-params',
    componentType: 'WEB_API_CONCEPT',
    purpose: 'URLのquery parameterを安全に構成する',
    summary: 'URLSearchParamsを利用してquery stringのエンコードと構築を明示的に行う。',
    concepts: ['URLSearchParams', 'query string', 'encoding'],
    inputs: ['parameter map'],
    outputs: ['encoded query string'],
    appliesWhen: ['GET API', '検索URL', 'ページング'],
    doesNotApplyWhen: ['request bodyだけで送る場合'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams'],
    sourceArtifactIds: ['mdn-url-search-params'],
  },
  {
    id: 'code.web-cors-boundary',
    componentType: 'WEB_SECURITY_CONCEPT',
    purpose: 'ブラウザのオリジン境界を考慮してAPI連携を設計する',
    summary: 'CORSはブラウザのオリジン間アクセス制御に関係するため、クライアントコードだけで解決できない境界を区別する。',
    concepts: ['CORS', 'origin', 'Access-Control-Allow-Origin', 'browser security'],
    inputs: ['cross-origin request'],
    outputs: ['allowed or blocked browser request'],
    appliesWhen: ['Web API', '別Originへの通信'],
    doesNotApplyWhen: ['同一Originのみの通信'],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS'],
    sourceArtifactIds: ['mdn-cors'],
  },
  {
    id: 'code.web-http-methods',
    componentType: 'WEB_PROTOCOL_CONCEPT',
    purpose: 'HTTPメソッドを操作意図に応じて選択する',
    summary: 'GET、POST、PUT、PATCH、DELETEなどをリソース操作の意味に合わせて使い分ける。',
    concepts: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HTTP'],
    inputs: ['operation intent'],
    outputs: ['HTTP request method'],
    appliesWhen: ['REST API', 'Web service'],
    doesNotApplyWhen: [],
    sourceUrls: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods'],
    sourceArtifactIds: ['mdn-http-methods'],
  },

  {
        id: 'code.web.fetch-request',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'HTTPリソースをFetch APIで取得する',
        summary: 'fetchによるHTTPリクエスト開始。',
        concepts: ['fetch', 'HTTP', 'Promise', 'Request'],
        inputs: ['url-expression'],
        outputs: ['promise-expression'],
        appliesWhen: ['HTTPリソースを取得する'],
        doesNotApplyWhen: ['ネットワークアクセスが許可されていない'],
        sourceUrls: ['https://developer.mozilla.org/ja/docs/Web/JavaScript/API/Fetch_API'],
        sourceArtifactIds: ['mdn-fetch-api'],
        constructionProfile: {
          kind: 'CALL',
          syntaxTemplate: 'fetch({url})',
          outputKinds: ['promise-expression'],
          slots: [
            { name: 'url', inputKinds: ['string-expression'], required: true },
          ],
          constraints: ['network policy must permit the request'],
          adaptationRules: ['add RequestInit only when required by the target contract'],
        },
      },
  {
        id: 'code.web.react-function-component',
        componentType: 'CODE_CONSTRUCTION',
        purpose: 'Reactの関数コンポーネントを構成する',
        summary: 'React公式ドキュメントの関数コンポーネント構造。',
        concepts: ['React', 'component', 'JSX', 'props'],
        inputs: ['identifier', 'jsx-expression'],
        outputs: ['statement'],
        appliesWhen: ['React UIコンポーネントを構成する'],
        doesNotApplyWhen: ['Reactを使用しない処理'],
        sourceUrls: ['https://react.dev/learn/your-first-component'],
        sourceArtifactIds: ['react-your-first-component'],
        constructionProfile: {
          kind: 'DECLARATION',
          syntaxTemplate: 'function {name}() {\\n  return ({body});\\n}',
          outputKinds: ['statement'],
          slots: [
            { name: 'name', inputKinds: ['identifier'], required: true },
            { name: 'body', inputKinds: ['jsx-expression'], required: true },
          ],
          constraints: ['component must return renderable JSX'],
          adaptationRules: ['add props parameter when component contract requires it'],
        },
      },
{
  id: "code.web.jsx-text",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX text nodeを構成する",
  summary: "React UI内に表示する静的テキスト。",
  concepts: ["JSX", "text", "UI"],
  inputs: ["expression"],
  outputs: ["string-expression"],
  appliesWhen: ["ラベル", "説明"],
  doesNotApplyWhen: ["ロジックだけのUI"],
  sourceUrls: ["https://react.dev/learn/writing-markup-with-jsx"],
  sourceArtifactIds: ["react-jsx-text"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{text}", outputKinds: ["string-expression"], slots: [{ name: "text", inputKinds: ["string-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.jsx-attribute",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX attributeを構成する",
  summary: "コンポーネントやDOM要素へpropsを渡すattribute。",
  concepts: ["JSX", "attribute", "props"],
  inputs: ["identifier", "expression"],
  outputs: ["jsx-attribute"],
  appliesWhen: ["props", "DOM property"],
  doesNotApplyWhen: ["不要な属性"],
  sourceUrls: ["https://react.dev/learn/writing-markup-with-jsx"],
  sourceArtifactIds: ["react-jsx-attribute"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{name}={value}", outputKinds: ["jsx-attribute"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "value", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.jsx-element",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX elementを構成する",
  summary: "タグとattributeとchildrenからUI要素を構成する。",
  concepts: ["JSX", "element", "children"],
  inputs: ["identifier", "jsx-attribute", "jsx-child"],
  outputs: ["jsx-expression"],
  appliesWhen: ["UI構造"],
  doesNotApplyWhen: ["非UI処理"],
  sourceUrls: ["https://react.dev/learn/writing-markup-with-jsx"],
  sourceArtifactIds: ["react-jsx-element"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "<{name} {attributes}>{children}</{name}>", outputKinds: ["jsx-expression"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "attributes", inputKinds: ["jsx-attribute"], required: false, multiple: true }, { name: "children", inputKinds: ["jsx-child"], required: false, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.jsx-fragment",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX Fragmentを構成する",
  summary: "余分なDOM要素を増やさず複数childrenをまとめる。",
  concepts: ["JSX", "Fragment", "children"],
  inputs: ["jsx-child"],
  outputs: ["jsx-expression"],
  appliesWhen: ["複数UI要素のグループ"],
  doesNotApplyWhen: ["単一要素"],
  sourceUrls: ["https://react.dev/reference/react/Fragment"],
  sourceArtifactIds: ["react-jsx-fragment"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "<>{children}</>", outputKinds: ["jsx-expression"], slots: [{ name: "children", inputKinds: ["jsx-child"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-component-props",
  componentType: "CODE_CONSTRUCTION",
  purpose: "props付きReact関数コンポーネントを構成する",
  summary: "型付きpropsを受け取るReact component。",
  concepts: ["React", "component", "props", "TSX"],
  inputs: ["identifier", "type-expression", "jsx-expression"],
  outputs: ["statement"],
  appliesWhen: ["再利用UI", "設定可能UI"],
  doesNotApplyWhen: ["props不要UI"],
  sourceUrls: ["https://react.dev/learn/passing-props-to-a-component"],
  sourceArtifactIds: ["react-component-props"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "function {name}(props: {propsType}) {\\n  return ({body});\\n}", outputKinds: ["statement"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }, { name: "propsType", inputKinds: ["type-expression"], required: true, multiple: false }, { name: "body", inputKinds: ["jsx-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-state",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useState hookを構成する",
  summary: "UI stateとsetterを作る。",
  concepts: ["React", "useState", "state", "hook"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["フォーム", "UI state"],
  doesNotApplyWhen: ["サーバー永続状態"],
  sourceUrls: ["https://react.dev/reference/react/useState"],
  sourceArtifactIds: ["react-use-state"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useState({initialValue})", outputKinds: ["expression"], slots: [{ name: "initialValue", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-effect",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useEffect hookを構成する",
  summary: "外部システム同期や副作用処理を構成する。",
  concepts: ["React", "useEffect", "effect", "hook"],
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["副作用", "subscription"],
  doesNotApplyWhen: ["純粋計算"],
  sourceUrls: ["https://react.dev/reference/react/useEffect"],
  sourceArtifactIds: ["react-use-effect"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useEffect({effect}, {dependencies})", outputKinds: ["expression"], slots: [{ name: "effect", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "dependencies", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-memo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useMemo hookを構成する",
  summary: "高コスト計算結果を依存関係付きでmemoizeする。",
  concepts: ["React", "useMemo", "memoization"],
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["派生値計算"],
  doesNotApplyWhen: ["単純計算"],
  sourceUrls: ["https://react.dev/reference/react/useMemo"],
  sourceArtifactIds: ["react-use-memo"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useMemo({factory}, {dependencies})", outputKinds: ["expression"], slots: [{ name: "factory", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "dependencies", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-callback",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useCallback hookを構成する",
  summary: "依存関係付きcallbackを保持する。",
  concepts: ["React", "useCallback", "callback"],
  inputs: ["function-expression", "expression"],
  outputs: ["function-expression"],
  appliesWhen: ["callback identity"],
  doesNotApplyWhen: ["不要なcallback保持"],
  sourceUrls: ["https://react.dev/reference/react/useCallback"],
  sourceArtifactIds: ["react-use-callback"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useCallback({callback}, {dependencies})", outputKinds: ["function-expression"], slots: [{ name: "callback", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "dependencies", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-ref",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useRef hookを構成する",
  summary: "再renderを引き起こさず値やDOM参照を保持する。",
  concepts: ["React", "useRef", "ref"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["DOM ref", "mutable handle"],
  doesNotApplyWhen: ["state更新"],
  sourceUrls: ["https://react.dev/reference/react/useRef"],
  sourceArtifactIds: ["react-use-ref"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useRef({initialValue})", outputKinds: ["expression"], slots: [{ name: "initialValue", inputKinds: ["expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-context",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useContext hookを構成する",
  summary: "Contextから共有値を取得する。",
  concepts: ["React", "useContext", "context"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["共有状態", "依存注入"],
  doesNotApplyWhen: ["局所状態"],
  sourceUrls: ["https://react.dev/reference/react/useContext"],
  sourceArtifactIds: ["react-use-context"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useContext({context})", outputKinds: ["expression"], slots: [{ name: "context", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-use-reducer",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useReducer hookを構成する",
  summary: "複雑なUI state transitionをreducerで管理する。",
  concepts: ["React", "useReducer", "reducer"],
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  appliesWhen: ["複雑なstate machine"],
  doesNotApplyWhen: ["単純state"],
  sourceUrls: ["https://react.dev/reference/react/useReducer"],
  sourceArtifactIds: ["react-use-reducer"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "useReducer({reducer}, {initialState})", outputKinds: ["expression"], slots: [{ name: "reducer", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "initialState", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-event-handler",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React event handlerを構成する",
  summary: "UI eventから処理を呼び出すfunction expression。",
  concepts: ["React", "event", "handler", "callback"],
  inputs: ["parameter", "statement"],
  outputs: ["function-expression"],
  appliesWhen: ["click", "change", "submit"],
  doesNotApplyWhen: ["イベント不要"],
  sourceUrls: ["https://react.dev/learn/responding-to-events"],
  sourceArtifactIds: ["react-event-handler"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "({event}) => {\\n{body}\\n}", outputKinds: ["function-expression"], slots: [{ name: "event", inputKinds: ["parameter"], required: true, multiple: false }, { name: "body", inputKinds: ["statement"], required: true, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-conditional-render",
  componentType: "CODE_CONSTRUCTION",
  purpose: "条件付きUIを構成する",
  summary: "条件に応じて異なるJSXをrenderする。",
  concepts: ["React", "conditional rendering", "JSX"],
  inputs: ["boolean-expression", "jsx-expression"],
  outputs: ["jsx-expression"],
  appliesWhen: ["表示切替", "loading", "error"],
  doesNotApplyWhen: ["常時表示"],
  sourceUrls: ["https://react.dev/learn/conditional-rendering"],
  sourceArtifactIds: ["react-conditional-render"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{condition} ? {whenTrue} : {whenFalse}", outputKinds: ["jsx-expression"], slots: [{ name: "condition", inputKinds: ["boolean-expression"], required: true, multiple: false }, { name: "whenTrue", inputKinds: ["jsx-expression"], required: true, multiple: false }, { name: "whenFalse", inputKinds: ["jsx-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-list-render",
  componentType: "CODE_CONSTRUCTION",
  purpose: "配列からUI listをrenderする",
  summary: "items.mapから複数JSX要素を生成する。",
  concepts: ["React", "list rendering", "map", "JSX"],
  inputs: ["array-expression", "identifier", "jsx-expression"],
  outputs: ["jsx-expression"],
  appliesWhen: ["list", "table", "cards"],
  doesNotApplyWhen: ["単一要素表示"],
  sourceUrls: ["https://react.dev/learn/rendering-lists"],
  sourceArtifactIds: ["react-list-render"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "{items}.map(({item}) => ({body}))", outputKinds: ["jsx-expression"], slots: [{ name: "items", inputKinds: ["array-expression"], required: true, multiple: false }, { name: "item", inputKinds: ["identifier"], required: true, multiple: false }, { name: "body", inputKinds: ["jsx-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-form",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React formを構成する",
  summary: "submit handler付きform UI。",
  concepts: ["React", "form", "submit", "JSX"],
  inputs: ["function-expression", "jsx-child"],
  outputs: ["jsx-expression"],
  appliesWhen: ["入力フォーム"],
  doesNotApplyWhen: ["表示だけのUI"],
  sourceUrls: ["https://react.dev/reference/react-dom/components/form"],
  sourceArtifactIds: ["react-form"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "<form onSubmit={handler}>{body}</form>", outputKinds: ["jsx-expression"], slots: [{ name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "body", inputKinds: ["jsx-child"], required: false, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-input",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React input elementを構成する",
  summary: "valueとchange handlerを持つ入力UI。",
  concepts: ["React", "input", "form", "controlled input"],
  inputs: ["expression", "function-expression"],
  outputs: ["jsx-expression"],
  appliesWhen: ["フォーム入力"],
  doesNotApplyWhen: ["表示専用"],
  sourceUrls: ["https://react.dev/reference/react-dom/components/input"],
  sourceArtifactIds: ["react-input"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "<input value={value} onChange={handler} />", outputKinds: ["jsx-expression"], slots: [{ name: "value", inputKinds: ["expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-button",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React button elementを構成する",
  summary: "click handlerを持つbutton UI。",
  concepts: ["React", "button", "event", "JSX"],
  inputs: ["function-expression", "jsx-child"],
  outputs: ["jsx-expression"],
  appliesWhen: ["操作ボタン"],
  doesNotApplyWhen: ["入力だけ"],
  sourceUrls: ["https://react.dev/reference/react-dom/components/button"],
  sourceArtifactIds: ["react-button"],
  constructionProfile: { kind: "EXPRESSION", syntaxTemplate: "<button onClick={handler}>{body}</button>", outputKinds: ["jsx-expression"], slots: [{ name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }, { name: "body", inputKinds: ["jsx-child"], required: false, multiple: true }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.react-memo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React memoによるcomponent最適化境界",
  summary: "props比較による再render抑制を構成する。",
  concepts: ["React", "memo", "optimization"],
  inputs: ["expression"],
  outputs: ["expression"],
  appliesWhen: ["再render最適化"],
  doesNotApplyWhen: ["初期構築段階で不要な最適化"],
  sourceUrls: ["https://react.dev/reference/react/memo"],
  sourceArtifactIds: ["react-memo"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "memo({component})", outputKinds: ["expression"], slots: [{ name: "component", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-app",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express applicationを構成する",
  summary: "Node.js HTTP server applicationの基本app。",
  concepts: ["Express", "Node.js", "server"],
  inputs: ["identifier"],
  outputs: ["expression"],
  appliesWhen: ["API server"],
  doesNotApplyWhen: ["browser-only UI"],
  sourceUrls: ["https://expressjs.com/en/starter/hello-world.html"],
  sourceArtifactIds: ["express-app"],
  constructionProfile: { kind: "DECLARATION", syntaxTemplate: "const {name} = express();", outputKinds: ["expression"], slots: [{ name: "name", inputKinds: ["identifier"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-route-get",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express GET routeを構成する",
  summary: "GET requestをhandlerへ接続する。",
  concepts: ["Express", "routing", "GET"],
  inputs: ["string-expression", "function-expression"],
  outputs: ["statement"],
  appliesWhen: ["API GET"],
  doesNotApplyWhen: ["POST操作"],
  sourceUrls: ["https://expressjs.com/en/guide/routing.html"],
  sourceArtifactIds: ["express-route-get"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "app.get({path}, {handler})", outputKinds: ["statement"], slots: [{ name: "path", inputKinds: ["string-expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-route-post",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express POST routeを構成する",
  summary: "POST requestをhandlerへ接続する。",
  concepts: ["Express", "routing", "POST"],
  inputs: ["string-expression", "function-expression"],
  outputs: ["statement"],
  appliesWhen: ["API command", "data submission"],
  doesNotApplyWhen: ["GET参照"],
  sourceUrls: ["https://expressjs.com/en/guide/routing.html"],
  sourceArtifactIds: ["express-route-post"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "app.post({path}, {handler})", outputKinds: ["statement"], slots: [{ name: "path", inputKinds: ["string-expression"], required: true, multiple: false }, { name: "handler", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-middleware",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express middlewareを接続する",
  summary: "request処理前後のmiddlewareを登録する。",
  concepts: ["Express", "middleware", "request pipeline"],
  inputs: ["function-expression"],
  outputs: ["statement"],
  appliesWhen: ["認証", "logging", "validation"],
  doesNotApplyWhen: ["middleware不要"],
  sourceUrls: ["https://expressjs.com/en/guide/using-middleware.html"],
  sourceArtifactIds: ["express-middleware"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "app.use({middleware})", outputKinds: ["statement"], slots: [{ name: "middleware", inputKinds: ["function-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-json",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express JSON body parserを接続する",
  summary: "JSON request bodyを扱えるmiddleware。",
  concepts: ["Express", "json", "body parser"],
  inputs: [],
  outputs: ["statement"],
  appliesWhen: ["API JSON入力"],
  doesNotApplyWhen: ["multipart入力だけ"],
  sourceUrls: ["https://expressjs.com/en/api.html#express.json"],
  sourceArtifactIds: ["express-json"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "app.use(express.json())", outputKinds: ["statement"], slots: [], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-response-json",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express responseをJSONで返す",
  summary: "API結果をJSON responseとして返す。",
  concepts: ["Express", "response", "JSON"],
  inputs: ["expression"],
  outputs: ["statement"],
  appliesWhen: ["API response"],
  doesNotApplyWhen: ["HTML response"],
  sourceUrls: ["https://expressjs.com/en/api.html#res.json"],
  sourceArtifactIds: ["express-response-json"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "res.json({body})", outputKinds: ["statement"], slots: [{ name: "body", inputKinds: ["expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-response-status",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express response statusを設定する",
  summary: "HTTP status codeを明示してresponseを返す。",
  concepts: ["Express", "HTTP", "status"],
  inputs: ["number-expression"],
  outputs: ["expression"],
  appliesWhen: ["error response", "success response"],
  doesNotApplyWhen: ["status不要"],
  sourceUrls: ["https://expressjs.com/en/api.html#res.status"],
  sourceArtifactIds: ["express-response-status"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "res.status({status})", outputKinds: ["expression"], slots: [{ name: "status", inputKinds: ["number-expression"], required: true, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  id: "code.web.express-listen",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express serverを指定portでlistenする",
  summary: "HTTP server起動境界。",
  concepts: ["Express", "listen", "server"],
  inputs: ["number-expression", "function-expression"],
  outputs: ["statement"],
  appliesWhen: ["server startup"],
  doesNotApplyWhen: ["library-only module"],
  sourceUrls: ["https://expressjs.com/en/api.html#app.listen"],
  sourceArtifactIds: ["express-listen"],
  constructionProfile: { kind: "CALL", syntaxTemplate: "app.listen({port}, {callback})", outputKinds: ["statement"], slots: [{ name: "port", inputKinds: ["number-expression"], required: true, multiple: false }, { name: "callback", inputKinds: ["function-expression"], required: false, multiple: false }], constraints: ["inputs must satisfy the construction contract"], adaptationRules: ["prefer the simplest compatible construction"] },
},

{
  "id": "code.web.react-use-state-functional-update",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "useStateのfunctional updateを構成する",
  "summary": "useStateのfunctional updateを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "use",
    "state",
    "functional",
    "update",
    "identifier",
    "expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "useStateのfunctional updateを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-use-state-functional-update"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "set{setter}(previous => {nextValue})",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "setter",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "nextValue",
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
  "id": "code.web.react-use-effect-empty-deps",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "mount相当でEffectを一度実行する",
  "summary": "mount相当でEffectを一度実行する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "use",
    "effect",
    "empty",
    "deps",
    "statement"
  ],
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "mount相当でEffectを一度実行する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-use-effect-empty-deps"
  ],
  "constructionProfile": {
    "kind": "ASYNC",
    "syntaxTemplate": "useEffect(() => {\\n{body}\\n}, []);",
    "outputKinds": [
      "statement"
    ],
    "slots": [
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
  "id": "code.web.react-use-memo-value",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "useMemoで計算値をmemoizeする",
  "summary": "useMemoで計算値をmemoizeする。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "use",
    "memo",
    "value",
    "identifier",
    "expression",
    "statement"
  ],
  "inputs": [
    "identifier",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "useMemoで計算値をmemoizeする"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-use-memo-value"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "const {name} = useMemo(() => {value}, [{dependencies}]);",
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
          "expression"
        ],
        "required": true
      },
      {
        "name": "dependencies",
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.web.react-div",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "基本的なdiv JSX要素を構成する",
  "summary": "基本的なdiv JSX要素を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "div",
    "jsx-attribute",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "jsx-attribute",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "基本的なdiv JSX要素を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-div"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<div {attributes}>{children}</div>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "attributes",
        "inputKinds": [
          "jsx-attribute"
        ],
        "required": false,
        "multiple": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
        ],
        "required": false,
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
  "id": "code.web.react-span",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "基本的なspan JSX要素を構成する",
  "summary": "基本的なspan JSX要素を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "span",
    "jsx-attribute",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "jsx-attribute",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "基本的なspan JSX要素を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-span"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<span {attributes}>{children}</span>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "attributes",
        "inputKinds": [
          "jsx-attribute"
        ],
        "required": false,
        "multiple": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
        ],
        "required": false,
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
  "id": "code.web.react-image",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "alt属性付き画像JSXを構成する",
  "summary": "alt属性付き画像JSXを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "image",
    "string-expression",
    "jsx-expression"
  ],
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "alt属性付き画像JSXを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-image"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<img src={src} alt={alt} />",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "src",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "alt",
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
  "id": "code.web.react-anchor",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "リンクJSX要素を構成する",
  "summary": "リンクJSX要素を構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "anchor",
    "string-expression",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "string-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "リンクJSX要素を構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-anchor"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<a href={href}>{children}</a>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "href",
        "inputKinds": [
          "string-expression"
        ],
        "required": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
        ],
        "required": false,
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
  "id": "code.web.react-form-submit",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React formのsubmit handlerを構成する",
  "summary": "React formのsubmit handlerを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "form",
    "submit",
    "function-expression",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "function-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "React formのsubmit handlerを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/learn"
  ],
  "sourceArtifactIds": [
    "react:code.web.react-form-submit"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<form onSubmit={handler}>{children}</form>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "handler",
        "inputKinds": [
          "function-expression"
        ],
        "required": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
        ],
        "required": false,
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
  "id": "code.web.express-router-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "RouterへHTTP GET routeを登録する",
  "summary": "RouterへHTTP GET routeを登録する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "router",
    "route",
    "string-expression",
    "function-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "RouterへHTTP GET routeを登録する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-router-route"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "router.get({path}, {handler});",
    "outputKinds": [
      "statement"
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
        "name": "handler",
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
  "id": "code.web.express-request-header",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express request headerを取得する",
  "summary": "Express request headerを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "request",
    "header",
    "string-expression"
  ],
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "appliesWhen": [
    "Express request headerを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-request-header"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "req.get({name})",
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.web.express-response-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response Content-Typeを設定する",
  "summary": "Express response Content-Typeを設定する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "response",
    "type",
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
    "Express response Content-Typeを設定する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-response-type"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "res.type({type})",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "type",
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
  "id": "code.web.express-response-cookie",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response cookieを設定する",
  "summary": "Express response cookieを設定する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "response",
    "cookie",
    "string-expression",
    "expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express response cookieを設定する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-response-cookie"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "res.cookie({name}, {value});",
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
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.web.express-status-send",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response statusとsendを組み合わせる",
  "summary": "Express response statusとsendを組み合わせる。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "status",
    "send",
    "number-expression",
    "expression",
    "statement"
  ],
  "inputs": [
    "number-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express response statusとsendを組み合わせる"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-status-send"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "res.status({status}).send({body});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "status",
        "inputKinds": [
          "number-expression"
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
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse compatible existing nodes before creating an equivalent node"
    ]
  }
},

{
  "id": "code.web.express-static",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Expressで静的ファイル配信middlewareを登録する",
  "summary": "Expressで静的ファイル配信middlewareを登録する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "static",
    "string-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Expressで静的ファイル配信middlewareを登録する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-static"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "app.use({path}, express.static({directory}));",
    "outputKinds": [
      "statement"
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
        "name": "directory",
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
  "id": "code.web.express-router-use",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express Routerをmiddlewareとして接続する",
  "summary": "Express Routerをmiddlewareとして接続する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "router",
    "use",
    "string-expression",
    "identifier",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "identifier"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express Routerをmiddlewareとして接続する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://expressjs.com/en/guide/"
  ],
  "sourceArtifactIds": [
    "express:code.web.express-router-use"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "app.use({path}, {router});",
    "outputKinds": [
      "statement"
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
        "name": "router",
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
  "id": "code.web.react-use-id",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React useIdを構成する",
  "summary": "React useIdを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "use",
    "id",
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
    "React useIdを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-use-id"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "const {name} = useId();",
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
  "id": "code.web.react-custom-hook",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "custom hookを構成する",
  "summary": "custom hookを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "custom",
    "hook",
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
    "custom hookを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-custom-hook"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "function {name}({parameters}) {\\n{body}\\n}",
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
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.web.react-context-provider",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Context Providerを構成する",
  "summary": "Context Providerを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "context",
    "provider",
    "identifier",
    "expression",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "identifier",
    "expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "Context Providerを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-context-provider"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<{context}.Provider value={{value}}>{children}</{context}.Provider>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "context",
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
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
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
  "id": "code.web.react-fragment",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React Fragmentを構成する",
  "summary": "React Fragmentを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "fragment",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "React Fragmentを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-fragment"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<>{children}</>",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
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
  "id": "code.web.react-textarea",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "textarea JSXを構成する",
  "summary": "textarea JSXを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "textarea",
    "expression",
    "function-expression",
    "jsx-expression"
  ],
  "inputs": [
    "expression",
    "function-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "textarea JSXを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-textarea"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<textarea value={value} onChange={handler} />",
    "outputKinds": [
      "jsx-expression"
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
        "name": "handler",
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
  "id": "code.web.react-select",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "select JSXを構成する",
  "summary": "select JSXを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "select",
    "expression",
    "function-expression",
    "jsx-child",
    "jsx-expression"
  ],
  "inputs": [
    "expression",
    "function-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "select JSXを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-select"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<select value={value} onChange={handler}>{children}</select>",
    "outputKinds": [
      "jsx-expression"
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
        "name": "handler",
        "inputKinds": [
          "function-expression"
        ],
        "required": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-child"
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
  "id": "code.web.react-checkbox",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "checkbox JSXを構成する",
  "summary": "checkbox JSXを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "checkbox",
    "boolean-expression",
    "function-expression",
    "jsx-expression"
  ],
  "inputs": [
    "boolean-expression",
    "function-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "checkbox JSXを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-checkbox"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "<input type=\"checkbox\" checked={checked} onChange={handler} />",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "checked",
        "inputKinds": [
          "boolean-expression"
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
    "constraints": [
      "inputs must satisfy the declared construction contract"
    ],
    "adaptationRules": [
      "reuse an existing compatible construction node before creating an equivalent one"
    ]
  }
},
{
  "id": "code.web.react-conditional",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "条件付きJSXを構成する",
  "summary": "条件付きJSXを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "conditional",
    "boolean-expression",
    "jsx-expression"
  ],
  "inputs": [
    "boolean-expression",
    "jsx-expression",
    "jsx-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "条件付きJSXを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-conditional"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "{condition} ? {whenTrue} : {whenFalse}",
    "outputKinds": [
      "jsx-expression"
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
          "jsx-expression"
        ],
        "required": true
      },
      {
        "name": "whenFalse",
        "inputKinds": [
          "jsx-expression"
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
  "id": "code.web.react-list-map",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ArrayをJSX listへ変換する",
  "summary": "ArrayをJSX listへ変換する。既存Construction Graphで再利用する。",
  "concepts": [
    "react",
    "list",
    "map",
    "array-expression",
    "jsx-expression"
  ],
  "inputs": [
    "array-expression",
    "jsx-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "appliesWhen": [
    "ArrayをJSX listへ変換する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.react-list-map"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "{items}.map(({item}) => {children})",
    "outputKinds": [
      "jsx-expression"
    ],
    "slots": [
      {
        "name": "items",
        "inputKinds": [
          "array-expression"
        ],
        "required": true
      },
      {
        "name": "item",
        "inputKinds": [
          "identifier"
        ],
        "required": true
      },
      {
        "name": "children",
        "inputKinds": [
          "jsx-expression"
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
  "id": "code.web.express-post-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express POST routeを登録する",
  "summary": "Express POST routeを登録する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "post",
    "route",
    "string-expression",
    "function-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express POST routeを登録する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-post-route"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "router.post({path}, {handler});",
    "outputKinds": [
      "statement"
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
        "name": "handler",
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
  "id": "code.web.express-put-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express PUT routeを登録する",
  "summary": "Express PUT routeを登録する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "put",
    "route",
    "string-expression",
    "function-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express PUT routeを登録する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-put-route"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "router.put({path}, {handler});",
    "outputKinds": [
      "statement"
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
        "name": "handler",
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
  "id": "code.web.express-delete-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express DELETE routeを登録する",
  "summary": "Express DELETE routeを登録する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "delete",
    "route",
    "string-expression",
    "function-expression",
    "statement"
  ],
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express DELETE routeを登録する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-delete-route"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "router.delete({path}, {handler});",
    "outputKinds": [
      "statement"
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
        "name": "handler",
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
  "id": "code.web.express-request-params",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express route paramsを取得する",
  "summary": "Express route paramsを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "request",
    "params",
    "identifier",
    "expression"
  ],
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "expression"
  ],
  "appliesWhen": [
    "Express route paramsを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-request-params"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "req.params.{name}",
    "outputKinds": [
      "expression"
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
  "id": "code.web.express-request-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express query parameterを取得する",
  "summary": "Express query parameterを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "request",
    "query",
    "identifier",
    "expression"
  ],
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "expression"
  ],
  "appliesWhen": [
    "Express query parameterを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-request-query"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "req.query.{name}",
    "outputKinds": [
      "expression"
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
  "id": "code.web.express-request-body",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express request bodyを取得する",
  "summary": "Express request bodyを取得する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "request",
    "body",
    "expression"
  ],
  "inputs": [],
  "outputs": [
    "expression"
  ],
  "appliesWhen": [
    "Express request bodyを取得する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-request-body"
  ],
  "constructionProfile": {
    "kind": "EXPRESSION",
    "syntaxTemplate": "req.body",
    "outputKinds": [
      "expression"
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
  "id": "code.web.express-next",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express middleware chainを次へ進める",
  "summary": "Express middleware chainを次へ進める。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "next",
    "expression",
    "statement"
  ],
  "inputs": [
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "appliesWhen": [
    "Express middleware chainを次へ進める"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-next"
  ],
  "constructionProfile": {
    "kind": "CALL",
    "syntaxTemplate": "next({error});",
    "outputKinds": [
      "statement"
    ],
    "slots": [
      {
        "name": "error",
        "inputKinds": [
          "expression"
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
  "id": "code.web.express-error-middleware",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express error middlewareを構成する",
  "summary": "Express error middlewareを構成する。既存Construction Graphで再利用する。",
  "concepts": [
    "express",
    "error",
    "middleware",
    "identifier",
    "statement",
    "function-expression"
  ],
  "inputs": [
    "identifier",
    "statement"
  ],
  "outputs": [
    "function-expression"
  ],
  "appliesWhen": [
    "Express error middlewareを構成する"
  ],
  "doesNotApplyWhen": [],
  "sourceUrls": [
    "https://react.dev/reference/react"
  ],
  "sourceArtifactIds": [
    "web:code.web.express-error-middleware"
  ],
  "constructionProfile": {
    "kind": "DECLARATION",
    "syntaxTemplate": "({error}, req, res, next) => {\\n{body}\\n}",
    "outputKinds": [
      "function-expression"
    ],
    "slots": [
      {
        "name": "error",
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
}
];

export const additionalWebCodeComponents: CodeComponentDefinition[] = [
  {
    knowledgeId: 'code.web.fetch-request',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'HTTPリソースをFetch APIで取得する',
    implementation: 'fetch({url})',
    targetPath: 'generated.ts',
    inputs: ['url-expression'],
    outputs: ['promise-expression'],
    prerequisites: ['network permission', 'valid URL expression'],
    dependencies: ['Fetch API'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.web.fetch-request',
    securityClass: 'STANDARD',
    exports: [],
    imports: [],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.web.fetch-request\ninputs=['url-expression']\noutputs=['promise-expression']\nprerequisites=['network permission', 'valid URL expression']\nimplementation_template='fetch({url})'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['URL contract', 'network policy']\ndependencies=['Fetch API']\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
  {
    knowledgeId: 'code.web.react-function-component',
    componentType: 'CODE_CONSTRUCTION',
    purpose: 'Reactの関数コンポーネントを構成する',
    implementation: 'function {name}() {\\n  return ({body});\\n}',
    targetPath: 'generated.tsx',
    inputs: ['identifier', 'jsx-expression'],
    outputs: ['statement'],
    prerequisites: ['React runtime', 'JSX-compatible target'],
    dependencies: ['react'],
    supportedEnvironments: ['MIKI_RUNTIME', 'ANDROID'],
    entryPoint: 'CodeConstruction/code.web.react-function-component',
    securityClass: 'READ_ONLY',
    exports: [],
    imports: ['react'],
    publicInterfaces: [],
    tests: "CONTRACT_TEST_SPEC:\nknowledge=code.web.react-function-component\ninputs=['identifier', 'jsx-expression']\noutputs=['statement']\nprerequisites=['React runtime', 'JSX-compatible target']\nimplementation_template='function {name}() {\\\\n  return ({body});\\\\n}'",
    validation: "VALIDATION_SPEC:\nrequiredValidation=['JSX syntax', 'React component contract']\ndependencies=['react']\nsupportedEnvironments=['MIKI_RUNTIME', 'ANDROID']\ninitialStatus=CANDIDATE\nverificationRequired=ANALYZED,CLOUD_TESTED,DEVICE_TESTED,VERIFIED",
  },
{
  knowledgeId: "code.web.jsx-text",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX text nodeを構成する",
  implementation: "{text}",
  targetPath: "generated.tsx",
  inputs: ["expression"],
  outputs: ["string-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.jsx-text",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.jsx-text",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.jsx-text",
},

{
  knowledgeId: "code.web.jsx-attribute",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX attributeを構成する",
  implementation: "{name}={value}",
  targetPath: "generated.tsx",
  inputs: ["identifier", "expression"],
  outputs: ["jsx-attribute"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.jsx-attribute",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.jsx-attribute",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.jsx-attribute",
},

{
  knowledgeId: "code.web.jsx-element",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX elementを構成する",
  implementation: "<{name} {attributes}>{children}</{name}>",
  targetPath: "generated.tsx",
  inputs: ["identifier", "jsx-attribute", "jsx-child"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.jsx-element",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.jsx-element",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.jsx-element",
},

{
  knowledgeId: "code.web.jsx-fragment",
  componentType: "CODE_CONSTRUCTION",
  purpose: "JSX Fragmentを構成する",
  implementation: "<>{children}</>",
  targetPath: "generated.tsx",
  inputs: ["jsx-child"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.jsx-fragment",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.jsx-fragment",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.jsx-fragment",
},

{
  knowledgeId: "code.web.react-component-props",
  componentType: "CODE_CONSTRUCTION",
  purpose: "props付きReact関数コンポーネントを構成する",
  implementation: "function {name}(props: {propsType}) {\\n  return ({body});\\n}",
  targetPath: "generated.tsx",
  inputs: ["identifier", "type-expression", "jsx-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-component-props",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-component-props",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-component-props",
},

{
  knowledgeId: "code.web.react-use-state",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useState hookを構成する",
  implementation: "useState({initialValue})",
  targetPath: "generated.tsx",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-state",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-state",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-state",
},

{
  knowledgeId: "code.web.react-use-effect",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useEffect hookを構成する",
  implementation: "useEffect({effect}, {dependencies})",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-effect",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-effect",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-effect",
},

{
  knowledgeId: "code.web.react-use-memo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useMemo hookを構成する",
  implementation: "useMemo({factory}, {dependencies})",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-memo",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-memo",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-memo",
},

{
  knowledgeId: "code.web.react-use-callback",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useCallback hookを構成する",
  implementation: "useCallback({callback}, {dependencies})",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "expression"],
  outputs: ["function-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-callback",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-callback",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-callback",
},

{
  knowledgeId: "code.web.react-use-ref",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useRef hookを構成する",
  implementation: "useRef({initialValue})",
  targetPath: "generated.tsx",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-ref",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-ref",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-ref",
},

{
  knowledgeId: "code.web.react-use-context",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useContext hookを構成する",
  implementation: "useContext({context})",
  targetPath: "generated.tsx",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-context",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-context",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-context",
},

{
  knowledgeId: "code.web.react-use-reducer",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React useReducer hookを構成する",
  implementation: "useReducer({reducer}, {initialState})",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-use-reducer",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-use-reducer",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-reducer",
},

{
  knowledgeId: "code.web.react-event-handler",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React event handlerを構成する",
  implementation: "({event}) => {\\n{body}\\n}",
  targetPath: "generated.tsx",
  inputs: ["parameter", "statement"],
  outputs: ["function-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-event-handler",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-event-handler",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-event-handler",
},

{
  knowledgeId: "code.web.react-conditional-render",
  componentType: "CODE_CONSTRUCTION",
  purpose: "条件付きUIを構成する",
  implementation: "{condition} ? {whenTrue} : {whenFalse}",
  targetPath: "generated.tsx",
  inputs: ["boolean-expression", "jsx-expression"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-conditional-render",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-conditional-render",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-conditional-render",
},

{
  knowledgeId: "code.web.react-list-render",
  componentType: "CODE_CONSTRUCTION",
  purpose: "配列からUI listをrenderする",
  implementation: "{items}.map(({item}) => ({body}))",
  targetPath: "generated.tsx",
  inputs: ["array-expression", "identifier", "jsx-expression"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-list-render",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-list-render",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-list-render",
},

{
  knowledgeId: "code.web.react-form",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React formを構成する",
  implementation: "<form onSubmit={handler}>{body}</form>",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "jsx-child"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react,react-dom"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-form",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react,react-dom"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-form",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-form",
},

{
  knowledgeId: "code.web.react-input",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React input elementを構成する",
  implementation: "<input value={value} onChange={handler} />",
  targetPath: "generated.tsx",
  inputs: ["expression", "function-expression"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react,react-dom"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-input",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react,react-dom"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-input",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-input",
},

{
  knowledgeId: "code.web.react-button",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React button elementを構成する",
  implementation: "<button onClick={handler}>{body}</button>",
  targetPath: "generated.tsx",
  inputs: ["function-expression", "jsx-child"],
  outputs: ["jsx-expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react,react-dom"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-button",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react,react-dom"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-button",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-button",
},

{
  knowledgeId: "code.web.react-memo",
  componentType: "CODE_CONSTRUCTION",
  purpose: "React memoによるcomponent最適化境界",
  implementation: "memo({component})",
  targetPath: "generated.tsx",
  inputs: ["expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["react"],
  supportedEnvironments: ["MIKI_RUNTIME", "ANDROID"],
  entryPoint: "CodeConstruction/code.web.react-memo",
  securityClass: "READ_ONLY",
  exports: [],
  imports: ["react"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.react-memo",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.react-memo",
},

{
  knowledgeId: "code.web.express-app",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express applicationを構成する",
  implementation: "const {name} = express();",
  targetPath: "generated.ts",
  inputs: ["identifier"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-app",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-app",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-app",
},

{
  knowledgeId: "code.web.express-route-get",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express GET routeを構成する",
  implementation: "app.get({path}, {handler})",
  targetPath: "generated.ts",
  inputs: ["string-expression", "function-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-route-get",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-route-get",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-route-get",
},

{
  knowledgeId: "code.web.express-route-post",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express POST routeを構成する",
  implementation: "app.post({path}, {handler})",
  targetPath: "generated.ts",
  inputs: ["string-expression", "function-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-route-post",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-route-post",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-route-post",
},

{
  knowledgeId: "code.web.express-middleware",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express middlewareを接続する",
  implementation: "app.use({middleware})",
  targetPath: "generated.ts",
  inputs: ["function-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-middleware",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-middleware",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-middleware",
},

{
  knowledgeId: "code.web.express-json",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express JSON body parserを接続する",
  implementation: "app.use(express.json())",
  targetPath: "generated.ts",
  inputs: [],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-json",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-json",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-json",
},

{
  knowledgeId: "code.web.express-response-json",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express responseをJSONで返す",
  implementation: "res.json({body})",
  targetPath: "generated.ts",
  inputs: ["expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-response-json",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-response-json",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-response-json",
},

{
  knowledgeId: "code.web.express-response-status",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express response statusを設定する",
  implementation: "res.status({status})",
  targetPath: "generated.ts",
  inputs: ["number-expression"],
  outputs: ["expression"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-response-status",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-response-status",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-response-status",
},

{
  knowledgeId: "code.web.express-listen",
  componentType: "CODE_CONSTRUCTION",
  purpose: "Express serverを指定portでlistenする",
  implementation: "app.listen({port}, {callback})",
  targetPath: "generated.ts",
  inputs: ["number-expression", "function-expression"],
  outputs: ["statement"],
  prerequisites: ["compatible input contract"],
  dependencies: ["express"],
  supportedEnvironments: ["MIKI_RUNTIME"],
  entryPoint: "CodeConstruction/code.web.express-listen",
  securityClass: "STANDARD",
  exports: [],
  imports: ["express"],
  publicInterfaces: [],
  tests: "CONTRACT_TEST:code.web.express-listen",
  validation: "VALIDATE_CODE_CONSTRUCTION:code.web.express-listen",
},

{
  "knowledgeId": "code.web.react-use-state-functional-update",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "useStateのfunctional updateを構成する",
  "implementation": "set{setter}(previous => {nextValue})",
  "targetPath": "generated.tsx",
  "inputs": [
    "identifier",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-use-state-functional-update",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-use-state-functional-update",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-state-functional-update"
},

{
  "knowledgeId": "code.web.react-use-effect-empty-deps",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "mount相当でEffectを一度実行する",
  "implementation": "useEffect(() => {\\n{body}\\n}, []);",
  "targetPath": "generated.tsx",
  "inputs": [
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-use-effect-empty-deps",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-use-effect-empty-deps",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-effect-empty-deps"
},

{
  "knowledgeId": "code.web.react-use-memo-value",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "useMemoで計算値をmemoizeする",
  "implementation": "const {name} = useMemo(() => {value}, [{dependencies}]);",
  "targetPath": "generated.tsx",
  "inputs": [
    "identifier",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-use-memo-value",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-use-memo-value",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-memo-value"
},

{
  "knowledgeId": "code.web.react-div",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "基本的なdiv JSX要素を構成する",
  "implementation": "<div {attributes}>{children}</div>",
  "targetPath": "generated.tsx",
  "inputs": [
    "jsx-attribute",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-div",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-div",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-div"
},

{
  "knowledgeId": "code.web.react-span",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "基本的なspan JSX要素を構成する",
  "implementation": "<span {attributes}>{children}</span>",
  "targetPath": "generated.tsx",
  "inputs": [
    "jsx-attribute",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-span",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-span",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-span"
},

{
  "knowledgeId": "code.web.react-image",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "alt属性付き画像JSXを構成する",
  "implementation": "<img src={src} alt={alt} />",
  "targetPath": "generated.tsx",
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-image",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-image",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-image"
},

{
  "knowledgeId": "code.web.react-anchor",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "リンクJSX要素を構成する",
  "implementation": "<a href={href}>{children}</a>",
  "targetPath": "generated.tsx",
  "inputs": [
    "string-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-anchor",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-anchor",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-anchor"
},

{
  "knowledgeId": "code.web.react-form-submit",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React formのsubmit handlerを構成する",
  "implementation": "<form onSubmit={handler}>{children}</form>",
  "targetPath": "generated.tsx",
  "inputs": [
    "function-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME",
    "ANDROID"
  ],
  "entryPoint": "CodeConstruction/code.web.react-form-submit",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-form-submit",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-form-submit"
},

{
  "knowledgeId": "code.web.express-router-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "RouterへHTTP GET routeを登録する",
  "implementation": "router.get({path}, {handler});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-router-route",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-router-route",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-router-route"
},

{
  "knowledgeId": "code.web.express-request-header",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express request headerを取得する",
  "implementation": "req.get({name})",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression"
  ],
  "outputs": [
    "string-expression"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-request-header",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-request-header",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-request-header"
},

{
  "knowledgeId": "code.web.express-response-type",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response Content-Typeを設定する",
  "implementation": "res.type({type})",
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
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-response-type",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-response-type",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-response-type"
},

{
  "knowledgeId": "code.web.express-response-cookie",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response cookieを設定する",
  "implementation": "res.cookie({name}, {value});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-response-cookie",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-response-cookie",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-response-cookie"
},

{
  "knowledgeId": "code.web.express-status-send",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express response statusとsendを組み合わせる",
  "implementation": "res.status({status}).send({body});",
  "targetPath": "generated.ts",
  "inputs": [
    "number-expression",
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-status-send",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-status-send",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-status-send"
},

{
  "knowledgeId": "code.web.express-static",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Expressで静的ファイル配信middlewareを登録する",
  "implementation": "app.use({path}, express.static({directory}));",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "string-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-static",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-static",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-static"
},

{
  "knowledgeId": "code.web.express-router-use",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express Routerをmiddlewareとして接続する",
  "implementation": "app.use({path}, {router});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "identifier"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [
    "compatible input contract"
  ],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-router-use",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-router-use",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-router-use"
},
{
  "knowledgeId": "code.web.react-use-id",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React useIdを構成する",
  "implementation": "const {name} = useId();",
  "targetPath": "generated.tsx",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-use-id",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-use-id",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-use-id"
},
{
  "knowledgeId": "code.web.react-custom-hook",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "custom hookを構成する",
  "implementation": "function {name}({parameters}) {\\n{body}\\n}",
  "targetPath": "generated.tsx",
  "inputs": [
    "identifier",
    "parameter",
    "statement"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-custom-hook",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-custom-hook",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-custom-hook"
},
{
  "knowledgeId": "code.web.react-context-provider",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Context Providerを構成する",
  "implementation": "<{context}.Provider value={{value}}>{children}</{context}.Provider>",
  "targetPath": "generated.tsx",
  "inputs": [
    "identifier",
    "expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-context-provider",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-context-provider",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-context-provider"
},
{
  "knowledgeId": "code.web.react-fragment",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "React Fragmentを構成する",
  "implementation": "<>{children}</>",
  "targetPath": "generated.tsx",
  "inputs": [
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-fragment",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-fragment",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-fragment"
},
{
  "knowledgeId": "code.web.react-textarea",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "textarea JSXを構成する",
  "implementation": "<textarea value={value} onChange={handler} />",
  "targetPath": "generated.tsx",
  "inputs": [
    "expression",
    "function-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-textarea",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-textarea",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-textarea"
},
{
  "knowledgeId": "code.web.react-select",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "select JSXを構成する",
  "implementation": "<select value={value} onChange={handler}>{children}</select>",
  "targetPath": "generated.tsx",
  "inputs": [
    "expression",
    "function-expression",
    "jsx-child"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-select",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-select",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-select"
},
{
  "knowledgeId": "code.web.react-checkbox",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "checkbox JSXを構成する",
  "implementation": "<input type=\"checkbox\" checked={checked} onChange={handler} />",
  "targetPath": "generated.tsx",
  "inputs": [
    "boolean-expression",
    "function-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-checkbox",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-checkbox",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-checkbox"
},
{
  "knowledgeId": "code.web.react-conditional",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "条件付きJSXを構成する",
  "implementation": "{condition} ? {whenTrue} : {whenFalse}",
  "targetPath": "generated.tsx",
  "inputs": [
    "boolean-expression",
    "jsx-expression",
    "jsx-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-conditional",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-conditional",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-conditional"
},
{
  "knowledgeId": "code.web.react-list-map",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "ArrayをJSX listへ変換する",
  "implementation": "{items}.map(({item}) => {children})",
  "targetPath": "generated.tsx",
  "inputs": [
    "array-expression",
    "jsx-expression"
  ],
  "outputs": [
    "jsx-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "react"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.react-list-map",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "react"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.react-list-map",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.react-list-map"
},
{
  "knowledgeId": "code.web.express-post-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express POST routeを登録する",
  "implementation": "router.post({path}, {handler});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-post-route",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-post-route",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-post-route"
},
{
  "knowledgeId": "code.web.express-put-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express PUT routeを登録する",
  "implementation": "router.put({path}, {handler});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-put-route",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-put-route",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-put-route"
},
{
  "knowledgeId": "code.web.express-delete-route",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express DELETE routeを登録する",
  "implementation": "router.delete({path}, {handler});",
  "targetPath": "generated.ts",
  "inputs": [
    "string-expression",
    "function-expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-delete-route",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-delete-route",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-delete-route"
},
{
  "knowledgeId": "code.web.express-request-params",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express route paramsを取得する",
  "implementation": "req.params.{name}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-request-params",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-request-params",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-request-params"
},
{
  "knowledgeId": "code.web.express-request-query",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express query parameterを取得する",
  "implementation": "req.query.{name}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier"
  ],
  "outputs": [
    "expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-request-query",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-request-query",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-request-query"
},
{
  "knowledgeId": "code.web.express-request-body",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express request bodyを取得する",
  "implementation": "req.body",
  "targetPath": "generated.ts",
  "inputs": [],
  "outputs": [
    "expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-request-body",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-request-body",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-request-body"
},
{
  "knowledgeId": "code.web.express-next",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express middleware chainを次へ進める",
  "implementation": "next({error});",
  "targetPath": "generated.ts",
  "inputs": [
    "expression"
  ],
  "outputs": [
    "statement"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-next",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-next",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-next"
},
{
  "knowledgeId": "code.web.express-error-middleware",
  "componentType": "CODE_CONSTRUCTION",
  "purpose": "Express error middlewareを構成する",
  "implementation": "({error}, req, res, next) => {\\n{body}\\n}",
  "targetPath": "generated.ts",
  "inputs": [
    "identifier",
    "statement"
  ],
  "outputs": [
    "function-expression"
  ],
  "prerequisites": [],
  "dependencies": [
    "express"
  ],
  "supportedEnvironments": [
    "ANDROID",
    "MIKI_RUNTIME"
  ],
  "entryPoint": "CodeConstruction/code.web.express-error-middleware",
  "securityClass": "READ_ONLY",
  "exports": [],
  "imports": [
    "express"
  ],
  "publicInterfaces": [],
  "tests": "CONTRACT_TEST:code.web.express-error-middleware",
  "validation": "VALIDATE_CODE_CONSTRUCTION:code.web.express-error-middleware"
}
];

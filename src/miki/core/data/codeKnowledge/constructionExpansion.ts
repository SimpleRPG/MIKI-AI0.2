import type { CodeKnowledgeDefinition, CodeComponentDefinition } from './common';

const profile = (
  kind: 'STATEMENT'|'EXPRESSION'|'DECLARATION'|'TYPE'|'CALL'|'MODULE'|'ASYNC',
  syntaxTemplate: string,
  slots: {name:string; inputKinds:string[]; required:boolean; multiple?:boolean}[],
  outputKinds: string[] = ['statement'],
) => ({
  kind,
  syntaxTemplate,
  outputKinds,
  slots,
  constraints: ['inputs must satisfy the declared construction contract'],
  adaptationRules: ['adapt only when the target contract explicitly requires it'],
});

export const constructionExpansionKnowledge: CodeKnowledgeDefinition[] = [
  {
    id:'code.expansion.object-literal',
    componentType:'CODE_CONSTRUCTION',
    purpose:'JavaScript object literalを構成する',
    summary:'名前付きプロパティから構造化されたobjectを作る。',
    concepts:['object literal','property','object'],
    inputs:['property definitions'],
    outputs:['object-expression'],
    appliesWhen:['構造化データを作る'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer'],
    sourceArtifactIds:['mdn-object-initializer'],
    constructionProfile:profile('EXPRESSION','({members})',[
      {name:'members',inputKinds:['object-member'],required:false,multiple:true}
    ],['object-expression'])
  },
  {
    id:'code.expansion.object-property-access',
    componentType:'CODE_CONSTRUCTION',
    purpose:'objectのプロパティを参照する',
    summary:'ドット記法で既存objectから値を取得する。',
    concepts:['property access','object'],
    inputs:['object-expression','identifier'],
    outputs:['expression'],
    appliesWhen:['objectの値を読む'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors'],
    sourceArtifactIds:['mdn-property-accessors'],
    constructionProfile:profile('EXPRESSION','{object}.{property}',[
      {name:'object',inputKinds:['object-expression'],required:true},
      {name:'property',inputKinds:['identifier'],required:true}
    ],['expression'])
  },
  {
    id:'code.expansion.object-spread',
    componentType:'CODE_CONSTRUCTION',
    purpose:'objectをspreadして新しいobjectを構成する',
    summary:'既存objectのプロパティを新しいobjectへ展開する。',
    concepts:['spread syntax','object'],
    inputs:['object-expression'],
    outputs:['object-expression'],
    appliesWhen:['objectを非破壊的に拡張する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax'],
    sourceArtifactIds:['mdn-spread-syntax'],
    constructionProfile:profile('EXPRESSION','({...{object}})',[
      {name:'object',inputKinds:['object-expression'],required:true}
    ],['object-expression'])
  },
  {
    id:'code.expansion.array-spread',
    componentType:'CODE_CONSTRUCTION',
    purpose:'iterableをarrayへspreadする',
    summary:'既存iterableを新しいarrayへ展開する。',
    concepts:['spread syntax','Array','iterable'],
    inputs:['iterable-expression'],
    outputs:['array-expression'],
    appliesWhen:['arrayの結合やコピー'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax'],
    sourceArtifactIds:['mdn-array-spread'],
    constructionProfile:profile('EXPRESSION','[...{iterable}]',[
      {name:'iterable',inputKinds:['iterable-expression'],required:true}
    ],['array-expression'])
  },
  {
    id:'code.expansion.ternary',
    componentType:'CODE_CONSTRUCTION',
    purpose:'条件演算子で式を分岐する',
    summary:'条件によって2つの式の一方を選択する。',
    concepts:['conditional operator','ternary'],
    inputs:['boolean-expression','expression'],
    outputs:['expression'],
    appliesWhen:['式として条件分岐する'],
    doesNotApplyWhen:['複数statementが必要な場合'],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_operator'],
    sourceArtifactIds:['mdn-conditional-operator'],
    constructionProfile:profile('EXPRESSION','{condition} ? {whenTrue} : {whenFalse}',[
      {name:'condition',inputKinds:['boolean-expression'],required:true},
      {name:'whenTrue',inputKinds:['expression'],required:true},
      {name:'whenFalse',inputKinds:['expression'],required:true}
    ],['expression'])
  },
  {
    id:'code.expansion.try-catch',
    componentType:'CODE_CONSTRUCTION',
    purpose:'例外発生可能な処理をtry/catchで保護する',
    summary:'失敗経路を明示的に分離して処理する。',
    concepts:['try','catch','exception'],
    inputs:['statement'],
    outputs:['statement'],
    appliesWhen:['I/O','network','parsing','外部入力'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch'],
    sourceArtifactIds:['mdn-try-catch'],
    constructionProfile:profile('STATEMENT','try {\\n{body}\\n} catch ({error}) {\\n{handler}\\n}',[
      {name:'body',inputKinds:['statement'],required:true,multiple:true},
      {name:'error',inputKinds:['identifier'],required:true},
      {name:'handler',inputKinds:['statement'],required:true,multiple:true}
    ])
  },
  {
    id:'code.expansion.throw-error',
    componentType:'CODE_CONSTRUCTION',
    purpose:'明示的にErrorを送出する',
    summary:'不正状態や失敗条件を例外として通知する。',
    concepts:['throw','Error','exception'],
    inputs:['string-expression'],
    outputs:['statement'],
    appliesWhen:['失敗を明示的に通知する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw'],
    sourceArtifactIds:['mdn-throw'],
    constructionProfile:profile('STATEMENT','throw new Error({message});',[
      {name:'message',inputKinds:['string-expression'],required:true}
    ])
  },
  {
    id:'code.expansion.promise-all',
    componentType:'CODE_CONSTRUCTION',
    purpose:'独立したPromiseを並行実行する',
    summary:'複数Promiseの完了をまとめて待つ。',
    concepts:['Promise.all','concurrency','Promise'],
    inputs:['promise-expression'],
    outputs:['promise-expression'],
    appliesWhen:['独立した非同期処理を並行化する'],
    doesNotApplyWhen:['処理間に順序依存がある場合'],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all'],
    sourceArtifactIds:['mdn-promise-all'],
    constructionProfile:profile('ASYNC','Promise.all([{operations}])',[
      {name:'operations',inputKinds:['promise-expression'],required:true,multiple:true}
    ],['promise-expression'])
  },
  {
    id:'code.expansion.json-stringify',
    componentType:'CODE_CONSTRUCTION',
    purpose:'JavaScript値をJSON文字列へ変換する',
    summary:'構造化データをJSON形式へシリアライズする。',
    concepts:['JSON.stringify','serialization'],
    inputs:['expression'],
    outputs:['string-expression'],
    appliesWhen:['JSON送信','保存','ログ'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify'],
    sourceArtifactIds:['mdn-json-stringify'],
    constructionProfile:profile('CALL','JSON.stringify({value})',[
      {name:'value',inputKinds:['expression'],required:true}
    ],['string-expression'])
  },
  {
    id:'code.expansion.template-string',
    componentType:'CODE_CONSTRUCTION',
    purpose:'式を埋め込んだ文字列を構成する',
    summary:'Template literalで値を文字列へ組み込む。',
    concepts:['template literal','string interpolation'],
    inputs:['expression'],
    outputs:['string-expression'],
    appliesWhen:['動的なメッセージやパスを構成する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals'],
    sourceArtifactIds:['mdn-template-literals'],
    constructionProfile:profile('EXPRESSION','`{prefix}${value}{suffix}`',[
      {name:'prefix',inputKinds:['string-expression'],required:false},
      {name:'value',inputKinds:['expression'],required:true},
      {name:'suffix',inputKinds:['string-expression'],required:false}
    ],['string-expression'])
  },
  {
    id:'code.expansion.typescript-function-type',
    componentType:'CODE_CONSTRUCTION',
    purpose:'TypeScript function typeを構成する',
    summary:'関数の引数と戻り値の型契約を明示する。',
    concepts:['function type','parameters','return type'],
    inputs:['parameter','type-expression'],
    outputs:['type-expression'],
    appliesWhen:['callbackやAPIの関数契約を定義する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/2/functions.html'],
    sourceArtifactIds:['typescript-function-types'],
    constructionProfile:profile('TYPE','({parameters}) => {returnType}',[
      {name:'parameters',inputKinds:['parameter'],required:false,multiple:true},
      {name:'returnType',inputKinds:['type-expression'],required:true}
    ],['type-expression'])
  },
  {
    id:'code.expansion.typescript-optional-property',
    componentType:'CODE_CONSTRUCTION',
    purpose:'optional propertyを型へ追加する',
    summary:'存在しない可能性のあるプロパティを型で表現する。',
    concepts:['optional property','interface','type'],
    inputs:['identifier','type-expression'],
    outputs:['type-member'],
    appliesWhen:['部分的な入力や設定値を表現する'],
    doesNotApplyWhen:['必須値'],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds:['typescript-optional-properties'],
    constructionProfile:profile('TYPE','{name}?: {type};',[
      {name:'name',inputKinds:['identifier'],required:true},
      {name:'type',inputKinds:['type-expression'],required:true}
    ],['type-member'])
  },
  {
    id:'code.expansion.typescript-readonly-property',
    componentType:'CODE_CONSTRUCTION',
    purpose:'readonly propertyを型へ追加する',
    summary:'再代入しないプロパティの契約を型で表現する。',
    concepts:['readonly','property','immutability'],
    inputs:['identifier','type-expression'],
    outputs:['type-member'],
    appliesWhen:['変更不可の契約が必要'],
    doesNotApplyWhen:['再代入を契約上許可する場合'],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/2/objects.html'],
    sourceArtifactIds:['typescript-readonly-properties'],
    constructionProfile:profile('TYPE','readonly {name}: {type};',[
      {name:'name',inputKinds:['identifier'],required:true},
      {name:'type',inputKinds:['type-expression'],required:true}
    ],['type-member'])
  },
  {
    id:'code.expansion.typescript-generic-function',
    componentType:'CODE_CONSTRUCTION',
    purpose:'generic functionを構成する',
    summary:'型パラメータを持つ再利用可能な関数を定義する。',
    concepts:['generic','function','type parameter'],
    inputs:['identifier','parameter','type-expression','statement'],
    outputs:['statement'],
    appliesWhen:['複数型で再利用する関数'],
    doesNotApplyWhen:[],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/2/generics.html'],
    sourceArtifactIds:['typescript-generics'],
    constructionProfile:profile('DECLARATION','function {name}<T>({parameters}): {returnType} {\\n{body}\\n}',[
      {name:'name',inputKinds:['identifier'],required:true},
      {name:'parameters',inputKinds:['parameter'],required:false,multiple:true},
      {name:'returnType',inputKinds:['type-expression'],required:true},
      {name:'body',inputKinds:['statement'],required:true,multiple:true}
    ])
  },
  {
    id:'code.expansion.typescript-type-assertion',
    componentType:'CODE_CONSTRUCTION',
    purpose:'TypeScript type assertionを構成する',
    summary:'式の型をコンパイラへ明示する。',
    concepts:['type assertion','as'],
    inputs:['expression','type-expression'],
    outputs:['expression'],
    appliesWhen:['型情報を明示する必要がある境界'],
    doesNotApplyWhen:['実行時検証が必要な場合'],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'],
    sourceArtifactIds:['typescript-type-assertions'],
    constructionProfile:profile('EXPRESSION','({value} as {type})',[
      {name:'value',inputKinds:['expression'],required:true},
      {name:'type',inputKinds:['type-expression'],required:true}
    ],['expression'])
  },
  {
    id:'code.expansion.typescript-named-import',
    componentType:'CODE_CONSTRUCTION',
    purpose:'named importを構成する',
    summary:'必要な名前付きexportだけをmoduleからimportする。',
    concepts:['import','named import','module'],
    inputs:['identifier','string-expression'],
    outputs:['statement'],
    appliesWhen:['依存するexportを明示的に取り込む'],
    doesNotApplyWhen:[],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds:['typescript-named-import'],
    constructionProfile:profile('MODULE','import { {names} } from {module};',[
      {name:'names',inputKinds:['identifier'],required:true,multiple:true},
      {name:'module',inputKinds:['string-expression'],required:true}
    ])
  },
  {
    id:'code.expansion.typescript-named-export',
    componentType:'CODE_CONSTRUCTION',
    purpose:'named exportを構成する',
    summary:'module外へ明示的に公開する宣言を構成する。',
    concepts:['export','named export','module'],
    inputs:['statement'],
    outputs:['statement'],
    appliesWhen:['module APIを公開する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://www.typescriptlang.org/docs/handbook/modules.html'],
    sourceArtifactIds:['typescript-named-export'],
    constructionProfile:profile('MODULE','export { {names} };',[
      {name:'names',inputKinds:['identifier'],required:true,multiple:true}
    ])
  },
  {
    id:'code.expansion.react-use-state',
    componentType:'CODE_CONSTRUCTION',
    purpose:'React stateを構成する',
    summary:'useStateによるローカル状態とsetterを構成する。',
    concepts:['React','useState','state'],
    inputs:['identifier','expression'],
    outputs:['statement'],
    appliesWhen:['Component内で状態を保持する'],
    doesNotApplyWhen:[],
    sourceUrls:['https://react.dev/reference/react/useState'],
    sourceArtifactIds:['react-use-state'],
    constructionProfile:profile('CALL','const [{name}, set{Name}] = useState({initial});',[
      {name:'name',inputKinds:['identifier'],required:true},
      {name:'initial',inputKinds:['expression'],required:true}
    ])
  },
  {
    id:'code.expansion.react-use-effect',
    componentType:'CODE_CONSTRUCTION',
    purpose:'React effectを構成する',
    summary:'外部システムとの同期処理をeffectとして構成する。',
    concepts:['React','useEffect','effect'],
    inputs:['function-expression','array-expression'],
    outputs:['statement'],
    appliesWhen:['外部システムとの同期が必要'],
    doesNotApplyWhen:['純粋なrender計算'],
    sourceUrls:['https://react.dev/reference/react/useEffect'],
    sourceArtifactIds:['react-use-effect'],
    constructionProfile:profile('ASYNC','useEffect({effect}, {dependencies});',[
      {name:'effect',inputKinds:['function-expression'],required:true},
      {name:'dependencies',inputKinds:['array-expression'],required:true}
    ])
  },
  {
    id:'code.expansion.react-use-memo',
    componentType:'CODE_CONSTRUCTION',
    purpose:'Reactの計算結果をmemoizeする',
    summary:'依存値が変わった場合だけ計算を再実行する。',
    concepts:['React','useMemo','memoization'],
    inputs:['function-expression','array-expression'],
    outputs:['expression'],
    appliesWhen:['計算結果の再利用が必要'],
    doesNotApplyWhen:['単純な計算'],
    sourceUrls:['https://react.dev/reference/react/useMemo'],
    sourceArtifactIds:['react-use-memo'],
    constructionProfile:profile('CALL','useMemo({factory}, {dependencies})',[
      {name:'factory',inputKinds:['function-expression'],required:true},
      {name:'dependencies',inputKinds:['array-expression'],required:true}
    ],['expression'])
  },
  {
    id:'code.expansion.react-use-callback',
    componentType:'CODE_CONSTRUCTION',
    purpose:'React callback functionをmemoizeする',
    summary:'依存値に応じて安定したcallback参照を構成する。',
    concepts:['React','useCallback','callback'],
    inputs:['function-expression','array-expression'],
    outputs:['function-expression'],
    appliesWhen:['子Componentへのcallback参照を安定させる'],
    doesNotApplyWhen:[],
    sourceUrls:['https://react.dev/reference/react/useCallback'],
    sourceArtifactIds:['react-use-callback'],
    constructionProfile:profile('CALL','useCallback({callback}, {dependencies})',[
      {name:'callback',inputKinds:['function-expression'],required:true},
      {name:'dependencies',inputKinds:['array-expression'],required:true}
    ],['function-expression'])
  },
  {
    id:'code.expansion.fetch-response-json',
    componentType:'CODE_CONSTRUCTION',
    purpose:'Fetch ResponseをJSONへ変換する',
    summary:'HTTP ResponseのJSON bodyを非同期に解析する。',
    concepts:['Fetch','Response','json'],
    inputs:['promise-expression'],
    outputs:['promise-expression'],
    appliesWhen:['HTTP APIのJSON responseを読む'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/API/Response/json'],
    sourceArtifactIds:['mdn-response-json'],
    constructionProfile:profile('ASYNC','({response}).json()',[
      {name:'response',inputKinds:['promise-expression'],required:true}
    ],['promise-expression'])
  },
  {
    id:'code.expansion.fetch-headers',
    componentType:'CODE_CONSTRUCTION',
    purpose:'Fetch requestへheadersを設定する',
    summary:'HTTP requestのヘッダーを明示的に構成する。',
    concepts:['Fetch','Headers','HTTP'],
    inputs:['object-expression'],
    outputs:['object-expression'],
    appliesWhen:['Content-Typeや認証などHTTP headerが必要'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/API/Headers'],
    sourceArtifactIds:['mdn-fetch-headers'],
    constructionProfile:profile('EXPRESSION','{requestOptions} with headers: {headers}',[
      {name:'requestOptions',inputKinds:['object-expression'],required:true},
      {name:'headers',inputKinds:['object-expression'],required:true}
    ],['object-expression'])
  },
  {
    id:'code.expansion.abort-controller',
    componentType:'CODE_CONSTRUCTION',
    purpose:'非同期処理のキャンセル信号を構成する',
    summary:'AbortControllerによるキャンセル境界を構成する。',
    concepts:['AbortController','AbortSignal','cancellation'],
    inputs:['identifier'],
    outputs:['statement'],
    appliesWhen:['fetchや非同期処理のキャンセル'],
    doesNotApplyWhen:[],
    sourceUrls:['https://developer.mozilla.org/en-US/docs/Web/API/AbortController'],
    sourceArtifactIds:['mdn-abort-controller'],
    constructionProfile:profile('DECLARATION','const {name} = new AbortController();',[
      {name:'name',inputKinds:['identifier'],required:true}
    ])
  },
];

export const constructionExpansionComponents: CodeComponentDefinition[] =
  constructionExpansionKnowledge.map(k => ({
    knowledgeId:k.id,
    componentType:k.componentType,
    purpose:k.purpose,
    implementation:k.constructionProfile?.syntaxTemplate || '',
    targetPath:k.id.startsWith('code.expansion.react-') ? 'generated.tsx' : 'generated.ts',
    inputs:k.inputs,
    outputs:k.outputs,
    prerequisites:[],
    dependencies:k.id.startsWith('code.expansion.react-') ? ['react'] : [],
    supportedEnvironments:['MIKI_RUNTIME','ANDROID'],
    entryPoint:`CodeConstruction/${k.id}`,
    securityClass:'READ_ONLY',
    exports:[],
    imports:k.id.startsWith('code.expansion.react-') ? ['react'] : [],
    publicInterfaces:[],
    tests:`CONTRACT_TEST:${k.id}`,
    validation:`VALIDATE_CODE_CONSTRUCTION:${k.id}`,
  }));

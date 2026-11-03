import ts from 'typescript';
import { storageService } from '../../../services/storageService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { canonicalSha256 } from './canonicalSha256Service';

export type CodeSymbolKind =
  | 'CLASS' | 'INTERFACE' | 'TYPE' | 'FUNCTION' | 'METHOD'
  | 'PROPERTY' | 'VARIABLE' | 'ENUM';
export type CodeRelationKind =
  | 'IMPORTS' | 'CALLS' | 'IMPLEMENTS' | 'EXTENDS'
  | 'READS_STORAGE' | 'WRITES_STORAGE'
  | 'DECLARES_COMMAND' | 'USES_COMMAND'
  | 'PUBLISHES_EVENT' | 'SUBSCRIBES_EVENT';

export interface CodeSymbolRecord {
  id:string;
  path:string;
  name:string;
  qualifiedName:string;
  kind:CodeSymbolKind;
  exported:boolean;
  async:boolean;
  line:number;
  parameters:string[];
  returnType?:string;
}

export interface CodeRelationRecord {
  kind:CodeRelationKind;
  from:string;
  to:string;
  line:number;
  evidence:string;
}

export interface CodeLiteralContract {
  value:string;
  role:'DOMAIN_COMMAND'|'EVENT'|'STORAGE_KEY'|'STATUS'|'OTHER';
  line:number;
  ownerSymbol?:string;
}

export interface CodeUnderstandingEntry {
  path:string;
  contentHash:string;
  imports:string[];
  importedBy:string[];
  exports:string[];
  symbols:CodeSymbolRecord[];
  relations:CodeRelationRecord[];
  literalContracts:CodeLiteralContract[];
  parseDiagnostics:string[];
  // P412: identifiers bound by any function-like parameter in the
  // file (declarations, expressions, arrows, inline callbacks),
  // collected through binding patterns. Symbol parameters only
  // covered declared functions, so callback parameters (e.g. a
  // socket handler's ack) looked unaccounted for as bare CALLS.
  parameterNames?:string[];
  // P363: one-line role extracted deterministically from the file's
  // leading comment (never generated). Lets consumers reason about
  // what a file is for, not only what it exports.
  role?:string;
}

export interface CodeUnderstandingSnapshot {
  // P412: bumped from 2 — parse() output changed (binding-pattern
  // symbols, parameterNames), and stored entries are reused by
  // content hash, so a v2 snapshot must be rebuilt, not reused.
  schemaVersion:3;
  repoSha256:string;
  snapshotSha256:string;
  entries:CodeUnderstandingEntry[];
  createdAt:number;
  updatedAt:number;
  targetFingerprints:Record<string,string>;
  // P363: which commit this index was built from, so consumers can
  // tell a current index from a silently stale one.
  sourceCommitSha?:string;
}

export type ImpactScope='MUST_CHANGE'|'MUST_INSPECT'|'CONTRACT_DEPENDENCY'|'TEST_ONLY'|'POSSIBLY_RELATED';
export interface ExecutionPathRecord { from:string; to:string; kind:CodeRelationKind|'SHARES_CONTRACT'; evidence:string; }
export interface ImpactScopeRecord { path:string; scope:ImpactScope; reasons:string[]; symbolIds:string[]; contractValues:string[]; }

export interface CodeUnderstandingResult {
  ready:boolean;
  reused:boolean;
  repoSha256:string;
  targetPaths:string[];
  relatedPaths:string[];
  reasons:string[];
  snapshotSha256?:string;
  symbolIds:string[];
  executionRelations:CodeRelationRecord[];
  contractValues:string[];
  executionPaths:ExecutionPathRecord[];
  impactScopes:ImpactScopeRecord[];
  unresolvedEdges:string[];
}

const KEY='miki_code_understanding_snapshot';
const TEST_PATH=/(?:^|\/)(?:test|tests|__tests__|scripts\/verify)[^/]*|\.(?:spec|test)\.[cm]?[jt]sx?$/i;
const COMMAND_CALLS=new Set(['latestBusinessResult','latestOperationError','lastOperationFailed','operationInstanceFor']);
const EVENT_PUBLISH_METHODS=new Set(['emit','publish','dispatch','notify']);
const EVENT_SUBSCRIBE_METHODS=new Set(['on','subscribe','addEventListener','registerHandler']);
const STORAGE_READ_METHODS=new Set(['getItem','get']);
const STORAGE_WRITE_METHODS=new Set(['setItem','set','removeItem','delete']);
// P400: platform globals that may legitimately appear as bare CALLS
// callees. Together with repository declarations, per-file import
// bindings and parameter names, these decide whether a bare CALLS
// relation is genuinely unaccounted for (see ensure()).
const BUILTIN_CALLEE_NAMES=new Set([
  'Number','String','Boolean','BigInt','Symbol','Array','Object','Function','Proxy','Reflect',
  'Error','EvalError','RangeError','ReferenceError','SyntaxError','TypeError','URIError','AggregateError',
  'RegExp','Promise','Date','parseInt','parseFloat','isNaN','isFinite','encodeURI','encodeURIComponent',
  'decodeURI','decodeURIComponent','escape','unescape','eval','fetch','setTimeout','clearTimeout',
  'setInterval','clearInterval','queueMicrotask','structuredClone','atob','btoa','requestAnimationFrame',
  'cancelAnimationFrame','require','alert','confirm','prompt','postMessage','getComputedStyle','matchMedia',
]);
const IDENTIFIER_NAME=/^[A-Za-z_$][\w$]*$/;
// P412: the binding part may begin immediately after the keyword
// (import{...}from'...' with no whitespace), which requiring \s+
// after import missed.
const IMPORT_BINDING_PATTERN=/import\s*(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*(?:,\s*)?)?(?:\{([^}]+)\})?(?:\*\s+as\s+([A-Za-z_$][\w$]*))?\s*from\s*['"][^'"]+['"]/g;

class SelfCodeUnderstandingService {
  // P401: per-tree assembly cache and per-(tree, targets) result
  // cache. Both are keyed by the content fingerprint of the source
  // tree, so a changed tree can never be served a stale answer.
  private assemblyCache=new Map<string,{
    entries:Map<string,CodeUnderstandingEntry>;
    contractIndex:Map<string,Set<string>>;
    contractOwners:Map<string,Set<string>>;
    knownCalleeNames:Set<string>;
    snapshot:CodeUnderstandingSnapshot;
  }>();
  private resultCache=new Map<string,CodeUnderstandingResult>();

  get():CodeUnderstandingSnapshot|undefined {
    try {
      const raw=storageService.getItem(KEY);
      if(!raw)return undefined;
      const parsed=JSON.parse(raw) as Partial<CodeUnderstandingSnapshot>;
      if(parsed.schemaVersion!==3||!Array.isArray(parsed.entries))return undefined;
      return parsed as CodeUnderstandingSnapshot;
    } catch {
      return undefined;
    }
  }

  private resolve(m:Map<string,CodeUnderstandingEntry>,from:string,raw:string):string|undefined {
    if(!raw.startsWith('.'))return undefined;
    const base=from.split('/').slice(0,-1).join('/');
    const out:string[]=[];
    for(const x of (base+'/'+raw).split('/')){
      if(!x||x==='.')continue;
      if(x==='..')out.pop();else out.push(x);
    }
    const s=out.join('/');
    return [s,s+'.ts',s+'.tsx',s+'/index.ts',s+'/index.tsx'].find(x=>m.has(x));
  }

  private scriptKind(path:string):ts.ScriptKind {
    if(path.endsWith('.tsx'))return ts.ScriptKind.TSX;
    if(path.endsWith('.jsx'))return ts.ScriptKind.JSX;
    if(path.endsWith('.js'))return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
  }

  private lineOf(source:ts.SourceFile,node:ts.Node):number {
    return source.getLineAndCharacterOfPosition(node.getStart(source,false)).line+1;
  }

  private textOf(node:ts.Node|undefined,source:ts.SourceFile,max=240):string {
    if(!node)return '';
    return node.getText(source).replace(/\s+/g,' ').slice(0,max);
  }

  private declarationName(node:ts.Declaration,source:ts.SourceFile):string {
    const named=node as ts.NamedDeclaration;
    return named.name?this.textOf(named.name,source,160):'';
  }

  // P412: every identifier bound by a (possibly nested) binding
  // pattern — [messages, setMessages], { createServer:
  // createViteServer }, destructured parameters. Only the bound
  // names are returned; an object pattern's property keys are not
  // bindings and are not collected.
  private bindingIdentifiers(name:ts.BindingName):string[] {
    if(ts.isIdentifier(name))return [name.text];
    const out:string[]=[];
    for(const element of name.elements){
      if(ts.isBindingElement(element))out.push(...this.bindingIdentifiers(element.name));
    }
    return out;
  }

  private isExported(node:ts.Node):boolean {
    const flags=ts.getCombinedModifierFlags(node as ts.Declaration);
    return Boolean(flags&ts.ModifierFlags.Export)||Boolean(flags&ts.ModifierFlags.Default);
  }

  private symbolKind(node:ts.Node):CodeSymbolKind|undefined {
    if(ts.isClassDeclaration(node))return 'CLASS';
    if(ts.isInterfaceDeclaration(node))return 'INTERFACE';
    if(ts.isTypeAliasDeclaration(node))return 'TYPE';
    if(ts.isFunctionDeclaration(node))return 'FUNCTION';
    if(ts.isMethodDeclaration(node)||ts.isMethodSignature(node))return 'METHOD';
    if(ts.isPropertyDeclaration(node)||ts.isPropertySignature(node))return 'PROPERTY';
    if(ts.isVariableDeclaration(node))return 'VARIABLE';
    if(ts.isEnumDeclaration(node))return 'ENUM';
    return undefined;
  }

  private classifyLiteral(value:string,callName:string|undefined):CodeLiteralContract['role'] {
    if(/^[A-Z][A-Z0-9_]{2,}$/.test(value)){
      if(/(?:COMMAND|CANDIDATE|VALIDATE|CREATE|GENERATE|RUN|ASSESS|RESOLVE|APPROVE|LEARN|DISCOVER)/.test(value))return 'DOMAIN_COMMAND';
      if(/(?:STATUS|READY|FAILED|COMPLETED|PAUSED|WAITING|BLOCKED|REJECTED|ACCEPTED)/.test(value))return 'STATUS';
    }
    if(callName&&EVENT_PUBLISH_METHODS.has(callName)||callName&&EVENT_SUBSCRIBE_METHODS.has(callName))return 'EVENT';
    if(callName&&STORAGE_READ_METHODS.has(callName)||callName&&STORAGE_WRITE_METHODS.has(callName))return 'STORAGE_KEY';
    if(/^miki_[a-z0-9_]+$/i.test(value))return 'STORAGE_KEY';
    return 'OTHER';
  }

  private parse(f:{path:string;content:string;contentHash:string}):CodeUnderstandingEntry {
    const source=ts.createSourceFile(f.path,f.content,ts.ScriptTarget.ES2022,true,this.scriptKind(f.path));
    const imports:string[]=[];
    const exports:string[]=[];
    const symbols:CodeSymbolRecord[]=[];
    const relations:CodeRelationRecord[]=[];
    const literalContracts:CodeLiteralContract[]=[];
    const parameterNames=new Set<string>();
    const ownerStack:string[]=[];

    const owner=()=>ownerStack.at(-1)||f.path;
    const addRelation=(kind:CodeRelationKind,to:string,node:ts.Node,evidence:string)=>{
      if(!to)return;
      relations.push({kind,from:owner(),to,line:this.lineOf(source,node),evidence:evidence.slice(0,240)});
    };

    const visit=(node:ts.Node):void=>{
      if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
        const spec=node.moduleSpecifier;
        if(spec&&ts.isStringLiteralLike(spec))imports.push(spec.text);
      }
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
        const arg=node.arguments[0];
        if(arg&&ts.isStringLiteralLike(arg))imports.push(arg.text);
      }

      // P412: parameter bindings of every function-like node, not
      // only of declared functions — inline callbacks and function
      // expressions bind names in this file too.
      const signatureLike=node as ts.SignatureDeclaration;
      if(Array.isArray(signatureLike.parameters)){
        for(const parameter of signatureLike.parameters)for(const bound of this.bindingIdentifiers(parameter.name))parameterNames.add(bound);
      }

      const kind=this.symbolKind(node);
      let pushed=false;
      if(kind){
        // P412: a destructuring declaration binds several names at
        // once. Registering only the pattern text ("[a, b]") left
        // every bound identifier — useState setters above all — out
        // of the symbol table, so calls to them counted as
        // unresolved edges and blocked requirement contracts.
        const variable=ts.isVariableDeclaration(node)?node:undefined;
        const names=variable&&(ts.isArrayBindingPattern(variable.name)||ts.isObjectBindingPattern(variable.name))
          ? this.bindingIdentifiers(variable.name)
          : [this.declarationName(node as ts.Declaration,source)].filter(name=>name.length>0);
        if(names.length){
          const parentName=ownerStack.at(-1);
          const signature=node as ts.SignatureDeclaration;
          const parameters=Array.isArray(signature.parameters)
            ? signature.parameters.map(parameter=>this.textOf(parameter.name,source,100))
            : [];
          const exported=this.isExported(node);
          const isAsync=Boolean(ts.getCombinedModifierFlags(node as ts.Declaration)&ts.ModifierFlags.Async);
          const line=this.lineOf(source,node);
          let ownerId='';
          for(const name of names){
            const qualifiedName=parentName&&parentName!==f.path?`${parentName}.${name}`:name;
            const id=`${f.path}#${qualifiedName}`;
            symbols.push({
              id,path:f.path,name,qualifiedName,kind,
              exported,async:isAsync,
              line,parameters,
              returnType:signature.type?this.textOf(signature.type,source,200):undefined
            });
            if(exported)exports.push(name);
            if(!ownerId)ownerId=id;
          }
          ownerStack.push(ownerId);
          pushed=true;

          if(ts.isClassDeclaration(node)&&node.heritageClauses){
            for(const clause of node.heritageClauses){
              const relationKind=clause.token===ts.SyntaxKind.ImplementsKeyword?'IMPLEMENTS':'EXTENDS';
              for(const type of clause.types)addRelation(relationKind,this.textOf(type.expression,source,180),type,this.textOf(type,source));
            }
          }
          if(ts.isInterfaceDeclaration(node)&&node.heritageClauses){
            for(const clause of node.heritageClauses)for(const type of clause.types)addRelation('EXTENDS',this.textOf(type.expression,source,180),type,this.textOf(type,source));
          }
        }
      }

      if(ts.isCallExpression(node)){
        const expressionText=this.textOf(node.expression,source,220);
        const callName=ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression)?node.expression.text:undefined;
        addRelation('CALLS',expressionText,node,expressionText);
        const first=node.arguments[0];
        if(first&&ts.isStringLiteralLike(first)){
          const value=first.text;
          if(callName&&STORAGE_READ_METHODS.has(callName))addRelation('READS_STORAGE',value,node,expressionText);
          if(callName&&STORAGE_WRITE_METHODS.has(callName))addRelation('WRITES_STORAGE',value,node,expressionText);
          if(callName&&EVENT_PUBLISH_METHODS.has(callName))addRelation('PUBLISHES_EVENT',value,node,expressionText);
          if(callName&&EVENT_SUBSCRIBE_METHODS.has(callName))addRelation('SUBSCRIBES_EVENT',value,node,expressionText);
          if(callName&&COMMAND_CALLS.has(callName))addRelation('USES_COMMAND',value,node,expressionText);
        }
      }

      if(ts.isPropertyAssignment(node)&&ts.isIdentifier(node.name)&&node.name.text==='command'&&ts.isStringLiteralLike(node.initializer)){
        addRelation('DECLARES_COMMAND',node.initializer.text,node,this.textOf(node,source));
      }

      if(ts.isStringLiteralLike(node)){
        const parent=node.parent;
        const call=ts.isCallExpression(parent)?parent:undefined;
        const callName=call
          ? ts.isPropertyAccessExpression(call.expression)?call.expression.name.text:ts.isIdentifier(call.expression)?call.expression.text:undefined
          : undefined;
        const role=this.classifyLiteral(node.text,callName);
        if(role!=='OTHER')literalContracts.push({value:node.text,role,line:this.lineOf(source,node),ownerSymbol:owner()===f.path?undefined:owner()});
      }

      ts.forEachChild(node,visit);
      if(pushed)ownerStack.pop();
    };
    visit(source);

    const sourceParseDiagnostics=(source as ts.SourceFile&{parseDiagnostics?:readonly ts.DiagnosticWithLocation[]}).parseDiagnostics||[];
    const parseDiagnostics=sourceParseDiagnostics.map(diagnostic=>{
      const message=ts.flattenDiagnosticMessageText(diagnostic.messageText,' ');
      const line=typeof diagnostic.start==='number'?source.getLineAndCharacterOfPosition(diagnostic.start).line+1:0;
      return `${line}:${message}`;
    });

    return {
      path:f.path,contentHash:f.contentHash,
      imports:[...new Set(imports)],importedBy:[],exports:[...new Set(exports)],
      symbols,relations:this.uniqueRelations(relations),
      literalContracts:this.uniqueLiterals(literalContracts),parseDiagnostics,
      parameterNames:[...parameterNames].sort(),
      role:this.extractRole(f.content)
    };
  }

  /** P363: extract a one-line role from the file's leading comment. */
  private extractRole(content:string):string|undefined{
    const head=content.slice(0,4000);
    const block=head.match(/\/\*\*?([\s\S]*?)\*\//);
    if(block){
      for(const rawLine of block[1].split('\n')){
        const line=rawLine.replace(/^\s*\*\s?/,'').trim();
        if(line&&!line.startsWith('@'))return line.slice(0,120);
      }
    }
    const lines=head.split('\n');
    for(const rawLine of lines){
      const line=rawLine.trim();
      if(!line)continue;
      if(line.startsWith('//')){
        const text=line.replace(/^\/\/\s?/,'').trim();
        if(text&&!text.startsWith('@'))return text.slice(0,120);
        continue;
      }
      break;
    }
    return undefined;
  }

  private uniqueRelations(relations:CodeRelationRecord[]):CodeRelationRecord[]{
    const seen=new Set<string>();
    return relations.filter(relation=>{
      const key=`${relation.kind}|${relation.from}|${relation.to}|${relation.line}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  private uniqueLiterals(values:CodeLiteralContract[]):CodeLiteralContract[]{
    const seen=new Set<string>();
    return values.filter(value=>{
      const key=`${value.role}|${value.value}|${value.line}|${value.ownerSymbol||''}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  private uniqueExecutionPaths(values:ExecutionPathRecord[]):ExecutionPathRecord[]{
    const seen=new Set<string>();
    return values.filter(value=>{const key=`${value.from}|${value.kind}|${value.to}|${value.evidence}`;if(seen.has(key))return false;seen.add(key);return true;})
      .sort((a,b)=>`${a.from}|${a.kind}|${a.to}`.localeCompare(`${b.from}|${b.kind}|${b.to}`));
  }

  public getSnapshot():CodeUnderstandingSnapshot|undefined{try{const raw=storageService.getItem(KEY);if(!raw)return undefined;const parsed=JSON.parse(raw) as CodeUnderstandingSnapshot;return parsed?.schemaVersion===3?parsed:undefined;}catch{return undefined;}}

  /** P363: record which commit the stored index was built from. */
  public stampSourceCommit(commitSha:string):void{
    if(!commitSha)return;
    const snapshot=this.getSnapshot();if(!snapshot||snapshot.sourceCommitSha===commitSha)return;
    try{storageService.setItem(KEY,JSON.stringify({...snapshot,sourceCommitSha:commitSha,updatedAt:Date.now()}));}catch{}
  }

  public exportsOf(path:string,content:string):string[]{return this.parse({path,content,contentHash:''}).exports;}

  // P353: the STATIC validation stage, identical to the server-side
  // check (typescript.transpileModule error diagnostics).
  public staticDiagnostics(path:string,content:string):Array<{code:number;path:string;message:string}>{
    if(!/\.(ts|tsx)$/.test(path))return [];
    const result=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true,fileName:path});
    return (result.diagnostics||[])
      .filter(d=>d.category===ts.DiagnosticCategory.Error)
      .map(d=>({code:d.code,path,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
  }

  ensure(targetPaths:string[],sourceFiles?:Array<{path:string;content:string;contentHash:string}>):CodeUnderstandingResult {
    const files=(sourceFiles||selfCodeSpaceService.listSourceFiles()).filter(file=>/\.(?:ts|tsx|js|jsx)$/.test(file.path));
    const empty:CodeUnderstandingResult={ready:false,reused:false,repoSha256:'',targetPaths,relatedPaths:[],reasons:[],symbolIds:[],executionRelations:[],contractValues:[],executionPaths:[],impactScopes:[],unresolvedEdges:[]};
    if(!files.length)return {...empty,reasons:['SOURCE_SNAPSHOT_EMPTY']};

    const repoSha256=canonicalSha256(files.map(file=>({path:file.path,sha256:file.contentHash})));
    const targets=[...new Set(targetPaths.filter(Boolean))].sort();

    // P401: the repository-wide assembly — parsed entries with
    // resolved imports, the contract index, contract owners and the
    // callee name set — is a pure function of the source tree, yet it
    // was rebuilt on every planning call (measured: seconds per call
    // even when nothing had changed, for any target set). The
    // assembly is now built once per tree version and reused; per
    // call, only the target-dependent closure and result tail run.
    // Finished results are also kept per (tree, targets): while the
    // tree is unchanged, the understanding answer cannot change.
    // Calls passing a sourceFiles override use their own keys: their
    // contents may be placeholders, so their assemblies and results
    // must never be served to full-content calls, or vice versa.
    const treeKey=`${sourceFiles?'override|':''}${repoSha256}`;
    const resultKey=`${treeKey}|${targets.join('|')}`;
    const cachedResult=this.resultCache.get(resultKey);
    if(cachedResult)return cachedResult;

    let previous:CodeUnderstandingSnapshot|undefined;
    let entries:Map<string,CodeUnderstandingEntry>;
    let contractIndex:Map<string,Set<string>>;
    let contractOwners:Map<string,Set<string>>;
    let knownCalleeNames:Set<string>;
    let assemblyReused=false;
    const cachedAssembly=this.assemblyCache.get(treeKey);
    if(cachedAssembly){
      previous=cachedAssembly.snapshot;
      entries=cachedAssembly.entries;
      contractIndex=cachedAssembly.contractIndex;
      contractOwners=cachedAssembly.contractOwners;
      knownCalleeNames=cachedAssembly.knownCalleeNames;
      assemblyReused=true;
    } else {
      previous=this.get();
      const current=new Map(files.map(file=>[file.path,file]));
      entries=new Map<string,CodeUnderstandingEntry>();
      if(previous){
        for(const entry of previous.entries){
          const file=current.get(entry.path);
          if(file&&file.contentHash===entry.contentHash)entries.set(entry.path,{...entry,importedBy:[]});
        }
      }
      for(const file of files)if(!entries.has(file.path))entries.set(file.path,this.parse(file));
      for(const entry of entries.values())for(const raw of entry.imports){
        const resolved=this.resolve(entries,entry.path,raw);
        if(resolved){
          entries.get(resolved)!.importedBy.push(entry.path);
          entry.relations.push({kind:'IMPORTS',from:entry.path,to:resolved,line:1,evidence:raw});
        }
      }
      for(const entry of entries.values()){
        entry.importedBy=[...new Set(entry.importedBy)].sort();
        entry.relations=this.uniqueRelations(entry.relations);
      }
      contractIndex=new Map<string,Set<string>>();
      for(const entry of entries.values())for(const literal of entry.literalContracts){
        const paths=contractIndex.get(`${literal.role}|${literal.value}`)||new Set<string>();
        paths.add(entry.path);contractIndex.set(`${literal.role}|${literal.value}`,paths);
      }
      contractOwners=new Map<string,Set<string>>();
      for(const entry of entries.values()){
        for(const contract of entry.literalContracts){
          if(contract.role==='OTHER')continue;
          const ownerKey=`${contract.role}:${contract.value}`;
          const owners=contractOwners.get(ownerKey)||new Set<string>();owners.add(entry.path);contractOwners.set(ownerKey,owners);
        }
      }
      knownCalleeNames=new Set<string>(BUILTIN_CALLEE_NAMES);
      for(const entry of entries.values()){
        for(const symbol of entry.symbols)knownCalleeNames.add(symbol.name);
        for(const name of entry.exports)knownCalleeNames.add(name);
      }
    }

    const missing=targets.filter(path=>!entries.has(path));
    if(missing.length)return {...empty,repoSha256,targetPaths:targets,reasons:[`TARGET_NOT_UNDERSTOOD:${missing.join('|')}`]};

    const related=new Set<string>();

    // P361: budgeted, direction-aware expansion (design doc:
    // Budgeted Evidence Packet). Impact flows mainly along dependents
    // (importedBy): a target's dependents, and their dependents, can
    // be affected by a change. Dependencies (imports) and rare-contract
    // peers matter at depth 1 only; expanding them further made every
    // target "related" to almost the whole repository (measured 986
    // of 1050 files), which destroyed the value of the scope.
    // Contract edges are followed only for rare contracts: a literal
    // shared by many files (common storage keys, generic status
    // values) is a weak edge and must not glue files together.
    const COMMON_CONTRACT_THRESHOLD=25;
    const DEPTH2_BUDGET=200;
    const MAX_RELATED=400;
    const seenAt=new Map<string,number>(targets.map(path=>[path,0]));
    const queueWithDepth: Array<{path:string;depth:number;viaDependent:boolean}>=targets.map(path=>({path,depth:0,viaDependent:true}));
    const admit=(neighbor:string,nd:number,viaDependent:boolean)=>{
      if(seenAt.has(neighbor))return;
      if(nd===2&&related.size>=DEPTH2_BUDGET)return;
      if(related.size>=MAX_RELATED)return;
      seenAt.set(neighbor,nd);
      if(!targets.includes(neighbor)){
        related.add(neighbor);queueWithDepth.push({path:neighbor,depth:nd,viaDependent});
      }
    };
    while(queueWithDepth.length){
      const {path,depth,viaDependent}=queueWithDepth.shift()!;
      const entry=entries.get(path);if(!entry)continue;
      if(depth===0){
        for(const importedBy of entry.importedBy)admit(importedBy,1,true);
        for(const raw of entry.imports){const resolved=this.resolve(entries,path,raw);if(resolved)admit(resolved,1,false);}
        for(const literal of entry.literalContracts){
          const peers=contractIndex.get(`${literal.role}|${literal.value}`);
          if(!peers||peers.size>COMMON_CONTRACT_THRESHOLD)continue;
          for(const peer of peers)if(peer!==path)admit(peer,1,false);
        }
      } else if(depth===1&&viaDependent){
        for(const importedBy of entry.importedBy)admit(importedBy,2,false);
      }
    }

    const scope=[...targets,...related].sort();
    const scopeEntries=scope.map(path=>entries.get(path)!).filter(Boolean);
    const fingerprint=canonicalSha256(scopeEntries.map(entry=>({
      path:entry.path,contentHash:entry.contentHash,imports:entry.imports,exports:entry.exports,
      symbols:entry.symbols.map(symbol=>symbol.id),
      contracts:entry.literalContracts.map(value=>`${value.role}:${value.value}`)
    })));
    const key=targets.join('|');
    const reused=Boolean(previous?.targetFingerprints?.[key]===fingerprint);
    const now=Date.now();
    // P401: on an assembly-cache hit, the stored snapshot already
    // describes this exact tree; only the target fingerprint record
    // may need to grow. Recomputing the whole-tree snapshot hash on
    // every call was part of the repeated cost.
    const snapshot:CodeUnderstandingSnapshot=assemblyReused&&previous?{
      ...previous,
      targetFingerprints:{...(previous.targetFingerprints||{}),[key]:fingerprint},
      updatedAt:now
    }:{
      schemaVersion:3,repoSha256,
      snapshotSha256:canonicalSha256([...entries.values()].map(entry=>({
        path:entry.path,contentHash:entry.contentHash,symbols:entry.symbols,relations:entry.relations,literalContracts:entry.literalContracts
      }))),
      entries:[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path)),
      createdAt:previous?.createdAt||now,updatedAt:now,
      targetFingerprints:{...(previous?.targetFingerprints||{}),[key]:fingerprint},
      sourceCommitSha:previous?.sourceCommitSha
    };
    const targetFingerprintChanged=previous?.targetFingerprints?.[key]!==fingerprint;
    const snapshotChanged=previous?.snapshotSha256!==snapshot.snapshotSha256;
    if(!previous||snapshotChanged||targetFingerprintChanged)storageService.setItem(KEY,JSON.stringify(snapshot));
    if(this.assemblyCache.size>=3)this.assemblyCache.clear();
    this.assemblyCache.set(treeKey,{entries,contractIndex,contractOwners,knownCalleeNames,snapshot});

    const targetSet=new Set(targets);
    const executionPaths:ExecutionPathRecord[]=[];
    const unresolvedEdges:string[]=[];
    // P400: a bare CALLS relation counts as unresolved only when the
    // callee is accounted for nowhere — not declared anywhere in the
    // repository, not imported by the calling file, not one of its
    // parameters, and not a platform builtin. The previous rule
    // flagged every bare identifier call (Number, String, same-file
    // helpers, imported functions), which put hundreds of phantom
    // edges on ordinary files; edges originating in the target files
    // block the context closure and the requirement contract, so the
    // candidate-generation gate was unreachable for any real target.
    const contentByPath=new Map(files.map(file=>[file.path,file.content]));
    const calleeNamesFor=(entry:CodeUnderstandingEntry):Set<string>=>{
      const names=new Set(knownCalleeNames);
      const content=contentByPath.get(entry.path)||'';
      for(const match of content.matchAll(IMPORT_BINDING_PATTERN)){
        if(match[1])names.add(match[1]);
        if(match[3])names.add(match[3]);
        if(match[2])for(const part of match[2].split(',')){
          const clean=part.trim().replace(/^type\s+/,'');
          if(!clean)continue;
          const alias=clean.split(/\s+as\s+/);
          names.add((alias[1]||alias[0]).trim());
        }
      }
      for(const symbol of entry.symbols)for(const parameter of symbol.parameters)if(IDENTIFIER_NAME.test(parameter))names.add(parameter);
      // P412: parameters of function expressions and inline
      // callbacks bind names in this file too; parse() collects
      // them per entry (older snapshots may not carry the field).
      for(const name of entry.parameterNames||[])names.add(name);
      return names;
    };
    for(const entry of scopeEntries){
      const calleeNames=calleeNamesFor(entry);
      for(const relation of entry.relations){
        executionPaths.push({from:relation.from,to:relation.to,kind:relation.kind,evidence:`${entry.path}:${relation.line}:${relation.evidence}`});
        // P412: a CALLS target that is not identifier-shaped is an
        // expression fragment (a truncated array literal, a cast
        // expression), not a name — name collection can never
        // account for it, so it must not count as an unresolved edge.
        if(relation.kind==='CALLS'&&IDENTIFIER_NAME.test(relation.to)&&!relation.to.includes('.')&&!relation.to.includes('/')&&relation.to!=='import'&&!calleeNames.has(relation.to))unresolvedEdges.push(`${entry.path}:${relation.line}:CALLS:${relation.to}`);
      }
      for(const contract of entry.literalContracts){
        if(contract.role==='OTHER')continue;
        const key=`${contract.role}:${contract.value}`;
        for(const other of contractOwners.get(key)||[]){
          if(other!==entry.path)executionPaths.push({from:entry.path,to:other,kind:'SHARES_CONTRACT',evidence:key});
        }
      }
    }
    const impactScopes:ImpactScopeRecord[]=scopeEntries.map(entry=>{
      const contracts=entry.literalContracts.filter(item=>item.role!=='OTHER').map(item=>`${item.role}:${item.value}`);
      const direct=targetSet.has(entry.path);
      const sharedWithTarget=contracts.some(value=>targets.some(target=>entries.get(target)?.literalContracts.some(item=>`${item.role}:${item.value}`===value)));
      const scope:ImpactScope=direct?'MUST_CHANGE':TEST_PATH.test(entry.path)?'TEST_ONLY':sharedWithTarget?'CONTRACT_DEPENDENCY':entry.imports.some(raw=>{const resolved=this.resolve(entries,entry.path,raw);return resolved?targetSet.has(resolved):false;})||entry.importedBy.some(path=>targetSet.has(path))?'MUST_INSPECT':'POSSIBLY_RELATED';
      const reasons=[direct?'EXPLICIT_TARGET':TEST_PATH.test(entry.path)?'TEST_PATH':sharedWithTarget?'SHARED_COMMAND_EVENT_OR_STORAGE_CONTRACT':'DEPENDENCY_EXPANSION'];
      return {path:entry.path,scope,reasons,symbolIds:entry.symbols.map(symbol=>symbol.id),contractValues:contracts};
    }).sort((a,b)=>a.path.localeCompare(b.path));

    const result:CodeUnderstandingResult={
      ready:scopeEntries.every(entry=>entry.parseDiagnostics.length===0),reused,repoSha256,
      targetPaths:targets,relatedPaths:[...related].sort(),
      reasons:scopeEntries.flatMap(entry=>entry.parseDiagnostics.map(reason=>`PARSE_DIAGNOSTIC:${entry.path}:${reason}`)),
      snapshotSha256:snapshot.snapshotSha256,
      symbolIds:scopeEntries.flatMap(entry=>entry.symbols.map(symbol=>symbol.id)).sort(),
      executionRelations:scopeEntries.flatMap(entry=>entry.relations).sort((a,b)=>`${a.from}|${a.kind}|${a.to}`.localeCompare(`${b.from}|${b.kind}|${b.to}`)),
      contractValues:[...new Set(scopeEntries.flatMap(entry=>entry.literalContracts.map(value=>`${value.role}:${value.value}`)))].sort(),
      executionPaths:this.uniqueExecutionPaths(executionPaths),impactScopes,unresolvedEdges:[...new Set(unresolvedEdges)].sort()
    };
    if(this.resultCache.size>=8)this.resultCache.clear();
    this.resultCache.set(resultKey,result);
    return result;
  }
}
export const selfCodeUnderstandingService=new SelfCodeUnderstandingService();

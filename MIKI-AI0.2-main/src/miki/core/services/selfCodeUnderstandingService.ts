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
}

export interface CodeUnderstandingSnapshot {
  schemaVersion:2;
  repoSha256:string;
  snapshotSha256:string;
  entries:CodeUnderstandingEntry[];
  createdAt:number;
  updatedAt:number;
  targetFingerprints:Record<string,string>;
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

class SelfCodeUnderstandingService {
  get():CodeUnderstandingSnapshot|undefined {
    try {
      const raw=storageService.getItem(KEY);
      if(!raw)return undefined;
      const parsed=JSON.parse(raw) as Partial<CodeUnderstandingSnapshot>;
      if(parsed.schemaVersion!==2||!Array.isArray(parsed.entries))return undefined;
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

      const kind=this.symbolKind(node);
      let pushed=false;
      if(kind){
        const name=this.declarationName(node as ts.Declaration,source);
        if(name){
          const parentName=ownerStack.at(-1);
          const qualifiedName=parentName&&parentName!==f.path?`${parentName}.${name}`:name;
          const id=`${f.path}#${qualifiedName}`;
          const signature=node as ts.SignatureDeclaration;
          const parameters=Array.isArray(signature.parameters)
            ? signature.parameters.map(parameter=>this.textOf(parameter.name,source,100))
            : [];
          const record:CodeSymbolRecord={
            id,path:f.path,name,qualifiedName,kind,
            exported:this.isExported(node),
            async:Boolean(ts.getCombinedModifierFlags(node as ts.Declaration)&ts.ModifierFlags.Async),
            line:this.lineOf(source,node),parameters,
            returnType:signature.type?this.textOf(signature.type,source,200):undefined
          };
          symbols.push(record);
          if(record.exported)exports.push(name);
          ownerStack.push(id);
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
      literalContracts:this.uniqueLiterals(literalContracts),parseDiagnostics
    };
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

  public getSnapshot():CodeUnderstandingSnapshot|undefined{try{const raw=storageService.getItem(KEY);if(!raw)return undefined;const parsed=JSON.parse(raw) as CodeUnderstandingSnapshot;return parsed?.schemaVersion===2?parsed:undefined;}catch{return undefined;}}

  ensure(targetPaths:string[]):CodeUnderstandingResult {
    const files=selfCodeSpaceService.listSourceFiles().filter(file=>/\.(?:ts|tsx|js|jsx)$/.test(file.path));
    const empty:CodeUnderstandingResult={ready:false,reused:false,repoSha256:'',targetPaths,relatedPaths:[],reasons:[],symbolIds:[],executionRelations:[],contractValues:[],executionPaths:[],impactScopes:[],unresolvedEdges:[]};
    if(!files.length)return {...empty,reasons:['SOURCE_SNAPSHOT_EMPTY']};

    const repoSha256=canonicalSha256(files.map(file=>({path:file.path,sha256:file.contentHash})));
    const previous=this.get();
    const current=new Map(files.map(file=>[file.path,file]));
    const entries=new Map<string,CodeUnderstandingEntry>();

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

    const targets=[...new Set(targetPaths.filter(Boolean))].sort();
    const missing=targets.filter(path=>!entries.has(path));
    if(missing.length)return {...empty,repoSha256,targetPaths:targets,reasons:[`TARGET_NOT_UNDERSTOOD:${missing.join('|')}`]};

    const related=new Set<string>();
    const queue=[...targets];
    const contractIndex=new Map<string,Set<string>>();
    for(const entry of entries.values())for(const literal of entry.literalContracts){
      const paths=contractIndex.get(`${literal.role}|${literal.value}`)||new Set<string>();
      paths.add(entry.path);contractIndex.set(`${literal.role}|${literal.value}`,paths);
    }

    while(queue.length){
      const path=queue.shift()!;
      const entry=entries.get(path);if(!entry)continue;
      const neighbors=new Set<string>();
      for(const raw of entry.imports){const resolved=this.resolve(entries,path,raw);if(resolved)neighbors.add(resolved);}
      for(const importedBy of entry.importedBy)neighbors.add(importedBy);
      for(const literal of entry.literalContracts){
        const peers=contractIndex.get(`${literal.role}|${literal.value}`);
        for(const peer of peers||[])if(peer!==path)neighbors.add(peer);
      }
      for(const neighbor of neighbors){
        if(!targets.includes(neighbor)&&!related.has(neighbor)){
          related.add(neighbor);queue.push(neighbor);
        }
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
    const snapshot:CodeUnderstandingSnapshot={
      schemaVersion:2,repoSha256,
      snapshotSha256:canonicalSha256([...entries.values()].map(entry=>({
        path:entry.path,contentHash:entry.contentHash,symbols:entry.symbols,relations:entry.relations,literalContracts:entry.literalContracts
      }))),
      entries:[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path)),
      createdAt:previous?.createdAt||now,updatedAt:now,
      targetFingerprints:{...(previous?.targetFingerprints||{}),[key]:fingerprint}
    };
    storageService.setItem(KEY,JSON.stringify(snapshot));

    const targetSet=new Set(targets);
    const contractOwners=new Map<string,Set<string>>();
    for(const entry of entries.values()){
      for(const contract of entry.literalContracts){
        if(contract.role==='OTHER')continue;
        const key=`${contract.role}:${contract.value}`;
        const owners=contractOwners.get(key)||new Set<string>();owners.add(entry.path);contractOwners.set(key,owners);
      }
    }
    const executionPaths:ExecutionPathRecord[]=[];
    const unresolvedEdges:string[]=[];
    for(const entry of scopeEntries){
      for(const relation of entry.relations){
        executionPaths.push({from:relation.from,to:relation.to,kind:relation.kind,evidence:`${entry.path}:${relation.line}:${relation.evidence}`});
        if(relation.kind==='CALLS'&&!relation.to.includes('.')&&!relation.to.includes('/'))unresolvedEdges.push(`${entry.path}:${relation.line}:CALLS:${relation.to}`);
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
      const scope:ImpactScope=direct?'MUST_CHANGE':TEST_PATH.test(entry.path)?'TEST_ONLY':sharedWithTarget?'CONTRACT_DEPENDENCY':entry.imports.some(path=>targetSet.has(path))||entry.importedBy.some(path=>targetSet.has(path))?'MUST_INSPECT':'POSSIBLY_RELATED';
      const reasons=[direct?'EXPLICIT_TARGET':TEST_PATH.test(entry.path)?'TEST_PATH':sharedWithTarget?'SHARED_COMMAND_EVENT_OR_STORAGE_CONTRACT':'DEPENDENCY_EXPANSION'];
      return {path:entry.path,scope,reasons,symbolIds:entry.symbols.map(symbol=>symbol.id),contractValues:contracts};
    }).sort((a,b)=>a.path.localeCompare(b.path));

    return {
      ready:scopeEntries.every(entry=>entry.parseDiagnostics.length===0),reused,repoSha256,
      targetPaths:targets,relatedPaths:[...related].sort(),
      reasons:scopeEntries.flatMap(entry=>entry.parseDiagnostics.map(reason=>`PARSE_DIAGNOSTIC:${entry.path}:${reason}`)),
      snapshotSha256:snapshot.snapshotSha256,
      symbolIds:scopeEntries.flatMap(entry=>entry.symbols.map(symbol=>symbol.id)).sort(),
      executionRelations:scopeEntries.flatMap(entry=>entry.relations).sort((a,b)=>`${a.from}|${a.kind}|${a.to}`.localeCompare(`${b.from}|${b.kind}|${b.to}`)),
      contractValues:[...new Set(scopeEntries.flatMap(entry=>entry.literalContracts.map(value=>`${value.role}:${value.value}`)))].sort(),
      executionPaths:this.uniqueExecutionPaths(executionPaths),impactScopes,unresolvedEdges:[...new Set(unresolvedEdges)].sort()
    };
  }
}
export const selfCodeUnderstandingService=new SelfCodeUnderstandingService();

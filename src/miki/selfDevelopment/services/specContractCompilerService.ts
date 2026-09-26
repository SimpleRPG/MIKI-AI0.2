/**
 * 設計思想 第159章/130章: 仕様最小化・規範コンパイル。
 * 原文を削除せず、実行時に必要な「追跡可能な最小契約」へ射影する。
 * 生成モデルには依存しない。spec hash が変われば契約は自動的に無効化される。
 */
import { systemLogger } from '../../../services/systemLogger';
import { storageService } from '../../../services/storageService';
import { selfCodeUnderstandingService, type ImpactScopeRecord } from '../../core/services/selfCodeUnderstandingService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { AstCandidateOperation } from './astCandidateTransformationService';
import { contractPropagationService } from './contractPropagationService';

export type ContractStatus = 'VALID' | 'INVALIDATED' | 'BLOCKED_SPEC_CONFLICT';
export type Norm = 'MUST' | 'MUST_NOT' | 'SHOULD' | 'MAY' | 'UNKNOWN';
export interface SpecContractClause {
  requirementId: string;
  sourceChapter: number;
  sourceLine: number;
  norm: Norm;
  text: string;
  purpose: string;
  conditions: string[];
  dependencies: string[];
  prohibitions: string[];
  acceptanceEvidence: string[];
  supersedes?: string;
}
export interface SpecContract {
  contractId: string;
  sourcePath: string;
  sourceHash: string;
  compiledAt: number;
  status: ContractStatus;
  clauses: SpecContractClause[];
}

export interface ImprovementRequirementContract {
  schemaVersion:2; contractId:string; objective:string; targetPaths:string[];
  requirements:string[]; prohibitions:string[]; invariants:string[];
  validationRequirements:string[]; deliveryRequirements:string[];
  impactScopes:ImpactScopeRecord[]; executionPathCount:number; repositorySnapshotSha256?:string;
  reusableComponentIds:string[]; codeKnowledgeIds:string[]; unresolved:string[];
  status:'READY'|'BLOCKED'; createdAt:number;
}
export interface ImprovementRequirementInput {
  objective:string; targetPaths:string[]; requirements?:string[]; prohibitions?:string[];
  invariants?:string[]; validationRequirements?:string[]; deliveryRequirements?:string[];
  reusableComponentIds?:string[]; codeKnowledgeIds?:string[];
}

export type SpecFileReader = (specPath: string) => string | null;

let customFileReader: SpecFileReader | null = null;

export function setSpecFileReader(reader: SpecFileReader | null) {
  customFileReader = reader;
}

const KEY = 'miki_spec_contract_v1';
const DEFAULT_SPEC = 'docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt';

function hash(raw: string): string { let h = 2166136261; for (let i=0;i<raw.length;i++){h ^= raw.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
function normOf(text: string): Norm {
  if (/禁止|してはなら|MUST NOT|DO NOT/i.test(text)) return 'MUST_NOT';
  if (/必須|必ず|MUST|絶対/i.test(text)) return 'MUST';
  if (/推奨|望ま|SHOULD/i.test(text)) return 'SHOULD';
  if (/許可|可能|MAY/i.test(text)) return 'MAY';
  return 'UNKNOWN';
}
function chapterOf(line: string, current: number): number {
  const m = line.match(/(?:第\s*|Chapter\s+)(\d+)(?:章)?/i); return m ? Number(m[1]) : current;
}

export class SpecContractCompilerService {
  private contract: SpecContract | null = null;
  constructor() { this.load(); }
  private load() { try { const raw = storageService.getItem(KEY); if (raw) this.contract = JSON.parse(raw); } catch { this.contract = null; } }
  private save() { try { storageService.setItem(KEY, JSON.stringify(this.contract)); } catch {} }

  public compile(specPath = DEFAULT_SPEC, explicitSource?: string): SpecContract {
    const source = explicitSource || (customFileReader ? customFileReader(specPath) : '') || '';
    if (!source) {
      if (this.contract && this.contract.status === 'VALID') return this.contract;
      throw new Error(`specification source not found: ${specPath}`);
    }
    const sourceHash = hash(source);
    if (this.contract && this.contract.sourceHash === sourceHash && this.contract.status === 'VALID') return this.contract;
    const lines = source.split(/\r?\n/);
    let chapter = 0;
    const clauses: SpecContractClause[] = [];
    for (let i=0;i<lines.length;i++) {
      const line = lines[i].trim(); if (!line) continue;
      chapter = chapterOf(line, chapter);
      const n = normOf(line);
      if (n === 'UNKNOWN' && !/[：:]/.test(line)) continue;
      const requirementId = `REQ-${chapter}-${i+1}-${hash(line).slice(0,6)}`;
      clauses.push({ requirementId, sourceChapter: chapter, sourceLine: i+1, norm: n, text: line.slice(0,500), purpose: this.purpose(line), conditions: this.extract(line, /(?:条件|場合|when|if)[:：]?\s*(.+)/i), dependencies: this.extract(line, /(?:依存|依存関係|depends? on)[:：]?\s*(.+)/i), prohibitions: n === 'MUST_NOT' ? [line.slice(0,500)] : [], acceptanceEvidence: this.acceptance(line) });
    }
    this.contract = { contractId: `SPEC-${sourceHash}`, sourcePath: specPath, sourceHash, compiledAt: Date.now(), status: 'VALID', clauses: clauses.slice(0,5000) };
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[第159章 仕様契約コンパイラ] ${clauses.length} clauses / hash=${sourceHash}`);
    return this.contract;
  }
  private purpose(text:string):string { return /安全|保護|privacy|rollback|禁止/i.test(text) ? 'safety/invariant' : /性能|高速|容量|cache/i.test(text) ? 'performance' : /検証|test|回帰|証拠/i.test(text) ? 'verification' : 'behavior'; }
  private extract(text:string, re:RegExp):string[] { const m=text.match(re); return m ? [m[1].slice(0,300)] : []; }
  private acceptance(text:string):string[] { const a:string[]=[]; if (/検証|テスト|回帰|証拠|再現/i.test(text)) a.push('deterministic verification evidence'); if (/禁止|保護/i.test(text)) a.push('negative/prohibition check'); if (!a.length) a.push('source traceability + regression check'); return a; }
  public getContract(): SpecContract | null { return this.contract ? JSON.parse(JSON.stringify(this.contract)) : null; }
  public audit(specPath = DEFAULT_SPEC): { valid:boolean; currentHash:string|null; contractHash:string|null; invalidated:boolean; clauseCount:number } {
    const source = customFileReader ? customFileReader(specPath) : null;
    if (!source) return {valid:this.contract ? this.contract.status === 'VALID' : true, currentHash:null, contractHash:this.contract?.sourceHash||null, invalidated:false, clauseCount:this.contract?.clauses.length||0};
    const currentHash = hash(source); const invalidated = !!this.contract && this.contract.sourceHash !== currentHash;
    if (invalidated && this.contract) { this.contract.status='INVALIDATED'; this.save(); }
    return {valid:!invalidated, currentHash, contractHash:this.contract?.sourceHash||null, invalidated, clauseCount:this.contract?.clauses.length||0};
  }


  public compileImprovementRequirement(input:ImprovementRequirementInput):ImprovementRequirementContract {
    const clean=(values:string[]|undefined)=>[...new Set((values||[]).map(value=>value.trim()).filter(Boolean))];
    const targetPaths=clean(input.targetPaths).sort(); const objective=input.objective.trim();
    const requirements=clean(input.requirements); const prohibitions=clean(input.prohibitions);
    const invariants=clean(input.invariants); const validationRequirements=clean(input.validationRequirements);
    const deliveryRequirements=clean(input.deliveryRequirements);
    const understanding=selfCodeUnderstandingService.ensure(targetPaths); const unresolved:string[]=[]; const blockers:string[]=[];
    if(!objective){unresolved.push('OBJECTIVE_REQUIRED');blockers.push('OBJECTIVE_REQUIRED');} if(targetPaths.length===0){unresolved.push('TARGET_PATHS_REQUIRED');blockers.push('TARGET_PATHS_REQUIRED');}
    if(!understanding.ready){unresolved.push(...understanding.reasons);blockers.push(...understanding.reasons);}
    if(understanding.unresolvedEdges.length>0)unresolved.push(...understanding.unresolvedEdges.map(value=>`UNRESOLVED_EDGE:${value}`));
    if(requirements.length===0){unresolved.push('REQUIREMENTS_REQUIRED');blockers.push('REQUIREMENTS_REQUIRED');}
    if(validationRequirements.length===0){unresolved.push('VALIDATION_REQUIREMENTS_REQUIRED');blockers.push('VALIDATION_REQUIREMENTS_REQUIRED');}
    const reusableComponentIds=clean(input.reusableComponentIds).sort(); const codeKnowledgeIds=clean(input.codeKnowledgeIds).sort();
    const seed={objective,targetPaths,requirements,prohibitions,invariants,validationRequirements,deliveryRequirements,repositorySnapshotSha256:understanding.snapshotSha256,reusableComponentIds,codeKnowledgeIds};
    return {schemaVersion:2,contractId:`IMPROVEMENT-${canonicalSha256(seed).slice(0,24)}`,objective,targetPaths,requirements,prohibitions,invariants,
      validationRequirements,deliveryRequirements,impactScopes:understanding.impactScopes,executionPathCount:understanding.executionPaths.length,
      repositorySnapshotSha256:understanding.snapshotSha256,reusableComponentIds,codeKnowledgeIds,unresolved:[...new Set(unresolved)].sort(),
      status:blockers.length===0?'READY':'BLOCKED',createdAt:Date.now()};
  }


  public compileContractPropagationOperations(objective:string,targetPaths:string[]):Array<{path:string;operations:AstCandidateOperation[]}>{
    const text=objective.trim();
    const match=text.match(/([A-Za-z_$][\w$]*)\s*[:：]\s*([^\s、。]+)\s*を\s*(?:interface|インターフェース)\s*([A-Za-z_$][\w$]*)\s*(?:と|、)\s*(?:object|オブジェクト|変数)\s*([A-Za-z_$][\w$]*)\s*(?:へ|に)\s*(?:値\s*)?([^\s、。]+)\s*として?伝播/i);
    if(!match)return [];
    const consumer=text.match(/(?:consumer|コンシューマ|関数|メソッド)\s+([A-Za-z_$][\w$]*)\s*(?:へ|に)\s*引数/i);
    const validator=text.match(/(?:validator|検証関数|関数|メソッド)\s+([A-Za-z_$][\w$]*)\s*(?:へ|に)\s*条件\s*([^、。]+?)\s*失敗\s*([^、。]+)$/i);
    const plan=contractPropagationService.plan({
      fieldName:match[1],fieldType:match[2],interfaceNames:[match[3]],producerObjectNames:[match[4]],producerExpression:match[5],targetPaths,
      consumerFunctions:consumer?[consumer[1]]:[],validationFunctions:validator?[validator[1]]:[],
      validationCondition:validator?.[2]?.trim(),validationFailureStatement:validator?.[3]?.trim(),
      callSiteCallees:consumer?[consumer[1]]:[],callArgumentExpression:match[1]
    });
    return plan.unresolved.length===0?plan.transformations:[];
  }

  public compileAllDeterministicAstOperations(objective:string,targetPaths:string[]):Array<{path:string;operations:AstCandidateOperation[]}>{
    const rows=[...this.compileDeterministicAstOperations(objective,targetPaths),...this.compileContractPropagationOperations(objective,targetPaths)];
    const combined=new Map<string,AstCandidateOperation[]>();
    for(const row of rows){const current=combined.get(row.path)||[];for(const operation of row.operations){if(!current.some(item=>canonicalSha256(item)===canonicalSha256(operation)))current.push(operation);}combined.set(row.path,current);}
    return [...combined.entries()].map(([path,operations])=>({path,operations})).sort((a,b)=>a.path.localeCompare(b.path));
  }

  public compileDeterministicAstOperations(objective:string,targetPaths:string[]):Array<{path:string;operations:AstCandidateOperation[]}>{
    if(targetPaths.length!==1)return [];
    const text=objective.trim();const operations:AstCandidateOperation[]=[];
    const interfaceField=text.match(/(?:interface|インターフェース)\s+([A-Za-z_$][\w$]*)\s*(?:に|へ)\s*([A-Za-z_$][\w$]*)\s*[:：]\s*([^\s、。]+)\s*(?:フィールド|項目)?を追加/i);
    if(interfaceField)operations.push({kind:'ADD_INTERFACE_FIELD',interfaceName:interfaceField[1],fieldName:interfaceField[2],fieldType:interfaceField[3]});
    const parameter=text.match(/(?:function|関数|メソッド)\s+([A-Za-z_$][\w$]*)\s*(?:に|へ)\s*([A-Za-z_$][\w$]*)\s*[:：]\s*([^\s、。]+)\s*(?:引数|パラメータ)を追加/i);
    if(parameter)operations.push({kind:'ADD_PARAMETER',functionName:parameter[1],parameterName:parameter[2],parameterType:parameter[3]});
    const property=text.match(/(?:object|オブジェクト|変数)\s+([A-Za-z_$][\w$]*)\s*(?:に|へ)\s*([A-Za-z_$][\w$]*)\s*=\s*([^、。]+?)\s*(?:プロパティ|項目)?を追加/i);
    if(property)operations.push({kind:'ADD_OBJECT_PROPERTY',variableName:property[1],propertyName:property[2],expression:property[3].trim()});
    const importMatch=text.match(/(?:from\s+['"]([^'"]+)['"]\s+)?import\s*\{([^}]+)\}\s*(?:from\s+['"]([^'"]+)['"])?\s*を追加/i);
    if(importMatch){const moduleSpecifier=(importMatch[1]||importMatch[3]||'').trim();const namedImports=importMatch[2].split(',').map(value=>value.trim()).filter(Boolean);if(moduleSpecifier&&namedImports.length>0)operations.push({kind:'ADD_IMPORT',moduleSpecifier,namedImports});}
    return operations.length>0?[{path:targetPaths[0],operations}]:[];
  }
}
export const specContractCompilerService = new SpecContractCompilerService();

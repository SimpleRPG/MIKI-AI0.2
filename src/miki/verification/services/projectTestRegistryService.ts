import { storageService } from '../../../services/storageService';
export interface ProjectTestDefinition { id:string; filePatterns:string[]; command:string; args:string[]; kind:'UNIT'|'REGRESSION'|'BUILD'; requiresDependencies:boolean; timeoutMs:number; }
const KEY='miki_project_test_registry_v1';
export class ProjectTestRegistryService {
 private tests:ProjectTestDefinition[]=[];
 constructor(){this.load();if(!this.tests.length)this.seed();}
 public select(files:string[]):ProjectTestDefinition[]{return this.tests.filter(t=>t.filePatterns.some(p=>files.some(f=>new RegExp(p).test(f))));}
 public list():ProjectTestDefinition[]{return this.tests.map(t=>({...t,filePatterns:[...t.filePatterns],args:[...t.args]}));}
 private seed(){this.tests=[
  {id:'typescript-typecheck',filePatterns:['\\.tsx?$'],command:'npm',args:['run','lint'],kind:'REGRESSION',requiresDependencies:true,timeoutMs:180000},
  {id:'vite-server-build',filePatterns:['^(src/|server\\.ts$|vite\\.config\\.ts$)'],command:'npm',args:['run','build'],kind:'BUILD',requiresDependencies:true,timeoutMs:300000},
  {id:'deterministic-boundary-v59',filePatterns:['^(src/services/|server\\.ts$)'],command:'npm',args:['run','test:deterministic-execution-v59'],kind:'UNIT',requiresDependencies:true,timeoutMs:180000},
  {id:'autonomous-hardening',filePatterns:['^(src/services/|server\\.ts$)'],command:'npm',args:['run','test:autonomous-hardening'],kind:'REGRESSION',requiresDependencies:true,timeoutMs:180000},
 ];this.save();}
 private load(){try{this.tests=storageService.getJson(KEY, []);}catch{this.tests=[];}}
 private save(){storageService.setItem(KEY,JSON.stringify(this.tests));}
}
export const projectTestRegistryService=new ProjectTestRegistryService();

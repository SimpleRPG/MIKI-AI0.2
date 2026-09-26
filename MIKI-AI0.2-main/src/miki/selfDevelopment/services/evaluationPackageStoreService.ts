import { storageService } from '../../../services/storageService';
import type { EvaluationPackageOutput } from './evaluationPackageExportService';
const KEY='miki_evaluation_packages_v1';
export interface StoredEvaluationPackage { packageId:string; revision:number; zipBase64:string; zipTxtBase64:string; zipSha256:string; fileCount:number; createdAt:number; }
class EvaluationPackageStoreService {
 public save(output:EvaluationPackageOutput):StoredEvaluationPackage{const rows=this.list();const revision=Math.max(0,...rows.filter(row=>row.packageId===output.packageId).map(row=>row.revision))+1;const row={packageId:output.packageId,revision,zipBase64:this.base64(output.zipBytes),zipTxtBase64:this.base64(output.zipTxtBytes),zipSha256:output.zipSha256,fileCount:output.fileCount,createdAt:Date.now()};rows.push(row);storageService.setItem(KEY,JSON.stringify(rows.slice(-100)));return {...row};}
 public list():StoredEvaluationPackage[]{try{const raw=storageService.getItem(KEY);const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows.map(row=>({...row})):[];}catch{return [];}}
 public get(packageId:string,revision?:number):StoredEvaluationPackage|undefined{const rows=this.list().filter(row=>row.packageId===packageId);const target=revision??Math.max(0,...rows.map(row=>row.revision));const row=rows.find(item=>item.revision===target);return row?{...row}:undefined;}
 private base64(bytes:Uint8Array):string{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
}
export const evaluationPackageStoreService=new EvaluationPackageStoreService();

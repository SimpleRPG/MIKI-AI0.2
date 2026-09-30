import { storageService } from '../../../services/storageService';
import type { NativeOperationKind, NativeOperationMode } from './nativeOperationContractService';

type ReceiptStatus='MATCHED'|'MISMATCHED'|'FAILED'|'COMPLETED'|'CANCELLED';
export interface NativeOperationReceipt {
  receiptId:string;
  operation:NativeOperationKind;
  mode:NativeOperationMode;
  engine:'RUST'|'TYPESCRIPT';
  apiVersion:number;
  durationMs:number;
  status:ReceiptStatus;
  createdAt:number;
  fileCount?:number;
  totalBytes?:number;
  outputSha256?:string;
  metadata?:Record<string,string|number|boolean>;
  error?:string;
}

const KEY='miki_native_operation_receipts_v2';
const LEGACY_KEY='miki_native_operation_receipts_v1';
const MAX_RECEIPTS=500;

class NativeOperationReceiptService {
  record(input:Omit<NativeOperationReceipt,'receiptId'|'createdAt'>):NativeOperationReceipt {
    const receipt:NativeOperationReceipt={...input,receiptId:this.id(),createdAt:Date.now()};
    const rows=this.list();
    rows.push(receipt);
    storageService.setItem(KEY,JSON.stringify(rows.slice(-MAX_RECEIPTS)));
    return receipt;
  }
  list():NativeOperationReceipt[]{
    try {
      const current=JSON.parse(storageService.getItem(KEY)||'[]');
      if(Array.isArray(current))return current;
    } catch { /* ignore damaged storage */ }
    return [];
  }
  clearLegacy():void { storageService.removeItem(LEGACY_KEY); }
  summary(){
    const rows=this.list();
    const byOperation=Object.fromEntries((['HEALTH','SCAN_REPOSITORY','HASH_FILES','BUILD_ZIP','COPY_ZIPTXT','COMPARE_REVISIONS','SEARCH_TEXT','VERIFY_ARTIFACTS','GIT_BLOB_SHA'] as NativeOperationKind[]).map(operation=>[operation,rows.filter(row=>row.operation===operation).length]));
    return {receiptCount:rows.length,completed:rows.filter(row=>row.status==='COMPLETED'||row.status==='MATCHED').length,failed:rows.filter(row=>row.status==='FAILED'||row.status==='MISMATCHED').length,cancelled:rows.filter(row=>row.status==='CANCELLED').length,totalFiles:rows.reduce((sum,row)=>sum+(row.fileCount||0),0),totalBytes:rows.reduce((sum,row)=>sum+(row.totalBytes||0),0),byOperation};
  }
  private id(){return `NOR-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
}
export const nativeOperationReceiptService=new NativeOperationReceiptService();

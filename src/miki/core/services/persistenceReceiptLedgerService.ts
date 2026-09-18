import { storageService } from '../../../services/storageService';

export type PersistenceReceiptEntityType='REVIEW_LEARNING_EPISODE'|'REVIEW_LEARNING_ARTIFACT'|'CANDIDATE_WORKSPACE'|'CANDIDATE_VALIDATION'|'REVIEW_PACKAGE';
export interface PersistenceReceipt {receiptId:string;entityType:PersistenceReceiptEntityType;entityId:string;entitySha256:string;storageKey:string;persistedAt:number;reloaded:boolean;taskId?:string;corePlanRevision?:number;operationInstanceId?:string;targetSha256?:string;}
export type PersistenceReceiptLedgerKey='miki_review_learning_persistence_receipts_v1'|'miki_review_learning_artifact_receipts_v1'|'miki_candidate_persistence_receipts_v1'|'miki_candidate_validation_receipts_v1';
const RECEIPT_KEYS:PersistenceReceiptLedgerKey[]=['miki_review_learning_persistence_receipts_v1','miki_review_learning_artifact_receipts_v1','miki_candidate_persistence_receipts_v1','miki_candidate_validation_receipts_v1'];
export interface VerifiedPersistenceReceipt extends PersistenceReceipt {ledgerKey:PersistenceReceiptLedgerKey;}
class PersistenceReceiptLedgerService {
 register(receipt:PersistenceReceipt,ledgerKey:PersistenceReceiptLedgerKey):VerifiedPersistenceReceipt{
  if(!this.isValid(receipt))throw new Error('PERSISTENCE_RECEIPT_INVALID');
  const current=this.read(ledgerKey).filter(this.isValid);
  storageService.setItem(ledgerKey,JSON.stringify([receipt,...current.filter(item=>item.receiptId!==receipt.receiptId)].slice(0,500)));
  const reloaded=this.getFromLedger(receipt.receiptId,ledgerKey);
  if(!reloaded)throw new Error('PERSISTENCE_RECEIPT_LEDGER_WRITE_FAILED');
  return reloaded;
 }
 registerMany(receipts:PersistenceReceipt[],ledgerKey:PersistenceReceiptLedgerKey):VerifiedPersistenceReceipt[]{return receipts.map(receipt=>this.register(receipt,ledgerKey));}
 get(receiptId:string):VerifiedPersistenceReceipt|undefined{for(const ledgerKey of RECEIPT_KEYS){const receipt=this.getFromLedger(receiptId,ledgerKey);if(receipt)return receipt;}return undefined;}
 verify(receiptId:string,binding?:{taskId:string;corePlanRevision:number;operationInstanceId:string;targetSha256:string}):boolean{const receipt=this.get(receiptId);if(!receipt||receipt.reloaded!==true||!receipt.entityId||!receipt.entitySha256||!receipt.storageKey)return false;if(!binding)return true;return receipt.taskId===binding.taskId&&receipt.corePlanRevision===binding.corePlanRevision&&receipt.operationInstanceId===binding.operationInstanceId&&receipt.targetSha256===binding.targetSha256&&receipt.entitySha256===binding.targetSha256;}
 private getFromLedger(receiptId:string,ledgerKey:PersistenceReceiptLedgerKey):VerifiedPersistenceReceipt|undefined{const receipt=this.read(ledgerKey).find(item=>this.isValid(item)&&item.receiptId===receiptId);return receipt&&this.isValid(receipt)?{...receipt,ledgerKey}:undefined;}
 private read(key:PersistenceReceiptLedgerKey):unknown[]{try{const raw=storageService.getItem(key);const parsed:unknown=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[];}catch{return [];}}
 private isValid(value:unknown):value is PersistenceReceipt{if(typeof value!=='object'||value===null)return false;const item=value as Partial<PersistenceReceipt>;return typeof item.receiptId==='string'&&typeof item.entityId==='string'&&typeof item.entitySha256==='string'&&typeof item.storageKey==='string'&&typeof item.persistedAt==='number'&&item.reloaded===true&&(item.entityType==='REVIEW_LEARNING_EPISODE'||item.entityType==='REVIEW_LEARNING_ARTIFACT'||item.entityType==='CANDIDATE_WORKSPACE'||item.entityType==='CANDIDATE_VALIDATION'||item.entityType==='REVIEW_PACKAGE');}
}
export const persistenceReceiptLedgerService=new PersistenceReceiptLedgerService();

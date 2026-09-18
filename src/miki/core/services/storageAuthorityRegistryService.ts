export interface StorageAuthorityEntry { storageKey:string; owner:string; responsibility:string; critical:boolean; }
const ENTRIES:StorageAuthorityEntry[]=[
 {storageKey:'miki_candidate_generation_ledger_v2',owner:'candidateCodeGenerationService',responsibility:'candidate generation attempts and response lineage',critical:true},
 {storageKey:'miki_candidate_commit_transactions_v1',owner:'candidateCommitTransactionService',responsibility:'candidate commit transaction and recovery',critical:true},
 {storageKey:'miki_domain_reply_ledger_v1',owner:'domainReplyLedgerService',responsibility:'normalized domain replies',critical:true},
 {storageKey:'miki_core_results_v2',owner:'coreResultService',responsibility:'UI-facing core results',critical:true},
 {storageKey:'miki_review_package_ledger_v4',owner:'reviewZipExportService',responsibility:'immutable external review packages',critical:true},
 {storageKey:'miki_review_learning_persistence_receipts_v1',owner:'persistenceReceiptLedgerService',responsibility:'learning persistence receipts',critical:true}
];
class StorageAuthorityRegistryService {
 list(){return ENTRIES.map(entry=>({...entry}));}
 ownerOf(storageKey:string){return ENTRIES.find(entry=>entry.storageKey===storageKey);}
 assertUnique(){const duplicates=ENTRIES.filter((entry,index)=>ENTRIES.findIndex(candidate=>candidate.storageKey===entry.storageKey)!==index);if(duplicates.length)throw new Error(`DUPLICATE_STORAGE_AUTHORITY:${duplicates.map(entry=>entry.storageKey).join(',')}`);return true;}
}
export const storageAuthorityRegistryService=new StorageAuthorityRegistryService();

import { storageService } from '../../../services/storageService';
const LEGACY_KEY='miki_custom_jina_api_key';
const RECEIPT_KEY='miki_research_provider_migration_v1';
export interface LegacyResearchProviderMigrationReceipt{schemaVersion:1;migrationId:'REMOVE_JINA_PROVIDER_V1';legacySecretRemoved:boolean;migratedAt:string;}
export class LegacyResearchProviderMigrationService{public migrate():LegacyResearchProviderMigrationReceipt{const legacySecretRemoved=Boolean(storageService.getItem(LEGACY_KEY));if(legacySecretRemoved){storageService.removeItem(LEGACY_KEY);}const receipt:LegacyResearchProviderMigrationReceipt={schemaVersion:1,migrationId:'REMOVE_JINA_PROVIDER_V1',legacySecretRemoved,migratedAt:new Date().toISOString()};storageService.setItem(RECEIPT_KEY,JSON.stringify(receipt));return receipt;}}
export const legacyResearchProviderMigrationService=new LegacyResearchProviderMigrationService();

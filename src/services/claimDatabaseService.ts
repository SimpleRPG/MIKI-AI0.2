/**
 * Compatibility facade. The canonical Claim authority lives under miki/memory.
 * Keeping this path avoids breaking legacy imports while preventing a second
 * in-memory singleton from diverging from conversation, research and evidence.
 */
export * from '../miki/memory/services/claimDatabaseService';

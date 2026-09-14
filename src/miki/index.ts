/**
 * MIKI 17分類 統合管理入口
 *
 * MIKI
 *   ↓
 * 17管理入口
 *   ↓
 * 各カテゴリのservices
 */

export * from './core/mikiInteractionBus';
export * from './core/mikiCategoryCoordinator';
export * from './core/mikiCategoryInteractionRuntime';
export * from './core/mikiCategoryInteractionRuntimeSmoke';
export * from './autonomy';
export * from './capability';
export * from './conversation';
export * from './data';
export * from './execution';
export * from './experience';
export * from './improvement';
export * from './learning';
export * from './memory';
export * from './promotion';
export * from './research';
export * from './safety';
export * from './selfAwareness';
export * from './selfDevelopment';
export * from './strategy';
export * from './unknown';
export * from './verification';

/**
 * 旧Chapter69-90互換の初期化入口。
 * 移行期間中は既存の初期化処理を維持する。
 * 完全移行後に17分類内部の初期化へ置換する。
 */
export { initializeChapter69to90 } from '../services/chapter69_90PlatformServices';

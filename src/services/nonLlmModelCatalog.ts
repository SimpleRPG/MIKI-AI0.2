export interface GgufModelDefinition { id: string; name: string; fileName: string; [key: string]: any; }
export const OFFICIAL_GGUF_MODELS: GgufModelDefinition[] = [];
export const isModelProtected = (_id?: string, _name?: string) => ({ isProtected: false, reason: 'Local generative models are retired.' });
export const getModelManifest = () => ({ manifestVersion: 'NON_LLM_ONLY' });
export const getManifestNativeEnv = () => ({ pinnedCommit: 'RETIRED', pinnedCommitHash: 'RETIRED', ndkVersion: 'RETIRED', vulkanHeaders: { pinnedTag: 'RETIRED' }, spirvHeaders: { pinnedTag: 'RETIRED' } });
export const getManifestDefaultConfig = () => null;

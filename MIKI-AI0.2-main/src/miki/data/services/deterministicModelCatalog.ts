export interface ModelArtifactModelDefinition { id: string; name: string; fileName: string; [key: string]: any; }
export const OFFICIAL_MODEL_ARTIFACT_MODELS: ModelArtifactModelDefinition[] = [];
export const isModelProtected = (_id?: string, _name?: string) => ({ isProtected: false, reason: 'Local generative models are retired.' });
export const getModelManifest = () => ({ manifestVersion: 'DETERMINISTIC_ONLY' });
export const getManifestNativeEnv = () => ({ pinnedCommit: 'RETIRED', pinnedCommitHash: 'RETIRED', ndkVersion: 'RETIRED', vulkanHeaders: { pinnedTag: 'RETIRED' }, spirvHeaders: { pinnedTag: 'RETIRED' } });
export const getManifestDefaultConfig = () => null;

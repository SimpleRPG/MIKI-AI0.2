import { storageService } from '../../../services/storageService';
import { apiService } from '../../../services/api';
import { canonicalSha256 } from './canonicalSha256Service';

export interface SelfCodeFile {
  path: string;
  content: string;
  sha256: string;
}

export interface SelfCodeSnapshot {
  repository: string;
  branch: string;
  repoSha256: string;
  files: SelfCodeFile[];
  syncedAt: number;
}

const KEY = 'miki_self_code_space_v1';
const REPOSITORY = 'SimpleRPG/MIKI-AI0.2';
const BRANCH = 'main';

class SelfCodeSpaceService {
  async sync(token?: string): Promise<SelfCodeSnapshot> {
    const result = await apiService.importFromGitHub({
      repoUrl: REPOSITORY,
      branch: BRANCH,
      token: token?.trim() || undefined,
    });

    if (!result.success || !result.files?.length) {
      throw new Error(result.message || 'SELF_CODE_SPACE_SYNC_FAILED');
    }

    const files: SelfCodeFile[] = result.files
      .filter((file: any) => typeof file.path === 'string' && typeof file.content === 'string')
      .map((file: any) => ({
        path: file.path,
        content: file.content,
        sha256: canonicalSha256(file.content),
      }));

    if (!files.length) throw new Error('SELF_CODE_SPACE_NO_FILES');

    const snapshot: SelfCodeSnapshot = {
      repository: REPOSITORY,
      branch: BRANCH,
      repoSha256: canonicalSha256(files.map(file => ({ path: file.path, sha256: file.sha256 }))),
      files,
      syncedAt: Date.now(),
    };

    storageService.setItem(KEY, JSON.stringify(snapshot));
    return this.clone(snapshot);
  }

  get(): SelfCodeSnapshot | undefined {
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return undefined;
      const value = JSON.parse(raw);
      return value?.files ? this.clone(value) : undefined;
    } catch {
      return undefined;
    }
  }

  listFiles(): SelfCodeFile[] {
    return this.get()?.files || [];
  }

  readFile(path: string): SelfCodeFile | undefined {
    return this.listFiles().find(file => file.path === path);
  }

  search(query: string, limit = 20): SelfCodeFile[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.listFiles()
      .filter(file => file.path.toLowerCase().includes(q) || file.content.toLowerCase().includes(q))
      .slice(0, Math.max(1, limit));
  }

  private clone(snapshot: SelfCodeSnapshot): SelfCodeSnapshot {
    return {
      ...snapshot,
      files: snapshot.files.map(file => ({ ...file })),
    };
  }
}

export const selfCodeSpaceService = new SelfCodeSpaceService();

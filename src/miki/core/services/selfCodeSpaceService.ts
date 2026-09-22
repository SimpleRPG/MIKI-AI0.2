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
  dirty?: boolean;
  baseRepoSha256?: string;
}

const KEY = 'miki_self_code_space_v1';
const REPOSITORY = 'SimpleRPG/MIKI-AI0.2';
const BRANCH = 'main';

class SelfCodeSpaceService {
  async sync(token?: string): Promise<SelfCodeSnapshot> {
    const existing=this.get();
    if(existing?.dirty) throw new Error('SELF_CODE_SPACE_DIRTY_SYNC_REQUIRED');
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
      dirty: false,
      baseRepoSha256: canonicalSha256(files.map(file => ({ path: file.path, sha256: file.sha256 }))),
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

  listSourceFiles() {
    const syncedAt = this.get()?.syncedAt || Date.now();
    return this.listFiles().map(file => ({ path: file.path, content: file.content, language: this.language(file.path), evidenceIds: [], updatedAt: syncedAt, contentHash: file.sha256 }));
  }

  applyCandidate(files: Array<{path:string; baselineSha256:string; candidateContent:string}>): SelfCodeSnapshot {
    const snapshot=this.get();
    if(!snapshot) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    const current=new Map(snapshot.files.map(file=>[file.path,file]));
    for(const file of files){
      const target=current.get(file.path);
      if(!target) throw new Error(`SELF_CODE_FILE_NOT_FOUND:${file.path}`);
      if(target.sha256!==file.baselineSha256) throw new Error(`SELF_CODE_BASELINE_CONFLICT:${file.path}`);
    }
    const next=snapshot.files.map(file=>{
      const change=files.find(item=>item.path===file.path);
      return change ? {...file,content:change.candidateContent,sha256:canonicalSha256(change.candidateContent)} : {...file};
    });
    const updated:SelfCodeSnapshot={...snapshot,files:next,repoSha256:canonicalSha256(next.map(file=>({path:file.path,sha256:file.sha256}))),syncedAt:Date.now(),dirty:true,baseRepoSha256:snapshot.baseRepoSha256||snapshot.repoSha256};
    storageService.setItem(KEY,JSON.stringify(updated));
    return this.clone(updated);
  }

  search(query: string, limit = 20): SelfCodeFile[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.listFiles()
      .filter(file => file.path.toLowerCase().includes(q) || file.content.toLowerCase().includes(q))
      .slice(0, Math.max(1, limit));
  }

  private language(path: string): string { const ext = path.split(".").pop()?.toLowerCase(); return ext === "tsx" ? "typescriptreact" : ext === "ts" ? "typescript" : ext === "js" ? "javascript" : ext === "json" ? "json" : ext || "text"; }

  private clone(snapshot: SelfCodeSnapshot): SelfCodeSnapshot {
    return {
      ...snapshot,
      files: snapshot.files.map(file => ({ ...file })),
    };
  }
}

export const selfCodeSpaceService = new SelfCodeSpaceService();

import { registerPlugin } from '@capacitor/core';

/**
 * P1121: ワークスペースのデータ側を Rust ネイティブへ寄せる橋（第1段）。
 *
 * ネイティブ側（MIKINativeRunner プラグイン）は、アプリ内蔵の種 zip を
 * JS を経由せずに filesDir/miki/workspaces へ展開し、全ファイルの
 * sha256 を Rust で取ってマニフェストだけを返す。内容は橋を渡らない。
 * 第1段ではディスク側の用意と件数・サイズの照合までで、読み経路の
 * 置き換えは第2段（readFile はその受け口として先に用意する）。
 *
 * ネイティブが無い環境（サンドボックス・Web）では undefined を返し、
 * 呼び出し側は従来の JS 経路のまま動く。
 */

export interface NativeSeedManifestEntry {
  path: string;
  sha256: string;
  byte_length: number;
}

export interface NativeSeedExtraction {
  engine: string;
  api_version: number;
  file_count: number;
  total_bytes: number;
  duration_ms: number;
  files: NativeSeedManifestEntry[];
}

interface NativeWorkspacePlugin {
  nativeCoreHealth(): Promise<{ available: boolean; compatible: boolean; api_version: number }>;
  extractSeedWorkspace(input: { asset_path?: string }): Promise<NativeSeedExtraction>;
  readWorkspaceFile(input: { relative_path: string }): Promise<{
    relative_path: string;
    content: string;
    byte_length: number;
    engine: string;
    api_version: number;
  }>;
}

const Native = registerPlugin<NativeWorkspacePlugin>('MIKINativeRunner');

class NativeWorkspaceBridgeService {
  public async available(): Promise<boolean> {
    try {
      const health = await Native.nativeCoreHealth();
      return health.available === true && health.compatible === true;
    } catch {
      return false;
    }
  }

  /** 種をネイティブ側へ展開する。使えない環境では undefined。 */
  public async extractSeed(): Promise<NativeSeedExtraction | undefined> {
    try {
      if (!(await this.available())) return undefined;
      const result = await Native.extractSeedWorkspace({});
      if (result.engine !== 'RUST' || !Array.isArray(result.files)) return undefined;
      return result;
    } catch {
      return undefined;
    }
  }

  /** ワークスペース内の1ファイルを読む（第2段の部分読み用）。 */
  public async readFile(relativePath: string): Promise<string | undefined> {
    try {
      if (!(await this.available())) return undefined;
      const result = await Native.readWorkspaceFile({ relative_path: relativePath });
      return typeof result.content === 'string' ? result.content : undefined;
    } catch {
      return undefined;
    }
  }
}

export const nativeWorkspaceBridgeService = new NativeWorkspaceBridgeService();

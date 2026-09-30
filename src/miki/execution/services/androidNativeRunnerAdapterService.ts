import { registerPlugin, Capacitor } from '@capacitor/core';
import { ExecutionRequest, ExecutionResultInput, executionRunnerService } from './executionRunnerService';
import { systemLogger } from '../../../services/systemLogger';
import { nativeOperationDispatcherService, type NativeDispatchResult } from './nativeOperationDispatcherService';
import { rustSearchIndexCacheService } from './rustSearchIndexCacheService';

interface NativeRunnerPlugin {
  execute(request: {
    request_id: string;
    component_id: string;
    implementation_hash: string;
    artifact_snapshot_key: string;
    environment: 'ANDROID';
    test_category: string;
    test_case_id: string;
    input_summary: string;
  }): Promise<{
    request_id: string;
    passed: boolean;
    output_summary: string;
    error_message?: string;
    duration_ms?: number;
    environment: 'ANDROID';
    runner_id: string;
    implementation_hash: string;
    artifact_snapshot_key: string;
    test_case_id: string;
  }>;
  health?: () => Promise<{ ready: boolean; runner_id?: string; rust_available?: boolean; rust_compatible?: boolean; rust_api_version?: number; rust_reason?: string }>;
  nativeCoreHealth?: () => Promise<{ available: boolean; compatible: boolean; api_version: number; reason?: string }>;
  hashWorkspaceFile?: (input:{ relative_path:string }) => Promise<{ relative_path:string; sha256:string; byte_length:number; duration_ms:number; engine:'RUST'; api_version:number }>;
  searchWorkspaceText?: (input:{query:string;limit:number}) => Promise<{hits:Array<{path:string;line:number;column:number;preview:string}>;engine:'RUST';api_version:number}>;
  verifyPackageArtifact?: (input:{name:string;sha256:string;byte_length:number}) => Promise<{name:string;byte_length:number;sha256:string;matched:boolean;engine:'RUST';api_version:number}>;
  compareRevisions?: (input:{baseline:Array<{path:string;sha256:string}>;candidate:Array<{path:string;sha256:string}>}) => Promise<{added:string[];changed:string[];deleted:string[];unchanged_count:number;matched:boolean;api_version:number}>;
  buildWorkspaceZip?: (input:{output_name:string;entries:Array<{source_relative_path:string;zip_entry_path:string}>}) => Promise<{output_name:string;file_count:number;output_bytes:number;sha256:string;duration_ms:number;matched:boolean;api_version:number;entries:string[]}>;
  copyZipTxt?: (input:{source_name:string;destination_name:string}) => Promise<{source_name:string;destination_name:string;sha256:string;byte_length:number;matched:boolean;api_version:number}>;
  gitBlobShaWorkspaceFile?: (input:{relative_path:string}) => Promise<{relative_path:string;rust_blob_sha:string;reference_blob_sha:string;matched:boolean;byte_length:number;api_version:number}>;
  scanWorkspace?: () => Promise<{ mode:'RUST_ONLY'; engine:'RUST'; api_version:number; file_count:number; total_bytes:number; duration_ms:number; files:Array<{path:string;byte_length:number}> }>;
  hashWorkspaceFiles?: (input:{ relative_paths:string[] }) => Promise<{ mode:'RUST_ONLY'; engine:'RUST'; api_version:number; file_count:number; matched_count:number; total_bytes:number; aggregate_sha256:string; duration_ms:number; files:Array<{ relative_path:string; rust_sha256:string; reference_sha256:string; matched:boolean; byte_length:number; rust_duration_ms:number; reference_duration_ms:number }> }>;
}

const MIKINativeRunner = registerPlugin<NativeRunnerPlugin>('MIKINativeRunner');

/**
 * Android本体のNative Runner Bridge。
 *
 * Termux/localhost HTTPを前提にせず、Capacitor Native Plugin
 * `MIKINativeRunner` との境界だけを担当する。
 * 任意コードをJSから実行せず、Native側にも「登録済み安全Adapterのみ」
 * を実行させる契約を前提とする。
 */
export class AndroidNativeRunnerAdapterService {
  private workspaceRevision='UNSCANNED';
  private static instance: AndroidNativeRunnerAdapterService;
  private active = new Set<string>();

  private constructor() {}

  public static getInstance(): AndroidNativeRunnerAdapterService {
    if (!this.instance) this.instance = new AndroidNativeRunnerAdapterService();
    return this.instance;
  }

  public isAvailable(): boolean {
    return Capacitor.isNativePlatform() && typeof MIKINativeRunner.execute === 'function';
  }


  public async executeNativeHealth():Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['nativeCoreHealth']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('HEALTH',()=>this.nativeCoreHealth(),{entryPoint:'executeNativeHealth'});
  }

  public async executeScanRepository():Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['scanWorkspace']>>>> {
    const result=await nativeOperationDispatcherService.executeRustOnly('SCAN_REPOSITORY',()=>this.scanWorkspace(),{entryPoint:'executeScanRepository'});
    this.workspaceRevision=result.value.files.map(file=>`${file.path}:${file.byteLength}`).join('|');
    return result;
  }

  public async executeHashFiles(relativePaths:string[]):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['hashWorkspaceFiles']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('HASH_FILES',()=>this.hashWorkspaceFiles(relativePaths),{entryPoint:'executeHashFiles',requestedFiles:relativePaths.length});
  }

  public async executeBuildZip(outputName:string,entries:Array<{sourceRelativePath:string;zipEntryPath:string}>):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['buildWorkspaceZip']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('BUILD_ZIP',()=>this.buildWorkspaceZip(outputName,entries),{entryPoint:'executeBuildZip',entryCount:entries.length,outputName});
  }

  public async executeCopyZipTxt(sourceName:string,destinationName:string):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['copyZipTxt']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('COPY_ZIPTXT',()=>this.copyZipTxt(sourceName,destinationName),{entryPoint:'executeCopyZipTxt',sourceName,destinationName});
  }

  public async executeCompareRevisions(baseline:Array<{path:string;sha256:string}>,candidate:Array<{path:string;sha256:string}>):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['compareRevisions']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('COMPARE_REVISIONS',()=>this.compareRevisions(baseline,candidate),{entryPoint:'executeCompareRevisions',baselineFiles:baseline.length,candidateFiles:candidate.length});
  }

  public async executeSearchText(query:string,limit:number):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['searchWorkspaceText']>>>> {
    const cached=rustSearchIndexCacheService.get(this.workspaceRevision,query,limit) as NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['searchWorkspaceText']>>>|undefined;
    if(cached)return {...cached,deduplicated:true};
    const result=await nativeOperationDispatcherService.executeRustOnly('SEARCH_TEXT',()=>this.searchWorkspaceText(query,limit),{entryPoint:'executeSearchText',queryLength:query.trim().length,limit},{idempotencyKey:`SEARCH_TEXT:${this.workspaceRevision}:${query}:${limit}`});
    rustSearchIndexCacheService.set(this.workspaceRevision,query,limit,result);
    return result;
  }

  public async executeVerifyArtifacts(name:string,sha256:string,byteLength:number):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['verifyPackageArtifact']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('VERIFY_ARTIFACTS',()=>this.verifyPackageArtifact(name,sha256,byteLength),{entryPoint:'executeVerifyArtifacts',name,expectedBytes:byteLength});
  }

  public async executeGitBlobSha(relativePath:string):Promise<NativeDispatchResult<Awaited<ReturnType<AndroidNativeRunnerAdapterService['gitBlobShaWorkspaceFile']>>>> {
    return nativeOperationDispatcherService.executeRustOnly('GIT_BLOB_SHA',()=>this.gitBlobShaWorkspaceFile(relativePath),{entryPoint:'executeGitBlobSha',relativePath});
  }

  private async searchWorkspaceText(query:string,limit=500):Promise<{hits:Array<{path:string;line:number;column:number;preview:string}>;engine:'RUST';apiVersion:number}>{
    const normalizedQuery=query.trim();
    const normalizedLimit=Math.max(1,Math.min(5000,Math.trunc(limit)));
    if(!normalizedQuery)throw new Error('SEARCH_QUERY_REQUIRED');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.searchWorkspaceText)throw new Error('RUST_SEARCH_TEXT_UNAVAILABLE');
    const result=await MIKINativeRunner.searchWorkspaceText({query:normalizedQuery,limit:normalizedLimit});
    if(!Array.isArray(result.hits))throw new Error('RUST_SEARCH_TEXT_RESULT_INVALID');
    return {hits:result.hits,engine:result.engine,apiVersion:result.api_version};
  }

  private async verifyPackageArtifact(name:string,sha256:string,byteLength:number):Promise<{name:string;byteLength:number;sha256:string;matched:boolean;engine:'RUST';apiVersion:number}>{
    if(!name||name.includes('/')||name.includes('\\')||!/^[a-f0-9]{64}$/.test(sha256)||!Number.isSafeInteger(byteLength)||byteLength<0)throw new Error('ARTIFACT_EXPECTATION_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.verifyPackageArtifact)throw new Error('RUST_VERIFY_ARTIFACT_UNAVAILABLE');
    const result=await MIKINativeRunner.verifyPackageArtifact({name,sha256,byte_length:byteLength});
    return {name:result.name,byteLength:result.byte_length,sha256:result.sha256,matched:result.matched,engine:result.engine,apiVersion:result.api_version};
  }

  private async compareRevisions(baseline:Array<{path:string;sha256:string}>,candidate:Array<{path:string;sha256:string}>):Promise<{added:string[];changed:string[];deleted:string[];unchangedCount:number;matched:boolean;apiVersion:number}>{
    const valid=(row:{path:string;sha256:string})=>Boolean(row.path)&&!row.path.startsWith('/')&&!row.path.split('/').includes('..')&&/^[a-f0-9]{64}$/.test(row.sha256);
    if(!baseline.every(valid)||!candidate.every(valid)||baseline.length>100000||candidate.length>100000)throw new Error('REVISION_COMPARE_REQUEST_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.compareRevisions)throw new Error('RUST_COMPARE_REVISIONS_UNAVAILABLE');
    const result=await MIKINativeRunner.compareRevisions({baseline,candidate});
    if(!result.matched)throw new Error('RUST_REVISION_COMPARE_MISMATCH');
    return {added:result.added,changed:result.changed,deleted:result.deleted,unchangedCount:result.unchanged_count,matched:result.matched,apiVersion:result.api_version};
  }

  private async buildWorkspaceZip(outputName:string,entries:Array<{sourceRelativePath:string;zipEntryPath:string}>):Promise<{outputName:string;fileCount:number;outputBytes:number;sha256:string;durationMs:number;matched:boolean;apiVersion:number;entries:string[]}>{
    if(!/^[^/\\]+\.zip$/.test(outputName)||entries.length===0||entries.length>5000)throw new Error('ZIP_BUILD_REQUEST_INVALID');
    const normalized=entries.map(entry=>({source_relative_path:entry.sourceRelativePath.replace(/\\/g,'/').replace(/^\/+/,''),zip_entry_path:entry.zipEntryPath.replace(/\\/g,'/').replace(/^\/+/, '')}));
    if(normalized.some(entry=>!entry.source_relative_path||!entry.zip_entry_path||entry.source_relative_path.split('/').includes('..')||entry.zip_entry_path.split('/').includes('..')))throw new Error('ZIP_ENTRY_PATH_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.buildWorkspaceZip)throw new Error('RUST_BUILD_ZIP_UNAVAILABLE');
    const result=await MIKINativeRunner.buildWorkspaceZip({output_name:outputName,entries:normalized});
    if(!result.matched||result.file_count!==entries.length||!/^[a-f0-9]{64}$/.test(result.sha256))throw new Error('RUST_BUILD_ZIP_MISMATCH');
    return {outputName:result.output_name,fileCount:result.file_count,outputBytes:result.output_bytes,sha256:result.sha256,durationMs:result.duration_ms,matched:result.matched,apiVersion:result.api_version,entries:result.entries};
  }

  private async copyZipTxt(sourceName:string,destinationName:string):Promise<{sourceName:string;destinationName:string;sha256:string;byteLength:number;matched:boolean;apiVersion:number}>{
    if(!/^[^/\\]+\.zip$/.test(sourceName)||!/^[^/\\]+\.zip\.txt$/.test(destinationName))throw new Error('ZIPTXT_FILE_NAME_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.copyZipTxt)throw new Error('RUST_COPY_ZIPTXT_UNAVAILABLE');
    const result=await MIKINativeRunner.copyZipTxt({source_name:sourceName,destination_name:destinationName});
    if(!result.matched||!/^[a-f0-9]{64}$/.test(result.sha256))throw new Error('RUST_COPY_ZIPTXT_MISMATCH');
    return {sourceName:result.source_name,destinationName:result.destination_name,sha256:result.sha256,byteLength:result.byte_length,matched:result.matched,apiVersion:result.api_version};
  }

  private async gitBlobShaWorkspaceFile(relativePath:string):Promise<{relativePath:string;rustBlobSha:string;referenceBlobSha:string;matched:boolean;byteLength:number;apiVersion:number}>{
    const normalized=relativePath.replace(/\\/g,'/').replace(/^\/+/, '').trim();
    if(!normalized||normalized.split('/').includes('..'))throw new Error('WORKSPACE_RELATIVE_PATH_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.gitBlobShaWorkspaceFile)throw new Error('RUST_GIT_BLOB_UNAVAILABLE');
    const result=await MIKINativeRunner.gitBlobShaWorkspaceFile({relative_path:normalized});
    if(!result.matched||result.rust_blob_sha!==result.reference_blob_sha)throw new Error('RUST_GIT_BLOB_MISMATCH');
    if(!/^[a-f0-9]{40}$/.test(result.rust_blob_sha))throw new Error('RUST_GIT_BLOB_SHA_INVALID');
    return {relativePath:result.relative_path,rustBlobSha:result.rust_blob_sha,referenceBlobSha:result.reference_blob_sha,matched:result.matched,byteLength:result.byte_length,apiVersion:result.api_version};
  }

  private async scanWorkspace(): Promise<{ mode:'RUST_ONLY'; engine:'RUST'; apiVersion:number; fileCount:number; totalBytes:number; durationMs:number; files:Array<{path:string;byteLength:number}> }> {
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.scanWorkspace)throw new Error('RUST_SCAN_WORKSPACE_UNAVAILABLE');
    const result=await MIKINativeRunner.scanWorkspace();
    if(result.file_count!==result.files.length)throw new Error('RUST_SCAN_WORKSPACE_COUNT_MISMATCH');
    const files=result.files.map(file=>({path:file.path,byteLength:file.byte_length}));
    return {mode:result.mode,engine:result.engine,apiVersion:result.api_version,fileCount:result.file_count,totalBytes:result.total_bytes,durationMs:result.duration_ms,files};
  }

  private async hashWorkspaceFiles(relativePaths:string[]): Promise<{ mode:'RUST_ONLY'; engine:'RUST'; apiVersion:number; fileCount:number; matchedCount:number; totalBytes:number; aggregateSha256:string; durationMs:number; files:Array<{ relativePath:string; rustSha256:string; referenceSha256:string; matched:boolean; byteLength:number; rustDurationMs:number; referenceDurationMs:number }> }> {
    const normalized=[...new Set(relativePaths.map(path=>path.replace(/\\/g,'/').replace(/^\/+/, '').trim()).filter(Boolean))].sort();
    if(normalized.length===0)throw new Error('RELATIVE_PATHS_REQUIRED');
    if(normalized.length>5000)throw new Error('HASH_FILE_COUNT_LIMIT_EXCEEDED');
    if(normalized.some(path=>path.startsWith('/')||path.split('/').includes('..')))throw new Error('WORKSPACE_RELATIVE_PATH_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.hashWorkspaceFiles)throw new Error('RUST_HASH_FILES_UNAVAILABLE');
    const result=await MIKINativeRunner.hashWorkspaceFiles({relative_paths:normalized});
    if(result.file_count!==normalized.length||result.matched_count!==result.file_count)throw new Error('RUST_HASH_FILES_COUNT_MISMATCH');
    if(!/^[a-f0-9]{64}$/.test(result.aggregate_sha256))throw new Error('RUST_HASH_FILES_AGGREGATE_INVALID');
    const files=result.files.map(file=>{
      if(!file.matched||file.rust_sha256!==file.reference_sha256)throw new Error(`RUST_HASH_FILES_MISMATCH:${file.relative_path}`);
      if(!/^[a-f0-9]{64}$/.test(file.rust_sha256))throw new Error(`RUST_SHA256_INVALID:${file.relative_path}`);
      return {relativePath:file.relative_path,rustSha256:file.rust_sha256,referenceSha256:file.reference_sha256,matched:file.matched,byteLength:file.byte_length,rustDurationMs:file.rust_duration_ms,referenceDurationMs:file.reference_duration_ms};
    });
    return {mode:result.mode,engine:result.engine,apiVersion:result.api_version,fileCount:result.file_count,matchedCount:result.matched_count,totalBytes:result.total_bytes,aggregateSha256:result.aggregate_sha256,durationMs:result.duration_ms,files};
  }

  private async hashWorkspaceFile(relativePath:string): Promise<{ relativePath:string; sha256:string; byteLength:number; durationMs:number; engine:'RUST'; apiVersion:number }> {
    const normalized=relativePath.replace(/\\/g,'/').replace(/^\/+/, '');
    if(!normalized||normalized.split('/').includes('..'))throw new Error('WORKSPACE_RELATIVE_PATH_INVALID');
    if(!Capacitor.isNativePlatform()||!MIKINativeRunner.hashWorkspaceFile)throw new Error('RUST_HASH_FILES_UNAVAILABLE');
    const result=await MIKINativeRunner.hashWorkspaceFile({relative_path:normalized});
    if(!/^[a-f0-9]{64}$/.test(result.sha256))throw new Error('RUST_SHA256_INVALID');
    return {relativePath:result.relative_path,sha256:result.sha256,byteLength:result.byte_length,durationMs:result.duration_ms,engine:result.engine,apiVersion:result.api_version};
  }

  private async nativeCoreHealth(): Promise<{ available:boolean; compatible:boolean; apiVersion:number; reason?:string }> {
    if (!Capacitor.isNativePlatform() || !MIKINativeRunner.nativeCoreHealth) {
      return { available:false, compatible:false, apiVersion:0, reason:'RUST_NATIVE_CORE_NOT_AVAILABLE' };
    }
    try {
      const result=await MIKINativeRunner.nativeCoreHealth();
      return { available:result.available, compatible:result.compatible, apiVersion:result.api_version, reason:result.reason };
    } catch (error) {
      return { available:false, compatible:false, apiVersion:0, reason:error instanceof Error?error.message:String(error) };
    }
  }

  public async health(): Promise<{ available: boolean; ready: boolean; runnerId?: string; reason?: string }> {
    if (!Capacitor.isNativePlatform()) return { available: false, ready: false, reason: 'Android Native Platformではありません。' };
    if (!MIKINativeRunner.health) return { available: true, ready: true, runnerId: 'android-native' };
    try {
      const result = await MIKINativeRunner.health();
      return { available: true, ready: !!result.ready, runnerId: result.runner_id || 'android-native' };
    } catch (error) {
      return { available: true, ready: false, reason: `Native Runner health失敗: ${String(error)}` };
    }
  }

  public async dispatch(request: ExecutionRequest): Promise<{ accepted: boolean; reason: string }> {
    if (request.environment !== 'ANDROID') return { accepted: false, reason: 'Android Native RunnerはANDROID環境専用です。' };
    if (request.status !== 'SUBMITTED') return { accepted: false, reason: `Request状態=${request.status}のため送信できません。` };
    if (this.active.has(request.request_id)) return { accepted: false, reason: '同一Requestは送信中です。' };

    if (!Capacitor.isNativePlatform()) return { accepted: false, reason: 'Android Native Platformではありません。' };
    if (!this.isAvailable()) return { accepted: false, reason: 'MIKINativeRunner Pluginが利用できません。' };

    this.active.add(request.request_id);
    try {
      const result = await MIKINativeRunner.execute({
        request_id: request.request_id,
        component_id: request.component_id,
        implementation_hash: request.implementation_hash,
        artifact_snapshot_key: request.artifact_snapshot_key,
        test_case_id: request.test_case_id,
        environment: 'ANDROID',
        test_category: request.test_category,
        input_summary: request.input_summary,
      });

      const normalized: ExecutionResultInput = {
        request_id: result.request_id,
        passed: result.passed,
        output_summary: result.output_summary || '',
        error_message: result.error_message,
        duration_ms: result.duration_ms,
        environment: result.environment,
        runner_id: result.runner_id || 'android-native',
        implementation_hash: result.implementation_hash,
        artifact_snapshot_key: result.artifact_snapshot_key,
        test_case_id: result.test_case_id,
      };

      if (normalized.request_id !== request.request_id) return { accepted: false, reason: 'Native Runner結果のrequest_idが一致しません。' };
      if (normalized.implementation_hash !== request.implementation_hash) return { accepted: false, reason: 'Native Runner結果の実装ハッシュが一致しません。' };
      if (normalized.test_case_id !== request.test_case_id) return { accepted: false, reason: 'Native Runner結果のTest Case IDが一致しません。' };
      if (normalized.artifact_snapshot_key !== request.artifact_snapshot_key) return { accepted: false, reason: 'Native Runner結果のArtifact snapshotが一致しません。' };
      if (normalized.environment !== request.environment) return { accepted: false, reason: 'Native Runner結果の環境が一致しません。' };

      const accepted = executionRunnerService.submitResult(normalized).accepted;
      return { accepted, reason: accepted ? 'Android Native Runner結果を受領しました。' : 'Native Runner結果を受領できませんでした。' };
    } catch (error) {
      const reason = `Android Native Runner実行失敗: ${String(error)}`;
      systemLogger.warn('TOOLS', `📱 [AndroidNativeRunner] ${request.request_id}: ${reason}`);
      return { accepted: false, reason };
    } finally {
      this.active.delete(request.request_id);
    }
  }

}

export const androidNativeRunnerAdapterService = AndroidNativeRunnerAdapterService.getInstance();

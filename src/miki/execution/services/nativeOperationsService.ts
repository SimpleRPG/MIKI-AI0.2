import { androidNativeRunnerAdapterService } from './androidNativeRunnerAdapterService';
import { nativeOperationDispatcherService } from './nativeOperationDispatcherService';
class NativeOperationsService{
  health(){return androidNativeRunnerAdapterService.executeNativeHealth();}
  scanRepository(){return androidNativeRunnerAdapterService.executeScanRepository();}
  hashFiles(paths:string[]){return androidNativeRunnerAdapterService.executeHashFiles(paths);}
  buildZip(name:string,entries:Array<{sourceRelativePath:string;zipEntryPath:string}>){return androidNativeRunnerAdapterService.executeBuildZip(name,entries);}
  copyZipTxt(source:string,destination:string){return androidNativeRunnerAdapterService.executeCopyZipTxt(source,destination);}
  compareRevisions(baseline:Array<{path:string;sha256:string}>,candidate:Array<{path:string;sha256:string}>){return androidNativeRunnerAdapterService.executeCompareRevisions(baseline,candidate);}
  searchText(query:string,limit=500){return androidNativeRunnerAdapterService.executeSearchText(query,limit);}
  verifyArtifact(name:string,sha256:string,bytes:number){return androidNativeRunnerAdapterService.executeVerifyArtifacts(name,sha256,bytes);}
  gitBlobSha(path:string){return androidNativeRunnerAdapterService.executeGitBlobSha(path);}
  runtimeSnapshot(){return nativeOperationDispatcherService.runtimeSnapshot();}
}
export const nativeOperationsService=new NativeOperationsService();

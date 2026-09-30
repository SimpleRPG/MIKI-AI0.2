import { nativeOperationContractService, type NativeOperationKind } from './nativeOperationContractService';
import { nativeOperationReceiptService } from './nativeOperationReceiptService';
import { nativeOperationRuntimePolicyService, type NativeOperationExecutionOptions } from './nativeOperationRuntimePolicyService';
export interface NativeDispatchResult<T>{value:T;engine:'RUST';fallbackUsed:false;durationMs:number;requestId:string;deduplicated:boolean;}
class NativeOperationDispatcherService{
  async executeRustOnly<T>(operation:NativeOperationKind,rust:()=>Promise<T>,metadata:Record<string,string|number|boolean>={},options:NativeOperationExecutionOptions<T>={}):Promise<NativeDispatchResult<T>>{
    const requestId=options.requestId||nativeOperationRuntimePolicyService.createRequestId(operation);nativeOperationRuntimePolicyService.validateIdempotencyKey(options.idempotencyKey);const cached=nativeOperationRuntimePolicyService.getIdempotent<NativeDispatchResult<T>>(operation,options.idempotencyKey);if(cached)return cached.then(value=>({...value,deduplicated:true}));
    const execution=this.executeNew(operation,requestId,rust,metadata,options);nativeOperationRuntimePolicyService.putIdempotent(options.idempotencyKey,execution);return execution;
  }
  private async executeNew<T>(operation:NativeOperationKind,requestId:string,rust:()=>Promise<T>,metadata:Record<string,string|number|boolean>,options:NativeOperationExecutionOptions<T>):Promise<NativeDispatchResult<T>>{
    const startedAt=Date.now(),mode=nativeOperationContractService.mode(operation),timeoutMs=nativeOperationRuntimePolicyService.adaptiveTimeout(operation,options.timeoutMs),safeMetadata=nativeOperationRuntimePolicyService.sanitizeMetadata(metadata);nativeOperationRuntimePolicyService.validateInputSha256(options.inputSha256);nativeOperationRuntimePolicyService.assertNotCancelled(options.signal);if(mode!=='RUST_ONLY')throw new Error(`NATIVE_OPERATION_NOT_RUST_ONLY:${operation}`);const release=nativeOperationRuntimePolicyService.enter(operation,requestId);const nativePromise=rust();nativePromise.finally(release).catch(()=>undefined);
    try{const value=await nativeOperationRuntimePolicyService.awaitBoundary(nativePromise,timeoutMs,options.signal);options.validateOutput?.(value);const durationMs=Date.now()-startedAt;nativeOperationRuntimePolicyService.recordSuccess(operation,durationMs);nativeOperationReceiptService.record({operation,mode,engine:'RUST',apiVersion:8,durationMs,status:'COMPLETED',metadata:{...safeMetadata,requestId,timeoutMs,...(options.inputSha256?{inputSha256:options.inputSha256}:{})}});return{value,engine:'RUST',fallbackUsed:false,durationMs,requestId,deduplicated:false};}
    catch(error){const durationMs=Date.now()-startedAt;nativeOperationRuntimePolicyService.recordFailure(operation,error,durationMs);const cancelled=error instanceof DOMException&&error.name==='AbortError';nativeOperationReceiptService.record({operation,mode,engine:'RUST',apiVersion:8,durationMs,status:cancelled?'CANCELLED':'FAILED',metadata:{...safeMetadata,requestId,timeoutMs},error:error instanceof Error?error.message:String(error)});throw error;}
  }
  runtimeSnapshot(){return nativeOperationRuntimePolicyService.snapshot();}
}
export const nativeOperationDispatcherService=new NativeOperationDispatcherService();

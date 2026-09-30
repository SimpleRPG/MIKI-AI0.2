export type NativeOperationKind =
  | 'HEALTH'
  | 'SCAN_REPOSITORY'
  | 'HASH_FILES'
  | 'BUILD_ZIP'
  | 'COPY_ZIPTXT'
  | 'COMPARE_REVISIONS'
  | 'SEARCH_TEXT'
  | 'VERIFY_ARTIFACTS'
  | 'GIT_BLOB_SHA';

export type NativeOperationMode = 'RUST_ONLY';

export interface NativeOperationRequest<TPayload=Record<string, unknown>> {
  schemaVersion:1;
  requestId:string;
  operation:NativeOperationKind;
  mode:NativeOperationMode;
  payload:TPayload;
  expectedInputSha256?:string;
  timeoutMs:number;
}

export interface NativeOperationReceipt<TResult=Record<string, unknown>> {
  schemaVersion:1;
  requestId:string;
  operation:NativeOperationKind;
  engine:'RUST'|'TYPESCRIPT';
  status:'COMPLETED'|'UNAVAILABLE'|'FAILED'|'CANCELLED';
  apiVersion:number;
  durationMs:number;
  result?:TResult;
  outputSha256?:string;
  errorCode?:string;
  errorMessage?:string;
}

const DEFAULT_MODES:Record<NativeOperationKind,NativeOperationMode>={
  HEALTH:'RUST_ONLY',
  SCAN_REPOSITORY:'RUST_ONLY',
  HASH_FILES:'RUST_ONLY',
  BUILD_ZIP:'RUST_ONLY',
  COPY_ZIPTXT:'RUST_ONLY',
  COMPARE_REVISIONS:'RUST_ONLY',
  SEARCH_TEXT:'RUST_ONLY',
  VERIFY_ARTIFACTS:'RUST_ONLY',
  GIT_BLOB_SHA:'RUST_ONLY',
};



class NativeOperationContractService {
  create<TPayload>(operation:NativeOperationKind,payload:TPayload,input?:Partial<Pick<NativeOperationRequest,'requestId'|'mode'|'expectedInputSha256'|'timeoutMs'>>):NativeOperationRequest<TPayload>{
    return {
      schemaVersion:1,
      requestId:input?.requestId||`NATIVE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      operation,
      mode:input?.mode||DEFAULT_MODES[operation],
      payload,
      expectedInputSha256:input?.expectedInputSha256,
      timeoutMs:Math.min(30*60*1000,Math.max(1000,input?.timeoutMs||30_000)),
    };
  }
  mode(operation:NativeOperationKind):NativeOperationMode{return DEFAULT_MODES[operation];}
}
export const nativeOperationContractService=new NativeOperationContractService();

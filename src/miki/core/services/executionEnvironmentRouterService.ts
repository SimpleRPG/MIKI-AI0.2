import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from './canonicalSha256Service';

export type CiExecutionEnvironment='DEVICE'|'SERVER'|'GITHUB_ACTIONS'|'MANUAL_REVIEW';
export interface EnvironmentRoute { stage:string; environment:CiExecutionEnvironment; reason:string; }

export interface EnvironmentFingerprint {
  signature:string;
  fields:Record<string,string>;
  capturedAt:number;
}

export interface EnvironmentHints {
  environment?:unknown;
  environmentFingerprint?:unknown;
  gitHead?:unknown;
  targetSnapshotSha256?:unknown;
  implementationHash?:unknown;
  permissionSignature?:unknown;
  safetySignature?:unknown;
  runtimeSignature?:unknown;
  networkState?:unknown;
}

const text=(value:unknown):string => typeof value==='string' ? value.trim() : value == null ? '' : String(value).trim();

class ExecutionEnvironmentRouterService {
  route(stage:string):EnvironmentRoute {
    const normalized=stage.toUpperCase();
    if(normalized==='DEVICE')return {stage,environment:'GITHUB_ACTIONS',reason:'APK_AND_ANDROID_CONTRACT'};
    if(['STATIC','TYPECHECK','REGRESSION','COUNTEREXAMPLE','GENERALIZATION','PERSISTENCE'].includes(normalized))return {stage,environment:'SERVER',reason:'ISOLATED_NODE_RUNNER'};
    return {stage,environment:'MANUAL_REVIEW',reason:'NO_VERIFIED_RUNNER'};
  }

  capture(hints:EnvironmentHints={}):EnvironmentFingerprint {
    const supplied = hints.environmentFingerprint && typeof hints.environmentFingerprint === 'object'
      ? hints.environmentFingerprint as Record<string,unknown>
      : {};
    const processRecord:Record<string,unknown> = typeof process !== 'undefined'
      ? {
          platform:process.platform,
          architecture:process.arch,
          runtime:'node',
          runtimeVersion:process.version,
          nodeEnv:process.env.NODE_ENV || '',
        }
      : { platform:'browser', architecture:'unknown', runtime:'web', runtimeVersion:'', nodeEnv:'' };

    const fields:Record<string,string> = {
      platform:text(supplied.platform || processRecord.platform),
      architecture:text(supplied.architecture || processRecord.architecture),
      runtime:text(supplied.runtime || processRecord.runtime),
      runtimeVersion:text(supplied.runtimeVersion || processRecord.runtimeVersion),
      nodeEnv:text(supplied.nodeEnv || processRecord.nodeEnv),
      storageBackend:text(storageService.getBackendName()),
      searxngBaseUrl:text(storageService.getItem('miki_searxng_base_url')),
      webResearchPolicy:text(storageService.getItem('miki_web_research_policy_v1')),
      researchQueryPlanningPolicy:text(storageService.getItem('miki_research_query_planning_policy_v1')),
      gitHead:text(hints.gitHead),
      targetSnapshotSha256:text(hints.targetSnapshotSha256),
      implementationHash:text(hints.implementationHash),
      permissionSignature:text(hints.permissionSignature),
      safetySignature:text(hints.safetySignature),
      runtimeSignature:text(hints.runtimeSignature),
      networkState:text(hints.networkState),
      environment:text(hints.environment),
    };
    const signature=canonicalSha256Object(fields);
    return {signature,fields,capturedAt:Date.now()};
  }

  compare(expected:EnvironmentFingerprint, current:EnvironmentFingerprint):{changed:boolean;changedFields:string[]} {
    const keys=[...new Set([...Object.keys(expected.fields),...Object.keys(current.fields)])].sort();
    const changedFields=keys.filter(key => (expected.fields[key]||'') !== (current.fields[key]||''));
    return {changed:expected.signature!==current.signature || changedFields.length>0,changedFields};
  }
}

export const executionEnvironmentRouterService=new ExecutionEnvironmentRouterService();

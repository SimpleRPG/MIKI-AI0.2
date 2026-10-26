export interface NormalizedCandidatePath {
  allowed: boolean;
  normalizedPath: string;
  reason?: string;
}

export interface CandidatePathValidationInput {
  path: string;
  isNewFile: boolean;
  baselineContent: string;
  sourceContent?: string;
  sourcePathExists: boolean;
  targetPathExists: boolean;
}

export interface CandidatePathValidationResult {
  allowed: boolean;
  normalizedPath: string;
  operation: 'CREATE' | 'UPDATE';
  reason?: string;
}

const CREATE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'txt', 'java', 'rs', 'xml', 'css', 'html']);
const BLOCKED_SEGMENTS = new Set(['.git', 'node_modules', '.miki-runtime', 'dist', 'build', 'target']);
const PROTECTED_CREATE_NAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json',
  'yarn.lock', 'pnpm-lock.yaml', 'tsconfig.json',
  'vite.config.ts', 'vite.config.js', '.npmrc', '.gitignore',
  '.gitattributes', 'cargo.toml', 'cargo.lock',
  'gradle.properties', 'settings.gradle', 'settings.gradle.kts',
  'build.gradle', 'build.gradle.kts', 'androidmanifest.xml'
]);
const PROTECTED_CONFIGURATION_PATTERNS = [
  /^tsconfig(?:\\..+)?\\.json$/,
  /^vite\\.config\\..+$/,
  /^capacitor\\.config\\..+$/,
  /^next\\.config\\..+$/,
  /^webpack\\.config\\..+$/,
  /^metro\\.config\\..+$/,
  /^gradle\\.properties$/,
  /^settings\\.gradle(?:\\.kts)?$/,
  /^build\\.gradle(?:\\.kts)?$/,
  /^cargo\\.(?:toml|lock)$/,
  /^androidmanifest\\.xml$/,
  /^\\.env(?:\\..+)?$/,
  /^\\.npmrc$/,
  /^\\.yarnrc(?:\\.yml)?$/
];

class CandidateValidationPathPolicyService {
  public normalize(value: string): NormalizedCandidatePath {
    const original = typeof value === 'string' ? value : '';
    const normalized = original.replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || normalized.includes('\0')) {
      return { allowed: false, normalizedPath: normalized, reason: 'UNSAFE_PATH_SYNTAX' };
    }
    const segments = normalized.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
      return { allowed: false, normalizedPath: normalized, reason: 'UNSAFE_PATH_SEGMENT' };
    }
    return { allowed: true, normalizedPath: segments.join('/') };
  }

  public evaluate(input: CandidatePathValidationInput): CandidatePathValidationResult {
    const normalized = this.normalize(input.path);
    const operation = input.isNewFile ? 'CREATE' : 'UPDATE';
    if (!normalized.allowed) return { ...normalized, operation };
    const filePath = normalized.normalizedPath;
    const segments = filePath.toLowerCase().split('/');
    if (segments.some(segment => BLOCKED_SEGMENTS.has(segment))) {
      return { allowed: false, normalizedPath: filePath, operation, reason: 'CANDIDATE_PATH_IN_BLOCKED_DIRECTORY' };
    }

    // Apply configuration protection before CREATE/UPDATE diverge.
    // A matching baseline proves freshness, not that configuration edits are safe.
    const baseName = segments[segments.length - 1];
    const protectedConfiguration =
      segments.includes('.github') ||
      PROTECTED_CREATE_NAMES.has(baseName) ||
      baseName === '.env' ||
      baseName.startsWith('.env.') ||
      PROTECTED_CONFIGURATION_PATTERNS.some(pattern => pattern.test(baseName));

    if (protectedConfiguration) {
      return {
        allowed: false,
        normalizedPath: filePath,
        operation,
        reason: 'PROTECTED_CONFIGURATION_PATH_FORBIDDEN'
      };
    }

    if (input.isNewFile) {
      if (segments.includes('.github')) {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_GITHUB_METADATA_FORBIDDEN' };
      }
      const baseName = segments[segments.length - 1];
      if (PROTECTED_CREATE_NAMES.has(baseName) || baseName === '.env' || baseName.startsWith('.env.')) {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_PROTECTED_CONFIGURATION_FORBIDDEN' };
      }
      const extension = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.') + 1) : '';
      if (!CREATE_EXTENSIONS.has(extension)) {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_EXTENSION_NOT_ALLOWLISTED' };
      }
      if (input.sourcePathExists) {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_SOURCE_PATH_ALREADY_EXISTS' };
      }
      if (input.targetPathExists) {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_TARGET_ALREADY_EXISTS' };
      }
      if (input.baselineContent !== '') {
        return { allowed: false, normalizedPath: filePath, operation, reason: 'NEW_FILE_BASELINE_MUST_BE_EMPTY' };
      }
      return { allowed: true, normalizedPath: filePath, operation };
    }

    if (!input.sourcePathExists || !input.targetPathExists) {
      return { allowed: false, normalizedPath: filePath, operation, reason: 'UPDATE_TARGET_NOT_IN_SOURCE_SNAPSHOT' };
    }
    if (typeof input.sourceContent !== 'string' || input.baselineContent !== input.sourceContent) {
      return { allowed: false, normalizedPath: filePath, operation, reason: 'UPDATE_BASELINE_MISMATCH' };
    }
    return { allowed: true, normalizedPath: filePath, operation };
  }

  public validateUnifiedReceipt(submittedPlanId: string, receipt: any, targetFile: string, codeOverride?: string): {allowed:boolean;reason?:string;files?:any[];selectedFile?:any} {
    const fail = (reason:string) => ({allowed:false,reason});
    if (!submittedPlanId || !receipt || typeof receipt !== 'object' || receipt.developmentPlanId !== submittedPlanId) return fail('UNIFIED_DEVELOPMENT_PLAN_ID_MISMATCH');
    if (receipt.completed !== true || receipt.validationPassed !== true || typeof receipt.workspaceId !== 'string' || !receipt.workspaceId.trim() || typeof receipt.candidateSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(receipt.candidateSha256)) return fail('UNIFIED_DEVELOPMENT_NOT_COMPLETED_OR_VALIDATED');
    const plan = receipt.validationPlan;
    const commands = Array.isArray(plan?.testCommands) ? plan.testCommands : [];
    const results = Array.isArray(receipt.testResults) ? receipt.testResults : [];
    if (plan?.developmentPlanId !== submittedPlanId || typeof plan?.testPlanId !== 'string' || !plan.testPlanId.trim() || commands.length === 0 || commands.some((command:unknown)=>typeof command !== 'string' || !command.trim()) || results.length !== commands.length || results.some((result:any,index:number)=>!result || result.command !== commands[index] || result.passed !== true || Number(result.exitCode) !== 0)) return fail('UNIFIED_VALIDATION_EVIDENCE_INCOMPLETE');
    if (!Array.isArray(plan.acceptanceCriterionIds) || plan.acceptanceCriterionIds.length === 0) return fail('UNIFIED_ACCEPTANCE_CRITERIA_MISSING');
    const candidateFiles = Array.isArray(receipt.candidateFiles) ? receipt.candidateFiles : [];
    if (candidateFiles.length === 0) return fail('UNIFIED_CANDIDATE_FILES_EMPTY');
    const seen = new Set<string>();
    const files:any[] = [];
    for (const file of candidateFiles) {
      if (!file || typeof file.path !== 'string' || typeof file.isNewFile !== 'boolean' || typeof file.baselineContent !== 'string' || typeof file.candidateContent !== 'string' || !file.candidateContent.trim() || typeof file.candidateSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.candidateSha256)) return fail('UNIFIED_CANDIDATE_FILE_INVALID');
      const normalized = this.normalize(file.path);
      if (!normalized.allowed || seen.has(normalized.normalizedPath)) return fail(`UNIFIED_CANDIDATE_PATH_REJECTED:${normalized.reason || normalized.normalizedPath}`);
      seen.add(normalized.normalizedPath);
      const pathDecision = this.evaluate({path:normalized.normalizedPath,isNewFile:file.isNewFile,baselineContent:file.baselineContent,sourceContent:file.isNewFile?undefined:file.baselineContent,sourcePathExists:!file.isNewFile,targetPathExists:!file.isNewFile});
      if (!pathDecision.allowed) return fail(`UNIFIED_CANDIDATE_PATH_REJECTED:${pathDecision.reason || normalized.normalizedPath}`);
      files.push({...file,path:normalized.normalizedPath});
    }
    let normalizedTarget = '';
    if (targetFile) {
      const target = this.normalize(targetFile);
      if (!target.allowed) return fail(`UNIFIED_TARGET_PATH_REJECTED:${target.reason || target.normalizedPath}`);
      normalizedTarget = target.normalizedPath;
      if (!files.some(file=>file.path===normalizedTarget)) return fail(`UNIFIED_TARGET_NOT_IN_CANDIDATE:${normalizedTarget}`);
    }
    if (typeof codeOverride === 'string' && codeOverride.trim() && !files.some(file=>file.candidateContent===codeOverride)) return fail('EXPLICIT_CODE_OVERRIDE_NOT_PRESERVED_BY_UNIFIED_PLAN');
    return {allowed:true,files,selectedFile:files.find(file=>file.path===normalizedTarget)||files[0]};
  }
}

export const candidateValidationPathPolicyService = new CandidateValidationPathPolicyService();

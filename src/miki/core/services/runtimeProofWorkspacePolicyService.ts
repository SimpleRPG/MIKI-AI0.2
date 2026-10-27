const EXCLUDED_SNAPSHOT_SEGMENTS = new Set([
  '.git', '.github', '.miki-runtime', 'node_modules', 'dist', 'dist-apk', 'build', 'target'
]);
const SENSITIVE_SEGMENTS = new Set([
  '.npmrc', '.netrc', '.pypirc', '.git-credentials',
  'credentials.json', 'secrets.json', 'service-account.json', 'id_rsa', 'id_ed25519'
]);
const FORBIDDEN_CANDIDATE_CONFIG_NAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.npmrc', '.netrc', '.pypirc', '.git-credentials', 'gradle.properties',
  'settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts',
  'cargo.toml', 'cargo.lock', 'androidmanifest.xml'
]);
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);

function normalizedPath(value: string): string {
  return String(value ?? '').replace(/\\/g, '/');
}

function pathSegments(value: string): string[] {
  return normalizedPath(value).split('/').map(segment => segment.toLowerCase());
}

function hasUnsafeRelativeSyntax(value: string): boolean {
  const normalized = normalizedPath(value);
  return !normalized || normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) || normalized.includes('\0') ||
    normalized.split('/').some(segment =>
      !segment || segment === '.' || segment === '..'
    );
}

function isSensitiveSegment(segment: string): boolean {
  const lower = segment.toLowerCase();
  return lower === '.env' || lower.startsWith('.env.') ||
    SENSITIVE_SEGMENTS.has(lower);
}

function hasSensitiveExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 && SENSITIVE_EXTENSIONS.has(lower.slice(dot));
}

function isProtectedBuildConfiguration(segment: string): boolean {
  const lower = segment.toLowerCase();
  return FORBIDDEN_CANDIDATE_CONFIG_NAMES.has(lower) ||
    /^tsconfig(?:\..+)?\.json$/.test(lower) ||
    /^(?:vite|next|webpack|metro|capacitor)\.config\.[a-z0-9]+$/.test(lower) ||
    /^\.github$/.test(lower);
}

/** True when a repository-relative path may be included in a runtime-proof snapshot. */
export function shouldCopyRuntimeProofSnapshotPath(value: string): boolean {
  if (value === '') return true;
  if (hasUnsafeRelativeSyntax(value)) return false;

  const segments = pathSegments(value);
  if (segments.some(segment =>
    EXCLUDED_SNAPSHOT_SEGMENTS.has(segment) || isSensitiveSegment(segment)
  )) return false;

  const basename = segments[segments.length - 1] || '';
  return !hasSensitiveExtension(basename);
}

/** Reject request-supplied paths that could replace manifests, secrets, or runtime controls. */
export function isRuntimeProofCandidatePathForbidden(value: string): boolean {
  if (hasUnsafeRelativeSyntax(value)) return true;

  const segments = pathSegments(value);
  if (segments.some(segment =>
    EXCLUDED_SNAPSHOT_SEGMENTS.has(segment) ||
    isSensitiveSegment(segment) ||
    isProtectedBuildConfiguration(segment)
  )) return true;

  const basename = segments[segments.length - 1] || '';
  return hasSensitiveExtension(basename);
}

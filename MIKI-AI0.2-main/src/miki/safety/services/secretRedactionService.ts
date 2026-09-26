export interface SecretRedactionResult<T> {
  value: T;
  redactedPaths: string[];
}

const SECRET_KEY_PATTERN = /(?:api[_-]?key|token|secret|password|passwd|authorization|cookie|private[_-]?key|client[_-]?secret)/i;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const ASSIGNMENT_PATTERN = /\b(api[_-]?key|token|secret|password|passwd|client[_-]?secret)\s*[=:]\s*([^\s,;]+)/gi;
const URL_CREDENTIAL_PATTERN = /(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi;

const redactString = (input: string): string => input
  .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
  .replace(ASSIGNMENT_PATTERN, (_match, key: string) => `${key}=[REDACTED]`)
  .replace(URL_CREDENTIAL_PATTERN, '$1[REDACTED]@');

const visit = (input: unknown, path: string, redactedPaths: string[], seen: WeakSet<object>): unknown => {
  if (typeof input === 'string') {
    const redacted = redactString(input);
    if (redacted !== input) redactedPaths.push(path || '$');
    return redacted;
  }
  if (input === null || typeof input !== 'object') return input;
  if (seen.has(input)) return '[CIRCULAR]';
  seen.add(input);
  if (Array.isArray(input)) return input.map((item, index) => visit(item, `${path}[${index}]`, redactedPaths, seen));
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = value === undefined || value === null || value === '' ? value : '[REDACTED]';
      if (output[key] !== value) redactedPaths.push(nextPath);
      continue;
    }
    output[key] = visit(value, nextPath, redactedPaths, seen);
  }
  return output;
};

export const secretRedactionService = {
  redactText(input: string): string {
    return redactString(input);
  },
  redact<T>(input: T): SecretRedactionResult<T> {
    const redactedPaths: string[] = [];
    const value = visit(input, '', redactedPaths, new WeakSet<object>()) as T;
    return { value, redactedPaths: [...new Set(redactedPaths)].sort() };
  },
  containsSecretMaterial(input: unknown): boolean {
    const serialized = typeof input === 'string' ? input : JSON.stringify(input);
    if (!serialized) return false;
    return BEARER_PATTERN.test(serialized) || ASSIGNMENT_PATTERN.test(serialized) || URL_CREDENTIAL_PATTERN.test(serialized);
  }
};

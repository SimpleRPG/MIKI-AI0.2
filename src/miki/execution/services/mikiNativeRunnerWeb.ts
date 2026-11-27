import { WebPlugin, registerPlugin } from '@capacitor/core';

/**
 * Web implementation of the MIKINativeRunner plugin (route A).
 *
 * On Android the native plugin calls the Rust crate directly and this
 * implementation is never used. On web/lab deployments it forwards the
 * crate's pure-function methods to the app server's /api/native-core
 * endpoint, which relays them to a sidecar binary built from the same
 * crate — so engine:'RUST' results are genuine crate output.
 *
 * Only the pure JSON methods are wired (analyzeOwnedDomain,
 * decideCoreGoals, rankDomainRoutes, verifyVbaCode, processDataRecords,
 * planExecution, searchMemory, analyzeCandidate, health,
 * nativeCoreHealth). The workspace file methods are rooted in the
 * Android filesDir workspace and are deliberately NOT implemented here:
 * their callers guard on the native platform or catch and fall back to
 * the honest JS paths. When the server endpoint is not configured or
 * the sidecar is down, every wired method rejects, so the wrappers
 * throw and the existing JS degradation (P3002) takes over — no result
 * ever claims engine:'RUST' unless the crate produced it.
 *
 * This module must be imported before any other module that calls
 * registerPlugin('MIKINativeRunner'): Capacitor keeps the first
 * registration's implementations. src/main.tsx imports it first.
 */

const EXPECTED_API_VERSION = 8;
const EXPECTED_ABI_MAGIC = 0x4d494b49;

async function callNativeCore(method: string, request: Record<string, unknown>, domain?: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch('/api/native-core', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, ...(domain ? { domain } : {}), request }),
    });
  } catch (error) {
    throw new Error(`RUST_WEB_BRIDGE_UNAVAILABLE:${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    let detail = '';
    try { detail = String((await response.json())?.error || ''); } catch { /* keep status only */ }
    throw new Error(`RUST_WEB_BRIDGE_UNAVAILABLE:${response.status}${detail ? `:${detail}` : ''}`);
  }
  return response.json();
}

export class MikiNativeRunnerWeb extends WebPlugin {
  async analyzeOwnedDomain(input: Record<string, unknown>): Promise<any> {
    const domain = String((input as any)?.domain || '');
    if (!domain) throw new Error('OWNED_DOMAIN_REQUIRED');
    // Mirror the Android plugin: the domain travels separately and the
    // request carries only items/baseline/context/required/receipts.
    return callNativeCore('analyzeOwnedDomain', {
      items: (input as any).items ?? [],
      baseline: (input as any).baseline ?? [],
      context: (input as any).context ?? {},
      required: (input as any).required ?? [],
      receipts: (input as any).receipts ?? [],
    }, domain);
  }

  async decideCoreGoals(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('decideCoreGoals', input);
  }

  async rankDomainRoutes(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('rankDomainRoutes', input);
  }

  async verifyVbaCode(input: Record<string, unknown>): Promise<any> {
    // Mirror the Android plugin's field selection and defaults.
    return callNativeCore('verifyVbaCode', {
      code: (input as any).code,
      delivery_mode: (input as any).delivery_mode ?? 'CODE',
      baseline_code: (input as any).baseline_code ?? null,
      expected_code_sha256: (input as any).expected_code_sha256 ?? null,
      expected_code_length: (input as any).expected_code_length ?? null,
      expected_code_line_count: (input as any).expected_code_line_count ?? null,
    });
  }

  async processDataRecords(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('processDataRecords', input);
  }

  async planExecution(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('planExecution', input);
  }

  async searchMemory(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('searchMemory', input);
  }

  async analyzeCandidate(input: Record<string, unknown>): Promise<any> {
    return callNativeCore('analyzeCandidate', input);
  }

  async nativeCoreHealth(): Promise<{ available: boolean; compatible: boolean; api_version: number; reason?: string }> {
    const result = await callNativeCore('health', {});
    const apiVersion = Number(result?.api_version) || 0;
    const abiMagic = Number(result?.abi_magic) || 0;
    const compatible = apiVersion === EXPECTED_API_VERSION && abiMagic === EXPECTED_ABI_MAGIC;
    return {
      available: true,
      compatible,
      api_version: apiVersion,
      ...(compatible ? {} : { reason: 'RUST_NATIVE_CORE_VERSION_MISMATCH' }),
    };
  }

  async health(): Promise<{ ready: boolean; runner_id: string; rust_available: boolean; rust_compatible: boolean; rust_api_version: number; rust_reason?: string }> {
    try {
      const core = await this.nativeCoreHealth();
      return {
        ready: true,
        runner_id: 'WEB_RUST_SIDECAR',
        rust_available: core.available,
        rust_compatible: core.compatible,
        rust_api_version: core.api_version,
        ...(core.reason ? { rust_reason: core.reason } : {}),
      };
    } catch (error) {
      return {
        ready: true,
        runner_id: 'WEB_RUST_SIDECAR',
        rust_available: false,
        rust_compatible: false,
        rust_api_version: 0,
        rust_reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

registerPlugin('MIKINativeRunner', {
  web: () => new MikiNativeRunnerWeb(),
});

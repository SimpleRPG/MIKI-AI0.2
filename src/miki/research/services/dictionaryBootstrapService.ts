import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { japaneseDictionaryService } from './japaneseDictionaryService';

const STATE_KEY = 'miki_dictionary_bootstrap_v1';

interface DictionaryBootstrapState { version: string; importedAt: number; entries: number }

/**
 * P385: the large dictionary (JMdict) lives on the local server
 * (Termux), which fetches and converts it in the background. This
 * service only ever receives the finished common package from the
 * server and imports it. It runs once per launch, entirely in the
 * background, and every failure is silent: with no server, no
 * package, or an unchanged version, the dictionary simply stays as
 * it was, so the app is never blocked or broken by dictionary work.
 */
class DictionaryBootstrapService {
  private attempted = false;

  public initialize(): void {
    if (this.attempted) return;
    this.attempted = true;
    void this.attempt();
  }

  private async attempt(): Promise<void> {
    try {
      const base = String(storageService.getItem('miki_api_base_url') || '').replace(/\/$/, '');
      if (!base) return;
      const timeout = (ms: number): AbortSignal | undefined => {
        try { return (AbortSignal as unknown as { timeout?: (value: number) => AbortSignal }).timeout?.(ms); } catch { return undefined; }
      };
      const statusResponse = await fetch(`${base}/api/dictionary/status`, { signal: timeout(10000) });
      if (!statusResponse.ok) return;
      const status = (await statusResponse.json()) as { manifest?: { version?: string } | null };
      const version = status?.manifest?.version;
      if (!version) {
        // Not converted yet: ask the server to prepare it in the
        // background. A later launch picks up the finished package.
        await fetch(`${base}/api/dictionary/prepare`, { method: 'POST', signal: timeout(10000) }).catch(() => undefined);
        return;
      }
      const state = storageService.getJson<DictionaryBootstrapState>(STATE_KEY, null as unknown as DictionaryBootstrapState);
      if (state?.version === version) return;
      const packageResponse = await fetch(`${base}/api/dictionary/package?tier=common`, { signal: timeout(120000) });
      if (!packageResponse.ok) return;
      const json = await packageResponse.text();
      const imported = japaneseDictionaryService.importJson(json, 'JMdict');
      if (imported > 0) {
        storageService.setItem(STATE_KEY, JSON.stringify({ version, importedAt: Date.now(), entries: imported } satisfies DictionaryBootstrapState));
        systemLogger.info('CHAT', `[JapaneseDictionary] JMdict package imported from server: ${imported} entries (version ${version})`);
      }
    } catch {
      // Dictionary bootstrap is best-effort by design; see class docs.
    }
  }
}

export const dictionaryBootstrapService = new DictionaryBootstrapService();

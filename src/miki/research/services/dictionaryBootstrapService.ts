import { Capacitor } from '@capacitor/core';
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
 * background: with no server, no package, or an unchanged version,
 * the dictionary simply stays as it was, so the app is never blocked
 * or broken by dictionary work. P2004: the once-per-launch attempt
 * logs where it stopped (one line), because a fully silent supply
 * path hid a never-firing bootstrap on device; the per-term deep
 * lookup below stays silent.
 */
class DictionaryBootstrapService {
  private attempted = false;
  private deepAttempted = new Set<string>();

  public initialize(): void {
    if (this.attempted) return;
    this.attempted = true;
    void this.attempt();
  }

  /**
   * P2004: 接続先の解決を api.ts の apiUrl() と同じ既定にそろえる
   * （設定値が無ければ Android では端末内サーバー 127.0.0.1:3000）。
   * 従来は `miki_api_base_url` の設定値だけを見て、未設定なら無音で
   * return していたため、設定をしていない端末では供給が一度も
   * 走らなかった（実機で取り込みログ皆無・意味待ちが解消しない
   * 原因）。api.ts は systemLogger 経由の循環参照を避けるため
   * import せず、systemLogger.syncToServer と同じ流儀で軽量版を
   * ここに持つ。ブラウザ（相対URLが正しい環境）では '' を返す。
   */
  private resolveBase(): string {
    const configured = String(storageService.getItem('miki_api_base_url') || '').trim().replace(/\/+$/, '');
    if (configured) return configured;
    try {
      return Capacitor.getPlatform() === 'android' ? 'http://127.0.0.1:3000' : '';
    } catch {
      return '';
    }
  }

  /**
   * P386: ask the server's full dictionary about one word the local
   * dictionary does not know. Fire-and-forget: on a hit the entries
   * are learned into the local JMdict collection, so later turns
   * resolve the word locally. Each surface is attempted at most
   * once per launch, and every failure is silent.
   */
  public lookupDeep(surface: string): void {
    const clean = (surface || '').trim();
    if (!clean || this.deepAttempted.has(clean)) return;
    this.deepAttempted.add(clean);
    void (async () => {
      try {
        const base = this.resolveBase();
        let signal: AbortSignal | undefined;
        try { signal = (AbortSignal as unknown as { timeout?: (value: number) => AbortSignal }).timeout?.(15000); } catch { signal = undefined; }
        const response = await fetch(`${base}/api/dictionary/lookup?surface=${encodeURIComponent(clean)}`, { signal });
        if (!response.ok) return;
        const data = (await response.json()) as { entries?: Parameters<typeof japaneseDictionaryService.addImportedEntries>[0] };
        if (Array.isArray(data?.entries) && data.entries.length) {
          const added = japaneseDictionaryService.addImportedEntries(data.entries, 'JMdict');
          if (added > 0) systemLogger.info('CHAT', `[JapaneseDictionary] deep lookup learned "${clean}" from the server dictionary (${added} entries)`);
        }
      } catch {
        // Deep lookup is best-effort by design; see class docs.
      }
    })();
  }

  private async attempt(): Promise<void> {
    // P2004: 供給の成否は起動ごとに1回だけログへ残す。従来は全経路が
    // 無音で、「届いていないこと」自体に気づけなかった。attempt は
    // 起動ごとに1回しか走らないため、ログ量は増えない。
    try {
      const base = this.resolveBase();
      const timeout = (ms: number): AbortSignal | undefined => {
        try { return (AbortSignal as unknown as { timeout?: (value: number) => AbortSignal }).timeout?.(ms); } catch { return undefined; }
      };
      const statusResponse = await fetch(`${base}/api/dictionary/status`, { signal: timeout(10000) });
      if (!statusResponse.ok) {
        systemLogger.warn('CHAT', `[JapaneseDictionary] bootstrap stopped: dictionary status unavailable (HTTP ${statusResponse.status})`);
        return;
      }
      const status = (await statusResponse.json()) as { manifest?: { version?: string } | null };
      const version = status?.manifest?.version;
      if (!version) {
        // Not converted yet: ask the server to prepare it in the
        // background. A later launch picks up the finished package.
        await fetch(`${base}/api/dictionary/prepare`, { method: 'POST', signal: timeout(10000) }).catch(() => undefined);
        systemLogger.info('CHAT', '[JapaneseDictionary] bootstrap: server dictionary is not converted yet; background prepare requested');
        return;
      }
      const state = storageService.getJson<DictionaryBootstrapState>(STATE_KEY, null as unknown as DictionaryBootstrapState);
      if (state?.version === version) return;
      const packageResponse = await fetch(`${base}/api/dictionary/package?tier=common`, { signal: timeout(120000) });
      if (!packageResponse.ok) {
        systemLogger.warn('CHAT', `[JapaneseDictionary] bootstrap stopped: dictionary package unavailable (HTTP ${packageResponse.status})`);
        return;
      }
      const json = await packageResponse.text();
      const imported = japaneseDictionaryService.importJson(json, 'JMdict');
      if (imported > 0) {
        storageService.setItem(STATE_KEY, JSON.stringify({ version, importedAt: Date.now(), entries: imported } satisfies DictionaryBootstrapState));
        systemLogger.info('CHAT', `[JapaneseDictionary] JMdict package imported from server: ${imported} entries (version ${version})`);
      } else {
        systemLogger.warn('CHAT', '[JapaneseDictionary] bootstrap stopped: dictionary package yielded no entries');
      }
    } catch (error) {
      systemLogger.warn('CHAT', `[JapaneseDictionary] bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const dictionaryBootstrapService = new DictionaryBootstrapService();

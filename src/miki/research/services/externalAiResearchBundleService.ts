import { storageService } from '../../../services/storageService';
import { apiUrl, getCustomApiHeaders } from '../../../services/api';
import { evidenceService } from '../../memory/services/evidenceService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export type ExternalAiProvider = 'GEMINI' | 'GENERIC_EXTERNAL_AI';
export type ExternalAiBundleStatus = 'DRAFT' | 'READY' | 'SENT' | 'RESPONSE_RECEIVED' | 'IMPORTED' | 'FAILED';

export interface ExternalAiResearchBundle {
  bundleId: string;
  provider: ExternalAiProvider;
  topicKey: string;
  gapIds: string[];
  promptText: string;
  responseText?: string;
  status: ExternalAiBundleStatus;
  mode?: 'AUTO' | 'MANUAL';
  evidenceIds: string[];
  promptSha256?: string;
  responseSha256?: string;
  replayKey?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

const KEY = 'miki_external_ai_research_bundles_v1';
const MAX_GAPS_PER_BUNDLE = 6;

class ExternalAiResearchBundleService {
  private bundles = new Map<string, ExternalAiResearchBundle>();
  private sequence = 0;

  public constructor() { this.load(); }

  public buildFromOpenGaps(provider: ExternalAiProvider = 'GEMINI'): ExternalAiResearchBundle[] {
    const gaps = knowledgeGapService.listOpen(100);
    const groups = new Map<string, typeof gaps>();
    for (const gap of gaps) {
      const key = this.topicKey(gap.query);
      const group = groups.get(key) || [];
      group.push(gap);
      groups.set(key, group);
    }
    const output: ExternalAiResearchBundle[] = [];
    for (const [topicKey, group] of groups) {
      for (let index = 0; index < group.length; index += MAX_GAPS_PER_BUNDLE) {
        const chunk = group.slice(index, index + MAX_GAPS_PER_BUNDLE);
        const existing = this.findByGaps(chunk.map(gap => gap.id));
        if (existing) { output.push(existing); continue; }
        this.sequence += 1;
        const now = Date.now();
        const bundle: ExternalAiResearchBundle = {
          bundleId: `ERB-${now}-${String(this.sequence).padStart(6, '0')}`,
          provider,
          topicKey,
          gapIds: chunk.map(gap => gap.id),
          promptText: this.renderPrompt(chunk),
          status: 'READY',
          evidenceIds: [],
          promptSha256: canonicalSha256Object({ provider, gapIds: chunk.map(gap => gap.id), promptText: this.renderPrompt(chunk) }),
          replayKey: `ER-REPLAY-${canonicalSha256Object({ provider, gapIds: chunk.map(gap => gap.id).sort() }).slice(0,20)}`,
          createdAt: now,
          updatedAt: now,
        };
        this.bundles.set(bundle.bundleId, bundle);
        output.push(this.clone(bundle));
      }
    }
    this.save();
    return output;
  }

  public async sendAutomatically(bundleId: string): Promise<ExternalAiResearchBundle | undefined> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return undefined;
    bundle.promptSha256 = canonicalSha256Object({ provider: bundle.provider, gapIds: [...bundle.gapIds].sort(), promptText: bundle.promptText });
    bundle.replayKey = bundle.replayKey || `ER-REPLAY-${canonicalSha256Object({ provider: bundle.provider, gapIds: [...bundle.gapIds].sort() }).slice(0,20)}`;
    bundle.mode = 'AUTO'; bundle.status = 'SENT'; bundle.updatedAt = Date.now(); this.save();
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: getCustomApiHeaders(),
        body: JSON.stringify({ message: bundle.promptText, history: [], persona: { name: 'ExternalResearch', role: 'research assistant' }, settings: { engineMode: 'gemini_cloud' }, files: [], attachedFiles: [], memories: [], activeGameCode: '' }),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const body = await response.json();
      const text = typeof body.text === 'string' ? body.text : typeof body.reply === 'string' ? body.reply : '';
      if (!text.trim()) throw new Error('EMPTY_RESPONSE');
      return this.importResponse(bundleId, text, 'AUTO');
    } catch (error) {
      bundle.status = 'FAILED'; bundle.error = error instanceof Error ? error.message : String(error); bundle.updatedAt = Date.now(); this.save();
      return this.clone(bundle);
    }
  }

  public importResponse(bundleId: string, responseText: string, mode: 'AUTO' | 'MANUAL' = 'MANUAL'): ExternalAiResearchBundle | undefined {
    const bundle = this.bundles.get(bundleId);
    if (!bundle || !responseText.trim()) return undefined;
    const normalizedResponse = responseText.trim();
    const promptSha256 = bundle.promptSha256 || canonicalSha256Object({ provider: bundle.provider, gapIds: [...bundle.gapIds].sort(), promptText: bundle.promptText });
    const responseSha256 = canonicalSha256Object({ promptSha256, responseText: normalizedResponse });
    if (bundle.responseSha256 === responseSha256 && bundle.status === 'IMPORTED') return this.clone(bundle);
    bundle.promptSha256 = promptSha256;
    bundle.responseSha256 = responseSha256;
    bundle.replayKey = bundle.replayKey || `ER-REPLAY-${canonicalSha256Object({ provider: bundle.provider, gapIds: [...bundle.gapIds].sort() }).slice(0,20)}`;
    bundle.mode = mode;
    bundle.responseText = normalizedResponse;
    bundle.status = 'RESPONSE_RECEIVED';
    const sections = this.splitResponse(bundle, responseText);
    const evidenceIds: string[] = [];
    for (const section of sections) {
      const evidence = evidenceService.recordCloudAiEvidence({
        title: `External AI research response for ${section.gapId}`,
        snippet: section.text,
        source: bundle.provider,
        sourceId: `${bundle.bundleId}:${section.gapId}`,
        independenceClusterId: `external_ai_${bundle.provider.toLowerCase()}`,
        metadata: { trust_boundary: 'UNTRUSTED_EXTERNAL_AI', external_bundle_id: bundle.bundleId, prompt_sha256: promptSha256, response_sha256: responseSha256, replay_key: bundle.replayKey },
      });
      evidenceIds.push(evidence.evidence_id);
    }
    bundle.evidenceIds = [...new Set([...bundle.evidenceIds, ...evidenceIds])];
    bundle.status = 'IMPORTED'; bundle.updatedAt = Date.now(); bundle.error = undefined; this.save();
    return this.clone(bundle);
  }

  public copyText(bundleId: string): string | undefined { return this.bundles.get(bundleId)?.promptText; }
  public exportPromptText(bundleId: string): { fileName: string; content: string } | undefined {
    const bundle = this.bundles.get(bundleId); if (!bundle) return undefined;
    return { fileName: `${bundle.bundleId}_external_ai_prompt.txt`, content: bundle.promptText };
  }
  public exportResponseTemplate(bundleId: string): { fileName: string; content: string } | undefined {
    const bundle = this.bundles.get(bundleId); if (!bundle) return undefined;
    return { fileName: `${bundle.bundleId}_external_ai_response_template.txt`, content: `BUNDLE_ID=${bundle.bundleId}\nPROVIDER=${bundle.provider}\n\n[RESPONSE]\nPaste the external AI response here. Keep GAP_ID markers if available.\n[/RESPONSE]\n` };
  }
  public list(): ExternalAiResearchBundle[] { return [...this.bundles.values()].sort((a,b)=>b.updatedAt-a.updatedAt).map(item=>this.clone(item)); }
  public get(bundleId: string): ExternalAiResearchBundle | undefined { const item=this.bundles.get(bundleId); return item?this.clone(item):undefined; }

  private renderPrompt(gaps: ReturnType<typeof knowledgeGapService.listOpen>): string {
    return ['You are an external research assistant. Do not treat user assumptions as facts. Return evidence-oriented findings, uncertainty, contradictions, and source suggestions. Do not claim verification.', ...gaps.map((gap,index)=>`\nGAP_ID=${gap.id}\nQUESTION_${index+1}=${gap.query}\nREQUIRED_EVIDENCE=${gap.requiredEvidence.join(' | ') || 'independent supporting evidence'}\nREASON=${gap.reason}`), '\nFor each GAP_ID, provide: FINDING, UNCERTAINTY, CONTRADICTIONS, SOURCES_TO_VERIFY, and NEXT_TEST.'].join('\n');
  }
  private splitResponse(bundle: ExternalAiResearchBundle, text: string): Array<{gapId:string;text:string}> {
    const matches = [...text.matchAll(/GAP_ID\s*[=:]\s*([A-Za-z0-9_-]+)/gi)];
    if (!matches.length) return bundle.gapIds.map(gapId => ({ gapId, text }));
    return matches.map((match,index)=>({ gapId: match[1], text: text.slice(match.index || 0, matches[index+1]?.index || text.length).trim() })).filter(item=>bundle.gapIds.includes(item.gapId));
  }
  private topicKey(query: string): string { return query.normalize('NFKC').toLowerCase().split(/[\s、。,:：/]+/).filter(Boolean).slice(0,3).join('|') || 'general'; }
  private findByGaps(gapIds:string[]): ExternalAiResearchBundle | undefined { const key=[...gapIds].sort().join('|'); const item=[...this.bundles.values()].find(bundle=>[...bundle.gapIds].sort().join('|')===key && bundle.status!=='FAILED'); return item?this.clone(item):undefined; }
  private clone(bundle:ExternalAiResearchBundle): ExternalAiResearchBundle { return {...bundle,gapIds:[...bundle.gapIds],evidenceIds:[...bundle.evidenceIds]}; }
  private save():void { storageService.setItem(KEY,JSON.stringify(this.list().slice(0,500))); }
  private load():void { try { const raw=storageService.getItem(KEY); const parsed=raw?JSON.parse(raw):[]; if(Array.isArray(parsed)) for(const item of parsed) if(item?.bundleId)this.bundles.set(item.bundleId,item); } catch { this.bundles.clear(); } }
}
export const externalAiResearchBundleService = new ExternalAiResearchBundleService();

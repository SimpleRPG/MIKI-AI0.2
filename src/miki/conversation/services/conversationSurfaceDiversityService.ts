import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export interface SurfaceDiversityAssessment {
  signature: string;
  repetitionScore: number;
  repeatedOpening: boolean;
  repeatedEnding: boolean;
  exactRecentMatch: boolean;
}

const MAX_HISTORY = 24;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function edge(text: string, fromStart: boolean): string {
  const compact = normalize(text);
  return fromStart ? compact.slice(0, 28) : compact.slice(-28);
}

class ConversationSurfaceDiversityService {
  private readonly recent: string[] = [];

  public assess(surfaceText: string): SurfaceDiversityAssessment {
    const normalized = normalize(surfaceText);
    const opening = edge(normalized, true);
    const ending = edge(normalized, false);
    const exactRecentMatch = this.recent.includes(normalized);
    const repeatedOpening = opening.length >= 8 && this.recent.some(item => edge(item, true) === opening);
    const repeatedEnding = ending.length >= 8 && this.recent.some(item => edge(item, false) === ending);
    const repetitionScore = Math.min(1, (exactRecentMatch ? 0.7 : 0) + (repeatedOpening ? 0.2 : 0) + (repeatedEnding ? 0.1 : 0));
    return { signature: canonicalSha256({ normalized }), repetitionScore, repeatedOpening, repeatedEnding, exactRecentMatch };
  }

  public record(surfaceText: string): void {
    const normalized = normalize(surfaceText);
    if (!normalized) return;
    this.recent.unshift(normalized);
    if (this.recent.length > MAX_HISTORY) this.recent.length = MAX_HISTORY;
  }

  public clear(): void {
    this.recent.length = 0;
  }
}

export const conversationSurfaceDiversityService = new ConversationSurfaceDiversityService();

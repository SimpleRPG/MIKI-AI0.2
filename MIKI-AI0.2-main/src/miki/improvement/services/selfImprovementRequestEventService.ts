export interface SelfImprovementRequestEvent {
  trigger: string;
  requestedAt: number;
  source: 'AUTOPILOT' | 'UI' | 'EXECUTION' | 'SYSTEM';
}

type Handler = (event: SelfImprovementRequestEvent) => void;

class SelfImprovementRequestEventService {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  publish(event: SelfImprovementRequestEvent): void {
    for (const handler of Array.from(this.handlers)) {
      try {
        handler(event);
      } catch (error) {
        console.error('[SelfImprovementRequestEvent] subscriber failed', error);
      }
    }
  }
}

export const selfImprovementRequestEventService = new SelfImprovementRequestEventService();

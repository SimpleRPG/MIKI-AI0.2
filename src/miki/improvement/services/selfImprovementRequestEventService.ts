export interface SelfImprovementRequestEvent {
  trigger: string;
  requestedAt: number;
  source: 'AUTOPILOT' | 'UI' | 'EXECUTION' | 'SYSTEM';
  /** Stable idempotency key for durable outbox retries. */
  requestId?: string;
}

export interface SelfImprovementRequestPublishReceipt {
  eventId: string;
  subscriberCount: number;
  delivered: number;
  failed: number;
}

type Handler = (event: SelfImprovementRequestEvent) => void;

class SelfImprovementRequestEventService {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  subscriberCount(): number {
    return this.handlers.size;
  }

  publish(event: SelfImprovementRequestEvent): SelfImprovementRequestPublishReceipt {
    const handlers = Array.from(this.handlers);
    let delivered = 0;
    let failed = 0;
    for (const handler of handlers) {
      try {
        handler(event);
        delivered += 1;
      } catch (error) {
        failed += 1;
        console.error('[SelfImprovementRequestEvent] subscriber failed', error);
      }
    }
    return {
      eventId: event.requestId || `SIR-${event.source}-${event.requestedAt}`,
      subscriberCount: handlers.length,
      delivered,
      failed,
    };
  }
}

export const selfImprovementRequestEventService = new SelfImprovementRequestEventService();

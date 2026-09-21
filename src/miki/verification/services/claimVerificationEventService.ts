export interface ClaimVerificationEvent {
  claimId: string;
  promoted?: boolean;
  status?: string;
  verifiedAt?: number;
  [key: string]: unknown;
}

export class ClaimVerificationEventService {
  private handlers = new Set<(event: ClaimVerificationEvent) => void>();

  public subscribe(handler: (event: ClaimVerificationEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public publish(event: ClaimVerificationEvent): void {
    for (const handler of [...this.handlers]) {
      try {
        handler(event);
      } catch (error) {
        console.error('[ClaimVerificationEvent] subscriber failed', error);
      }
    }
  }
}

export const claimVerificationEventService = new ClaimVerificationEventService();

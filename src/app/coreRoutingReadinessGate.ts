type ReadinessState = 'PENDING' | 'READY' | 'FAILED';

type ReadinessWaiter = {
  resolve: () => void;
  reject: (reason: Error) => void;
};

export class CoreRoutingReadinessGate {
  private state: ReadinessState = 'PENDING';
  private failure: Error | undefined;
  private readonly waiters = new Set<ReadinessWaiter>();

  getStatus(): ReadinessState {
    return this.state;
  }

  wait(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(this.abortError());
    }
    if (this.state === 'READY') return Promise.resolve();
    if (this.state === 'FAILED') {
      return Promise.reject(this.failure ?? new Error('CORE_ROUTING_BOOTSTRAP_FAILED'));
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let waiter: ReadinessWaiter;

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        this.waiters.delete(waiter);
        waiter.reject(this.abortError());
      };

      waiter = {
        resolve: () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        },
        reject: (reason: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(reason);
        },
      };

      this.waiters.add(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }

  markReady(): void {
    if (this.state !== 'PENDING') return;
    this.state = 'READY';
    this.failure = undefined;
    for (const waiter of this.waiters) waiter.resolve();
    this.waiters.clear();
  }

  markFailed(reason: unknown): void {
    if (this.state !== 'PENDING') return;
    const error = reason instanceof Error
      ? reason
      : new Error(String(reason ?? 'CORE_ROUTING_BOOTSTRAP_FAILED'));
    this.state = 'FAILED';
    this.failure = error;
    for (const waiter of this.waiters) waiter.reject(error);
    this.waiters.clear();
  }

  reset(): void {
    if (this.state === 'PENDING') return;
    this.state = 'PENDING';
    this.failure = undefined;
  }

  private abortError(): Error {
    const error = new Error('CORE_ROUTING_WAIT_CANCELLED');
    error.name = 'AbortError';
    return error;
  }
}

export const AUTONOMOUS_TASK_SCHEDULER_SAMPLE = `export class AutonomousTaskScheduler {
  private queue: Array<{ id: string; runAt: number }> = [];

  public schedule(id: string, delayMs: number): boolean {
    if (!id || typeof id !== 'string') return false;
    if (delayMs < 0) return false;
    this.queue.push({ id, runAt: Date.now() + delayMs });
    return true;
  }

  public flush(): number {
    const now = Date.now();
    const ready = this.queue.filter(q => q.runAt <= now);
    this.queue = this.queue.filter(q => q.runAt > now);
    return ready.length;
  }
}`;

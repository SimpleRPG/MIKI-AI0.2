export interface SystemLogEntry {
  id: string;
  timestamp: string;
  epoch: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  category: 'WEBGPU' | 'INFERENCE' | 'NETWORK' | 'CACHE' | 'PERSISTENCE' | 'SERVER' | 'CHAT';
  message: string;
  details?: any;
}

class SystemLogger {
  private logs: SystemLogEntry[] = [];
  private maxLogs = 500;
  private storageKey = 'miki_system_diagnostics_logs';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          this.logs = JSON.parse(saved);
        }
      } catch {
        this.logs = [];
      }
    }
  }

  public log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    category: 'WEBGPU' | 'INFERENCE' | 'NETWORK' | 'CACHE' | 'PERSISTENCE' | 'SERVER' | 'CHAT',
    message: string,
    details?: any
  ) {
    const entry: SystemLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      epoch: Date.now(),
      level,
      category,
      message,
      details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details, this.getCircularReplacer())) : details) : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.logs.slice(-200)));
      } catch {}

      // Fire and forget server sync to persist in workspace log file
      this.syncToServer(entry).catch(() => {});
    }

    // Keep clean console output
    const formatted = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
    if (level === 'ERROR') {
      console.error(formatted, details || '');
    } else if (level === 'WARN') {
      console.warn(formatted, details || '');
    } else {
      console.log(formatted, details || '');
    }
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  private async syncToServer(entry: SystemLogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {}
  }

  public debug(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('DEBUG', category, message, details);
  }

  public info(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('INFO', category, message, details);
  }

  public warn(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('WARN', category, message, details);
  }

  public error(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('ERROR', category, message, details);
  }

  public getLogs(): SystemLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }

  public exportAsFormattedText(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}${l.details ? '\n  Payload: ' + JSON.stringify(l.details) : ''}`)
      .join('\n');
  }
}

export const systemLogger = new SystemLogger();

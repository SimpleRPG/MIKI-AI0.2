import { storageService } from '../../../services/storageService';

export interface BenchmarkCase {
  id: string;
  capability: string;
  input: string;
  expected: string;
  variants: string[];
  privateEval: boolean;
  createdAt: number;
}

const KEY = 'miki_benchmark_factory_v1';

export class BenchmarkFactoryService {
  private cases: BenchmarkCase[] = [];

  constructor() {
    try {
      const r = storageService.getItem(KEY);
      if (r) this.cases = JSON.parse(r);
    } catch {
      this.cases = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(KEY, JSON.stringify(this.cases.slice(-1000)));
    } catch {}
  }

  public generate(capability: string, input: string, expected: string, variants: string[] = []): BenchmarkCase {
    const c: BenchmarkCase = {
      id: `BENCH-${Date.now()}-${this.cases.length}`,
      capability,
      input,
      expected,
      variants,
      privateEval: true,
      createdAt: Date.now(),
    };
    this.cases.push(c);
    this.save();
    return c;
  }

  public generateBoundary(capability: string, base: string, expected: string): BenchmarkCase {
    return this.generate(capability, base, expected, [
      base + ' 条件を1つ変更',
      base + ' 言い換え',
      base + ' ノイズを追加',
      base + ' 別分野へ転用',
    ]);
  }

  public list(capability?: string): BenchmarkCase[] {
    return this.cases.filter((c) => !capability || c.capability === capability);
  }
}

export const benchmarkFactoryService = new BenchmarkFactoryService();

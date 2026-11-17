import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P943: 端末の計算資源の基盤（第1段）。
 *
 * 能力リスト（2026-11-17）の「端末の計算資源を全部使う」の前提は、
 * 自己点検に「自分の体」の棚卸しを入れること。どのプロセッサが
 * あるか・実測の速さ・自分の部品がどこで動くか。第1段はその
 * 台帳と測定の受け皿。
 *
 * - 棚卸し：ブラウザ／ランタイムから分かる範囲だけを記録する。
 *   分からないものは「不明」と書く。測っていない速さを速いと
 *   決めつけない（deviceBenchmarkService の gflops 固定値の
 *   ような見かけの数字は、ここでは扱わない）。
 * - 実測：CPU で動く3種の代表仕事（記号処理・数値処理・文章処理）
 *   の小さなベンチマークを回し、ops/秒を台帳に残す。
 * - 配置の適性：決定論的な記号処理・照合は CPU、並列数値処理は
 *   GPU、小さな NN は NPU（能力リストの目安）。適性は「向き」
 *   であって、使えることが確認できた先に限る。GPU/NPU が
 *   未測定なら available は false のまま。
 * - 端末からの実測報告（SoC・GPU/NPU の有無・ネイティブ層の
 *   健康）は reportDeviceProbe() で受け取る。NPU にきれいな
 *   列挙 API が無いことは承知の上で、推定と実測の区別をつける。
 *
 * 測定は自己点検では自動で走らせない（点検のたびに重くしない）。
 * 回帰と、将来の「眠って整理する時間」での定期測定が呼ぶ。
 */

const STORAGE_KEY = 'miki_compute_resources_v1';
const MAX_MEASUREMENTS = 10;

export type ComputeWorkloadKind = 'SYMBOLIC' | 'NUMERIC' | 'TEXT';
export type ComputeTarget = 'CPU' | 'GPU' | 'NPU';

export interface ComputeMeasurement {
  kind: ComputeWorkloadKind;
  opsPerSec: number;
  ms: number;
  measuredAt: number;
}

export interface DeviceProbe {
  socModel?: string;
  gpuAvailable?: boolean;
  npuAvailable?: boolean;
  nativeCoreOk?: boolean;
  source?: string;
  measuredAt: number;
}

export interface ComputeInventory {
  cpuCores: number | null;
  deviceMemoryGB: number | null;
  webgpu: 'AVAILABLE' | 'UNKNOWN';
  nativeCore: 'OK' | 'UNKNOWN';
  socModel: string | null;
  gpuAvailable: boolean | null;
  npuAvailable: boolean | null;
}

const APTITUDE: Record<ComputeWorkloadKind | 'SMALL_NN', ComputeTarget> = {
  SYMBOLIC: 'CPU',
  NUMERIC: 'GPU',
  TEXT: 'CPU',
  SMALL_NN: 'NPU',
};

class ComputeResourceService {
  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /** 分かる範囲だけの棚卸し。分からないものは null / UNKNOWN。 */
  public inventory(): ComputeInventory {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : undefined;
    const probe = this.loadProbe();
    return {
      cpuCores: nav?.hardwareConcurrency ?? null,
      deviceMemoryGB: nav?.deviceMemory ?? null,
      webgpu: nav?.gpu ? 'AVAILABLE' : 'UNKNOWN',
      nativeCore: probe?.nativeCoreOk ? 'OK' : 'UNKNOWN',
      socModel: probe?.socModel ?? null,
      gpuAvailable: probe?.gpuAvailable ?? null,
      npuAvailable: probe?.npuAvailable ?? null,
    };
  }

  /** 端末側（Kotlin ネイティブ層など）からの実測報告を受け取る。 */
  public reportDeviceProbe(probe: Omit<DeviceProbe, 'measuredAt'>, now = Date.now()): DeviceProbe {
    const record: DeviceProbe = { ...probe, source: probe.source || 'DEVICE', measuredAt: now };
    try {
      const all = this.loadAll();
      all.probe = record;
      storageService.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* 報告が残せなくても棚卸しは続ける */ }
    systemLogger.info('SYSTEM', `🖥️ [計算資源] 端末報告を受け取った（SoC ${record.socModel || '不明'} / GPU ${record.gpuAvailable ?? '不明'} / NPU ${record.npuAvailable ?? '不明'}）`);
    return record;
  }

  /**
   * CPU で動く3種の代表仕事を小さく測る。決定論で、同じ端末では
   * 同じ規模の仕事を回す。重くしないため各1回だけ。
   */
  public measureCpuWorkloads(now = Date.now()): ComputeMeasurement[] {
    const results: ComputeMeasurement[] = [];
    // 記号処理：決定論的な照合のつもりの Map 参照。
    {
      const table = new Map<string, number>();
      for (let i = 0; i < 2000; i++) table.set(`key:${i}`, i);
      const t0 = this.now();
      let acc = 0;
      for (let i = 0; i < 20000; i++) acc += table.get(`key:${i % 2000}`) || 0;
      const ms = Math.max(0.01, this.now() - t0);
      results.push({ kind: 'SYMBOLIC', opsPerSec: Math.round(20000 / (ms / 1000)), ms: round2(ms), measuredAt: now });
      void acc;
    }
    // 数値処理：型付き配列の並列計算のつもりの算術。
    {
      const data = new Float64Array(100000);
      for (let i = 0; i < data.length; i++) data[i] = i * 0.001;
      const t0 = this.now();
      let acc = 0;
      for (let i = 0; i < data.length; i++) acc += Math.sin(data[i]) * Math.cos(data[i]);
      const ms = Math.max(0.01, this.now() - t0);
      results.push({ kind: 'NUMERIC', opsPerSec: Math.round(100000 / (ms / 1000)), ms: round2(ms), measuredAt: now });
      void acc;
    }
    // 文章処理：語の切り出しと数え上げ。
    {
      const text = '月夜石の産地を調べる 月夜石は夜に光る 月夜石を集める '.repeat(400);
      const t0 = this.now();
      let count = 0;
      const parts = text.split(' ');
      for (const part of parts) if (part.includes('月夜石')) count++;
      const ms = Math.max(0.01, this.now() - t0);
      results.push({ kind: 'TEXT', opsPerSec: Math.round(parts.length / (ms / 1000)), ms: round2(ms), measuredAt: now });
      void count;
    }
    try {
      const all = this.loadAll();
      all.measurements = [...(all.measurements || []), ...results].slice(-MAX_MEASUREMENTS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* 測定が残せなくても結果は返す */ }
    return results;
  }

  /** 仕事の種類ごとの配置の適性と、使えることが確認できたかどうか。 */
  public placementHint(kind: ComputeWorkloadKind | 'SMALL_NN'): { aptitude: ComputeTarget; available: boolean; reason: string } {
    const aptitude = APTITUDE[kind];
    const inv = this.inventory();
    if (aptitude === 'CPU') {
      return { aptitude, available: true, reason: 'CPU はいつも使える。決定論的な記号処理・照合の向き。' };
    }
    if (aptitude === 'GPU') {
      const available = inv.webgpu === 'AVAILABLE' || inv.gpuAvailable === true;
      return {
        aptitude,
        available,
        reason: available ? 'GPU が使える。並列数値処理の向き。' : 'GPU は未測定。実機で WebGPU / GPU の有無と速さを測ってから使う。',
      };
    }
    const available = inv.npuAvailable === true;
    return {
      aptitude,
      available,
      reason: available ? 'NPU が使える。小さな NN の向き。' : 'NPU は未測定。ベンダー経路が断片的なので、SoC からの推定と実測で確認してから使う。',
    };
  }

  /** 棚卸しと最新の測定をまとめる。 */
  public profile(): { inventory: ComputeInventory; latest: Record<string, ComputeMeasurement>; measuredKinds: number } {
    const all = this.loadAll();
    const latest: Record<string, ComputeMeasurement> = {};
    for (const m of all.measurements || []) latest[m.kind] = m;
    return { inventory: this.inventory(), latest, measuredKinds: Object.keys(latest).length };
  }

  /** 棚卸しを言葉にする。 */
  public describe(): string {
    const p = this.profile();
    const inv = p.inventory;
    const core = inv.cpuCores ? `${inv.cpuCores}コア` : 'コア数不明';
    const measured = p.measuredKinds > 0
      ? `CPU の速さを${p.measuredKinds}種の仕事で測った。`
      : 'CPU の速さはまだ測っていない。';
    const gpu = inv.gpuAvailable === true || inv.webgpu === 'AVAILABLE' ? 'GPU あり' : 'GPU は未測定';
    const npu = inv.npuAvailable === true ? 'NPU あり' : inv.npuAvailable === false ? 'NPU なし' : 'NPU は未測定';
    return `体の棚卸し：CPU ${core}、${gpu}、${npu}。${measured}`;
  }

  private loadAll(): { measurements?: ComputeMeasurement[]; probe?: DeviceProbe } {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  private loadProbe(): DeviceProbe | undefined {
    return this.loadAll().probe;
  }

  public summary(): { measuredKinds: number; hasProbe: boolean } {
    const p = this.profile();
    return { measuredKinds: p.measuredKinds, hasProbe: !!this.loadProbe() };
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export const computeResourceService = new ComputeResourceService();

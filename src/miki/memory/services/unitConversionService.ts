/*
 * P491: 単位・換算ルール。
 *
 * 単位の換算は真偽の検証が要らない決定的な知識。「部品として
 * 持つ」が似合う形で、換算表と変換・読み取りの関数を持つ。
 * 消費先: 用語学習（単位の語に換算の gloss を付ける）＋
 * parseAndConvert による文中の数量の読み替え。
 */

interface LinearUnit {
  key: string;
  dimension: string;
  dimensionJa: string;
  toBase: number;
  names: string[]; // 先頭が表示名
}

const LINEAR_UNITS: LinearUnit[] = [
  // 長さ（基準: m）
  { key: 'mm', dimension: 'length', dimensionJa: '長さ', toBase: 0.001, names: ['mm', 'ミリメートル'] },
  { key: 'cm', dimension: 'length', dimensionJa: '長さ', toBase: 0.01, names: ['cm', 'センチメートル'] },
  { key: 'm', dimension: 'length', dimensionJa: '長さ', toBase: 1, names: ['m', 'メートル'] },
  { key: 'km', dimension: 'length', dimensionJa: '長さ', toBase: 1000, names: ['km', 'キロメートル'] },
  { key: 'inch', dimension: 'length', dimensionJa: '長さ', toBase: 0.0254, names: ['インチ', 'inch'] },
  { key: 'foot', dimension: 'length', dimensionJa: '長さ', toBase: 0.3048, names: ['フィート', 'foot', 'feet'] },
  { key: 'yard', dimension: 'length', dimensionJa: '長さ', toBase: 0.9144, names: ['ヤード', 'yard'] },
  { key: 'mile', dimension: 'length', dimensionJa: '長さ', toBase: 1609.344, names: ['マイル', 'mile'] },
  // 重さ（基準: g）
  { key: 'g', dimension: 'mass', dimensionJa: '重さ', toBase: 1, names: ['g', 'グラム'] },
  { key: 'kg', dimension: 'mass', dimensionJa: '重さ', toBase: 1000, names: ['kg', 'キログラム'] },
  { key: 't', dimension: 'mass', dimensionJa: '重さ', toBase: 1_000_000, names: ['t', 'トン', 'ton'] },
  { key: 'oz', dimension: 'mass', dimensionJa: '重さ', toBase: 28.349523125, names: ['オンス', 'oz', 'ounce'] },
  { key: 'lb', dimension: 'mass', dimensionJa: '重さ', toBase: 453.59237, names: ['ポンド', 'lb', 'pound'] },
  // 体積（基準: ml）
  { key: 'ml', dimension: 'volume', dimensionJa: '体積', toBase: 1, names: ['ml', 'ミリリットル'] },
  { key: 'l', dimension: 'volume', dimensionJa: '体積', toBase: 1000, names: ['l', 'リットル', 'liter', 'litre'] },
  { key: 'gallon', dimension: 'volume', dimensionJa: '体積', toBase: 3785.411784, names: ['ガロン', 'gallon'] },
  // 速さ（基準: km/h）
  { key: 'km/h', dimension: 'speed', dimensionJa: '速さ', toBase: 1, names: ['km/h', 'キロメートル毎時'] },
  { key: 'mph', dimension: 'speed', dimensionJa: '速さ', toBase: 1.609344, names: ['mph', 'マイル毎時'] },
  { key: 'm/s', dimension: 'speed', dimensionJa: '速さ', toBase: 3.6, names: ['m/s', 'メートル毎秒'] },
  { key: 'knot', dimension: 'speed', dimensionJa: '速さ', toBase: 1.852, names: ['ノット', 'knot'] },
  // 面積（基準: m2）
  { key: 'm2', dimension: 'area', dimensionJa: '面積', toBase: 1, names: ['m2', '平方メートル', '㎡'] },
  { key: 'km2', dimension: 'area', dimensionJa: '面積', toBase: 1_000_000, names: ['km2', '平方キロメートル', 'k㎡'] },
  { key: 'ha', dimension: 'area', dimensionJa: '面積', toBase: 10_000, names: ['ha', 'ヘクタール', 'hectare'] },
  { key: 'acre', dimension: 'area', dimensionJa: '面積', toBase: 4046.8564224, names: ['エーカー', 'acre'] },
  { key: 'tsubo', dimension: 'area', dimensionJa: '面積', toBase: 3.305785, names: ['坪'] },
  // データ（基準: byte）
  { key: 'byte', dimension: 'data', dimensionJa: 'データ量', toBase: 1, names: ['byte', 'バイト', 'B'] },
  { key: 'KB', dimension: 'data', dimensionJa: 'データ量', toBase: 1000, names: ['KB', 'キロバイト'] },
  { key: 'MB', dimension: 'data', dimensionJa: 'データ量', toBase: 1_000_000, names: ['MB', 'メガバイト'] },
  { key: 'GB', dimension: 'data', dimensionJa: 'データ量', toBase: 1_000_000_000, names: ['GB', 'ギガバイト'] },
  { key: 'TB', dimension: 'data', dimensionJa: 'データ量', toBase: 1_000_000_000_000, names: ['TB', 'テラバイト'] },
  { key: 'KiB', dimension: 'data', dimensionJa: 'データ量', toBase: 1024, names: ['KiB'] },
  { key: 'MiB', dimension: 'data', dimensionJa: 'データ量', toBase: 1_048_576, names: ['MiB'] },
  { key: 'GiB', dimension: 'data', dimensionJa: 'データ量', toBase: 1_073_741_824, names: ['GiB'] },
];

const TEMPERATURE_KEYS = new Set(['celsius', 'fahrenheit', 'kelvin']);
const TEMPERATURE_NAMES = new Map<string, string>([
  ['celsius', 'celsius'], ['摂氏', 'celsius'], ['°c', 'celsius'],
  ['fahrenheit', 'fahrenheit'], ['華氏', 'fahrenheit'], ['°f', 'fahrenheit'],
  ['kelvin', 'kelvin'], ['ケルビン', 'kelvin'], ['k', 'kelvin'],
]);

const nameIndex = new Map<string, LinearUnit>();
for (const unit of LINEAR_UNITS) {
  for (const name of unit.names) nameIndex.set(name.toLowerCase(), unit);
}

// 帝国単位→メートル法の自然な読み替え先（文中の数量用）。
const NATURAL_TARGET: Record<string, string> = {
  mile: 'km', inch: 'cm', foot: 'cm', yard: 'm',
  oz: 'g', lb: 'kg', gallon: 'l', mph: 'km/h', acre: 'ha', fahrenheit: 'celsius',
};

function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const rounded = abs >= 100 ? Math.round(value * 10) / 10 : abs >= 10 ? Math.round(value * 100) / 100 : Math.round(value * 1000) / 1000;
  return String(rounded);
}

function toCelsius(value: number, from: string): number {
  if (from === 'fahrenheit') return (value - 32) * 5 / 9;
  if (from === 'kelvin') return value - 273.15;
  return value;
}

function fromCelsius(value: number, to: string): number {
  if (to === 'fahrenheit') return value * 9 / 5 + 32;
  if (to === 'kelvin') return value + 273.15;
  return value;
}

class UnitConversionService {
  private resolveLinear(nameRaw: string): LinearUnit | undefined {
    return nameIndex.get(String(nameRaw || '').trim().toLowerCase());
  }

  private resolveTemperature(nameRaw: string): string | undefined {
    return TEMPERATURE_NAMES.get(String(nameRaw || '').trim().toLowerCase());
  }

  /** 単位名かどうか（温度を含む）。 */
  public isUnit(termRaw: string): boolean {
    return Boolean(this.resolveLinear(termRaw) || this.resolveTemperature(termRaw));
  }

  /** 換算できれば数値、できなければ null。 */
  public convert(value: number, fromRaw: string, toRaw: string): number | null {
    const fromTemp = this.resolveTemperature(fromRaw);
    const toTemp = this.resolveTemperature(toRaw);
    if (fromTemp || toTemp) {
      if (!fromTemp || !toTemp) return null;
      return fromCelsius(toCelsius(value, fromTemp), toTemp);
    }
    const from = this.resolveLinear(fromRaw);
    const to = this.resolveLinear(toRaw);
    if (!from || !to || from.dimension !== to.dimension) return null;
    return (value * from.toBase) / to.toBase;
  }

  /**
   * 用語学習用の gloss。単位の語に対して、代表的な換算を
   * 意味として返す（例: マイル →「長さの単位。1マイル = 1.609km」）。
   */
  public glossForTerm(termRaw: string): string | undefined {
    const term = String(termRaw || '').trim();
    const temp = this.resolveTemperature(term);
    if (temp === 'celsius') return '温度の単位（摂氏）。華氏への換算は 摂氏×9/5＋32';
    if (temp === 'fahrenheit') return '温度の単位（華氏）。摂氏への換算は (華氏−32)×5/9';
    if (temp === 'kelvin') return '温度の単位（ケルビン）。摂氏 = ケルビン − 273.15';
    const unit = this.resolveLinear(term);
    if (!unit) return undefined;
    const display = unit.names[0];
    // 読みやすい相手で表す: 換算値が 1 に最も近い（対数距離）
    // 単位を選ぶ（マイル→km、インチ→cm、ポンド→kg のように）。
    let best: { unit: LinearUnit; value: number; score: number } | undefined;
    for (const cand of LINEAR_UNITS) {
      if (cand.dimension !== unit.dimension || cand.key === unit.key) continue;
      const value = unit.toBase / cand.toBase;
      if (!(value > 0)) continue;
      const score = Math.abs(Math.log10(value));
      if (!best || score < best.score) best = { unit: cand, value, score };
    }
    if (!best) return `${unit.dimensionJa}の単位`;
    return `${unit.dimensionJa}の単位。1${display} = ${formatNumber(best.value)}${best.unit.names[0]}`;
  }

  /**
   * 文中の「数値＋帝国単位」をメートル法に読み替えた注記を返す。
   * 換算対象がなければ空配列。
   */
  public parseAndConvert(textRaw: string): Array<{ original: string; converted: string }> {
    const text = String(textRaw || '');
    const notes: Array<{ original: string; converted: string }> = [];
    const pattern = /(-?\d+(?:\.\d+)?)\s*(マイル|インチ|フィート|ヤード|オンス|ポンド|ガロン|エーカー|華氏|°F|mile|inch|feet|foot|yard|ounce|oz|pound|lb|gallon|acre|mph)/gi;
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) continue;
      const fromName = match[2];
      const fromKey = this.resolveTemperature(fromName) || this.resolveLinear(fromName)?.key;
      if (!fromKey) continue;
      const targetKey = NATURAL_TARGET[fromKey];
      if (!targetKey) continue;
      const converted = this.convert(value, fromKey, targetKey);
      if (converted === null) continue;
      const targetDisplay = targetKey === 'celsius' ? '°C' : (this.resolveLinear(targetKey)?.names[0] || targetKey);
      notes.push({
        original: `${match[1]}${fromName}`,
        converted: `約${formatNumber(converted)}${targetDisplay}`,
      });
      if (notes.length >= 5) break;
    }
    return notes;
  }
}

export const unitConversionService = new UnitConversionService();

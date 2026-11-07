/*
 * P464: 共通ラスタ描画基盤。
 *
 * 背景: 人物描画の各 renderer（P138〜P180）は、それぞれが整数座標の
 * ハードエッジ描画と PNG エンコーダを抱えており、輪郭がギザギザで
 * 陰影もベタ塗りだった（P138 の生成物で確認）。描画の土台をここに
 * 一本化し、品質を土台側で引き上げる。
 *
 * 品質の要点:
 * - スーパーサンプリング: 内部で ss 倍の解像度で描き、出力時に
 *   ボックスフィルタで縮小する。輪郭が滑らかになる。
 * -  proper な source-over 合成: 透明な背景の上でも半透明の影が
 *   正しく重なる（従来は不透明前提の混色だった）。
 * - softEllipse: 中心から周辺へ滑らかに薄くなる楕円。柔らかい影や
 *   頬の色づきなど、ベタ塗りでは出せない表現に使う。
 *
 * P467: 高速化。従来はピクセルを塗るたびに色コードの解析と関数
 * 呼び出しをしており、イラストサイズでは描画が重かった。色の解釈は
 * 図形ごとに1回だけにし、塗りは横方向の帯（スパン）単位でバッファへ
 * 直接書く。不透明な塗りはブレンド計算自体を省略する。
 * 実測（P138、Node実行環境）: ILLUSTRATION_2D 約334ms → 約84ms、
 * ILLUSTRATION_25D 約508ms → 約173ms。残りの主コストは縮小と
 * PNG エンコード、柔らかい楕円の画素計算。
 *
 * 座標はすべて論理座標（出力サイズ基準）で渡す。ss 倍の変換は
 * このクラスの中だけで行う。
 */

type Rgb = [number, number, number];

const colorCache = new Map<string, Rgb>();

function parseHexColor(hex: string): Rgb {
  const cached = colorCache.get(hex);
  if (cached) return cached;
  const x = hex.replace('#', '');
  const rgb: Rgb = [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
  colorCache.set(hex, rgb);
  return rgb;
}

export class RasterCanvas {
  public readonly pixelWidth: number;
  public readonly pixelHeight: number;
  public readonly rgba: Uint8Array;

  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly supersample = 1,
  ) {
    this.pixelWidth = width * supersample;
    this.pixelHeight = height * supersample;
    this.rgba = new Uint8Array(this.pixelWidth * this.pixelHeight * 4);
  }

  /** 内部座標（ss倍解像度）の1画素へ source-over で書く。 */
  private blendPixel(ix: number, iy: number, rgb: Rgb, sa: number): void {
    if (ix < 0 || iy < 0 || ix >= this.pixelWidth || iy >= this.pixelHeight) return;
    const buf = this.rgba;
    const i = (iy * this.pixelWidth + ix) * 4;
    if (sa >= 0.999) {
      buf[i] = rgb[0];
      buf[i + 1] = rgb[1];
      buf[i + 2] = rgb[2];
      buf[i + 3] = 255;
      return;
    }
    if (sa <= 0) return;
    const da = buf[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    const dstScale = (da * (1 - sa)) / outA;
    const srcScale = sa / outA;
    buf[i] = Math.round(rgb[0] * srcScale + buf[i] * dstScale);
    buf[i + 1] = Math.round(rgb[1] * srcScale + buf[i + 1] * dstScale);
    buf[i + 2] = Math.round(rgb[2] * srcScale + buf[i + 2] * dstScale);
    buf[i + 3] = Math.round(outA * 255);
  }

  /** 内部座標の横帯 [x0, x1] を一括で塗る（塗りの主経路）。 */
  private blendSpan(iy: number, x0: number, x1: number, rgb: Rgb, sa: number): void {
    if (iy < 0 || iy >= this.pixelHeight) return;
    const start = Math.max(0, x0);
    const end = Math.min(this.pixelWidth - 1, x1);
    if (end < start) return;
    const buf = this.rgba;
    const rowBase = iy * this.pixelWidth * 4;
    if (sa >= 0.999) {
      for (let ix = start; ix <= end; ix++) {
        const i = rowBase + ix * 4;
        buf[i] = rgb[0];
        buf[i + 1] = rgb[1];
        buf[i + 2] = rgb[2];
        buf[i + 3] = 255;
      }
      return;
    }
    if (sa <= 0) return;
    for (let ix = start; ix <= end; ix++) {
      const i = rowBase + ix * 4;
      const da = buf[i + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) continue;
      const dstScale = (da * (1 - sa)) / outA;
      const srcScale = sa / outA;
      buf[i] = Math.round(rgb[0] * srcScale + buf[i] * dstScale);
      buf[i + 1] = Math.round(rgb[1] * srcScale + buf[i + 1] * dstScale);
      buf[i + 2] = Math.round(rgb[2] * srcScale + buf[i + 2] * dstScale);
      buf[i + 3] = Math.round(outA * 255);
    }
  }

  /** 論理座標の1点を塗る（小さな部品用。大きな塗りは図形メソッドを使う）。 */
  public px(x: number, y: number, color: string, alpha = 1): void {
    const ss = this.supersample;
    this.blendPixel(Math.floor(x * ss), Math.floor(y * ss), parseHexColor(color), Math.max(0, Math.min(1, alpha)));
  }

  public ellipse(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const rgb = parseHexColor(color);
    const sa = Math.max(0, Math.min(1, alpha));
    const ss = this.supersample;
    const cyPx = cy * ss;
    const ryPx = ry * ss;
    const y0 = Math.max(0, Math.floor(cyPx - ryPx));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil(cyPx + ryPx));
    for (let iy = y0; iy <= y1; iy++) {
      const ly = (iy + 0.5) / ss;
      const t = (ly - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
      const x0 = Math.floor((cx - half) * ss);
      const x1 = Math.ceil((cx + half) * ss);
      this.blendSpan(iy, x0, x1, rgb, sa);
    }
  }

  /** 周辺へ向けて滑らかに薄くなる楕円（柔らかい影・色づき用）。 */
  public softEllipse(cx: number, cy: number, rx: number, ry: number, color: string, maxAlpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const rgb = parseHexColor(color);
    const ss = this.supersample;
    const x0 = Math.max(0, Math.floor((cx - rx) * ss));
    const x1 = Math.min(this.pixelWidth - 1, Math.ceil((cx + rx) * ss));
    const y0 = Math.max(0, Math.floor((cy - ry) * ss));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil((cy + ry) * ss));
    for (let iy = y0; iy <= y1; iy++) {
      const ly = (iy + 0.5) / ss;
      for (let ix = x0; ix <= x1; ix++) {
        const lx = (ix + 0.5) / ss;
        const d2 = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
        if (d2 <= 1) {
          const falloff = (1 - d2) * (1 - d2);
          this.blendPixel(ix, iy, rgb, maxAlpha * falloff);
        }
      }
    }
  }

  public poly(points: number[][], color: string, alpha = 1): void {
    if (points.length < 3) return;
    const rgb = parseHexColor(color);
    const sa = Math.max(0, Math.min(1, alpha));
    const ss = this.supersample;
    const ys = points.map((p) => p[1] * ss);
    const yMin = Math.max(0, Math.floor(Math.min(...ys)));
    const yMax = Math.min(this.pixelHeight - 1, Math.ceil(Math.max(...ys)));
    for (let iy = yMin; iy <= yMax; iy++) {
      const ly = (iy + 0.5) / ss;
      const xs: number[] = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        if ((a[1] > ly) !== (b[1] > ly)) {
          xs.push(a[0] + ((ly - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.blendSpan(iy, Math.ceil(xs[i] * ss), Math.floor(xs[i + 1] * ss), rgb, sa);
      }
    }
  }

  /** 内部解像度で円をスタンプする（線とストロークの共通部品）。 */
  private stampCircle(x: number, y: number, r: number, rgb: Rgb, sa: number): void {
    if (r <= 0) return;
    const ss = this.supersample;
    const cyPx = y * ss;
    const rPx = r * ss;
    const yy0 = Math.max(0, Math.floor(cyPx - rPx));
    const yy1 = Math.min(this.pixelHeight - 1, Math.ceil(cyPx + rPx));
    for (let iy = yy0; iy <= yy1; iy++) {
      const ly = (iy + 0.5) / ss;
      const t = (ly - y) / r;
      if (Math.abs(t) > 1) continue;
      const half = r * Math.sqrt(1 - t * t);
      this.blendSpan(iy, Math.floor((x - half) * ss), Math.ceil((x + half) * ss), rgb, sa);
    }
  }

  public line(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 1, width = 1): void {
    const rgb = parseHexColor(color);
    const sa = Math.max(0, Math.min(1, alpha));
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * this.supersample;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.stampCircle(x, y, width / 2, rgb, sa);
    }
  }

  /** 上下グラデーションの楕円（虹彩や頬の色づきなど、色が流れる面用）。 */
  public gradientEllipse(cx: number, cy: number, rx: number, ry: number, colorTop: string, colorBottom: string, alpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const top = parseHexColor(colorTop);
    const bottom = parseHexColor(colorBottom);
    const sa = Math.max(0, Math.min(1, alpha));
    const ss = this.supersample;
    const cyPx = cy * ss;
    const ryPx = ry * ss;
    const y0 = Math.max(0, Math.floor(cyPx - ryPx));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil(cyPx + ryPx));
    for (let iy = y0; iy <= y1; iy++) {
      const ly = (iy + 0.5) / ss;
      const t = (ly - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
      const mix = Math.max(0, Math.min(1, (t + 1) / 2));
      const rgb: Rgb = [
        Math.round(top[0] + (bottom[0] - top[0]) * mix),
        Math.round(top[1] + (bottom[1] - top[1]) * mix),
        Math.round(top[2] + (bottom[2] - top[2]) * mix),
      ];
      this.blendSpan(iy, Math.floor((cx - half) * ss), Math.ceil((cx + half) * ss), rgb, sa);
    }
  }

  /*
   * P468: ストローク描画（図形ではなく絵として描くための筆）。
   * 軌跡に沿って円形の筆を運び、重なった所は自然に濃くなる。
   * taperIn / taperOut は線の入りと抜け（0〜1、全体長に対する割合）。
   * soft の筆は周辺がぼけるので、陰や空気感のある塗りに使う。
   */
  public strokePath(
    points: number[][],
    options: { color: string; width: number; alpha?: number; taperIn?: number; taperOut?: number; soft?: boolean },
  ): void {
    if (points.length < 2) return;
    const rgb = parseHexColor(options.color);
    const sa = Math.max(0, Math.min(1, options.alpha ?? 1));
    const width = Math.max(0.2, options.width);
    // 累積長
    const cum: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    }
    const total = cum[cum.length - 1];
    if (total <= 0) return;
    const taperInLen = total * Math.max(0, Math.min(0.9, options.taperIn ?? 0));
    const taperOutLen = total * Math.max(0, Math.min(0.9, options.taperOut ?? 0));
    const step = Math.max(0.35, (width / 2) * 0.45);
    const steps = Math.max(2, Math.ceil(total / step));
    let seg = 1;
    for (let i = 0; i <= steps; i++) {
      const d = (total * i) / steps;
      while (seg < cum.length - 1 && cum[seg] < d) seg++;
      const segLen = Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const f = (d - cum[seg - 1]) / segLen;
      const x = points[seg - 1][0] + (points[seg][0] - points[seg - 1][0]) * f;
      const y = points[seg - 1][1] + (points[seg][1] - points[seg - 1][1]) * f;
      let factor = 1;
      if (taperInLen > 0) factor = Math.min(factor, Math.sqrt(Math.min(1, d / taperInLen)));
      if (taperOutLen > 0) factor = Math.min(factor, Math.sqrt(Math.min(1, (total - d) / taperOutLen)));
      const r = Math.max(0.15, (width / 2) * factor);
      if (options.soft) this.softEllipse(x, y, r, r, options.color, sa * 0.5);
      else this.stampCircle(x, y, r, rgb, sa);
    }
  }

  /** 2次/3次ベジェ曲線をストロークで描く（髪の流れやまつ毛の弧など）。 */
  public bezierStroke(
    p0: number[],
    p1: number[],
    p2: number[],
    p3: number[] | null,
    options: { color: string; width: number; alpha?: number; taperIn?: number; taperOut?: number; soft?: boolean },
  ): void {
    const pts: number[][] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      if (p3) {
        pts.push([
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
      } else {
        pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
      }
    }
    this.strokePath(pts, options);
  }

  /** 柔らかい筆で面を塗る（陰・空気・水彩的な重ね塗り）。低透明度で重ねるほど濃くなる。 */
  public paintStroke(
    points: number[][],
    options: { color: string; width: number; alpha?: number; passes?: number },
  ): void {
    const passes = Math.max(1, options.passes ?? 1);
    for (let i = 0; i < passes; i++) {
      this.strokePath(points, { color: options.color, width: options.width, alpha: options.alpha ?? 0.16, soft: true });
    }
  }

  /** 論理サイズへ縮小した RGBA を返す（ss=1 の場合は内部バッファのコピー）。 */
  public toRgba(): Uint8Array {
    const ss = this.supersample;
    if (ss === 1) return new Uint8Array(this.rgba);
    const out = new Uint8Array(this.width * this.height * 4);
    const area = ss * ss;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let dy = 0; dy < ss; dy++) {
          for (let dx = 0; dx < ss; dx++) {
            const si = ((y * ss + dy) * this.pixelWidth + (x * ss + dx)) * 4;
            r += this.rgba[si];
            g += this.rgba[si + 1];
            b += this.rgba[si + 2];
            a += this.rgba[si + 3];
          }
        }
        const oi = (y * this.width + x) * 4;
        out[oi] = Math.round(r / area);
        out[oi + 1] = Math.round(g / area);
        out[oi + 2] = Math.round(b / area);
        out[oi + 3] = Math.round(a / area);
      }
    }
    return out;
  }

  public async toPng(): Promise<Uint8Array> {
    return encodePngRgba(this.toRgba(), this.width, this.height);
  }
}

/** RGBA バッファを PNG（filter 0 / deflate）にエンコードする。 */
export async function encodePngRgba(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 4 + 1);
    raw[o] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), o + 1);
  }
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  await writer.write(raw);
  await writer.close();
  const data = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return concatBytes(signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', data), pngChunk('IEND', new Uint8Array()));
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(concatBytes(typeBytes, data)));
  return out;
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, x) => n + x.length, 0));
  let offset = 0;
  for (const array of arrays) {
    out.set(array, offset);
    offset += array.length;
  }
  return out;
}

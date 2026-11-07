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
 * 座標はすべて論理座標（出力サイズ基準）で渡す。ss 倍の変換は
 * このクラスの中だけで行う。
 */

function parseHexColor(hex: string): [number, number, number] {
  const x = hex.replace('#', '');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
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

  /** 論理座標の1点（内部では ss 倍解像度の画素）を source-over で塗る。 */
  public px(x: number, y: number, color: string, alpha = 1): void {
    const ss = this.supersample;
    const ix = Math.floor(x * ss);
    const iy = Math.floor(y * ss);
    if (ix < 0 || iy < 0 || ix >= this.pixelWidth || iy >= this.pixelHeight) return;
    const [r, g, b] = parseHexColor(color);
    const sa = Math.max(0, Math.min(1, alpha));
    const i = (iy * this.pixelWidth + ix) * 4;
    const da = this.rgba[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.rgba[i] = Math.round((r * sa + this.rgba[i] * da * (1 - sa)) / outA);
    this.rgba[i + 1] = Math.round((g * sa + this.rgba[i + 1] * da * (1 - sa)) / outA);
    this.rgba[i + 2] = Math.round((b * sa + this.rgba[i + 2] * da * (1 - sa)) / outA);
    this.rgba[i + 3] = Math.round(outA * 255);
  }

  public ellipse(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const ss = this.supersample;
    const x0 = Math.floor((cx - rx) * ss);
    const x1 = Math.ceil((cx + rx) * ss);
    const y0 = Math.floor((cy - ry) * ss);
    const y1 = Math.ceil((cy + ry) * ss);
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const lx = (ix + 0.5) / ss;
        const ly = (iy + 0.5) / ss;
        if (((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1) {
          this.px(lx, ly, color, alpha);
        }
      }
    }
  }

  /** 周辺へ向けて滑らかに薄くなる楕円（柔らかい影・色づき用）。 */
  public softEllipse(cx: number, cy: number, rx: number, ry: number, color: string, maxAlpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const ss = this.supersample;
    const x0 = Math.floor((cx - rx) * ss);
    const x1 = Math.ceil((cx + rx) * ss);
    const y0 = Math.floor((cy - ry) * ss);
    const y1 = Math.ceil((cy + ry) * ss);
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const lx = (ix + 0.5) / ss;
        const ly = (iy + 0.5) / ss;
        const d2 = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
        if (d2 <= 1) {
          const falloff = (1 - d2) * (1 - d2);
          this.px(lx, ly, color, maxAlpha * falloff);
        }
      }
    }
  }

  public poly(points: number[][], color: string, alpha = 1): void {
    if (points.length < 3) return;
    const ss = this.supersample;
    const ys = points.map((p) => p[1] * ss);
    const yMin = Math.floor(Math.min(...ys));
    const yMax = Math.ceil(Math.max(...ys));
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
        const xStart = Math.ceil(xs[i] * ss);
        const xEnd = Math.floor(xs[i + 1] * ss);
        for (let ix = xStart; ix <= xEnd; ix++) {
          this.px((ix + 0.5) / ss, ly, color, alpha);
        }
      }
    }
  }

  public line(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 1, width = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * this.supersample;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.ellipse(x, y, width / 2, width / 2, color, alpha);
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

import * as THREE from 'three';
import { toRgb } from './math';

export function cnv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export const fr = (x: CanvasRenderingContext2D, c: string, X: number, Y: number, w = 1, h = 1): void => {
  x.fillStyle = c;
  x.fillRect(X, Y, w, h);
};

export function line(
  x: CanvasRenderingContext2D,
  c: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w = 1
): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let k = 0; k <= n; k++) {
    fr(x, c, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), w, w);
  }
}

export function ctex(c: HTMLCanvasElement, { rep = true, mip = true }: { rep?: boolean; mip?: boolean } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  t.generateMipmaps = mip;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Hard-alpha threshold + 1px dark outline for crisp HD-2D pixel-art sprites.
 */
export function pixelize(x: CanvasRenderingContext2D, w: number, h: number, ol = '#1a1220'): void {
  const d = x.getImageData(0, 0, w, h);
  const a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
  const out = new Uint8ClampedArray(a);
  const [r, g, b] = toRgb(ol);
  const on = (X: number, Y: number): number => (X >= 0 && Y >= 0 && X < w && Y < h ? a[(Y * w + X) * 4 + 3] : 0);
  for (let Y = 0; Y < h; Y++) {
    for (let X = 0; X < w; X++) {
      const i = (Y * w + X) * 4;
      if (a[i + 3]) continue;
      if (on(X - 1, Y) || on(X + 1, Y) || on(X, Y - 1) || on(X, Y + 1)) {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = 255;
      }
    }
  }
  x.putImageData(new ImageData(out, w, h), 0, 0);
}

export function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
    uv.push(...(g.attributes.uv.array as Float32Array));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

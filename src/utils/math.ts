import * as THREE from 'three';

export const V3 = THREE.Vector3;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeIO = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic world generation PRNG; switched to Math.random once generation finishes.
export let rand: () => number = mulberry32(20261019);

export function resetWorldSeed(seed = 20261019): void {
  rand = mulberry32(seed);
}

export function enableRuntimeRandom(): void {
  rand = Math.random;
}

export const R = (a = 0, b = 1): number => a + (b - a) * rand();
export const RI = (a: number, b: number): number => Math.floor(R(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

export const toRgb = (h: string): [number, number, number] => {
  if (h[0] === '#') {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const nums = (h.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
};

export const shade = (h: string, f: number): string => {
  const c = toRgb(h).map((v) => clamp(Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

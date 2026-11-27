import * as THREE from 'three';
import { clamp, pick, V3 } from '../utils/math';

export const TOWN_SIZE = 44;
export const N = 72;
export const ORIGIN = TOWN_SIZE / 2;
export const TH = 1.2;
export const WATER_Y = 0.85;
export const BASE_Y = -1.8;

export const wx = (i: number): number => i - ORIGIN + 0.5;
export const wz = (j: number): number => j - ORIGIN + 0.5;
export const ti = (x: number): number => Math.floor(x + ORIGIN);
export const tj = (z: number): number => Math.floor(z + ORIGIN);
export const idx = (i: number, j: number): number => j * N + i;
export const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < N && j < N;

export const T = {
  GRASS: 0,
  COBBLE: 1,
  FIELD: 2,
  RIVER: 3,
  BRIDGE: 4,
  DIRT: 5,
} as const;

export type TileCoord = [number, number];
export interface StairInfo {
  dx: number;
  dz: number;
  low: number;
}

export type FaceDir = 'S' | 'N' | 'E' | 'W';
export const FACE: Record<FaceDir, { r: number; d: TileCoord }> = {
  S: { r: 0, d: [0, 1] },
  N: { r: Math.PI, d: [0, -1] },
  E: { r: Math.PI / 2, d: [1, 0] },
  W: { r: -Math.PI / 2, d: [-1, 0] },
};

export const HOUSES: Array<[number, number, FaceDir]> = [
  [15, 20, 'S'],
  [19, 19, 'S'],
  [23, 18, 'S'],
  [15, 29, 'N'],
  [30, 27, 'W'],
  [23, 32, 'N'],
  [29, 32, 'W'],
  [32, 24, 'W'],
  [2, 19, 'E'],
];

export const lake = { i: 59, j: 53, rx: 9, rz: 7 };
export const clearing = { i: 39, j: 57 };
export const riverC = (j: number): number => Math.round(8 + 2 * Math.sin(j * 0.2));
export const PC: TileCoord = [23, 25];
export const PCW = new V3(wx(23), TH, wz(25));

export const NB: TileCoord[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export class WorldGrid {
  public readonly H = new Int8Array(N * N);
  public readonly TYPE = new Uint8Array(N * N);
  public readonly BLOCK = new Uint8Array(N * N);
  public readonly stairs = new Map<number, StairInfo>();
  public readonly reach = new Uint8Array(N * N);
  public readonly reachList: TileCoord[] = [];
  public gridOverlay: THREE.LineSegments | null = null;

  constructor() {
    this.initTerrainGrid();
  }

  public isWater = (k: number): boolean => this.TYPE[k] === T.RIVER || this.TYPE[k] === T.BRIDGE;

  public flatten(i0: number, j0: number, i1: number, j1: number, lv = 1): void {
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (inGrid(i, j) && !this.isWater(idx(i, j))) {
          this.H[idx(i, j)] = lv;
        }
      }
    }
  }

  public block = (i: number, j: number): void => {
    if (inGrid(i, j)) this.BLOCK[idx(i, j)] = 1;
  };

  private initTerrainGrid(): void {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let h = 1;
        const a = Math.atan2(j - 10, i - 31);
        if (Math.hypot(i - 31, j - 10) < 8.3 + 0.6 * Math.sin(3 * a) + 0.4 * Math.sin(5 * a + 1)) h = 2;
        const ridge = 3.5 + Math.sin(i * 0.5) * 0.9 + Math.sin(i * 0.23 + 1) * 0.6;
        if (j < ridge) h = 2;
        if (j < ridge - 2.2) h = 3;
        if (Math.abs(i - 33) <= 3 && Math.abs(j - 10) <= 3 && !(Math.abs(i - 33) === 3 && Math.abs(j - 10) === 3)) h = 3;
        if (i < TOWN_SIZE && j < TOWN_SIZE && i + j * 0.6 > 62 + Math.sin(j * 0.7)) h = Math.max(h, 2);
        const k = idx(i, j);
        this.H[k] = h;
        const lx = (i - lake.i) / lake.rx;
        const lz = (j - lake.j) / lake.rz;
        const shore = 1 + 0.08 * Math.sin(3 * Math.atan2(lz, lx));
        if (Math.abs(i - riverC(j)) <= 1 || Math.hypot(lx, lz) < shore) {
          this.H[k] = 0;
          this.TYPE[k] = T.RIVER;
        }
      }
    }

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (Math.hypot(i - PC[0], j - PC[1]) < 4.6) {
          this.H[idx(i, j)] = 1;
          this.TYPE[idx(i, j)] = T.COBBLE;
        }
      }
    }

    for (const [i, j] of HOUSES) this.flatten(i - 1, j - 1, i + 1, j + 1);
    this.flatten(18, 29, 20, 31);
    this.flatten(12, 7, 15, 9);
    this.flatten(18, 10, 22, 14);

    this.carve([[0, 24], [20, 24]]);
    this.carve([[0, 25], [20, 25]]);
    this.carve([[27, 24], [27, 10], [31, 10]]);
    this.carve([[27, 12], [22, 12]]);
    this.carve([[27, 24], [30, 24]]);
    this.carve([[15, 8], [17, 8], [17, 23]], 'dirt');
    this.carve([[4, 23], [4, 19]], 'dirt');
    this.carve([[15, 23], [15, 22]], 'dirt');
    this.carve([[15, 26], [15, 27]], 'dirt');
    this.carve([[19, 23], [19, 21]], 'dirt');
    this.carve([[25, 30], [25, 32], [27, 32]], 'dirt');
    this.carve([[20, 28], [19, 28]], 'dirt');

    for (let j = 27; j <= 40; j++) {
      for (let i = 0; i <= riverC(j) - 3; i++) {
        if (this.TYPE[idx(i, j)] === T.GRASS) this.TYPE[idx(i, j)] = T.FIELD;
      }
    }
    for (let j = 34; j <= 39; j++) {
      for (let i = 32; i <= 37; i++) {
        if (this.TYPE[idx(i, j)] === T.GRASS && this.H[idx(i, j)] === 1) this.TYPE[idx(i, j)] = T.FIELD;
      }
    }

    this.carve([[25, 32], [25, 49], [49, 49], [49, 62], [60, 62], [60, 61]], 'dirt');
    this.carve([[39, 49], [39, 56]], 'dirt');
  }

  public carve(pts: TileCoord[], kind: 'cobble' | 'dirt' = 'cobble'): void {
    const tiles: TileCoord[] = [];
    for (let s = 0; s < pts.length - 1; s++) {
      let [i, j] = pts[s];
      const [i2, j2] = pts[s + 1];
      const dx = Math.sign(i2 - i);
      const dz = Math.sign(j2 - j);
      if (s === 0) tiles.push([i, j]);
      while (i !== i2 || j !== j2) {
        i += dx;
        j += dz;
        tiles.push([i, j]);
      }
    }
    let level = this.H[idx(...tiles[0])];
    tiles.forEach(([i, j], n) => {
      const k = idx(i, j);
      if (this.isWater(k)) {
        this.TYPE[k] = T.BRIDGE;
        return;
      }
      if (n > 0 && !this.stairs.has(k)) {
        const [pi, pj] = tiles[n - 1];
        const dx = i - pi;
        const dz = j - pj;
        if (this.H[k] === level + 1) {
          this.stairs.set(k, { dx, dz, low: level });
          this.H[k] = level;
          level++;
        } else if (this.H[k] === level - 1) {
          this.stairs.set(k, { dx: -dx, dz: -dz, low: level - 1 });
          level--;
        } else {
          level = this.H[k];
        }
      }
      if (kind === 'cobble') this.TYPE[k] = T.COBBLE;
      else if (this.TYPE[k] === T.GRASS || this.TYPE[k] === T.FIELD) this.TYPE[k] = T.DIRT;
    });
  }

  public groundY(x: number, z: number): number {
    const i = ti(x);
    const j = tj(z);
    if (!inGrid(i, j)) return 0;
    const k = idx(i, j);
    const s = this.stairs.get(k);
    if (s) {
      const fx = x - (wx(i) - 0.5);
      const fz = z - (wz(j) - 0.5);
      const t = s.dx ? (s.dx > 0 ? fx : 1 - fx) : s.dz > 0 ? fz : 1 - fz;
      return (s.low + clamp(t, 0, 1)) * TH;
    }
    if (this.TYPE[k] === T.BRIDGE) return TH + 0.1;
    if (this.TYPE[k] === T.RIVER) return WATER_Y;
    return this.H[k] * TH;
  }

  public walkable = (i: number, j: number): boolean =>
    inGrid(i, j) && !this.BLOCK[idx(i, j)] && this.TYPE[idx(i, j)] !== T.RIVER;

  public baseLv = (k: number): number => (this.TYPE[k] === T.BRIDGE ? 1 : this.H[k]);

  public exitLv(k: number, dx: number, dz: number): number {
    const s = this.stairs.get(k);
    if (!s) return this.baseLv(k);
    if (dx === s.dx && dz === s.dz) return s.low + 1;
    if (dx === -s.dx && dz === -s.dz) return s.low;
    return -9;
  }

  public entryLv(k: number, dx: number, dz: number): number {
    const s = this.stairs.get(k);
    if (!s) return this.baseLv(k);
    if (dx === s.dx && dz === s.dz) return s.low;
    if (dx === -s.dx && dz === -s.dz) return s.low + 1;
    return -99;
  }

  public canStep(i: number, j: number, dx: number, dz: number): boolean {
    if (!this.walkable(i + dx, j + dz)) return false;
    const a = idx(i, j);
    const b = idx(i + dx, j + dz);
    if (dx && dz) {
      if (this.stairs.has(a) || this.stairs.has(b) || !this.canStep(i, j, dx, 0) || !this.canStep(i, j, 0, dz)) {
        return false;
      }
    }
    const e = this.exitLv(a, dx, dz);
    return e >= 0 && e === this.entryLv(b, dx, dz);
  }

  public findPath(si: number, sj: number, gi: number, gj: number, neighbors: TileCoord[] = NB): TileCoord[] | null {
    if (!this.walkable(gi, gj)) return null;
    const S = idx(si, sj);
    const G = idx(gi, gj);
    if (S === G) return [];
    const g = new Float32Array(N * N).fill(1e9);
    const from = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    const heap: Array<[number, number]> = [];
    const push = (f: number, k: number) => {
      heap.push([f, k]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi);
      const dz = Math.abs(j - gj);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[S] = 0;
    push(h(si, sj), S);
    while (heap.length) {
      const k = pop()[1];
      if (k === G) break;
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % N;
      const j = (k / N) | 0;
      for (const [dx, dz] of neighbors) {
        if (!this.canStep(i, j, dx, dz)) continue;
        const nk = idx(i + dx, j + dz);
        if (closed[nk]) continue;
        const ng = g[k] + (dx && dz ? 1.414 : 1);
        if (ng < g[nk]) {
          g[nk] = ng;
          from[nk] = k;
          push(ng + h(i + dx, j + dz), nk);
        }
      }
    }
    if (from[G] < 0) return null;
    const path: TileCoord[] = [];
    for (let k = G; k !== S; k = from[k]) path.push([k % N, (k / N) | 0]);
    return path.reverse();
  }

  public computeReachability(): void {
    this.reach.fill(0);
    this.reachList.length = 0;
    const start: TileCoord = [PC[0] - 1, PC[1]];
    const q: TileCoord[] = [start];
    this.reach[idx(...start)] = 1;
    while (q.length) {
      const [i, j] = q.shift()!;
      this.reachList.push([i, j]);
      for (const [dx, dz] of NB) {
        if (this.canStep(i, j, dx, dz) && !this.reach[idx(i + dx, j + dz)]) {
          this.reach[idx(i + dx, j + dz)] = 1;
          q.push([i + dx, j + dz]);
        }
      }
    }
  }

  public randomReach = (maxD = 9, c: TileCoord = PC): TileCoord => {
    for (let n = 0; n < 40; n++) {
      const t = pick(this.reachList);
      if (Math.hypot(t[0] - c[0], t[1] - c[1]) <= maxD) return t;
    }
    return pick(this.reachList);
  };

  public buildGridGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (!this.walkable(i, j)) continue;
        const corners = [
          [-0.49, -0.49],
          [0.49, -0.49],
          [0.49, 0.49],
          [-0.49, 0.49],
        ].map(([dx, dz]) => {
          const x = wx(i) + dx;
          const z = wz(j) + dz;
          return [x, this.groundY(x, z) + 0.035, z];
        });
        for (let edge = 0; edge < corners.length; edge++) {
          positions.push(...corners[edge], ...corners[(edge + 1) % corners.length]);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }

  public createGridOverlay(scene: THREE.Scene): THREE.LineSegments {
    this.gridOverlay = new THREE.LineSegments(
      this.buildGridGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffe1a3,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    scene.add(this.gridOverlay);
    return this.gridOverlay;
  }

  public refreshGrid(): void {
    if (!this.gridOverlay) return;
    this.gridOverlay.geometry.dispose();
    this.gridOverlay.geometry = this.buildGridGeometry();
  }
}

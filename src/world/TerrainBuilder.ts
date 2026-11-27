import * as THREE from 'three';
import { shadowed, type SharedMaterials } from './Textures';
import { BASE_Y, idx, inGrid, N, TH, WATER_Y, WorldGrid, wx, wz } from './WorldGrid';

export function buildTerrain(scene: THREE.Scene, grid: WorldGrid, MAT: SharedMaterials): THREE.Mesh[] {
  const mapSurfaces: THREE.Mesh[] = [];
  const G: Record<string, { p: number[]; u: number[] }> = {};
  const add = (key: string, p: number[], u: number[]) => {
    const g = G[key] || (G[key] = { p: [], u: [] });
    g.p.push(...p);
    g.u.push(...u);
  };
  const topY = (k: number): number => {
    const s = grid.stairs.get(k);
    if (s) return s.low * TH;
    return grid.isWater(k) ? 0 : grid.H[k] * TH;
  };
  const wall = (ax: number, az: number, bx: number, bz: number, yb: number, yt: number) => {
    const ua = (ax + az) / 2;
    const ub = (bx + bz) / 2;
    const seg = (key: string, y0: number, y1: number, vs: number) =>
      add(
        key,
        [ax, y1, az, ax, y0, az, bx, y0, bz, ax, y1, az, bx, y0, bz, bx, y1, bz],
        [ua, y1 / vs, ua, y0 / vs, ub, y0 / vs, ua, y1 / vs, ub, y0 / vs, ub, y1 / vs]
      );
    if (yt > 0) seg('cliff', Math.max(0, yb), yt, TH);
    if (yb < 0) seg('soil', yb, Math.min(0, yt), 2);
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j);
      const y = topY(k);
      const x0 = wx(i) - 0.5;
      const x1 = x0 + 1;
      const z0 = wz(j) - 0.5;
      const z1 = z0 + 1;
      if (!grid.stairs.has(k)) {
        const key = grid.isWater(k) ? 'bed' : ['grass', 'cobble', 'field', 'bed', 'bed', 'dirt'][grid.TYPE[k]];
        add(
          key,
          [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0],
          [x0 / 2, -z0 / 2, x0 / 2, -z1 / 2, x1 / 2, -z1 / 2, x0 / 2, -z0 / 2, x1 / 2, -z1 / 2, x1 / 2, -z0 / 2]
        );
      }
      if (grid.isWater(k)) {
        const w = WATER_Y;
        add(
          'water',
          [x0, w, z0, x0, w, z1, x1, w, z1, x0, w, z0, x1, w, z1, x1, w, z0],
          [x0 / 2, -z0 / 2, x0 / 2, -z1 / 2, x1 / 2, -z1 / 2, x0 / 2, -z0 / 2, x1 / 2, -z1 / 2, x1 / 2, -z0 / 2]
        );
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = i + dx;
        const nj = j + dz;
        const out = !inGrid(ni, nj);
        const yn = out ? BASE_Y : topY(idx(ni, nj));
        if (yn >= y) continue;
        let e: [number, number, number, number];
        if (dx === 1) e = [x1, z1, x1, z0];
        else if (dx === -1) e = [x0, z0, x0, z1];
        else if (dz === 1) e = [x0, z1, x1, z1];
        else e = [x1, z0, x0, z0];
        wall(...e, yn, y);
        if (out && grid.isWater(k)) {
          const o = 0.03;
          const [ax, az, bx, bz] = [e[0] + dx * o, e[1] + dz * o, e[2] + dx * o, e[3] + dz * o];
          const ua = (ax + az) / 2;
          const ub = (bx + bz) / 2;
          const y1 = WATER_Y;
          const y0 = BASE_Y + 0.1;
          add(
            'falls',
            [ax, y1, az, ax, y0, az, bx, y0, bz, ax, y1, az, bx, y0, bz, bx, y1, bz],
            [ua, y1 / TH, ua, y0 / TH, ub, y0 / TH, ua, y1 / TH, ub, y0 / TH, ub, y1 / TH]
          );
        }
      }
    }
  }

  for (const key in G) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(G[key].p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(G[key].u, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT[key]);
    if (key === 'water' || key === 'falls') m.renderOrder = 2;
    else shadowed(m, key === 'cliff' || key === 'grass');
    scene.add(m);
    if (!['falls', 'cliff', 'soil'].includes(key)) mapSurfaces.push(m);
  }

  for (const [k, s] of grid.stairs) {
    const i = k % N;
    const j = (k / N) | 0;
    for (let q = 0; q < 4; q++) {
      const top = (s.low + (q + 1) / 4) * TH;
      const bot = s.low * TH - 0.02;
      const along = (q + 0.5) / 4 - 0.5;
      const geo = new THREE.BoxGeometry(s.dx ? 0.25 : 1, top - bot, s.dz ? 0.25 : 1);
      const m = shadowed(new THREE.Mesh(geo, MAT.stone));
      m.position.set(wx(i) + s.dx * along, (top + bot) / 2, wz(j) + s.dz * along);
      scene.add(m);
      mapSurfaces.push(m);
    }
  }

  return mapSurfaces;
}

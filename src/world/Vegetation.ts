import * as THREE from 'three';
import { R, rand, RI, V3 } from '../utils/math';
import { mergeGeos } from '../utils/canvas';
import { shadowed, type SharedMaterials } from './Textures';
import { clearing, idx, N, PC, riverC, T, TOWN_SIZE, WorldGrid, wx, wz } from './WorldGrid';

export interface TreeData {
  i: number;
  j: number;
  hits: number;
  chopped: boolean;
  x: number;
  z: number;
  s: number;
  transform: THREE.Matrix4;
}

export interface WorldVegetation {
  trees: TreeData[];
  treeMeshes: THREE.InstancedMesh[];
  setTreeHitVisual: (instance: number, hits: number) => void;
}

export function buildVegetation(
  scene: THREE.Scene,
  grid: WorldGrid,
  nearDoor: (i: number, j: number) => boolean,
  MAT: SharedMaterials
): WorldVegetation {
  const trees: TreeData[] = [];
  const treeMeshes: THREE.InstancedMesh[] = [];

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j);
      if (grid.TYPE[k] !== T.GRASS || grid.BLOCK[k] || grid.stairs.has(k) || nearDoor(i, j)) continue;
      const dp = Math.hypot(i - PC[0], j - PC[1]);
      let p = dp < 10 ? 0 : dp < 13 ? 0.05 : 0.12;
      if (grid.H[k] >= 2) p = Math.max(p, j < 8 ? 0.55 : 0.2);
      if (i < 2 || j < 2 || i > N - 3 || j > N - 3) p = Math.max(p, 0.5);
      if (i < riverC(j) - 1 && j < 22) p = Math.max(p, 0.42);
      if (i > 38 && j > 28) p = Math.max(p, 0.45);
      if (
        (Math.abs(i - 33) <= 4 && Math.abs(j - 10) <= 4) ||
        (i >= 10 && i <= 17 && j >= 5 && j <= 11) ||
        (Math.abs(i - 27) <= 1 && j >= 8 && j <= 25)
      ) {
        p = 0;
      }
      if (i >= TOWN_SIZE || j >= TOWN_SIZE) {
        const grove = Math.hypot((i - 38) / 17, (j - 58) / 12);
        p = grove < 1 ? 0.48 : 0.09;
        if (Math.hypot(i - clearing.i, j - clearing.j) < 5) p = 0;
      }
      if (rand() < p) {
        trees.push({
          i,
          j,
          hits: 0,
          chopped: false,
          x: wx(i) + R(-0.22, 0.22),
          z: wz(j) + R(-0.22, 0.22),
          s: R(0.75, 1.3),
          transform: new THREE.Matrix4(),
        });
        grid.BLOCK[k] = 1;
      }
    }
  }

  const trunk = new THREE.CylinderGeometry(0.11, 0.17, 0.7, 6);
  trunk.translate(0, 0.35, 0);
  const cones = [
    [0.95, 1.1, 0.95],
    [0.72, 0.95, 1.55],
    [0.46, 0.8, 2.1],
  ].map(([r, h, y]) => {
    const c = new THREE.ConeGeometry(r, h, 7);
    c.translate(0, y, 0);
    return c;
  });
  const fol = mergeGeos(cones);
  const it = shadowed(new THREE.InstancedMesh(trunk, MAT.trunk, trees.length));
  const ifo = shadowed(new THREE.InstancedMesh(fol, MAT.needles, trees.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();

  trees.forEach((t, n) => {
    q.setFromAxisAngle(new V3(0, 1, 0), R(0, 6.28));
    m.compose(new V3(t.x, grid.groundY(t.x, t.z), t.z), q, new V3(t.s, t.s * R(0.9, 1.15), t.s));
    t.transform = m.clone();
    it.setMatrixAt(n, m);
    ifo.setMatrixAt(n, m);
    ifo.setColorAt(n, c.setHSL(R(0.2, 0.4), R(0.1, 0.35), R(0.72, 0.95)));
  });
  treeMeshes.push(it, ifo);
  scene.add(it, ifo);

  const cross = mergeGeos(
    [0, Math.PI / 2].map((r) => {
      const p = new THREE.PlaneGeometry(0.55, 0.55);
      p.translate(0, 0.27, 0);
      p.rotateY(r);
      return p;
    })
  );
  const tufts: Array<[number, number]> = [];
  const wheat: Array<[number, number]> = [];
  const rocks: Array<[number, number]> = [];

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j);
      if (grid.BLOCK[k] || grid.stairs.has(k)) continue;
      if (grid.TYPE[k] === T.GRASS) {
        for (let n = 0; n < 2; n++) if (rand() < 0.3) tufts.push([wx(i) + R(-0.45, 0.45), wz(j) + R(-0.45, 0.45)]);
      }
      if (grid.TYPE[k] === T.FIELD) {
        for (let n = 0; n < 4; n++) wheat.push([wx(i) + R(-0.45, 0.45), wz(j) + R(-0.45, 0.45)]);
      }
      if (grid.TYPE[k] === T.GRASS && rand() < 0.05) rocks.push([wx(i) + R(-0.3, 0.3), wz(j) + R(-0.3, 0.3)]);
    }
  }

  const inst = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    list: Array<[number, number]>,
    sc: [number, number],
    cast: boolean
  ) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.receiveShadow = true;
    im.castShadow = cast;
    list.forEach(([x, z], n) => {
      q.setFromAxisAngle(new V3(0, 1, 0), R(0, 6.28));
      const s = R(sc[0], sc[1]);
      m.compose(new V3(x, grid.groundY(x, z), z), q, new V3(s, s, s));
      im.setMatrixAt(n, m);
    });
    scene.add(im);
  };

  inst(cross, MAT.tuft, tufts, [0.8, 1.3], false);
  inst(cross, MAT.wheat, wheat, [1.1, 1.5], false);
  inst(new THREE.DodecahedronGeometry(0.25), MAT.rock, rocks, [0.6, 1.4], true);

  for (let n = 0; n < 5; n++) {
    const x = wx(RI(0, 2)) + R(-0.3, 0.3);
    const z = wz(RI(29, 38));
    const b = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.7, 10), MAT.hay));
    b.rotation.z = Math.PI / 2;
    b.rotation.y = R(0, 3);
    b.position.set(x, grid.groundY(x, z) + 0.38, z);
    scene.add(b);
  }

  const setTreeHitVisual = (instance: number, hits: number): void => {
    const tree = trees[instance];
    if (!tree) return;
    tree.hits = hits;
    const felled = hits >= 3;
    tree.chopped = felled;
    const transform = felled
      ? new THREE.Matrix4().makeScale(0, 0, 0).setPosition(tree.x, grid.groundY(tree.x, tree.z), tree.z)
      : tree.transform.clone().multiply(new THREE.Matrix4().makeRotationZ(-0.09 * hits));
    for (const mesh of treeMeshes) {
      mesh.setMatrixAt(instance, transform);
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (felled) {
      grid.BLOCK[idx(tree.i, tree.j)] = 0;
      grid.refreshGrid();
    }
  };

  return { trees, treeMeshes, setTreeHitVisual };
}

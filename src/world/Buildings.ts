import * as THREE from 'three';
import { pick, R, V3 } from '../utils/math';
import {
  gableTex,
  mosqueWall,
  shadowed,
  stoneWall,
  timberWall,
  type GableTextureSet,
  type ProceduralTextures,
  type SharedMaterials,
  type WallTextureSet,
} from './Textures';
import {
  FACE,
  HOUSES,
  idx,
  N,
  PC,
  PCW,
  riverC,
  T,
  TH,
  WATER_Y,
  WorldGrid,
  wx,
  wz,
  type FaceDir,
  type TileCoord,
} from './WorldGrid';

export interface GlowEntry {
  s: THREE.Sprite;
  base: number;
  phase: number;
  kind: 'lamp' | 'win' | 'forge' | 'fest';
}

export interface WindowMatEntry {
  m: THREE.MeshLambertMaterial;
  phase: number;
}

export interface HouseRecord {
  door: TileCoord;
  i: number;
  j: number;
  g: THREE.Group;
}

export interface StallRecord {
  spot: TileCoord;
  front: TileCoord;
}

export interface WorldBuildings {
  houses: HouseRecord[];
  chapel: { door: TileCoord; g: THREE.Group };
  mosque: { door: TileCoord; g: THREE.Group };
  mill: { wheel: THREE.Group; door: TileCoord; splash: THREE.Vector3 };
  forge: { anvil: THREE.Vector3; light: THREE.PointLight; spot: TileCoord };
  stalls: StallRecord[];
  firePit: THREE.Vector3;
  lamps: Array<{ top: THREE.Vector3; lp: THREE.Vector3 }>;
  coneMat: THREE.ShaderMaterial;
  festGroup: THREE.Group;
  windowMats: WindowMatEntry[];
  glows: GlowEntry[];
  lightSources: THREE.Vector3[];
  chimneys: THREE.Vector3[];
  houseLights: THREE.PointLight[];
  doorTiles: TileCoord[];
  nearDoor: (i: number, j: number) => boolean;
  makeHouse: (i: number, j: number, face: FaceDir, opt?: { roof?: string }) => HouseRecord;
}

const PLASTERS = ['#eadfc4', '#efe2b0', '#e9cfc0', '#dfe3d0', '#f1e7d6'];
const BEAMS = ['#4a2e1c', '#3d2a1f', '#5a3520'];
const ROOFS = ['#b4532f', '#56637f', '#8a3b2e', '#6f7d3c', 'thatch'];

export function buildBuildings(
  scene: THREE.Scene,
  grid: WorldGrid,
  TX: ProceduralTextures,
  MAT: SharedMaterials,
  roofMat: (k: string) => THREE.MeshLambertMaterial,
  mapSurfaces: THREE.Mesh[]
): WorldBuildings {
  const windowMats: WindowMatEntry[] = [];
  const glows: GlowEntry[] = [];
  const lightSources: THREE.Vector3[] = [];
  const chimneys: THREE.Vector3[] = [];
  const houseLights: THREE.PointLight[] = [];

  const glowSprite = (
    pos: THREE.Vector3,
    color: number,
    scale: number,
    base = 1,
    kind: GlowEntry['kind'] = 'lamp'
  ): GlowEntry => {
    const m = new THREE.SpriteMaterial({
      map: TX.glow,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    const s = new THREE.Sprite(m);
    s.position.copy(pos);
    s.scale.setScalar(scale);
    scene.add(s);
    const g: GlowEntry = { s, base, phase: R(0, 6.28), kind };
    glows.push(g);
    return g;
  };

  const roofGeo = (w: number, d: number, wallH: number, roofH: number, ov: number): THREE.BufferGeometry => {
    const X = w / 2 + ov;
    const Zt = d / 2 + ov;
    const slope = roofH / (d / 2);
    const ey = wallH - ov * slope;
    const ry = wallH + roofH;
    const L = Math.hypot(Zt, ry - ey);
    const p: number[] = [];
    const u: number[] = [];
    const q = (
      A: [number, number, number],
      B: [number, number, number],
      C: [number, number, number],
      D: [number, number, number],
      ua: [number, number],
      ub: [number, number],
      uc: [number, number],
      ud: [number, number]
    ) => {
      p.push(...A, ...B, ...C, ...A, ...C, ...D);
      u.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
    };
    q([-X, ey, Zt], [X, ey, Zt], [X, ry, 0], [-X, ry, 0], [-X / 2, 0], [X / 2, 0], [X / 2, L / 2], [-X / 2, L / 2]);
    q([X, ey, -Zt], [-X, ey, -Zt], [-X, ry, 0], [X, ry, 0], [X / 2, 0], [-X / 2, 0], [-X / 2, L / 2], [X / 2, L / 2]);
    const hw = w / 2;
    const hd = d / 2;
    p.push(hw, wallH, hd, hw, wallH, -hd, hw, ry, 0);
    u.push(0, 0, 1, 0, 0.5, 1);
    p.push(-hw, wallH, -hd, -hw, wallH, hd, -hw, ry, 0);
    u.push(0, 0, 1, 0, 0.5, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.addGroup(0, 12, 0);
    g.addGroup(12, 6, 1);
    g.computeVertexNormals();
    return g;
  };

  const winMat = (t: WallTextureSet | GableTextureSet): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({
      map: t.map,
      emissiveMap: t.emi,
      emissive: 0xffa64d,
      emissiveIntensity: 0,
    });
    windowMats.push({ m, phase: R(0, 6.28) });
    return m;
  };

  const houses: HouseRecord[] = [];
  const makeHouse = (i: number, j: number, face: FaceDir, opt: { roof?: string } = {}): HouseRecord => {
    const pal = {
      plaster: pick(PLASTERS),
      beam: pick(BEAMS),
      shutter: pick(['#3f6e8c', '#7a3b2e', '#4f7a3a', '#6a4c8a']),
    };
    const w = 2.8;
    const d = 2.4;
    const wallH = 2.0;
    const roofH = R(1.2, 1.55);
    const F = FACE[face];
    const g = new THREE.Group();
    g.position.set(wx(i), grid.H[idx(i, j)] * TH, wz(j));
    g.rotation.y = F.r;
    scene.add(g);
    const fT = timberWall(w, wallH, 'front', pal);
    const bT = timberWall(w, wallH, 'back', pal);
    const s1 = timberWall(d, wallH, 'side', pal);
    const s2 = timberWall(d, wallH, 'side', pal);
    const plain = new THREE.MeshLambertMaterial({ color: pal.plaster });
    const walls = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), [
        winMat(s1),
        winMat(s2),
        plain,
        plain,
        winMat(fT),
        winMat(bT),
      ])
    );
    walls.position.y = wallH / 2;
    g.add(walls);
    const gT = gableTex(d, roofH, pal);
    g.add(shadowed(new THREE.Mesh(roofGeo(w, d, wallH, roofH, 0.22), [roofMat(opt.roof || pick(ROOFS)), winMat(gT)])));
    const chimneyH = 0.7 * roofH + 0.5;
    const chimneyRoll = R(0, 1) < 0.8;
    if (chimneyRoll) {
      const ch = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.42, chimneyH, 0.42), MAT.stone));
      ch.position.set(w * 0.28, wallH + 0.3 * roofH + chimneyH / 2, -d * 0.2);
      g.add(ch);
    }
    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), MAT.lantern);
    lan.position.set(0.62, 1.25, d / 2 + 0.14);
    g.add(lan);
    const barrel = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8), MAT.wood));
    barrel.position.set(-1.05, 0.25, d / 2 + 0.35);
    g.add(barrel);
    g.updateMatrixWorld(true);
    const W = (x: number, y: number, z: number) => g.localToWorld(new V3(x, y, z));
    fT.wins.forEach(([u, v]) => glowSprite(W(-w / 2 + u * w, v * wallH, d / 2 + 0.08), 0xffb060, 1.1, 0.75, 'win'));
    bT.wins.forEach(([u, v]) => glowSprite(W(w / 2 - u * w, v * wallH, -d / 2 - 0.08), 0xffb060, 1.1, 0.75, 'win'));
    s1.wins.forEach(([u, v]) => glowSprite(W(w / 2 + 0.08, v * wallH, d / 2 - u * d), 0xffb060, 1.1, 0.75, 'win'));
    s2.wins.forEach(([u, v]) => glowSprite(W(-w / 2 - 0.08, v * wallH, -d / 2 + u * d), 0xffb060, 1.1, 0.75, 'win'));
    const lp = W(0.62, 1.25, d / 2 + 0.2);
    glowSprite(lp, 0xffa040, 1.9, 1, 'lamp');
    lightSources.push(lp);
    if (chimneyRoll) chimneys.push(W(w * 0.28, wallH + roofH + 0.55, -d * 0.2));
    if (houseLights.length < 6) {
      const pl = new THREE.PointLight(0xffa24a, 0, 9, 2);
      pl.position.copy(W(0, 1.6, d / 2 + 1.1));
      scene.add(pl);
      houseLights.push(pl);
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) grid.block(i + di, j + dj);
    const h: HouseRecord = { door: [i + 2 * F.d[0], j + 2 * F.d[1]], i, j, g };
    houses.push(h);
    return h;
  };

  HOUSES.forEach(([i, j, f], n) => makeHouse(i, j, f, n === 8 ? { roof: 'thatch' } : {}));

  const chapel = (() => {
    const g = new THREE.Group();
    g.position.set(13.0, 3 * TH, wz(10));
    g.rotation.y = Math.PI;
    scene.add(g);
    const sideT = () =>
      stoneWall(3.4, 3.0, {
        arches: [
          [0.28, 0.18, 6, 12],
          [0.72, 0.18, 6, 12],
        ],
      });
    const endT = stoneWall(2.8, 3.0, { arches: [[0.5, 0.14, 8, 16]] });
    const walls = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.0, 2.8), [
        winMat(endT),
        winMat(stoneWall(2.8, 3, {})),
        MAT.stone,
        MAT.stone,
        winMat(sideT()),
        winMat(sideT()),
      ])
    );
    walls.position.set(-0.2, 1.5, 0);
    g.add(walls);
    const roof = shadowed(
      new THREE.Mesh(roofGeo(3.4, 2.8, 3.0, 1.6, 0.22), [
        roofMat('#4a566e'),
        winMat(gableTex(2.8, 1.6, null, true)),
      ])
    );
    roof.position.x = -0.2;
    g.add(roof);
    const tFront = stoneWall(1.5, 5.2, {
      door: true,
      arches: [
        [0.5, 0.38, 4, 7],
        [0.5, 0.07, 6, 9, false],
      ],
    });
    const tSide = () =>
      stoneWall(1.5, 5.2, {
        arches: [
          [0.5, 0.45, 3, 8],
          [0.5, 0.07, 6, 9, false],
        ],
      });
    const tower = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 1.5), [
        winMat(tFront),
        winMat(tSide()),
        MAT.stone,
        MAT.stone,
        winMat(tSide()),
        winMat(tSide()),
      ])
    );
    tower.position.set(2.25, 2.6, 0);
    g.add(tower);
    const spire = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 4), roofMat('#4a566e')));
    spire.position.set(2.25, 6.4, 0);
    spire.rotation.y = Math.PI / 4;
    g.add(spire);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), MAT.gold);
    c1.position.set(2.25, 7.85, 0);
    g.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.36), MAT.gold);
    c2.position.set(2.25, 7.95, 0);
    g.add(c2);
    g.updateMatrixWorld(true);
    const W = (x: number, y: number, z: number) => g.localToWorld(new V3(x, y, z));
    glowSprite(W(-0.2, 1.9, 1.5), 0xc8a0ff, 1.6, 0.7, 'win');
    glowSprite(W(-0.2, 1.9, -1.5), 0xc8a0ff, 1.6, 0.7, 'win');
    glowSprite(W(3.05, 1.2, 0), 0xffb060, 2.2, 1, 'lamp');
    lightSources.push(W(3.2, 1.2, 0));
    for (let i = 32; i <= 36; i++) for (let j = 9; j <= 11; j++) grid.block(i, j);
    return { door: [31, 10] as TileCoord, g };
  })();

  const mosque = (() => {
    const g = new THREE.Group();
    g.position.set(wx(20), TH, wz(12));
    g.rotation.y = FACE.E.r;
    scene.add(g);

    const plinth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.16, 2.8), MAT.sandstone));
    plinth.position.y = 0.08;
    g.add(plinth);

    const frontT = mosqueWall(2.7, 2.3, {
      door: true,
      arches: [
        [0.2, 0.34, 4, 10],
        [0.8, 0.34, 4, 10],
      ],
    });
    const backT = mosqueWall(2.7, 2.3, {
      arches: [
        [0.26, 0.32, 4, 10],
        [0.5, 0.28, 5, 11],
        [0.74, 0.32, 4, 10],
      ],
    });
    const sideT = () =>
      mosqueWall(2.4, 2.3, {
        arches: [
          [0.28, 0.32, 4, 10],
          [0.72, 0.32, 4, 10],
        ],
      });

    const hall = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.3, 2.4), [
        winMat(sideT()),
        winMat(sideT()),
        MAT.sandstone,
        MAT.sandstone,
        winMat(frontT),
        winMat(backT),
      ])
    );
    hall.position.y = 1.31;
    g.add(hall);

    const cornice = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 2.6), MAT.sandstone));
    cornice.position.y = 2.55;
    g.add(cornice);

    const domeMat = roofMat('#2b8078');
    const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.48, 12), MAT.sandstone));
    drum.position.set(0, 2.88, -0.05);
    g.add(drum);

    const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), domeMat));
    dome.position.set(0, 3.08, -0.05);
    g.add(dome);

    const addCrescent = (x: number, y: number, z: number, scale = 1) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * scale, 0.04 * scale, 0.42 * scale, 6), MAT.gold);
      mast.position.set(x, y, z);
      g.add(mast);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 8, 6), MAT.gold);
      orb.position.set(x, y + 0.1 * scale, z);
      g.add(orb);
      const crescent = new THREE.Mesh(
        new THREE.TorusGeometry(0.13 * scale, 0.026 * scale, 6, 12, Math.PI * 1.38),
        MAT.gold
      );
      crescent.position.set(x, y + 0.31 * scale, z);
      crescent.rotation.z = -Math.PI * 0.19;
      g.add(crescent);
    };
    addCrescent(0, 4.12, -0.05, 1);

    const mx = -1.18;
    const mz = 1.02;
    const mBase = shadowed(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 2.7, 0.62),
        winMat(mosqueWall(0.7, 2.7, { arches: [[0.5, 0.3, 3, 7]] }))
      )
    );
    mBase.position.set(mx, 1.35, mz);
    g.add(mBase);

    const mShaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.7, 8), MAT.sandstone));
    mShaft.position.set(mx, 3.55, mz);
    g.add(mShaft);

    const balcony = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.22, 8), MAT.sandstone));
    balcony.position.set(mx, 4.45, mz);
    g.add(balcony);

    const bTrim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 8), domeMat));
    bTrim.position.set(mx, 4.56, mz);
    g.add(bTrim);

    const mTier = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.72, 8), MAT.sandstone));
    mTier.position.set(mx, 4.92, mz);
    g.add(mTier);

    const mCap = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), domeMat)
    );
    mCap.position.set(mx, 5.26, mz);
    g.add(mCap);
    addCrescent(mx, 5.62, mz, 0.72);

    for (const sx of [-0.54, 0.54]) {
      const col = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.9, 8), MAT.sandstone));
      col.position.set(sx, 1.11, 1.42);
      g.add(col);
    }
    const portico = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.48), MAT.sandstone));
    portico.position.set(0, 2.08, 1.38);
    g.add(portico);
    const porticoCap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.52), domeMat));
    porticoCap.position.set(0, 2.18, 1.38);
    g.add(porticoCap);

    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), MAT.lantern);
    lan.position.set(0.58, 1.42, 1.54);
    g.add(lan);

    g.updateMatrixWorld(true);
    const W = (x: number, y: number, z: number) => g.localToWorld(new V3(x, y, z));
    glowSprite(W(0, 1.45, -1.3), 0xffcc70, 1.4, 0.7, 'win');
    glowSprite(W(1.42, 1.45, 0), 0xffcc70, 1.4, 0.7, 'win');
    glowSprite(W(-1.42, 1.45, 0), 0xffcc70, 1.4, 0.7, 'win');
    const lp = W(0.58, 1.42, 1.62);
    glowSprite(lp, 0xffb060, 2.1, 1, 'lamp');
    lightSources.push(lp);

    for (let i = 19; i <= 21; i++) for (let j = 11; j <= 13; j++) grid.block(i, j);
    return { door: [22, 12] as TileCoord, g };
  })();

  const mill = (() => {
    const edge = wx(riverC(8) + 1) + 0.5;
    const cx = edge + 1.5;
    const cz = wz(8);
    const g = new THREE.Group();
    g.position.set(cx, TH, cz);
    scene.add(g);
    const pal = { plaster: '#e6dcc4', beam: '#4a2e1c', shutter: '#3f6e8c' };
    const base = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.6), [
        winMat(stoneWall(2.6, 1.2, { door: true })),
        MAT.stone,
        MAT.stone,
        MAT.stone,
        MAT.stone,
        MAT.stone,
      ])
    );
    base.position.y = 0.6;
    g.add(base);
    const up = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.4), [
        winMat(timberWall(2.4, 1.6, 'back', pal)),
        winMat(timberWall(2.4, 1.6, 'side', pal)),
        MAT.wood,
        MAT.wood,
        winMat(timberWall(2.6, 1.6, 'back', pal)),
        winMat(timberWall(2.6, 1.6, 'side', pal)),
      ])
    );
    up.position.y = 2.0;
    g.add(up);
    g.add(shadowed(new THREE.Mesh(roofGeo(2.6, 2.4, 2.8, 1.4, 0.25), [roofMat('#8a3b2e'), winMat(gableTex(2.4, 1.4, pal))])));
    const wheel = new THREE.Group();
    wheel.position.set(-1.4 - 0.4, WATER_Y + 1.05 - TH, 0);
    g.add(wheel);
    const r = 1.3;
    for (const s of [-0.24, 0.24]) {
      const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 4, 18), MAT.wood));
      rim.rotation.y = Math.PI / 2;
      rim.position.x = s;
      wheel.add(rim);
      for (let k = 0; k < 3; k++) {
        const sp = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, r * 2, 0.07), MAT.wood));
        sp.position.x = s;
        sp.rotation.x = (k * Math.PI) / 3;
        wheel.add(sp);
      }
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.06), MAT.wood));
      p.position.set(0, Math.sin(a) * (r - 0.1), Math.cos(a) * (r - 0.1));
      p.rotation.x = Math.PI / 2 - a;
      wheel.add(p);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), MAT.iron);
    axle.rotation.z = Math.PI / 2;
    axle.position.x = 0.3;
    wheel.add(axle);
    g.updateMatrixWorld(true);
    const lp = g.localToWorld(new V3(1.6, 0.9, 0.7));
    glowSprite(lp, 0xffa040, 1.8, 1, 'lamp');
    lightSources.push(lp);
    for (let i = 12; i <= 14; i++) for (let j = 7; j <= 9; j++) grid.block(i, j);
    return { wheel, door: [15, 8] as TileCoord, splash: new V3(cx - 1.8, WATER_Y, cz) };
  })();

  const forge = (() => {
    const g = new THREE.Group();
    g.position.set(wx(19), TH, wz(30));
    g.rotation.y = Math.PI;
    scene.add(g);
    const furnace = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.1), MAT.stone));
    furnace.position.set(-0.55, 0.65, -0.6);
    g.add(furnace);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: 0xff7a20 }));
    mouth.position.set(-0.55, 0.5, -0.04);
    g.add(mouth);
    const ch = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), MAT.stone));
    ch.position.set(-0.55, 2.1, -0.85);
    g.add(ch);
    for (const [x, z] of [
      [-1.3, -1.15],
      [1.3, -1.15],
      [-1.3, 1.15],
      [1.3, 1.15],
    ]) {
      const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), MAT.dark));
      p.position.set(x, 1.05, z);
      g.add(p);
    }
    const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 2.8), roofMat('#56637f')));
    roof.position.set(0, 2.2, 0);
    roof.rotation.x = -0.18;
    g.add(roof);
    const an1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), MAT.iron));
    an1.position.set(0.5, 0.2, 1.1);
    g.add(an1);
    const an2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.26), MAT.iron));
    an2.position.set(0.5, 0.48, 1.1);
    g.add(an2);
    const tr = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.45), MAT.wood));
    tr.position.set(0.9, 0.18, -0.7);
    g.add(tr);
    g.updateMatrixWorld(true);
    const anvil = g.localToWorld(new V3(0.5, 0.6, 1.1));
    const fire = g.localToWorld(new V3(-0.55, 0.55, 0.1));
    glowSprite(fire, 0xff7a20, 2.4, 1, 'forge');
    lightSources.push(fire);
    const light = new THREE.PointLight(0xff7a2a, 10, 8, 2);
    light.position.copy(fire).add(new V3(0, 0.4, 0));
    scene.add(light);
    chimneys.push(g.localToWorld(new V3(-0.55, 3.5, -0.85)));
    for (let i = 18; i <= 20; i++) for (let j = 29; j <= 31; j++) grid.block(i, j);
    return { anvil, light, spot: [19, 28] as TileCoord };
  })();

  const stalls: StallRecord[] = (
    [
      [20, 27, 'E', [19, 27]],
      [26, 23, 'W', [27, 23]],
    ] as Array<[number, number, FaceDir, TileCoord]>
  ).map(([i, j, f, spot]) => {
    const g = new THREE.Group();
    g.position.set(wx(i), TH, wz(j));
    g.rotation.y = FACE[f].r;
    scene.add(g);
    const t = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.62), MAT.wood));
    t.position.y = 0.35;
    g.add(t);
    for (const [x, z, h] of [
      [-0.72, -0.35, 1.9],
      [0.72, -0.35, 1.9],
      [-0.72, 0.35, 1.5],
      [0.72, 0.35, 1.5],
    ]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), MAT.dark);
      p.position.set(x, h / 2, z);
      g.add(p);
    }
    const cn = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.05), MAT.stripes));
    cn.position.set(0, 1.72, 0);
    cn.rotation.x = -Math.PI / 2 + 0.38;
    g.add(cn);
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(
        k < 4 ? new THREE.SphereGeometry(0.09, 6, 4) : new THREE.BoxGeometry(0.2, 0.12, 0.2),
        new THREE.MeshLambertMaterial({ color: pick(['#d63a2f', '#e9c46a', '#5aa04a', '#8a4ad1', '#e07a2a']) })
      );
      m.position.set(-0.55 + k * 0.18, 0.76, R(-0.15, 0.15));
      g.add(m);
    }
    grid.block(i, j);
    return { spot, front: [i + FACE[f].d[0], j + FACE[f].d[1]] as TileCoord };
  });

  (() => {
    const p = new V3(wx(25), TH, wz(20));
    const ring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.7, 10), MAT.stone));
    ring.position.copy(p).add(new V3(0, 0.35, 0));
    scene.add(ring);
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), new THREE.MeshLambertMaterial({ color: 0x1d3a5a }));
    wtr.rotation.x = -Math.PI / 2;
    wtr.position.copy(p).add(new V3(0, 0.62, 0));
    scene.add(wtr);
    for (const s of [-1, 1]) {
      const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), MAT.dark));
      post.position.copy(p).add(new V3(s * 0.5, 0.75, 0));
      scene.add(post);
    }
    const rf = shadowed(new THREE.Mesh(roofGeo(1.3, 1.1, 0, 0.45, 0.1), [roofMat('#8a3b2e'), MAT.wood]));
    rf.position.copy(p).add(new V3(0, 1.45, 0));
    scene.add(rf);
    grid.block(25, 20);
  })();

  const firePit = (() => {
    const p = PCW.clone();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const s = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.17), MAT.rock));
      s.position.set(p.x + Math.cos(a) * 0.6, p.y + 0.1, p.z + Math.sin(a) * 0.6);
      scene.add(s);
    }
    for (let k = 0; k < 3; k++) {
      const l = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), MAT.dark));
      l.position.set(p.x, p.y + 0.12, p.z);
      l.rotation.z = Math.PI / 2 - 0.3;
      l.rotation.y = (k * Math.PI) / 3;
      scene.add(l);
    }
    grid.block(PC[0], PC[1]);
    return p;
  })();

  const lamps: Array<{ top: THREE.Vector3; lp: THREE.Vector3 }> = [];
  const PLAZA_LAMPS: TileCoord[] = [
    [28, 25],
    [26, 29],
    [21, 29],
    [18, 26],
    [21, 21],
    [26, 21],
  ];
  (
    [
      ...PLAZA_LAMPS,
      [12, 23],
      [4, 26],
      [9, 26],
      [26, 17],
      [28, 13],
      [31, 11],
      [16, 9],
    ] as TileCoord[]
  ).forEach(([i, j]) => {
    const x = wx(i);
    const z = wz(j);
    const y = grid.groundY(x, z);
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), MAT.dark));
    post.position.set(x, y + 1.05, z);
    scene.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), MAT.dark);
    arm.position.set(x + 0.18, y + 2.05, z);
    scene.add(arm);
    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), MAT.lantern);
    lan.position.set(x + 0.34, y + 1.86, z);
    scene.add(lan);
    const lp = lan.position.clone();
    glowSprite(lp, 0xffb050, 2.2, 1, 'lamp');
    lightSources.push(lp);
    lamps.push({ top: new V3(x, y + 2.1, z), lp });
    grid.block(i, j);
  });

  const coneMat = new THREE.ShaderMaterial({
    uniforms: { amt: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float amt; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.6); float a=pow(vUv.y,1.4)*f*amt; gl_FragColor=vec4(vec3(1.,.62,.28)*a,a); }`,
  });
  lamps.forEach((l) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.9, 16, 1, true), coneMat);
    c.position.copy(l.lp).add(new V3(0, -0.95, 0));
    scene.add(c);
  });

  (() => {
    const tiles: TileCoord[] = [];
    for (let k = 0; k < N * N; k++) if (grid.TYPE[k] === T.BRIDGE) tiles.push([k % N, (k / N) | 0]);
    const i0 = Math.min(...tiles.map((t) => t[0]));
    const i1 = Math.max(...tiles.map((t) => t[0]));
    const j0 = Math.min(...tiles.map((t) => t[1]));
    const j1 = Math.max(...tiles.map((t) => t[1]));
    const x0 = wx(i0) - 0.85;
    const x1 = wx(i1) + 0.85;
    const z0 = wz(j0) - 0.55;
    const z1 = wz(j1) + 0.55;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const deck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), MAT.wood));
    deck.position.set(cx, TH + 0.02, cz);
    scene.add(deck);
    mapSurfaces.push(deck);
    for (const z of [z0 + 0.05, z1 - 0.05]) {
      const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.08, 0.08), MAT.dark));
      rail.position.set(cx, TH + 0.55, z);
      scene.add(rail);
      for (let x = x0 + 0.1; x <= x1; x += 0.9) {
        const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), MAT.dark));
        p.position.set(x, TH + 0.3, z);
        scene.add(p);
      }
    }
    for (const x of [wx(i0) + 0.3, wx(i1) - 0.3]) {
      for (const z of [z0 + 0.2, z1 - 0.2]) {
        const s = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 6), MAT.dark));
        s.position.set(x, 0.55, z);
        scene.add(s);
      }
    }
  })();

  const festGroup = new THREE.Group();
  festGroup.visible = false;
  scene.add(festGroup);
  (() => {
    const anchors = PLAZA_LAMPS.map(([i, j]) => new V3(wx(i), TH + 2.1, wz(j))).sort(
      (a, b) => Math.atan2(a.z - PCW.z, a.x - PCW.x) - Math.atan2(b.z - PCW.z, b.x - PCW.x)
    );
    const pos: number[] = [];
    const col: number[] = [];
    const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'].map((c) => new THREE.Color(c));
    const linePts: THREE.Vector3[] = [];
    anchors.forEach((A, k) => {
      const B = anchors[(k + 1) % anchors.length];
      const P = (t: number) => new V3().lerpVectors(A, B, t).add(new V3(0, -Math.sin(t * Math.PI) * 0.55, 0));
      for (let s = 0; s <= 20; s++) {
        linePts.push(P(s / 20));
        if (s > 0 && s < 20) linePts.push(P(s / 20));
      }
      for (let s = 0; s < 10; s++) {
        const t0 = (s + 0.15) / 10;
        const t1 = (s + 0.85) / 10;
        const p0 = P(t0);
        const p1 = P(t1);
        const m = P((t0 + t1) / 2).add(new V3(0, -0.42, 0));
        const c = cols[(s + k) % cols.length];
        pos.push(...p0.toArray(), ...p1.toArray(), ...m.toArray());
        for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
      }
      glowSprite(P(0.5).add(new V3(0, -0.2, 0)), pick([0xff6a4a, 0xffd04a, 0x8affb0, 0x6ab0ff]), 1.0, 1, 'fest');
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    festGroup.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    festGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x2a1c12 })));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.2;
      const r = 4.0 + R(-0.2, 0.3);
      const x = PCW.x + Math.cos(a) * r;
      const z = PCW.z + Math.sin(a) * r;
      const pk = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8741e, flatShading: true })));
      pk.scale.y = 0.78;
      pk.position.set(x, grid.groundY(x, z) + 0.2, z);
      festGroup.add(pk);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), MAT.dark);
      st.position.set(x, grid.groundY(x, z) + 0.43, z);
      festGroup.add(st);
    }
  })();
  glows.filter((g) => g.kind === 'fest').forEach((g) => {
    scene.remove(g.s);
    festGroup.add(g.s);
  });

  const doorTiles: TileCoord[] = [
    ...houses.map((h) => h.door),
    chapel.door,
    mosque.door,
    mill.door,
    forge.spot,
    ...stalls.map((s) => s.spot),
  ];
  const nearDoor = (i: number, j: number): boolean => doorTiles.some(([a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1);

  return {
    houses,
    chapel,
    mosque,
    mill,
    forge,
    stalls,
    firePit,
    lamps,
    coneMat,
    festGroup,
    windowMats,
    glows,
    lightSources,
    chimneys,
    houseLights,
    doorTiles,
    nearDoor,
    makeHouse,
  };
}

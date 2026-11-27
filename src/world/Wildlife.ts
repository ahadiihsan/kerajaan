import * as THREE from 'three';
import { shadowed } from './Textures';
import { clearing, lake, WorldGrid, wx, wz } from './WorldGrid';

export const DEER_MAX_HP = 2;
export const DEER_SPOOK_SECONDS = 5;
export const DEER_RESPAWN_SECONDS = 25;
export const DEER_MEAT_YIELD = 2;

export interface DeerState {
  id: number;
  hp: number;
  alive: boolean;
  spookTimer: number;
  respawnTimer: number;
  hitFlash: number;
}

export interface DeerRecord extends DeerState {
  mesh: THREE.Group;
  legs: THREE.Group[];
  mats: THREE.MeshLambertMaterial[];
  phase: number;
  angle: number;
  radius: number;
  pos: THREE.Vector3;
}

export interface WildlifeEntry {
  mesh: THREE.Group;
  duck: boolean;
  legs: THREE.Group[];
  phase: number;
  radius: number;
}

export interface WorldWildlife {
  deer: DeerRecord[];
  deerMeshes: THREE.Group[];
  update: (time: number, dt: number) => void;
  hitDeer: (deerIndex: number) => { hit: boolean; defeated: boolean; pos: THREE.Vector3 };
}

export function createDeerState(id: number): DeerState {
  return {
    id,
    hp: DEER_MAX_HP,
    alive: true,
    spookTimer: 0,
    respawnTimer: 0,
    hitFlash: 0,
  };
}

export function applyDeerHit(state: DeerState): { hit: boolean; defeated: boolean } {
  if (!state.alive) return { hit: false, defeated: false };
  state.hp = Math.max(0, state.hp - 1);
  state.hitFlash = 1;
  if (state.hp <= 0) {
    state.alive = false;
    state.spookTimer = 0;
    state.respawnTimer = DEER_RESPAWN_SECONDS;
    return { hit: true, defeated: true };
  }
  state.spookTimer = DEER_SPOOK_SECONDS;
  return { hit: true, defeated: false };
}

export function tickDeerState(state: DeerState, dt: number): boolean {
  if (!state.alive) {
    state.respawnTimer = Math.max(0, state.respawnTimer - dt);
    if (state.respawnTimer <= 0) {
      state.alive = true;
      state.hp = DEER_MAX_HP;
      state.spookTimer = 0;
      state.hitFlash = 0;
      return true;
    }
    return false;
  }
  state.spookTimer = Math.max(0, state.spookTimer - dt);
  state.hitFlash = Math.max(0, state.hitFlash - dt * 4);
  return false;
}

export function buildWildlife(scene: THREE.Scene, grid: WorldGrid): WorldWildlife {
  const wildlifeShape = new THREE.SphereGeometry(1, 8, 6);
  const duckMats = new Map<number, THREE.MeshLambertMaterial>();

  const animalPart = (
    group: THREE.Group,
    color: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    perEntityMats?: THREE.MeshLambertMaterial[]
  ): THREE.Mesh => {
    let mat: THREE.MeshLambertMaterial;
    if (perEntityMats) {
      mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
      perEntityMats.push(mat);
    } else {
      if (!duckMats.has(color)) {
        duckMats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
      }
      mat = duckMats.get(color)!;
    }
    const mesh = shadowed(new THREE.Mesh(wildlifeShape, mat));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };

  const ducks: WildlifeEntry[] = [];
  const deer: DeerRecord[] = [];
  const deerMeshes: THREE.Group[] = [];

  for (let n = 0; n < 6; n++) {
    const mesh = new THREE.Group();
    const duck = n < 3;
    const legs: THREE.Group[] = [];
    if (duck) {
      animalPart(mesh, 0x8b7557, 0, 0.12, 0, 0.19, 0.15, 0.3);
      animalPart(mesh, 0x2d6658, 0, 0.26, 0.2, 0.12, 0.14, 0.13);
      animalPart(mesh, 0xe6b146, 0, 0.23, 0.32, 0.08, 0.035, 0.1);
      for (const x of [-0.15, 0.15]) animalPart(mesh, 0x594c42, x, 0.14, -0.03, 0.055, 0.1, 0.21);
      scene.add(mesh);
      ducks.push({ mesh, duck, legs, phase: n * 2.1, radius: 3.3 + n * 0.65 });
    } else {
      const deerIndex = n - 3;
      const mats: THREE.MeshLambertMaterial[] = [];
      animalPart(mesh, 0xa36d43, 0, 0.67, 0, 0.22, 0.24, 0.46, mats);
      animalPart(mesh, 0xa36d43, 0, 0.83, 0.31, 0.13, 0.32, 0.16, mats).rotation.x = 0.36;
      animalPart(mesh, 0xb78256, 0, 1.11, 0.49, 0.14, 0.14, 0.22, mats);
      animalPart(mesh, 0x433022, 0, 1.06, 0.67, 0.09, 0.065, 0.075, mats);
      animalPart(mesh, 0xead7b4, 0, 0.74, -0.43, 0.1, 0.12, 0.065, mats);
      for (const side of [-1, 1]) {
        animalPart(mesh, 0x805233, side * 0.12, 1.25, 0.41, 0.054, 0.14, 0.064, mats).rotation.z = -side * 0.55;
        animalPart(mesh, 0x392821, side * 0.12, 1.14, 0.55, 0.035, 0.035, 0.035, mats);
        for (const z of [-0.25, 0.25]) {
          const hip = new THREE.Group();
          hip.position.set(side * 0.14, 0.6, z);
          mesh.add(hip);
          animalPart(hip, 0x795136, 0, -0.3, 0, 0.052, 0.31, 0.06, mats);
          legs.push(hip);
        }
      }
      mesh.traverse((child) => {
        child.userData.deerIndex = deerIndex;
      });
      scene.add(mesh);
      deerMeshes.push(mesh);
      deer.push({
        ...createDeerState(deerIndex),
        mesh,
        legs,
        mats,
        phase: n * 2.1,
        angle: n * 2.1,
        radius: 2 + deerIndex * 0.65,
        pos: new THREE.Vector3(),
      });
    }
  }

  const update = (time: number, dt: number): void => {
    for (const { mesh, phase, radius } of ducks) {
      const a = time * 0.19 + phase;
      const x = wx(lake.i) + Math.cos(a) * radius;
      const z = wz(lake.j) + Math.sin(a) * radius * 0.72;
      mesh.position.set(x, grid.groundY(x, z) + Math.sin(time * 3 + phase) * 0.025, z);
      mesh.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * 0.72);
    }

    for (const d of deer) {
      tickDeerState(d, dt);
      d.mesh.visible = d.alive;
      if (!d.alive) continue;

      const spooked = d.spookTimer > 0;
      const speed = spooked ? 0.95 : 0.28;
      d.angle += dt * speed;
      const x = wx(clearing.i) + Math.cos(d.angle) * d.radius;
      const z = wz(clearing.j) + Math.sin(d.angle) * d.radius;
      const y = grid.groundY(x, z);
      d.mesh.position.set(x, y, z);
      d.pos.set(x, y, z);
      d.mesh.rotation.y = Math.atan2(-Math.sin(d.angle), Math.cos(d.angle));

      const legFreq = spooked ? 15 : 6;
      const legAmp = spooked ? 0.55 : 0.34;
      d.legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(time * legFreq + d.phase) * (i === 0 || i === 3 ? legAmp : -legAmp);
      });

      for (const m of d.mats) {
        m.emissive.setHex(0xff4422);
        m.emissiveIntensity = d.hitFlash * 0.85;
      }
    }
  };

  const hitDeer = (deerIndex: number): { hit: boolean; defeated: boolean; pos: THREE.Vector3 } => {
    const d = deer[deerIndex];
    if (!d) return { hit: false, defeated: false, pos: new THREE.Vector3() };
    const res = applyDeerHit(d);
    if (res.defeated) d.mesh.visible = false;
    return { ...res, pos: d.pos.clone() };
  };

  update(0, 0);
  return { deer, deerMeshes, update, hitDeer };
}

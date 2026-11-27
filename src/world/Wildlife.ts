import * as THREE from 'three';
import { shadowed } from './Textures';
import { clearing, lake, WorldGrid, wx, wz } from './WorldGrid';

export interface WildlifeEntry {
  mesh: THREE.Group;
  duck: boolean;
  legs: THREE.Group[];
  phase: number;
  radius: number;
}

export function buildWildlife(scene: THREE.Scene, grid: WorldGrid): (time: number) => void {
  const wildlifeShape = new THREE.SphereGeometry(1, 8, 6);
  const wildlifeMats = new Map<number, THREE.MeshLambertMaterial>();

  const animalPart = (
    group: THREE.Group,
    color: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number
  ): THREE.Mesh => {
    if (!wildlifeMats.has(color)) {
      wildlifeMats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    }
    const mesh = shadowed(new THREE.Mesh(wildlifeShape, wildlifeMats.get(color)!));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };

  const wildlife: WildlifeEntry[] = [];
  for (let n = 0; n < 6; n++) {
    const mesh = new THREE.Group();
    const duck = n < 3;
    const legs: THREE.Group[] = [];
    if (duck) {
      animalPart(mesh, 0x8b7557, 0, 0.12, 0, 0.19, 0.15, 0.3);
      animalPart(mesh, 0x2d6658, 0, 0.26, 0.2, 0.12, 0.14, 0.13);
      animalPart(mesh, 0xe6b146, 0, 0.23, 0.32, 0.08, 0.035, 0.1);
      for (const x of [-0.15, 0.15]) animalPart(mesh, 0x594c42, x, 0.14, -0.03, 0.055, 0.1, 0.21);
    } else {
      animalPart(mesh, 0xa36d43, 0, 0.67, 0, 0.22, 0.24, 0.46);
      animalPart(mesh, 0xa36d43, 0, 0.83, 0.31, 0.13, 0.32, 0.16).rotation.x = 0.36;
      animalPart(mesh, 0xb78256, 0, 1.11, 0.49, 0.14, 0.14, 0.22);
      animalPart(mesh, 0x433022, 0, 1.06, 0.67, 0.09, 0.065, 0.075);
      animalPart(mesh, 0xead7b4, 0, 0.74, -0.43, 0.1, 0.12, 0.065);
      for (const side of [-1, 1]) {
        animalPart(mesh, 0x805233, side * 0.12, 1.25, 0.41, 0.054, 0.14, 0.064).rotation.z = -side * 0.55;
        animalPart(mesh, 0x392821, side * 0.12, 1.14, 0.55, 0.035, 0.035, 0.035);
        for (const z of [-0.25, 0.25]) {
          const hip = new THREE.Group();
          hip.position.set(side * 0.14, 0.6, z);
          mesh.add(hip);
          animalPart(hip, 0x795136, 0, -0.3, 0, 0.052, 0.31, 0.06);
          legs.push(hip);
        }
      }
    }
    scene.add(mesh);
    wildlife.push({ mesh, duck, legs, phase: n * 2.1, radius: duck ? 3.3 + n * 0.65 : 2 + (n - 3) * 0.65 });
  }

  const updateWildlife = (time: number): void => {
    for (const { mesh, duck, legs, phase, radius } of wildlife) {
      const a = time * (duck ? 0.19 : 0.28) + phase;
      const center = duck ? lake : clearing;
      const stretch = duck ? 0.72 : 1;
      const x = wx(center.i) + Math.cos(a) * radius;
      const z = wz(center.j) + Math.sin(a) * radius * stretch;
      mesh.position.set(x, grid.groundY(x, z) + (duck ? Math.sin(time * 3 + phase) * 0.025 : 0), z);
      mesh.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * stretch);
      legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(time * 6 + phase) * (i === 0 || i === 3 ? 0.34 : -0.34);
      });
    }
  };

  updateWildlife(0);
  return updateWildlife;
}

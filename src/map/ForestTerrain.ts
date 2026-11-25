import * as THREE from 'three';

export const FOREST_LIMIT = 75;
export const GROUND_SIZE = 224;
export const MAX_HIKE_GRADE = 0.82;
export const POND = { x: -8.3, z: 15, rx: 5.1, rz: 4.3 };
export const TERRACES = [
  { x: -13.8, z: -2.4, rx: 5.3, rz: 3.5, height: 2.95, approach: 'east' },
  { x: 12.6, z: -4, rx: 6.4, rz: 6.5, height: 3.4, approach: 'south' },
  { x: 15, z: -22, rx: 7.5, rz: 8.1, height: 4.8, approach: 'south' }
] as const;

export function normalizedDistance(
  x: number, z: number, area: { x: number; z: number; rx: number; rz: number }
): number {
  return Math.hypot((x - area.x) / area.rx, (z - area.z) / area.rz);
}

function approachDistance(x: number, z: number, terrace: typeof TERRACES[number]): number {
  if (terrace.approach === 'east') {
    return x >= terrace.x ? Math.abs(z - terrace.z) : Infinity;
  }
  return z >= terrace.z ? Math.abs(x - terrace.x) : Infinity;
}

export function hikingTrailDistance(x: number, z: number): number {
  let distance = x >= 2 && x <= 12.6 ? Math.abs(z - (8.4 - (x - 2) * 0.39)) : Infinity;
  for (const terrace of TERRACES) {
    if (normalizedDistance(x, z, terrace) < 1.25) {
      distance = Math.min(distance, approachDistance(x, z, terrace));
    }
  }
  return distance;
}

function shapeHeight(x: number, z: number): number {
  for (const terrace of TERRACES) {
    const distance = normalizedDistance(x, z, terrace);
    if (distance >= 1) continue;
    const lower = 1 - THREE.MathUtils.smoothstep(distance, 0.80, 1);
    const middle = 1 - THREE.MathUtils.smoothstep(distance, 0.52, 0.70);
    const upper = 1 - THREE.MathUtils.smoothstep(distance, 0.27, 0.43);
    const shelves = lower * 0.28 + middle * 0.37 + upper * 0.35;
    const ramp = 1 - THREE.MathUtils.smoothstep(approachDistance(x, z, terrace), 1.05, 2.6);
    return terrace.height * THREE.MathUtils.lerp(shelves, 1 - distance, ramp);
  }
  const distance = normalizedDistance(x, z, POND);
  return -1.72 * (1 - THREE.MathUtils.smoothstep(distance, 0.48, 1));
}

const side = GROUND_SIZE + 1;
const half = GROUND_SIZE / 2;
const heights = Float32Array.from({ length: side * side }, (_, index) =>
  shapeHeight(index % side - half, Math.floor(index / side) - half)
);

export function terrainHeight(x: number, z: number): number {
  const u = THREE.MathUtils.clamp(x + half, 0, GROUND_SIZE);
  const v = THREE.MathUtils.clamp(z + half, 0, GROUND_SIZE);
  const col = Math.min(Math.floor(u), GROUND_SIZE - 1);
  const row = Math.min(Math.floor(v), GROUND_SIZE - 1);
  const a = heights[row * side + col];
  const b = heights[(row + 1) * side + col];
  const c = heights[(row + 1) * side + col + 1];
  const d = heights[row * side + col + 1];
  const s = u - col;
  const t = v - row;
  // Sample the same pair of triangles and diagonal as PlaneGeometry.
  return s + t <= 1 ? a + s * (d - a) + t * (b - a) : c + (1 - s) * (b - c) + (1 - t) * (d - c);
}

const up = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();

export function alignToGround(mesh: THREE.Object3D, x: number, z: number): void {
  const dx = terrainHeight(x + 0.18, z) - terrainHeight(x - 0.18, z);
  const dz = terrainHeight(x, z + 0.18) - terrainHeight(x, z - 0.18);
  normal.set(-dx, 0.36, -dz).normalize();
  mesh.quaternion.setFromUnitVectors(up, normal);
}

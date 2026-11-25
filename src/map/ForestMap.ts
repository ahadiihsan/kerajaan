import * as THREE from 'three';
import { seededRandom } from './seededRandom';
import { buildForestAnimals } from './ForestAnimals';
import { PondWater } from './PondWater';
import { FOREST_LIMIT, GROUND_SIZE, hikingTrailDistance, MAX_HIKE_GRADE, normalizedDistance,
  POND, TERRACES, terrainHeight } from './ForestTerrain';

export { FOREST_LIMIT } from './ForestTerrain';

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const FOREST_NAME = 'Alderwood Forest';

export function trailX(z: number): number {
  return Math.sin((z - 8) * 0.105) * 7;
}

export function trailZ(x: number): number {
  return Math.sin(x * 0.095) * 5 + 8;
}

function trailDistance(x: number, z: number): number {
  return Math.min(Math.abs(x - trailX(z)), Math.abs(z - trailZ(x)));
}

interface Placement {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotation: number;
  color: number;
}

export class ForestMap {
  public readonly group = new THREE.Group();
  public readonly collisionBoxes: CollisionBox[] = [];
  public readonly landmarks = [
    { name: 'Alder Glade', x: 0, z: 8 },
    { name: 'Alder Rise', x: 12.6, z: -4 },
    { name: 'Lookout Ridge', x: 15, z: -22 },
    { name: 'Standing Stones', x: -21, z: -19 },
    { name: 'Bracken Bend', x: 27, z: 13 },
    { name: 'North Ridge', x: 4, z: -46 },
    { name: 'Fern Crossing', x: -7, z: 53 }
  ];

  public readonly ground: THREE.Group;
  private readonly pond = new PondWater();

  constructor() {
    this.group.name = FOREST_NAME;
    this.ground = this.buildGround();
    this.group.add(this.ground, this.pond);
    this.buildForest();
    this.group.add(buildForestAnimals());
  }

  public updateWater(elapsed: number, animatedWater: boolean): void {
    this.pond.update(elapsed, animatedWater);
  }

  private buildGround(): THREE.Group {
    const ground = new THREE.Group();
    const half = GROUND_SIZE / 2;
    const patchSize = 32;
    const side = GROUND_SIZE + 1;
    const shades = Float32Array.from({ length: side * side }, seededRandom(2471));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    const moss = new THREE.Color(0x4f8a30);
    const meadow = new THREE.Color(0x88b838);
    const dirt = new THREE.Color(0xb98553);
    const clay = new THREE.Color(0x965a3e);
    const sand = new THREE.Color(0xd6a46e);
    const shelf = new THREE.Color();
    const color = new THREE.Color();

    for (let startZ = -half; startZ < half; startZ += patchSize) {
      for (let startX = -half; startX < half; startX += patchSize) {
        const centerX = startX + patchSize / 2;
        const centerZ = startZ + patchSize / 2;
        const geometry = new THREE.PlaneGeometry(patchSize, patchSize, patchSize, patchSize);
        geometry.rotateX(-Math.PI / 2);
        const position = geometry.attributes.position;
        const colors = new Float32Array(position.count * 3);

        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i) + centerX;
          const z = position.getZ(i) + centerZ;
          const y = terrainHeight(x, z);
          position.setY(i, y);
          const patches = 0.52 + 0.27 * Math.sin(x * 0.32 + z * 0.19) + 0.18 * Math.cos(z * 0.43 - x * 0.3);
          const clearing = Math.hypot(x * 1.12, z - 8) - 4.9;
          const hike = hikingTrailDistance(x, z) - 1.0;
          const path = Math.min(trailDistance(x, z) - 1.65, clearing, hike) + 0.26 * Math.sin(x * 1.1 + z);
          color.copy(moss).lerp(meadow, patches).lerp(dirt, 1 - THREE.MathUtils.smoothstep(path, -0.4, 0.42));
          const pondBank = 1 - THREE.MathUtils.smoothstep(normalizedDistance(x, z, POND), 0.82, 1.04);
          color.lerp(sand, pondBank);
          for (const terrace of TERRACES) {
            const edge = normalizedDistance(x, z, terrace);
            if (edge < 1.03) {
              const grassLip = THREE.MathUtils.smoothstep(y, terrace.height * 0.68, terrace.height * 0.86);
              const soil = (1 - grassLip) * (1 - THREE.MathUtils.smoothstep(edge, 0.92, 1.03));
              shelf.copy(clay).lerp(sand, 0.17 + 0.17 * Math.cos(y * 5.2));
              color.lerp(shelf, soil * THREE.MathUtils.smoothstep(hike, 0, 0.65));
            }
          }
          color.multiplyScalar(0.975 + shades[(z + half) * side + x + half] * 0.05);
          color.toArray(colors, i * 3);
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const patch = new THREE.Mesh(geometry, material);
        patch.position.set(centerX, 0, centerZ);
        patch.receiveShadow = true;
        ground.add(patch);
      }
    }
    return ground;
  }

  private buildForest(): void {
    const random = seededRandom(8103);
    const stones = this.landmarks.find(landmark => landmark.name === 'Standing Stones')!;
    const trunks: Placement[] = [];
    const needles: Placement[] = [];
    const crowns: Placement[] = [];
    const rocks: Placement[] = [];
    const understory: Placement[] = [];
    const shadows: Placement[] = [];
    const understoryColors = [0x89ae43, 0x568c3d, 0xb1bf51, 0x459863];

    for (let row = -14; row <= 14; row++) {
      for (let column = -14; column <= 14; column++) {
        const x = column * 7 + (random() - 0.5) * 4;
        const z = row * 7 + (random() - 0.5) * 4;
        const glade = Math.hypot(x * 1.4, (z - 12) * 0.54) < 10;
        const stoneCircle = Math.hypot(x - stones.x, z - stones.z) < 11;
        if (glade || stoneCircle || trailDistance(x, z) < 4.1 || hikingTrailDistance(x, z) < 2.25 ||
          random() < 0.17) continue;

        const rotation = random() * Math.PI * 2;
        const size = 0.65 + random() * 0.75;
        const broadleaf = random() < 0.32;
        if (normalizedDistance(x, z, POND) < 1.08) continue;
        const terrace = TERRACES.find(area => normalizedDistance(x, z, area) < 1);
        if (terrace && normalizedDistance(x, z, terrace) > 0.7) continue;
        const y = terrainHeight(x, z);
        const radius = size * (broadleaf ? 0.57 : 0.34);
        const height = size * (broadleaf ? 6.9 : 9.4);
        trunks.push({ x, y: y + height * 0.5, z, scaleX: radius, scaleY: height, scaleZ: radius, rotation, color: 0x795038 });
        if (!terrace) {
          shadows.push({ x: x - size * 0.75, y: 0.014, z: z - size * 0.65,
            scaleX: size * 2.7, scaleY: 1, scaleZ: size * 2.2, rotation, color: 0xffffff });
        }

        if (broadleaf) {
          const greens = [0x69ac31, 0x348b59, 0x97bc35];
          for (let branch = 0; branch < 3; branch++) {
            const angle = rotation + branch * 2.4;
            crowns.push({
              x: x + Math.sin(angle) * 0.94 * size, y: y + height * (0.84 + branch * 0.12),
              z: z + Math.cos(angle) * 1.3 * size, scaleX: size * (3.0 - branch * 0.34),
              scaleY: size * (2.25 + random() * 0.65), scaleZ: size * (2.7 - branch * 0.28), rotation: angle, color: greens[branch]
            });
          }
        } else {
          const pineColors = [0x206650, 0x267b5b, 0x32966c, 0x4aad7d];
          for (let tier = 0; tier < 4; tier++) {
            const radius = size * (2.5 - tier * 0.49);
            needles.push({
              x, y: y + height * (0.44 + tier * 0.155), z, scaleX: radius,
              scaleY: size * (3.65 - tier * 0.26), scaleZ: radius,
              rotation: rotation + tier * 0.42, color: pineColors[tier]
            });
          }
        }

        if (Math.abs(x) < FOREST_LIMIT && Math.abs(z) < FOREST_LIMIT) {
          this.addCollision(x, z, radius);
        }
      }
    }

    for (let i = 0; i < 950; i++) {
      const z = (random() - 0.5) * 174;
      const x = i % 2 === 0 ? trailX(z) + (random() - 0.5) * 18 : (random() - 0.5) * 174;
      if (trailDistance(x, z) < 2.5 || Math.hypot(x, z - 8) < 7) continue;
      if (normalizedDistance(x, z, POND) < 0.9 || hikingTrailDistance(x, z) < 1.1 ||
        TERRACES.some(terrace => Math.abs(normalizedDistance(x, z, terrace) - 0.83) < 0.14)) continue;
      const y = terrainHeight(x, z);
      const size = 0.42 + random() * 0.95;
      const rotation = random() * Math.PI * 2;
      if (i % 7 === 0) {
        rocks.push({ x, y: y + size * 0.12, z, scaleX: size * 0.72, scaleY: size * 0.49, scaleZ: size * 0.62, rotation, color: 0x858879 });
      } else {
        understory.push({ x, y: y + 0.015, z, scaleX: size, scaleY: size, scaleZ: size, rotation, color: understoryColors[i % understoryColors.length] });
      }
    }

    for (let i = 0; i < 6; i++) {
      const rotation = i * Math.PI / 3;
      const x = stones.x + 4.2 * Math.sin(rotation);
      const z = stones.z + 4.2 * Math.cos(rotation);
      const height = 1.7 + random() * 1.9;
      rocks.push({ x, y: height * 0.76, z, scaleX: 1.08, scaleY: height, scaleZ: 0.9, rotation, color: 0x919b80 });
      this.addCollision(x, z, 0.86);
    }

    const solid = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
    const foliage = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 1 });
    const pine = new THREE.CylinderGeometry(0.035, 1, 1, 7, 1);
    this.tintByHeight(pine);
    const crown = new THREE.IcosahedronGeometry(1, 2);
    this.tintByHeight(crown);
    const fern = this.createFern();
    this.tintByHeight(fern);

    const boulder = new THREE.IcosahedronGeometry(1);
    rocks.push(
      { x: -9, y: 0.83, z: 1.8, scaleX: 2.5, scaleY: 1.7, scaleZ: 1.7, rotation: 0.6, color: 0x8f9094 },
      { x: -10.5, y: 1.25, z: 1.9, scaleX: 1.5, scaleY: 2.1, scaleZ: 1.5, rotation: 1.7, color: 0xa19ba0 }
    );
    this.addCollision(-9, 1.8, 1.1);
    this.addCollision(-10.5, 1.9, 0.9);

    for (const [x, z, size] of [[-11.9, 13.9, 0.94], [-9.5, 12, 0.48], [-5, 13, 0.58], [-6, 17.7, 0.85]]) {
      const y = terrainHeight(x, z);
      rocks.push({ x, z, y: y + size * 0.3, scaleX: size, scaleY: size * 0.66, scaleZ: size * 0.78,
        rotation: x, color: 0xb09579 });
    }
    for (const angle of [0.23, 0.92, 1.62, 2.36, 3.79, 4.63, 5.22]) {
      for (let i = 0; i < 4; i++) {
        const distance = 0.86 + random() * 0.16;
        const offset = angle + (random() - 0.5) * 0.19;
        const x = POND.x + Math.cos(offset) * POND.rx * distance;
        const z = POND.z + Math.sin(offset) * POND.rz * distance;
        understory.push({ x, z, y: terrainHeight(x, z), scaleX: 0.56, scaleY: 1.25,
          scaleZ: 0.56, rotation: offset, color: 0x3d813d });
      }
    }

    const grass: Placement[] = [];
    const addTuft = (x: number, z: number) => {
      if (hikingTrailDistance(x, z) < 1.2) return;
      const size = 0.45 + random() * 0.65;
      grass.push({ x, z, y: terrainHeight(x, z) - 0.04, scaleX: size, scaleY: size, scaleZ: size,
        color: random() < 0.6 ? 0x79a937 : 0x568f32, rotation: random() * Math.PI * 2 });
    };
    for (const terrace of TERRACES) {
      for (let i = 0; i < 55; i++) {
        const angle = i * Math.PI * 2 / 55;
        const distance = 0.58 + random() * 0.12;
        addTuft(terrace.x + Math.cos(angle) * terrace.rx * distance,
          terrace.z + Math.sin(angle) * terrace.rz * distance);
      }
    }
    for (const [x, z] of [[3, 5.5], [8.6, 7.1], [-4.1, 13.6], [-6, 6.9], [-3.8, 18.4], [1.9, 14.7], [9.5, 14.6]]) {
      for (let i = 0; i < 17; i++) {
        const tuftX = x + (random() - 0.5) * 2.5;
        const tuftZ = z + (random() - 0.5) * 1.6;
        if (trailDistance(tuftX, tuftZ) > 1.65 && normalizedDistance(tuftX, tuftZ, POND) > 0.91) {
          addTuft(tuftX, tuftZ);
        }
      }
    }
    const blades = new THREE.BufferGeometry();
    blades.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.21, 0, 0.07, -0.12, 0, 0.03, -0.29, 0.28, -0.05,
      -0.10, 0, -0.02, -0.02, 0, 0.02, -0.14, 0.44, 0,
       0.00, 0, 0.02,  0.09, 0, 0.03,  0.18, 0.35, -0.12,
       0.08, 0, 0.08,  0.19, 0, 0.04,  0.3, 0.23, 0.06,
      -0.02, 0, 0.06,  0.06, 0, 0.08,  0.08, 0.26, 0.23
    ], 3));
    blades.computeVertexNormals();
    this.addInstances(blades, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), grass);

    this.addInstances(new THREE.CylinderGeometry(0.38, 1, 1, 6), solid, trunks, true);
    this.addInstances(pine, foliage, needles, true);
    this.addInstances(crown, foliage, crowns, true);
    this.addInstances(boulder, solid, rocks, true);
    this.addInstances(fern, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), understory);
    this.buildWildflowersAndMushrooms(solid);

    const pixels = Uint8Array.from({ length: 32 * 32 * 4 }, (_, i) => {
      if (i % 4 !== 3) return [24, 32, 19][i % 4];
      const pixel = i >> 2;
      const distance = Math.hypot((pixel % 32 - 15.5) / 15.5, ((pixel >> 5) - 15.5) / 15.5);
      return Math.max(0, 1 - distance ** 2) ** 2 * 88;
    });
    const shade = new THREE.DataTexture(pixels, 32, 32);
    shade.colorSpace = THREE.SRGBColorSpace;
    shade.magFilter = shade.minFilter = THREE.LinearFilter;
    shade.needsUpdate = true;
    this.addInstances(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      shadows);
  }

  private buildWildflowersAndMushrooms(material: THREE.Material): void {
    const random = seededRandom(740);
    const stems: Placement[] = [];
    const caps: Placement[] = [];
    const colors = [0xcc5440, 0xdc833d, 0xa15886];
    for (const [x, z, scale] of [[2.35, 3.6, 0.9], [-7, 5, 1.55], [10, 5.3, 1.85],
      [-4, -1, 1.25], [-4, 13, 0.95], [-21, -22, 1.4], [28, 17, 1.8], [5, -47, 1.6]]) {
      for (let i = 0; i < 4; i++) {
        const size = scale * (0.32 + random() * 0.62);
        const rotation = random() * Math.PI * 2;
        const base = { x: x + Math.sin(rotation) * i * 0.47, z: z + Math.cos(rotation) * i * 0.47, rotation };
        const y = terrainHeight(base.x, base.z);
        if (y < -0.28) continue;
        stems.push({ ...base, y: y + size * 0.48, scaleX: size * 0.22, scaleY: size * 0.96, scaleZ: size * 0.22, color: 0xf4d9a4 });
        caps.push({ ...base, y: y + size * 0.86, scaleX: size * 0.75, scaleY: size * 0.9, scaleZ: size * 0.75, color: colors[i % colors.length] });
      }
    }
    const flowers: Placement[] = [];
    const petals = [0xffdc65, 0xf3b1c6, 0xffeed8];
    for (const [x, z] of [[3, 6.7], [8.8, 6.4], [-6, 6], [-7.2, 14], [4, 15], [4.6, -2]]) {
      for (let i = 0; i < 14; i++) {
        const scale = 0.08 + random() * 0.12;
        const flowerX = x + (random() - 0.5) * 2;
        const flowerZ = z + (random() - 0.5) * 1.5;
        if (trailDistance(flowerX, flowerZ) < 2.1 ||
          normalizedDistance(flowerX, flowerZ, POND) < 0.9) continue;
        const height = 0.16 + random() * 0.22;
        const y = terrainHeight(flowerX, flowerZ);
        const base = { x: flowerX, z: flowerZ, rotation: random() * Math.PI * 2 };
        stems.push({ ...base, y: y + height * 0.5, scaleX: 0.026, scaleY: height, scaleZ: 0.026, color: 0x648543 });
        flowers.push({ ...base, y: y + height, scaleX: scale, scaleY: scale * 0.42, scaleZ: scale, color: petals[i % petals.length] });
      }
    }
    this.addInstances(new THREE.IcosahedronGeometry(1), material, flowers);

    const cap = new THREE.LatheGeometry([
      new THREE.Vector2(0, -0.12), new THREE.Vector2(0.72, -0.12),
      new THREE.Vector2(1, 0), new THREE.Vector2(0.74, 0.36),
      new THREE.Vector2(0.32, 0.54), new THREE.Vector2(0, 0.57)
    ], 9);
    this.addInstances(new THREE.CylinderGeometry(0.68, 1, 1, 6), material, stems, true);
    this.addInstances(cap, material, caps, true);
  }

  private createFern(): THREE.BufferGeometry {
    const vertices: number[] = [];
    for (let leaf = 0; leaf < 6; leaf++) {
      const angle = leaf * Math.PI / 3;
      const point = (length: number, height: number, width: number) => [
        Math.cos(angle) * length - Math.sin(angle) * width,
        height,
        Math.sin(angle) * length + Math.cos(angle) * width
      ];
      const stem = point(0, 0, 0);
      const ridge = point(0.37, 0.57, 0);
      const tip = point(0.87, 0.33, 0);
      for (const side of [-1, 1]) {
        const width = side * 0.16;
        const firstLeaf = point(0.31, 0.41, width);
        const notch = point(0.48, 0.46, width * 0.25);
        const secondLeaf = point(0.62, 0.43, width * 0.78);
        vertices.push(...stem, ...ridge, ...firstLeaf, ...ridge, ...notch, ...firstLeaf,
          ...ridge, ...secondLeaf, ...notch, ...ridge, ...tip, ...secondLeaf);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private tintByHeight(geometry: THREE.BufferGeometry): void {
    const position = geometry.attributes.position;
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const light = 0.73 + 0.27 * ((position.getY(i) - min.y) / (max.y - min.y));
      colors.set([light, light, light * 0.94], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  private addInstances(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: Placement[],
    castShadow = false
  ): void {
    const patches = new Map<string, Placement[]>();
    for (const placement of placements) {
      const key = `${Math.floor(placement.x / 30)},${Math.floor(placement.z / 30)}`;
      const patch = patches.get(key);
      if (patch) {
        patch.push(placement);
      } else {
        patches.set(key, [placement]);
      }
    }

    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    for (const patch of patches.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, patch.length);
      patch.forEach((placement, index) => {
        transform.position.set(placement.x, placement.y, placement.z);
        transform.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ);
        transform.rotation.y = placement.rotation;
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
        mesh.setColorAt(index, color.setHex(placement.color));
      });
      mesh.castShadow = castShadow;
      mesh.receiveShadow = !material.transparent;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
  }

  private addCollision(x: number, z: number, radius: number): void {
    this.collisionBoxes.push({
      minX: x - radius, maxX: x + radius,
      minZ: z - radius, maxZ: z + radius
    });
  }

  public resolveCollision(
    currentX: number,
    currentZ: number,
    targetX: number,
    targetZ: number,
    playerRadius: number = 0.45,
    airborneY?: number
  ): { x: number; z: number; collided: boolean } {
    let resolvedX = targetX;
    let resolvedZ = targetZ;
    let collided = false;

    const mapLimit = FOREST_LIMIT;
    if (Math.abs(resolvedX) > mapLimit) {
      resolvedX = Math.sign(resolvedX) * mapLimit;
      collided = true;
    }
    if (Math.abs(resolvedZ) > mapLimit) {
      resolvedZ = Math.sign(resolvedZ) * mapLimit;
      collided = true;
    }

    for (const box of this.collisionBoxes) {
      const minX = box.minX - playerRadius;
      const maxX = box.maxX + playerRadius;
      const minZ = box.minZ - playerRadius;
      const maxZ = box.maxZ + playerRadius;

      if (resolvedX > minX && resolvedX < maxX && resolvedZ > minZ && resolvedZ < maxZ) {
        collided = true;
        const dx1 = resolvedX - minX;
        const dx2 = maxX - resolvedX;
        const dz1 = resolvedZ - minZ;
        const dz2 = maxZ - resolvedZ;

        const minPenX = Math.min(dx1, dx2);
        const minPenZ = Math.min(dz1, dz2);

        if (minPenX < minPenZ) {
          resolvedX = dx1 < dx2 ? minX : maxX;
        } else {
          resolvedZ = dz1 < dz2 ? minZ : maxZ;
        }
      }
    }

    const rx = POND.rx + playerRadius;
    const rz = POND.rz + playerRadius;
    const dx = resolvedX - POND.x;
    const dz = resolvedZ - POND.z;
    const distance = Math.hypot(dx / rx, dz / rz);
    if (distance < 1) {
      resolvedX = POND.x + (distance > 0 ? dx / distance : rx);
      resolvedZ = POND.z + (distance > 0 ? dz / distance : 0);
      collided = true;
    }

    const step = Math.hypot(resolvedX - currentX, resolvedZ - currentZ);
    const ground = terrainHeight(currentX, currentZ);
    const reachableHeight = airborneY ?? ground + step * MAX_HIKE_GRADE;
    if (terrainHeight(resolvedX, resolvedZ) > reachableHeight + 0.002) {
      return { x: currentX, z: currentZ, collided: true };
    }

    return { x: resolvedX, z: resolvedZ, collided };
  }
}

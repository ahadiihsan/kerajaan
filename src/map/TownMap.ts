import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import villageUrl from '../../models/village assets.glb?url';

export interface CollisionBox { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface Landmark {
  name: string; x: number; z: number;
  type: 'plaza' | 'hall' | 'tavern' | 'tower' | 'gate' | 'residential';
}

/** A first homestead carved out of a much older forest. */
export class TownMap {
  public group = new THREE.Group();
  public collisionBoxes: CollisionBox[] = [];
  public landmarks: Landmark[] = [];
  public trees: { x: number; z: number; radius: number }[] = [];
  private assets = new Map<string, THREE.Object3D>();
  private seed = 1729;

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  public async assembleTown(): Promise<void> {
    this.group.name = 'ShepherdsForest';
    const kit = await new GLTFLoader().loadAsync(villageUrl);
    // The export contains coincident duplicate meshes. Use the named originals.
    kit.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        this.assets.set(object.name, object);
      }
    });
    this.place('House_Blue', -7, -4, 5.3, 0.12, true);
    this.place('Barn', 9, -9, 5.2, -0.12, true);
    this.place('Well', -4, 3, 1.5, 0, true);
    this.place('Pond', -20, 8, 10, 0.3, true);
    this.place('Hay_Cart', 6, -4, 2.4, -0.4, true);
    this.place('Hay_Bale', 11, -3, 1.4);
    this.place('Hay_Pile', 12, -5, 1.5);
    this.place('Barrell', -10, -1, 0.9);
    this.place('Crate', -9, 0, 0.8);
    this.place('Bench', -5, -0.5, 1.8, 0.15);
    // Stepping stones from the cottage door to the woodland footpath.
    for (let i = 0; i < 7; i++) {
      this.place('StonePath', -7 + i * 0.9, -1.8 + i * 0.3, 1.05, 0.25 + (i % 2) * 0.15);
    }
    for (let i = 0; i < 6; i++) {
      this.place('Fence', 5 + i * 2, 7, 2, 0, true);
      this.place('Fence', 5 + i * 2, 16, 2, 0, true);
    }
    for (let i = 0; i < 4; i++) this.place('Fence', 17, 7 + i * 2.3, 2.3, -Math.PI / 2, true);
    this.landmarks.push(
      { name: "Shepherd’s Clearing", x: 0, z: 8, type: 'plaza' },
      { name: 'Your First Home', x: -7, z: -4, type: 'residential' },
      { name: 'The Old Barn', x: 9, z: -9, type: 'hall' },
      { name: 'Willow Pond', x: -20, z: 8, type: 'residential' },
    );
    const species = ['Tree_Pine', 'Tree_Square', 'Tree_Tall'];
    for (let x = -72; x <= 72; x += 4.4) {
      for (let z = -72; z <= 72; z += 4.4) {
        const tx = x + (this.random() - 0.5) * 3.8;
        const tz = z + (this.random() - 0.5) * 3.8;
        const clearing = ((tx + 1) / 23) ** 2 + ((tz - 3) / 21) ** 2;
        const trail = Math.abs(tx - Math.sin(tz * 0.065) * 5) < 3;
        if (clearing < 1 || trail || this.random() < 0.13) continue;
        const height = 4 + this.random() * 4.5;
        this.place(species[Math.floor(this.random() * species.length)], tx, tz, height, this.random() * Math.PI * 2);
        this.trees.push({ x: tx, z: tz, radius: height * 0.25 });
        this.collisionBoxes.push({ minX: tx - 0.3, maxX: tx + 0.3, minZ: tz - 0.3, maxZ: tz + 0.3 });
      }
    }
    for (let i = 0; i < 180; i++) {
      const x = (this.random() - 0.5) * 110;
      const z = (this.random() - 0.5) * 110;
      if (Math.abs(x - Math.sin(z * 0.065) * 5) < 3 || Math.hypot(x, z - 10) < 4) continue;
      this.place(i % 9 === 0 ? 'Boulder.001' : i % 3 === 0 ? 'Shroom' : 'Daisy', x, z,
        i % 9 === 0 ? 0.5 + this.random() : 0.18 + this.random() * 0.2, this.random() * 6);
    }
    for (const [x, z] of [[8, 10], [12, 12], [14, 9], [9, 14], [5, 12]]) this.sheep(x, z);
  }

  private place(name: string, x: number, z: number, size: number, rotation = 0, solid = false): void {
    const source = this.assets.get(name) ?? this.assets.get(name.replace(/\./g, ''));
    if (!source) throw new Error(`Missing village asset: ${name}`);
    const object = source.clone();
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.setScalar(1);
    const bounds = new THREE.Box3().setFromObject(object);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const scale = size / Math.max(dimensions.x, dimensions.y, dimensions.z);
    const center = bounds.getCenter(new THREE.Vector3());
    object.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    object.scale.setScalar(scale);
    object.traverse(child => {
      if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; }
    });
    const root = new THREE.Group();
    root.add(object);
    root.position.set(x, 0.015, z);
    root.rotation.y = rotation;
    this.group.add(root);
    if (solid) {
      const box = new THREE.Box3().setFromObject(root);
      this.collisionBoxes.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    }
  }

  private sheep(x: number, z: number): void {
    const sheep = new THREE.Group();
    const wool = new THREE.MeshStandardMaterial({ color: 0xeee7d4, flatShading: true, roughness: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x514838, roughness: 1 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), wool);
    body.scale.set(0.85, 0.85, 1.35); body.position.y = 0.65; sheep.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 0), dark);
    head.position.set(0, 0.68, 0.62); sheep.add(head);
    for (const dx of [-0.24, 0.24]) for (const dz of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.4, 5), dark);
      leg.position.set(dx, 0.22, dz); sheep.add(leg);
    }
    sheep.position.set(x, 0, z); sheep.rotation.y = this.random() * 6;
    sheep.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    this.group.add(sheep);
  }

  public resolveCollision(
    _currentX: number,
    _currentZ: number,
    targetX: number,
    targetZ: number,
    playerRadius: number = 0.45
  ): { x: number; z: number; collided: boolean } {
    let resolvedX = targetX;
    let resolvedZ = targetZ;
    let collided = false;

    const mapLimit = 75;
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

    return { x: resolvedX, z: resolvedZ, collided };
  }
}

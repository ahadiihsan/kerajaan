import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { TownMap } from '../map/TownMap';
import { PixelSpriteSheet } from './PixelSpriteSheet';

interface CrowdAgent {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  speed: number;
  animPhase: number;
  isIdle: boolean;
  idleTimer: number;
}

export class PlayerCrowd implements Updatable {
  public group: THREE.Group;
  public maxCount: number = 1000;
  public activeCount: number = 1000;

  private spriteMesh!: THREE.InstancedMesh;
  private shadowMesh!: THREE.InstancedMesh;

  private agents: CrowdAgent[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private townMap: TownMap;

  // Varied historical wardrobe palette
  private tunicColors = [
    new THREE.Color(0x2d4f7c), // Woad blue
    new THREE.Color(0x853229), // Madder crimson
    new THREE.Color(0x3d5a3f), // Forest green
    new THREE.Color(0x735235), // Russet leather
    new THREE.Color(0xb09146), // Saffron gold
    new THREE.Color(0x56385a), // Muted plum
    new THREE.Color(0x484440), // Charcoal
  ];

  constructor(townMap: TownMap, initialCount: number = 1000) {
    this.townMap = townMap;
    this.activeCount = Math.min(initialCount, this.maxCount);
    this.group = new THREE.Group();
    this.group.name = 'HD2DPlayerCrowd';

    this.initInstancedSprites();
    this.spawnAgents();
  }

  private initInstancedSprites(): void {
    // 1. Instanced Contact Shadow Discs
    const shadowGeo = new THREE.CircleGeometry(0.48, 8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x120e0a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, this.maxCount);
    this.shadowMesh.count = this.activeCount;
    this.group.add(this.shadowMesh);

    // 2. Instanced 2D Pixel Sprite Quads
    const spriteGeo = new THREE.PlaneGeometry(1.7, 2.26);
    spriteGeo.translate(0, 1.13, 0); // Pivot at feet

    const tex = PixelSpriteSheet.getTexture('down', 0);
    const spriteMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide
    });

    this.spriteMesh = new THREE.InstancedMesh(spriteGeo, spriteMat, this.maxCount);
    this.spriteMesh.count = this.activeCount;
    this.group.add(this.spriteMesh);
  }

  private spawnAgents(): void {
    for (let i = 0; i < this.maxCount; i++) {
      const zone = Math.random();
      let sx = 0;
      let sz = 0;

      if (zone < 0.5) {
        // Central Plaza
        const angle = Math.random() * Math.PI * 2;
        const rad = 2.5 + Math.random() * 16.0;
        sx = Math.cos(angle) * rad;
        sz = Math.sin(angle) * rad;
      } else if (zone < 0.75) {
        // Main North-South Street
        sx = (Math.random() - 0.5) * 5.0;
        sz = (Math.random() - 0.5) * 80;
      } else {
        // Canal Bridge & East Quarter
        sx = 16 + Math.random() * 18;
        sz = (Math.random() - 0.5) * 30;
      }

      this.agents.push({
        x: sx,
        z: sz,
        targetX: sx + (Math.random() - 0.5) * 20,
        targetZ: sz + (Math.random() - 0.5) * 20,
        speed: 2.2 + Math.random() * 1.6,
        animPhase: Math.random() * Math.PI * 2,
        isIdle: Math.random() < 0.3,
        idleTimer: Math.random() * 3,
      });

      // Assign tint
      const col = this.tunicColors[i % this.tunicColors.length];
      this.spriteMesh.setColorAt(i, col);
    }

    if (this.spriteMesh.instanceColor) {
      this.spriteMesh.instanceColor.needsUpdate = true;
    }
  }

  public setCrowdCount(count: number): void {
    this.activeCount = Math.max(0, Math.min(this.maxCount, count));
    this.spriteMesh.count = this.activeCount;
    this.shadowMesh.count = this.activeCount;
  }

  public update(delta: number, _elapsed: number): void {
    const dummy = this.dummy;
    const spriteTilt = THREE.MathUtils.degToRad(30); // Matches elevated diorama camera

    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];

      if (a.isIdle) {
        a.idleTimer -= delta;
        if (a.idleTimer <= 0) {
          a.isIdle = false;
          a.targetX = a.x + (Math.random() - 0.5) * 25;
          a.targetZ = a.z + (Math.random() - 0.5) * 25;
        }
      } else {
        const dx = a.targetX - a.x;
        const dz = a.targetZ - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.0) {
          a.isIdle = Math.random() < 0.45;
          a.idleTimer = 1.5 + Math.random() * 3.0;
          a.targetX = (Math.random() - 0.5) * 50;
          a.targetZ = (Math.random() - 0.5) * 60;
        } else {
          const moveX = (dx / dist) * a.speed * delta;
          const moveZ = (dz / dist) * a.speed * delta;

          const resolved = this.townMap.resolveCollision(a.x, a.z, a.x + moveX, a.z + moveZ, 0.35);
          if (resolved.collided) {
            a.targetX = a.x + (Math.random() - 0.5) * 20;
            a.targetZ = a.z + (Math.random() - 0.5) * 20;
          }
          a.x = resolved.x;
          a.z = resolved.z;

          a.animPhase += delta * a.speed * 4.0;
        }
      }

      const bob = a.isIdle ? 0 : Math.abs(Math.sin(a.animPhase)) * 0.05;

      // 1. Shadow Disc Matrix (Flat on ground)
      dummy.position.set(a.x, 0.02, a.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.shadowMesh.setMatrixAt(i, dummy.matrix);

      // 2. 2D Billboard Sprite Matrix (Tilted to face elevated camera directly)
      dummy.position.set(a.x, bob, a.z);
      dummy.rotation.set(spriteTilt, 0, 0);
      dummy.updateMatrix();
      this.spriteMesh.setMatrixAt(i, dummy.matrix);
    }

    this.shadowMesh.instanceMatrix.needsUpdate = true;
    this.spriteMesh.instanceMatrix.needsUpdate = true;
  }
}

import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { ForestMap, trailX, trailZ } from '../map/ForestMap';
import { alignToGround, terrainHeight } from '../map/ForestTerrain';
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
  isSitting: boolean; // Classic RO1 /sit
}

export class PlayerCrowd implements Updatable {
  public group: THREE.Group;
  public maxCount: number = 1000;
  public activeCount: number = 1000;

  private spriteMesh!: THREE.InstancedMesh;
  private shadowMesh!: THREE.InstancedMesh;

  private agents: CrowdAgent[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private forestMap: ForestMap;

  // Ragnarok Online job class color themes (Swordsman, Mage, Archer, Merchant, Thief, Novice)
  private roColors = [
    new THREE.Color(0x2d4f7c), // Swordsman blue
    new THREE.Color(0xa33224), // Novice / Mage red
    new THREE.Color(0x3d6b38), // Archer green
    new THREE.Color(0x8c653a), // Merchant leather
    new THREE.Color(0x403d42), // Thief charcoal
    new THREE.Color(0xbf9c3b), // Acolyte gold
    new THREE.Color(0x613d6e), // High Wizard purple
  ];

  constructor(forestMap: ForestMap, initialCount: number = 1000) {
    this.forestMap = forestMap;
    this.activeCount = Math.min(initialCount, this.maxCount);
    this.group = new THREE.Group();
    this.group.name = 'ForestVisitors';

    this.initInstancedSprites();
    this.spawnAgents();
  }

  private initInstancedSprites(): void {
    // 1. Soft Oval Drop Shadows
    const shadowGeo = new THREE.CircleGeometry(0.5, 8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x120d08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, this.maxCount);
    this.shadowMesh.count = this.activeCount;
    this.shadowMesh.frustumCulled = false;
    this.group.add(this.shadowMesh);

    // 2. 2D Anime Pixel Billboard Sprites (Lit by scene sun & lanterns)
    const spriteGeo = new THREE.PlaneGeometry(1.7, 2.3);
    spriteGeo.translate(0, 1.15, 0); // Pivot at feet

    // Adjust vertex normals to face forward-upward to catch sunlight
    const normals = spriteGeo.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, 0, 0.45, 0.89);
    }
    normals.needsUpdate = true;

    const tex = PixelSpriteSheet.getTexture('down', 0);
    const spriteMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x909090),
      emissiveIntensity: 0.65,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.spriteMesh = new THREE.InstancedMesh(spriteGeo, spriteMat, this.maxCount);
    this.spriteMesh.castShadow = false; // Prevents 1,000 overlapping rectangular shadow streaks
    this.spriteMesh.receiveShadow = false;
    this.spriteMesh.count = this.activeCount;
    this.spriteMesh.frustumCulled = false;
    this.group.add(this.spriteMesh);
  }

  private spawnAgents(): void {
    for (let i = 0; i < this.maxCount; i++) {
      let sx: number;
      let sz: number;
      if (i % 2 === 0) {
        sz = (Math.random() - 0.5) * 105;
        sx = trailX(sz) + (Math.random() - 0.5) * 3.4;
      } else {
        sx = (Math.random() - 0.5) * 105;
        sz = trailZ(sx) + (Math.random() - 0.5) * 3.4;
      }
      const isSitting = Math.random() < 0.24;

      this.agents.push({
        x: sx,
        z: sz,
        targetX: sx + (Math.random() - 0.5) * 20,
        targetZ: sz + (Math.random() - 0.5) * 20,
        speed: 2.2 + Math.random() * 1.8,
        animPhase: Math.random() * Math.PI * 2,
        isIdle: isSitting || Math.random() < 0.3,
        idleTimer: isSitting ? 999999 : Math.random() * 4,
        isSitting: isSitting,
      });

      // Assign RO1 class theme color
      const col = this.roColors[i % this.roColors.length];
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

  public update(delta: number, _elapsed: number, cameraYaw: number = 0): void {
    if (this.activeCount === 0) return;
    const dummy = this.dummy;
    const spriteTilt = 0; // True RO1: Sprites stand vertically upright on the ground plane

    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];

      if (a.isSitting) {
        // Classic RO1 sitting on the ground: no movement
      } else if (a.isIdle) {
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
          a.idleTimer = 1.5 + Math.random() * 3.5;
          a.targetX = (Math.random() - 0.5) * 55;
          a.targetZ = (Math.random() - 0.5) * 65;
        } else {
          const moveX = (dx / dist) * a.speed * delta;
          const moveZ = (dz / dist) * a.speed * delta;

          const resolved = this.forestMap.resolveCollision(a.x, a.z, a.x + moveX, a.z + moveZ, 0.35);
          if (resolved.collided) {
            a.targetX = a.x + (Math.random() - 0.5) * 20;
            a.targetZ = a.z + (Math.random() - 0.5) * 20;
          }
          a.x = resolved.x;
          a.z = resolved.z;

          a.animPhase += delta * a.speed * 4.0;
        }
      }

      const bob = (a.isSitting || a.isIdle) ? 0 : Math.abs(Math.sin(a.animPhase)) * 0.05;
      const posY = a.isSitting ? -0.2 : bob; // Lower sprite slightly when seated

      // 1. Shadow Disc Matrix
      const groundY = terrainHeight(a.x, a.z);
      dummy.position.set(a.x, groundY + 0.028, a.z);
      alignToGround(dummy, a.x, a.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.shadowMesh.setMatrixAt(i, dummy.matrix);

      // 2. 2D Billboard Sprite Matrix (Camera-synced cylindrical billboarding)
      dummy.position.set(a.x, groundY + posY, a.z);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.y = cameraYaw;
      dummy.rotation.x = spriteTilt;
      dummy.updateMatrix();
      this.spriteMesh.setMatrixAt(i, dummy.matrix);
    }

    this.shadowMesh.instanceMatrix.needsUpdate = true;
    this.spriteMesh.instanceMatrix.needsUpdate = true;
  }
}

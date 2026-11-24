import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { TownMap } from '../map/TownMap';

interface CrowdAgent {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  speed: number;
  angle: number;
  animPhase: number;
  isIdle: boolean;
  idleTimer: number;
}

export class PlayerCrowd implements Updatable {
  public group: THREE.Group;
  public maxCount: number = 1000;
  public activeCount: number = 1000;

  private torsoMesh!: THREE.InstancedMesh;
  private headMesh!: THREE.InstancedMesh;
  private capeMesh!: THREE.InstancedMesh;
  private staffMesh!: THREE.InstancedMesh;

  private agents: CrowdAgent[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private townMap: TownMap;

  // Medieval wardrobe palette for crowd diversity
  private tunicColors = [
    new THREE.Color(0x2d4f7c), // Woad blue
    new THREE.Color(0x853229), // Madder crimson
    new THREE.Color(0x3d5a3f), // Forest green
    new THREE.Color(0x6b4c33), // Russet leather
    new THREE.Color(0xb09146), // Saffron ochre
    new THREE.Color(0x4a4642), // Charcoal linen
    new THREE.Color(0x8a6245), // Warm dun
    new THREE.Color(0x56385a), // Muted plum
  ];

  private capeColors = [
    new THREE.Color(0x7a2622),
    new THREE.Color(0x27435e),
    new THREE.Color(0x2e4a32),
    new THREE.Color(0x826938),
    new THREE.Color(0x403b38),
  ];

  constructor(townMap: TownMap, initialCount: number = 1000) {
    this.townMap = townMap;
    this.activeCount = Math.min(initialCount, this.maxCount);
    this.group = new THREE.Group();
    this.group.name = 'PlayerCrowd';

    this.initInstancedMeshes();
    this.spawnAgents();
  }

  private initInstancedMeshes(): void {
    // 1. Tunic / Torso
    const torsoGeo = new THREE.BoxGeometry(0.52, 0.65, 0.34);
    const tunicMat = new THREE.MeshLambertMaterial();
    this.torsoMesh = new THREE.InstancedMesh(torsoGeo, tunicMat, this.maxCount);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoMesh.count = this.activeCount;
    this.group.add(this.torsoMesh);

    // 2. Head / Hood
    const headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xd6ad85 });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, this.maxCount);
    this.headMesh.castShadow = true;
    this.headMesh.count = this.activeCount;
    this.group.add(this.headMesh);

    // 3. Flowing Cape
    const capeGeo = new THREE.PlaneGeometry(0.46, 0.82);
    capeGeo.translate(0, -0.41, 0);
    const capeMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.capeMesh = new THREE.InstancedMesh(capeGeo, capeMat, this.maxCount);
    this.capeMesh.castShadow = true;
    this.capeMesh.count = this.activeCount;
    this.group.add(this.capeMesh);

    // 4. Quarterstaff
    const staffGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5);
    const staffMat = new THREE.MeshLambertMaterial({ color: 0x4a3221 });
    this.staffMesh = new THREE.InstancedMesh(staffGeo, staffMat, this.maxCount);
    this.staffMesh.castShadow = true;
    this.staffMesh.count = this.activeCount;
    this.group.add(this.staffMesh);
  }

  private spawnAgents(): void {
    for (let i = 0; i < this.maxCount; i++) {
      // Pick random spawn area in town (Plaza, North/South street, East/West alleys)
      const spawnZone = Math.random();
      let sx = 0;
      let sz = 0;

      if (spawnZone < 0.45) {
        // Central Town Plaza (circle r < 22)
        const angle = Math.random() * Math.PI * 2;
        const rad = 3.0 + Math.random() * 18.0;
        sx = Math.cos(angle) * rad;
        sz = Math.sin(angle) * rad;
      } else if (spawnZone < 0.70) {
        // Main North-South thoroughfare (Z from -50 to +50, X between -3.5 and 3.5)
        sx = (Math.random() - 0.5) * 6.5;
        sz = (Math.random() - 0.5) * 95;
      } else if (spawnZone < 0.85) {
        // East Artisan Street (X from 8 to 40, Z between -3.5 and 3.5)
        sx = 8 + Math.random() * 32;
        sz = (Math.random() - 0.5) * 6.0;
      } else {
        // West Alley (X from -40 to -8, Z between -3.5 and 3.5)
        sx = -8 - Math.random() * 32;
        sz = (Math.random() - 0.5) * 6.0;
      }

      this.agents.push({
        x: sx,
        z: sz,
        targetX: sx + (Math.random() - 0.5) * 20,
        targetZ: sz + (Math.random() - 0.5) * 20,
        speed: 2.2 + Math.random() * 1.8,
        angle: Math.random() * Math.PI * 2,
        animPhase: Math.random() * Math.PI * 2,
        isIdle: Math.random() < 0.25,
        idleTimer: Math.random() * 3,
      });

      // Assign medieval wardrobe colors
      const tunicColor = this.tunicColors[i % this.tunicColors.length];
      this.torsoMesh.setColorAt(i, tunicColor);

      const capeColor = this.capeColors[i % this.capeColors.length];
      this.capeMesh.setColorAt(i, capeColor);
    }

    if (this.torsoMesh.instanceColor) this.torsoMesh.instanceColor.needsUpdate = true;
    if (this.capeMesh.instanceColor) this.capeMesh.instanceColor.needsUpdate = true;
  }

  public setCrowdCount(count: number): void {
    this.activeCount = Math.max(0, Math.min(this.maxCount, count));
    this.torsoMesh.count = this.activeCount;
    this.headMesh.count = this.activeCount;
    this.capeMesh.count = this.activeCount;
    this.staffMesh.count = this.activeCount;
  }

  public update(delta: number, _elapsed: number): void {
    const dummy = this.dummy;

    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];

      if (a.isIdle) {
        a.idleTimer -= delta;
        if (a.idleTimer <= 0) {
          a.isIdle = false;
          // Pick new random walk target
          a.targetX = a.x + (Math.random() - 0.5) * 30;
          a.targetZ = a.z + (Math.random() - 0.5) * 30;
        }
      } else {
        // Move towards target
        const dx = a.targetX - a.x;
        const dz = a.targetZ - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.2) {
          // Reached target -> pause or choose new destination
          a.isIdle = Math.random() < 0.4;
          a.idleTimer = 1.5 + Math.random() * 3.5;
          a.targetX = (Math.random() - 0.5) * 70;
          a.targetZ = (Math.random() - 0.5) * 90;
        } else {
          // Walk forward
          const moveX = (dx / dist) * a.speed * delta;
          const moveZ = (dz / dist) * a.speed * delta;

          // Collision check
          const resolved = this.townMap.resolveCollision(a.x, a.z, a.x + moveX, a.z + moveZ, 0.35);
          if (resolved.collided) {
            // Divert to a new target if hitting an obstacle
            a.targetX = a.x + (Math.random() - 0.5) * 25;
            a.targetZ = a.z + (Math.random() - 0.5) * 25;
          }
          a.x = resolved.x;
          a.z = resolved.z;

          // Smooth rotation to face movement direction
          const targetAngle = Math.atan2(dx, dz);
          const diff = (targetAngle - a.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          a.angle += diff * Math.min(1.0, delta * 10);

          a.animPhase += delta * a.speed * 3.5;
        }
      }

      // Vertical stride bobbing
      const bob = a.isIdle ? 0 : Math.abs(Math.sin(a.animPhase)) * 0.05;
      const baseY = 0.85 + bob;

      // 1. Torso Matrix
      dummy.position.set(a.x, baseY, a.z);
      dummy.rotation.set(0, a.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.torsoMesh.setMatrixAt(i, dummy.matrix);

      // 2. Head Matrix
      dummy.position.set(a.x, baseY + 0.5, a.z);
      dummy.updateMatrix();
      this.headMesh.setMatrixAt(i, dummy.matrix);

      // 3. Cape Matrix (Swaying backwards when moving)
      const capeTilt = a.isIdle ? 0.15 : 0.45 + Math.sin(a.animPhase) * 0.08;
      dummy.position.set(
        a.x - Math.sin(a.angle) * 0.18,
        baseY + 0.28,
        a.z - Math.cos(a.angle) * 0.18
      );
      dummy.rotation.set(capeTilt, a.angle, 0);
      dummy.updateMatrix();
      this.capeMesh.setMatrixAt(i, dummy.matrix);

      // 4. Staff Matrix
      dummy.position.set(
        a.x + Math.cos(a.angle) * 0.38,
        baseY + 0.1,
        a.z - Math.sin(a.angle) * 0.38
      );
      dummy.rotation.set(0.2, a.angle, 0);
      dummy.updateMatrix();
      this.staffMesh.setMatrixAt(i, dummy.matrix);
    }

    this.torsoMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.capeMesh.instanceMatrix.needsUpdate = true;
    this.staffMesh.instanceMatrix.needsUpdate = true;
  }
}

import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { InputManager } from './InputManager';
import { TownMap } from '../map/TownMap';
import { PixelSpriteSheet, SpriteDirection } from './PixelSpriteSheet';

export class CharacterController implements Updatable {
  public mesh: THREE.Group;
  public camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private townMap: TownMap;

  // 2D Pixel Sprite Plane
  private spriteMesh!: THREE.Mesh;
  private spriteMaterial!: THREE.MeshBasicMaterial;
  private shadowDisc!: THREE.Mesh;

  // Direction & Animation Cycle
  private direction: SpriteDirection = 'down';
  private frameIndex: number = 0;
  private animTimer: number = 0;
  private isMoving: boolean = false;

  // Movement parameters
  public walkSpeed: number = 5.0;
  public runSpeed: number = 8.5;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  private currentSpeed: number = 0;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager, townMap: TownMap) {
    this.camera = camera;
    this.input = input;
    this.townMap = townMap;

    this.mesh = new THREE.Group();
    this.mesh.name = 'HD2DPlayer';
    this.buildPixelSprite();
    this.mesh.position.copy(this.position);
  }

  private buildPixelSprite(): void {
    // 1. Contact shadow disc on cobblestones
    const shadowGeo = new THREE.CircleGeometry(0.55, 12);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x14100c,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.position.y = 0.03;
    this.mesh.add(this.shadowDisc);

    // 2. 2D Billboard Sprite Quad
    const spriteGeo = new THREE.PlaneGeometry(1.8, 2.4);
    spriteGeo.translate(0, 1.2, 0); // Anchor at feet

    const initialTex = PixelSpriteSheet.getTexture('down', 0);
    this.spriteMaterial = new THREE.MeshBasicMaterial({
      map: initialTex,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide
    });

    this.spriteMesh = new THREE.Mesh(spriteGeo, this.spriteMaterial);
    // Tilt sprite back slightly (~30 degrees) to face the elevated diorama camera
    this.spriteMesh.rotation.x = THREE.MathUtils.degToRad(30);
    this.mesh.add(this.spriteMesh);
  }

  public update(delta: number, _elapsed: number): void {
    this.input.update();

    const mx = this.input.state.moveX;
    const mz = this.input.state.moveZ;
    const moveMagnitude = Math.sqrt(mx * mx + mz * mz);

    this.isMoving = moveMagnitude > 0.05;

    if (this.isMoving) {
      // Determine 4-way direction based on input
      if (Math.abs(mx) > Math.abs(mz) * 1.1) {
        this.direction = mx > 0 ? 'right' : 'left';
      } else {
        this.direction = mz > 0 ? 'down' : 'up';
      }

      // Movement speed
      const targetSpeed = (this.input.state.isSprinting ? this.runSpeed : this.walkSpeed) * moveMagnitude;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, delta * 14);

      const targetX = this.position.x + mx * this.currentSpeed * delta;
      const targetZ = this.position.z + mz * this.currentSpeed * delta;

      // Collision resolution against diorama obstacles
      const resolved = this.townMap.resolveCollision(this.position.x, this.position.z, targetX, targetZ, 0.45);
      this.position.x = resolved.x;
      this.position.z = resolved.z;

      // Cycle animation frames (1 -> 0 -> 3 -> 0)
      const animRate = this.input.state.isSprinting ? 12 : 8;
      this.animTimer += delta * animRate;
      const walkFrames = [1, 0, 3, 0];
      this.frameIndex = walkFrames[Math.floor(this.animTimer) % 4];
    } else {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * 16);
      this.frameIndex = 0; // Standing frame
      this.animTimer = 0;
    }

    // Update sprite texture
    const newTex = PixelSpriteSheet.getTexture(this.direction, this.frameIndex);
    if (this.spriteMaterial.map !== newTex) {
      this.spriteMaterial.map = newTex;
      this.spriteMaterial.needsUpdate = true;
    }

    // Apply position
    this.mesh.position.copy(this.position);

    // 3. HD-2D Camera Follow (Elevated cinematic angle)
    this.updateCamera(delta);
  }

  private updateCamera(delta: number): void {
    const camTarget = new THREE.Vector3(
      this.position.x,
      this.position.y + 9.5,
      this.position.z + 13.5
    );

    // Smooth camera tracking
    this.camera.position.lerp(camTarget, Math.min(1.0, delta * 8));
    this.camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);
  }
}

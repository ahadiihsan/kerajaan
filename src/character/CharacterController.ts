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
  private nametagSprite!: THREE.Sprite;

  // Ground Target Ripple Cursor (Classic RO1 Green Click Circle)
  private rippleMesh!: THREE.Mesh;
  private rippleMaterial!: THREE.MeshBasicMaterial;
  private rippleTimer: number = 0;
  private rippleActive: boolean = false;

  // RO1 Click-to-Move Target
  private targetDestination: THREE.Vector3 | null = null;
  public isSitting: boolean = false;

  // Direction & Animation Cycle
  private direction: SpriteDirection = 'down';
  private frameIndex: number = 0;
  private animTimer: number = 0;
  private isMoving: boolean = false;

  // Movement parameters
  public walkSpeed: number = 5.4;
  public runSpeed: number = 8.5;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  private currentSpeed: number = 0;

  // Camera Orbit parameters (Classic RO1 Right-Click Rotate)
  public cameraDistance: number = 18.0;
  private cameraYaw: number = 0; // Horizontal orbit
  private cameraPitch: number = 0.62; // ~35.5 degrees elevated isometric

  constructor(camera: THREE.PerspectiveCamera, input: InputManager, townMap: TownMap) {
    this.camera = camera;
    this.input = input;
    this.townMap = townMap;

    this.mesh = new THREE.Group();
    this.mesh.name = 'RO1Player';
    this.buildPixelSprite();
    this.buildFloatingNametag();
    this.buildClickTargetRipple();
    this.mesh.position.copy(this.position);
  }

  private buildPixelSprite(): void {
    // 1. Soft Contact Shadow Disc on Ground
    const shadowGeo = new THREE.CircleGeometry(0.55, 12);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x120d08,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.position.y = 0.03;
    this.mesh.add(this.shadowDisc);

    // 2. 2D Billboard Anime Sprite Quad
    const spriteGeo = new THREE.PlaneGeometry(1.9, 2.3);
    spriteGeo.translate(0, 1.15, 0);

    const initialTex = PixelSpriteSheet.getTexture('down', 0);
    this.spriteMaterial = new THREE.MeshBasicMaterial({
      map: initialTex,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide
    });

    this.spriteMesh = new THREE.Mesh(spriteGeo, this.spriteMaterial);
    this.spriteMesh.rotation.x = THREE.MathUtils.degToRad(35);
    this.mesh.add(this.spriteMesh);
  }

  private buildFloatingNametag(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Background semi-transparent capsule
    ctx.fillStyle = 'rgba(10, 14, 20, 0.7)';
    ctx.roundRect(16, 8, 224, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Name: [Lv.99] Novice Traveler
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#fffae0';
    ctx.textAlign = 'center';
    ctx.fillText('[Lv.99] Novice Traveler', 128, 28);

    // Green HP Bar
    ctx.fillStyle = '#1e241c';
    ctx.fillRect(40, 36, 176, 8);
    ctx.fillStyle = '#2ed573';
    ctx.fillRect(40, 36, 176, 8);
    ctx.strokeStyle = '#20bf6b';
    ctx.strokeRect(40, 36, 176, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    this.nametagSprite = new THREE.Sprite(mat);
    this.nametagSprite.position.set(0, 2.7, 0);
    this.nametagSprite.scale.set(2.4, 0.6, 1);
    this.mesh.add(this.nametagSprite);
  }

  private buildClickTargetRipple(): void {
    const geo = new THREE.RingGeometry(0.3, 0.45, 24);
    geo.rotateX(-Math.PI / 2);
    this.rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0x2ed573,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.rippleMesh = new THREE.Mesh(geo, this.rippleMaterial);
    this.rippleMesh.position.y = 0.04;
    this.mesh.parent?.add(this.rippleMesh);
  }

  public update(delta: number, _elapsed: number): void {
    this.input.update();

    // Attach ripple mesh to scene once parent is ready
    if (this.mesh.parent && !this.rippleMesh.parent) {
      this.mesh.parent.add(this.rippleMesh);
    }

    // 1. Process RO1 Camera Rotation (Right Click Drag)
    const { dx, dy } = this.input.consumeLookDelta();
    this.cameraYaw -= dx;
    this.cameraPitch = Math.max(0.25, Math.min(1.25, this.cameraPitch + dy));

    const zoom = this.input.consumeZoomDelta();
    this.cameraDistance = Math.max(8.0, Math.min(32.0, this.cameraDistance + zoom));

    // 2. Process /sit toggle
    if (this.input.state.toggleSit) {
      this.input.state.toggleSit = false;
      this.isSitting = !this.isSitting;
      this.targetDestination = null;
    }

    // 3. Process Click-to-Move Target
    if (this.input.state.clickMoveTarget) {
      this.targetDestination = this.input.state.clickMoveTarget.clone();
      this.input.state.clickMoveTarget = null;
      this.isSitting = false;

      // Trigger Green Target Ripple
      this.rippleMesh.position.set(this.targetDestination.x, 0.04, this.targetDestination.z);
      this.rippleMesh.scale.set(0.6, 0.6, 0.6);
      this.rippleMaterial.opacity = 1.0;
      this.rippleTimer = 0.45;
      this.rippleActive = true;
    }

    // Animate Ripple
    if (this.rippleActive) {
      this.rippleTimer -= delta;
      const progress = 1.0 - Math.max(0, this.rippleTimer / 0.45);
      const s = 0.6 + progress * 0.8;
      this.rippleMesh.scale.set(s, s, s);
      this.rippleMaterial.opacity = 1.0 - progress;
      if (this.rippleTimer <= 0) {
        this.rippleActive = false;
        this.rippleMaterial.opacity = 0;
      }
    }

    // 4. Movement Logic (Click-to-Move or WASD)
    let moveX = 0;
    let moveZ = 0;

    if (this.targetDestination) {
      const dx = this.targetDestination.x - this.position.x;
      const dz = this.targetDestination.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.35) {
        moveX = dx / dist;
        moveZ = dz / dist;
        this.isMoving = true;
      } else {
        this.targetDestination = null;
        this.isMoving = false;
      }
    } else {
      const mx = this.input.state.moveX;
      const mz = this.input.state.moveZ;
      if (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05) {
        this.isSitting = false;
        // Direction relative to camera yaw
        const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
        const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
        const dir = new THREE.Vector3()
          .addScaledVector(forward, -mz)
          .addScaledVector(right, mx)
          .normalize();
        moveX = dir.x;
        moveZ = dir.z;
        this.isMoving = true;
      } else {
        this.isMoving = false;
      }
    }

    if (this.isMoving && !this.isSitting) {
      // 4-Way Direction
      if (Math.abs(moveX) > Math.abs(moveZ) * 1.1) {
        this.direction = moveX > 0 ? 'right' : 'left';
      } else {
        this.direction = moveZ > 0 ? 'down' : 'up';
      }

      const targetSpeed = this.input.state.isSprinting ? this.runSpeed : this.walkSpeed;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, delta * 14);

      const targetX = this.position.x + moveX * this.currentSpeed * delta;
      const targetZ = this.position.z + moveZ * this.currentSpeed * delta;

      const resolved = this.townMap.resolveCollision(this.position.x, this.position.z, targetX, targetZ, 0.45);
      this.position.x = resolved.x;
      this.position.z = resolved.z;

      // Animate walk frames
      this.animTimer += delta * (this.input.state.isSprinting ? 12 : 8);
      const walkFrames = [1, 0, 3, 0];
      this.frameIndex = walkFrames[Math.floor(this.animTimer) % 4];
    } else {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * 16);
      this.frameIndex = this.isSitting ? 4 : 0; // Frame 4 is Sitting pose!
      this.animTimer = 0;
    }

    // Update sprite texture
    const newTex = PixelSpriteSheet.getTexture(this.direction, this.frameIndex);
    if (this.spriteMaterial.map !== newTex) {
      this.spriteMaterial.map = newTex;
      this.spriteMaterial.needsUpdate = true;
    }

    this.mesh.position.copy(this.position);

    // 5. Update RO1 Camera
    this.updateCamera(delta);
  }

  private updateCamera(delta: number): void {
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const camX = this.position.x + this.cameraDistance * cosPitch * sinYaw;
    const camY = this.position.y + this.cameraDistance * sinPitch;
    const camZ = this.position.z + this.cameraDistance * cosPitch * cosYaw;

    const desiredPos = new THREE.Vector3(camX, Math.max(1.5, camY), camZ);
    this.camera.position.lerp(desiredPos, Math.min(1.0, delta * 10));
    this.camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);
  }
}

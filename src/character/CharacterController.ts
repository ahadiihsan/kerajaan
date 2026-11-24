import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { InputManager } from './InputManager';
import { TownMap } from '../map/TownMap';
import { PixelSpriteSheet, SpriteDirection, CharacterLayerTextures } from './PixelSpriteSheet';

export class CharacterController implements Updatable {
  public mesh: THREE.Group;
  public camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private townMap: TownMap;

  // 2.5D Multi-Layered Volumetric Relief Avatar
  private spriteGroup!: THREE.Group;
  private backMesh!: THREE.Mesh;
  private midMesh!: THREE.Mesh;
  private frontMesh!: THREE.Mesh;

  private backMaterial!: THREE.MeshStandardMaterial;
  private midMaterial!: THREE.MeshStandardMaterial;
  private frontMaterial!: THREE.MeshStandardMaterial;

  private shadowDisc!: THREE.Mesh;
  private nametagSprite!: THREE.Sprite;

  // RO1 Click Ground Target Ripple
  private rippleMesh!: THREE.Mesh;
  private rippleMaterial!: THREE.MeshBasicMaterial;
  private rippleTimer: number = 0;
  private rippleActive: boolean = false;

  private targetDestination: THREE.Vector3 | null = null;
  public isSitting: boolean = false;

  private direction: SpriteDirection = 'down';
  private frameIndex: number = 0;
  private animTimer: number = 0;
  private isMoving: boolean = false;

  public walkSpeed: number = 5.4;
  public runSpeed: number = 8.5;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  private currentSpeed: number = 0;

  public cameraDistance: number = 12.0;
  public cameraYaw: number = 0;
  public readonly cameraPitch: number = 0.65; // Fixed RO1 isometric elevation angle (vertical tilt disabled)
  public facingAngle: number = 0; // World facing angle (0 = South / +Z)

  constructor(camera: THREE.PerspectiveCamera, input: InputManager, townMap: TownMap) {
    this.camera = camera;
    this.input = input;
    this.townMap = townMap;

    this.mesh = new THREE.Group();
    this.mesh.name = 'RO1VolumetricPlayer';
    this.build2Point5DVolumetricAvatar();
    this.buildFloatingNametag();
    this.buildClickTargetRipple();
    this.mesh.position.copy(this.position);
  }

  /**
   * Builds the 2.5D Multi-Layered Relief Avatar with physical thickness,
   * directional shadow casting, and dynamic PBR lighting.
   */
  private build2Point5DVolumetricAvatar(): void {
    // 1. Soft Ambient Contact Drop-Shadow with Radial Falloff
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(15, 12, 10, 0.65)');
    grad.addColorStop(0.5, 'rgba(15, 12, 10, 0.35)');
    grad.addColorStop(1, 'rgba(15, 12, 10, 0.0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1.2, 0.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.position.y = 0.02;
    this.mesh.add(this.shadowDisc);

    // 2. Sprite Anchor Group (Standing strictly upright in world Y, matching RO1)
    this.spriteGroup = new THREE.Group();
    this.spriteGroup.rotation.order = 'YXZ';
    this.spriteGroup.rotation.y = 0;
    this.spriteGroup.rotation.x = 0;
    this.mesh.add(this.spriteGroup);

    // Geometry for 2.5D layers (anchored at feet, standing vertical)
    const layerGeo = new THREE.PlaneGeometry(1.75, 2.4);
    layerGeo.translate(0, 1.2, 0);

    // Set vertex normals facing slightly upward and forward to catch warm sunlight
    const normals = layerGeo.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, 0, 0.35, 0.93);
    }
    normals.needsUpdate = true;

    const initialLayers: CharacterLayerTextures = PixelSpriteSheet.getLayers('down', 0);

    // Standard material helper with vivid self-illumination base + dynamic sunlight response
    const createMat = (map: THREE.Texture) => {
      return new THREE.MeshStandardMaterial({
        map: map,
        emissiveMap: map,
        emissive: new THREE.Color(0xa5a5a5),
        emissiveIntensity: 0.65,
        roughness: 0.5,
        metalness: 0.15,
        transparent: true,
        alphaTest: 0.12,
        side: THREE.DoubleSide
      });
    };

    // Layer 1: Back (Cape & Scabbard at Z = -0.10)
    this.backMaterial = createMat(initialLayers.back);
    this.backMesh = new THREE.Mesh(layerGeo, this.backMaterial);
    this.backMesh.position.z = -0.10;
    this.spriteGroup.add(this.backMesh);

    // Layer 2: Mid (Torso, Arms, Boots at Z = 0.0)
    this.midMaterial = createMat(initialLayers.mid);
    this.midMesh = new THREE.Mesh(layerGeo, this.midMaterial);
    this.midMesh.position.z = 0.0;
    this.spriteGroup.add(this.midMesh);

    // Layer 3: Front (Headband, Face, Pauldrons, Front Sword at Z = +0.10)
    this.frontMaterial = createMat(initialLayers.front);
    this.frontMesh = new THREE.Mesh(layerGeo, this.frontMaterial);
    this.frontMesh.position.z = 0.10;
    this.spriteGroup.add(this.frontMesh);
  }

  private buildFloatingNametag(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Capsule background
    ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
    ctx.roundRect(16, 8, 224, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Name
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
  }

  public update(delta: number, _elapsed: number): void {
    this.input.update();

    if (this.mesh.parent && !this.rippleMesh.parent) {
      this.mesh.parent.add(this.rippleMesh);
    }

    // Camera Orbit: Horizontal yaw orbit only (vertical tilt disabled for authentic fixed RO1 isometric view)
    const { dx } = this.input.consumeLookDelta();
    this.cameraYaw -= dx;

    const zoom = this.input.consumeZoomDelta();
    this.cameraDistance = Math.max(8.0, Math.min(32.0, this.cameraDistance + zoom));

    // Sitting state
    if (this.input.state.toggleSit) {
      this.input.state.toggleSit = false;
      this.isSitting = !this.isSitting;
      this.targetDestination = null;
    }

    // Click target
    if (this.input.state.clickMoveTarget) {
      this.targetDestination = this.input.state.clickMoveTarget.clone();
      this.input.state.clickMoveTarget = null;
      this.isSitting = false;

      this.rippleMesh.position.set(this.targetDestination.x, 0.04, this.targetDestination.z);
      this.rippleMesh.scale.set(0.6, 0.6, 0.6);
      this.rippleMaterial.opacity = 1.0;
      this.rippleTimer = 0.45;
      this.rippleActive = true;
    }

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

    // Movement Logic
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
      // Calculate world-space facing orientation
      this.facingAngle = Math.atan2(moveX, moveZ);

      const targetSpeed = this.input.state.isSprinting ? this.runSpeed : this.walkSpeed;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, delta * 14);

      const targetX = this.position.x + moveX * this.currentSpeed * delta;
      const targetZ = this.position.z + moveZ * this.currentSpeed * delta;

      const resolved = this.townMap.resolveCollision(this.position.x, this.position.z, targetX, targetZ, 0.45);
      this.position.x = resolved.x;
      this.position.z = resolved.z;

      this.animTimer += delta * (this.input.state.isSprinting ? 12 : 8);
      const walkFrames = [1, 0, 3, 0];
      this.frameIndex = walkFrames[Math.floor(this.animTimer) % 4];
    } else {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * 16);
      this.frameIndex = this.isSitting ? 4 : 0;
      this.animTimer = 0;
    }

    // Classic Ragnarok Online Camera-Relative Billboarding:
    // Determine view direction relative to camera angle so orbiting shows 360° of character
    let relAngle = this.facingAngle - this.cameraYaw;
    relAngle = ((relAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    if (Math.abs(relAngle) <= Math.PI * 0.25) {
      this.direction = 'down'; // Facing toward camera
    } else if (Math.abs(relAngle) >= Math.PI * 0.75) {
      this.direction = 'up'; // Facing away from camera (back view)
    } else if (relAngle > 0) {
      this.direction = 'right'; // Facing camera right
    } else {
      this.direction = 'left'; // Facing camera left
    }

    // Authentic Ragnarok Online Cylindrical Billboarding:
    // Sprite quad stands vertically upright and turns around Y to face camera orbit
    this.spriteGroup.rotation.order = 'YXZ';
    this.spriteGroup.rotation.y = this.cameraYaw;
    this.spriteGroup.rotation.x = 0;

    // Update 3-Layer 2.5D Textures
    const newLayers = PixelSpriteSheet.getLayers(this.direction, this.frameIndex);
    if (this.backMaterial.map !== newLayers.back) {
      this.backMaterial.map = newLayers.back;
      this.backMaterial.needsUpdate = true;
    }
    if (this.midMaterial.map !== newLayers.mid) {
      this.midMaterial.map = newLayers.mid;
      this.midMaterial.needsUpdate = true;
    }
    if (this.frontMaterial.map !== newLayers.front) {
      this.frontMaterial.map = newLayers.front;
      this.frontMaterial.needsUpdate = true;
    }

    this.mesh.position.copy(this.position);

    // Update RO1 Camera
    this.updateCamera(delta);
  }

  public getCameraYaw(): number {
    return this.cameraYaw;
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

import * as THREE from 'three';
import { Updatable } from '../core/Engine';
import { InputManager } from './InputManager';
import { TownMap } from '../map/TownMap';

export class CharacterController implements Updatable {
  public mesh: THREE.Group;
  public camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private townMap: TownMap;

  // Avatar Limb References for Procedural Animation
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private capeMesh!: THREE.Mesh;
  private torsoGroup!: THREE.Group;

  // Animation cycle
  private animTimer: number = 0;
  private isMoving: boolean = false;

  // Movement parameters
  public walkSpeed: number = 4.2;
  public runSpeed: number = 8.0;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  private currentSpeed: number = 0;
  private targetRotation: number = 0;

  // Camera Orbit parameters
  public cameraDistance: number = 7.0;
  public cameraHeightOffset: number = 1.4;
  private cameraYaw: number = 0; // Horizontal orbit angle (radians)
  private cameraPitch: number = 0.35; // Vertical orbit angle (~20 degrees)
  private minPitch: number = -0.15;
  private maxPitch: number = 1.25;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager, townMap: TownMap) {
    this.camera = camera;
    this.input = input;
    this.townMap = townMap;

    this.mesh = new THREE.Group();
    this.mesh.name = 'PlayerAvatar';
    this.buildAvatarModel();
    this.mesh.position.copy(this.position);
  }

  /**
   * Build an expressive, stylized medieval adventurer avatar
   */
  private buildAvatarModel(): void {
    // Materials
    const tunicMat = new THREE.MeshStandardMaterial({ color: 0x2b4c7e, roughness: 0.7 }); // Deep royal blue tunic
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.8 }); // Brown leather
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x8a929a, metalness: 0.7, roughness: 0.3 }); // Iron armor accents
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a57b, roughness: 0.6 });
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x852424, roughness: 0.75, side: THREE.DoubleSide }); // Crimson cape
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });

    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 0.85;

    // Torso (Tunic + Iron Pauldrons)
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.35), tunicMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Leather Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.38), leatherMat);
    belt.position.y = -0.25;
    belt.castShadow = true;
    this.torsoGroup.add(belt);

    // Gold/Iron Buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.4), ironMat);
    buckle.position.set(0, -0.25, 0.01);
    this.torsoGroup.add(buckle);

    // Head + Traveler Hood
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.52, 0);

    const face = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
    face.castShadow = true;
    headGroup.add(face);

    // Medieval Hood / Helmet
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), tunicMat);
    hood.position.set(0, 0.04, -0.04);
    hood.castShadow = true;
    headGroup.add(hood);

    // Hood Feather / Crest
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), ironMat);
    feather.position.set(0.18, 0.25, -0.05);
    feather.rotation.z = -0.4;
    headGroup.add(feather);

    this.torsoGroup.add(headGroup);

    // Pauldrons (Shoulder guards)
    const pauldronGeo = new THREE.BoxGeometry(0.18, 0.14, 0.38);
    const pauldronL = new THREE.Mesh(pauldronGeo, ironMat);
    pauldronL.position.set(-0.35, 0.28, 0);
    pauldronL.castShadow = true;
    this.torsoGroup.add(pauldronL);

    const pauldronR = new THREE.Mesh(pauldronGeo, ironMat);
    pauldronR.position.set(0.35, 0.28, 0);
    pauldronR.castShadow = true;
    this.torsoGroup.add(pauldronR);

    // Cape
    const capeGeo = new THREE.PlaneGeometry(0.48, 0.95, 4, 4);
    capeGeo.translate(0, -0.45, 0);
    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 0.28, -0.2);
    this.capeMesh.castShadow = true;
    this.torsoGroup.add(this.capeMesh);

    this.mesh.add(this.torsoGroup);

    // Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.38, 1.1, 0);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), tunicMat);
    lArmMesh.position.y = -0.25;
    lArmMesh.castShadow = true;
    this.leftArm.add(lArmMesh);
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.2), leatherMat);
    lGlove.position.y = -0.45;
    lGlove.castShadow = true;
    this.leftArm.add(lGlove);
    this.mesh.add(this.leftArm);

    // Right Arm (holding traveler walking staff / sword)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.38, 1.1, 0);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), tunicMat);
    rArmMesh.position.y = -0.25;
    rArmMesh.castShadow = true;
    this.rightArm.add(rArmMesh);
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.2), leatherMat);
    rGlove.position.y = -0.45;
    rGlove.castShadow = true;
    this.rightArm.add(rGlove);

    // Staff
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), woodMat);
    staff.position.set(0.08, -0.2, 0.25);
    staff.rotation.x = 0.3;
    staff.castShadow = true;
    this.rightArm.add(staff);
    this.mesh.add(this.rightArm);

    // Left Leg
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.55, 0);
    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), leatherMat);
    lLegMesh.position.y = -0.28;
    lLegMesh.castShadow = true;
    this.leftLeg.add(lLegMesh);
    this.mesh.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.55, 0);
    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), leatherMat);
    rLegMesh.position.y = -0.28;
    rLegMesh.castShadow = true;
    this.rightLeg.add(rLegMesh);
    this.mesh.add(this.rightLeg);
  }

  public update(delta: number, elapsed: number): void {
    this.input.update();

    // 1. Process Camera Look Orbit
    const { dx, dy } = this.input.consumeLookDelta();
    this.cameraYaw -= dx;
    this.cameraPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.cameraPitch + dy));

    // 2. Process Zoom
    const zoom = this.input.consumeZoomDelta();
    this.cameraDistance = Math.max(3.5, Math.min(15.0, this.cameraDistance + zoom));

    // 3. Movement Direction (relative to Camera Yaw)
    const mx = this.input.state.moveX;
    const mz = this.input.state.moveZ;
    const moveMagnitude = Math.sqrt(mx * mx + mz * mz);

    this.isMoving = moveMagnitude > 0.05;

    if (this.isMoving) {
      // Calculate movement vector aligned with camera horizontal direction
      const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, -mz)
        .addScaledVector(right, mx)
        .normalize();

      const speedTarget = this.input.state.isSprinting ? this.runSpeed : this.walkSpeed;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, speedTarget * moveMagnitude, delta * 12);

      const targetX = this.position.x + moveDir.x * this.currentSpeed * delta;
      const targetZ = this.position.z + moveDir.z * this.currentSpeed * delta;

      // 4. Collision Resolution against Town Obstacles
      const resolved = this.townMap.resolveCollision(this.position.x, this.position.z, targetX, targetZ, 0.45);
      this.position.x = resolved.x;
      this.position.z = resolved.z;

      // 5. Rotate Avatar towards Move Direction smoothly
      this.targetRotation = Math.atan2(moveDir.x, moveDir.z);
    } else {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * 14);
    }

    // Smooth Avatar Rotation
    const diff = (this.targetRotation - this.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.mesh.rotation.y += diff * Math.min(1.0, delta * 15);

    // Apply Position to Mesh
    this.mesh.position.copy(this.position);

    // 6. Update Procedural Limb & Cape Animations
    this.animateAvatar(delta, elapsed);

    // 7. Update Trailing Camera Position
    this.updateCamera(delta);
  }

  private animateAvatar(delta: number, elapsed: number): void {
    if (this.isMoving) {
      const animFreq = this.input.state.isSprinting ? 14 : 9;
      this.animTimer += delta * animFreq;

      const swing = Math.sin(this.animTimer) * (this.input.state.isSprinting ? 0.75 : 0.5);

      // Legs swing in opposite phases
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;

      // Arms swing in opposition to legs
      this.leftArm.rotation.x = -swing * 0.8;
      this.rightArm.rotation.x = swing * 0.6;

      // Torso vertical bounce
      this.torsoGroup.position.y = 0.85 + Math.abs(Math.sin(this.animTimer)) * 0.06;

      // Cape sways back based on forward velocity
      const capeTilt = THREE.MathUtils.degToRad(20 + (this.currentSpeed / this.runSpeed) * 35);
      this.capeMesh.rotation.x = capeTilt + Math.sin(this.animTimer * 1.5) * 0.12;
    } else {
      // Idle Breathing & subtle cape sway in the breeze
      const breathe = Math.sin(elapsed * 2.5) * 0.02;
      this.torsoGroup.position.y = 0.85 + breathe;

      // Slowly reset limb angles to zero
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 10);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 10);

      // Gentle breeze cape flap
      this.capeMesh.rotation.x = THREE.MathUtils.degToRad(8) + Math.sin(elapsed * 3.5) * 0.05;
    }
  }

  private updateCamera(delta: number): void {
    // Target position is character's chest/head
    const target = new THREE.Vector3(
      this.position.x,
      this.position.y + this.cameraHeightOffset,
      this.position.z
    );

    // Calculate spherical camera offset
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const camX = target.x + this.cameraDistance * cosPitch * sinYaw;
    const camY = target.y + this.cameraDistance * sinPitch;
    const camZ = target.z + this.cameraDistance * cosPitch * cosYaw;

    const desiredCamPos = new THREE.Vector3(camX, Math.max(0.6, camY), camZ);

    // Smoothly interpolate camera position to eliminate shudder
    this.camera.position.lerp(desiredCamPos, Math.min(1.0, delta * 18));
    this.camera.lookAt(target);
  }
}

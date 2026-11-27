import * as THREE from 'three';
import { AxeSprite } from './AxeSprite';
import { BowSprite } from './BowSprite';
import { ArrowSprite } from './ArrowSprite';
import { playerActionFrame, type PlayerPose } from './PlayerSheet';

export interface ToolAppearance {
  woodColor: number;
  metalColor: number;
  scale: number;
}

export type ToolKind = 'axe' | 'bow' | 'rod' | 'arrow';

export const DEFAULT_TOOL_APPEARANCE: Record<ToolKind, ToolAppearance> = {
  axe: { woodColor: 0x9e6538, metalColor: 0xb9c5ce, scale: 1.25 },
  bow: { woodColor: 0xaf743d, metalColor: 0xe8d8ae, scale: 1 },
  rod: { woodColor: 0xa36634, metalColor: 0xe8d8ae, scale: 1 },
  arrow: { woodColor: 0x9e6538, metalColor: 0xb9c5ce, scale: 1 },
};

export class PlayerEquipment {
  public readonly axe = new THREE.Group();
  public readonly bow = new THREE.Group();
  public readonly nockedArrow = new THREE.Group();
  public readonly appearance = structuredClone(DEFAULT_TOOL_APPEARANCE);
  public readonly arrowWood = new THREE.MeshLambertMaterial({ color: this.appearance.arrow.woodColor });
  public readonly arrowMetal = new THREE.MeshLambertMaterial({ color: this.appearance.arrow.metalColor });
  private readonly axeSprite: AxeSprite;
  private readonly bowSprite: BowSprite;
  private readonly arrowSprite: ArrowSprite;
  private readonly drawHand = new THREE.Vector3();
  private readonly bowHandAnchor = new THREE.Vector3();
  private readonly viewForward = new THREE.Vector3();
  private readonly nock = new THREE.Vector3();
  private readonly rest = new THREE.Vector3();
  private readonly arrowDirection = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly planeNormal = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly arrowAxis = new THREE.Vector3(0, 0, 1);
  private viewCamera: THREE.Camera | undefined;
  private drawAmount = 0;
  private bowDrawing = false;
  private readonly topTip = new THREE.Vector3();
  private readonly bottomTip = new THREE.Vector3();
  private readonly restingString = new THREE.Vector3();
  private readonly stringPoints = new THREE.BufferAttribute(new Float32Array(9), 3);
  private readonly string = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', this.stringPoints),
    new THREE.LineBasicMaterial({ color: this.appearance.bow.metalColor }),
  );
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly direction = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly blade = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly axeBasis = new THREE.Matrix4();

  constructor(scene: THREE.Scene, onAssetReady?: () => void) {
    this.axeSprite = new AxeSprite(onAssetReady);
    this.axe.add(this.axeSprite);
    this.bowSprite = new BowSprite(onAssetReady, (top, bottom, camera) => {
      this.viewCamera = camera;
      this.topTip.copy(top); this.bow.worldToLocal(this.topTip);
      this.bottomTip.copy(bottom); this.bow.worldToLocal(this.bottomTip);
      this.stringPoints.setXYZ(0, this.bottomTip.x, this.bottomTip.y, this.bottomTip.z);
      this.stringPoints.setXYZ(2, this.topTip.x, this.topTip.y, this.topTip.z);
      if (!this.bowDrawing) {
        this.restingString.copy(this.topTip).lerp(this.bottomTip, 0.5);
        this.stringPoints.setXYZ(1, this.restingString.x, this.restingString.y, this.restingString.z);
      }
      if (this.bowDrawing) this.updateArrowRig(camera);
      this.stringPoints.needsUpdate = true;
    });
    this.bowSprite.beforePrepare = camera => this.positionBowForCamera(camera);
    this.string.frustumCulled = false;
    this.bow.add(this.bowSprite, this.string);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 5).rotateX(Math.PI / 2), this.arrowWood);
    this.arrowSprite = new ArrowSprite(onAssetReady);
    this.nockedArrow.add(shaft, this.arrowSprite);
    this.bow.add(this.nockedArrow);
    this.axe.visible = this.bow.visible = false;
    scene.add(this.axe, this.bow);
    const beforeRender = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      beforeRender.apply(scene, args);
      this.prepare(args[2]);
    };
  }

  public prepare(camera: THREE.Camera): void {
    this.bowSprite.prepare(camera);
    this.arrowSprite.prepare(camera);
  }

  public setAppearance(tool: ToolKind, values: Partial<ToolAppearance>): void {
    Object.assign(this.appearance[tool], values);
    this.axeSprite.setAppearance(this.appearance.axe);
    this.bowSprite.setAppearance(this.appearance.bow);
    this.arrowWood.color.setHex(this.appearance.arrow.woodColor);
    this.arrowMetal.color.setHex(this.appearance.arrow.metalColor);
    this.string.material.color.setHex(this.appearance.bow.metalColor);
  }

  public update(pose: PlayerPose, aim: THREE.Vector3, axeHand: THREE.Vector3, bowHand: THREE.Vector3, ready: boolean, axeSupport?: THREE.Vector3, bowDrawHand?: THREE.Vector3, palmGapActive = true): void {
    this.axe.visible = ready && pose.axeEquipped;
    this.bow.visible = ready && pose.bowEquipped;
    const yaw = Math.atan2(aim.x, aim.z);
    this.forward.set(aim.x, 0, aim.z);
    if (this.forward.lengthSq() < 0.0001) this.forward.set(0, 0, 1);
    this.forward.normalize();
    const time = pose.chopTime;
    const angle = time === null || time >= 0.66 ? 0.15
      : time < 0.08 ? 0.15 - time / 0.08 * 0.45
        : time < 0.32 ? -0.3 - (time - 0.08) / 0.24 * 0.35
          : time < 0.54 ? 1.35
            : 1.35 - (time - 0.54) / 0.12 * 1.2;
    this.axe.position.copy(axeHand).lerp(axeSupport ?? axeHand, 0.5).addScaledVector(this.forward, 0.06);
    this.axe.scale.setScalar(this.appearance.axe.scale);
    this.direction.copy(this.forward).multiplyScalar(Math.sin(angle)).addScaledVector(this.up, Math.cos(angle));
    this.blade.copy(this.forward).multiplyScalar(Math.cos(angle)).addScaledVector(this.up, -Math.sin(angle));
    this.side.crossVectors(this.blade, this.direction).normalize();
    this.axe.quaternion.setFromRotationMatrix(this.axeBasis.makeBasis(this.blade, this.direction, this.side));
    this.axeSprite.setFacing(this.forward);
    this.bowHandAnchor.copy(bowHand);
    this.bow.position.copy(bowHand);
    this.bow.rotation.set(0, yaw, 0);
    this.bow.scale.setScalar(this.appearance.bow.scale);
    this.bowSprite.setFacing(this.forward);
    this.bowSprite.setGripFrame(playerActionFrame(pose)?.column ?? 0, palmGapActive);
    const drawing = pose.shotTime < 0.24;
    this.bowDrawing = drawing;
    this.drawAmount = drawing ? Math.min(1, pose.shotTime / 0.18) : 0;
    this.drawHand.copy(bowDrawHand ?? bowHand).addScaledVector(this.forward, bowDrawHand ? 0 : -0.12 - this.drawAmount * 0.3);
    this.arrowSprite.setFacing(this.forward);
    if (this.viewCamera) this.positionBowForCamera(this.viewCamera);
    this.bow.updateMatrixWorld(true);
    this.nockedArrow.visible = drawing;
    this.updateArrowRig(this.viewCamera);
  }

  private positionBowForCamera(camera: THREE.Camera): void {
    this.bow.position.copy(this.bowHandAnchor);
    camera.getWorldDirection(this.viewForward);
    this.viewForward.y = 0; this.viewForward.normalize();
    const frontal = Math.abs(this.viewForward.dot(this.forward));
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      this.ray.subVectors(this.bowHandAnchor, this.cameraPosition).normalize();
    } else camera.getWorldDirection(this.ray);
    const incidence = this.forward.dot(this.ray);
    if (Math.abs(incidence) > 0.2) this.bow.position.addScaledVector(this.ray, 0.5 * frontal * frontal / incidence);
    this.bow.updateMatrixWorld(true);
  }

  public arrowRest(target = new THREE.Vector3()): THREE.Vector3 {
    this.bow.updateMatrixWorld(true);
    return this.bow.localToWorld(target.set(0, 0.09, 0));
  }

  private updateArrowRig(camera?: THREE.Camera): void {
    this.nock.copy(this.drawHand);
    this.arrowRest(this.rest);
    if (camera) {
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
        this.ray.subVectors(this.nock, this.cameraPosition).normalize();
      } else camera.getWorldDirection(this.ray);
      this.planeNormal.crossVectors(this.forward, this.up).normalize();
      const incidence = this.planeNormal.dot(this.ray);
      if (Math.abs(incidence) > 0.1) {
        const distance = this.planeNormal.dot(this.rest) - this.planeNormal.dot(this.nock);
        this.nock.addScaledVector(this.ray, distance / incidence);
      } else {
        const depth = this.forward.dot(this.ray);
        if (Math.abs(depth) > 0.1) {
          const pull = 0.12 + this.drawAmount * 0.23;
          const distance = this.forward.dot(this.rest) - pull - this.forward.dot(this.nock);
          this.nock.addScaledVector(this.ray, distance / depth);
        }
      }
    }
    this.bow.worldToLocal(this.nock);
    this.bow.worldToLocal(this.rest);
    this.arrowDirection.subVectors(this.rest, this.nock);
    if (this.arrowDirection.lengthSq() < 0.000001) this.arrowDirection.copy(this.arrowAxis);
    this.arrowDirection.normalize();
    const ratio = this.appearance.arrow.scale / this.appearance.bow.scale;
    const length = Math.max(1.2 * ratio, this.nock.distanceTo(this.rest) + 0.1 * ratio);
    const stretch = length / 0.73;
    this.nockedArrow.quaternion.setFromUnitVectors(this.arrowAxis, this.arrowDirection);
    this.nockedArrow.scale.set(ratio, ratio, stretch);
    this.nockedArrow.position.copy(this.nock).addScaledVector(this.arrowDirection, 0.31 * stretch);
    this.nockedArrow.updateMatrixWorld(true);
    this.stringPoints.setXYZ(1, this.nock.x, this.nock.y, this.nock.z);
    this.stringPoints.needsUpdate = true;
  }
}

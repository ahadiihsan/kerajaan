import * as THREE from 'three';
import { AxeSprite } from './AxeSprite';
import type { PlayerPose } from './PlayerSheet';

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
  private readonly bowWood = new THREE.MeshLambertMaterial({ color: this.appearance.bow.woodColor });
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
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.4, -0.12), new THREE.Vector3(0, -0.27, 0.025),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.27, 0.025), new THREE.Vector3(0, 0.4, -0.12),
    ]);
    this.bow.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 5, false), this.bowWood), this.string);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 5).rotateX(Math.PI / 2), this.arrowWood);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4).rotateX(Math.PI / 2), this.arrowMetal);
    tip.position.z = 0.36;
    this.nockedArrow.add(shaft, tip);
    this.bow.add(this.nockedArrow);
    this.axe.visible = this.bow.visible = false;
    scene.add(this.axe, this.bow);
  }

  public setAppearance(tool: ToolKind, values: Partial<ToolAppearance>): void {
    Object.assign(this.appearance[tool], values);
    this.axeSprite.setAppearance(this.appearance.axe);
    this.bowWood.color.setHex(this.appearance.bow.woodColor);
    this.arrowWood.color.setHex(this.appearance.arrow.woodColor);
    this.arrowMetal.color.setHex(this.appearance.arrow.metalColor);
    this.string.material.color.setHex(this.appearance.bow.metalColor);
  }

  public update(pose: PlayerPose, aim: THREE.Vector3, axeHand: THREE.Vector3, bowHand: THREE.Vector3, ready: boolean, axeSupport?: THREE.Vector3, bowDrawHand?: THREE.Vector3): void {
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
    this.bow.position.copy(bowHand);
    this.bow.rotation.set(0, yaw, 0);
    this.bow.scale.setScalar(this.appearance.bow.scale);
    const drawing = pose.shotTime < 0.24;
    const draw = drawing ? Math.min(1, pose.shotTime / 0.18) : 0;
    this.bow.updateMatrixWorld(true);
    const stringHand = drawing && bowDrawHand
      ? this.bow.worldToLocal(bowDrawHand.clone())
      : new THREE.Vector3(0, 0, -0.12 - draw * 0.3);
    this.stringPoints.setXYZ(0, 0, -0.4, -0.12);
    this.stringPoints.setXYZ(1, stringHand.x, stringHand.y, stringHand.z);
    this.stringPoints.setXYZ(2, 0, 0.4, -0.12);
    this.stringPoints.needsUpdate = true;
    this.nockedArrow.visible = drawing;
    this.nockedArrow.scale.setScalar(this.appearance.arrow.scale / this.appearance.bow.scale);
    this.nockedArrow.position.copy(stringHand);
    this.nockedArrow.position.z += 0.31 * this.appearance.arrow.scale / this.appearance.bow.scale;
  }
}

import * as THREE from 'three';
import type { PlayerPose } from './PlayerSheet';

export interface ToolAppearance {
  woodColor: number;
  metalColor: number;
  scale: number;
}

export type ToolKind = 'axe' | 'bow' | 'rod' | 'arrow';

export const DEFAULT_TOOL_APPEARANCE: Record<ToolKind, ToolAppearance> = {
  axe: { woodColor: 0x9e6538, metalColor: 0xb9c5ce, scale: 1 },
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
  private readonly axeWood = new THREE.MeshLambertMaterial({ color: this.appearance.axe.woodColor });
  private readonly axeMetal = new THREE.MeshLambertMaterial({ color: this.appearance.axe.metalColor });
  private readonly bowWood = new THREE.MeshLambertMaterial({ color: this.appearance.bow.woodColor });
  private readonly stringPoints = new THREE.BufferAttribute(new Float32Array(9), 3);
  private readonly string = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', this.stringPoints),
    new THREE.LineBasicMaterial({ color: this.appearance.bow.metalColor }),
  );
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly direction = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, 0.73, 6), this.axeWood);
    handle.position.y = 0.12;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.19, 0.055), this.axeMetal);
    blade.position.set(0.1, 0.43, 0);
    this.axe.add(handle, blade);
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
    this.axeWood.color.setHex(this.appearance.axe.woodColor);
    this.axeMetal.color.setHex(this.appearance.axe.metalColor);
    this.bowWood.color.setHex(this.appearance.bow.woodColor);
    this.arrowWood.color.setHex(this.appearance.arrow.woodColor);
    this.arrowMetal.color.setHex(this.appearance.arrow.metalColor);
    this.string.material.color.setHex(this.appearance.bow.metalColor);
  }

  public update(pose: PlayerPose, aim: THREE.Vector3, axeHand: THREE.Vector3, bowHand: THREE.Vector3, ready: boolean, axeSupport?: THREE.Vector3, bowDrawHand?: THREE.Vector3): void {
    this.axe.visible = ready && pose.axeEquipped;
    this.bow.visible = ready && pose.bowEquipped;
    const yaw = Math.atan2(aim.x, aim.z);
    const twoHanded = pose.chopTime !== null && pose.chopTime >= 0.08 && pose.chopTime < 0.66;
    this.axe.position.copy(twoHanded ? axeHand : axeSupport ?? axeHand);
    this.axe.scale.setScalar(this.appearance.axe.scale);
    this.axe.rotation.set(0, yaw, 0);
    this.direction.copy(axeSupport ?? axeHand).sub(axeHand);
    if (!twoHanded) this.direction.copy(this.up);
    if (this.direction.lengthSq() < 0.0001) this.direction.copy(this.up);
    this.axe.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
    this.axe.rotateY(yaw);
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

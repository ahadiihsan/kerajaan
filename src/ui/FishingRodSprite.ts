import * as THREE from 'three';
import type { ToolAppearance } from '../entities/PlayerEquipment';

const spriteUrl = new URL('../assets/items/fishing-rod-v1.png', import.meta.url).href;
const DEFAULT_WOOD = new THREE.Color(0xa36634);
const ART_WIDTH = 139;
const ART_HEIGHT = 2113;
const GRIP_TO_TIP = 2009;

export class FishingRodSprite extends THREE.Sprite {
  private readonly tip = new THREE.Vector3(0, 1, 0);
  private readonly projectedHand = new THREE.Vector3();
  private readonly projectedTip = new THREE.Vector3();
  private readonly viewHand = new THREE.Vector3();
  private length = 1;

  constructor(texture?: THREE.Texture, onReady?: () => void) {
    const map = texture ?? new THREE.TextureLoader().load(spriteUrl, () => onReady?.());
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.repeat.set(ART_WIDTH / 724, ART_HEIGHT / 2172);
    map.offset.set(326 / 724, 29 / 2172);
    super(new THREE.SpriteMaterial({ map, alphaTest: 0.5, depthWrite: true }));
    this.name = 'fishing-rod-sprite';
    this.center.set(35 / ART_WIDTH, 103 / ART_HEIGHT);
    this.onBeforeRender = (_renderer, _scene, camera) => {
      this.projectedHand.copy(this.position).project(camera);
      this.projectedTip.copy(this.tip).project(camera);
      this.viewHand.copy(this.position).applyMatrix4(camera.matrixWorldInverse);
      const distance = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? -this.viewHand.z : 1;
      const dx = (this.projectedTip.x - this.projectedHand.x) * distance / camera.projectionMatrix.elements[0];
      const dy = (this.projectedTip.y - this.projectedHand.y) * distance / camera.projectionMatrix.elements[5];
      this.material.rotation = Math.atan2(-dx, dy);
      this.scale.set(
        this.length * ART_WIDTH / GRIP_TO_TIP * 2.25,
        Math.hypot(dx, dy) * ART_HEIGHT / GRIP_TO_TIP,
        1,
      );
      this.updateMatrixWorld(true);
    };
  }

  update(hand: THREE.Vector3, tip: THREE.Vector3, appearance: ToolAppearance): void {
    this.position.copy(hand);
    this.tip.copy(tip);
    this.length = tip.distanceTo(hand);
    const color = new THREE.Color(appearance.woodColor);
    this.material.color.setRGB(color.r / DEFAULT_WOOD.r, color.g / DEFAULT_WOOD.g, color.b / DEFAULT_WOOD.b);
  }
}

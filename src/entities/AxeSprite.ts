import * as THREE from 'three';
import type { ToolAppearance } from './PlayerEquipment';
import atlas from '../assets/items/axe-directions-v3.json';
import { playerSheetRow } from './PlayerSheet';

export const AXE_SPRITE_URL = new URL('../assets/items/axe-directions-v3.png', import.meta.url).href;

export class AxeSprite extends THREE.Sprite {
  private readonly anchor = new THREE.Vector3();
  private readonly head = new THREE.Vector3();
  private readonly facing = new THREE.Vector3(0, 0, 1);
  public viewRow = 0;
  private readonly worldAnchor = new THREE.Vector3();
  private readonly viewAnchor = new THREE.Vector3();
  private readonly parentScale = new THREE.Vector3();
  private readonly tint = {
    axeWoodTint: { value: new THREE.Color(1, 1, 1) },
    axeMetalTint: { value: new THREE.Color(1, 1, 1) },
    axeCameraWorld: { value: new THREE.Matrix4() },
    axeViewProjection: { value: new THREE.Matrix4() },
    axePlaneNormal: { value: new THREE.Vector3() },
    axePlanePoint: { value: new THREE.Vector3() },
    axeViewDirection: { value: new THREE.Vector3() },
    axeCameraPosition: { value: new THREE.Vector3() },
    axePerspective: { value: false },
  };

  constructor(onReady?: () => void) {
    const map = typeof document === 'undefined' ? new THREE.Texture() : new THREE.TextureLoader().load(AXE_SPRITE_URL, () => onReady?.());
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({ map, alphaTest: 0.5, depthWrite: true });
    super(material);
    this.name = 'axe-sprite';

    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.tint);
      shader.vertexShader = 'uniform mat4 axeCameraWorld;\nvarying vec3 axeWorldPoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;', 'axeWorldPoint = (axeCameraWorld * mvPosition).xyz;\ngl_Position = projectionMatrix * mvPosition;');
      shader.fragmentShader = `uniform vec3 axeWoodTint;
        uniform vec3 axeMetalTint;
        uniform mat4 axeViewProjection;
        uniform vec3 axePlaneNormal;
        uniform vec3 axePlanePoint;
        uniform vec3 axeViewDirection;
        uniform vec3 axeCameraPosition;
        uniform bool axePerspective;
        varying vec3 axeWorldPoint;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float wood = step(diffuseColor.b * 1.15, diffuseColor.r);
        diffuseColor.rgb *= mix(axeMetalTint, axeWoodTint, wood);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        vec3 rayDirection = axePerspective ? normalize(axeWorldPoint - axeCameraPosition) : axeViewDirection;
        float incidence = dot(axePlaneNormal, rayDirection);
        gl_FragDepth = gl_FragCoord.z;
        if (abs(incidence) > 0.001) {
          vec3 surface = axeWorldPoint + rayDirection * dot(axePlanePoint - axeWorldPoint, axePlaneNormal) / incidence;
          vec4 clip = axeViewProjection * vec4(surface, 1.0);
          gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
        }`);
    };
    this.onBeforeRender = (_renderer, _scene, camera) => {
      if (!this.parent) return;
      this.parent.updateWorldMatrix(true, false);
      this.worldAnchor.set(0, 0, 0).applyMatrix4(this.parent.matrixWorld);
      this.tint.axeCameraWorld.value.copy(camera.matrixWorld);
      this.tint.axeViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      camera.getWorldDirection(this.tint.axeViewDirection.value);
      this.tint.axePlaneNormal.value.copy(this.tint.axeViewDirection.value).setY(0).normalize();
      this.tint.axePlanePoint.value.copy(this.worldAnchor);
      this.tint.axeCameraPosition.value.setFromMatrixPosition(camera.matrixWorld);
      this.tint.axePerspective.value = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
      this.anchor.copy(this.worldAnchor).project(camera);
      this.head.set(0, 0.43, 0).applyMatrix4(this.parent.matrixWorld).project(camera);

      this.viewAnchor.copy(this.worldAnchor).applyMatrix4(camera.matrixWorldInverse);
      const distance = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? -this.viewAnchor.z : 1;
      const px = distance / camera.projectionMatrix.elements[0];
      const py = distance / camera.projectionMatrix.elements[5];
      const dx = (this.head.x - this.anchor.x) * px;
      const dy = (this.head.y - this.anchor.y) * py;
      const view = this.tint.axeViewDirection.value;
      const cameraYaw = Math.atan2(-view.x, -view.z);
      this.viewRow = playerSheetRow(this.facing.x, this.facing.z, cameraYaw);
      const frame = atlas.frames[this.viewRow];
      const gripToHead = frame.gripY - frame.headY;
      map.repeat.set(frame.width / atlas.width, frame.height / atlas.height);
      map.offset.set(frame.x / atlas.width, (atlas.height - frame.y - frame.height) / atlas.height);
      this.center.set(frame.gripX / frame.width, 1 - frame.gripY / frame.height);
      this.material.rotation = Math.atan2(-dx, dy);
      const parentScale = this.parent.getWorldScale(this.parentScale);
      this.scale.set(
        0.43 * frame.width / gripToHead,
        Math.hypot(dx, dy) * frame.height / gripToHead / parentScale.y,
        1,
      );
      this.updateMatrixWorld(true);
    };
  }

  setFacing(facing: THREE.Vector3): void {
    this.facing.copy(facing);
  }

  setAppearance(appearance: ToolAppearance): void {
    for (const [key, color, base] of [
      ['axeWoodTint', appearance.woodColor, 0x9e6538],
      ['axeMetalTint', appearance.metalColor, 0xb9c5ce],
    ] as const) {
      const tint = new THREE.Color(color), original = new THREE.Color(base);
      this.tint[key].value.setRGB(tint.r / original.r, tint.g / original.g, tint.b / original.b);
    }
  }
}

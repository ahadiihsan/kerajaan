import * as THREE from 'three';
import type { ToolAppearance } from './PlayerEquipment';
import atlas from '../assets/items/bow-directions-v1.json';
import gripGaps from '../assets/items/bow-grip-gaps.json';
import { playerSheetRow } from './PlayerSheet';

export const BOW_SPRITE_URL = new URL('../assets/items/bow-directions-v1.png', import.meta.url).href;

const WORLD_HEIGHT = 1.05;

export class BowSprite extends THREE.Sprite {
  private readonly anchor = new THREE.Vector3();
  private readonly head = new THREE.Vector3();
  private readonly facing = new THREE.Vector3(0, 0, 1);
  public viewRow = 0;
  private gripFrame = 0;
  private palmGapActive = true;
  public beforePrepare: ((camera: THREE.Camera) => void) | undefined;
  private readonly worldAnchor = new THREE.Vector3();
  private readonly viewAnchor = new THREE.Vector3();
  private readonly parentScale = new THREE.Vector3();
  private readonly tint = {
    bowWoodTint: { value: new THREE.Color(1, 1, 1) },
    bowMetalTint: { value: new THREE.Color(1, 1, 1) },
    bowCameraWorld: { value: new THREE.Matrix4() },
    bowViewProjection: { value: new THREE.Matrix4() },
    bowPlaneNormal: { value: new THREE.Vector3() },
    bowPlanePoint: { value: new THREE.Vector3() },
    bowViewDirection: { value: new THREE.Vector3() },
    bowCameraPosition: { value: new THREE.Vector3() },
    bowPerspective: { value: false },
    bowFrameWidth: { value: 0 },
    bowShape: { value: new THREE.Vector4() },
    bowGripGap: { value: new THREE.Vector2() },
  };

  private readonly topWorld = new THREE.Vector3();
  private readonly bottomWorld = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();

  constructor(onReady?: () => void, private readonly onTips?: (top: THREE.Vector3, bottom: THREE.Vector3, camera: THREE.Camera) => void) {
    const map = typeof document === 'undefined' ? new THREE.Texture() : new THREE.TextureLoader().load(BOW_SPRITE_URL, () => onReady?.());
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({ map, alphaTest: 0.5, depthWrite: true });
    super(material);
    this.name = 'bow-sprite';

    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.tint);
      shader.vertexShader = 'uniform mat4 bowCameraWorld;\nvarying vec3 bowWorldPoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;', 'bowWorldPoint = (bowCameraWorld * mvPosition).xyz;\ngl_Position = projectionMatrix * mvPosition;');
      shader.fragmentShader = `uniform vec3 bowWoodTint;
        uniform vec3 bowMetalTint;
        uniform mat4 bowViewProjection;
        uniform vec3 bowPlaneNormal;
        uniform vec3 bowPlanePoint;
        uniform vec3 bowViewDirection;
        uniform vec3 bowCameraPosition;
        uniform bool bowPerspective;
        uniform vec2 bowGripGap;
        uniform vec4 bowShape;
        uniform float bowFrameWidth;
        varying vec3 bowWorldPoint;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec2 bowSampleUv = vMapUv;
        float bend = clamp(abs(vMapUv.y - bowGripGap.x) / bowShape.w, 0.0, 1.0);
        bowSampleUv.x = bowShape.x + (vMapUv.x - bowShape.x) * bowShape.y - abs(bowShape.z) - bowShape.z * bend;
        if (bowSampleUv.x < bowShape.x || bowSampleUv.x > bowShape.x + bowFrameWidth) discard;
        ${THREE.ShaderChunk.map_fragment.replaceAll('vMapUv', 'bowSampleUv')}
        float wood = step(diffuseColor.b * 1.15, diffuseColor.r);
        diffuseColor.rgb *= mix(bowMetalTint, bowWoodTint, wood);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        #ifdef USE_MAP
          if (bowGripGap.y > 0.0 && abs(vMapUv.y - bowGripGap.x) < bowGripGap.y) discard;
        #endif
        vec3 rayDirection = bowPerspective ? normalize(bowWorldPoint - bowCameraPosition) : bowViewDirection;
        float incidence = dot(bowPlaneNormal, rayDirection);
        gl_FragDepth = gl_FragCoord.z;
        if (abs(incidence) > 0.001) {
          vec3 surface = bowWorldPoint + rayDirection * dot(bowPlanePoint - bowWorldPoint, bowPlaneNormal) / incidence;
          vec4 clip = bowViewProjection * vec4(surface, 1.0);
          gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
        }`);
    };
    this.onBeforeRender = (_renderer, _scene, camera) => this.prepare(camera, false);
  }

  public prepare(camera: THREE.Camera, updateRig = true): void {
    if (!this.parent) return;
    if (updateRig) this.beforePrepare?.(camera);
    this.parent.updateWorldMatrix(true, false);
    this.worldAnchor.set(0, 0, 0).applyMatrix4(this.parent.matrixWorld);
    this.tint.bowCameraWorld.value.copy(camera.matrixWorld);
    this.tint.bowViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    camera.getWorldDirection(this.tint.bowViewDirection.value);
    this.tint.bowPlaneNormal.value.copy(this.tint.bowViewDirection.value).setY(0).normalize();
    this.tint.bowPlanePoint.value.copy(this.worldAnchor);
    this.tint.bowCameraPosition.value.setFromMatrixPosition(camera.matrixWorld);
    this.tint.bowPerspective.value = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
    this.anchor.copy(this.worldAnchor).project(camera);
    this.head.set(0, 0.5, 0).applyMatrix4(this.parent.matrixWorld).project(camera);
    this.viewAnchor.copy(this.worldAnchor).applyMatrix4(camera.matrixWorldInverse);
    const distance = this.tint.bowPerspective.value ? -this.viewAnchor.z : 1;
    const dx = (this.head.x - this.anchor.x) * distance / camera.projectionMatrix.elements[0];
    const dy = (this.head.y - this.anchor.y) * distance / camera.projectionMatrix.elements[5];
    const view = this.tint.bowViewDirection.value;
    this.viewRow = playerSheetRow(this.facing.x, this.facing.z, Math.atan2(-view.x, -view.z));
    const frame = atlas.frames[this.viewRow];
    const map = this.material.map!;
    map.repeat.set(frame.width / atlas.width, frame.height / atlas.height);
    map.offset.set(frame.x / atlas.width, (atlas.height - frame.y - frame.height) / atlas.height);
    const inset = frame.tipInset ?? 0;
    const padding = Math.abs(inset);
    const width = frame.width + 2 * padding;
    this.tint.bowFrameWidth.value = frame.width / atlas.width;
    this.tint.bowShape.value.set(frame.x / atlas.width, width / frame.width, inset / atlas.width, frame.height / atlas.height * 0.44);
    this.center.set((frame.gripX + padding) / width, 1 - frame.gripY / frame.height);
    this.material.rotation = Math.atan2(-dx, dy);
    this.parent.getWorldScale(this.parentScale);
    const heights = gripGaps.palmHeights[String(this.viewRow) as keyof typeof gripGaps.palmHeights];
    const handHeight = heights && this.palmGapActive ? heights[this.gripFrame] * gripGaps.bodyWorldHeight / gripGaps.bodyPixelsPerCell : 0;
    this.tint.bowGripGap.value.set(
      (atlas.height - frame.y - frame.gripY) / atlas.height,
      handHeight / (2 * WORLD_HEIGHT * this.parentScale.y) * frame.height / atlas.height,
    );
    this.scale.set(WORLD_HEIGHT * width / frame.height, Math.hypot(dx, dy) * WORLD_HEIGHT / (0.5 * this.parentScale.y), 1);
    this.updateMatrixWorld(true);
    this.cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    this.cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    this.artPoint(frame.top, camera, this.topWorld);
    this.artPoint(frame.bottom, camera, this.bottomWorld);
    if (updateRig) this.onTips?.(this.topWorld, this.bottomWorld, camera);
  }

  private artPoint(point: number[], camera: THREE.Camera, result: THREE.Vector3): void {
    const frame = atlas.frames[this.viewRow];
    const inset = frame.tipInset ?? 0;
    const bend = Math.min(1, Math.abs(point[1] - frame.gripY) / (frame.height * 0.44));
    const x = (point[0] - frame.gripX + inset * bend) / (frame.width + 2 * Math.abs(inset)) * this.scale.x * this.parentScale.x;
    const y = (frame.gripY - point[1]) / frame.height * this.scale.y * this.parentScale.y;
    const rotation = this.material.rotation;
    result.copy(this.worldAnchor)
      .addScaledVector(this.cameraRight, Math.cos(rotation) * x - Math.sin(rotation) * y)
      .addScaledVector(this.cameraUp, Math.sin(rotation) * x + Math.cos(rotation) * y);
    this.ray.copy(this.tint.bowPerspective.value ? result : this.tint.bowViewDirection.value);
    if (this.tint.bowPerspective.value) this.ray.sub(this.tint.bowCameraPosition.value).normalize();
    const normal = this.tint.bowPlaneNormal.value;
    const incidence = normal.dot(this.ray);
    if (Math.abs(incidence) > 0.001) {
      const depth = normal.dot(this.worldAnchor) - normal.dot(result);
      result.addScaledVector(this.ray, depth / incidence);
    }
  }

  setFacing(facing: THREE.Vector3): void {
    this.facing.copy(facing);
  }

  setGripFrame(frame: number, active = true): void {
    this.palmGapActive = active;
    this.gripFrame = Math.max(0, Math.min(7, Math.floor(frame)));
  }

  setAppearance(appearance: ToolAppearance): void {
    for (const [key, color, base] of [
      ['bowWoodTint', appearance.woodColor, 0xaf743d],
      ['bowMetalTint', appearance.metalColor, 0xe8d8ae],
    ] as const) {
      const tint = new THREE.Color(color), original = new THREE.Color(base);
      this.tint[key].value.setRGB(tint.r / original.r, tint.g / original.g, tint.b / original.b);
    }
  }
}

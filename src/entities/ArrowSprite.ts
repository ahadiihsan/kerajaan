import * as THREE from 'three';
import atlas from '../assets/items/arrow-directions-v1.json';
import { playerSheetRow } from './PlayerSheet';

export const ARROW_SPRITE_URL = new URL('../assets/items/arrow-directions-v1.png', import.meta.url).href;

export class ArrowSprite extends THREE.Sprite {
  private readonly facing = new THREE.Vector3(0, 0, 1);
  private readonly nock = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly view = new THREE.Vector3();
  private readonly parentScale = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  public viewRow = 0;
  private readonly uniforms = { arrowStart: { value: new THREE.Vector3() }, arrowEnd: { value: new THREE.Vector3() } };

  constructor(onReady?: () => void) {
    const map = typeof document === 'undefined' ? new THREE.Texture() : new THREE.TextureLoader().load(ARROW_SPRITE_URL, () => onReady?.());
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    super(new THREE.SpriteMaterial({ map, alphaTest: 0.5, depthWrite: true }));
    this.name = 'arrow-sprite';
    this.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = 'varying vec2 arrowScreen;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;', 'gl_Position = projectionMatrix * mvPosition;\narrowScreen = gl_Position.xy / gl_Position.w;');
      shader.fragmentShader = 'varying vec2 arrowScreen;\nuniform vec3 arrowStart;\nuniform vec3 arrowEnd;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        vec2 span = arrowEnd.xy - arrowStart.xy;
        float along = clamp(dot(arrowScreen - arrowStart.xy, span) / max(dot(span, span), 0.000001), 0.0, 1.0);
        gl_FragDepth = mix(arrowStart.z, arrowEnd.z, along) * 0.5 + 0.5;`);
    };
    this.onBeforeRender = (_renderer, _scene, camera) => this.prepare(camera);
  }

  setFacing(facing: THREE.Vector3): void { this.facing.copy(facing); }

  prepare(camera: THREE.Camera): void {
    if (!this.parent) return;
    this.parent.updateWorldMatrix(true, false);
    this.nock.set(0, 0, -0.31).applyMatrix4(this.parent.matrixWorld);
    this.tip.set(0, 0, 0.42).applyMatrix4(this.parent.matrixWorld);
    camera.getWorldDirection(this.cameraDirection);
    this.viewRow = playerSheetRow(this.facing.x, this.facing.z, Math.atan2(-this.cameraDirection.x, -this.cameraDirection.z));
    const frame = atlas.frames[this.viewRow];
    const shortView = this.viewRow === 0 || this.viewRow === 4;
    const fraction = shortView ? frame.height / 472 : 1;
    this.start.copy(this.nock).lerp(this.tip, 1 - fraction);
    this.position.copy(this.start); this.parent.worldToLocal(this.position);
    this.start.project(camera); this.end.copy(this.tip).project(camera);
    this.uniforms.arrowStart.value.copy(this.start); this.uniforms.arrowEnd.value.copy(this.end);
    this.view.copy(this.tip).lerp(this.nock, fraction).applyMatrix4(camera.matrixWorldInverse);
    const distance = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? -this.view.z : 1;
    const dx = (this.end.x - this.start.x) * distance / camera.projectionMatrix.elements[0];
    const dy = (this.end.y - this.start.y) * distance / camera.projectionMatrix.elements[5];
    this.parent.getWorldScale(this.parentScale);
    const width = (shortView ? 0.09 : 0.075) * this.parentScale.x;
    const sourceX = (frame.tip[0] - frame.nock[0]) / frame.width * width;
    const sourceY = Math.sqrt(Math.max(0.000001, dx * dx + dy * dy - sourceX * sourceX));
    this.material.rotation = Math.atan2(-dx, dy) - Math.atan2(-sourceX, sourceY);
    this.center.set(frame.nock[0] / frame.width, 1 - frame.nock[1] / frame.height);
    this.scale.set(width / this.parentScale.x, sourceY * frame.height / (frame.nock[1] - frame.tip[1]) / this.parentScale.y, 1);
    this.material.map!.repeat.set(frame.width / atlas.width, frame.height / atlas.height);
    this.material.map!.offset.set(frame.x / atlas.width, (atlas.height - frame.y - frame.height) / atlas.height);
    this.updateMatrixWorld(true);
  }
}

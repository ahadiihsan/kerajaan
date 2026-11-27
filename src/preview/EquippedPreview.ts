import * as THREE from 'three';
import { PlayerEquipment } from '../entities/PlayerEquipment';
import { FishingVisuals } from '../ui/FishingVisuals';
import { playerHandDepth, type PlayerPose } from '../entities/PlayerSheet';
import grips from '../assets/characters/hand-grips.json';

type Action = keyof typeof grips;
export type PreviewItem = 'none' | 'axe' | 'bow' | 'rod';

export function inspectionPose(action: Action, frame: number): PlayerPose {
  const pose: PlayerPose = { chopTime: null, shotTime: 0.6, axeEquipped: action === 'chop', bowEquipped: action === 'bow', rodEquipped: action === 'fish', fishingPose: null, fishingElapsed: 0 };
  if (action === 'chop' && frame > 0) pose.chopTime = [0, 0.12, 0.20, 0.28, 0.36, 0.48, 0.59, 0.72][frame];
  if (action === 'bow') pose.shotTime = [0.6, 0.02, 0.09, 0.15, 0.18, 0.28, 0.39, 0.48][frame];
  if (action === 'fish') {
    pose.fishingPose = frame === 0 ? null : frame === 7 ? 'hold' : 'cast';
    pose.fishingElapsed = [0, 0, 0.14, 0.28, 0.42, 0.7, 1.4, 2][frame];
    pose.fishingReeling = frame === 6;
  }
  return pose;
}

export class EquippedPreview {
  private readonly renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  private readonly material = new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide });
  private readonly actionGeometry = new THREE.PlaneGeometry(2.8, 2.8).translate(0, 1.33, 0);
  private readonly walkGeometry = new THREE.PlaneGeometry(1.55, 1.55).translate(0, 0.775, 0);
  private readonly body = new THREE.Mesh(this.actionGeometry, this.material);
  private readonly equipment: PlayerEquipment;
  private readonly fishing: FishingVisuals;
  private readonly textures = new Map<Action, THREE.Texture>();
  private readonly aim = new THREE.Vector3();
  private readonly left = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3(1, 0, 0);

  constructor(onAssetReady?: () => void) {
    this.equipment = new PlayerEquipment(this.scene, onAssetReady);
    this.fishing = new FishingVisuals(this.scene, onAssetReady);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.body, new THREE.HemisphereLight(0xffffff, 0x8d9aaa, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 6, 5);
    this.scene.add(light);
  }

  private texture(action: Action, image: HTMLImageElement): THREE.Texture {
    let texture = this.textures.get(action);
    if (texture) return texture;
    let source: HTMLImageElement | HTMLCanvasElement = image;
    if (action === 'walk') {
      source = document.createElement('canvas'); source.width = source.height = 1280;
      const context = source.getContext('2d')!; context.imageSmoothingEnabled = false;
      for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
        const x = Math.round(column * image.width / 8), y = Math.round(row * image.height / 8);
        const width = Math.round((column + 1) * image.width / 8) - x;
        const height = Math.round((row + 1) * image.height / 8) - y;
        context.drawImage(image, x, y, width, height, column * 160 + 2, row * 160 + 2, 156, 156);
      }
    }
    texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.repeat.set(1 / (action === 'idle' ? 4 : 8), 1 / 8);
    texture.needsUpdate = true;
    this.textures.set(action, texture);
    return texture;
  }

  draw(canvas: HTMLCanvasElement, image: HTMLImageElement, action: Action, row: number, frame: number, item: PreviewItem, pose: PlayerPose, zoom: number, pitch: number, showGrips: boolean, showGuides: boolean) {
    const texture = this.texture(action, image);
    texture.offset.set(frame * texture.repeat.x, (7 - row) / 8);
    if (this.material.map !== texture) { this.material.map = texture; this.material.needsUpdate = true; }
    this.body.geometry = action === 'walk' ? this.walkGeometry : this.actionGeometry;
    const points = grips[action][row][frame];
    const depth = playerHandDepth(action, row);
    this.left.set(points.left[0], points.left[1], depth);
    this.right.set(points.right[0], points.right[1], depth);
    this.aim.set(Math.sin(row * Math.PI / 4), 0, Math.cos(row * Math.PI / 4));
    const equipped = { ...pose, axeEquipped: item === 'axe', bowEquipped: item === 'bow', rodEquipped: item === 'rod' };
    this.equipment.update(equipped, this.aim, this.left, this.left, true, this.right, this.right, action === 'bow');
    this.target.copy(this.aim).multiplyScalar(1.8);
    const cast = item === 'rod' && equipped.fishingPose === 'cast'
      ? { target: this.target, elapsed: equipped.fishingElapsed, biteAt: 1.3 } : null;
    this.fishing.update(this.origin, this.cameraRight, this.aim.x < 0 ? -1 : 1, item === 'rod', cast,
      item === 'rod' && equipped.fishingPose === 'hold' ? 0.36 : 0, '#ffffff', this.right, this.aim, this.equipment.appearance.rod);

    const halfHeight = (item === 'rod' ? 2.15 : 1.2) / zoom;
    this.camera.left = -halfHeight; this.camera.right = halfHeight;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    const angle = pitch * Math.PI / 180;
    this.camera.position.set(0, 0.95 + Math.sin(angle) * 10, Math.cos(angle) * 10);
    this.camera.lookAt(0, 0.95, 0);
    this.camera.updateMatrixWorld(true);
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.render(this.scene, this.camera);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.renderer.domElement, 0, 0);
    const project = (point: THREE.Vector3) => {
      const screen = point.clone().project(this.camera);
      return [(screen.x + 1) * canvas.width / 2, (1 - screen.y) * canvas.height / 2];
    };
    if (showGuides) {
      const [, floor] = project(this.origin);
      ctx.strokeStyle = '#91a6be66'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, floor); ctx.lineTo(canvas.width, floor); ctx.stroke();
    }
    if (showGrips) for (const [point, color] of [[this.left, '#39e9e0'], [this.right, '#ff9dcb']] as const) {
      const [x, y] = project(point);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#101820'; ctx.stroke();
    }
  }

  dispose() {
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose();
      }
    });
    for (const texture of this.textures.values()) texture.dispose();
    this.renderer.dispose();
  }
}

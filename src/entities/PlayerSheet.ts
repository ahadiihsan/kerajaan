import type { SpriteBundle } from './Sprites';
import * as THREE from 'three';
import handGrips from '../assets/characters/hand-grips.json';

const sheetUrl = new URL('../assets/characters/rowan-walk.png', import.meta.url).href;
const actionUrls = {
  chop: new URL('../assets/characters/rowan-chop-body.png', import.meta.url).href,
  bow: new URL('../assets/characters/rowan-bow-body.png', import.meta.url).href,
  fish: new URL('../assets/characters/rowan-fish-body.png', import.meta.url).href,
  idle: new URL('../assets/characters/rowan-idle.png', import.meta.url).href,
};

export interface PlayerPose {
  chopTime: number | null;
  shotTime: number;
  axeEquipped: boolean;
  bowEquipped: boolean;
  rodEquipped: boolean;
  fishingPose: 'cast' | 'hold' | null;
  fishingElapsed: number;
  fishingReeling?: boolean;
}

export function playerActionFrame(pose: PlayerPose): { action: 'chop' | 'bow' | 'fish'; column: number } | null {
  if (pose.chopTime !== null) {
    const time = pose.chopTime;
    const column = time < 0.32 ? Math.min(3, Math.floor(time / 0.08))
      : time < 0.54 ? 4 + Math.min(1, Math.floor((time - 0.32) / 0.11))
        : 6 + Math.min(1, Math.floor((time - 0.54) / 0.12));
    return { action: 'chop', column };
  }
  if (pose.bowEquipped) {
    const time = pose.shotTime;
    return { action: 'bow', column: time >= 0.52 ? 0 : time < 0.06 ? 1 : time < 0.12 ? 2 : time < 0.24 ? 4 : time < 0.35 ? 5 : time < 0.44 ? 6 : 7 };
  }
  if (pose.rodEquipped) {
    return { action: 'fish', column: pose.fishingPose === 'hold' ? 7 : pose.fishingPose === 'cast'
      ? pose.fishingElapsed < 0.55 ? Math.min(4, 1 + Math.floor(pose.fishingElapsed / 0.1375)) : pose.fishingReeling ? 6 : 5 : 0 };
  }
  return pose.axeEquipped ? { action: 'chop', column: 0 } : null;
}

export function playerSheetRow(dx: number, dz: number, cameraYaw: number): number {
  const right = dx * Math.cos(cameraYaw) - dz * Math.sin(cameraYaw);
  const down = dx * Math.sin(cameraYaw) + dz * Math.cos(cameraYaw);
  return (Math.round(Math.atan2(right, down) / (Math.PI / 4)) + 8) % 8;
}

export function playerHandDepth(sheet: keyof typeof handGrips, row: number): number {
  if (sheet === 'bow' && (row === 5 || row === 6 || row === 7)) return 0;
  return Math.cos(row * Math.PI / 4) < -0.3 ? -0.045 : 0.045;
}

export class PlayerSheet {
  private loaded = false;
  private readonly maps: Partial<Record<keyof typeof actionUrls, THREE.Texture>> = {};
  private readonly actionGeometry = new THREE.PlaneGeometry(2.8, 2.8).translate(0, 1.33, 0);
  private walkGeometry: THREE.BufferGeometry | null = null;
  private currentRow = 0;
  private currentColumn = 0;
  private currentAction: 'chop' | 'bow' | 'fish' | null = null;
  private currentSheet: keyof typeof handGrips = 'idle';

  public get ready(): boolean {
    return this.loaded;
  }

  public get bowPoseReady(): boolean {
    return this.loaded && this.currentSheet === 'bow';
  }

  public handSocket(action: 'chop' | 'bow' | 'fish', target = new THREE.Vector3(), hand: 'left' | 'right' = 'left'): THREE.Vector3 {
    const point = handGrips[this.currentSheet][this.currentRow][this.currentColumn][hand];
    const depth = playerHandDepth(this.currentSheet, this.currentRow);
    target.set(point[0], point[1], depth);
    this.sprite.mesh.updateMatrixWorld(true);
    return this.sprite.mesh.localToWorld(target);
  }

  constructor(private readonly sprite: SpriteBundle) {
    for (const [action, url] of Object.entries(actionUrls)) {
      new THREE.TextureLoader().load(url, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        const columns = Math.round(texture.image.width / (texture.image.height / 8));
        texture.repeat.set(1 / columns, 1 / 8);
        this.maps[action as keyof typeof actionUrls] = texture;
      });
    }
    const image = new Image();
    image.onload = () => {
      const { sheet, tex, mesh } = this.sprite;
      tex.dispose();
      sheet.width = sheet.height = 1280;
      const context = sheet.getContext('2d')!;
      context.imageSmoothingEnabled = false;
      for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 8; column++) {
          const x = Math.round(column * image.width / 8);
          const y = Math.round(row * image.height / 8);
          const width = Math.round((column + 1) * image.width / 8) - x;
          const height = Math.round((row + 1) * image.height / 8) - y;
          context.drawImage(image, x, y, width, height, column * 160 + 2, row * 160 + 2, 156, 156);
        }
      }
      tex.repeat.set(1 / 8, 1 / 8);
      tex.offset.set(0, 7 / 8);
      tex.needsUpdate = true;
      const geometry = mesh.geometry.clone();
      geometry.scale(1.55, 1.55 / 1.5, 1);
      mesh.geometry = geometry;
      this.walkGeometry = geometry;
      this.loaded = true;
    };
    image.onerror = () => console.error('Player sheet failed to load; retaining the traveler sprite.');
    image.src = sheetUrl;
  }

  public update(dx: number, dz: number, cameraYaw: number, walkTime: number, moving: boolean, pose: PlayerPose, idleTime: number): void {
    if (!this.loaded) return;
    const row = playerSheetRow(dx, dz, cameraYaw);
    this.currentRow = row;
    const action = moving ? null : playerActionFrame(pose);
    const idleMap = !moving && !action ? this.maps.idle : null;
    const actionMap = action ? this.maps[action.action] : idleMap;
    const texture = actionMap ?? this.sprite.tex;
    const idleColumns = idleMap ? Math.round(1 / idleMap.repeat.x) : 8;
    const column = actionMap && action ? action.column : idleMap ? Math.floor(idleTime * 4) % idleColumns : moving ? Math.floor(walkTime) % 8 : 0;
    this.currentAction = actionMap && action ? action.action : null;
    this.currentSheet = this.currentAction ?? (idleMap ? 'idle' : 'walk');
    this.currentColumn = column;
    this.sprite.mat.map = texture;
    this.sprite.mesh.geometry = actionMap ? this.actionGeometry : this.walkGeometry!;
    this.sprite.mesh.scale.x = 1;
    texture.offset.set(column * texture.repeat.x, (7 - row) / 8);
  }
}

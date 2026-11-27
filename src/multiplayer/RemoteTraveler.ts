import * as THREE from 'three';
import type { PlayerData } from '../../server/multiplayerServer';
import { characterSprite } from '../entities/Sprites';
import type { WorldGrid } from '../world/WorldGrid';

export class RemoteTraveler {
  public readonly id: string;
  public name: string;
  public x: number;
  public z: number;
  public targetX: number;
  public targetZ: number;
  public face: 1 | -1;
  public frame: number;
  public crouch: number;
  public swing: number;

  public readonly sheet: HTMLCanvasElement;
  public readonly tex: THREE.CanvasTexture;
  public readonly mat: THREE.MeshBasicMaterial;
  public readonly mesh: THREE.Mesh;

  public readonly labelEl: HTMLDivElement;
  private readonly nameEl: HTMLElement;
  private readonly bubbleEl: HTMLSpanElement;
  public bubbleUntil = 0;

  constructor(data: PlayerData, scene: THREE.Scene, labelsContainer: HTMLElement) {
    this.id = data.id;
    this.name = data.name;
    this.x = this.targetX = data.x;
    this.z = this.targetZ = data.z;
    this.face = data.face ?? 1;
    this.frame = data.frame ?? 0;
    this.crouch = data.crouch ?? 0;
    this.swing = data.swing ?? 0;

    const sprite = characterSprite(
      scene,
      {
        role: 'Traveler',
        skin: data.look.skin,
        hair: data.look.hair,
        shirt: data.look.shirt,
        pants: data.look.pants,
        shoes: '#2a1d14',
        hat: 'brim',
        hatCol: data.look.hatCol,
        pack: true,
      },
      11
    );
    this.sheet = sprite.sheet;
    this.tex = sprite.tex;
    this.mat = sprite.mat;
    this.mesh = sprite.mesh;

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'nameTag peerTag hide';
    this.nameEl = document.createElement('b');
    this.nameEl.textContent = this.name;
    this.bubbleEl = document.createElement('span');
    this.bubbleEl.className = 'speechBubble hide';
    this.labelEl.append(this.nameEl, this.bubbleEl);
    labelsContainer.append(this.labelEl);
  }

  public setName(name: string): void {
    this.name = name;
    this.nameEl.textContent = name;
  }

  public showChat(text: string): void {
    this.bubbleEl.textContent = text;
    this.bubbleUntil = performance.now() + 6000;
  }

  public applyState(data: PlayerData): void {
    this.targetX = data.x;
    this.targetZ = data.z;
    this.face = data.face === -1 ? -1 : 1;
    this.frame = data.frame ?? 0;
    this.crouch = data.crouch ?? 0;
    this.swing = data.swing ?? 0;
    if (data.name && data.name !== this.name) this.setName(data.name);
  }

  public update(dt: number, camYaw: number, grid: WorldGrid, demoActive: boolean): void {
    this.mesh.visible = !demoActive;
    const blend = Math.min(1, dt * 14);
    this.x += (this.targetX - this.x) * blend;
    this.z += (this.targetZ - this.z) * blend;
    const y = grid.groundY(this.x, this.z);
    this.mesh.position.set(this.x, y - 0.19 * this.crouch, this.z);
    this.mesh.rotation.z = this.face * (this.swing - 0.23 * this.crouch);
    this.mesh.rotation.y = camYaw;
    this.mesh.scale.x = this.face;
    this.tex.offset.x = this.frame * this.tex.repeat.x;
  }

  public updateBubbleVisibility(now: number): void {
    this.bubbleEl.classList.toggle('hide', now >= this.bubbleUntil);
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.tex.dispose();
    this.mat.dispose();
    this.labelEl.remove();
  }
}

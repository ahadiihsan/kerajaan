import * as THREE from 'three';
import { ROCharacterAtlas } from '../character/ROCharacterAtlas';
import { PlayerData } from '../../server/multiplayerServer';

export class RemotePlayer {
  public id: string;
  public name: string;
  public color: string;
  public characterId: string;
  public mesh: THREE.Group;

  public position: THREE.Vector3;
  private targetPosition: THREE.Vector3;
  private facingAngle: number = 0;
  private isMoving: boolean = false;
  private isSitting: boolean = false;
  private direction: string = 'down';
  private frameIndex: number = 0;

  private spriteMesh: THREE.Mesh;
  private spriteMaterial: THREE.MeshStandardMaterial;
  private shadowDisc: THREE.Mesh;
  private nametagSprite: THREE.Sprite;

  // Speech & Emote Bubble
  private bubbleCanvas: HTMLCanvasElement;
  private bubbleCtx: CanvasRenderingContext2D;
  private bubbleTex: THREE.CanvasTexture;
  private bubbleSprite: THREE.Sprite;
  private bubbleTimer: number = 0;
  private currentBubbleText: string = '';

  constructor(data: PlayerData) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color || '#2d5f8c';
    this.characterId = data.characterId || ROCharacterAtlas.DEFAULT_CHARACTER;

    this.position = new THREE.Vector3(data.x, 0, data.z);
    this.targetPosition = new THREE.Vector3(data.x, 0, data.z);
    this.facingAngle = data.facingAngle || 0;
    this.isMoving = !!data.isMoving;
    this.isSitting = !!data.isSitting;
    this.direction = data.direction || 'down';
    this.frameIndex = data.frameIndex || 0;

    this.mesh = new THREE.Group();
    this.mesh.name = `RemotePlayer_${this.id}`;

    // 1. Soft Oval Drop Shadow on Ground
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(15, 12, 10, 0.65)');
    grad.addColorStop(0.5, 'rgba(15, 12, 10, 0.35)');
    grad.addColorStop(1, 'rgba(15, 12, 10, 0.0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1.2, 0.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.position.y = 0.02;
    this.mesh.add(this.shadowDisc);

    // 2. Upright Standing Billboard Sprite Quad
    const spriteGeo = new THREE.PlaneGeometry(1.75, 2.4);
    spriteGeo.translate(0, 1.2, 0);

    // Set vertex normals facing slightly upward and forward to catch sunlight
    const normals = spriteGeo.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, 0, 0.35, 0.93);
    }
    normals.needsUpdate = true;

    const initialTex = ROCharacterAtlas.getTexture(0, 0, this.characterId);
    this.spriteMaterial = new THREE.MeshStandardMaterial({
      map: initialTex,
      emissiveMap: initialTex,
      emissive: new THREE.Color(0xa0a0a0),
      emissiveIntensity: 0.65,
      roughness: 0.55,
      metalness: 0.15,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide
    });

    this.spriteMesh = new THREE.Mesh(spriteGeo, this.spriteMaterial);
    this.spriteMesh.rotation.order = 'YXZ';
    this.mesh.add(this.spriteMesh);

    // 2.5 Authentic RO1 Under-Feet Battle Gauge
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = 64;
    hpCanvas.height = 12;
    const hpCtx = hpCanvas.getContext('2d')!;
    hpCtx.fillStyle = '#0f141d';
    hpCtx.fillRect(0, 0, 64, 12);
    hpCtx.fillStyle = '#00d2d3';
    hpCtx.fillRect(2, 2, 60, 8);
    hpCtx.fillStyle = '#7efff5';
    hpCtx.fillRect(2, 2, 60, 2);

    const hpTex = new THREE.CanvasTexture(hpCanvas);
    hpTex.magFilter = THREE.NearestFilter;
    const hpGeo = new THREE.PlaneGeometry(0.85, 0.16);
    const hpMat = new THREE.MeshBasicMaterial({
      map: hpTex,
      transparent: true,
      depthTest: true,
      side: THREE.DoubleSide
    });
    const battleGauge = new THREE.Mesh(hpGeo, hpMat);
    battleGauge.position.set(0, 0.08, 0.05);
    this.spriteMesh.add(battleGauge);

    // 3. Floating RO1 Nametag & HP Bar
    this.nametagSprite = this.createNametagSprite(this.name);
    this.nametagSprite.position.set(0, 2.7, 0);
    this.mesh.add(this.nametagSprite);

    // 4. Floating Overhead Speech / Emote Bubble
    this.bubbleCanvas = document.createElement('canvas');
    this.bubbleCanvas.width = 256;
    this.bubbleCanvas.height = 96;
    this.bubbleCtx = this.bubbleCanvas.getContext('2d')!;
    this.bubbleTex = new THREE.CanvasTexture(this.bubbleCanvas);
    this.bubbleTex.colorSpace = THREE.SRGBColorSpace;
    const bubbleMat = new THREE.SpriteMaterial({ map: this.bubbleTex, transparent: true, opacity: 0 });
    this.bubbleSprite = new THREE.Sprite(bubbleMat);
    this.bubbleSprite.scale.set(3.2, 1.2, 1);
    this.bubbleSprite.position.set(0, 3.5, 0);
    this.mesh.add(this.bubbleSprite);

    this.mesh.position.copy(this.position);
  }

  private createNametagSprite(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Capsule background
    ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
    ctx.roundRect(16, 8, 224, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#2ed573'; // Remote players highlighted with green border
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Player Name
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#7bed9f';
    ctx.textAlign = 'center';
    ctx.fillText(`[Lv.99] ${name}`, 128, 28);

    // Green HP Bar
    ctx.fillStyle = '#1e241c';
    ctx.fillRect(40, 36, 176, 8);
    ctx.fillStyle = '#2ed573';
    ctx.fillRect(40, 36, 176, 8);
    ctx.strokeStyle = '#20bf6b';
    ctx.strokeRect(40, 36, 176, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  public updateState(data: PlayerData): void {
    this.targetPosition.set(data.x, 0, data.z);
    this.facingAngle = data.facingAngle;
    this.isMoving = data.isMoving;
    this.isSitting = data.isSitting;
    this.direction = data.direction;
    this.frameIndex = data.frameIndex;
    if (data.characterId && data.characterId !== this.characterId) {
      this.setCharacter(data.characterId);
    }
  }

  public async setCharacter(characterId: string): Promise<void> {
    this.characterId = characterId;
    await ROCharacterAtlas.loadCharacter(characterId);
    const tex = ROCharacterAtlas.getTexture(0, this.frameIndex, this.characterId);
    if (this.spriteMaterial) {
      this.spriteMaterial.map = tex;
      this.spriteMaterial.emissiveMap = tex;
      this.spriteMaterial.needsUpdate = true;
    }
  }

  public update(delta: number, cameraYaw: number): void {
    // 1. Smooth position interpolation (Lerp)
    this.position.lerp(this.targetPosition, Math.min(1.0, delta * 12));
    this.mesh.position.copy(this.position);

    // 2. 8-Directional View Index (0..7) relative to camera orbit yaw
    const dir8 = ROCharacterAtlas.calculateDirection8(this.facingAngle, cameraYaw);

    // 3. Upright cylindrical billboarding
    this.spriteMesh.rotation.y = cameraYaw;
    this.spriteMesh.rotation.x = 0;

    // 4. Update sprite texture from atlas with player's hairstyle
    const frame = this.isSitting ? 9 : (this.isMoving ? (1 + (this.frameIndex % 8)) : 0);
    const newTex = ROCharacterAtlas.getTexture(dir8, frame, this.characterId);
    if (this.spriteMaterial.map !== newTex) {
      this.spriteMaterial.map = newTex;
      this.spriteMaterial.emissiveMap = newTex;
      this.spriteMaterial.needsUpdate = true;
    }

    // 5. Update speech bubble timer
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= delta;
      if (this.bubbleTimer <= 0) {
        this.bubbleSprite.material.opacity = 0;
      } else if (this.bubbleTimer < 0.5) {
        // Fade out in last 0.5 seconds
        this.bubbleSprite.material.opacity = this.bubbleTimer / 0.5;
      }
    }
  }

  public showEmote(symbol: string): void {
    this.renderBubble(symbol, true);
  }

  public showChat(text: string): void {
    this.renderBubble(text, false);
  }

  private renderBubble(text: string, isEmote: boolean): void {
    const ctx = this.bubbleCtx;
    ctx.clearRect(0, 0, 256, 96);

    // Draw speech bubble with pointer tail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 2.5;

    // Bubble box
    ctx.beginPath();
    ctx.roundRect(12, 10, 232, 58, 12);
    ctx.fill();
    ctx.stroke();

    // Pointer tail
    ctx.beginPath();
    ctx.moveTo(120, 68);
    ctx.lineTo(128, 82);
    ctx.lineTo(136, 68);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.stroke();

    // Text / Emote
    if (isEmote) {
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 52);
    } else {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#1e272e';
      ctx.textAlign = 'center';
      ctx.fillText(text.length > 22 ? text.substring(0, 20) + '...' : text, 128, 44);
    }

    this.bubbleTex.needsUpdate = true;
    this.bubbleSprite.material.opacity = 1.0;
    this.bubbleTimer = isEmote ? 3.0 : 5.0; // 5 seconds for chat messages
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.spriteMaterial.dispose();
    this.shadowDisc.geometry.dispose();
    (this.shadowDisc.material as THREE.Material).dispose();
    this.nametagSprite.material.dispose();
    this.bubbleSprite.material.dispose();
  }
}

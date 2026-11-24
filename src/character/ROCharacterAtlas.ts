import * as THREE from 'three';

export class ROCharacterAtlas {
  private static isLoaded: boolean = false;
  private static loadPromise: Promise<void> | null = null;
  private static textures: THREE.CanvasTexture[][] = []; // [8 directions][10 frames]
  private static fallbackCanvas: HTMLCanvasElement | null = null;

  public static readonly FRAME_WIDTH = 64;
  public static readonly FRAME_HEIGHT = 96;

  public static async init(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      const img = new Image();
      img.src = '/sprites/ro_character_atlas.png';
      img.onload = () => {
        this.sliceAtlas(img);
        this.isLoaded = true;
        console.log('⚔️ Ragnarok Online Arch Bishop & Blue Hair Sprite Atlas sliced (80 frames)');
        resolve();
      };
      img.onerror = (err) => {
        console.error('Failed to load character atlas:', err);
        resolve();
      };
    });

    return this.loadPromise;
  }

  private static sliceAtlas(img: HTMLImageElement): void {
    const fw = this.FRAME_WIDTH;
    const fh = this.FRAME_HEIGHT;

    for (let d = 0; d < 8; d++) {
      this.textures[d] = [];
      for (let f = 0; f < 10; f++) {
        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        // Draw sub-rectangle from atlas
        ctx.drawImage(img, f * fw, d * fh, fw, fh, 0, 0, fw, fh);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textures[d][f] = tex;
      }
    }
  }

  public static getTexture(dir8Index: number, frameIndex: number): THREE.CanvasTexture {
    const d = Math.max(0, Math.min(7, dir8Index));
    const f = Math.max(0, Math.min(9, frameIndex));

    if (this.textures[d] && this.textures[d][f]) {
      return this.textures[d][f];
    }

    // Fallback while loading
    if (!this.fallbackCanvas) {
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.width = 64;
      this.fallbackCanvas.height = 96;
    }
    const tex = new THREE.CanvasTexture(this.fallbackCanvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  /**
   * Calculates 8-directional view index (0..7) relative to camera orbit yaw
   * 0: South (Front)
   * 1: South-West (Front-Left)
   * 2: West (Profile-Left)
   * 3: North-West (Back-Left)
   * 4: North (Back)
   * 5: North-East (Back-Right)
   * 6: East (Profile-Right)
   * 7: South-East (Front-Right)
   */
  public static calculateDirection8(facingAngle: number, cameraYaw: number): number {
    let relAngle = facingAngle - cameraYaw;
    // Normalize to [0, 2*PI)
    relAngle = (relAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    // 8 octants of 45 deg (PI/4 rad), shifted by 22.5 deg (PI/8) for centered sectors
    const octant = Math.PI / 4;
    const shifted = (relAngle + octant * 0.5) % (Math.PI * 2);
    const idx = Math.floor(shifted / octant);

    return Math.max(0, Math.min(7, idx));
  }
}

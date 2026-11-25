import * as THREE from 'three';

export interface CharacterInfo {
  id: string;
  name: string;
  hairStyle: string;
  hairColor: string;
  atlasUrl: string;
  thumbUrl: string;
}

export const AVAILABLE_CHARACTERS: CharacterInfo[] = [
  {
    id: 'archbishop_blue_spiky',
    name: 'Azure Spiky',
    hairStyle: 'Spiky',
    hairColor: 'Azure Blue',
    atlasUrl: '/sprites/characters/archbishop_blue_spiky.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_blue_spiky.png',
  },
  {
    id: 'archbishop_blonde_spiky',
    name: 'Golden Spiky',
    hairStyle: 'Spiky',
    hairColor: 'Golden Blonde',
    atlasUrl: '/sprites/characters/archbishop_blonde_spiky.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_blonde_spiky.png',
  },
  {
    id: 'archbishop_red_spiky',
    name: 'Crimson Spiky',
    hairStyle: 'Spiky',
    hairColor: 'Crimson Red',
    atlasUrl: '/sprites/characters/archbishop_red_spiky.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_red_spiky.png',
  },
  {
    id: 'archbishop_black_long',
    name: 'Raven Ponytail',
    hairStyle: 'Long Ponytail',
    hairColor: 'Raven Black',
    atlasUrl: '/sprites/characters/archbishop_black_long.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_black_long.png',
  },
  {
    id: 'archbishop_silver_long',
    name: 'Silver Ponytail',
    hairStyle: 'Long Ponytail',
    hairColor: 'Pure Silver',
    atlasUrl: '/sprites/characters/archbishop_silver_long.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_silver_long.png',
  },
  {
    id: 'archbishop_blonde_short',
    name: 'Blonde Crop',
    hairStyle: 'Short Crop',
    hairColor: 'Golden Blonde',
    atlasUrl: '/sprites/characters/archbishop_blonde_short.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_blonde_short.png',
  },
  {
    id: 'archbishop_brown_curls',
    name: 'Chestnut Curls',
    hairStyle: 'Wavy Curls',
    hairColor: 'Chestnut Brown',
    atlasUrl: '/sprites/characters/archbishop_brown_curls.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_brown_curls.png',
  },
  {
    id: 'archbishop_green_wild',
    name: 'Emerald Wild',
    hairStyle: 'Wild Shaggy',
    hairColor: 'Emerald Green',
    atlasUrl: '/sprites/characters/archbishop_green_wild.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_green_wild.png',
  },
  {
    id: 'archbishop_pink_casual',
    name: 'Sakura Casual',
    hairStyle: 'Casual Bangs',
    hairColor: 'Sakura Pink',
    atlasUrl: '/sprites/characters/archbishop_pink_casual.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_pink_casual.png',
  },
  {
    id: 'archbishop_purple_royal',
    name: 'Mystic Royal',
    hairStyle: 'Royal Noble',
    hairColor: 'Mystic Purple',
    atlasUrl: '/sprites/characters/archbishop_purple_royal.png',
    thumbUrl: '/sprites/characters/thumbs/archbishop_purple_royal.png',
  },
];

export class ROCharacterAtlas {
  public static readonly DEFAULT_CHARACTER = 'archbishop_blue_spiky';
  public static readonly FRAME_WIDTH = 64;
  public static readonly FRAME_HEIGHT = 96;

  private static atlasTextures: Map<string, THREE.CanvasTexture[][]> = new Map();
  private static loadPromises: Map<string, Promise<void>> = new Map();
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized: boolean = false;

  public static async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load default character atlas first
    await this.loadCharacter(this.DEFAULT_CHARACTER);

    // Also slice /sprites/ro_character_atlas.png into fallback if needed
    if (!this.atlasTextures.has('default')) {
      const defTextures = this.atlasTextures.get(this.DEFAULT_CHARACTER);
      if (defTextures) {
        this.atlasTextures.set('default', defTextures);
      }
    }

    // Preload remaining character atlases in the background
    this.preloadRemaining();
  }

  public static async loadCharacter(characterId: string): Promise<void> {
    if (this.atlasTextures.has(characterId)) return;
    if (this.loadPromises.has(characterId)) return this.loadPromises.get(characterId)!;

    const charInfo = AVAILABLE_CHARACTERS.find((c) => c.id === characterId);
    const url = charInfo ? charInfo.atlasUrl : `/sprites/characters/${characterId}.png`;

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const sliced = this.sliceAtlas(img);
        this.atlasTextures.set(characterId, sliced);
        console.log(`⚔️ RO Character Atlas loaded & sliced: [${characterId}] (80 frames)`);
        resolve();
      };
      img.onerror = (err) => {
        console.warn(`Failed to load character atlas [${characterId}], using fallback:`, err);
        // Fallback to default if available
        const fallback = this.atlasTextures.get(this.DEFAULT_CHARACTER);
        if (fallback) {
          this.atlasTextures.set(characterId, fallback);
        }
        resolve();
      };
    });

    this.loadPromises.set(characterId, promise);
    return promise;
  }

  private static async preloadRemaining(): Promise<void> {
    for (const char of AVAILABLE_CHARACTERS) {
      if (char.id !== this.DEFAULT_CHARACTER) {
        try {
          await this.loadCharacter(char.id);
        } catch (e) {
          // Ignore background preload errors
        }
      }
    }
  }

  private static sliceAtlas(img: HTMLImageElement): THREE.CanvasTexture[][] {
    const fw = this.FRAME_WIDTH;
    const fh = this.FRAME_HEIGHT;
    const textures: THREE.CanvasTexture[][] = [];

    for (let d = 0; d < 8; d++) {
      textures[d] = [];
      for (let f = 0; f < 10; f++) {
        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        // Draw 64x96 sub-rectangle from 640x768 atlas
        ctx.drawImage(img, f * fw, d * fh, fw, fh, 0, 0, fw, fh);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        textures[d][f] = tex;
      }
    }

    return textures;
  }

  public static getTexture(
    dir8Index: number,
    frameIndex: number,
    characterId: string = this.DEFAULT_CHARACTER
  ): THREE.CanvasTexture {
    const d = Math.max(0, Math.min(7, dir8Index));
    const f = Math.max(0, Math.min(9, frameIndex));

    let charSet = this.atlasTextures.get(characterId);
    if (!charSet) {
      // Lazy trigger background load if not yet requested
      if (!this.loadPromises.has(characterId)) {
        this.loadCharacter(characterId);
      }
      // Fallback to default character
      charSet = this.atlasTextures.get(this.DEFAULT_CHARACTER);
    }

    if (charSet && charSet[d] && charSet[d][f]) {
      return charSet[d][f];
    }

    // Ultimate fallback blank canvas while initial load is pending
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
    let relAngle = cameraYaw - facingAngle;
    relAngle = (relAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    const octant = Math.PI / 4;
    const shifted = (relAngle + octant * 0.5) % (Math.PI * 2);
    const idx = Math.floor(shifted / octant);

    return Math.max(0, Math.min(7, idx));
  }
}

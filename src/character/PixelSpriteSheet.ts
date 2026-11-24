import * as THREE from 'three';

export type SpriteDirection = 'down' | 'up' | 'left' | 'right';

export interface CharacterLayerTextures {
  back: THREE.CanvasTexture;
  mid: THREE.CanvasTexture;
  front: THREE.CanvasTexture;
}

export class PixelSpriteSheet {
  private static layerCache: Map<string, CharacterLayerTextures> = new Map();
  private static compositeCache: Map<string, THREE.CanvasTexture> = new Map();

  public static readonly SPRITE_WIDTH = 40;
  public static readonly SPRITE_HEIGHT = 54;

  /**
   * Generates 3-layer 2.5D depth textures (Back, Mid, Front)
   * Providing physical volumetric relief, parallax, and depth of plane
   */
  public static getLayers(
    direction: SpriteDirection,
    frame: number,
    tunicColorHex: string = '#2d5f8c',
    hairColorHex: string = '#e6a847'
  ): CharacterLayerTextures {
    const key = `layers_${direction}_${frame}_${tunicColorHex}_${hairColorHex}`;
    if (this.layerCache.has(key)) {
      return this.layerCache.get(key)!;
    }

    const w = this.SPRITE_WIDTH;
    const h = this.SPRITE_HEIGHT;

    const backCanvas = document.createElement('canvas');
    backCanvas.width = w;
    backCanvas.height = h;
    const backCtx = backCanvas.getContext('2d')!;
    backCtx.imageSmoothingEnabled = false;

    const midCanvas = document.createElement('canvas');
    midCanvas.width = w;
    midCanvas.height = h;
    const midCtx = midCanvas.getContext('2d')!;
    midCtx.imageSmoothingEnabled = false;

    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = w;
    frontCanvas.height = h;
    const frontCtx = frontCanvas.getContext('2d')!;
    frontCtx.imageSmoothingEnabled = false;

    this.drawLayeredROCharacter(backCtx, midCtx, frontCtx, direction, frame, tunicColorHex, hairColorHex);

    const makeTex = (c: HTMLCanvasElement) => {
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const result: CharacterLayerTextures = {
      back: makeTex(backCanvas),
      mid: makeTex(midCanvas),
      front: makeTex(frontCanvas),
    };

    this.layerCache.set(key, result);
    return result;
  }

  /**
   * Generates standard composite texture (for instanced crowd agents)
   */
  public static getTexture(
    direction: SpriteDirection,
    frame: number,
    tunicColorHex: string = '#2d5f8c',
    hairColorHex: string = '#e6a847'
  ): THREE.CanvasTexture {
    const key = `ro_comp_${direction}_${frame}_${tunicColorHex}_${hairColorHex}`;
    if (this.compositeCache.has(key)) {
      return this.compositeCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.SPRITE_WIDTH;
    canvas.height = this.SPRITE_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Composite Back -> Mid -> Front onto single canvas
    this.drawLayeredROCharacter(ctx, ctx, ctx, direction, frame, tunicColorHex, hairColorHex);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.compositeCache.set(key, texture);
    return texture;
  }

  private static drawLayeredROCharacter(
    backCtx: CanvasRenderingContext2D,
    midCtx: CanvasRenderingContext2D,
    frontCtx: CanvasRenderingContext2D,
    dir: SpriteDirection,
    frame: number,
    tunicColor: string,
    hairColor: string
  ): void {
    const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w: number = 1, h: number = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    };

    // Color Palette: Classic Ragnarok Online 1 Anime Swordsman
    const outline = '#171412';
    const skin = '#ffe0c4';
    const skinShade = '#e6b58e';
    const skinBlush = '#f7a89e';

    const hairHighlight = '#ffea9f';
    const hairShadow = '#a36d22';

    const ironHighlight = '#f0f3f6';
    const ironMid = '#9aa7b3';
    const ironShadow = '#596570';

    const leatherMid = '#734e32';
    const leatherDark = '#482f1b';
    const boots = '#2a1a0f';
    const goldBuckle = '#f9ca24';

    const redHeadband = '#e84118';
    const redHeadbandShadow = '#9c2409';
    const capeColor = '#a82c23';
    const capeShadow = '#67140f';

    const isSitting = frame === 4;
    const walkBob = (frame === 1 || frame === 3) ? -1 : 0;
    const legOffset = (frame === 1) ? 2 : (frame === 3) ? -2 : 0;
    const baseY = isSitting ? 7 : 0;

    // =========================================================================
    // LAYER 1: BACK
    // =========================================================================
    const cy = 20 + walkBob + baseY;
    const flutter = (frame === 1 || frame === 3) ? 1 : 0;

    if (dir === 'down') {
      // Cape draped behind back
      rect(backCtx, 9 - flutter, cy, outline, 22 + flutter * 2, 20);
      rect(backCtx, 10 - flutter, cy + 1, capeShadow, 20 + flutter * 2, 18);
      rect(backCtx, 12, cy + 2, capeColor, 16, 16);
      rect(backCtx, 15, cy + 3, capeShadow, 2, 14);
      rect(backCtx, 23, cy + 3, capeShadow, 2, 14);

      // Scabbard peeking out at right hip
      rect(backCtx, 28, cy - 6, outline, 4, 22);
      rect(backCtx, 29, cy - 5, leatherDark, 2, 20);
      rect(backCtx, 29, cy + 11, ironMid, 2, 3);
    } else if (dir === 'left') {
      // Cape fluttering to the right
      rect(backCtx, 18, cy + 1, outline, 14 + flutter, 18);
      rect(backCtx, 19, cy + 2, capeShadow, 12 + flutter, 16);
      rect(backCtx, 20, cy + 3, capeColor, 10 + flutter, 14);

      // Sword scabbard extending diagonally behind
      rect(backCtx, 24, cy - 4, outline, 4, 18);
      rect(backCtx, 25, cy - 3, leatherDark, 2, 16);
    } else if (dir === 'right') {
      // Cape fluttering to the left
      rect(backCtx, 8 - flutter, cy + 1, outline, 14 + flutter, 18);
      rect(backCtx, 9 - flutter, cy + 2, capeShadow, 12 + flutter, 16);
      rect(backCtx, 10 - flutter, cy + 3, capeColor, 10 + flutter, 14);
    }

    // =========================================================================
    // LAYER 2: MID (Torso, Tunic, Belt, Arms, Legs & Boots)
    // =========================================================================
    const ty = 20 + walkBob + baseY;

    // Tunic Body
    rect(midCtx, 12, ty, outline, 16, 13);
    rect(midCtx, 13, ty + 1, tunicColor, 14, 11);

    if (dir === 'down') {
      // Front collar & chest leather harness
      rect(midCtx, 18, ty + 1, '#f5f6fa', 4, 3);
      rect(midCtx, 15, ty + 4, leatherMid, 10, 2);
      // Belt & Gold Buckle
      rect(midCtx, 12, ty + 10, outline, 16, 4);
      rect(midCtx, 13, ty + 11, leatherDark, 14, 2);
      rect(midCtx, 18, ty + 10, goldBuckle, 4, 3);
      rect(midCtx, 19, ty + 11, '#ffeaa7', 2, 1);
    } else if (dir === 'up') {
      // Back belt strap
      rect(midCtx, 12, ty + 10, outline, 16, 4);
      rect(midCtx, 13, ty + 11, leatherDark, 14, 2);
      rect(midCtx, 19, ty + 10, leatherMid, 2, 4);
    } else {
      // Side belt
      rect(midCtx, 12, ty + 10, outline, 16, 4);
      rect(midCtx, 13, ty + 11, leatherDark, 14, 2);
    }

    // Arms
    if (dir === 'down' || dir === 'up') {
      rect(midCtx, 8, ty + 3, outline, 5, 10);
      rect(midCtx, 9, ty + 4, tunicColor, 3, 6);
      rect(midCtx, 9, ty + 10, skin, 3, 2);

      rect(midCtx, 27, ty + 3, outline, 5, 10);
      rect(midCtx, 28, ty + 4, tunicColor, 3, 6);
      rect(midCtx, 28, ty + 10, skin, 3, 2);
    } else {
      const isRight = dir === 'right';
      const armX = isRight ? 24 : 11;
      rect(midCtx, armX, ty + 3, outline, 5, 10);
      rect(midCtx, armX + 1, ty + 4, tunicColor, 3, 6);
      rect(midCtx, armX + 1, ty + 10, skin, 3, 2);
    }

    // Legs & Boots
    const ly = 33 + walkBob + baseY;
    if (isSitting) {
      rect(midCtx, 9, ly - 1, outline, 22, 9);
      rect(midCtx, 10, ly, leatherMid, 20, 4);
      rect(midCtx, 8, ly + 4, boots, 8, 4);
      rect(midCtx, 24, ly + 4, boots, 8, 4);
      rect(midCtx, 9, ly + 5, leatherDark, 6, 2);
      rect(midCtx, 25, ly + 5, leatherDark, 6, 2);
    } else if (dir === 'down' || dir === 'up') {
      const leftY = ly + legOffset;
      rect(midCtx, 13, leftY, outline, 6, 12);
      rect(midCtx, 14, leftY + 1, leatherMid, 4, 6);
      rect(midCtx, 14, leftY + 7, leatherDark, 4, 4);
      rect(midCtx, 13, leftY + 10, boots, 6, 2);

      const rightY = ly - legOffset;
      rect(midCtx, 21, rightY, outline, 6, 12);
      rect(midCtx, 22, rightY + 1, leatherMid, 4, 6);
      rect(midCtx, 22, rightY + 7, leatherDark, 4, 4);
      rect(midCtx, 21, rightY + 10, boots, 6, 2);
    } else {
      const frontX = 15 + legOffset;
      rect(midCtx, frontX, ly, outline, 6, 11);
      rect(midCtx, frontX + 1, ly + 1, leatherMid, 4, 5);
      rect(midCtx, frontX + 1, ly + 6, leatherDark, 4, 3);
      rect(midCtx, frontX, ly + 9, boots, 6, 2);

      const backX = 19 - legOffset;
      rect(midCtx, backX, ly, outline, 6, 10);
      rect(midCtx, backX + 1, ly + 1, leatherMid, 4, 4);
      rect(midCtx, backX + 1, ly + 5, leatherDark, 4, 3);
      rect(midCtx, backX, ly + 8, boots, 6, 2);
    }

    // =========================================================================
    // LAYER 3: FRONT (Head, Headband, Armor, Sword, or Back Cape details)
    // =========================================================================
    const hy = 4 + walkBob + baseY;

    if (dir === 'down') {
      // 1. Spiky Anime Hair (Top & Sides)
      rect(frontCtx, 12, hy, outline, 16, 5);
      rect(frontCtx, 13, hy + 1, hairColor, 14, 4);
      rect(frontCtx, 14, hy + 1, hairHighlight, 10, 2);

      rect(frontCtx, 9, hy + 3, outline, 4, 4);
      rect(frontCtx, 10, hy + 4, hairColor, 3, 2);
      rect(frontCtx, 27, hy + 3, outline, 4, 4);
      rect(frontCtx, 27, hy + 4, hairColor, 3, 2);

      // 2. Red Warrior Headband (Bold with knot tails)
      rect(frontCtx, 11, hy + 4, outline, 18, 5);
      rect(frontCtx, 12, hy + 5, redHeadband, 16, 3);
      rect(frontCtx, 13, hy + 5, '#ff6b6b', 14, 1);

      // Ribbon knot tails on right
      rect(frontCtx, 28, hy + 5, outline, 4, 7);
      rect(frontCtx, 29, hy + 6, redHeadband, 2, 5);
      rect(frontCtx, 30, hy + 8, redHeadbandShadow, 2, 4);

      // 3. Face
      rect(frontCtx, 12, hy + 8, outline, 16, 10);
      rect(frontCtx, 13, hy + 8, skin, 14, 9);
      rect(frontCtx, 13, hy + 16, skinShade, 14, 1);

      // Anime Eyes with twinkle
      rect(frontCtx, 14, hy + 10, '#101721', 4, 4);
      rect(frontCtx, 15, hy + 11, '#227093', 2, 3);
      rect(frontCtx, 15, hy + 10, '#ffffff', 2, 2);

      rect(frontCtx, 22, hy + 10, '#101721', 4, 4);
      rect(frontCtx, 23, hy + 11, '#227093', 2, 3);
      rect(frontCtx, 23, hy + 10, '#ffffff', 2, 2);

      // Blushing Cheeks & Bangs
      rect(frontCtx, 13, hy + 14, skinBlush, 3, 1);
      rect(frontCtx, 24, hy + 14, skinBlush, 3, 1);
      rect(frontCtx, 13, hy + 7, hairColor, 3, 3);
      rect(frontCtx, 19, hy + 7, hairColor, 3, 3);
      rect(frontCtx, 24, hy + 7, hairColor, 3, 3);

      // 4. Steel Pauldrons
      rect(frontCtx, 9, ty, outline, 6, 7);
      rect(frontCtx, 10, ty + 1, ironMid, 4, 5);
      rect(frontCtx, 11, ty + 1, ironHighlight, 2, 2);
      rect(frontCtx, 10, ty + 4, ironShadow, 4, 2);

      rect(frontCtx, 25, ty, outline, 6, 7);
      rect(frontCtx, 26, ty + 1, ironMid, 4, 5);
      rect(frontCtx, 27, ty + 1, ironHighlight, 2, 2);
      rect(frontCtx, 26, ty + 4, ironShadow, 4, 2);

      // 5. Front Sword Hilt over right shoulder
      rect(frontCtx, 27, ty - 8, outline, 5, 8);
      rect(frontCtx, 28, ty - 7, ironHighlight, 3, 7);
      rect(frontCtx, 26, ty - 3, goldBuckle, 7, 2);
      rect(frontCtx, 28, ty - 9, '#e84118', 3, 2);
    } else if (dir === 'up') {
      // =======================================================
      // BACK VIEW: Full Red Cape, Diagonal Sword, Spiky Hair Back
      // =======================================================
      // 1. Broad Red Cape covering the back
      rect(frontCtx, 9 - flutter, cy, outline, 22 + flutter * 2, 20);
      rect(frontCtx, 10 - flutter, cy + 1, capeShadow, 20 + flutter * 2, 18);
      rect(frontCtx, 12, cy + 2, capeColor, 16, 16);
      rect(frontCtx, 15, cy + 3, capeShadow, 2, 14);
      rect(frontCtx, 23, cy + 3, capeShadow, 2, 14);

      // 2. Diagonal Broadsword strapped across back on top of cape
      rect(frontCtx, 13, cy - 6, outline, 15, 23);
      // Baldric leather strap
      rect(frontCtx, 11, ty + 2, leatherMid, 18, 3);
      // Sword blade & sheath
      rect(frontCtx, 24, cy - 8, outline, 5, 24);
      rect(frontCtx, 25, cy - 7, ironHighlight, 3, 7); // Hilt
      rect(frontCtx, 23, cy - 1, goldBuckle, 7, 2); // Crossguard
      rect(frontCtx, 25, cy + 1, leatherDark, 3, 14); // Scabbard
      rect(frontCtx, 25, cy + 15, ironMid, 3, 2); // Metal scabbard tip

      // 3. Back of Head & Hair
      rect(frontCtx, 10, hy, outline, 20, 15);
      rect(frontCtx, 11, hy + 1, hairColor, 18, 13);
      rect(frontCtx, 13, hy + 2, hairHighlight, 14, 5);
      rect(frontCtx, 12, hy + 8, hairShadow, 16, 6);

      // Headband center knot with long ribbon tails
      rect(frontCtx, 16, hy + 5, outline, 8, 4);
      rect(frontCtx, 17, hy + 6, redHeadband, 6, 2);
      rect(frontCtx, 18, hy + 8, outline, 4, 8);
      rect(frontCtx, 19, hy + 9, redHeadband, 2, 6);
      rect(frontCtx, 19, hy + 13, redHeadbandShadow, 2, 3);

      // 4. Steel Pauldrons visible at back of shoulders
      rect(frontCtx, 9, ty, outline, 6, 7);
      rect(frontCtx, 10, ty + 1, ironMid, 4, 5);
      rect(frontCtx, 25, ty, outline, 6, 7);
      rect(frontCtx, 26, ty + 1, ironMid, 4, 5);
    } else {
      // =======================================================
      // SIDE PROFILE VIEW (left or right)
      // =======================================================
      const isRight = dir === 'right';
      const fx = isRight ? 16 : 10;

      // Spiky Hair Profile
      rect(frontCtx, 11, hy, outline, 18, 5);
      rect(frontCtx, 12, hy + 1, hairColor, 16, 4);
      rect(frontCtx, 13, hy + 1, hairHighlight, 12, 2);

      // Headband & Ribbon
      rect(frontCtx, 11, hy + 4, outline, 18, 5);
      rect(frontCtx, 12, hy + 5, redHeadband, 16, 3);

      const ribbonX = isRight ? 10 : 27;
      rect(frontCtx, ribbonX, hy + 5, outline, 4, 7);
      rect(frontCtx, ribbonX + 1, hy + 6, redHeadband, 2, 5);

      // Profile Face
      rect(frontCtx, fx, hy + 8, outline, 14, 10);
      rect(frontCtx, fx + 1, hy + 8, skin, 12, 9);

      // Eye looking in direction
      const eyeX = isRight ? fx + 7 : fx + 2;
      rect(frontCtx, eyeX, hy + 10, '#101721', 4, 4);
      rect(frontCtx, eyeX + 1, hy + 11, '#227093', 2, 3);
      rect(frontCtx, eyeX + 1, hy + 10, '#ffffff', 2, 2);

      // Front Pauldron on facing shoulder
      const pauldronX = isRight ? 21 : 13;
      rect(frontCtx, pauldronX, ty, outline, 6, 7);
      rect(frontCtx, pauldronX + 1, ty + 1, ironMid, 4, 5);
      rect(frontCtx, pauldronX + 2, ty + 1, ironHighlight, 2, 2);
    }
  }
}

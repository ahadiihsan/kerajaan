import * as THREE from 'three';

export type SpriteDirection = 'down' | 'up' | 'left' | 'right';

export interface SpriteAtlas {
  textures: { [key: string]: THREE.CanvasTexture };
}

export class PixelSpriteSheet {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Generates a sharp, crisp 16-bit retro medieval pixel art sprite texture
   */
  public static getTexture(
    direction: SpriteDirection,
    frame: number, // 0: idle, 1: step1, 2: pass, 3: step2
    tunicColorHex: string = '#2d4f7c', // Woad blue
    capeColorHex: string = '#8a2b25'   // Crimson
  ): THREE.CanvasTexture {
    const key = `${direction}_${frame}_${tunicColorHex}_${capeColorHex}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    const w = 24;
    const h = 32;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Draw pixel art
    this.drawPixelCharacter(ctx, direction, frame, tunicColorHex, capeColorHex);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.cache.set(key, texture);
    return texture;
  }

  private static drawPixelCharacter(
    ctx: CanvasRenderingContext2D,
    dir: SpriteDirection,
    frame: number,
    tunicColor: string,
    capeColor: string
  ): void {
    const p = (x: number, y: number, color: string, pw: number = 1, ph: number = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pw, ph);
    };

    const skin = '#e5b88f';
    const skinShadow = '#c7956d';
    const hair = '#422817';
    const iron = '#828d99';
    const leather = '#52331d';
    const boots = '#301c0e';
    const gold = '#d4af37';

    // Bobbing offset when walking
    const walkBob = (frame === 1 || frame === 3) ? -1 : 0;
    const legOffset = (frame === 1) ? 2 : (frame === 3) ? -2 : 0;

    // 1. Cape (Behind character)
    if (dir === 'down' || dir === 'left' || dir === 'right') {
      const capeFlutter = (frame === 1 || frame === 3) ? 1 : 0;
      p(6, 12 + walkBob, capeColor, 12, 12);
      p(5 - capeFlutter, 18 + walkBob, capeColor, 3, 7);
      p(16 + capeFlutter, 18 + walkBob, capeColor, 3, 7);
    }

    // 2. Head & Hood / Helmet
    const hy = 4 + walkBob;
    // Hood base
    p(7, hy, tunicColor, 10, 8);
    // Face skin
    if (dir === 'down') {
      p(8, hy + 2, skin, 8, 6);
      p(8, hy + 7, skinShadow, 8, 1);
      // Eyes
      p(9, hy + 4, '#1b1d20', 2, 2);
      p(13, hy + 4, '#1b1d20', 2, 2);
      // Traveler Hood trim
      p(7, hy, iron, 10, 2);
      // Feather crest
      p(14, hy - 3, gold, 2, 4);
      p(16, hy - 2, '#ffffff', 2, 3);
    } else if (dir === 'up') {
      // Back of head
      p(7, hy, tunicColor, 10, 9);
      p(8, hy + 3, hair, 8, 5);
      p(7, hy, iron, 10, 2);
    } else {
      // Side (left or right)
      const isRight = dir === 'right';
      const fx = isRight ? 10 : 6;
      p(fx, hy + 2, skin, 8, 6);
      p(isRight ? 13 : 9, hy + 4, '#1b1d20', 2, 2);
      p(7, hy, iron, 10, 2);
      p(isRight ? 8 : 14, hy - 3, gold, 2, 4);
    }

    // 3. Torso & Tunic
    const ty = 12 + walkBob;
    p(7, ty, tunicColor, 10, 8);
    // Iron pauldrons on shoulders
    p(5, ty, iron, 3, 3);
    p(16, ty, iron, 3, 3);

    // Leather belt with gold buckle
    p(7, ty + 7, leather, 10, 2);
    p(11, ty + 7, gold, 2, 2);

    // 4. Arms & Walking Staff
    if (dir === 'down' || dir === 'up') {
      // Arms
      p(5, ty + 3, tunicColor, 2, 5);
      p(17, ty + 3, tunicColor, 2, 5);
      p(5, ty + 7, skin, 2, 2);
      p(17, ty + 7, skin, 2, 2);

      // Traveler Staff in right hand
      p(19, ty - 2, '#5a3d24', 2, 17);
      p(18, ty - 4, gold, 4, 3); // Staff gem head
    } else {
      const isRight = dir === 'right';
      p(isRight ? 14 : 8, ty + 3, tunicColor, 3, 5);
      p(isRight ? 15 : 7, ty + 7, skin, 2, 2);
      // Staff
      const sx = isRight ? 18 : 4;
      p(sx, ty - 2, '#5a3d24', 2, 17);
      p(sx - 1, ty - 4, gold, 4, 3);
    }

    // 5. Legs & Boots
    const ly = 21 + walkBob;
    if (dir === 'down' || dir === 'up') {
      // Left leg
      p(8, ly, leather, 3, 5 + legOffset);
      p(7, ly + 5 + legOffset, boots, 4, 3);

      // Right leg
      p(13, ly, leather, 3, 5 - legOffset);
      p(13, ly + 5 - legOffset, boots, 4, 3);
    } else {
      // Side stride
      p(9 + legOffset, ly, leather, 3, 5);
      p(9 + legOffset, ly + 5, boots, 4, 3);
      p(12 - legOffset, ly, leather, 3, 4);
      p(12 - legOffset, ly + 4, boots, 4, 3);
    }
  }
}

import * as THREE from 'three';

export type SpriteDirection = 'down' | 'up' | 'left' | 'right';

export class PixelSpriteSheet {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Generates authentic 16-bit Ragnarok Online anime pixel art sprites
   * Supporting Stand (0), Walk (1,2,3), and Sit (4)
   */
  public static getTexture(
    direction: SpriteDirection,
    frame: number,
    tunicColorHex: string = '#2d4f7c', // Woad blue / swordsman blue
    hairColorHex: string = '#d49b55'    // Golden anime blonde
  ): THREE.CanvasTexture {
    const key = `ro_${direction}_${frame}_${tunicColorHex}_${hairColorHex}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    const w = 28;
    const h = 34;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    this.drawROCharacter(ctx, direction, frame, tunicColorHex, hairColorHex);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.cache.set(key, texture);
    return texture;
  }

  private static drawROCharacter(
    ctx: CanvasRenderingContext2D,
    dir: SpriteDirection,
    frame: number,
    tunicColor: string,
    hairColor: string
  ): void {
    const p = (x: number, y: number, color: string, pw: number = 1, ph: number = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pw, ph);
    };

    const skin = '#fedfc4';
    const skinShade = '#e5b88f';
    const iron = '#94a2b0';
    const ironLight = '#c5d1de';
    const leather = '#63442a';
    const boots = '#382315';
    const gold = '#ffd700';
    const red = '#d63031'; // RO1 Headband

    const isSitting = frame === 4;
    const walkBob = (frame === 1 || frame === 3) ? -1 : 0;
    const legStep = (frame === 1) ? 2 : (frame === 3) ? -2 : 0;

    const baseY = isSitting ? 5 : 0; // Lower torso when sitting

    // 1. Spiky Anime Hair & Red Headband (Classic RO1 style!)
    const hy = 3 + walkBob + baseY;

    if (dir === 'down') {
      // Hair top spikes
      p(8, hy - 2, hairColor, 12, 3);
      p(6, hy, hairColor, 16, 4);

      // Iconic Red Headband / Ribbon
      p(7, hy + 2, red, 14, 2);
      p(19, hy + 2, red, 2, 4); // Ribbon tail

      // Face skin
      p(8, hy + 4, skin, 12, 6);
      p(8, hy + 9, skinShade, 12, 1);

      // Anime Eyes (Big blue/dark pupils)
      p(10, hy + 5, '#1b2d42', 2, 3);
      p(10, hy + 5, '#ffffff', 1, 1); // Eye twinkle

      p(16, hy + 5, '#1b2d42', 2, 3);
      p(16, hy + 5, '#ffffff', 1, 1);

      // Bangs
      p(8, hy + 3, hairColor, 3, 2);
      p(13, hy + 3, hairColor, 2, 2);
      p(17, hy + 3, hairColor, 3, 2);
    } else if (dir === 'up') {
      // Back of head (Spiky anime hair)
      p(7, hy - 2, hairColor, 14, 3);
      p(6, hy, hairColor, 16, 9);
      p(7, hy + 2, red, 14, 2);
      p(13, hy + 4, '#b07837', 2, 3); // Hair depth
    } else {
      // Side view
      const isRight = dir === 'right';
      p(isRight ? 8 : 8, hy - 2, hairColor, 12, 3);
      p(isRight ? 7 : 7, hy, hairColor, 14, 8);
      p(isRight ? 8 : 8, hy + 2, red, 12, 2);

      const fx = isRight ? 13 : 9;
      p(fx, hy + 4, skin, 6, 6);
      p(isRight ? 15 : 9, hy + 5, '#1b2d42', 2, 3);
      p(isRight ? 15 : 9, hy + 5, '#ffffff', 1, 1);
    }

    // 2. Torso: Swordsman Steel Pauldrons & Tunic
    const ty = 13 + walkBob + baseY;
    p(8, ty, tunicColor, 12, 8);

    // Pauldrons (Left & Right)
    p(6, ty, iron, 3, 4);
    p(6, ty, ironLight, 3, 1);
    p(19, ty, iron, 3, 4);
    p(19, ty, ironLight, 3, 1);

    // Leather belt with gold buckle
    p(8, ty + 7, leather, 12, 2);
    p(13, ty + 7, gold, 2, 2);

    // Swordsman Sword on Back/Hip
    if (dir === 'down' || dir === 'left') {
      // Sword hilt over right shoulder
      p(21, ty - 4, ironLight, 2, 6);
      p(20, ty - 2, gold, 4, 1); // Crossguard
      p(21, ty + 2, leather, 2, 8); // Scabbard
    }

    // 3. Legs & Sitting Pose
    const ly = 22 + walkBob + baseY;

    if (isSitting) {
      // Crossed legs sitting on the cobblestones (Classic /sit)
      p(6, ly - 1, leather, 16, 4);
      p(5, ly + 2, boots, 6, 3);
      p(17, ly + 2, boots, 6, 3);
    } else if (dir === 'down' || dir === 'up') {
      // Walking / Standing
      p(9, ly, leather, 4, 6 + legStep);
      p(8, ly + 6 + legStep, boots, 5, 3);

      p(15, ly, leather, 4, 6 - legStep);
      p(15, ly + 6 - legStep, boots, 5, 3);
    } else {
      // Side walk
      p(10 + legStep, ly, leather, 4, 6);
      p(10 + legStep, ly + 6, boots, 5, 3);

      p(14 - legStep, ly, leather, 4, 5);
      p(14 - legStep, ly + 5, boots, 5, 3);
    }
  }
}

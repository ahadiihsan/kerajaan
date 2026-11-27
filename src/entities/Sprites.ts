import * as THREE from 'three';
import { pick, rand, shade } from '../utils/math';
import { cnv, ctex, line, pixelize } from '../utils/canvas';
import { BOW_IDLE_FRAME, BOW_RAISE_FRAME, FISH_CAST_FRAME, FISH_HOLD_FRAME } from './TravelerFrames';

export type CharacterRole =
  | 'Guard'
  | 'Blacksmith'
  | 'Merchant'
  | 'Farmer'
  | 'Bard'
  | 'Priest'
  | 'Imam'
  | 'Child'
  | 'Townsfolk'
  | 'Traveler';

export interface CharacterLook {
  role: CharacterRole;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  long?: boolean;
  tabard?: string;
  trim?: string;
  hat?: 'helm' | 'band' | 'brim' | 'straw' | 'feather' | 'turban';
  hatCol?: string;
  apron?: string;
  beard?: boolean;
  robe?: boolean;
  pack?: boolean;
  lute?: boolean;
  dress?: boolean;
}

export interface TravelerPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hatCol: string;
}

export const DEFAULT_TRAVELER_PALETTE: TravelerPalette = {
  skin: '#c68a5e',
  hair: '#3b2416',
  shirt: '#3f91a0',
  pants: '#333a54',
  hatCol: '#274c69',
};

export const TRAVELER_PALETTES: TravelerPalette[] = [
  DEFAULT_TRAVELER_PALETTE,
  { skin: '#f1c7a0', hair: '#6b3e1f', shirt: '#a8453a', pants: '#3a3448', hatCol: '#5e2420' },
  { skin: '#e0ac83', hair: '#e3c060', shirt: '#4f8a4b', pants: '#3b2e23', hatCol: '#2b5230' },
  { skin: '#f5d6b8', hair: '#1d1a22', shirt: '#6c4fa0', pants: '#2d2b3e', hatCol: '#412d68' },
  { skin: '#c68a5e', hair: '#c94a2a', shirt: '#c07a32', pants: '#3b2f26', hatCol: '#6e4219' },
  { skin: '#8d5a3b', hair: '#8a8a8a', shirt: '#3a6fa8', pants: '#2a3040', hatCol: '#1f3e60' },
];

export function makeLook(role: Exclude<CharacterRole, 'Traveler'>): CharacterLook {
  const L: CharacterLook = {
    role,
    skin: pick(['#f1c7a0', '#e0ac83', '#c68a5e', '#8d5a3b', '#f5d6b8']),
    hair: pick(['#3b2416', '#6b3e1f', '#a8642a', '#e3c060', '#1d1a22', '#8a8a8a', '#c94a2a']),
    shirt: '#4e7bbf',
    pants: '#4b3a2a',
    shoes: '#2a1d14',
    long: rand() < 0.4,
  };
  const S: Record<Exclude<CharacterRole, 'Traveler'>, Partial<CharacterLook>> = {
    Guard: { shirt: '#7c838c', pants: '#3a3f47', tabard: '#a82828', trim: '#e8c34a', hat: 'helm' },
    Blacksmith: { shirt: '#7a4a2a', pants: '#3a2a1e', apron: '#4a2e1c', hat: 'band', long: false, beard: true },
    Merchant: {
      shirt: pick(['#6b3fa0', '#2f7a5a', '#a0552f']),
      hat: 'brim',
      hatCol: pick(['#5a2f80', '#2a4a6a', '#7a3a1a']),
      robe: true,
      pack: true,
    },
    Farmer: { shirt: pick(['#c9b26a', '#8aa05a', '#b0703a']), pants: '#5a4a8a', hat: 'straw' },
    Bard: { shirt: '#2f8a7a', pants: '#a83a5a', hat: 'feather', hatCol: '#a83a5a', lute: true },
    Priest: { shirt: '#ece6d6', robe: true, trim: '#d4af37', long: false, hair: '#9a9a9a' },
    Imam: { shirt: '#f2ece0', robe: true, trim: '#2b8078', long: false, beard: true, hair: '#4a3a2c', hat: 'turban', hatCol: '#f5f2e8' },
    Child: { shirt: pick(['#e05a5a', '#5ab0e0', '#e0c05a', '#7ac05a']) },
    Townsfolk: {
      shirt: pick(['#c0504d', '#4f81bd', '#9bbb59', '#8064a2', '#f79646', '#d9b36c']),
      dress: rand() < 0.5,
      pants: pick(['#4b3a2a', '#3a4a6a', '#5a3a3a']),
    },
  };
  return Object.assign(L, S[role]);
}

export function drawChar(x: CanvasRenderingContext2D, ox: number, L: CharacterLook, f: number): void {
  const p = (c: string, X: number, Y: number, w = 1, h = 1) => {
    x.fillStyle = c;
    x.fillRect(ox + X, Y, w, h);
  };
  const act = f === 3 || f === 7;
  const dark = shade(L.shirt, -0.28);
  if (L.pack) p('#7a5a3a', 11, 13, 3, 5);
  const bow = L.role === 'Traveler' && f >= BOW_IDLE_FRAME && f < FISH_CAST_FRAME;
  const fishing = L.role === 'Traveler' && (f === FISH_CAST_FRAME || f === FISH_HOLD_FRAME);
  const aiming = bow && f >= BOW_RAISE_FRAME;
  const gait = bow ? (aiming ? 0 : f - BOW_IDLE_FRAME) : f >= 4 && f <= 6 ? f - 4 : f;
  if (L.robe || L.dress) {
    const sk = L.robe ? L.shirt : shade(L.shirt, -0.15);
    p(sk, 4, 16, 8, 4);
    p(sk, 3, 19, 10, 3);
    p(shade(sk, -0.25), 3, 21, 10, 1);
    p(L.shoes, gait === 1 ? 4 : 5, 22, 2, 1);
    p(L.shoes, gait === 2 ? 10 : 9, 22, 2, 1);
  } else if (gait === 1) {
    p(L.pants, 4, 19, 2, 4);
    p(L.shoes, 3, 23, 3, 1);
    p(L.pants, 10, 19, 2, 3);
    p(L.shoes, 10, 22, 2, 1);
  } else if (gait === 2) {
    p(L.pants, 4, 19, 2, 3);
    p(L.shoes, 4, 22, 2, 1);
    p(L.pants, 10, 19, 2, 4);
    p(L.shoes, 10, 23, 3, 1);
  } else {
    p(L.pants, 5, 19, 2, 4);
    p(L.pants, 9, 19, 2, 4);
    p(L.shoes, 5, 23, 2, 1);
    p(L.shoes, 9, 23, 2, 1);
  }

  p(L.shirt, 4, 12, 8, L.robe ? 8 : 7);
  p(dark, 11, 12, 1, 7);
  p(shade(L.shirt, 0.15), 5, 12, 6, 1);
  if (!L.robe && !L.dress) {
    p('#3a2618', 4, 17, 8, 1);
    p('#e9c46a', 7, 17);
  }
  if (L.apron) {
    p(L.apron, 5, 13, 6, 8);
    p(L.apron, 5, 12);
    p(L.apron, 10, 12);
  }
  if (L.tabard && L.trim) {
    p(L.tabard, 5, 12, 6, 7);
    p(L.trim, 7, 13, 2, 4);
    p(L.trim, 6, 14, 4, 1);
  }
  if ((L.role === 'Priest' || L.role === 'Imam') && L.trim) p(L.trim, 7, 12, 2, 10);

  if (aiming) {
    line(x, dark, ox + 5, 13, ox + 3, f === 15 ? 11 : 14, 2);
    line(x, L.shirt, ox + 10, 13, ox + 12, f === 17 ? 14 : 11);
    p(L.skin, f === 15 ? 5 : 3, f === 15 ? 11 : 14);
  } else if (fishing) {
    const handY = f === FISH_HOLD_FRAME ? 6 : 11;
    p(dark, 3, 13, 1, 4);
    p(L.skin, 3, 17);
    line(x, L.shirt, ox + 11, 13, ox + 13, 12, 2);
    line(x, L.shirt, ox + 13, 12, ox + 14, handY + 1);
    p(L.skin, 14, handY, 2, 2);
  } else if (act && L.role !== 'Guard') {
    p(dark, 3, 9, 1, 4);
    p(L.skin, 3, 8);
    p(dark, 12, 9, 1, 4);
    p(L.skin, 12, 8);
  } else if (act) {
    p(dark, 3, 13, 1, 4);
    p(L.skin, 3, 17);
    p(dark, 12, 9, 1, 4);
    p(L.skin, 12, 8);
  } else {
    const sw = gait === 1 ? 1 : gait === 2 ? -1 : 0;
    p(dark, 3, 13, 1, 4);
    p(L.skin, 3, 17 + (sw > 0 ? -1 : 0));
    p(dark, 12, 13, 1, 4);
    p(L.skin, 12, 17 + (sw < 0 ? -1 : 0));
  }

  p(L.skin, 5, 6, 6, 6);
  p(L.skin, 4, 8);
  p(L.skin, 11, 8);
  p('#1f1a2e', 6, 9);
  p('#1f1a2e', 9, 9);
  p(shade(L.skin, -0.2), 7, 11, 2, 1);
  p(L.hair, 5, 5, 6, 2);
  p(L.hair, 5, 7);
  p(L.hair, 10, 7);
  if (L.long) {
    p(L.hair, 4, 6, 1, 6);
    p(L.hair, 11, 6, 1, 6);
  }
  if (L.beard) {
    p(L.hair, 5, 10, 6, 2);
    p(L.skin, 7, 10, 2, 1);
  }

  switch (L.hat) {
    case 'helm':
      p('#b9c2cc', 4, 4, 8, 4);
      p('#e8eef5', 5, 4, 3, 1);
      p('#7d8792', 4, 7, 8, 1);
      p('#7d8792', 7, 8, 2, 2);
      p('#c0392b', 7, 1, 2, 3);
      break;
    case 'band':
      p('#b83a2a', 5, 6, 6, 1);
      p('#b83a2a', 11, 7);
      break;
    case 'brim':
      p(L.hatCol ?? '#3a3a5a', 5, 2, 6, 4);
      p('#e9c46a', 5, 5, 6, 1);
      p(shade(L.hatCol ?? '#3a3a5a', -0.25), 3, 6, 10, 1);
      break;
    case 'straw':
      p('#e3c56a', 5, 3, 6, 3);
      p('#a8452a', 5, 5, 6, 1);
      p('#d4b04f', 2, 6, 12, 1);
      break;
    case 'feather':
      p(L.hatCol ?? '#a83a5a', 5, 4, 6, 3);
      p(shade(L.hatCol ?? '#a83a5a', -0.25), 4, 6, 8, 1);
      line(x, '#f5f0e0', ox + 11, 1, ox + 12, 4);
      break;
    case 'turban':
      p(L.hatCol ?? '#f5f2e8', 4, 3, 8, 4);
      p(shade(L.hatCol ?? '#f5f2e8', -0.14), 5, 2, 6, 1);
      p(L.trim ?? '#2b8078', 4, 5, 8, 1);
      p('#e9c46a', 7, 4, 2, 1);
      break;
  }

  if (L.role === 'Guard') {
    p('#2f5aa8', 1, 13, 3, 5);
    p('#e9c46a', 2, 15);
    p('#1e3a70', 1, 17, 3, 1);
    if (act) {
      p('#e8eef5', 12, 1, 1, 7);
      p('#ffffff', 12, 1);
      p('#e9c46a', 11, 8, 3, 1);
    } else {
      p('#7a5a3a', 13, 4, 1, 18);
      p('#dfe6ee', 13, 1, 1, 3);
    }
  }
  if (bow) {
    const handY = aiming ? (f === 17 ? 14 : 11) : gait === 2 ? 16 : 17;
    const gripX = 13;
    const tipX = f === 15 ? 10 : 11;
    const half = aiming ? 5 : 4;
    line(x, '#f2d8a3', ox + tipX, handY - half, ox + (f === 15 ? 5 : tipX), handY);
    line(x, '#f2d8a3', ox + (f === 15 ? 5 : tipX), handY, ox + tipX, handY + half);
    for (const sign of [-1, 1]) {
      line(x, '#d88b43', ox + tipX, handY + sign * half, ox + gripX, handY + sign * 2);
      line(x, '#a96333', ox + gripX, handY + sign * 2, ox + gripX, handY);
    }
    if (f === 14 || f === 15) {
      line(x, '#faf1cf', ox + (f === 15 ? 5 : 10), handY, ox + 14, handY);
    }
    p(L.skin, 12, handY);
  } else if (L.role === 'Traveler' && f === 10) {
    line(x, '#a97545', ox + 4, 10, ox + 9, 17);
    p('#a2acb7', 3, 9, 3, 3);
  } else if (L.role === 'Traveler' && f >= 4 && f <= 8) {
    const [handX, handY, tipX, tipY] =
      f === 7 ? [10, 10, 5, 3] : f === 8 ? [11, 14, 13, 18] : [12, f === 5 ? 16 : 17, 13, 8];
    line(x, '#a97545', ox + handX, handY, ox + tipX, tipY);
    p('#a2acb7', tipX - 1, tipY - 1, 3, 3);
    p('#e2ecf3', tipX + 1, tipY - 1, 1, 3);
    p(L.skin, handX, handY);
  }
  if (L.role === 'Blacksmith') {
    if (act) {
      p('#7a5a3a', 13, 5, 1, 4);
      p('#5a5f68', 12, 3, 3, 2);
    } else {
      p('#7a5a3a', 13, 14, 1, 4);
      p('#5a5f68', 12, 13, 3, 2);
    }
  }
  if (L.role === 'Farmer') {
    if (act) {
      p('#e6c45a', 4, 5, 8, 3);
      p('#c99a32', 5, 7, 6, 1);
    } else {
      p('#7a5a3a', 13, 8, 1, 14);
      p('#9aa0a8', 12, 7, 3, 1);
    }
  }
  if (L.lute) {
    p('#6b4a2a', 9, 14);
    p('#6b4a2a', 10, 13);
    p('#6b4a2a', 11, 12);
    p('#b07a3a', 5, 15, 4, 3);
    p('#3a2618', 6, 16);
  }
  if (L.role === 'Priest' && !act) {
    p('#5a2a2a', 6, 15, 4, 3);
    p('#e9c46a', 7, 16);
  }
  if (L.role === 'Imam' && !act) {
    p('#2b8078', 6, 15, 4, 3);
    p('#e9c46a', 7, 16);
  }
  if (L.role === 'Merchant') p('#e9c46a', 10, 18, 2, 2);
}

const spriteGeo = new THREE.PlaneGeometry(1, 1.5);
spriteGeo.translate(0, 0.75, 0);

export interface SpriteBundle {
  sheet: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  mat: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;
}

export function characterSprite(scene: THREE.Scene, look: CharacterLook, frameCount = 4): SpriteBundle {
  const [sheet, ctx] = cnv(frameCount * 16, 24);
  for (let frame = 0; frame < frameCount; frame++) drawChar(ctx, frame * 16, look, frame);
  pixelize(ctx, sheet.width, 24);
  const tex = ctex(sheet, { rep: false, mip: false });
  tex.repeat.set(1 / frameCount, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(spriteGeo, mat);
  mesh.castShadow = true;
  scene.add(mesh);
  return { sheet, tex, mat, mesh };
}

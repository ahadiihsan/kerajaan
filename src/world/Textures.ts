import * as THREE from 'three';
import { pick, R, rand, RI, shade } from '../utils/math';
import { cnv, ctex, fr, line } from '../utils/canvas';
import { pixelize } from '../utils/canvas';

export interface WallTextureSet {
  map: THREE.CanvasTexture;
  emi: THREE.CanvasTexture;
  wins: Array<[number, number]>;
}

export interface GableTextureSet {
  map: THREE.CanvasTexture;
  emi: THREE.CanvasTexture;
}

export interface HousePalette {
  plaster: string;
  beam: string;
  shutter: string;
}

export interface ProceduralTextures {
  grass: THREE.CanvasTexture;
  cliff: THREE.CanvasTexture;
  soil: THREE.CanvasTexture;
  cobble: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  field: THREE.CanvasTexture;
  bed: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  falls: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  needles: THREE.CanvasTexture;
  thatch: THREE.CanvasTexture;
  stripes: THREE.CanvasTexture;
  tuft: THREE.CanvasTexture;
  wheat: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  arrow: THREE.CanvasTexture;
}

export interface SharedMaterials {
  grass: THREE.MeshLambertMaterial;
  cliff: THREE.MeshLambertMaterial;
  soil: THREE.MeshLambertMaterial;
  cobble: THREE.MeshLambertMaterial;
  dirt: THREE.MeshLambertMaterial;
  field: THREE.MeshLambertMaterial;
  bed: THREE.MeshLambertMaterial;
  water: THREE.MeshPhongMaterial;
  falls: THREE.MeshPhongMaterial;
  wood: THREE.MeshLambertMaterial;
  stone: THREE.MeshLambertMaterial;
  sandstone: THREE.MeshLambertMaterial;
  dark: THREE.MeshLambertMaterial;
  iron: THREE.MeshLambertMaterial;
  gold: THREE.MeshLambertMaterial;
  lantern: THREE.MeshLambertMaterial;
  needles: THREE.MeshLambertMaterial;
  trunk: THREE.MeshLambertMaterial;
  tuft: THREE.MeshLambertMaterial;
  wheat: THREE.MeshLambertMaterial;
  rock: THREE.MeshLambertMaterial;
  hay: THREE.MeshLambertMaterial;
  stripes: THREE.MeshLambertMaterial;
  [key: string]: THREE.Material;
}

export const shadowed = <T extends THREE.Object3D>(m: T, cast = true): T => {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

export function createTextures(): {
  TX: ProceduralTextures;
  MAT: SharedMaterials;
  roofMat: (k: string) => THREE.MeshLambertMaterial;
} {
  const TX = {} as ProceduralTextures;

  {
    const [c, x] = cnv(32, 32);
    const G = ['#5c9a3a', '#64a640', '#578f36', '#6fb049', '#4c8530'];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) {
        const r = rand();
        fr(x, G[r < 0.45 ? 0 : r < 0.68 ? 1 : r < 0.84 ? 2 : r < 0.95 ? 3 : 4], i, j);
      }
    }
    for (let k = 0; k < 26; k++) {
      const i = RI(0, 31);
      const j = RI(1, 30);
      fr(x, '#3f7529', i, j, 1, 2);
      fr(x, '#8ccf5e', i, j - 1);
    }
    for (let k = 0; k < 5; k++) fr(x, pick(['#fff3c4', '#ffd23f', '#f49ac1', '#bcd0ff']), RI(0, 31), RI(0, 31));
    TX.grass = ctex(c);
  }
  {
    const [c, x] = cnv(32, 24);
    const Rk = ['#8a7560', '#7c6853', '#6f5d4a', '#97826b'];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 24; j++) {
        const band = ((j + Math.round(Math.sin(i * 0.45) * 1.4)) >> 2) % 2;
        fr(x, shade(pick(Rk), band ? -0.1 : 0.03), i, j);
      }
    }
    for (let k = 0; k < 9; k++) {
      const w = RI(3, 6);
      const h = RI(2, 3);
      const X = RI(0, 31 - w);
      const Y = RI(7, 21 - h);
      fr(x, '#a08d76', X, Y, w, h);
      fr(x, '#bba892', X, Y, w, 1);
      fr(x, '#544538', X, Y + h, w, 1);
    }
    for (let i = 0; i < 32; i++) {
      const d = 2 + RI(0, 3) + (i % 9 === 0 ? 2 : 0);
      fr(x, '#5c9a3a', i, 0, 1, d);
      fr(x, '#79b850', i, 0, 1, 1);
      fr(x, '#355f22', i, d, 1, 1);
    }
    TX.cliff = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) fr(x, shade(j % 8 < 4 ? '#5a4030' : '#4a3426', R(-0.12, 0.08)), i, j);
    }
    for (let k = 0; k < 30; k++) fr(x, pick(['#7a6a5a', '#8f8072', '#3a2a20']), RI(0, 31), RI(0, 31), RI(1, 2), 1);
    TX.soil = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    const cols = ['#9a948a', '#8b857b', '#a8a196', '#7f7a72', '#b0a48e'];
    fr(x, '#4b4640', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let col = 0; col < 4; col++) {
        const X = col * 8 + off + RI(0, 1);
        const Y = row * 8 + RI(0, 1);
        const w = RI(6, 7);
        const h = RI(5, 6);
        const cc = pick(cols);
        for (const dx of [0, -32]) {
          fr(x, cc, X + dx + 1, Y, w - 2, h);
          fr(x, cc, X + dx, Y + 1, w, h - 2);
          fr(x, shade(cc, 0.28), X + dx + 1, Y, w - 2, 1);
          fr(x, shade(cc, -0.32), X + dx + 1, Y + h - 1, w - 2, 1);
        }
      }
    }
    TX.cobble = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) fr(x, shade('#9a7650', R(-0.1, 0.06)), i, j);
    for (let k = 0; k < 24; k++) fr(x, pick(['#b8a07a', '#6e5236', '#c9b38c']), RI(0, 31), RI(0, 31), RI(1, 2), 1);
    TX.dirt = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) fr(x, shade('#6e5034', R(-0.1, 0.05)), i, j);
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 32; i++) {
        if (rand() < 0.15) continue;
        const y = row * 4;
        const h = RI(2, 3);
        fr(x, pick(['#e0b84a', '#c99a32', '#f2d27a', '#d6aa3e']), i, y + 3 - h, 1, h);
        if (rand() < 0.3) fr(x, '#fbe7a0', i, y + 3 - h);
      }
    }
    TX.field = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) fr(x, shade('#7d6d4c', R(-0.12, 0.08)), i, j);
    for (let k = 0; k < 40; k++) {
      const cc = pick(['#9c8f78', '#5f5444', '#b0a48a']);
      fr(x, cc, RI(0, 30), RI(0, 30), 2, 2);
    }
    TX.bed = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 32; j++) fr(x, shade(j % 16 < 8 ? '#2f6fb3' : '#3478be', R(-0.06, 0.05)), i, j);
    }
    for (let k = 0; k < 22; k++) {
      const X = RI(0, 28);
      const Y = RI(0, 31);
      fr(x, rand() < 0.25 ? '#e8f6ff' : '#8fc7ff', X, Y, RI(2, 4), 1);
    }
    TX.water = ctex(c);
    TX.falls = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    for (let row = 0; row < 8; row++) {
      const base = pick(['#8a5a33', '#7a4e2b', '#9b6a3d', '#845530']);
      for (let i = 0; i < 32; i++) {
        for (let j = 0; j < 4; j++) fr(x, shade(base, R(-0.06, 0.06) + (j === 0 ? 0.12 : 0)), i, row * 4 + j);
      }
      fr(x, '#3a2414', 0, row * 4 + 3, 32, 1);
      const s = RI(4, 28);
      fr(x, '#3a2414', s, row * 4, 1, 3);
      fr(x, '#c9c2b0', s - 2, row * 4 + 1);
    }
    TX.wood = ctex(c);
  }
  {
    const [c, x] = cnv(32, 32);
    fr(x, '#5e5a54', 0, 0, 32, 32);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 4 : 0;
      for (let col = -1; col < 4; col++) {
        const X = col * 8 + off;
        const Y = row * 4;
        const cc = shade(pick(['#9a958c', '#8a857c', '#a8a297', '#7d786f']), R(-0.06, 0.06));
        fr(x, cc, X, Y, 7, 3);
        fr(x, shade(cc, 0.2), X, Y, 7, 1);
      }
    }
    for (let k = 0; k < 10; k++) fr(x, pick(['#5d7a3a', '#6f8f45']), RI(0, 31), RI(20, 31));
    TX.stone = ctex(c);
  }
  {
    const [c, x] = cnv(16, 16);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        fr(x, (i + j) % 4 === 0 ? '#3d7a3c' : pick(['#22502c', '#2a5d33', '#1d4527', '#2f6a37']), i, j);
      }
    }
    TX.needles = ctex(c);
  }
  {
    const [c, x] = cnv(16, 16);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) fr(x, pick(['#c9a24f', '#b48a3c', '#dcb866', '#a67c32']), i, j);
    }
    for (let j = 0; j < 16; j += 4) fr(x, '#8a6428', 0, j + 3, 16, 1);
    TX.thatch = ctex(c);
  }
  {
    const [c, x] = cnv(16, 16);
    for (let i = 0; i < 16; i++) fr(x, (i >> 2) % 2 ? '#f4ead2' : '#c0392b', i, 0, 1, 16);
    for (let i = 0; i < 16; i++) if (i % 2) fr(x, '#7a1f17', i, 15);
    TX.stripes = ctex(c, { mip: false });
  }
  {
    const [c, x] = cnv(16, 16);
    for (let k = 0; k < 9; k++) {
      const X = RI(2, 13);
      const h = RI(5, 12);
      line(x, pick(['#4f8a33', '#64a640', '#3f7529', '#79b850']), X, 15, X + RI(-2, 2), 15 - h);
    }
    if (rand() < 1) {
      fr(x, '#ffd23f', 4, 6);
      fr(x, '#f49ac1', 11, 4);
    }
    TX.tuft = ctex(c, { rep: false, mip: false });
  }
  {
    const [c, x] = cnv(16, 16);
    for (let k = 0; k < 7; k++) {
      const X = 1 + k * 2 + RI(0, 1);
      const h = RI(9, 14);
      line(x, '#c99a32', X, 15, X, 15 - h);
      fr(x, '#f2d27a', X - 1, 15 - h, 2, 3);
      fr(x, '#e0b84a', X, 14 - h, 1, 1);
    }
    TX.wheat = ctex(c, { rep: false, mip: false });
  }
  {
    const [c, x] = cnv(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    TX.glow = new THREE.CanvasTexture(c);
    TX.glow.colorSpace = THREE.SRGBColorSpace;
  }
  {
    const [c, x] = cnv(9, 8);
    for (let r = 0; r < 5; r++) fr(x, r < 1 ? '#fff3b0' : '#e9c46a', r, r + 1, 9 - 2 * r, 1);
    pixelize(x, 9, 8, '#2a1c08');
    TX.arrow = ctex(c, { rep: false, mip: false });
  }

  const MAT: SharedMaterials = {
    grass: new THREE.MeshLambertMaterial({ map: TX.grass }),
    cliff: new THREE.MeshLambertMaterial({ map: TX.cliff }),
    soil: new THREE.MeshLambertMaterial({ map: TX.soil }),
    cobble: new THREE.MeshLambertMaterial({ map: TX.cobble }),
    dirt: new THREE.MeshLambertMaterial({ map: TX.dirt }),
    field: new THREE.MeshLambertMaterial({ map: TX.field }),
    bed: new THREE.MeshLambertMaterial({ map: TX.bed }),
    water: new THREE.MeshPhongMaterial({
      map: TX.water,
      transparent: true,
      opacity: 0.8,
      shininess: 90,
      specular: 0x8fb4d8,
      depthWrite: false,
    }),
    falls: new THREE.MeshPhongMaterial({
      map: TX.falls,
      transparent: true,
      opacity: 0.88,
      shininess: 40,
      specular: 0x8fb4d8,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    wood: new THREE.MeshLambertMaterial({ map: TX.wood }),
    stone: new THREE.MeshLambertMaterial({ map: TX.stone }),
    sandstone: new THREE.MeshLambertMaterial({ color: 0xeadcc0 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x3a2a1e }),
    iron: new THREE.MeshLambertMaterial({ color: 0x3b3f47 }),
    gold: new THREE.MeshLambertMaterial({ color: 0xe9c46a, emissive: 0x6a4a10 }),
    lantern: new THREE.MeshLambertMaterial({ color: 0x3a2a1e, emissive: 0xffb04a, emissiveIntensity: 0 }),
    needles: new THREE.MeshLambertMaterial({ map: TX.needles, flatShading: true }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x5a3a24, flatShading: true }),
    tuft: new THREE.MeshLambertMaterial({ map: TX.tuft, alphaTest: 0.5, side: THREE.DoubleSide }),
    wheat: new THREE.MeshLambertMaterial({ map: TX.wheat, alphaTest: 0.5, side: THREE.DoubleSide }),
    rock: new THREE.MeshLambertMaterial({ map: TX.stone, flatShading: true }),
    hay: new THREE.MeshLambertMaterial({ map: TX.thatch }),
    stripes: new THREE.MeshLambertMaterial({ map: TX.stripes, side: THREE.DoubleSide }),
  };

  const roofTex = (base: string): THREE.CanvasTexture => {
    if (base === 'thatch') return TX.thatch;
    const [c, x] = cnv(32, 32);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 4 : 0;
      for (let col = -1; col < 4; col++) {
        const X = col * 8 + off;
        const Y = row * 4;
        const cc = shade(base, R(-0.12, 0.08));
        fr(x, cc, X, Y, 8, 4);
        fr(x, shade(base, 0.22), X, Y, 8, 1);
        fr(x, shade(base, -0.35), X + 7, Y, 1, 4);
      }
      fr(x, shade(base, -0.5), 0, row * 4 + 3, 32, 1);
    }
    return ctex(c);
  };

  const roofMats: Record<string, THREE.MeshLambertMaterial> = {};
  const roofMat = (k: string): THREE.MeshLambertMaterial =>
    roofMats[k] || (roofMats[k] = new THREE.MeshLambertMaterial({ map: roofTex(k), side: THREE.DoubleSide }));

  return { TX, MAT, roofMat };
}

export function timberWall(
  wu: number,
  hu: number,
  kind: 'front' | 'back' | 'side',
  pal: HousePalette
): WallTextureSet {
  const pw = Math.round(wu * 16);
  const ph = Math.round(hu * 16);
  const [c, x] = cnv(pw, ph);
  const [ec, ex] = cnv(pw, ph);
  const wins: Array<[number, number]> = [];
  fr(ex, '#000', 0, 0, pw, ph);
  for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) fr(x, shade(pal.plaster, R(-0.07, 0.03)), i, j);
  const B = pal.beam;
  const mid = Math.round(ph * 0.47);
  const posts = [0];
  const np = Math.max(2, Math.round(pw / 12));
  for (let k = 1; k < np; k++) posts.push(Math.round((k * pw) / np) - 1);
  posts.push(pw - 2);
  for (let k = 0; k < posts.length - 1; k++) {
    if (rand() < 0.65) {
      const a = posts[k] + 2;
      const b = posts[k + 1] - 1;
      if (k % 2) line(x, B, a, mid + 2, b, ph - 6);
      else line(x, B, a, ph - 6, b, mid + 2);
    }
  }
  for (const X of posts) fr(x, B, X, 0, 2, ph - 4);
  fr(x, B, 0, 0, pw, 2);
  fr(x, B, 0, mid, pw, 2);
  for (let i = 0; i < pw; i += 4) fr(x, shade('#8d867a', R(-0.15, 0.1)), i, ph - 4, 4, 4);
  fr(x, '#4d4840', 0, ph - 5, pw, 1);

  const win = (X: number, Y: number, w = 6, h = 6) => {
    X = Math.round(X);
    Y = Math.round(Y);
    fr(x, pal.shutter, X - 3, Y - 1, 2, h + 2);
    fr(x, pal.shutter, X + w + 1, Y - 1, 2, h + 2);
    fr(x, '#2a1c12', X - 1, Y - 1, w + 2, h + 2);
    fr(x, '#2b3a50', X, Y, w, h);
    fr(x, '#56789c', X, Y, w, 1);
    fr(x, '#2a1c12', X + (w >> 1), Y, 1, h);
    fr(x, '#2a1c12', X, Y + (h >> 1), w, 1);
    fr(ex, '#ffd9a0', X, Y, w, h);
    fr(ex, '#000', X + (w >> 1), Y, 1, h);
    fr(ex, '#000', X, Y + (h >> 1), w, 1);
    fr(x, '#6b4226', X - 1, Y + h + 1, w + 2, 1);
    for (let q = 0; q < w + 2; q += 2) {
      fr(x, pick(['#e0454f', '#f2c94c', '#f28ab2', '#ffffff']), X - 1 + q, Y + h, 1, 1);
    }
    wins.push([(X + w / 2) / pw, 1 - (Y + h / 2) / ph]);
  };

  if (kind === 'front') {
    const dw = 8;
    const dh = Math.min(14, ph - mid - 4);
    const dx = Math.round(pw / 2 - dw / 2);
    const dy = ph - 4 - dh;
    fr(x, '#2a1c12', dx - 1, dy - 1, dw + 2, dh + 1);
    for (let q = 0; q < dw; q++) fr(x, shade('#6a4428', q % 3 === 0 ? -0.25 : R(-0.05, 0.08)), dx + q, dy, 1, dh);
    fr(x, pal.plaster, dx - 1, dy - 1);
    fr(x, pal.plaster, dx + dw, dy - 1);
    fr(x, '#e9c46a', dx + dw - 2, dy + (dh >> 1));
    win(pw * 0.24 - 3, 4);
    win(pw * 0.76 - 3, 4);
    if (pw >= 40) {
      win(5, mid + 5);
      win(pw - 11, mid + 5);
    }
  } else if (kind === 'back') {
    win(pw * 0.24 - 3, 4);
    win(pw * 0.76 - 3, 4);
    win(pw / 2 - 3, mid + 5);
  } else {
    win(pw / 2 - 3, 4);
    if (rand() < 0.6) win(pw / 2 - 3, mid + 5);
  }

  return { map: ctex(c, { rep: false, mip: false }), emi: ctex(ec, { rep: false, mip: false }), wins };
}

export function gableTex(wu: number, hu: number, pal: HousePalette | null, stone = false): GableTextureSet {
  const pw = Math.round(wu * 16);
  const ph = Math.max(8, Math.round(hu * 16));
  const [c, x] = cnv(pw, ph);
  const [ec, ex] = cnv(pw, ph);
  fr(ex, '#000', 0, 0, pw, ph);
  for (let i = 0; i < pw; i++) {
    for (let j = 0; j < ph; j++) {
      fr(
        x,
        stone
          ? shade(((j >> 2) + (i >> 3)) % 2 ? '#9a958c' : '#8a857c', R(-0.06, 0.06))
          : shade(pal!.plaster, R(-0.07, 0.03)),
        i,
        j
      );
    }
  }
  const B = stone ? '#5e5a54' : pal!.beam;
  if (!stone) {
    fr(x, B, 0, ph - 2, pw, 2);
    fr(x, B, (pw >> 1) - 1, 0, 2, ph);
  }
  const X = (pw >> 1) - 2;
  const Y = Math.round(ph * 0.45);
  fr(x, '#2a1c12', X - 1, Y - 1, 6, 6);
  fr(x, stone ? '#4f3a7a' : '#2b3a50', X, Y, 4, 4);
  fr(ex, stone ? '#c9a0ff' : '#ffd9a0', X, Y, 4, 4);
  return { map: ctex(c, { rep: false, mip: false }), emi: ctex(ec, { rep: false, mip: false }) };
}

export function stoneWall(
  wu: number,
  hu: number,
  o: { arches?: Array<[number, number, number, number, boolean?]>; door?: boolean } = {}
): WallTextureSet {
  const pw = Math.round(wu * 16);
  const ph = Math.round(hu * 16);
  const [c, x] = cnv(pw, ph);
  const [ec, ex] = cnv(pw, ph);
  const wins: Array<[number, number]> = [];
  fr(ex, '#000', 0, 0, pw, ph);
  fr(x, '#5e5a54', 0, 0, pw, ph);
  for (let row = 0; row * 4 < ph; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col * 8 < pw; col++) {
      const cc = shade(pick(['#a39e94', '#938e84', '#b0aa9e', '#87827a']), R(-0.05, 0.05));
      fr(x, cc, col * 8 + off, row * 4, 7, 3);
      fr(x, shade(cc, 0.18), col * 8 + off, row * 4, 7, 1);
    }
  }
  for (let k = 0; k < pw; k++) if (rand() < 0.35) fr(x, pick(['#5d7a3a', '#6f8f45']), k, ph - RI(1, 4), 1, RI(1, 3));
  const glass = ['#d94f4f', '#4f7fd9', '#e6c84f', '#4fbf7a', '#a05fd0'];
  const arch = (X: number, Y: number, w: number, h: number, stained: boolean) => {
    X = Math.round(X);
    Y = Math.round(Y);
    fr(x, '#3a3430', X - 1, Y - 1, w + 2, h + 2);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (j < 2 && (i === 0 || i === w - 1)) continue;
        const col = stained ? glass[((i >> 1) + (j >> 1) * 3 + X) % glass.length] : '#1d1a24';
        fr(x, stained ? shade(col, -0.35) : col, X + i, Y + j);
        if (stained) fr(ex, col, X + i, Y + j);
      }
    }
    if (stained) {
      fr(x, '#2a2420', X + (w >> 1), Y, 1, h);
      fr(ex, '#000', X + (w >> 1), Y, 1, h);
      wins.push([(X + w / 2) / pw, 1 - (Y + h / 2) / ph]);
    }
  };
  (o.arches || []).forEach(([u, v, w, h, s]) => arch(u * pw - w / 2, v * ph, w, h, s !== false));
  if (o.door) {
    const w = 10;
    const h = Math.min(18, ph - 4);
    const X = Math.round(pw / 2 - w / 2);
    const Y = ph - h;
    fr(x, '#3a3430', X - 1, Y - 1, w + 2, h + 1);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (j < 2 && (i < 2 || i > w - 3)) continue;
        fr(x, shade('#6a4428', i % 5 === 0 ? -0.3 : R(-0.05, 0.06)), X + i, Y + j);
      }
    }
    fr(x, '#2a1c12', X + (w >> 1), Y, 1, h);
    for (let j = 3; j < h; j += 5) {
      fr(x, '#9aa0a8', X + 1, Y + j);
      fr(x, '#9aa0a8', X + w - 2, Y + j);
    }
  }
  return { map: ctex(c, { rep: false, mip: false }), emi: ctex(ec, { rep: false, mip: false }), wins };
}

export function mosqueWall(
  wu: number,
  hu: number,
  o: { arches?: Array<[number, number, number, number, boolean?]>; door?: boolean } = {}
): WallTextureSet {
  const pw = Math.round(wu * 16);
  const ph = Math.round(hu * 16);
  const [c, x] = cnv(pw, ph);
  const [ec, ex] = cnv(pw, ph);
  const wins: Array<[number, number]> = [];
  fr(ex, '#000', 0, 0, pw, ph);
  fr(x, '#b9a88a', 0, 0, pw, ph);
  for (let row = 0; row * 4 < ph; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col * 8 < pw; col++) {
      const cc = shade(pick(['#efe4cb', '#e5d6b7', '#f4ecd8', '#dccaa7']), R(-0.04, 0.04));
      fr(x, cc, col * 8 + off, row * 4, 7, 3);
      fr(x, shade(cc, 0.14), col * 8 + off, row * 4, 7, 1);
    }
  }
  if (ph >= 12) {
    for (let i = 0; i < pw; i++) {
      fr(x, i % 2 === 0 ? '#2b8078' : '#37998f', i, 2, 1, 2);
      if (i % 4 === 0) fr(x, '#d8b24c', i, 2, 2, 1);
    }
    fr(x, '#968468', 0, 4, pw, 1);
  }
  fr(x, '#cbb895', 0, ph - 3, pw, 3);

  const glass = ['#2fb4a6', '#f0c452', '#5893d4', '#f7e6b0'];
  const arch = (X: number, Y: number, w: number, h: number, stained: boolean) => {
    X = Math.round(X);
    Y = Math.round(Y);
    fr(x, '#7d6c52', X - 1, Y - 1, w + 2, h + 2);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (j === 0 && (i === 0 || i === w - 1)) continue;
        if (j === 1 && w >= 5 && (i === 0 || i === w - 1)) continue;
        const col = stained ? glass[((i >> 1) + (j >> 1) * 2 + X) % glass.length] : '#231e18';
        fr(x, stained ? shade(col, -0.3) : col, X + i, Y + j);
        if (stained) fr(ex, col, X + i, Y + j);
      }
    }
    if (stained) {
      fr(x, '#4d3e2c', X + (w >> 1), Y, 1, h);
      fr(ex, '#000', X + (w >> 1), Y, 1, h);
      wins.push([(X + w / 2) / pw, 1 - (Y + h / 2) / ph]);
    }
  };
  (o.arches || []).forEach(([u, v, w, h, s]) => arch(u * pw - w / 2, v * ph, w, h, s !== false));

  if (o.door) {
    const w = 10;
    const h = Math.min(18, ph - 6);
    const X = Math.round(pw / 2 - w / 2);
    const Y = ph - h;
    fr(x, '#2b8078', X - 2, Y - 2, w + 4, 2);
    fr(x, '#7d6c52', X - 1, Y - 1, w + 2, h + 1);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (j < 2 && (i < 2 || i > w - 3)) continue;
        fr(x, shade('#6e4324', i % 5 === 0 ? -0.28 : R(-0.04, 0.06)), X + i, Y + j);
      }
    }
    fr(x, '#2a1c12', X + (w >> 1), Y, 1, h);
    fr(x, '#e9c46a', X + (w >> 1) - 1, Y + (h >> 1));
    fr(x, '#e9c46a', X + (w >> 1) + 1, Y + (h >> 1));
  }
  return { map: ctex(c, { rep: false, mip: false }), emi: ctex(ec, { rep: false, mip: false }), wins };
}

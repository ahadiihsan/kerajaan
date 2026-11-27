import * as THREE from 'three';
import { clamp, lerp, R, V3 } from '../utils/math';
import { idx, T, TH, WorldGrid, wx, wz, type TileCoord } from '../world/WorldGrid';
import type { SharedMaterials, ProceduralTextures } from '../world/Textures';
import type { WorldBuildings } from '../world/Buildings';
import type { WorldVegetation } from '../world/Vegetation';
import type { Pool } from '../core/Particles';
import type { Villager } from './Villager';
import { characterSprite, DEFAULT_TRAVELER_PALETTE, type TravelerPalette } from './Sprites';

export const STRIKES_TO_FELL = 3;
export const HOUSE_WOOD_COST = 6;

export type MoveDirection = 'up' | 'left' | 'down' | 'right';
export const MOVE_KEYS = new Map<string, MoveDirection>([
  ['KeyW', 'up'],
  ['ArrowUp', 'up'],
  ['KeyA', 'left'],
  ['ArrowLeft', 'left'],
  ['KeyS', 'down'],
  ['ArrowDown', 'down'],
  ['KeyD', 'right'],
  ['ArrowRight', 'right'],
]);
export const MOVE_DIRECTIONS: Record<MoveDirection, TileCoord> = {
  up: [0, -1],
  left: [-1, 0],
  down: [0, 1],
  right: [1, 0],
};
export const HERO_NEIGHBORS: TileCoord[] = Object.values(MOVE_DIRECTIONS);

export interface WoodDrop {
  id: string;
  mesh: THREE.Group;
  origin: THREE.Vector3;
  i: number;
  j: number;
  quantity: number;
  age: number;
}

export interface BuildingSite {
  i: number;
  j: number;
  mesh: THREE.Group;
  stored: number;
}

export type HeroInteraction =
  | { kind: 'chop'; target: number; elapsed: number }
  | { kind: 'loot'; target: WoodDrop; elapsed: number }
  | { kind: 'build'; target: BuildingSite; elapsed: number };

export interface HeroCoopBridge {
  isConnected: () => boolean;
  sendTreeHit: (treeIndex: number) => void;
  sendWoodLoot: (dropId: string) => void;
  sendBlueprintPlace: (i: number, j: number) => void;
  sendWoodDeposit: (amount: number) => void;
}

export class HeroController {
  public readonly sheet: HTMLCanvasElement;
  public readonly tex: THREE.CanvasTexture;
  public readonly mat: THREE.MeshBasicMaterial;
  public readonly mesh: THREE.Mesh;
  public readonly marker: THREE.Sprite;

  public name = 'Rowan';
  public i: number;
  public j: number;
  public x: number;
  public z: number;
  public face: 1 | -1 = 1;
  public frame = 0;
  public crouch = 0;
  public swing = 0;
  public walkTime = 0;
  public step: { dx: number; dz: number; progress: number } | null = null;
  public path: TileCoord[] = [];
  public wood = 0;

  public readonly heldMoves = new Map<string, MoveDirection>();
  public queuedMove: MoveDirection | null = null;
  public axeEquipped = false;
  public placingBlueprint = false;
  public buildingSite: BuildingSite | null = null;
  public readonly woodDrops: WoodDrop[] = [];
  public interaction: HeroInteraction | null = null;

  private readonly scene: THREE.Scene;
  private readonly grid: WorldGrid;
  private readonly buildings: WorldBuildings;
  private readonly vegetation: WorldVegetation;
  private readonly fxNorm: Pool;
  private readonly logGeometry: THREE.CylinderGeometry;
  private readonly logMaterials: THREE.Material[];
  private readonly blueprintInk = new THREE.MeshBasicMaterial({ color: 0x56b8fc });
  private readonly blueprintLine = new THREE.BoxGeometry(1, 0.025, 0.055);
  private readonly toast: (msg: string, ms?: number) => void;
  private readonly focusHero: () => void;
  private readonly villagers: Villager[];
  private readonly coop: HeroCoopBridge;

  public onBuildStatusChange?: () => void;
  public onChopProgressChange?: (treeHits: number | null) => void;
  public onBlueprintModeChange?: (active: boolean) => void;

  constructor(opts: {
    scene: THREE.Scene;
    grid: WorldGrid;
    buildings: WorldBuildings;
    vegetation: WorldVegetation;
    TX: ProceduralTextures;
    MAT: SharedMaterials;
    fxNorm: Pool;
    villagers: Villager[];
    toast: (msg: string, ms?: number) => void;
    focusHero: () => void;
    coop: HeroCoopBridge;
    palette?: TravelerPalette;
  }) {
    this.scene = opts.scene;
    this.grid = opts.grid;
    this.buildings = opts.buildings;
    this.vegetation = opts.vegetation;
    this.fxNorm = opts.fxNorm;
    this.villagers = opts.villagers;
    this.toast = opts.toast;
    this.focusHero = opts.focusHero;
    this.coop = opts.coop;

    const pal = opts.palette ?? DEFAULT_TRAVELER_PALETTE;
    const sprite = characterSprite(
      opts.scene,
      {
        role: 'Traveler',
        skin: pal.skin,
        hair: pal.hair,
        shirt: pal.shirt,
        pants: pal.pants,
        shoes: '#2a1d14',
        hat: 'brim',
        hatCol: pal.hatCol,
        pack: true,
      },
      11
    );
    this.sheet = sprite.sheet;
    this.tex = sprite.tex;
    this.mat = sprite.mat;
    this.mesh = sprite.mesh;

    const [spawnI, spawnJ] = opts.grid.reachList[0] ?? [22, 25];
    this.i = spawnI;
    this.j = spawnJ;
    this.x = wx(spawnI);
    this.z = wz(spawnJ);

    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: opts.TX.arrow, depthTest: false, transparent: true })
    );
    this.marker.scale.set(0.36, 0.32, 1);
    this.marker.renderOrder = 8;
    opts.scene.add(this.marker);

    this.logGeometry = new THREE.CylinderGeometry(0.13, 0.15, 0.66, 7);
    const logEnds = new THREE.MeshLambertMaterial({ color: 0xd4a46d });
    this.logMaterials = [opts.MAT.trunk, logEnds, logEnds];
  }

  public setSpawnTile(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.i = Math.floor(x + 22);
    this.j = Math.floor(z + 22);
    this.step = null;
    this.path = [];
  }

  public clearMovement(): void {
    this.heldMoves.clear();
    this.queuedMove = null;
  }

  public setBlueprintMode(active: boolean): void {
    this.placingBlueprint = active;
    this.onBlueprintModeChange?.(active);
    if (active) this.toast('Choose a clear, flat 3 × 3 area with room for a south-facing entrance.');
  }

  public routeToTile(i: number, j: number): TileCoord[] | null {
    const startI = this.i + (this.step?.dx ?? 0);
    const startJ = this.j + (this.step?.dz ?? 0);
    return this.grid.findPath(startI, startJ, i, j, HERO_NEIGHBORS);
  }

  public routeBeside(i: number, j: number): TileCoord[] | null {
    const startI = this.i + (this.step?.dx ?? 0);
    const startJ = this.j + (this.step?.dz ?? 0);
    let shortest: TileCoord[] | null = null;
    for (const [dx, dz] of HERO_NEIGHBORS) {
      const fromI = i - dx;
      const fromJ = j - dz;
      if (
        !this.grid.walkable(fromI, fromJ) ||
        this.grid.exitLv(idx(fromI, fromJ), dx, dz) !== this.grid.baseLv(idx(i, j))
      ) {
        continue;
      }
      const route = this.grid.findPath(startI, startJ, fromI, fromJ, HERO_NEIGHBORS);
      if (route && (!shortest || route.length < shortest.length)) shortest = route;
    }
    return shortest;
  }

  public walkToMapTile(i: number, j: number): void {
    const path = this.routeToTile(i, j);
    if (!path) {
      this.toast('That tile is unreachable.', 1500);
      return;
    }
    this.clearMovement();
    this.cancelInteraction();
    this.path = path;
    this.focusHero();
  }

  public isBlueprintTile(i: number, j: number): boolean {
    return !!this.buildingSite && Math.abs(i - this.buildingSite.i) <= 1 && Math.abs(j - this.buildingSite.j) <= 1;
  }

  public placeBlueprint(i: number, j: number): void {
    if (this.buildingSite) {
      this.toast('Finish the current house before placing another blueprint.');
      return;
    }
    const inside = (x: number, z: number) => Math.abs(x - i) <= 1 && Math.abs(z - j) <= 1;
    const level = this.grid.H[idx(i, j)];
    const footprint: number[] = [];
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        const k = idx(x, z);
        if (
          !this.grid.walkable(x, z) ||
          (this.grid.TYPE[k] !== T.GRASS && this.grid.TYPE[k] !== T.FIELD) ||
          this.grid.stairs.has(k) ||
          this.grid.H[k] !== level ||
          this.buildings.nearDoor(x, z)
        ) {
          this.toast('Choose nine clear grass or field tiles on the same level.');
          return;
        }
        footprint.push(k);
      }
    }
    const entranceJ = j + 2;
    if (
      !this.grid.walkable(i, entranceJ) ||
      this.grid.stairs.has(idx(i, entranceJ)) ||
      this.grid.baseLv(idx(i, entranceJ)) !== level ||
      inside(this.i, this.j) ||
      inside(this.i + (this.step?.dx ?? 0), this.j + (this.step?.dz ?? 0)) ||
      this.villagers.some((v) => !v.hidden && inside(...v.tile())) ||
      this.woodDrops.some((drop) => inside(drop.i, drop.j))
    ) {
      this.toast('Keep the footprint empty and leave a clear tile south of the house.');
      return;
    }

    for (const k of footprint) this.grid.BLOCK[k] = 1;
    if (!this.routeToTile(i, entranceJ)) {
      for (const k of footprint) this.grid.BLOCK[k] = 0;
      this.toast('The hero needs a path to the south entrance.');
      return;
    }

    if (this.coop.isConnected()) {
      for (const k of footprint) this.grid.BLOCK[k] = 0;
      this.setBlueprintMode(false);
      this.coop.sendBlueprintPlace(i, j);
      return;
    }

    this.applyBlueprintLocal(i, j, true);
  }

  public applyBlueprintLocal(i: number, j: number, announce = true, placerName?: string): void {
    if (this.buildingSite) return;
    const inside = (x: number, z: number) => Math.abs(x - i) <= 1 && Math.abs(z - j) <= 1;
    const level = this.grid.H[idx(i, j)];
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        this.grid.BLOCK[idx(x, z)] = 1;
      }
    }
    if (inside(this.i, this.j)) {
      this.i = i;
      this.j = j + 2;
      this.x = wx(this.i);
      this.z = wz(this.j);
      this.step = null;
    }
    this.cancelInteraction();
    this.clearMovement();
    this.path = [];
    for (const v of this.villagers) {
      if (v.path.some(([x, z]) => inside(x, z))) v.react();
    }

    const mesh = new THREE.Group();
    mesh.position.set(wx(i), level * TH + 0.045, wz(j));
    for (const [x, z, length, vertical] of [
      [0, -1.45, 2.9, false],
      [-1.45, 0, 2.9, true],
      [1.45, 0, 2.9, true],
      [-0.96, 1.45, 0.98, false],
      [0.96, 1.45, 0.98, false],
      [-0.46, 1.67, 0.44, true],
      [0.46, 1.67, 0.44, true],
    ] as const) {
      const lineMesh = new THREE.Mesh(this.blueprintLine, this.blueprintInk);
      lineMesh.position.set(x, 0, z);
      lineMesh.scale.x = length;
      if (vertical) lineMesh.rotation.y = Math.PI / 2;
      mesh.add(lineMesh);
    }
    this.scene.add(mesh);
    this.buildingSite = { i, j, mesh, stored: 0 };
    this.grid.refreshGrid();
    this.setBlueprintMode(false);
    this.onBuildStatusChange?.();
    if (announce) {
      this.toast(
        placerName
          ? `${placerName} placed a house blueprint! Bring 6 wood together.`
          : 'Blueprint placed. Bring 6 wood to build the house.'
      );
    }
  }

  public beginDelivery(): void {
    if (!this.buildingSite) return;
    if (!this.wood) {
      this.toast('Collect wood before delivering it to the blueprint.');
      return;
    }
    this.startInteraction('build', this.buildingSite, this.buildingSite.i, this.buildingSite.j + 2);
  }

  private finishDelivery(site: BuildingSite): void {
    const amount = Math.min(this.wood, HOUSE_WOOD_COST - site.stored);
    if (amount <= 0) return;

    if (this.coop.isConnected()) {
      this.coop.sendWoodDeposit(amount);
      return;
    }

    this.wood -= amount;
    this.applyWoodDepositLocal(site.stored + amount, amount, true);
  }

  public applyWoodDepositLocal(newStored: number, added: number, announce = true, depositor?: string): void {
    const site = this.buildingSite;
    if (!site) return;
    const prev = site.stored;
    site.stored = Math.min(HOUSE_WOOD_COST, newStored);
    if (site.stored < HOUSE_WOOD_COST && added > 0) {
      const pile = this.makeLogPile(added);
      pile.position.set(0.65, 0, -0.35 - prev * 0.1);
      site.mesh.add(pile);
      if (announce) {
        this.toast(depositor ? `${depositor} delivered ${added} wood.` : `Delivered ${added} wood.`);
      }
    }
    this.onBuildStatusChange?.();
    if (site.stored >= HOUSE_WOOD_COST && !this.coop.isConnected()) {
      this.applyHouseCompletedLocal(site.i, site.j, 'thatch', announce);
    }
  }

  public applyHouseCompletedLocal(i: number, j: number, roof = 'thatch', announce = true, builder?: string): void {
    if (this.buildingSite && this.buildingSite.i === i && this.buildingSite.j === j) {
      this.scene.remove(this.buildingSite.mesh);
      this.buildingSite = null;
    }
    for (let z = j - 1; z <= j + 1; z++) {
      for (let x = i - 1; x <= i + 1; x++) {
        this.grid.BLOCK[idx(x, z)] = 1;
      }
    }
    const home = this.buildings.makeHouse(i, j, 'S', { roof });
    this.buildings.doorTiles.push(home.door);
    this.grid.refreshGrid();
    this.onBuildStatusChange?.();
    if (announce) {
      this.toast(builder ? `${builder} finished the house · 100%!` : 'House complete · 100%');
    }
  }

  public startInteraction(
    kind: HeroInteraction['kind'],
    target: number | WoodDrop | BuildingSite,
    i: number,
    j: number
  ): void {
    if (this.interaction?.kind === kind && this.interaction.target === target) return;
    const path = kind === 'build' ? this.routeToTile(i, j) : this.routeBeside(i, j);
    if (!path) {
      this.toast(
        kind === 'chop'
          ? 'No path to this tree.'
          : kind === 'loot'
            ? 'No path to the wood.'
            : 'No path to the blueprint entrance.'
      );
      return;
    }
    this.clearMovement();
    this.cancelInteraction();
    this.path = path;
    if (kind === 'chop') {
      this.interaction = { kind: 'chop', target: target as number, elapsed: 0 };
      this.onChopProgressChange?.(this.vegetation.trees[target as number]?.hits ?? 0);
    } else if (kind === 'loot') {
      this.interaction = { kind: 'loot', target: target as WoodDrop, elapsed: 0 };
    } else {
      this.interaction = { kind: 'build', target: target as BuildingSite, elapsed: 0 };
    }
    this.focusHero();
  }

  public cancelInteraction(): void {
    if (!this.interaction) return;
    if (this.interaction.kind === 'loot') {
      this.interaction.target.mesh.position.copy(this.interaction.target.origin);
    }
    this.interaction = null;
    this.path = [];
    this.onChopProgressChange?.(null);
  }

  public makeLogPile(quantity = 3): THREE.Group {
    const mesh = new THREE.Group();
    for (let n = 0; n < quantity; n++) {
      const log = new THREE.Mesh(this.logGeometry, this.logMaterials);
      log.castShadow = true;
      log.receiveShadow = true;
      log.rotation.set(0, 0.25 * (n - 1), Math.PI / 2);
      log.position.set(0, n === 2 ? 0.34 : 0.15, n === 2 ? 0 : (n * 2 - 1) * 0.15);
      mesh.add(log);
    }
    return mesh;
  }

  public spawnWoodDrop(id: string, i: number, j: number, quantity = 3): WoodDrop {
    const existing = this.woodDrops.find((d) => d.id === id);
    if (existing) return existing;
    const mesh = this.makeLogPile(quantity);
    const origin = new V3(wx(i), this.grid.groundY(wx(i), wz(j)) + 0.04, wz(j));
    mesh.position.copy(origin);
    const drop: WoodDrop = { id, mesh, origin, i, j, quantity, age: 0 };
    mesh.userData.drop = drop;
    this.woodDrops.push(drop);
    this.scene.add(mesh);
    return drop;
  }

  public removeWoodDrop(dropId: string): WoodDrop | null {
    const index = this.woodDrops.findIndex((d) => d.id === dropId);
    if (index === -1) return null;
    const [drop] = this.woodDrops.splice(index, 1);
    this.scene.remove(drop.mesh);
    if (this.interaction?.kind === 'loot' && this.interaction.target === drop) {
      this.interaction = null;
    }
    return drop;
  }

  public applyTreeHitVisualAndFX(instance: number, hits: number, spawnLocalDrop = false, dropId?: string): void {
    const tree = this.vegetation.trees[instance];
    if (!tree) return;
    this.vegetation.setTreeHitVisual(instance, hits);
    const felled = hits >= STRIKES_TO_FELL;
    for (let n = 0; n < (felled ? 16 : 7); n++) {
      this.fxNorm.spawn(
        tree.x,
        this.grid.groundY(tree.x, tree.z) + 0.4,
        tree.z,
        R(-2, 2),
        R(1, 3),
        R(-2, 2),
        0.72,
        0.46,
        0.22,
        0.5,
        0.35,
        1,
        5,
        1.5,
        0.5
      );
    }
    if (this.interaction?.kind === 'chop' && this.interaction.target === instance) {
      this.onChopProgressChange?.(hits);
    }
    if (felled && spawnLocalDrop) {
      this.spawnWoodDrop(dropId ?? `local_${instance}_${Date.now()}`, tree.i, tree.j, 3);
      this.toast('Click or tap the logs to collect wood.', 2000);
    }
  }

  private hitTree(instance: number): void {
    const tree = this.vegetation.trees[instance];
    if (!tree || tree.chopped) return;
    if (this.coop.isConnected()) {
      this.coop.sendTreeHit(instance);
      return;
    }
    this.applyTreeHitVisualAndFX(instance, Math.min(STRIKES_TO_FELL, tree.hits + 1), true);
  }

  private updateInteraction(dt: number, camRight: THREE.Vector3): number {
    const action = this.interaction!;
    const chopping = action.kind === 'chop';
    const building = action.kind === 'build';
    const target = chopping
      ? this.vegetation.trees[action.target]
      : building
        ? action.target.mesh.position
        : action.target.origin;
    const horizontal = (target.x - this.x) * camRight.x + (target.z - this.z) * camRight.z;
    if (Math.abs(horizontal) > 0.15) this.face = (Math.sign(horizontal) || 1) as 1 | -1;
    const previous = action.elapsed;
    action.elapsed += dt;

    if (chopping) {
      if (previous < 0.32 && action.elapsed >= 0.32) this.hitTree(action.target);
      if (action.elapsed < 0.32) return 7;
      if (action.elapsed < 0.54) return 8;
      const tree = this.vegetation.trees[action.target];
      if (action.elapsed >= 0.78) {
        if (tree.chopped) this.cancelInteraction();
        else action.elapsed = 0;
      }
      return 4;
    }

    if (building) {
      if (action.elapsed < 0.54) return this.axeEquipped ? 10 : 9;
      this.finishDelivery(action.target);
      this.interaction = null;
      return this.axeEquipped ? 4 : 0;
    }

    const drop = action.target;
    const lift = clamp((action.elapsed - 0.18) / 0.36, 0, 1);
    drop.mesh.position.set(
      lerp(drop.origin.x, this.x, lift),
      lerp(drop.origin.y, this.grid.groundY(this.x, this.z) + 0.65, lift) + Math.sin(lift * Math.PI) * 0.5,
      lerp(drop.origin.z, this.z, lift)
    );
    if (lift < 1) return this.axeEquipped ? 10 : 9;

    if (this.coop.isConnected()) {
      this.interaction = null;
      drop.mesh.position.copy(drop.origin);
      this.coop.sendWoodLoot(drop.id);
      return this.axeEquipped ? 4 : 0;
    }

    this.removeWoodDrop(drop.id);
    this.wood += drop.quantity;
    this.onBuildStatusChange?.();
    this.toast(`+${drop.quantity} wood`, 1600);
    this.interaction = null;
    return this.axeEquipped ? 4 : 0;
  }

  public update(dt: number, camYaw: number, camRight: THREE.Vector3): void {
    this.mesh.visible = this.marker.visible = true;
    if (this.grid.gridOverlay) this.grid.gridOverlay.visible = true;
    if (this.buildingSite) this.buildingSite.mesh.visible = true;

    if (!this.step) {
      const direction = this.queuedMove ?? [...this.heldMoves.values()].at(-1);
      this.queuedMove = null;
      let dx = 0;
      let dz = 0;
      if (direction) {
        const [right, back] = MOVE_DIRECTIONS[direction];
        const quadrant = Math.round(camYaw / (Math.PI / 2));
        const cos = Math.round(Math.cos((quadrant * Math.PI) / 2));
        const sin = Math.round(Math.sin((quadrant * Math.PI) / 2));
        dx = right * cos + back * sin;
        dz = back * cos - right * sin;
      } else if (this.path.length) {
        const [i, j] = this.path.shift()!;
        dx = i - this.i;
        dz = j - this.j;
      }
      if ((dx || dz) && this.grid.canStep(this.i, this.j, dx, dz)) {
        this.step = { dx, dz, progress: 0 };
        const horizontal = dx * camRight.x + dz * camRight.z;
        if (Math.abs(horizontal) > 0.25) this.face = (Math.sign(horizontal) || 1) as 1 | -1;
      }
    }

    let frame = 0;
    if (this.step) {
      const step = this.step;
      step.progress = Math.min(1, step.progress + dt * 4.5);
      this.x = wx(this.i) + step.dx * step.progress;
      this.z = wz(this.j) + step.dz * step.progress;
      this.walkTime += dt * 12;
      frame = [1, 0, 2, 0][Math.floor(this.walkTime) % 4];
      if (step.progress === 1) {
        this.i += step.dx;
        this.j += step.dz;
        this.step = null;
      }
    }
    if (this.axeEquipped) frame += 4;
    if (this.interaction && !this.step && !this.path.length) {
      frame = this.updateInteraction(dt, camRight);
    }

    for (const drop of this.woodDrops) {
      drop.mesh.visible = true;
      if (this.interaction?.kind === 'loot' && this.interaction.target === drop && this.interaction.elapsed > 0) continue;
      drop.age = Math.min(1, drop.age + dt * 3);
      drop.mesh.position.y = drop.origin.y + Math.sin(drop.age * Math.PI) * 0.45;
    }

    const y = this.grid.groundY(this.x, this.z);
    const elapsed = this.interaction?.elapsed ?? 0;
    const crouch = frame >= 9 ? Math.sin(Math.PI * clamp(elapsed / 0.54, 0, 1)) : 0;
    const swing =
      frame === 7
        ? 0.14 * clamp(elapsed / 0.32, 0, 1)
        : frame === 8
          ? -0.27 * clamp(1 - (elapsed - 0.32) / 0.22, 0, 1)
          : 0;
    this.frame = frame;
    this.crouch = crouch;
    this.swing = swing;

    this.mesh.position.set(this.x, y - 0.19 * crouch, this.z);
    this.mesh.rotation.z = this.face * (swing - 0.23 * crouch);
    this.mesh.rotation.y = camYaw;
    this.mesh.scale.x = this.face;
    this.tex.offset.x = frame * this.tex.repeat.x;
    this.marker.position.set(this.x, y + 1.85, this.z);
  }
}

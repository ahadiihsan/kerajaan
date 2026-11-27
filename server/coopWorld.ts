export const STRIKES_TO_FELL = 3;
export const HOUSE_WOOD_COST = 6;

export interface WoodDropState {
  id: string;
  treeIndex: number;
  i: number;
  j: number;
  quantity: number;
}

export interface BuildingSiteState {
  i: number;
  j: number;
  stored: number;
}

export interface CompletedHouseState {
  i: number;
  j: number;
  roof: string;
}

export interface WorldCoopSnapshot {
  treeHits: Record<number, number>;
  woodDrops: WoodDropState[];
  buildingSite: BuildingSiteState | null;
  completedHouses: CompletedHouseState[];
}

export class CoopWorldStore {
  private treeHits = new Map<number, number>();
  private woodDrops = new Map<string, WoodDropState>();
  private buildingSite: BuildingSiteState | null = null;
  private completedHouses: CompletedHouseState[] = [];
  private nextDropSeq = 1;

  public hitTree(
    treeIndex: number,
    tileI: number,
    tileJ: number
  ): { ok: boolean; hits: number; drop?: WoodDropState } {
    if (!Number.isInteger(treeIndex) || treeIndex < 0) {
      return { ok: false, hits: 0 };
    }
    const prev = this.treeHits.get(treeIndex) ?? 0;
    if (prev >= STRIKES_TO_FELL) {
      return { ok: false, hits: prev };
    }
    const hits = prev + 1;
    this.treeHits.set(treeIndex, hits);
    if (hits === STRIKES_TO_FELL) {
      const drop: WoodDropState = {
        id: `drop_${this.nextDropSeq++}`,
        treeIndex,
        i: tileI,
        j: tileJ,
        quantity: 3,
      };
      this.woodDrops.set(drop.id, drop);
      return { ok: true, hits, drop };
    }
    return { ok: true, hits };
  }

  public lootDrop(dropId: string): WoodDropState | null {
    const drop = this.woodDrops.get(dropId);
    if (!drop) return null;
    this.woodDrops.delete(dropId);
    return drop;
  }

  public placeBlueprint(i: number, j: number): { ok: true; site: BuildingSiteState } | { ok: false; reason: string } {
    if (!Number.isInteger(i) || !Number.isInteger(j)) {
      return { ok: false, reason: 'Invalid blueprint coordinates.' };
    }
    if (this.buildingSite) {
      return { ok: false, reason: 'A shared house blueprint is already active.' };
    }
    this.buildingSite = { i, j, stored: 0 };
    return { ok: true, site: { ...this.buildingSite } };
  }

  public depositWood(
    requestedAmount: number
  ):
    | { ok: true; accepted: number; stored: number; completedHouse?: CompletedHouseState }
    | { ok: false; reason: string } {
    if (!this.buildingSite) {
      return { ok: false, reason: 'No active blueprint.' };
    }
    const amount = Math.floor(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'No wood to deposit.' };
    }
    const remaining = HOUSE_WOOD_COST - this.buildingSite.stored;
    const accepted = Math.min(amount, remaining);
    if (accepted <= 0) {
      return { ok: false, reason: 'House already has enough wood.' };
    }
    this.buildingSite.stored += accepted;
    const stored = this.buildingSite.stored;
    if (stored >= HOUSE_WOOD_COST) {
      const completedHouse: CompletedHouseState = {
        i: this.buildingSite.i,
        j: this.buildingSite.j,
        roof: 'thatch',
      };
      this.completedHouses.push(completedHouse);
      this.buildingSite = null;
      return { ok: true, accepted, stored, completedHouse };
    }
    return { ok: true, accepted, stored };
  }

  public getSnapshot(): WorldCoopSnapshot {
    const treeHits: Record<number, number> = {};
    for (const [k, v] of this.treeHits.entries()) {
      treeHits[k] = v;
    }
    return {
      treeHits,
      woodDrops: Array.from(this.woodDrops.values()).map((d) => ({ ...d })),
      buildingSite: this.buildingSite ? { ...this.buildingSite } : null,
      completedHouses: this.completedHouses.map((h) => ({ ...h })),
    };
  }
}

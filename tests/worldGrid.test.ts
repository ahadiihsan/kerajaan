import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { idx, PC, T, TH, ti, tj, WATER_Y, WorldGrid, wx, wz } from '../src/world/WorldGrid.ts';

describe('WorldGrid', () => {
  it('converts world coordinates and tile indices symmetrically', () => {
    assert.equal(ti(wx(23)), 23);
    assert.equal(tj(wz(25)), 25);
  });

  it('carves river, bridge, plaza cobble, and stairs deterministically', () => {
    const grid = new WorldGrid();
    assert.equal(grid.TYPE[idx(PC[0], PC[1])], T.COBBLE);
    assert.equal(grid.H[idx(PC[0], PC[1])], 1);
    assert.ok(grid.stairs.size > 0);
    let bridgeCount = 0;
    let riverCount = 0;
    for (let k = 0; k < grid.TYPE.length; k++) {
      if (grid.TYPE[k] === T.BRIDGE) bridgeCount++;
      if (grid.TYPE[k] === T.RIVER) riverCount++;
    }
    assert.ok(bridgeCount >= 2);
    assert.ok(riverCount > 50);
  });

  it('computes groundY across flat tiles, bridge, river, and stairs', () => {
    const grid = new WorldGrid();
    assert.equal(grid.groundY(wx(PC[0]), wz(PC[1])), TH);

    const [stairKey, stair] = grid.stairs.entries().next().value!;
    const si = stairKey % 72;
    const sj = (stairKey / 72) | 0;
    const midY = grid.groundY(wx(si), wz(sj));
    assert.ok(Math.abs(midY - (stair.low + 0.5) * TH) < 1e-6);

    for (let k = 0; k < grid.TYPE.length; k++) {
      if (grid.TYPE[k] === T.RIVER) {
        const i = k % 72;
        const j = (k / 72) | 0;
        assert.equal(grid.groundY(wx(i), wz(j)), WATER_Y);
        break;
      }
    }
  });

  it('finds stair/bridge-aware paths from plaza across the river and up to the chapel mesa', () => {
    const grid = new WorldGrid();
    grid.computeReachability();
    assert.ok(grid.reachList.length > 500);

    // West across the bridge to the farmland
    const toFields = grid.findPath(20, 24, 4, 24);
    assert.ok(toFields && toFields.length > 10);

    // Up the stairs to the chapel mesa
    const toChapel = grid.findPath(23, 24, 31, 10);
    assert.ok(toChapel && toChapel.length > 10);
  });
});

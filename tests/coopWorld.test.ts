import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CoopWorldStore, HOUSE_WOOD_COST, STRIKES_TO_FELL } from '../server/coopWorld.ts';

describe('CoopWorldStore', () => {
  it('fells a tree on the 3rd hit and drops 3 wood atomically', () => {
    const store = new CoopWorldStore();
    assert.deepEqual(store.hitTree(4, 10, 12), { ok: true, hits: 1 });
    assert.deepEqual(store.hitTree(4, 10, 12), { ok: true, hits: 2 });
    const third = store.hitTree(4, 10, 12);
    assert.equal(third.ok, true);
    assert.equal(third.hits, STRIKES_TO_FELL);
    assert.equal(third.drop?.quantity, 3);

    // Further hits on already-felled tree are ignored
    assert.equal(store.hitTree(4, 10, 12).ok, false);

    // First player to loot succeeds; second player gets null (no duplication)
    const dropId = third.drop!.id;
    const loot1 = store.lootDrop(dropId);
    const loot2 = store.lootDrop(dropId);
    assert.equal(loot1?.quantity, 3);
    assert.equal(loot2, null);
  });

  it('supports cooperative multi-player house construction', () => {
    const store = new CoopWorldStore();
    const bp1 = store.placeBlueprint(30, 40);
    assert.equal(bp1.ok, true);

    // Competing second blueprint is rejected cleanly
    const bp2 = store.placeBlueprint(35, 40);
    assert.equal(bp2.ok, false);

    // Player A deposits 3 wood, Player B deposits 4 (clamped to 3 remaining)
    const depA = store.depositWood(3);
    assert.equal(depA.ok, true);
    if (depA.ok) {
      assert.equal(depA.accepted, 3);
      assert.equal(depA.stored, 3);
      assert.equal(depA.completedHouse, undefined);
    }

    const depB = store.depositWood(4);
    assert.equal(depB.ok, true);
    if (depB.ok) {
      assert.equal(depB.accepted, HOUSE_WOOD_COST - 3);
      assert.equal(depB.stored, HOUSE_WOOD_COST);
      assert.deepEqual(depB.completedHouse, { i: 30, j: 40, roof: 'thatch' });
    }

    const snap = store.getSnapshot();
    assert.equal(snap.buildingSite, null);
    assert.equal(snap.completedHouses.length, 1);

    // Another blueprint can now be placed after completion
    assert.equal(store.placeBlueprint(35, 40).ok, true);
  });
});

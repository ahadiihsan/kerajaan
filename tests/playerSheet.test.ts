import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerActionFrame, playerSheetRow, type PlayerPose } from '../src/entities/PlayerSheet.ts';

test('player sheet maps all eight view directions to the supplied row order', () => {
  const directions = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
  directions.forEach(([dx, dz], row) => assert.equal(playerSheetRow(dx, dz, 0), row));
});

test('player facing follows camera orbit without changing world heading', () => {
  assert.equal(playerSheetRow(0, 1, Math.PI / 2), 6);
  assert.equal(playerSheetRow(0, 1, Math.PI), 4);
  assert.equal(playerSheetRow(0, 1, -Math.PI / 2), 2);
  assert.equal(playerSheetRow(0, 1, Math.PI * 2), 0);
});

const standing: PlayerPose = {
  chopTime: null, shotTime: 0.52, axeEquipped: false, bowEquipped: false,
  rodEquipped: false, fishingPose: null, fishingElapsed: 0,
};

test('axe impact frame begins exactly when the game applies the tree hit', () => {
  assert.equal(playerActionFrame({ ...standing, chopTime: 0.31 })?.column, 3);
  assert.equal(playerActionFrame({ ...standing, chopTime: 0.32 })?.column, 4);
  assert.equal(playerActionFrame({ ...standing, chopTime: 0.77 })?.column, 7);
});

test('bow release frame matches projectile release and returns to equipped idle', () => {
  assert.deepEqual(playerActionFrame({ ...standing, bowEquipped: true, shotTime: 0.23 }), { action: 'bow', column: 4 });
  assert.deepEqual(playerActionFrame({ ...standing, bowEquipped: true, shotTime: 0.24 }), { action: 'bow', column: 5 });
  assert.deepEqual(playerActionFrame({ ...standing, bowEquipped: true }), { action: 'bow', column: 0 });
});

test('fishing separates casting, waiting, reeling, and catch poses', () => {
  const fishing = { ...standing, rodEquipped: true, fishingPose: 'cast' as const };
  assert.equal(playerActionFrame(fishing)?.column, 1);
  assert.equal(playerActionFrame({ ...fishing, fishingElapsed: 0.54 })?.column, 4);
  assert.equal(playerActionFrame({ ...fishing, fishingElapsed: 3 })?.column, 5);
  assert.equal(playerActionFrame({ ...fishing, fishingElapsed: 3, fishingReeling: true })?.column, 6);
  assert.equal(playerActionFrame({ ...fishing, fishingPose: 'hold' })?.column, 7);
  assert.equal(playerActionFrame(standing), null);
});

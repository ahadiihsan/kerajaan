import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectionPose } from '../src/preview/EquippedPreview.ts';
import { playerActionFrame } from '../src/entities/PlayerSheet.ts';

test('equipment inspection phases match the displayed action frame', () => {
  for (const action of ['chop', 'bow', 'fish'] as const) {
    for (let column = 0; column < 8; column++) {
      if (action === 'bow' && column === 3) continue;
      assert.deepEqual(playerActionFrame(inspectionPose(action, column)), { action, column }, `${action} frame ${column + 1}`);
    }
  }
});

test('idle and walk inspection do not start an action or equip an automatic item', () => {
  for (const action of ['idle', 'walk'] as const) {
    const pose = inspectionPose(action, 0);
    assert.equal(playerActionFrame(pose), null);
    assert.equal(pose.axeEquipped || pose.bowEquipped || pose.rodEquipped, false);
  }
});

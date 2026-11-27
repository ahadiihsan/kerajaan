import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene, Vector3 } from 'three';
import { PlayerEquipment } from '../src/entities/PlayerEquipment.ts';
import { playerSheetRow, type PlayerPose } from '../src/entities/PlayerSheet.ts';
import handGrips from '../src/assets/characters/hand-grips.json';

const drawn: PlayerPose = {
  chopTime: null, shotTime: 0.18, axeEquipped: false, bowEquipped: true,
  rodEquipped: false, fishingPose: null, fishingElapsed: 0,
};

test('nocked arrow follows the shot in all eight directions and through camera orbits', () => {
  const equipment = new PlayerEquipment(new Scene());
  for (let direction = 0; direction < 8; direction++) {
    const angle = direction * Math.PI / 4;
    const aim = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    equipment.update(drawn, aim, new Vector3(), new Vector3(), true);
    equipment.bow.updateMatrixWorld(true);
    const arrowForward = new Vector3(0, 0, 1).transformDirection(equipment.nockedArrow.matrixWorld);
    assert.ok(arrowForward.dot(aim) > 0.99999, `direction ${direction}`);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      assert.equal(playerSheetRow(arrowForward.x, arrowForward.z, yaw), playerSheetRow(aim.x, aim.z, yaw));
    }
  }
});

test('release removes nocked arrow and bow stays attached to the supplied hand', () => {
  const equipment = new PlayerEquipment(new Scene());
  const hand = new Vector3(3, 1.1, -2);
  equipment.update(drawn, new Vector3(1, 0, 0), new Vector3(), hand, true);
  assert.equal(equipment.nockedArrow.visible, true);
  assert.deepEqual(equipment.bow.position.toArray(), hand.toArray());
  equipment.update({ ...drawn, shotTime: 0.24 }, new Vector3(1, 0, 0), new Vector3(), hand, true);
  assert.equal(equipment.nockedArrow.visible, false);
});

test('customizing one tool leaves other tool styles unchanged', () => {
  const equipment = new PlayerEquipment(new Scene());
  const original = structuredClone(equipment.appearance);
  equipment.setAppearance('rod', { woodColor: 0x8844ff, scale: 1.4 });
  assert.deepEqual(equipment.appearance.bow, original.bow);
  assert.deepEqual(equipment.appearance.axe, original.axe);
  assert.equal(equipment.appearance.rod.woodColor, 0x8844ff);
  assert.equal(equipment.appearance.rod.scale, 1.4);
});

test('bow grip stays on the anatomical left hand through every direction and frame', () => {
  const equipment = new PlayerEquipment(new Scene());
  for (const row of handGrips.bow) {
    for (const frame of row) {
      const left = new Vector3(...frame.left, 0.04);
      const right = new Vector3(...frame.right, 0.04);
      equipment.update(drawn, new Vector3(0, 0, 1), new Vector3(), left, true, undefined, right);
      assert.ok(equipment.bow.position.distanceTo(left) < 1e-8);
      assert.ok(equipment.bow.position.distanceTo(right) > 0.03);
    }
  }
});

test('axe handle passes through both authored fists during windup and impact', () => {
  const equipment = new PlayerEquipment(new Scene());
  for (const row of handGrips.chop) {
    for (const column of [1,2,3,4,5,6]) {
      const frame = row[column];
      const lower = new Vector3(...frame.left, 0.04);
      const upper = new Vector3(...frame.right, 0.04);
      equipment.update({ ...drawn, bowEquipped: false, axeEquipped: true, chopTime: 0.3 }, new Vector3(1,0,0), lower, new Vector3(), true, upper);
      assert.ok(equipment.axe.position.distanceTo(lower) < 1e-8);
      const axis = new Vector3(0,1,0).applyQuaternion(equipment.axe.quaternion);
      const separation = upper.clone().sub(lower);
      assert.ok(separation.clone().cross(axis).length() < 1e-7);
      assert.ok(separation.dot(axis) <= 0.485, 'support fist must lie on the handle');
    }
  }
});

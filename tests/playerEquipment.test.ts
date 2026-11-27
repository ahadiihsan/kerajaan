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

test('nocked arrow shaft intersects the bow arrow rest in all eight directions', () => {
  const equipment = new PlayerEquipment(new Scene());
  for (let direction = 0; direction < 8; direction++) {
    const angle = direction * Math.PI / 4;
    const aim = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    const hand = new Vector3(0.3, 0.7, 0.04), drawHand = new Vector3(-0.3, 0.9, 0.04);
    equipment.update(drawn, aim, new Vector3(), hand, true, undefined, drawHand);
    equipment.bow.updateMatrixWorld(true);
    const nock = equipment.nockedArrow.localToWorld(new Vector3(0, 0, -0.31));
    const tip = equipment.nockedArrow.localToWorld(new Vector3(0, 0, 0.42));
    const rest = equipment.arrowRest();
    const shaft = tip.clone().sub(nock), contact = rest.clone().sub(nock);
    assert.ok(contact.clone().cross(shaft).length() < 1e-7, `direction ${direction}`);
    assert.ok(contact.dot(shaft) >= 0 && contact.length() < shaft.length(), 'arrow rest must lie between nock and tip');
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
      const movedDrawHand = right.clone().add(new Vector3(0.25, 0.1, 0));
      equipment.update(drawn, new Vector3(0, 0, 1), new Vector3(), left, true, undefined, movedDrawHand);
      assert.ok(equipment.bow.position.distanceTo(left) < 1e-8, 'moving the draw hand must not move the bow grip');
    }
  }
});

test('axe grip stays between the fists and its cutting face follows the body direction', () => {
  const equipment = new PlayerEquipment(new Scene());
  for (let row = 0; row < 8; row++) {
    const angle = row * Math.PI / 4;
    const forward = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    for (const time of [null, 0.12, 0.28, 0.36, 0.48, 0.59, 0.72]) {
      const frame = handGrips.chop[row][time === null ? 0 : time < 0.32 ? 1 : time < 0.54 ? 4 : 6];
      const left = new Vector3(...frame.left, 0.04), right = new Vector3(...frame.right, 0.04);
      equipment.update({ ...drawn, bowEquipped: false, axeEquipped: true, chopTime: time }, forward, left, new Vector3(), true, right);
      const expectedGrip = left.clone().lerp(right, 0.5).addScaledVector(forward, 0.06);
      assert.ok(equipment.axe.position.distanceTo(expectedGrip) < 1e-8);
      const shaft = new Vector3(0, 1, 0).applyQuaternion(equipment.axe.quaternion);
      const edge = new Vector3(1, 0, 0).applyQuaternion(equipment.axe.quaternion);
      assert.ok(edge.dot(forward) > 0.2, 'cutting face must not reverse behind the player');
      if (time === null || time >= 0.66) assert.ok(shaft.y > 0.98, 'resting head stays above the grip');
      if (time !== null && time >= 0.32 && time < 0.54) {
        assert.ok(shaft.dot(forward) > 0.9, 'impact reaches in front of the body');
        assert.ok(edge.y < -0.9, 'cutting edge faces down during impact');
      }
    }
  }
});

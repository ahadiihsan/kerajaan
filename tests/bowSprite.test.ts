import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { PlayerEquipment } from '../src/entities/PlayerEquipment.ts';
import { BowSprite } from '../src/entities/BowSprite.ts';
import { playerSheetRow } from '../src/entities/PlayerSheet.ts';
import atlas from '../src/assets/items/bow-directions-v1.json';

function screenDistance(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera): number {
  const x = a.clone().project(camera), y = b.clone().project(camera);
  return Math.hypot(x.x - y.x, x.y - y.y);
}

const pose = { chopTime: null, shotTime: 0.18, axeEquipped: false, bowEquipped: true, rodEquipped: false, fishingPose: null, fishingElapsed: 0 } as const;

test('directional bow string connects to painted limb tips through orbit, projection and scaling', () => {
  const equipment = new PlayerEquipment(new THREE.Scene());
  const sprite = equipment.bow.children.find(child => child instanceof BowSprite) as BowSprite;
  const string = equipment.bow.children.find(child => child instanceof THREE.Line) as THREE.Line;
  const left = new THREE.Vector3(0.2, 0.8, 0.045), right = new THREE.Vector3(-0.2, 0.9, 0.045);
  for (const camera of [new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100), new THREE.PerspectiveCamera(30, 1.5, 0.1, 100)]) for (const yaw of [0, Math.PI / 2, Math.PI]) for (const scale of [0.7, 1.3]) for (let row = 0; row < 8; row++) {
    camera.position.set(Math.sin(yaw) * 5, 4, Math.cos(yaw) * 5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    const facing = new THREE.Vector3(Math.sin(row * Math.PI / 4), 0, Math.cos(row * Math.PI / 4));
    equipment.setAppearance('bow', { scale });
    equipment.update(pose, facing, new THREE.Vector3(), left, true, undefined, right);
    sprite.prepare(camera);
    assert.equal(sprite.viewRow, playerSheetRow(facing.x, facing.z, yaw));
    assert.ok(screenDistance(equipment.bow.position, left, camera) < 1e-8);
    const frame = atlas.frames[sprite.viewRow];
    assert.ok(sprite.material.map!.repeat.x > 0);
    const positions = string.geometry.getAttribute('position');
    const middle = equipment.bow.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, 1));
    assert.ok(screenDistance(middle, right, camera) < 1e-6, 'projected nock must remain on anatomical right hand');
    const worldScale = sprite.getWorldScale(new THREE.Vector3());
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    for (const [pixel, index] of [[frame.bottom, 0], [frame.top, 2]] as const) {
      const inset = 'tipInset' in frame ? frame.tipInset : 0;
      const bend = Math.min(1, Math.abs(pixel[1] - frame.gripY) / (frame.height * 0.44));
      const x = (pixel[0] - frame.gripX + inset * bend) / (frame.width + 2 * Math.abs(inset)) * worldScale.x;
      const y = (frame.gripY - pixel[1]) / frame.height * worldScale.y;
      const angle = sprite.material.rotation;
      const painted = equipment.bow.position.clone().addScaledVector(cameraRight, Math.cos(angle) * x - Math.sin(angle) * y).addScaledVector(cameraUp, Math.sin(angle) * x + Math.cos(angle) * y).project(camera);
      const attachment = equipment.bow.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index)).project(camera);
      assert.ok(Math.hypot(painted.x - attachment.x, painted.y - attachment.y) < 1e-6, `row ${row}, tip ${index}`);
    }
    equipment.update({ ...pose, shotTime: 0.3 }, facing, new THREE.Vector3(), left, true, undefined, right);
    sprite.prepare(camera);
    assert.equal(equipment.nockedArrow.visible, false);
    const bottom = new THREE.Vector3().fromBufferAttribute(positions, 0), top = new THREE.Vector3().fromBufferAttribute(positions, 2);
    assert.ok(new THREE.Vector3().fromBufferAttribute(positions, 1).distanceTo(bottom.lerp(top, 0.5)) < 1e-7, 'released string straightens between limb tips');
  }
});

test('south idle bow follows the left palm while shooting frames remain centered through camera yaw', async () => {
  const { default: grips } = await import('../src/assets/characters/hand-grips.json');
  const { inspectionPose } = await import('../src/preview/EquippedPreview.ts');
  const equipment = new PlayerEquipment(new THREE.Scene());
  const origin = new THREE.Vector3(7, 0.4, -3);
  const up = new THREE.Vector3(0, 1, 0);
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (let frame = 0; frame < 8; frame++) {
    const facing = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const socket = grips.bow[0][frame];
    const leftHand = new THREE.Vector3(...socket.left, 0.045).applyAxisAngle(up, yaw).add(origin);
    const drawHand = new THREE.Vector3(...socket.right, 0.045).applyAxisAngle(up, yaw).add(origin);
    equipment.update(inspectionPose('bow', frame), facing, new THREE.Vector3(), leftHand, true, undefined, drawHand);
    equipment.bow.updateMatrixWorld(true);
    if ([0, 6, 7].includes(frame)) {
      assert.ok(socket.left[0] > 0.1, 'idle grip is in the anatomical left palm');
      assert.ok(equipment.bow.position.distanceTo(leftHand) < 1e-8, `idle frame ${frame + 1}, yaw ${yaw}`);
      assert.equal(equipment.nockedArrow.visible, false);
      continue;
    }
    for (const point of [equipment.bow.position, equipment.nockedArrow.getWorldPosition(new THREE.Vector3()), equipment.nockedArrow.localToWorld(new THREE.Vector3(0, 0, 0.42))]) {
      assert.ok(Math.abs(point.clone().sub(origin).dot(right)) < 1e-8, `frame ${frame + 1}, yaw ${yaw}`);
    }
  }
});


test('NE W SW resting string clears the holding palm toward the drawing hand', async () => {
  const { default: grips } = await import('../src/assets/characters/hand-grips.json');
  const equipment = new PlayerEquipment(new THREE.Scene());
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  camera.position.set(0, 4, 5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
  const sprite = equipment.bow.children.find(child => child instanceof BowSprite) as BowSprite;
  const string = equipment.bow.children.find(child => child instanceof THREE.Line) as THREE.Line;
  for (const row of [3, 6, 7]) for (const frame of [1, 2, 3, 4, 5]) {
    const socket = grips.bow[row][frame];
    const left = new THREE.Vector3(...socket.left, 0);
    const right = new THREE.Vector3(...socket.right, 0);
    const facing = new THREE.Vector3(Math.sin(row * Math.PI / 4), 0, Math.cos(row * Math.PI / 4));
    equipment.update({ ...pose, shotTime: 0.3 }, facing, new THREE.Vector3(), left, true, undefined, right);
    equipment.prepare(camera);
    const midpoint = equipment.bow.localToWorld(new THREE.Vector3().fromBufferAttribute(string.geometry.getAttribute('position'), 1));
    const inward = Math.sign(right.clone().project(camera).x - left.clone().project(camera).x);
    const clearance = (midpoint.project(camera).x - left.clone().project(camera).x) * inward;
    assert.ok(clearance > 0.05, `row ${row}, frame ${frame + 1}: string must clear palm inward (${clearance})`);
  }
});

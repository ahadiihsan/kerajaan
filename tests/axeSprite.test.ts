import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { PlayerEquipment } from '../src/entities/PlayerEquipment.ts';
import { AxeSprite } from '../src/entities/AxeSprite.ts';
import handGrips from '../src/assets/characters/hand-grips.json';
import atlas from '../src/assets/items/axe-directions-v3.json';
import { playerSheetRow } from '../src/entities/PlayerSheet.ts';

test('painted axe shaft follows the hand rig through camera orbit, swing and item scaling', () => {
  const equipment = new PlayerEquipment(new THREE.Scene());
  const sprite = equipment.axe.children[0] as AxeSprite;
  const cameras = [new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100), new THREE.PerspectiveCamera(30, 1.5, 0.1, 100)];
  for (const camera of cameras) for (const yaw of [0, Math.PI / 2, Math.PI]) for (const scale of [0.7, 1.4]) for (const [rowIndex, row] of handGrips.chop.entries()) for (const column of [1, 4, 6]) {
    camera.position.set(Math.sin(yaw) * 5, 4, Math.cos(yaw) * 5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    equipment.setAppearance('axe', { scale });
    const frame = row[column];
    const left = new THREE.Vector3(...frame.left, 0.045), right = new THREE.Vector3(...frame.right, 0.045);
    const facing = new THREE.Vector3(Math.sin(rowIndex * Math.PI / 4), 0, Math.cos(rowIndex * Math.PI / 4));
    equipment.update({ chopTime: column === 1 ? 0.12 : column === 4 ? 0.36 : 0.59, shotTime: 1, axeEquipped: true, bowEquipped: false, rodEquipped: false, fishingPose: null, fishingElapsed: 0 }, facing, left, new THREE.Vector3(), true, right);
    (sprite.onBeforeRender as Function)(null, null, camera);
    const anchor = equipment.axe.getWorldPosition(new THREE.Vector3());
    assert.ok(anchor.distanceTo(left.clone().lerp(right, 0.5).addScaledVector(facing, 0.06)) < 1e-9);
    assert.equal(sprite.viewRow, playerSheetRow(facing.x, facing.z, yaw));
    const frameArt = atlas.frames[sprite.viewRow];
    const drawnScale = sprite.getWorldScale(new THREE.Vector3());
    const length = drawnScale.y * (frameArt.gripY - frameArt.headY) / frameArt.height;
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const paintedHead = anchor.clone().addScaledVector(cameraRight, -Math.sin(sprite.material.rotation) * length).addScaledVector(cameraUp, Math.cos(sprite.material.rotation) * length).project(camera);
    const rigHead = equipment.axe.localToWorld(new THREE.Vector3(0, 0.43, 0)).project(camera);
    assert.ok(Math.hypot(paintedHead.x - rigHead.x, paintedHead.y - rigHead.y) < 1e-8);
    const map = sprite.material.map!;
    assert.ok(map.repeat.x > 0, 'select authored views instead of mirroring one axe');
    assert.ok(Math.abs(sprite.center.x - frameArt.gripX / frameArt.width) < 1e-9);
  }
});

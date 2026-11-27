import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { FishingRodSprite } from '../src/ui/FishingRodSprite.ts';
import { DEFAULT_TOOL_APPEARANCE } from '../src/entities/PlayerEquipment.ts';

test('2D rod grip and painted tip stay aligned with live sockets through all view directions', () => {
  const rod = new FishingRodSprite(new THREE.Texture());
  const hand = new THREE.Vector3(0.3, 0.7, -0.1);
  const cameras = [new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100), new THREE.PerspectiveCamera(30, 1.5, 0.1, 100)];
  for (const camera of cameras) for (const pitch of [0, 37.2, 60]) for (let row = 0; row < 8; row++) for (const scale of [0.6, 1, 1.8]) {
    camera.position.set(0, 1 + Math.sin(pitch * Math.PI / 180) * 6, Math.cos(pitch * Math.PI / 180) * 6);
    camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    const angle = row * Math.PI / 4;
    const tip = new THREE.Vector3(Math.sin(angle) * 0.85, 0.53, Math.cos(angle) * 0.85).normalize().multiplyScalar(scale).add(hand);
    rod.update(hand, tip, { ...DEFAULT_TOOL_APPEARANCE.rod, scale });
    (rod.onBeforeRender as Function)(null, null, camera);
    assert.ok(rod.position.distanceTo(hand) < 1e-10);
    const paintedLength = rod.scale.y * 2009 / 2113;
    const rotation = rod.material.rotation;
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const paintedTip = hand.clone().addScaledVector(cameraRight, -Math.sin(rotation) * paintedLength).addScaledVector(cameraUp, Math.cos(rotation) * paintedLength).project(camera);
    const lineTip = tip.clone().project(camera);
    assert.ok(Math.hypot(paintedTip.x - lineTip.x, paintedTip.y - lineTip.y) < 1e-8, `pitch ${pitch}, row ${row}, scale ${scale}`);
  }
  assert.equal(rod.material.color.getHex(), 0xffffff);
});

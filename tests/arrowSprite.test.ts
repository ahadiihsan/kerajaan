import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { PlayerEquipment } from '../src/entities/PlayerEquipment.ts';
import { playerHandDepth } from '../src/entities/PlayerSheet.ts';
import { BowSprite } from '../src/entities/BowSprite.ts';
import { ArrowSprite } from '../src/entities/ArrowSprite.ts';
import { inspectionPose } from '../src/preview/EquippedPreview.ts';
import grips from '../src/assets/characters/hand-grips.json';
import atlas from '../src/assets/items/arrow-directions-v1.json';

function screenGap(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera): number {
  const p = a.clone().project(camera), q = b.clone().project(camera);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

test('arrow touches bow throughout diagonal and west draw; front art and rear draw remain attached', () => {
  const scene = new THREE.Scene(), equipment = new PlayerEquipment(scene);
  const bowArt = equipment.bow.children.find(child => child instanceof BowSprite) as BowSprite;
  const arrowArt = equipment.nockedArrow.children.find(child => child instanceof ArrowSprite) as ArrowSprite;
  const string = equipment.bow.children.find(child => child instanceof THREE.Line) as THREE.Line;
  for (const camera of [new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100), new THREE.PerspectiveCamera(30, 1.5, 0.1, 100)]) for (const row of [0,1,2,3,4,5,6,7]) for (const frame of [1,2,3,4]) {
    camera.position.set(0, 4, 5);camera.lookAt(0, 0.95, 0);camera.updateMatrixWorld(true);
    const aim = new THREE.Vector3(Math.sin(row * Math.PI / 4), 0, Math.cos(row * Math.PI / 4));
    const socket = grips.bow[row][frame], depth = playerHandDepth('bow', row);
    const hand = new THREE.Vector3(...socket.left, depth), draw = new THREE.Vector3(...socket.right, depth);
    equipment.update(inspectionPose('bow', frame), aim, new THREE.Vector3(), hand, true, undefined, draw);
    (scene.onBeforeRender as Function)(null, scene, camera, null);
    assert.equal(arrowArt.viewRow, row);
    const nock = equipment.nockedArrow.localToWorld(new THREE.Vector3(0, 0, -0.31));
    const tip = equipment.nockedArrow.localToWorld(new THREE.Vector3(0, 0, 0.42));
    const rest = equipment.arrowRest(), shaft = tip.clone().sub(nock), contact = rest.clone().sub(nock);
    assert.ok(contact.clone().cross(shaft).length() < 1e-7, `row ${row}, frame ${frame}`);
    assert.ok(contact.dot(shaft) >= 0 && contact.length() < shaft.length());
    assert.ok(Math.abs(shaft.length() - 1.2) < 1e-7, 'default arrow length must stay constant while retracting');
    assert.ok(screenGap(nock, draw, camera) < 1e-7, 'nock stays on painted draw hand');
    assert.ok(screenGap(equipment.bow.position, hand, camera) < 1e-7, 'bow stays on painted holding hand');
    const vertices = string.geometry.getAttribute('position');
    const stringNock = equipment.bow.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, 1));
    assert.ok(stringNock.distanceTo(nock) < 1e-7);
    const version = vertices.version;
    (bowArt.onBeforeRender as Function)(null, scene, camera);
    assert.equal(vertices.version, version, 'draw callbacks must not change attachment buffers after upload');
    const art = atlas.frames[row], size = arrowArt.getWorldScale(new THREE.Vector3());
    const x = (art.tip[0] - art.nock[0]) / art.width * size.x;
    const y = (art.nock[1] - art.tip[1]) / art.height * size.y;
    const angle = arrowArt.material.rotation;
    const paintedTip = arrowArt.getWorldPosition(new THREE.Vector3())
      .addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion), Math.cos(angle) * x - Math.sin(angle) * y)
      .addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion), Math.sin(angle) * x + Math.cos(angle) * y);
    assert.ok(screenGap(paintedTip, tip, camera) < 1e-6, 'painted arrowhead meets physical arrow tip');
  }
});

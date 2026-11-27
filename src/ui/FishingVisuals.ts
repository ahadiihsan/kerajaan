import * as THREE from 'three';
import { clamp } from '../utils/math';
import { itemIcon } from './ItemIcons';

export const CAST_FLIGHT = 0.55;
export const BITE_ANIMATION = 0.36;

export class FishingVisuals {
  private readonly rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.042, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0xa36634 }),
  );
  private readonly bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7150 }),
  );
  private readonly linePoints = new THREE.BufferAttribute(new Float32Array(9), 3);
  private readonly line = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', this.linePoints),
    new THREE.LineBasicMaterial({ color: 0xffedcf, transparent: true, opacity: 0.8 }),
  );
  private readonly ripples = [0, 1].map(() => new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xdaf9ff, transparent: true, depthWrite: false }),
  ));
  private readonly caught = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(itemIcon('fish')),
    transparent: true,
  }));
  private readonly hand = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    scene.add(this.rod, this.bobber, this.line, this.caught, ...this.ripples);
    this.line.frustumCulled = false;
    const texture = this.caught.material.map!;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.caught.scale.set(0.7, 0.7, 1);
    for (const object of [this.rod, this.bobber, this.line, this.caught, ...this.ripples]) {
      object.visible = false;
    }
  }

  update(
    position: THREE.Vector3, right: THREE.Vector3, face: number, equipped: boolean,
    cast: { target: THREE.Vector3; elapsed: number; biteAt: number } | null,
    catchTime: number, fishColor: string,
  ): void {
    this.rod.visible = equipped && catchTime <= 0;
    this.bobber.visible = this.line.visible = cast !== null;
    this.caught.visible = catchTime > 0;
    this.forward.set(-right.z, 0, right.x);
    this.hand.copy(position).addScaledVector(right, face * 0.4).addScaledVector(this.forward, 0.16);
    this.hand.y += cast ? 0.79 : 0.48;
    if (this.caught.visible) {
      const lift = Math.sin(clamp(catchTime / 0.36, 0, 1) * Math.PI / 2);
      this.caught.position.copy(this.hand).addScaledVector(right, face * 0.12);
      this.caught.position.y += lift * 0.97 + Math.sin(catchTime * 7) * 0.035;
      this.caught.material.rotation = -face * (0.4 + 0.18 * Math.sin(catchTime * 9));
      this.caught.material.color.set(fishColor);
    }

    this.direction.copy(right).multiplyScalar(face * 0.35);
    this.direction.y = 0.94;
    if (cast) {
      this.direction.subVectors(cast.target, this.hand);
      this.direction.y = 0;
      this.direction.normalize();
      if (cast.elapsed < 0.19) {
        this.direction.multiplyScalar(Math.sin((cast.elapsed / 0.19 - 0.5) * Math.PI) * 0.78);
        this.direction.y = 0.9;
      } else {
        this.direction.multiplyScalar(0.85);
        this.direction.y = 0.53 + 0.27 * Math.sin(clamp((cast.elapsed - cast.biteAt) / BITE_ANIMATION, 0, 1) * Math.PI);
      }
    }
    this.direction.normalize();
    this.tip.copy(this.hand).add(this.direction);
    this.rod.position.copy(this.hand).lerp(this.tip, 0.5);
    this.rod.quaternion.setFromUnitVectors(this.up, this.direction);

    const flight = cast ? clamp((cast.elapsed - 0.12) / (CAST_FLIGHT - 0.12), 0, 1) : 0;
    if (cast) {
      const bob = this.bobber.position;
      bob.copy(this.tip).lerp(cast.target, flight);
      bob.y += Math.sin(flight * Math.PI) * 1.18;
      if (flight === 1) {
        const tug = clamp((cast.elapsed - cast.biteAt) / BITE_ANIMATION, 0, 1);
        bob.y += 0.065 + Math.sin(cast.elapsed * 7) * 0.026 - Math.sin(tug * Math.PI) * 0.17;
      }
      this.bobber.visible = cast.elapsed >= 0.12;
      this.line.visible = this.bobber.visible;
      this.linePoints.setXYZ(0, this.tip.x, this.tip.y, this.tip.z);
      this.linePoints.setXYZ(1, (this.tip.x + bob.x) / 2, (this.tip.y + bob.y) / 2 - 0.11 * flight, (this.tip.z + bob.z) / 2);
      this.linePoints.setXYZ(2, bob.x, bob.y, bob.z);
      this.linePoints.needsUpdate = true;
    }

    this.ripples.forEach((ripple, index) => {
      const age = cast ? cast.elapsed - (cast.elapsed >= cast.biteAt ? cast.biteAt : CAST_FLIGHT) - index * 0.12 : -1;
      ripple.visible = !!cast && age >= 0 && age < 0.5;
      if (!cast || !ripple.visible) return;
      ripple.position.copy(cast.target);
      ripple.position.y += 0.025;
      ripple.scale.setScalar(0.12 + age * 0.85);
      ripple.material.opacity = (1 - age / 0.5) * 0.85;
    });
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainHeight } from './ForestTerrain';

type Point = [number, number, number];

const rounded = new THREE.IcosahedronGeometry(1, 1);
const angular = new THREE.IcosahedronGeometry(1, 0);
const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86 });
const up = new THREE.Vector3(0, 1, 0);

class AnimalModel {
  private readonly parts: THREE.BufferGeometry[] = [];

  private add(geometry: THREE.BufferGeometry, color: number, transform: THREE.Object3D): void {
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(geometry);
  }

  public shape(color: number, center: Point, radii: Point, rotation: Point = [0, 0, 0], detailed = false): void {
    const transform = new THREE.Object3D();
    transform.position.set(...center);
    transform.scale.set(...radii);
    transform.rotation.set(...rotation);
    this.add((detailed ? rounded : angular).clone(), color, transform);
  }

  public taper(color: number, base: Point, tip: Point, bottom: number, top: number, sides = 5): void {
    const start = new THREE.Vector3(...base);
    const end = new THREE.Vector3(...tip);
    const segment = end.clone().sub(start);
    const transform = new THREE.Object3D();
    transform.position.copy(start).lerp(end, 0.5);
    transform.quaternion.setFromUnitVectors(up, segment.clone().normalize());
    const indexed = new THREE.CylinderGeometry(top, bottom, segment.length(), sides);
    this.add(indexed.toNonIndexed(), color, transform);
    indexed.dispose();
  }

  public finish(): THREE.BufferGeometry {
    const geometry = mergeGeometries(this.parts);
    for (const part of this.parts) part.dispose();
    return geometry;
  }
}

function makeSheep(): THREE.BufferGeometry {
  const model = new AnimalModel();
  const wool = 0xf0e2c4;
  const cream = 0xfff3d9;
  const fleeceShadow = 0xe0c59d;
  const face = 0x50423d;
  const muzzle = 0x78635d;
  const hoof = 0x2c2528;

  model.shape(fleeceShadow, [0, 0.55, -0.09], [0.38, 0.27, 0.61], [0, 0, 0], true);
  model.shape(wool, [0, 0.76, -0.14], [0.46, 0.42, 0.66], [0.06, 0, 0], true);
  model.shape(cream, [0.01, 0.87, 0.27], [0.39, 0.36, 0.37], [-0.12, 0, 0], true);
  model.shape(cream, [-0.01, 0.73, -0.73], [0.14, 0.16, 0.22], [-0.46, 0, 0], true);
  model.shape(face, [0, 0.82, 0.65], [0.20, 0.25, 0.26], [0.24, 0, 0], true);
  model.shape(muzzle, [0, 0.72, 0.87], [0.14, 0.115, 0.12], [0.15, 0, 0], true);
  model.shape(cream, [0, 1.02, 0.64], [0.22, 0.14, 0.17], [0, 0, 0], true);
  model.shape(hoof, [0, 0.754, 0.963], [0.075, 0.035, 0.023]);

  for (const side of [-1, 1]) {
    model.shape(face, [side * 0.247, 0.92, 0.63], [0.17, 0.065, 0.09], [0, side * 0.37, -side * 0.30]);
    model.shape(0xab7b73, [side * 0.263, 0.921, 0.687], [0.10, 0.029, 0.043], [0, side * 0.15, -side * 0.25]);
    model.shape(0x211b1d, [side * 0.148, 0.885, 0.80], [0.039, 0.043, 0.027]);
    model.shape(0xfff8eb, [side * 0.155, 0.899, 0.82], [0.011, 0.014, 0.009]);
    for (const z of [-0.43, 0.29]) {
      const foot: Point = [side * 0.228, 0.078, z + side * 0.043];
      model.shape(wool, [side * 0.234, 0.47, z], [0.13, 0.21, 0.14]);
      model.taper(face, foot, [side * 0.235, 0.43, z], 0.049, 0.074);
      model.shape(hoof, [foot[0], 0.048, foot[2] + 0.024], [0.068, 0.053, 0.078]);
    }
  }
  return model.finish();
}

function makeDeer(): THREE.BufferGeometry {
  const model = new AnimalModel();
  const coat = 0xaf572e;
  const flank = 0xd58a45;
  const cream = 0xffe4ad;
  const dark = 0x422c29;
  const antler = 0xe6c89d;

  model.shape(coat, [0, 1.23, -0.12], [0.35, 0.33, 0.76], [0, 0, 0], true);
  model.shape(flank, [0, 1.18, 0.39], [0.33, 0.36, 0.38], [-0.24, 0, 0], true);
  model.shape(cream, [0, 1.04, -0.13], [0.25, 0.20, 0.59], [0, 0, 0], true);
  model.shape(flank, [0, 1.50, 0.58], [0.22, 0.55, 0.26], [0.44, 0, 0], true);
  model.shape(cream, [0, 1.46, 0.754], [0.16, 0.39, 0.12], [0.44, 0, 0], true);
  model.shape(coat, [0, 1.91, 0.80], [0.21, 0.22, 0.31], [-0.26, 0, 0], true);
  model.shape(cream, [0, 1.80, 1.045], [0.129, 0.103, 0.18], [0.18, 0, 0]);
  model.shape(dark, [0, 1.828, 1.182], [0.096, 0.052, 0.054]);
  model.shape(cream, [0, 1.26, -0.82], [0.16, 0.14, 0.20], [-0.35, 0, 0]);

  for (const side of [-1, 1]) {
    model.shape(flank, [side * 0.245, 2.045, 0.74], [0.22, 0.082, 0.097], [0, 0, side * 0.52]);
    model.shape(cream, [side * 0.267, 2.062, 0.807], [0.14, 0.042, 0.047], [0, 0, side * 0.54]);
    model.shape(dark, [side * 0.177, 1.94, 0.94], [0.041, 0.042, 0.038]);
    model.shape(0xfff3df, [side * 0.195, 1.954, 0.954], [0.012, 0.012, 0.012]);

    const antlerBase: Point = [side * 0.104, 2.08, 0.72];
    const antlerFork: Point = [side * 0.245, 2.33, 0.66];
    const antlerCrown: Point = [side * 0.39, 2.49, 0.53];
    model.taper(antler, antlerBase, antlerFork, 0.041, 0.031);
    model.taper(antler, antlerFork, antlerCrown, 0.032, 0.021);
    model.taper(antler, antlerCrown, [side * 0.42, 2.67, 0.56], 0.024, 0.005);
    model.taper(antler, antlerFork, [side * 0.255, 2.52, 0.82], 0.026, 0.005);
    model.taper(antler, antlerCrown, [side * 0.55, 2.59, 0.44], 0.023, 0.005);

    for (const z of [-0.57, 0.43]) {
      const knee: Point = [side * 0.216, 0.53, z + (z < 0 ? -0.13 : 0.05)];
      const foot: Point = [side * 0.214, 0.086, z + side * 0.075];
      model.shape(flank, [side * 0.216, 1.04, z], [0.15, 0.28, 0.18], [0.18, 0, 0]);
      model.taper(coat, knee, [side * 0.224, 1.05, z], 0.055, 0.112);
      model.taper(cream, foot, knee, 0.038, 0.058);
      model.shape(dark, [foot[0], 0.056, foot[2] + 0.023], [0.058, 0.065, 0.081]);
    }
  }
  return model.finish();
}

function makeFox(): THREE.BufferGeometry {
  const model = new AnimalModel();
  const red = 0xc7592c;
  const gold = 0xea7f38;
  const cream = 0xffebcd;
  const dark = 0x3e2927;

  model.shape(red, [0, 0.47, -0.12], [0.27, 0.26, 0.54], [-0.09, 0, 0], true);
  model.shape(cream, [0, 0.455, 0.259], [0.21, 0.24, 0.22], [-0.24, 0, 0], true);
  model.shape(gold, [0, 0.683, 0.341], [0.24, 0.23, 0.255], [0.10, 0, 0], true);
  model.shape(cream, [0, 0.585, 0.516], [0.192, 0.12, 0.23], [-0.20, 0, 0]);
  model.taper(gold, [0, 0.644, 0.49], [0, 0.613, 0.701], 0.125, 0.045, 4);
  model.shape(dark, [0, 0.611, 0.716], [0.060, 0.044, 0.036]);

  const tailRoot: Point = [0.015, 0.51, -0.54];
  const tailBend: Point = [0.18, 0.48, -0.86];
  const tailTip: Point = [0.52, 0.60, -1.12];
  model.taper(red, tailRoot, tailBend, 0.081, 0.162, 6);
  model.shape(red, tailBend, [0.186, 0.158, 0.184], [0, 0, 0], true);
  model.taper(cream, tailBend, tailTip, 0.158, 0.007, 6);

  for (const side of [-1, 1]) {
    model.taper(red, [side * 0.139, 0.815, 0.338], [side * 0.20, 1.093, 0.31], 0.102, 0.007, 4);
    model.shape(0xf9bf9d, [side * 0.159, 0.89, 0.395], [0.046, 0.105, 0.031], [0, 0, -side * 0.22]);
    model.shape(dark, [side * 0.152, 0.705, 0.505], [0.039, 0.043, 0.029]);
    model.shape(0xfff3df, [side * 0.164, 0.718, 0.526], [0.010, 0.012, 0.009]);
    for (const z of [-0.42, 0.22]) {
      const foot: Point = [side * 0.172, 0.056, z + side * 0.028];
      model.taper(dark, foot, [side * 0.172, 0.34, z], 0.040, 0.066);
      model.shape(red, [side * 0.17, 0.31, z], [0.11, 0.16, 0.125]);
      model.shape(dark, [foot[0], 0.041, foot[2] + 0.025], [0.056, 0.045, 0.078]);
    }
  }
  return model.finish();
}

export function buildForestAnimals(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Forest Wildlife';

  const add = (name: string, geometry: THREE.BufferGeometry, x: number, z: number, yaw: number, scale: number) => {
    const animal = new THREE.Mesh(geometry, material);
    animal.name = name;
    animal.position.set(x, terrainHeight(x, z), z);
    animal.rotation.y = yaw;
    animal.scale.setScalar(scale);
    animal.castShadow = animal.receiveShadow = true;
    group.add(animal);
  };

  const sheep = makeSheep();
  for (const [x, z, yaw, scale] of [
    [4.7, 10.4, -0.57, 1.14], [7.6, 11.5, 0.62, 1.11], [8.8, 13.7, -1.26, 1.02],
    [10.1, 9.3, 0.94, 1.09], [6.0, 12.7, -0.34, 0.70]
  ]) {
    add(scale < 0.8 ? 'Lamb' : 'Sheep', sheep, x, z, yaw, scale);
  }
  add('Stag', makeDeer(), -4.75, 6.7, 0.83, 1.05);
  add('Fox', makeFox(), -3.29, 14.3, -0.80, 1.17);
  return group;
}

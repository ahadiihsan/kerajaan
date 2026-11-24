import * as THREE from 'three';
import { LowPolyBuilder, LowPolyPalette } from './LowPolyBuilder';

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Landmark {
  name: string;
  x: number;
  z: number;
  type: 'plaza' | 'hall' | 'tavern' | 'tower' | 'gate' | 'residential';
}

export class TownMap {
  public group: THREE.Group;
  public collisionBoxes: CollisionBox[] = [];
  public landmarks: Landmark[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PronteraTownMap';
  }

  public assembleTown(): void {
    // 1. Central Prontera Fountain & Vending Carts
    this.buildPronteraPlaza();
    this.buildWaterCanalAndBridge();

    // 2. Prontera Castle & The Pub
    this.buildLandmarkBuildings();

    // 3. Residential & Artisan Quarters
    this.buildResidentialDistricts();

    // 4. Street Lanterns & Outskirts
    this.buildStreetLanterns();
    this.buildFoliage();
  }

  private addBuildingInstance(
    mesh: THREE.Group,
    posX: number,
    posZ: number,
    rotY: number = 0,
    width: number = 5.0,
    depth: number = 6.0
  ): void {
    mesh.position.set(posX, 0, posZ);
    mesh.rotation.y = rotY;
    this.group.add(mesh);

    const halfW = width / 2;
    const halfD = depth / 2;
    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const finalHalfW = isRotated90 ? halfD : halfW;
    const finalHalfD = isRotated90 ? halfW : halfD;

    this.collisionBoxes.push({
      minX: posX - finalHalfW,
      maxX: posX + finalHalfW,
      minZ: posZ - finalHalfD,
      maxZ: posZ + finalHalfD,
    });
  }

  private buildPronteraPlaza(): void {
    this.landmarks.push({
      name: 'Prontera Central Fountain',
      x: 0,
      z: 0,
      type: 'plaza'
    });

    // 1. Iconic Prontera Central Water Fountain
    const fountain = LowPolyBuilder.createPronteraFountain();
    fountain.position.set(0, 0, 0);
    this.group.add(fountain);
    this.collisionBoxes.push({
      minX: -3.8,
      maxX: 3.8,
      minZ: -3.8,
      maxZ: 3.8
    });

    // 2. Ragnarok Online Vending Carts around the fountain plaza
    const cart1 = LowPolyBuilder.createVendingCart(LowPolyPalette.cartRed, 'Red Potions & Wings');
    cart1.position.set(-8, 0, -6);
    cart1.rotation.y = Math.PI / 4;
    this.group.add(cart1);
    this.collisionBoxes.push({ minX: -9.0, maxX: -7.0, minZ: -7.0, maxZ: -5.0 });

    const cart2 = LowPolyBuilder.createVendingCart(LowPolyPalette.cartBlue, '+7 Damascus & Katana');
    cart2.position.set(8, 0, -6);
    cart2.rotation.y = -Math.PI / 4;
    this.group.add(cart2);
    this.collisionBoxes.push({ minX: 7.0, maxX: 9.0, minZ: -7.0, maxZ: -5.0 });

    const cart3 = LowPolyBuilder.createVendingCart(LowPolyPalette.cartYellow, 'Buying Jellopy 25z');
    cart3.position.set(-8, 0, 6);
    cart3.rotation.y = (3 * Math.PI) / 4;
    this.group.add(cart3);
    this.collisionBoxes.push({ minX: -9.0, maxX: -7.0, minZ: 5.0, maxZ: 7.0 });

    const cart4 = LowPolyBuilder.createVendingCart(LowPolyPalette.cartRed, 'Santa Hat & Bunny Band');
    cart4.position.set(8, 0, 6);
    cart4.rotation.y = -(3 * Math.PI) / 4;
    this.group.add(cart4);
    this.collisionBoxes.push({ minX: 7.0, maxX: 9.0, minZ: 5.0, maxZ: 7.0 });
  }

  private buildWaterCanalAndBridge(): void {
    // Water Canal along X = 20
    const canalW = 4.5;
    const canalL = 90;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(canalW, canalL), LowPolyPalette.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(20, 0.08, 0);
    this.group.add(water);

    const bankGeo = new THREE.BoxGeometry(0.6, 0.4, canalL);
    const leftBank = new THREE.Mesh(bankGeo, LowPolyPalette.fountainMarble);
    leftBank.position.set(17.8, 0.2, 0);
    leftBank.castShadow = true;
    this.group.add(leftBank);

    const rightBank = new THREE.Mesh(bankGeo, LowPolyPalette.fountainMarble);
    rightBank.position.set(22.2, 0.2, 0);
    rightBank.castShadow = true;
    this.group.add(rightBank);

    // Wooden Footbridge crossing canal
    const bridge = new THREE.Group();
    bridge.position.set(20, 0, 0);

    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 3.2), LowPolyPalette.woodPlanks);
    bridgeDeck.position.y = 0.35;
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    bridge.add(bridgeDeck);

    const railGeo = new THREE.BoxGeometry(5.2, 0.8, 0.12);
    const railL = new THREE.Mesh(railGeo, LowPolyPalette.woodDark);
    railL.position.set(0, 0.85, -1.5);
    bridge.add(railL);

    const railR = new THREE.Mesh(railGeo, LowPolyPalette.woodDark);
    railR.position.set(0, 0.85, 1.5);
    bridge.add(railR);

    this.group.add(bridge);

    this.collisionBoxes.push({ minX: 18.0, maxX: 22.0, minZ: -45, maxZ: -2.0 });
    this.collisionBoxes.push({ minX: 18.0, maxX: 22.0, minZ: 2.0, maxZ: 45 });
  }

  private buildLandmarkBuildings(): void {
    // Prontera Castle / Grand Hall
    const castleHall = LowPolyBuilder.createTownHall();
    this.addBuildingInstance(castleHall, 0, -28, 0, 9.6, 12.0);
    this.landmarks.push({
      name: 'Prontera Castle Gate',
      x: 0,
      z: -28,
      type: 'hall'
    });

    // Prontera Pub & Tavern
    const tavern = LowPolyBuilder.createTavern();
    this.addBuildingInstance(tavern, -22, 0, Math.PI / 2, 8.4, 10.0);
    this.landmarks.push({
      name: 'Prontera Pub & Inn',
      x: -22,
      z: 0,
      type: 'tavern'
    });
  }

  private buildResidentialDistricts(): void {
    // East Canal Quarter (Weapon & Armor Smithy)
    const h1 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h1, 30, -6, -Math.PI / 2, 5.4, 7.0);

    const h2 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h2, 30, 10, -Math.PI / 2, 5.4, 7.0);

    const c1 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c1, 40, -12, 0, 4.6, 6.0);

    const c2 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c2, 40, 4, 0, 4.6, 6.0);

    // North Quarters
    const h3 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h3, 14, -38, Math.PI, 5.4, 7.0);

    const h4 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h4, -16, -38, Math.PI, 5.4, 7.0);

    const c3 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c3, -28, -32, Math.PI / 2, 4.6, 6.0);

    // West Alleys
    const c4 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c4, -36, 6, Math.PI / 2, 4.6, 6.0);

    const h5 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h5, -36, 20, Math.PI / 2, 5.4, 7.0);

    // South Gate District (Road to Poring Field!)
    const h6 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h6, -14, 28, 0, 5.4, 7.0);

    const h7 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h7, 12, 28, 0, 5.4, 7.0);

    const c5 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c5, -14, 42, 0, 4.6, 6.0);

    const c6 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c6, 12, 42, 0, 4.6, 6.0);

    this.landmarks.push({
      name: 'Prontera South Gate (Poring Field)',
      x: 0,
      z: 50,
      type: 'gate'
    });
  }

  private buildStreetLanterns(): void {
    const lampCoords = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: -5, z: 5 },
      { x: 5, z: 5 },
      { x: 18, z: -2 },
      { x: 18, z: 2 },
      { x: -16, z: 0 },
      { x: 0, z: -18 },
    ];

    lampCoords.forEach((coord) => {
      const lamp = new THREE.Group();
      lamp.position.set(coord.x, 0, coord.z);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), LowPolyPalette.fountainMarble);
      post.position.y = 1.3;
      post.castShadow = true;
      lamp.add(post);

      const lanternGlass = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), LowPolyPalette.lanternGlow);
      lanternGlass.position.set(0, 2.6, 0);
      lamp.add(lanternGlass);

      this.group.add(lamp);

      this.collisionBoxes.push({
        minX: coord.x - 0.4,
        maxX: coord.x + 0.4,
        minZ: coord.z - 0.4,
        maxZ: coord.z + 0.4,
      });
    });
  }

  private buildFoliage(): void {
    const treeCoords = [
      { x: -6, z: -62, type: 'pine', s: 1.1 },
      { x: 6, z: -62, type: 'oak', s: 1.0 },
      { x: -22, z: -60, type: 'pine', s: 1.2 },
      { x: -6, z: 62, type: 'oak', s: 1.1 },
      { x: 6, z: 62, type: 'pine', s: 1.2 },
      { x: 48, z: -18, type: 'oak', s: 1.1 },
      { x: 48, z: 8, type: 'pine', s: 1.2 },
      { x: -48, z: -18, type: 'pine', s: 1.15 },
      { x: -48, z: 8, type: 'oak', s: 1.05 },
      { x: -24, z: -8, type: 'oak', s: 0.9 },
      { x: 26, z: -24, type: 'pine', s: 0.95 },
    ];

    treeCoords.forEach((tc) => {
      const tree = LowPolyBuilder.createTree(tc.type as 'pine' | 'oak', tc.s);
      tree.position.set(tc.x, 0, tc.z);
      this.group.add(tree);

      this.collisionBoxes.push({
        minX: tc.x - 0.5 * tc.s,
        maxX: tc.x + 0.5 * tc.s,
        minZ: tc.z - 0.5 * tc.s,
        maxZ: tc.z + 0.5 * tc.s,
      });
    });
  }

  public resolveCollision(
    _currentX: number,
    _currentZ: number,
    targetX: number,
    targetZ: number,
    playerRadius: number = 0.45
  ): { x: number; z: number; collided: boolean } {
    let resolvedX = targetX;
    let resolvedZ = targetZ;
    let collided = false;

    const mapLimit = 75;
    if (Math.abs(resolvedX) > mapLimit) {
      resolvedX = Math.sign(resolvedX) * mapLimit;
      collided = true;
    }
    if (Math.abs(resolvedZ) > mapLimit) {
      resolvedZ = Math.sign(resolvedZ) * mapLimit;
      collided = true;
    }

    for (const box of this.collisionBoxes) {
      const minX = box.minX - playerRadius;
      const maxX = box.maxX + playerRadius;
      const minZ = box.minZ - playerRadius;
      const maxZ = box.maxZ + playerRadius;

      if (resolvedX > minX && resolvedX < maxX && resolvedZ > minZ && resolvedZ < maxZ) {
        collided = true;
        const dx1 = resolvedX - minX;
        const dx2 = maxX - resolvedX;
        const dz1 = resolvedZ - minZ;
        const dz2 = maxZ - resolvedZ;

        const minPenX = Math.min(dx1, dx2);
        const minPenZ = Math.min(dz1, dz2);

        if (minPenX < minPenZ) {
          resolvedX = dx1 < dx2 ? minX : maxX;
        } else {
          resolvedZ = dz1 < dz2 ? minZ : maxZ;
        }
      }
    }

    return { x: resolvedX, z: resolvedZ, collided };
  }
}

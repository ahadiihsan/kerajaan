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
    this.group.name = 'TownMap';
  }

  public assembleTown(): void {
    // 1. Build Central Plaza Landmarks & Market
    this.buildMarketPlaza();

    // 2. Build Major Landmark Buildings
    this.buildLandmarkBuildings();

    // 3. Build Residential Districts & Alleys
    this.buildResidentialDistricts();

    // 4. Build Watchtowers & Perimeter Fences
    this.buildDefensesAndFences();

    // 5. Build Trees, Foliage & Ambient Props
    this.buildTreesAndProps();
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

  private buildMarketPlaza(): void {
    // 1. Central Plaza Landmark
    this.landmarks.push({
      name: 'Town Square Plaza',
      x: 0,
      z: 0,
      type: 'plaza'
    });

    // 2. Central Well
    const well = LowPolyBuilder.createCentralWell();
    well.position.set(0, 0, 0);
    this.group.add(well);
    this.collisionBoxes.push({
      minX: -1.8,
      maxX: 1.8,
      minZ: -1.8,
      maxZ: 1.8
    });

    // 3. 4 Colorful Market Stalls in Plaza corners
    const stall1 = LowPolyBuilder.createMarketStall(LowPolyPalette.roofTerracotta);
    this.addBuildingInstance(stall1, -8, -8, Math.PI / 4, 3.0, 2.0);

    const stall2 = LowPolyBuilder.createMarketStall(LowPolyPalette.roofBlue);
    this.addBuildingInstance(stall2, 8, -8, -Math.PI / 4, 3.0, 2.0);

    const stall3 = LowPolyBuilder.createMarketStall(LowPolyPalette.roofGreen);
    this.addBuildingInstance(stall3, -8, 8, (3 * Math.PI) / 4, 3.0, 2.0);

    const stall4 = LowPolyBuilder.createMarketStall(LowPolyPalette.gold);
    this.addBuildingInstance(stall4, 8, 8, -(3 * Math.PI) / 4, 3.0, 2.0);
  }

  private buildLandmarkBuildings(): void {
    // 1. Grand Town Hall (North of the plaza)
    const townHall = LowPolyBuilder.createTownHall();
    this.addBuildingInstance(townHall, 0, -28, 0, 9.6, 12.0);
    this.landmarks.push({
      name: 'Elderstone Town Hall',
      x: 0,
      z: -28,
      type: 'hall'
    });

    // 2. The Boar & Flagon Tavern (West of the plaza)
    const tavern = LowPolyBuilder.createTavern();
    this.addBuildingInstance(tavern, -22, 0, Math.PI / 2, 8.4, 10.0);
    this.landmarks.push({
      name: 'The Boar & Flagon Tavern',
      x: -22,
      z: 0,
      type: 'tavern'
    });
  }

  private buildResidentialDistricts(): void {
    // East Artisan Row
    const h1 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h1, 22, -6, -Math.PI / 2, 5.4, 7.0);

    const h2 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h2, 22, 10, -Math.PI / 2, 5.4, 7.0);

    const c1 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c1, 34, -12, 0, 4.6, 6.0);

    const c2 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c2, 34, 4, 0, 4.6, 6.0);

    const c3 = LowPolyBuilder.createCottage('green');
    this.addBuildingInstance(c3, 34, 18, 0, 4.6, 6.0);

    this.landmarks.push({
      name: 'East Artisan Row',
      x: 26,
      z: 4,
      type: 'residential'
    });

    // North-East & North-West Quarters
    const h3 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h3, 16, -40, Math.PI, 5.4, 7.0);

    const c4 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c4, 30, -34, -Math.PI / 2, 4.6, 6.0);

    const h4 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h4, -16, -40, Math.PI, 5.4, 7.0);

    const c5 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c5, -30, -34, Math.PI / 2, 4.6, 6.0);

    // West Residential Alley (behind Tavern)
    const c6 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c6, -36, 6, Math.PI / 2, 4.6, 6.0);

    const h5 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h5, -36, 20, Math.PI / 2, 5.4, 7.0);

    this.landmarks.push({
      name: 'West Alley Quarter',
      x: -28,
      z: 16,
      type: 'residential'
    });

    // South Gate District
    const h6 = LowPolyBuilder.createHouseMedium('green');
    this.addBuildingInstance(h6, -14, 28, 0, 5.4, 7.0);

    const h7 = LowPolyBuilder.createHouseMedium('terracotta');
    this.addBuildingInstance(h7, 14, 28, 0, 5.4, 7.0);

    const c7 = LowPolyBuilder.createCottage('terracotta');
    this.addBuildingInstance(c7, -16, 44, 0, 4.6, 6.0);

    const c8 = LowPolyBuilder.createCottage('slate');
    this.addBuildingInstance(c8, 16, 44, 0, 4.6, 6.0);
  }

  private buildDefensesAndFences(): void {
    // North Watchtower
    const towerNorth = LowPolyBuilder.createWatchTower();
    this.addBuildingInstance(towerNorth, 12, -54, 0, 5.5, 5.5);
    this.landmarks.push({
      name: 'North Gate & Watchtower',
      x: 12,
      z: -54,
      type: 'tower'
    });

    // South Watchtower
    const towerSouth = LowPolyBuilder.createWatchTower();
    this.addBuildingInstance(towerSouth, -12, 54, Math.PI, 5.5, 5.5);
    this.landmarks.push({
      name: 'South Outpost Tower',
      x: -12,
      z: 54,
      type: 'tower'
    });

    // Perimeter Wooden Fences
    const fencePositions = [
      { x: -8, z: -54, rotY: 0 },
      { x: -14, z: -54, rotY: 0 },
      { x: -20, z: -54, rotY: 0 },
      { x: 18, z: -54, rotY: 0 },
      { x: 24, z: -54, rotY: 0 },
      { x: 8, z: 54, rotY: 0 },
      { x: 14, z: 54, rotY: 0 },
      { x: -18, z: 54, rotY: 0 },
      { x: -24, z: 54, rotY: 0 },
      { x: 44, z: -16, rotY: Math.PI / 2 },
      { x: 44, z: -8, rotY: Math.PI / 2 },
      { x: 44, z: 0, rotY: Math.PI / 2 },
      { x: 44, z: 8, rotY: Math.PI / 2 },
      { x: 44, z: 16, rotY: Math.PI / 2 },
      { x: -44, z: -16, rotY: Math.PI / 2 },
      { x: -44, z: -8, rotY: Math.PI / 2 },
      { x: -44, z: 0, rotY: Math.PI / 2 },
      { x: -44, z: 8, rotY: Math.PI / 2 },
      { x: -44, z: 16, rotY: Math.PI / 2 },
    ];

    fencePositions.forEach((fp) => {
      const fence = LowPolyBuilder.createFence();
      fence.position.set(fp.x, 0, fp.z);
      fence.rotation.y = fp.rotY;
      this.group.add(fence);

      this.collisionBoxes.push({
        minX: fp.x - 1.5,
        maxX: fp.x + 1.5,
        minZ: fp.z - 0.3,
        maxZ: fp.z + 0.3
      });
    });
  }

  private buildTreesAndProps(): void {
    const treeCoords = [
      // North grove
      { x: -5, z: -64, type: 'pine', s: 1.1 },
      { x: 5, z: -66, type: 'oak', s: 1.0 },
      { x: -24, z: -62, type: 'pine', s: 1.2 },
      { x: 26, z: -62, type: 'oak', s: 1.05 },
      { x: -38, z: -48, type: 'pine', s: 1.0 },
      { x: 38, z: -48, type: 'oak', s: 1.15 },
      // South forest
      { x: -5, z: 64, type: 'oak', s: 1.1 },
      { x: 5, z: 66, type: 'pine', s: 1.2 },
      { x: -22, z: 64, type: 'oak', s: 1.0 },
      { x: 24, z: 64, type: 'pine', s: 1.15 },
      { x: -38, z: 48, type: 'pine', s: 1.05 },
      { x: 38, z: 48, type: 'oak', s: 1.2 },
      // East orchard
      { x: 52, z: -20, type: 'oak', s: 1.1 },
      { x: 55, z: -6, type: 'pine', s: 1.2 },
      { x: 54, z: 8, type: 'oak', s: 1.0 },
      { x: 52, z: 22, type: 'pine', s: 1.15 },
      // West woodland
      { x: -52, z: -20, type: 'pine', s: 1.15 },
      { x: -55, z: -6, type: 'oak', s: 1.05 },
      { x: -54, z: 8, type: 'pine', s: 1.2 },
      { x: -52, z: 22, type: 'oak', s: 1.1 },
      // Pockets in town
      { x: -26, z: -8, type: 'oak', s: 0.9 },
      { x: -24, z: 28, type: 'pine', s: 0.95 },
      { x: 24, z: -26, type: 'oak', s: 0.9 }
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

    const mapLimit = 85;
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

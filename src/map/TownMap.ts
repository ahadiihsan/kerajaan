import * as THREE from 'three';
import { AssetManager } from '../core/AssetManager';
import { BlueprintLibrary, BuildingBlueprint } from './Blueprints';

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
  private assetMgr: AssetManager;

  constructor(assetMgr: AssetManager) {
    this.assetMgr = assetMgr;
    this.group = new THREE.Group();
    this.group.name = 'TownMap';
  }

  public assembleTown(): void {
    // 1. Build Key Landmark Buildings
    this.buildLandmarks();

    // 2. Build Residential & Merchant Districts
    this.buildResidentialQuarters();

    // 3. Build Central Market Plaza Props & Well
    this.buildMarketPlaza();

    // 4. Build Defensive Watchtowers & Perimeter Fences
    this.buildDefensesAndFences();

    // 5. Build Surrounding Foliage / Trees & Props
    this.buildFoliageAndProps();
  }

  private addBuilding(
    blueprint: BuildingBlueprint,
    posX: number,
    posZ: number,
    rotY: number = 0
  ): THREE.Group {
    const building = BlueprintLibrary.instantiate(blueprint, this.assetMgr);
    building.position.set(posX, 0, posZ);
    building.rotation.y = rotY;
    this.group.add(building);

    // Calculate transformed collision bounding box
    const halfW = blueprint.collisionBox.width / 2;
    const halfD = blueprint.collisionBox.depth / 2;

    // Support 90-degree rotations cleanly
    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const finalHalfW = isRotated90 ? halfD : halfW;
    const finalHalfD = isRotated90 ? halfW : halfD;

    this.collisionBoxes.push({
      minX: posX - finalHalfW,
      maxX: posX + finalHalfW,
      minZ: posZ - finalHalfD,
      maxZ: posZ + finalHalfD,
    });

    return building;
  }

  private buildLandmarks(): void {
    // 1. Grand Town Hall (North of the main plaza)
    this.addBuilding(BlueprintLibrary.getTownHall(), 0, -26, 0);
    this.landmarks.push({
      name: 'Elderstone Town Hall',
      x: 0,
      z: -26,
      type: 'hall'
    });

    // 2. The Boar & Flagon Tavern (West of the main plaza)
    this.addBuilding(BlueprintLibrary.getTavern(), -22, 0, Math.PI / 2);
    this.landmarks.push({
      name: 'The Boar & Flagon Tavern',
      x: -22,
      z: 0,
      type: 'tavern'
    });

    // Central Plaza Landmark
    this.landmarks.push({
      name: 'Town Square Plaza',
      x: 0,
      z: 0,
      type: 'plaza'
    });
  }

  private buildResidentialQuarters(): void {
    const house = BlueprintLibrary.getHouseMedium();
    const cottage = BlueprintLibrary.getCottageSmall();

    // East Street (Craftsmen & Residences)
    this.addBuilding(house, 22, -6, -Math.PI / 2);
    this.addBuilding(house, 22, 10, -Math.PI / 2);
    this.addBuilding(cottage, 34, -12, 0);
    this.addBuilding(cottage, 34, 4, 0);
    this.addBuilding(cottage, 34, 18, 0);

    // North-East Quarter
    this.addBuilding(house, 16, -38, Math.PI);
    this.addBuilding(cottage, 30, -32, -Math.PI / 2);

    // North-West Quarter
    this.addBuilding(house, -16, -38, Math.PI);
    this.addBuilding(cottage, -30, -32, Math.PI / 2);
    this.addBuilding(cottage, -34, -16, 0);

    // West Residential Alley (behind Tavern)
    this.addBuilding(cottage, -36, 6, Math.PI / 2);
    this.addBuilding(house, -36, 20, Math.PI / 2);

    // South District (Approaching South Gate)
    this.addBuilding(house, -14, 28, 0);
    this.addBuilding(house, 14, 28, 0);
    this.addBuilding(cottage, -16, 44, 0);
    this.addBuilding(cottage, 16, 44, 0);
    this.addBuilding(cottage, -30, 36, Math.PI / 2);
    this.addBuilding(cottage, 30, 36, -Math.PI / 2);

    this.landmarks.push({
      name: 'East Artisan Row',
      x: 26,
      z: 4,
      type: 'residential'
    });
    this.landmarks.push({
      name: 'West Alley Quarter',
      x: -28,
      z: 16,
      type: 'residential'
    });
  }

  private buildMarketPlaza(): void {
    const stall = BlueprintLibrary.getMarketStall();

    // 4 Market Stalls in Plaza corners facing inward
    this.addBuilding(stall, -8, -8, Math.PI / 4);
    this.addBuilding(stall, 8, -8, -Math.PI / 4);
    this.addBuilding(stall, -8, 8, (3 * Math.PI) / 4);
    this.addBuilding(stall, 8, 8, -(3 * Math.PI) / 4);

    // Center Plaza Monument / Well
    const wellGroup = new THREE.Group();
    wellGroup.position.set(0, 0, 0);

    // Stone well ring using textured cylinder
    const wellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.6, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x6e6860, roughness: 0.85 })
    );
    wellBase.position.y = 0.5;
    wellBase.castShadow = true;
    wellBase.receiveShadow = true;
    wellGroup.add(wellBase);

    // Water surface inside well
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x1d3c4d, roughness: 0.1, metalness: 0.8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.75;
    wellGroup.add(water);

    // Wooden roof posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4), postMat);
    post1.position.set(-1.1, 1.5, 0);
    post1.castShadow = true;
    wellGroup.add(post1);

    const post2 = post1.clone();
    post2.position.set(1.1, 1.5, 0);
    wellGroup.add(post2);

    // Cross beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), postMat);
    beam.position.set(0, 2.5, 0);
    beam.castShadow = true;
    wellGroup.add(beam);

    // Pitch tiled roof from the kit
    const wellRoof = this.assetMgr.getClone('Roof_RoundTile_2x1') ||
                     this.assetMgr.getClone('Roof_RoundTiles_4x4');
    if (wellRoof) {
      wellRoof.position.set(0, 2.7, 0);
      wellRoof.scale.set(0.65, 0.65, 0.65);
      wellGroup.add(wellRoof);
    }

    this.group.add(wellGroup);

    // Collision for central well
    this.collisionBoxes.push({
      minX: -2.0,
      maxX: 2.0,
      minZ: -2.0,
      maxZ: 2.0
    });
  }

  private buildDefensesAndFences(): void {
    const tower = BlueprintLibrary.getWatchTower();

    // North Watchtower (Overlooking North Gate)
    this.addBuilding(tower, 12, -54, 0);
    this.landmarks.push({
      name: 'North Gate & Watchtower',
      x: 12,
      z: -54,
      type: 'tower'
    });

    // South Watchtower (Overlooking South Gate)
    this.addBuilding(tower, -12, 54, Math.PI);
    this.landmarks.push({
      name: 'South Outpost Tower',
      x: -12,
      z: 54,
      type: 'tower'
    });

    // Perimeter Wooden Fences enclosing the village lots
    const fencePositions: { x: number; z: number; rotY: number }[] = [
      // North boundary line
      { x: -8, z: -54, rotY: 0 },
      { x: -14, z: -54, rotY: 0 },
      { x: -20, z: -54, rotY: 0 },
      { x: -26, z: -54, rotY: 0 },
      { x: 18, z: -54, rotY: 0 },
      { x: 24, z: -54, rotY: 0 },
      { x: 30, z: -54, rotY: 0 },

      // South boundary line
      { x: 8, z: 54, rotY: 0 },
      { x: 14, z: 54, rotY: 0 },
      { x: 20, z: 54, rotY: 0 },
      { x: -18, z: 54, rotY: 0 },
      { x: -24, z: 54, rotY: 0 },
      { x: -30, z: 54, rotY: 0 },

      // East boundary line
      { x: 44, z: -20, rotY: Math.PI / 2 },
      { x: 44, z: -12, rotY: Math.PI / 2 },
      { x: 44, z: -4, rotY: Math.PI / 2 },
      { x: 44, z: 4, rotY: Math.PI / 2 },
      { x: 44, z: 12, rotY: Math.PI / 2 },
      { x: 44, z: 20, rotY: Math.PI / 2 },
      { x: 44, z: 28, rotY: Math.PI / 2 },

      // West boundary line
      { x: -44, z: -20, rotY: Math.PI / 2 },
      { x: -44, z: -12, rotY: Math.PI / 2 },
      { x: -44, z: -4, rotY: Math.PI / 2 },
      { x: -44, z: 4, rotY: Math.PI / 2 },
      { x: -44, z: 12, rotY: Math.PI / 2 },
      { x: -44, z: 20, rotY: Math.PI / 2 },
      { x: -44, z: 28, rotY: Math.PI / 2 },
    ];

    fencePositions.forEach((fp) => {
      const fenceClone = this.assetMgr.getClone('Prop_WoodenFence_Extension1') ||
                         this.assetMgr.getClone('Prop_WoodenFence_Single');
      if (fenceClone) {
        fenceClone.position.set(fp.x, 0, fp.z);
        fenceClone.rotation.y = fp.rotY;
        this.group.add(fenceClone);

        // Fence collision
        this.collisionBoxes.push({
          minX: fp.x - 1.6,
          maxX: fp.x + 1.6,
          minZ: fp.z - 0.4,
          maxZ: fp.z + 0.4
        });
      }
    });
  }

  private buildFoliageAndProps(): void {
    // Beautiful stylized medieval pine and oak trees around the village boundaries
    const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.5, 6);
    const pineGeo1 = new THREE.ConeGeometry(2.4, 3.2, 7);
    const pineGeo2 = new THREE.ConeGeometry(1.9, 2.8, 7);
    const pineGeo3 = new THREE.ConeGeometry(1.3, 2.2, 7);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x422a18, roughness: 0.9 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x274921, roughness: 0.8 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x365e2e, roughness: 0.8 });

    const createPineTree = (x: number, z: number, scale: number = 1.0) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(scale);

      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      const cone1 = new THREE.Mesh(pineGeo1, leafMat1);
      cone1.position.y = 3.0;
      cone1.castShadow = true;
      cone1.receiveShadow = true;
      tree.add(cone1);

      const cone2 = new THREE.Mesh(pineGeo2, leafMat2);
      cone2.position.y = 4.4;
      cone2.castShadow = true;
      cone2.receiveShadow = true;
      tree.add(cone2);

      const cone3 = new THREE.Mesh(pineGeo3, leafMat1);
      cone3.position.y = 5.6;
      cone3.castShadow = true;
      cone3.receiveShadow = true;
      tree.add(cone3);

      this.group.add(tree);

      // Tree trunk collision
      this.collisionBoxes.push({
        minX: x - 0.6 * scale,
        maxX: x + 0.6 * scale,
        minZ: z - 0.6 * scale,
        maxZ: z + 0.6 * scale,
      });
    };

    // Scatter trees along perimeter meadows and gardens
    const treeCoords = [
      // North grove
      { x: -5, z: -62 }, { x: 5, z: -64 }, { x: -22, z: -62 }, { x: 24, z: -62 },
      { x: -38, z: -48 }, { x: 38, z: -48 },
      // South forest fringe
      { x: -5, z: 62 }, { x: 5, z: 65 }, { x: -22, z: 64 }, { x: 22, z: 63 },
      { x: -38, z: 48 }, { x: 38, z: 48 },
      // East orchard
      { x: 52, z: -25 }, { x: 55, z: -10 }, { x: 54, z: 5 }, { x: 52, z: 20 },
      { x: 56, z: 35 },
      // West woodland
      { x: -52, z: -25 }, { x: -55, z: -10 }, { x: -54, z: 5 }, { x: -52, z: 20 },
      { x: -56, z: 35 },
      // Town garden pockets
      { x: -26, z: -8 }, { x: -24, z: 28 }, { x: 24, z: -26 }
    ];

    treeCoords.forEach((tc, idx) => {
      const scale = 0.85 + (idx % 4) * 0.15;
      createPineTree(tc.x, tc.z, scale);
    });
  }

  /**
   * Collision resolution against town obstacles
   * Returns adjusted [newX, newZ] pushing the player outside colliding boxes
   */
  public resolveCollision(
    currentX: number,
    currentZ: number,
    targetX: number,
    targetZ: number,
    playerRadius: number = 0.45
  ): { x: number; z: number; collided: boolean } {
    let resolvedX = targetX;
    let resolvedZ = targetZ;
    let collided = false;

    // Check bounds against map perimeter
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

      // Is the player inside this expanded box?
      if (resolvedX > minX && resolvedX < maxX && resolvedZ > minZ && resolvedZ < maxZ) {
        collided = true;

        // Push out along the shallowest penetration axis
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

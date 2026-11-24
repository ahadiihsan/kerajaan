import * as THREE from 'three';
import { AssetManager } from '../core/AssetManager';

export interface PartPlacement {
  model: string;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

export interface BuildingBlueprint {
  name: string;
  parts: PartPlacement[];
  collisionBox: { width: number; depth: number; offsetX?: number; offsetZ?: number };
}

export class BlueprintLibrary {
  public static getRequiredModelNames(): string[] {
    return [
      'Wall_Plaster_Straight',
      'Wall_Plaster_Door_Round',
      'Wall_Plaster_Door_Flat',
      'Wall_Plaster_Window_Wide_Flat',
      'Wall_Plaster_Window_Thin_Round',
      'Wall_UnevenBrick_Straight',
      'Wall_UnevenBrick_Door_Flat',
      'Wall_UnevenBrick_Window_Wide_Flat',
      'Wall_UnevenBrick_Window_Thin_Round',
      'Corner_Exterior_Wood',
      'Corner_Exterior_Brick',
      'Roof_RoundTiles_4x4',
      'Roof_RoundTiles_4x6',
      'Roof_RoundTiles_6x8',
      'Roof_RoundTiles_6x10',
      'Roof_Tower_RoundTiles',
      'Roof_Dormer_RoundTile',
      'Roof_RoundTile_2x1',
      'Prop_Support',
      'Prop_Chimney',
      'Prop_Chimney2',
      'Prop_Crate',
      'Prop_Wagon',
      'Prop_WoodenFence_Single',
      'Prop_WoodenFence_Extension1',
      'Balcony_Simple_Straight',
      'Balcony_Simple_Corner',
      'Balcony_Cross_Straight',
      'Wall_Arch',
      'Floor_Brick',
      'Stairs_Exterior_Straight'
    ];
  }

  /**
   * 1. Small Cottage (4m x 6m, 1 Story with pitched roof & chimney)
   */
  public static getCottageSmall(): BuildingBlueprint {
    return {
      name: 'CottageSmall',
      collisionBox: { width: 4.4, depth: 6.4 },
      parts: [
        // Front (Z = +3): Door at X=-1, Window at X=+1
        { model: 'Wall_Plaster_Door_Round', pos: [-1, 0, 3], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [1, 0, 3], rot: [0, 0, 0] },

        // Back (Z = -3): Windows & Wall
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-1, 0, -3], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Straight', pos: [1, 0, -3], rot: [0, Math.PI, 0] },

        // Left Side (X = -2): 3 wall panels along Z from -2 to +2
        { model: 'Wall_Plaster_Straight', pos: [-2, 0, -2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [-2, 0, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [-2, 0, 2], rot: [0, Math.PI / 2, 0] },

        // Right Side (X = +2): 3 wall panels along Z from -2 to +2
        { model: 'Wall_Plaster_Straight', pos: [2, 0, -2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [2, 0, 2], rot: [0, -Math.PI / 2, 0] },

        // Corners (Wood)
        { model: 'Corner_Exterior_Wood', pos: [-2, 0, 3], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Wood', pos: [2, 0, 3], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Wood', pos: [2, 0, -3], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Wood', pos: [-2, 0, -3], rot: [0, Math.PI / 2, 0] },

        // Roof (4x6 round tiles, at Y = 3)
        { model: 'Roof_RoundTiles_4x6', pos: [0, 3, 0], rot: [0, 0, 0] },

        // Chimney on the roof
        { model: 'Prop_Chimney', pos: [1.3, 4.2, -1.2], rot: [0, 0, 0] },

        // Crate near front entrance
        { model: 'Prop_Crate', pos: [1.8, 0, 3.4], rot: [0, 0.3, 0] }
      ]
    };
  }

  /**
   * 2. Medium Two-Story Half-Timbered House (4m x 6m)
   * Ground floor stone brick, upper floor plaster with dormer roof
   */
  public static getHouseMedium(): BuildingBlueprint {
    return {
      name: 'HouseMedium',
      collisionBox: { width: 4.5, depth: 6.5 },
      parts: [
        // Ground Floor - Uneven Brick (Y = 0)
        // Front
        { model: 'Wall_UnevenBrick_Door_Flat', pos: [-1, 0, 3], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [1, 0, 3], rot: [0, 0, 0] },
        // Back
        { model: 'Wall_UnevenBrick_Straight', pos: [-1, 0, -3], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [1, 0, -3], rot: [0, Math.PI, 0] },
        // Left (X = -2)
        { model: 'Wall_UnevenBrick_Straight', pos: [-2, 0, -2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [-2, 0, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [-2, 0, 2], rot: [0, Math.PI / 2, 0] },
        // Right (X = +2)
        { model: 'Wall_UnevenBrick_Straight', pos: [2, 0, -2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [2, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [2, 0, 2], rot: [0, -Math.PI / 2, 0] },
        // Ground Corners (Brick)
        { model: 'Corner_Exterior_Brick', pos: [-2, 0, 3], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 0, 3], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 0, -3], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-2, 0, -3], rot: [0, Math.PI / 2, 0] },

        // Second Floor - Plaster (Y = 3)
        // Front
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-1, 3, 3], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [1, 3, 3], rot: [0, 0, 0] },
        // Back
        { model: 'Wall_Plaster_Straight', pos: [-1, 3, -3], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [1, 3, -3], rot: [0, Math.PI, 0] },
        // Left (X = -2)
        { model: 'Wall_Plaster_Straight', pos: [-2, 3, -2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [-2, 3, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [-2, 3, 2], rot: [0, Math.PI / 2, 0] },
        // Right (X = +2)
        { model: 'Wall_Plaster_Straight', pos: [2, 3, -2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [2, 3, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 3, 2], rot: [0, -Math.PI / 2, 0] },
        // Second Floor Corners (Wood)
        { model: 'Corner_Exterior_Wood', pos: [-2, 3, 3], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Wood', pos: [2, 3, 3], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Wood', pos: [2, 3, -3], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Wood', pos: [-2, 3, -3], rot: [0, Math.PI / 2, 0] },

        // Roof at Y = 6
        { model: 'Roof_RoundTiles_4x6', pos: [0, 6, 0], rot: [0, 0, 0] },
        { model: 'Roof_Dormer_RoundTile', pos: [0, 6.7, 1.5], rot: [0, 0, 0] },
        { model: 'Prop_Chimney2', pos: [-1.2, 7.3, -1.4], rot: [0, 0, 0] },

        // Crates stacked near side
        { model: 'Prop_Crate', pos: [-2.4, 0, 1.2], rot: [0, 0.4, 0] },
        { model: 'Prop_Crate', pos: [-2.4, 0.8, 1.2], rot: [0, 0.1, 0] }
      ]
    };
  }

  /**
   * 3. Large Village Tavern (6m x 8m, 2 Stories, Arches, Balcony)
   */
  public static getTavern(): BuildingBlueprint {
    return {
      name: 'Tavern',
      collisionBox: { width: 6.6, depth: 8.6 },
      parts: [
        // Ground Floor - Uneven Brick & Arches (Y = 0)
        // Front (Z = +4): 3 panels at X = -2, 0, 2
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [-2, 0, 4], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Door_Flat', pos: [0, 0, 4], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [2, 0, 4], rot: [0, 0, 0] },

        // Back (Z = -4)
        { model: 'Wall_UnevenBrick_Straight', pos: [-2, 0, -4], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [0, 0, -4], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [2, 0, -4], rot: [0, Math.PI, 0] },

        // Left (X = -3): 4 panels at Z = -3, -1, 1, 3
        { model: 'Wall_UnevenBrick_Straight', pos: [-3, 0, -3], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Arch', pos: [-3, 0, -1], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Arch', pos: [-3, 0, 1], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [-3, 0, 3], rot: [0, Math.PI / 2, 0] },

        // Right (X = +3)
        { model: 'Wall_UnevenBrick_Straight', pos: [3, 0, -3], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [3, 0, -1], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [3, 0, 1], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [3, 0, 3], rot: [0, -Math.PI / 2, 0] },

        // Ground Corners
        { model: 'Corner_Exterior_Brick', pos: [-3, 0, 4], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Brick', pos: [3, 0, 4], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [3, 0, -4], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-3, 0, -4], rot: [0, Math.PI / 2, 0] },

        // Second Floor - Plaster (Y = 3)
        // Front
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-2, 3, 4], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Door_Round', pos: [0, 3, 4], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 3, 4], rot: [0, 0, 0] },

        // Front Wooden Balcony (over entrance)
        { model: 'Balcony_Cross_Straight', pos: [0, 3, 4.3], rot: [0, 0, 0] },

        // Back
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-2, 3, -4], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Straight', pos: [0, 3, -4], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 3, -4], rot: [0, Math.PI, 0] },

        // Left (X = -3)
        { model: 'Wall_Plaster_Straight', pos: [-3, 3, -3], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-3, 3, -1], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-3, 3, 1], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [-3, 3, 3], rot: [0, Math.PI / 2, 0] },

        // Right (X = +3)
        { model: 'Wall_Plaster_Straight', pos: [3, 3, -3], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [3, 3, -1], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [3, 3, 1], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [3, 3, 3], rot: [0, -Math.PI / 2, 0] },

        // Second Floor Corners
        { model: 'Corner_Exterior_Wood', pos: [-3, 3, 4], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Wood', pos: [3, 3, 4], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Wood', pos: [3, 3, -4], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Wood', pos: [-3, 3, -4], rot: [0, Math.PI / 2, 0] },

        // Roof at Y = 6 (6x8 tiles)
        { model: 'Roof_RoundTiles_6x8', pos: [0, 6, 0], rot: [0, 0, 0] },
        { model: 'Roof_Dormer_RoundTile', pos: [-1.5, 7.1, 2.5], rot: [0, 0, 0] },
        { model: 'Roof_Dormer_RoundTile', pos: [1.5, 7.1, 2.5], rot: [0, 0, 0] },
        { model: 'Prop_Chimney', pos: [2.2, 7.8, -2], rot: [0, 0, 0] },
        { model: 'Prop_Chimney', pos: [-2.2, 7.8, 2], rot: [0, 0, 0] },

        // Wagon parked outside tavern
        { model: 'Prop_Wagon', pos: [-4.2, 0, 2], rot: [0, 0.5, 0] }
      ]
    };
  }

  /**
   * 4. Grand Town Hall (6m x 10m, with Arch Portal & Watch Tower)
   */
  public static getTownHall(): BuildingBlueprint {
    return {
      name: 'TownHall',
      collisionBox: { width: 6.8, depth: 10.6 },
      parts: [
        // Ground Floor (Stone & Arches, Y = 0)
        // Front (Z = +5)
        { model: 'Wall_Arch', pos: [-2, 0, 5], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Door_Flat', pos: [0, 0, 5], rot: [0, 0, 0] },
        { model: 'Wall_Arch', pos: [2, 0, 5], rot: [0, 0, 0] },

        // Back (Z = -5)
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [-2, 0, -5], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [0, 0, -5], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Window_Wide_Flat', pos: [2, 0, -5], rot: [0, Math.PI, 0] },

        // Left (X = -3)
        { model: 'Wall_UnevenBrick_Straight', pos: [-3, 0, -4], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [-3, 0, -2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Arch', pos: [-3, 0, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [-3, 0, 2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [-3, 0, 4], rot: [0, Math.PI / 2, 0] },

        // Right (X = +3)
        { model: 'Wall_UnevenBrick_Straight', pos: [3, 0, -4], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [3, 0, -2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Arch', pos: [3, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [3, 0, 2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [3, 0, 4], rot: [0, -Math.PI / 2, 0] },

        // Corners
        { model: 'Corner_Exterior_Brick', pos: [-3, 0, 5], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Brick', pos: [3, 0, 5], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [3, 0, -5], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-3, 0, -5], rot: [0, Math.PI / 2, 0] },

        // Second Floor (Y = 3)
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-2, 3, 5], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [0, 3, 5], rot: [0, 0, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 3, 5], rot: [0, 0, 0] },

        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-2, 3, -5], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Straight', pos: [0, 3, -5], rot: [0, Math.PI, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [2, 3, -5], rot: [0, Math.PI, 0] },

        { model: 'Wall_Plaster_Straight', pos: [-3, 3, -4], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [-3, 3, -2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [-3, 3, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [-3, 3, 2], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [-3, 3, 4], rot: [0, Math.PI / 2, 0] },

        { model: 'Wall_Plaster_Straight', pos: [3, 3, -4], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [3, 3, -2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Wide_Flat', pos: [3, 3, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Window_Thin_Round', pos: [3, 3, 2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Wall_Plaster_Straight', pos: [3, 3, 4], rot: [0, -Math.PI / 2, 0] },

        // Second Floor Corners
        { model: 'Corner_Exterior_Wood', pos: [-3, 3, 5], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Wood', pos: [3, 3, 5], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Wood', pos: [3, 3, -5], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Wood', pos: [-3, 3, -5], rot: [0, Math.PI / 2, 0] },

        // Massive Roof at Y = 6 (6x10)
        { model: 'Roof_RoundTiles_6x10', pos: [0, 6, 0], rot: [0, 0, 0] },

        // Grand Bell/Watch Tower on Town Hall Roof
        { model: 'Roof_Tower_RoundTiles', pos: [0, 9.5, 0], rot: [0, 0, 0] },
        { model: 'Prop_Chimney2', pos: [-2.2, 8.5, -3.5], rot: [0, 0, 0] },
        { model: 'Prop_Chimney2', pos: [2.2, 8.5, -3.5], rot: [0, 0, 0] }
      ]
    };
  }

  /**
   * 5. Watchtower (Defensive outpost structure, 4m x 4m footprint, ~10m tall)
   */
  public static getWatchTower(): BuildingBlueprint {
    return {
      name: 'WatchTower',
      collisionBox: { width: 4.4, depth: 4.4 },
      parts: [
        // Level 1: Stone Brick Base
        { model: 'Wall_UnevenBrick_Door_Flat', pos: [0, 0, 2], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [0, 0, -2], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [-2, 0, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [2, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-2, 0, 2], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 0, 2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 0, -2], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-2, 0, -2], rot: [0, Math.PI / 2, 0] },

        // Level 2: Mid Section (Y = 3)
        { model: 'Wall_UnevenBrick_Straight', pos: [0, 3, 2], rot: [0, 0, 0] },
        { model: 'Wall_UnevenBrick_Straight', pos: [0, 3, -2], rot: [0, Math.PI, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [-2, 3, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Wall_UnevenBrick_Window_Thin_Round', pos: [2, 3, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-2, 3, 2], rot: [0, 0, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 3, 2], rot: [0, -Math.PI / 2, 0] },
        { model: 'Corner_Exterior_Brick', pos: [2, 3, -2], rot: [0, Math.PI, 0] },
        { model: 'Corner_Exterior_Brick', pos: [-2, 3, -2], rot: [0, Math.PI / 2, 0] },

        // Level 3: Outlook Deck with Balconies (Y = 6)
        { model: 'Balcony_Simple_Straight', pos: [0, 6, 2.1], rot: [0, 0, 0] },
        { model: 'Balcony_Simple_Straight', pos: [0, 6, -2.1], rot: [0, Math.PI, 0] },
        { model: 'Balcony_Simple_Straight', pos: [-2.1, 6, 0], rot: [0, Math.PI / 2, 0] },
        { model: 'Balcony_Simple_Straight', pos: [2.1, 6, 0], rot: [0, -Math.PI / 2, 0] },
        { model: 'Balcony_Simple_Corner', pos: [-2.1, 6, 2.1], rot: [0, 0, 0] },
        { model: 'Balcony_Simple_Corner', pos: [2.1, 6, 2.1], rot: [0, -Math.PI / 2, 0] },
        { model: 'Balcony_Simple_Corner', pos: [2.1, 6, -2.1], rot: [0, Math.PI, 0] },
        { model: 'Balcony_Simple_Corner', pos: [-2.1, 6, -2.1], rot: [0, Math.PI / 2, 0] },

        // Tower Conical Roof at Y = 7.5
        { model: 'Roof_Tower_RoundTiles', pos: [0, 7.5, 0], rot: [0, 0, 0] }
      ]
    };
  }

  /**
   * 6. Market Stall (Outdoor merchant stall with crates)
   */
  public static getMarketStall(): BuildingBlueprint {
    return {
      name: 'MarketStall',
      collisionBox: { width: 3.2, depth: 2.2 },
      parts: [
        { model: 'Wall_Arch', pos: [0, 0, 0], rot: [0, 0, 0] },
        { model: 'Floor_Brick', pos: [0, 0.05, 0], rot: [0, 0, 0] },
        { model: 'Roof_RoundTiles_4x4', pos: [0, 2.8, 0], rot: [0, 0, 0] },
        { model: 'Prop_Crate', pos: [-0.8, 0, 0.5], rot: [0, 0.2, 0] },
        { model: 'Prop_Crate', pos: [0.8, 0, 0.5], rot: [0, -0.3, 0] },
        { model: 'Prop_Crate', pos: [0.8, 0.8, 0.5], rot: [0, 0.1, 0] }
      ]
    };
  }

  /**
   * Build a THREE.Group from a blueprint using cloned models from AssetManager
   */
  public static instantiate(blueprint: BuildingBlueprint, assetMgr: AssetManager): THREE.Group {
    const group = new THREE.Group();
    group.name = blueprint.name;

    for (const part of blueprint.parts) {
      const clone = assetMgr.getClone(part.model);
      if (clone) {
        clone.position.set(part.pos[0], part.pos[1], part.pos[2]);
        if (part.rot) {
          clone.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
        }
        if (part.scale) {
          clone.scale.set(part.scale[0], part.scale[1], part.scale[2]);
        }
        group.add(clone);
      }
    }

    return group;
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetManager {
  private loader: GLTFLoader;
  private cache: Map<string, THREE.Group> = new Map();
  private basePath: string = '/assets/medieval/';

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load a single GLTF model from the medieval kit
   */
  public async loadModel(name: string): Promise<THREE.Group> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const filename = name.endsWith('.gltf') ? name : `${name}.gltf`;
    const url = `${this.basePath}${filename}`;

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.name = name;

          // Enable shadow casting and receiving for all meshes
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Ensure textures look crisp and proper color space
              if (mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                  const stdMat = mat as THREE.MeshStandardMaterial;
                  if (stdMat.roughness !== undefined) {
                    stdMat.roughness = Math.max(stdMat.roughness || 0.6, 0.4);
                    stdMat.needsUpdate = true;
                  }
                });
              }
            }
          });

          this.cache.set(name, model);
          resolve(model);
        },
        undefined,
        (err) => {
          console.error(`Failed to load asset: ${name}`, err);
          reject(err);
        }
      );
    });
  }

  /**
   * Preload a list of models with a progress callback
   */
  public async preloadList(
    names: string[],
    onProgress?: (loaded: number, total: number, currentName: string) => void
  ): Promise<void> {
    const total = names.length;
    let loaded = 0;

    const promises = names.map(async (name) => {
      try {
        await this.loadModel(name);
      } catch (e) {
        console.warn(`Could not preload ${name}, skipping...`);
      }
      loaded++;
      if (onProgress) {
        onProgress(loaded, total, name);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Return a cloned instance of the cached model
   */
  public getClone(name: string): THREE.Group | null {
    const base = this.cache.get(name);
    if (!base) {
      console.warn(`Asset "${name}" not found in cache. Did you preload it?`);
      return null;
    }
    const cloned = base.clone(true);
    // Ensure all cloned meshes also cast/receive shadow
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }

  public has(name: string): boolean {
    return this.cache.has(name);
  }
}

import * as THREE from "three";
import type {
  GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { npcModelUrl, type NpcModelDefinition } from "./npc-models";

export interface NpcActorContext {
  loader: GLTFLoader;
  mobile: boolean;
  onStatus: (id: string, loaded: boolean) => void;
}

/** 每次独立加载的模型独占资源；先从父组移除，再交还场景总清理。 */
function releaseModels(roots: readonly THREE.Object3D[]): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  const bitmaps = new Set<ImageBitmap>();
  for (const root of roots) {
    root.removeFromParent();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of list) {
        materials.add(material);
        for (const key of Reflect.ownKeys(material)) {
          const value: unknown = Reflect.get(material, key);
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
  }
  for (const texture of textures) {
    const source: unknown = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)
      bitmaps.add(source);
    texture.dispose();
  }
  bitmaps.forEach((bitmap) => bitmap.close());
  skeletons.forEach((skeleton) => skeleton.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  roots.forEach((root) => root.clear());
}

function sceneRoots(gltf: GLTF): THREE.Object3D[] {
  return [...new Set<THREE.Object3D>([gltf.scene, ...gltf.scenes])];
}

/** 不改源root矩阵、UV、材质或骨骼，只用额外父组归一。加载失败保持空组。 */
export function createNpcActor(
  definition: NpcModelDefinition,
  context: NpcActorContext,
) {
  const group = new THREE.Group();
  group.name = `NpcActor:${definition.id}`;
  group.rotation.y = definition.yaw;
  group.userData.npcId = definition.id;
  group.userData.location = definition.location;
  let disposed = false;
  let settled = false;
  let roots: THREE.Object3D[] = [];
  let mixer: THREE.AnimationMixer | null = null;
  let animationRoot: THREE.Object3D | null = null;

  const release = () => {
    mixer?.stopAllAction();
    if (animationRoot) mixer?.uncacheRoot(animationRoot);
    mixer = null;
    animationRoot = null;
    releaseModels(roots);
    roots = [];
    group.clear();
  };
  const failed = () => {
    if (disposed || settled) return;
    settled = true;
    context.onStatus(definition.id, false);
  };

  try {
    context.loader.load(
      npcModelUrl(definition, context.mobile),
      (gltf) => {
        const incoming = sceneRoots(gltf);
        if (disposed || settled) {
          releaseModels(incoming);
          return;
        }
        roots = incoming;
        try {
          const model = gltf.scene;
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model, true);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          if (
            bounds.isEmpty() ||
            !Number.isFinite(size.y) ||
            size.y <= 0 ||
            !Number.isFinite(center.x) ||
            !Number.isFinite(center.z) ||
            !Number.isFinite(bounds.min.y) ||
            !Number.isFinite(definition.height) ||
            definition.height <= 0
          )
            throw new Error("NPC模型包围盒或目标高度无效");
          const actualModel = new THREE.Group();
          actualModel.name = `NpcModel:${definition.id}`;
          actualModel.userData.npcId = definition.id;
          actualModel.userData.location = definition.location;
          const scale = definition.height / size.y;
          actualModel.scale.setScalar(scale);
          actualModel.position.set(
            -center.x * scale,
            -bounds.min.y * scale,
            -center.z * scale,
          );
          actualModel.add(model);
          model.userData.npcId = definition.id;
          model.userData.location = definition.location;
          model.traverse((object) => {
            if (object instanceof THREE.Mesh)
              object.castShadow = object.receiveShadow = true;
          });
          const idle = gltf.animations.find((clip) =>
            /(?:^|[|:_\s.-])idle(?:$|[|:_\s.-])/i.test(clip.name),
          );
          if (idle) {
            animationRoot = model;
            mixer = new THREE.AnimationMixer(model);
            mixer.clipAction(idle).play();
          }
          group.add(actualModel);
          // 源root可能关闭matrixAutoUpdate；重新挂父组后立即刷新世界矩阵。
          group.updateMatrixWorld(true);
        } catch {
          release();
          failed();
          return;
        }
        settled = true;
        context.onStatus(definition.id, true);
      },
      undefined,
      failed,
    );
  } catch {
    failed();
  }

  return {
    group,
    update(delta: number, reducedMotion: boolean) {
      if (disposed || !mixer) return;
      mixer.timeScale = reducedMotion ? 0 : 1;
      mixer.update(delta);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      release();
    },
  };
}

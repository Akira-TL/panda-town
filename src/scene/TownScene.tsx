"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LOCATIONS, type LocationId } from "../game/content";
import { LOCATION_POSITIONS, ribbonGeometry, routeCurve } from "./geometry";
import { buildLandscape, groundHeight } from "./landscape";
import { createRendering, createSkyTexture } from "./rendering";
import { createTownCameraRig } from "./camera-rig";
import type { FramingLandmark } from "./camera-framing";
import { createLandmarkPlacement } from "./landmark-placement";
import { createGroundSurfaces } from "./ground-surfaces";
import { createOutdoors } from "./outdoors";
import { createOutdoorResidents } from "./outdoor-residents";
import { createCafeState } from "./cafe-state";
import { createCafeWelcome } from "./cafe-welcome";
import { createResidents } from "./residents";
import { NPC_MODELS } from "./npc-models";
import type { NpcActorContext } from "./npc-actor";
import {
  createInventoryProps,
  type SceneInventoryState,
} from "./inventory-props";
import {
  buildLandmark,
  type SurfaceName,
  type SurfaceTextures,
} from "./architecture";

export interface AssetStatus {
  loaded: string[];
  missing: string[];
}
export interface TownSceneProps extends SceneInventoryState {
  playerLocation: LocationId;
  cameraMode: "follow" | "overview";
  decisionOpen?: boolean;
  cameraResetKey?: number;
  stallOwned: boolean;
  /** 兼容旧版属性；正常营业和当前跟随取景不依赖此标志。 */
  cafeOpened: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
  onAssetStatus?: (status: AssetStatus) => void;
}
function disposeObject(root: THREE.Object3D, disposeTextures = true): void {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
    geometries.add(node.geometry);
    const list: THREE.Material[] = Array.isArray(node.material)
      ? node.material
      : [node.material];
    list.forEach((material) => {
      materials.add(material);
      if (material instanceof THREE.MeshStandardMaterial)
        [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.emissiveMap,
          material.aoMap,
        ].forEach((texture) => {
          if (texture) textures.add(texture);
        });
    });
  });
  if (disposeTextures) textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
const material = (color: THREE.ColorRepresentation, map?: THREE.Texture) =>
  new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: 0.88 });
function mesh(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  x: number,
  y: number,
  z: number,
  map?: THREE.Texture,
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material(color, map));
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}
function pandaPreview(): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.SphereGeometry(0.55, 16, 12), "#faf6df", 0, 0.9, 0));
  group.add(
    mesh(new THREE.SphereGeometry(0.48, 16, 12), "#fff9eb", 0, 1.65, 0),
  );
  for (const sign of [-1, 1]) {
    group.add(
      mesh(new THREE.SphereGeometry(0.19, 12, 8), "#292c29", sign * 0.35, 2, 0),
    );
    group.add(
      mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        "#292c29",
        sign * 0.35,
        0.25,
        0,
      ),
    );
    group.add(
      mesh(new THREE.SphereGeometry(0.2, 12, 8), "#292c29", sign * 0.5, 1, 0),
    );
    const eye = mesh(
      new THREE.SphereGeometry(0.14, 12, 8),
      "#292c29",
      sign * 0.2,
      1.7,
      0.4,
    );
    eye.scale.set(0.8, 1.1, 0.5);
    group.add(eye);
  }
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.2), "#65734c", 0, 1, -0.5));
  return group;
}
export default function TownScene(props: TownSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      latest.current.onError?.(
        "当前设备无法建立三维画面，请使用支持 WebGL 的浏览器重试。",
      );
      return;
    }
    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    const sky = createSkyTexture();
    scene.background = sky;
    scene.fog = new THREE.Fog("#bdd3dd", 75, 170);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 180);
    camera.position.set(-14, 9, 21);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minDistance = 10;
    controls.maxDistance = 72;
    scene.add(new THREE.HemisphereLight("#dceafa", "#7b8252", 1.8));
    const sun = new THREE.DirectionalLight("#ffe0a8", 3.4);
    sun.position.set(-28, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      near: 1,
      far: 110,
    });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#c4dbe7", 0.65);
    fill.position.set(24, 18, -12);
    scene.add(fill);
    const landscape = buildLandscape();
    scene.add(landscape.group);
    for (const location of LOCATIONS)
      for (const next of location.next) {
        const road = new THREE.Mesh(
          ribbonGeometry(
            routeCurve(location.id, next),
            2.4,
            48,
            location.id !== "bridge" && next !== "bridge",
          ),
          new THREE.MeshStandardMaterial({
            color: "#d5c29d",
            roughness: 1,
            side: THREE.DoubleSide,
          }),
        );
        road.receiveShadow = true;
        road.name = "Road";
        scene.add(road);
      }
    const assetStatus: AssetStatus = { loaded: [], missing: [] };
    const publishAssetStatus = () => {
      container.dataset.loadedModels = assetStatus.loaded.join(" ");
      if (!disposed)
        latest.current.onAssetStatus?.({
          loaded: [...assetStatus.loaded],
          missing: [...assetStatus.missing],
        });
    };
    const textureLoader = new THREE.TextureLoader();
    function surface(name: SurfaceName): THREE.Texture {
      const texture = textureLoader.load(
        `/art/texture-${name}.webp`,
        () => {
          if (disposed) {
            texture.dispose();
            return;
          }
          assetStatus.loaded.push(`texture-${name}`);
          publishAssetStatus();
        },
        undefined,
        () => {
          if (!disposed) {
            assetStatus.missing.push(`texture-${name}`);
            publishAssetStatus();
          }
        },
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(
        4,
        renderer.capabilities.getMaxAnisotropy(),
      );
      texture.repeat.setScalar(name === "plaster" ? 2 : 1);
      return texture;
    }
    const surfaces: SurfaceTextures = {
      wood: surface("wood"),
      plaster: surface("plaster"),
      roof: surface("roof"),
      canvas: surface("canvas"),
    };
    const groundSurfaces = createGroundSurfaces(
      textureLoader,
      renderer.capabilities.getMaxAnisotropy(),
      (name, loaded) => {
        (loaded ? assetStatus.loaded : assetStatus.missing).push(
          `material-${name}`,
        );
        publishAssetStatus();
      },
    );
    groundSurfaces.applyGroup(scene);
    const loader = new GLTFLoader();
    const inventory = createInventoryProps(surfaces);
    inventory.update(latest.current);
    scene.add(inventory.workshop, inventory.opponentStall);
    const cafeEntrance = createCafeState(surfaces);
    // 茶馆始终营业，与旧版展示镜头的cafeOpened标志分开。
    cafeEntrance.update(true, 0, true);
    const cafeAnchor = new THREE.Group();
    const cafeBounds = new THREE.Box3();
    const npcContext: NpcActorContext = {
      loader,
      mobile: window.innerWidth < 720,
      onStatus(id, loaded) {
        if (disposed) return;
        const key = `npc-${id}`;
        const list = loaded ? assetStatus.loaded : assetStatus.missing;
        if (!list.includes(key)) list.push(key);
        const visible = NPC_MODELS.filter((model) =>
          assetStatus.loaded.includes(`npc-${model.id}`),
        );
        container.dataset.loadedNpcModels = visible
          .map((model) => model.id)
          .join(" ");
        container.dataset.npcModelCount = String(visible.length);
        container.dataset.missingNpcModels = NPC_MODELS.filter((model) =>
          assetStatus.missing.includes(`npc-${model.id}`),
        )
          .map((model) => model.id)
          .join(" ");
        publishAssetStatus();
      },
    };
    const residents = createResidents(npcContext, groundHeight);
    const outdoorResidents = createOutdoorResidents(npcContext, groundHeight);
    const cafeWelcome = createCafeWelcome(npcContext);
    scene.add(residents.group, outdoorResidents.group);
    cafeAnchor.add(cafeWelcome.group);
    container.dataset.npcModelCount = "0";
    container.dataset.expectedNpcModels = String(NPC_MODELS.length);
    container.dataset.residentCount = String(residents.group.children.length);
    container.dataset.outdoorResidentCount = String(
      outdoorResidents.group.children.length,
    );
    container.dataset.outdoorResidentLocations =
      outdoorResidents.locations.join(" ");
    let characterMixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkAction: THREE.AnimationAction | null = null;
    let wasWalking = false;
    const infillSlots: Array<{
      kind: string;
      anchor: THREE.Group;
      placeholder: THREE.Group;
    }> = [];
    function loadModel(
      name: string,
      parent: THREE.Group,
      placeholder: THREE.Group,
      targetHeight: number,
      onNormalized?: (bounds: THREE.Box3) => void,
    ): void {
      const modelVariant = window.innerWidth < 720 ? "-mobile" : "";
      const modelMotion = name === "panda" ? "-rigged" : "";
      const modelUrl = `/models/${name}${modelVariant}${modelMotion}-v2.glb`;
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.y) || size.y <= 0) {
            disposeObject(gltf.scene);
            assetStatus.missing.push(name);
            latest.current.onAssetStatus?.({
              loaded: [...assetStatus.loaded],
              missing: [...assetStatus.missing],
            });
            return;
          }
          const scale = targetHeight / size.y;
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale,
          );
          gltf.scene.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          onNormalized?.(new THREE.Box3().setFromObject(gltf.scene));
          parent.remove(placeholder);
          // 基础纹理由整镇共享，替换单体模型时保留其余建筑仍在使用的纹理。
          disposeObject(placeholder, false);
          parent.add(gltf.scene);
          if (name === "market") inventory.setMarketModel(gltf.scene);
          for (const slot of infillSlots.filter((item) => item.kind === name)) {
            slot.anchor.remove(slot.placeholder);
            disposeObject(slot.placeholder, false);
            slot.anchor.add(gltf.scene.clone(true));
          }
          if (name === "panda") {
            characterMixer = new THREE.AnimationMixer(gltf.scene);
            const idle = gltf.animations.find((clip) =>
              /idle/i.test(clip.name),
            );
            const walk = gltf.animations.find((clip) =>
              /walk/i.test(clip.name),
            );
            idleAction = idle ? characterMixer.clipAction(idle) : null;
            walkAction = walk ? characterMixer.clipAction(walk) : null;
            // 文件可能在角色已开始移动后才就绪，按当前移动状态启动动作。
            (wasWalking ? walkAction : idleAction)?.play();
            if (container)
              container.dataset.characterAnimations = gltf.animations
                .map((clip) => clip.name)
                .join(" ");
          }
          assetStatus.loaded.push(name);
          publishAssetStatus();
          latest.current.onAssetStatus?.({
            loaded: [...assetStatus.loaded],
            missing: [...assetStatus.missing],
          });
        },
        undefined,
        () => {
          if (!disposed) {
            assetStatus.missing.push(name);
            latest.current.onAssetStatus?.({
              loaded: [...assetStatus.loaded],
              missing: [...assetStatus.missing],
            });
          }
        },
      );
    }
    const buildingIds = [
      "bakery",
      "grocery",
      "market",
      "research",
      "bank",
      "gifts",
      "rival",
      "cafe",
    ] as const satisfies readonly LocationId[];
    const landmarkHeights: Record<(typeof buildingIds)[number], number> = {
      bakery: 4.4,
      grocery: 4.6,
      market: 2.9,
      research: 6.2,
      bank: 5.2,
      gifts: 4.4,
      rival: 4.8,
      cafe: 4.4,
    };
    const cameraObstacles: THREE.Object3D[] = [];
    const framingLandmarks: FramingLandmark[] = [];
    const outdoors = createOutdoors(surfaces, groundHeight);
    scene.add(outdoors.group);
    cameraObstacles.push(...outdoors.obstacles);
    outdoors.obstacles.forEach((object, index) =>
      framingLandmarks.push({
        id: `outdoor:${outdoors.locations[index]!}`,
        object,
      }),
    );
    container.dataset.outdoorLocations = outdoors.locations.join(" ");
    buildingIds.forEach((id, index) => {
      const anchor = id === "cafe" ? cafeAnchor : new THREE.Group();
      const preview = buildLandmark(id, index, surfaces);
      const placement = createLandmarkPlacement(
        anchor,
        id,
        new THREE.Box3().setFromObject(preview),
      );
      if (id === "cafe") {
        cafeBounds.setFromObject(preview);
        cafeWelcome.fit(cafeBounds);
        cafeEntrance.setEntrance(cafeBounds);
        anchor.add(cafeEntrance.group);
      }
      scene.add(placement.group);
      anchor.add(preview);
      scene.add(anchor);
      cameraObstacles.push(anchor);
      framingLandmarks.push({ id, object: anchor });
      groundSurfaces.applyGroup(placement.group);
      loadModel(id, anchor, preview, landmarkHeights[id], (bounds) => {
        placement.fit(bounds);
        groundSurfaces.applyGroup(placement.group);
        if (id === "cafe") {
          cafeBounds.copy(bounds);
          cafeEntrance.setEntrance(bounds);
          cafeWelcome?.fit(bounds);
        }
      });
    });
    const infill: ReadonlyArray<readonly [number, number, number]> = [
      [-10, -5, 0.5],
      [-5, -8, -0.4],
      [-4, -1, 0.3],
      [-10, 2, 0.7],
      [-3, 8, 0.1],
      [0, -9, -0.2],
      [-1, -21, 0.4],
      [-22, 9, 0.9],
      [21, 14, -1.2],
      [-19, -18, 0.7],
      [-7, -21, 0.2],
      [19, -10, -0.8],
      [19, 5, -1.3],
      [-24, -1, 1.1],
    ];
    infill.forEach(([x, z, rotation], index) => {
      const kind = index % 2 ? "grocery" : "gifts";
      const placeholder = buildLandmark(kind, index, surfaces);
      const house = new THREE.Group();
      house.add(placeholder);
      const scale = 0.7 + (index % 3) * 0.1;
      house.scale.setScalar(scale);
      house.position.set(x, groundHeight(x, z), z);
      house.rotation.y = rotation;
      scene.add(house);
      cameraObstacles.push(house);
      framingLandmarks.push({ id: `house:${index}`, object: house });
      infillSlots.push({ kind, anchor: house, placeholder });
    });
    loader.load(
      `/models/tree${window.innerWidth < 720 ? "-mobile" : ""}-v2.glb`,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        landscape.replaceTrees(gltf.scene);
        assetStatus.loaded.push("tree");
        publishAssetStatus();
      },
      undefined,
      () => {
        if (!disposed) {
          assetStatus.missing.push("tree");
          publishAssetStatus();
        }
      },
    );
    const player = new THREE.Group();
    const panda = pandaPreview();
    player.add(panda);
    player.add(inventory.carried);
    player.position.set(...LOCATION_POSITIONS[latest.current.playerLocation]);
    scene.add(player);
    loadModel("panda", player, panda, 2.1);
    const stallFlag = mesh(
      new THREE.BoxGeometry(0.65, 1.2, 0.12),
      "#e3bc60",
      -3,
      3.4,
      -16,
    );
    scene.add(stallFlag);
    const cafeGlow = new THREE.PointLight("#ffc964", 10, 12);
    cafeGlow.position.set(0, 2, 0.6);
    cafeEntrance.group.add(cafeGlow);
    const rendering = createRendering(renderer, scene, camera);
    const cameraRig = createTownCameraRig(
      camera,
      controls,
      container,
      framingLandmarks,
      cameraObstacles,
      groundHeight,
    );
    const treeFocus = new THREE.Vector3();
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      cameraRig.resize(width, height);
      rendering.resize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const lost = (event: Event) => {
      event.preventDefault();
      latest.current.onError?.("三维画面已中断，请重试加载。");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    let location = latest.current.playerLocation;
    let curve: THREE.CatmullRomCurve3 | null = null;
    let progress = 1;
    let lastTime = performance.now();
    const animate = (time: number) => {
      if (disposed) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const current = latest.current;
      const visibleInventory = inventory.update(current);
      residents?.update(delta, current);
      outdoorResidents?.update(delta, current);
      cafeEntrance.update(true, delta, current.reducedMotion);
      cafeWelcome?.update(true, delta, current.reducedMotion);
      container.dataset.cafeOpening = cafeEntrance.getOpening().toFixed(3);
      container.dataset.cafeWelcome = String(
        cafeWelcome?.group.visible ?? false,
      );
      const sceneItems = visibleInventory.items.join(" ");
      if (container.dataset.sceneItems !== sceneItems)
        container.dataset.sceneItems = sceneItems;
      const toolState = visibleInventory.tool;
      if (container.dataset.toolState !== toolState)
        container.dataset.toolState = toolState;
      container.dataset.opponentStall = String(visibleInventory.opponent);
      landscape.update(time, current.reducedMotion);
      if (location !== current.playerLocation) {
        curve = routeCurve(location, current.playerLocation);
        location = current.playerLocation;
        progress = 0;
      }
      progress = current.reducedMotion
        ? 1
        : Math.min(1, progress + delta * 1.8);
      const walking = progress < 1 && !current.reducedMotion;
      container.dataset.characterState = walking ? "Walk" : "Idle";
      if (walking !== wasWalking) {
        const next = walking ? walkAction : idleAction;
        const previous = walking ? idleAction : walkAction;
        previous?.fadeOut(0.15);
        next?.reset().fadeIn(0.15).play();
        wasWalking = walking;
      }
      if (characterMixer) {
        characterMixer.timeScale = current.reducedMotion ? 0 : 1;
        characterMixer.update(delta);
      }
      if (curve) {
        player.position.copy(curve.getPoint(progress));
        const tangent = curve.getTangent(progress);
        player.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
      stallFlag.visible = current.stallOwned;
      cameraRig.update(
        player,
        current,
        time,
        delta,
        assetStatus.loaded.length,
        walking,
      );
      treeFocus.copy(player.position).y += 1.3;
      landscape.updateView(
        camera.position,
        current.cameraMode === "follow" ? treeFocus : controls.target,
        current.cameraMode === "follow",
      );
      rendering.render(delta);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    latest.current.onReady?.();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      cameraRig.dispose();
      controls.dispose();
      characterMixer?.stopAllAction();
      residents?.dispose();
      outdoorResidents?.dispose();
      cafeWelcome?.dispose();
      cafeEntrance.group.removeFromParent();
      cafeEntrance.dispose();
      scene.remove(outdoors.group);
      outdoors.dispose();
      rendering.dispose();
      disposeObject(scene);
      sky.dispose();
      groundSurfaces.dispose();
      Object.values(surfaces).forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={host}
      role="img"
      aria-label="熊猫小镇三维场景，可拖动旋转、双指或滚轮缩放；跟随按钮重置自动取景"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
      }}
    />
  );
}

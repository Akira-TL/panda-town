"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LOCATIONS, type LocationId } from "../game/content";
import { LOCATION_POSITIONS, ribbonGeometry, routeCurve } from "./geometry";
import { buildLandscape, groundHeight } from "./landscape";
import { createRendering } from "./rendering";
import {
  buildLandmark,
  type SurfaceName,
  type SurfaceTextures,
} from "./architecture";

export interface AssetStatus {
  loaded: string[];
  missing: string[];
}
export interface TownSceneProps {
  playerLocation: LocationId;
  cameraMode: "follow" | "overview";
  stallOwned: boolean;
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
    scene.background = new THREE.Color("#dce5dc");
    scene.fog = new THREE.Fog("#dce5dc", 65, 145);
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
    scene.add(new THREE.HemisphereLight("#e7efe8", "#606e49", 1.5));
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
        `/art/texture-${name}.png`,
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
    const loader = new GLTFLoader();
    function loadModel(
      name: string,
      parent: THREE.Group,
      placeholder: THREE.Group,
      targetHeight: number,
    ): void {
      loader.load(
        `/models/${name}${name === "panda" && window.innerWidth < 720 ? "-mobile" : ""}.glb`,
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
          parent.remove(placeholder);
          // 基础纹理由整镇共享，替换单体模型时保留其余建筑仍在使用的纹理。
          disposeObject(placeholder, false);
          parent.add(gltf.scene);
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
    const buildingIds: LocationId[] = [
      "bakery",
      "grocery",
      "market",
      "research",
      "bank",
      "gifts",
      "rival",
      "cafe",
    ];
    buildingIds.forEach((id, index) => {
      const anchor = new THREE.Group();
      const [x, y, z] = LOCATION_POSITIONS[id];
      const radial = new THREE.Vector3(x, 0, z).normalize();
      anchor.position.set(x + radial.x * 2.8, y - 0.05, z + radial.z * 2.8);
      anchor.rotation.y = Math.atan2(-radial.x, -radial.z);
      const foundation = mesh(
        new THREE.BoxGeometry(5.1, 0.28, 4.8),
        "#b3ab94",
        anchor.position.x,
        y - 0.21,
        anchor.position.z,
      );
      scene.add(foundation);
      const preview = buildLandmark(id, index, surfaces);
      anchor.add(preview);
      scene.add(anchor);
      loadModel(id, anchor, preview, 4.4 + (index % 3) * 0.5);
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
      const house = buildLandmark(
        index % 2 ? "grocery" : "gifts",
        index,
        surfaces,
      );
      const scale = 0.7 + (index % 3) * 0.1;
      house.scale.setScalar(scale);
      house.position.set(x, groundHeight(x, z), z);
      house.rotation.y = rotation;
      scene.add(house);
    });
    const player = new THREE.Group();
    const panda = pandaPreview();
    player.add(panda);
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
    const cafeGlow = new THREE.PointLight("#ffc964", 0, 12);
    cafeGlow.position.set(-6, 3, 16);
    scene.add(cafeGlow);
    const rendering = createRendering(renderer, scene, camera);
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
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
    let previousMode = latest.current.cameraMode;
    let curve: THREE.CatmullRomCurve3 | null = null;
    let progress = 1;
    let lastTime = performance.now();
    if (previousMode === "overview") {
      camera.position.set(33, 36, 42);
      controls.target.set(0, 0, -2);
    }
    const animate = (time: number) => {
      if (disposed) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const current = latest.current;
      landscape.update(time, current.reducedMotion);
      if (location !== current.playerLocation) {
        curve = routeCurve(location, current.playerLocation);
        location = current.playerLocation;
        progress = 0;
      }
      progress = current.reducedMotion
        ? 1
        : Math.min(1, progress + delta * 1.8);
      if (curve) {
        player.position.copy(curve.getPoint(progress));
        const tangent = curve.getTangent(progress);
        player.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
      stallFlag.visible = current.stallOwned;
      cafeGlow.intensity = current.cafeOpened ? 10 : 0;
      controls.enabled = current.cameraMode === "overview";
      controls.enableDamping = !current.reducedMotion;
      if (current.cameraMode !== previousMode) {
        if (current.cameraMode === "overview") {
          camera.position.set(33, 36, 42);
          controls.target.set(0, 1, -2);
        }
        previousMode = current.cameraMode;
      }
      if (current.cameraMode === "follow") {
        const focus = current.cafeOpened
          ? new THREE.Vector3(...LOCATION_POSITIONS.cafe)
          : player.position;
        const target = focus.clone().add(new THREE.Vector3(0, 1.3, 0));
        const desired = focus.clone().add(new THREE.Vector3(-5, 5, 7));
        camera.position.lerp(
          desired,
          current.reducedMotion ? 1 : 1 - Math.exp(-delta * 5),
        );
        controls.target.copy(target);
        camera.lookAt(target);
        landscape.updateView(camera.position, target);
      } else controls.update();
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
      controls.dispose();
      rendering.dispose();
      disposeObject(scene);
      Object.values(surfaces).forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={host}
      role="img"
      aria-label="熊猫小镇三维场景，可使用界面按钮完成所有游戏操作"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
      }}
    />
  );
}

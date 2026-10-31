import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SurfaceTextures } from "./architecture";

/** 依据cafe-opening.png增加可开合的门前栅和营业牌，不修改外部模型。 */
export function createCafeState(surfaces: SurfaceTextures) {
  const group = new THREE.Group();
  group.name = "CafeEntranceState";
  const wood = new THREE.MeshStandardMaterial({
    color: "#bd9c67",
    map: surfaces.wood,
    roughness: 0.9,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: "#617b5a",
    roughness: 0.88,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#c8a965",
    roughness: 0.6,
    metalness: 0.2,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#f3dfaa",
    emissive: "#ffd890",
    emissiveIntensity: 0.04,
    roughness: 0.7,
  });
  const geometries = new Set<THREE.BufferGeometry>();
  function box(
    parent: THREE.Group,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    material: THREE.Material = wood,
  ) {
    const geometry = new RoundedBoxGeometry(
      ...size,
      1,
      Math.min(0.025, Math.min(...size) * 0.15),
    );
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const gates: Array<{ pivot: THREE.Group; side: -1 | 1 }> = [];
  const lamps: THREE.PointLight[] = [];
  for (const side of [-1, 1] as const) {
    box(group, [0.13, 1.4, 0.13], [side * 1.18, 0.7, 0], trim);
    box(group, [0.2, 0.1, 0.2], [side * 1.18, 1.43, 0], brass);
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "CafeGateLeft" : "CafeGateRight";
    pivot.position.set(side * 1.09, 0.1, 0);
    for (let index = 0; index < 6; index++)
      box(pivot, [0.13, 0.9, 0.065], [-side * (0.08 + index * 0.18), 0.55, 0]);
    for (const y of [0.26, 0.85])
      box(pivot, [1.04, 0.1, 0.09], [-side * 0.55, y, -0.02], trim);
    const brace = box(pivot, [1.08, 0.07, 0.07], [-side * 0.55, 0.55, 0.03]);
    brace.rotation.z = side * 0.5;
    gates.push({ pivot, side });
    group.add(pivot);

    const lantern = new THREE.Group();
    lantern.position.set(side * 1.18, 1.65, 0);
    box(lantern, [0.18, 0.23, 0.18], [0, 0, 0], glass);
    box(lantern, [0.26, 0.055, 0.26], [0, 0.14, 0], brass);
    box(lantern, [0.25, 0.045, 0.25], [0, -0.14, 0], brass);
    for (const x of [-0.1, 0.1])
      box(lantern, [0.025, 0.27, 0.025], [x, 0, 0.11], trim);
    const light = new THREE.PointLight("#ffd394", 0, 4, 2);
    light.position.set(0, 0, 0.3);
    lantern.add(light);
    lamps.push(light);
    group.add(lantern);
  }

  const signPost = new THREE.Group();
  signPost.position.set(-1.68, 0, -0.12);
  box(signPost, [0.11, 2.04, 0.11], [0, 1.02, 0], trim);
  box(signPost, [1.29, 0.62, 0.1], [0, 1.8, 0], wood);
  const signGeometry = new THREE.PlaneGeometry(1.17, 0.51);
  geometries.add(signGeometry);
  const signMaterial = new THREE.MeshStandardMaterial({
    color: "#fbefd0",
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.name = "CafeBusinessSign";
  sign.position.set(0, 1.8, 0.061);
  signPost.add(sign);
  group.add(signPost);
  function label(opened: boolean): THREE.CanvasTexture | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 336;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = opened ? "#edf0d9" : "#f5e9cc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#3c5e46";
    context.font = 'bold 92px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(opened ? "咖啡馆开张" : "咖啡馆筹备中", 384, 140);
    context.fillStyle = "#8c754b";
    context.font = '42px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(opened ? "欢迎光临" : "期待与你见面", 384, 254);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const closedLabel = label(false);
  const openLabel = label(true);
  signMaterial.map = closedLabel;
  let wasOpened = false;
  let opening = 0;
  let disposed = false;
  return {
    group,
    getOpening() {
      return opening;
    },
    /** bounds为归一化模型、尚未挂anchor前的局部包围盒。 */
    setEntrance(bounds: THREE.Box3) {
      group.position.set(0, Math.max(0, bounds.min.y), bounds.max.z + 0.25);
    },
    update(opened: boolean, delta: number, reducedMotion: boolean) {
      if (disposed) return;
      if (opened !== wasOpened) {
        wasOpened = opened;
        signMaterial.map = opened ? openLabel : closedLabel;
        signMaterial.needsUpdate = true;
      }
      const target = opened ? 1 : 0;
      opening = reducedMotion
        ? target
        : THREE.MathUtils.damp(opening, target, 6, Math.min(delta, 0.1));
      for (const gate of gates)
        gate.pivot.rotation.y = gate.side * opening * Math.PI * 0.55;
      glass.emissiveIntensity = 0.04 + opening * 0.9;
      for (const lamp of lamps) lamp.intensity = opening * 2;
      group.userData.opened = opened;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      [wood, trim, brass, glass, signMaterial].forEach((material) =>
        material.dispose(),
      );
      closedLabel?.dispose();
      openLabel?.dispose();
      group.clear();
    },
  };
}

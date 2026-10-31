import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LOCATIONS, type LocationId } from "../game/content";
import type { SurfaceName, SurfaceTextures } from "./architecture";
import { LOCATION_POSITIONS } from "./geometry";

export const OUTDOOR_LOCATIONS = [
  "notice",
  "repair",
  "garden",
  "music",
  "dock",
  "riverside",
  "square",
] as const satisfies readonly LocationId[];
export type OutdoorLocationId = (typeof OUTDOOR_LOCATIONS)[number];
type Position = readonly [number, number, number];

export interface OutdoorScene {
  group: THREE.Group;
  locations: readonly OutdoorLocationId[];
  obstacles: readonly THREE.Group[];
  /** 仅清理本模块拥有的几何、材质和文字贴图；保留共享的生成纹理。 */
  dispose: () => void;
}

/** 参考outdoor-reference.png；不计算事件、修改道路或增加全局光照。 */
export function createOutdoors(
  surfaces: SurfaceTextures,
  heightAt?: (x: number, z: number) => number,
): OutdoorScene {
  const root = new THREE.Group();
  root.name = "outdoor-places";
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const geometries = new Set<THREE.BufferGeometry>();
  const labelTextures = new Set<THREE.Texture>();
  const labelMaterials = new Set<THREE.SpriteMaterial>();
  const obstacles: THREE.Group[] = [];

  function material(color: string, surface?: SurfaceName) {
    const key = `${color}:${surface ?? "plain"}`;
    const previous = materials.get(key);
    if (previous) return previous;
    const result = new THREE.MeshStandardMaterial({
      color,
      map: surface ? surfaces[surface] : null,
      roughness: 0.9,
    });
    materials.set(key, result);
    return result;
  }
  function part(
    group: THREE.Group,
    geometry: THREE.BufferGeometry,
    color: string,
    position: Position,
    surface?: SurfaceName,
    rotation: Position = [0, 0, 0],
  ) {
    const mesh = new THREE.Mesh(geometry, material(color, surface));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function box(
    group: THREE.Group,
    size: Position,
    position: Position,
    color = "#c5aa7f",
    surface?: SurfaceName,
    rotation?: Position,
  ) {
    const geometry =
      surface === "wood"
        ? new RoundedBoxGeometry(
            ...size,
            1,
            Math.min(0.03, Math.min(...size) * 0.16),
          )
        : new THREE.BoxGeometry(...size);
    return part(group, geometry, color, position, surface, rotation);
  }
  function post(
    group: THREE.Group,
    position: Position,
    height: number,
    radius = 0.075,
  ) {
    part(
      group,
      new THREE.CylinderGeometry(radius, radius * 1.14, height, 8),
      "#bea276",
      position,
      "wood",
    );
  }
  function flowerpot(group: THREE.Group, x: number, z: number, size = 1) {
    part(
      group,
      new THREE.CylinderGeometry(0.28 * size, 0.2 * size, 0.34 * size, 10),
      "#b77b53",
      [x, 0.17 * size, z],
    );
    part(
      group,
      new THREE.CylinderGeometry(0.25 * size, 0.25 * size, 0.045, 10),
      "#66533e",
      [x, 0.35 * size, z],
    );
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.39996;
      const px = x + Math.cos(angle) * 0.17 * size;
      const pz = z + Math.sin(angle) * 0.17 * size;
      const y = (0.49 + (i % 3) * 0.08) * size;
      part(group, new THREE.IcosahedronGeometry(0.16 * size, 0), "#78935c", [
        px,
        y - 0.1,
        pz,
      ]);
      blossom(group, px, y, pz, i, size);
    }
  }
  function blossom(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    index: number,
    scale = 1,
  ) {
    const colors = ["#f1dfae", "#d6a0b0", "#eee8d4"] as const;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      part(
        group,
        new THREE.IcosahedronGeometry(0.055 * scale, 0),
        colors[index % 3]!,
        [
          x + Math.cos(angle) * 0.055 * scale,
          y,
          z + Math.sin(angle) * 0.055 * scale,
        ],
      );
    }
    part(group, new THREE.IcosahedronGeometry(0.035 * scale, 0), "#cba858", [
      x,
      y + 0.02,
      z,
    ]);
  }
  function bench(group: THREE.Group, z = 0) {
    for (const x of [-0.86, 0.86]) {
      for (const dz of [-0.25, 0.25])
        box(group, [0.11, 0.56, 0.11], [x, 0.28, z + dz], "#798170");
      box(group, [0.1, 0.72, 0.1], [x, 0.83, z - 0.27], "#798170");
      box(group, [0.09, 0.08, 0.65], [x, 0.88, z], "#b99b70", "wood");
    }
    for (let i = 0; i < 4; i++)
      box(
        group,
        [2.05, 0.085, 0.13],
        [0, 0.59, z - 0.225 + i * 0.15],
        "#d5bb89",
        "wood",
      );
    for (let i = 0; i < 3; i++)
      box(
        group,
        [2.05, 0.13, 0.08],
        [0, 0.84 + i * 0.17, z - 0.31],
        "#d5bb89",
        "wood",
      );
  }
  function curvedBeam(
    group: THREE.Group,
    points: readonly Position[],
    radius: number,
    color: string,
    segments = 24,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    part(
      group,
      new THREE.TubeGeometry(curve, segments, radius, 6, false),
      color,
      [0, 0, 0],
      "wood",
    );
  }
  function notice(group: THREE.Group) {
    for (const x of [-0.91, 0.91]) post(group, [x, 1.06, -0.32], 2.12, 0.095);
    box(group, [2.05, 1.2, 0.12], [0, 1.48, -0.32], "#ae9168", "wood");
    box(group, [1.78, 0.97, 0.05], [0, 1.48, -0.23], "#e0cf9e", "canvas");
    for (let i = 0; i < 3; i++) {
      box(
        group,
        [0.43, 0.58, 0.018],
        [-0.58 + i * 0.58, 1.48, -0.19],
        "#f7eacf",
      );
      part(group, new THREE.SphereGeometry(0.037, 6, 4), "#b59c5d", [
        -0.58 + i * 0.58,
        1.7,
        -0.16,
      ]);
      for (let line = 0; line < 3; line++)
        box(
          group,
          [0.25 - line * 0.025, 0.018, 0.012],
          [-0.58 + i * 0.58, 1.55 - line * 0.09, -0.17],
          "#aa9a77",
        );
    }
    for (const side of [-1, 1])
      box(
        group,
        [1.2, 0.1, 0.65],
        [side * 0.53, 2.2, -0.32],
        "#7d8b65",
        "wood",
        [0, 0, -side * 0.22],
      );
    flowerpot(group, 1.03, 0.18, 0.65);
  }
  function repair(group: THREE.Group) {
    for (const x of [-0.95, 0.95]) {
      for (const z of [-0.36, 0.36])
        box(group, [0.14, 1.0, 0.14], [x, 0.5, z], "#a88963", "wood");
      post(group, [x, 1.25, -0.52], 2.5);
    }
    box(group, [2.3, 0.15, 1.05], [0, 1.06, 0], "#d2b783", "wood");
    box(group, [2.1, 0.1, 0.64], [0, 0.32, 0], "#b59a70", "wood");
    box(group, [1.85, 0.62, 0.08], [0, 1.76, -0.51], "#c2ad83", "wood");
    for (let i = 0; i < 3; i++) {
      const x = -0.6 + i * 0.6;
      post(group, [x, 1.77, -0.42], 0.36, 0.025);
      box(group, [0.26, 0.085, 0.09], [x, 1.94, -0.41], "#768077");
    }
    box(group, [0.35, 0.22, 0.28], [-0.7, 1.24, 0.24], "#758179");
    box(group, [0.08, 0.33, 0.33], [-0.88, 1.27, 0.24], "#596d63");
    post(group, [-0.7, 1.15, 0.45], 0.48, 0.025);
    box(
      group,
      [0.4, 0.07, 0.075],
      [0.42, 1.17, 0.16],
      "#ac8e64",
      "wood",
      [0, 0.3, 0],
    );
    box(
      group,
      [0.12, 0.11, 0.28],
      [0.57, 1.22, 0.11],
      "#7f8980",
      undefined,
      [0, 0.3, 0],
    );
    for (let i = 0; i < 6; i++)
      box(
        group,
        [0.41, 0.045, 1.5],
        [-1.03 + i * 0.41, 2.53, 0.05],
        i % 2 ? "#a8b588" : "#efe2bf",
        "canvas",
        [-0.1, 0, 0],
      );
  }
  function garden(group: THREE.Group) {
    bench(group, 0.1);
    for (const side of [-1, 1]) {
      post(group, [side * 1.35, 1.1, -0.5], 2.2);
      flowerpot(group, side * 1.34, 0.32, 1.12);
      for (let i = 0; i < 5; i++) {
        const y = 0.55 + i * 0.33;
        const x = side * (1.34 + Math.sin(i * 1.4) * 0.1);
        part(group, new THREE.IcosahedronGeometry(0.18, 0), "#7d965c", [
          x,
          y,
          -0.49,
        ]);
        blossom(group, x, y + 0.08, -0.36, i);
      }
    }
    const points: Position[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI;
      points.push([Math.cos(angle) * 1.35, 2.2 + Math.sin(angle) * 0.48, -0.5]);
    }
    curvedBeam(group, points, 0.075, "#c5aa7c");
    for (let i = 0; i < 7; i++) {
      const angle = (i / 6) * Math.PI;
      const x = Math.cos(angle) * 1.35,
        y = 2.2 + Math.sin(angle) * 0.48;
      part(group, new THREE.IcosahedronGeometry(0.2, 0), "#7d965c", [
        x,
        y,
        -0.49,
      ]);
      blossom(group, x, y + 0.06, -0.34, i, 1.15);
    }
  }
  function music(group: THREE.Group) {
    part(
      group,
      new THREE.CylinderGeometry(1.35, 1.46, 0.2, 24),
      "#a58e68",
      [0, 0.1, 0],
      "wood",
    );
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.35;
      const length = Math.sqrt(1.3 ** 2 - x ** 2) * 2;
      box(group, [0.32, 0.055, length], [x, 0.22, 0], "#d0b887", "wood");
    }
    const body = new THREE.Shape();
    body.moveTo(0, -0.48);
    body.bezierCurveTo(-0.47, -0.48, -0.4, -0.05, -0.22, 0.04);
    body.bezierCurveTo(-0.42, 0.34, -0.18, 0.5, 0, 0.39);
    body.bezierCurveTo(0.18, 0.5, 0.42, 0.34, 0.22, 0.04);
    body.bezierCurveTo(0.4, -0.05, 0.47, -0.48, 0, -0.48);
    const cello = new THREE.ExtrudeGeometry(body, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 8,
    });
    part(group, cello, "#bd945e", [-0.55, 0.94, -0.33], "wood");
    box(group, [0.09, 0.74, 0.1], [-0.55, 1.61, -0.27], "#77634a", "wood");
    part(
      group,
      new THREE.SphereGeometry(0.075, 8, 6),
      "#9f7c50",
      [-0.55, 2.02, -0.27],
    );
    for (let i = 0; i < 4; i++)
      part(
        group,
        new THREE.CylinderGeometry(0.004, 0.004, 1.28, 4),
        "#e0cf9b",
        [-0.58 + i * 0.02, 1.27, -0.17],
      );
    box(group, [0.035, 0.5, 0.04], [-0.55, 0.37, -0.27], "#5c6d62");
    post(group, [0.35, 0.72, -0.18], 0.95, 0.025);
    box(
      group,
      [0.57, 0.4, 0.045],
      [0.35, 1.22, -0.18],
      "#687c69",
      undefined,
      [-0.2, 0, 0],
    );
    box(
      group,
      [0.45, 0.29, 0.016],
      [0.35, 1.23, -0.14],
      "#f4e7c8",
      undefined,
      [-0.2, 0, 0],
    );
    part(
      group,
      new THREE.CylinderGeometry(0.25, 0.24, 0.37, 12),
      "#c1a072",
      [0.78, 0.48, 0.48],
      "wood",
    );
    part(
      group,
      new THREE.CylinderGeometry(0.26, 0.26, 0.025, 12),
      "#eadcbd",
      [0.78, 0.68, 0.48],
      "canvas",
    );
    flowerpot(group, -1.3, 0.65, 0.85);
  }
  function crate(group: THREE.Group, position: Position, size: number) {
    const [x, y, z] = position;
    box(group, [size, size, size], position, "#c5a574", "wood");
    for (const side of [-1, 1]) {
      box(
        group,
        [0.07, size + 0.04, size + 0.04],
        [x + side * size * 0.35, y, z],
        "#8f805f",
        "wood",
      );
      box(
        group,
        [size + 0.04, 0.07, size + 0.04],
        [x, y + side * size * 0.35, z],
        "#8f805f",
        "wood",
      );
    }
  }
  function dock(group: THREE.Group) {
    for (let i = 0; i < 10; i++)
      box(
        group,
        [0.31, 0.13, 2.4],
        [-1.44 + i * 0.32, 0.22, 0],
        "#c7ac7b",
        "wood",
      );
    // 由临水平台接回岸上的停靠点，通道中央不摆箱子或系缆柱。
    for (let i = 0; i < 6; i++)
      box(
        group,
        [0.86, 0.11, 0.17],
        [0, 0.19, 1.27 + i * 0.18],
        "#ccb284",
        "wood",
      );
    for (const x of [-1.5, 1.5])
      for (const z of [-1.05, 1.05]) {
        post(group, [x, 0.23, z], 1.05, 0.1);
        part(
          group,
          new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10),
          "#be9d5a",
          [x, 0.78, z],
        );
        for (let i = 0; i < 3; i++)
          part(
            group,
            new THREE.TorusGeometry(0.11, 0.025, 5, 12),
            "#cfbe91",
            [x, 0.43 + i * 0.055, z],
            undefined,
            [Math.PI / 2, 0, 0],
          );
      }
    crate(group, [-0.83, 0.6, -0.58], 0.62);
    crate(group, [-0.1, 0.51, -0.68], 0.44);
    const coil: Position[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 79) * Math.PI * 8;
      const radius = 0.11 + (i / 79) * 0.23;
      coil.push([
        0.75 + Math.cos(angle) * radius,
        0.32,
        0.4 + Math.sin(angle) * radius,
      ]);
    }
    curvedBeam(group, coil, 0.025, "#d2c298", 96);
    box(group, [0.48, 0.08, 0.12], [0.78, 0.44, -0.56], "#6d7b73");
    post(group, [0.78, 0.36, -0.56], 0.24, 0.085);
  }
  function riverside(group: THREE.Group) {
    for (const x of [-1.4, 0, 1.4]) {
      post(group, [x, 0.56, -0.55], 1.12, 0.09);
      part(group, new THREE.SphereGeometry(0.12, 8, 5), "#c7af76", [
        x,
        1.13,
        -0.55,
      ]);
    }
    for (const y of [0.43, 0.92])
      box(group, [2.95, 0.09, 0.09], [0, y, -0.55], "#c4a97c", "wood");
    post(group, [0.3, 0.64, 0.2], 1.28, 0.055);
    for (const x of [0.21, 0.39])
      part(
        group,
        new THREE.CylinderGeometry(0.1, 0.12, 0.4, 10),
        "#ba9d61",
        [x, 1.35, 0.17],
        undefined,
        [Math.PI / 2 - 0.25, 0, 0],
      );
    flowerpot(group, -1.35, 0.5, 1.05);
    flowerpot(group, 1.35, 0.5, 0.85);
  }
  function square(group: THREE.Group) {
    // 中央喷泉由现有scenery拥有，这里只做停靠点旁的迎宾角。
    bench(group, -0.35);
    post(group, [-1.23, 1.27, 0], 2.54, 0.09);
    for (const [y, angle] of [
      [1.7, -0.12],
      [2.1, 0.1],
    ] as const)
      box(group, [0.9, 0.22, 0.08], [-1.23, y, 0], "#d6c08e", "wood", [
        0,
        angle,
        0,
      ]);
    flowerpot(group, 1.35, 0.3, 1.15);
  }

  function mergePlace(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const meshMaterial = object.material;
      if (Array.isArray(meshMaterial))
        throw new Error("户外几何只使用单一共享材质");
      const copy = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      copy.applyMatrix4(object.matrixWorld);
      const list = batches.get(meshMaterial) ?? [];
      list.push(copy);
      batches.set(meshMaterial, list);
      object.geometry.dispose();
    });
    group.clear();
    for (const [meshMaterial, parts] of batches) {
      const merged = mergeGeometries(parts, false);
      parts.forEach((geometry) => geometry.dispose());
      if (!merged) throw new Error("户外几何合并失败");
      geometries.add(merged);
      const mesh = new THREE.Mesh(merged, meshMaterial);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  function label(id: OutdoorLocationId): THREE.Sprite | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#fbf1d8";
    context.beginPath();
    context.roundRect(6, 6, 500, 116, 22);
    context.fill();
    context.strokeStyle = "#bca064";
    context.lineWidth = 5;
    context.stroke();
    context.font = 'bold 43px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillStyle = "#3f583e";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      LOCATIONS.find((place) => place.id === id)?.name ?? id,
      256,
      65,
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelTextures.add(texture);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    labelMaterials.add(spriteMaterial);
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.name = `outdoor-label-${id}`;
    sprite.scale.set(3.3, 0.825, 1);
    return sprite;
  }
  const builders: Record<OutdoorLocationId, (group: THREE.Group) => void> = {
    notice,
    repair,
    garden,
    music,
    dock,
    riverside,
    square,
  };
  for (const id of OUTDOOR_LOCATIONS) {
    const group = new THREE.Group();
    group.name = `outdoor-${id}`;
    builders[id](group);
    const [x, y, z] = LOCATION_POSITIONS[id];
    const radial = new THREE.Vector3(x, 0, z).normalize();
    // 码头向西接岸水；公告台使用较小基座，给相邻支路留足宽度。
    const setback = id === "notice" ? 3.3 : 3.65;
    const px = id === "dock" ? x - 2.1 : x + radial.x * setback;
    const pz = id === "dock" ? z : z + radial.z * setback;
    const terrainY = heightAt?.(px, pz) ?? y - 0.15;
    const floorY = Math.max(terrainY, y - 0.12);
    const support = Math.max(0.15, floorY - terrainY + 0.08);
    if (id !== "dock")
      part(
        group,
        new THREE.CylinderGeometry(
          id === "notice" ? 1.3 : 1.75,
          id === "notice" ? 1.35 : 1.86,
          support,
          16,
        ),
        "#c4b99e",
        [0, -support / 2, 0],
        "plaster",
      );
    else
      for (const side of [-1, 1])
        box(
          group,
          [0.16, support + 0.35, 2.3],
          [side * 1.15, -support / 2, 0],
          "#a68b61",
          "wood",
        );
    mergePlace(group);
    group.position.set(px, floorY, pz);
    group.rotation.y = Math.atan2(x - px, z - pz);
    obstacles.push(group);
    root.add(group);
    const name = label(id);
    if (name) {
      name.position.set(px, floorY + (id === "garden" ? 3.05 : 2.95), pz);
      root.add(name);
    }
  }
  let disposed = false;
  return {
    group: root,
    locations: OUTDOOR_LOCATIONS,
    obstacles,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      labelTextures.forEach((texture) => texture.dispose());
      labelMaterials.forEach((entry) => entry.dispose());
      root.clear();
    },
  };
}

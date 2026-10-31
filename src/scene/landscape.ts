import * as THREE from "three";
import { LOCATIONS } from "../game/content";
import { LOCATION_POSITIONS, routeCurve } from "./geometry";

const roadSamples = LOCATIONS.flatMap((location) =>
  location.next.flatMap((next) => routeCurve(location.id, next).getPoints(28)),
);
export const RIVER_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(5, -1.1, -39),
  new THREE.Vector3(9, -1.1, -17),
  new THREE.Vector3(11, -1.1, -5),
  new THREE.Vector3(5, -1.1, 4),
  new THREE.Vector3(3, -1.1, 15),
  new THREE.Vector3(8, -1.1, 40),
]);
const riverSamples = RIVER_CURVE.getPoints(110);
const stoneColors = ["#a69d88", "#bcb09a", "#c9bca3", "#8e9180", "#d4c6a9"];
const grassColors = ["#65844e", "#77955a", "#8ca469", "#506f46", "#9db172"];
function noise(seed: number): number {
  return THREE.MathUtils.euclideanModulo(
    Math.sin(seed * 127.1 + 311.7) * 43758.5453,
    1,
  );
}
function nearest(
  points: readonly THREE.Vector3[],
  x: number,
  z: number,
): { distance: number; height: number } {
  let distance = Infinity;
  let height = 0;
  for (const point of points) {
    const candidate = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (candidate < distance) {
      distance = candidate;
      height = point.y;
    }
  }
  return { distance: Math.sqrt(distance), height };
}
export function groundHeight(x: number, z: number): number {
  const road = nearest(roadSamples, x, z);
  const river = nearest(riverSamples, x, z);
  let height =
    -0.25 + 3.8 * Math.exp(-((x + 6) ** 2 / 600 + (z + 27) ** 2 / 150));
  height += 0.025 * Math.sin(x * 0.16) * Math.cos(z * 0.12);
  if (road.distance < 6)
    height = THREE.MathUtils.lerp(
      road.height - 0.13,
      height,
      THREE.MathUtils.smoothstep(road.distance, 1.2, 6),
    );
  if (river.distance < 3.1)
    height = THREE.MathUtils.lerp(
      -1.55,
      height,
      THREE.MathUtils.smoothstep(river.distance, 1.7, 3.1),
    );
  return height;
}
function standard(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
}
function object(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  scale?: THREE.Vector3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.copy(position);
  if (scale) result.scale.copy(scale);
  result.castShadow = result.receiveShadow = true;
  return result;
}
function instances(
  geometry: THREE.BufferGeometry,
  colors: readonly string[],
  count: number,
): THREE.InstancedMesh {
  const result = new THREE.InstancedMesh(geometry, standard("#ffffff"), count);
  result.castShadow = result.receiveShadow = true;
  for (let i = 0; i < count; i++)
    result.setColorAt(i, new THREE.Color(colors[i % colors.length]!));
  return result;
}
function place(
  target: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  angle = 0,
): void {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
    new THREE.Vector3(sx, sy, sz),
  );
  target.setMatrixAt(index, matrix);
}

function terrain(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(92, 88, 124, 120);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = position.getZ(i);
    const height = groundHeight(x, z);
    position.setY(i, height);
    const bank = nearest(riverSamples, x, z).distance < 3.1;
    const color = new THREE.Color(bank ? "#8b9682" : "#829a60");
    color.multiplyScalar(0.97 + noise(i) * 0.06);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  ground.receiveShadow = true;
  return ground;
}

function bridge(): THREE.Group {
  const group = new THREE.Group();
  const stone = standard("#c3b699");
  const cap = standard("#d7c9ac");
  // 拱洞是真实几何空隙，水面和岸石可从两侧透过。
  const shape = new THREE.Shape();
  shape.moveTo(-4.1, -1.4);
  shape.lineTo(-4.1, 0.94);
  shape.lineTo(4.1, 0.94);
  shape.lineTo(4.1, -1.4);
  shape.lineTo(3.35, -1.4);
  for (let i = 0; i <= 24; i++) {
    const theta = (i / 24) * Math.PI;
    shape.lineTo(Math.cos(theta) * 3.35, -1.4 + Math.sin(theta) * 2.03);
  }
  shape.lineTo(-4.1, -1.4);
  const arch = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 1,
    steps: 1,
  });
  for (const side of [-1, 1]) {
    group.add(object(arch, stone, new THREE.Vector3(0, 0, side * 1.35 - 0.21)));
    group.add(
      object(
        new THREE.BoxGeometry(8.5, 0.19, 0.48),
        cap,
        new THREE.Vector3(0, 1.62, side * 1.35),
      ),
    );
    for (let i = 0; i < 11; i++) {
      const theta = ((i + 0.5) / 11) * Math.PI;
      const block = object(
        new THREE.BoxGeometry(0.58, 0.4, 0.52),
        i % 2 ? cap : stone,
        new THREE.Vector3(
          Math.cos(theta) * 3.52,
          -1.4 + Math.sin(theta) * 2.23,
          side * 1.35,
        ),
      );
      block.rotation.z = theta - Math.PI / 2;
      group.add(block);
    }
    for (let i = 0; i < 12; i++)
      group.add(
        object(
          new THREE.BoxGeometry(0.65, 0.47, 0.34),
          i % 3 ? stone : cap,
          new THREE.Vector3(-3.9 + i * 0.71, 1.27, side * 1.35),
        ),
      );
  }
  group.add(
    object(
      new THREE.BoxGeometry(8.3, 0.22, 2.7),
      cap,
      new THREE.Vector3(0, 0.83, 0),
    ),
  );
  group.position.set(11, 0, -5);
  group.rotation.y = -Math.atan2(0.8, 0.6);
  return group;
}

function cobbles(): THREE.Group {
  const group = new THREE.Group();
  const placements: Array<
    readonly [number, number, number, number, number, number]
  > = [];
  let seed = 0;
  for (const location of LOCATIONS)
    for (const next of location.next) {
      const curve = routeCurve(location.id, next);
      const length = curve.getLength();
      const steps = Math.ceil(length / 0.55);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps,
          center = curve.getPoint(t),
          tangent = curve.getTangent(t);
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        for (let lane = -2; lane <= 2; lane++) {
          const offset = lane * 0.45 + (i % 2) * 0.1;
          const point = center.clone().addScaledVector(side, offset);
          // 桥头保留铺石，拱桥范围使用自身桥面。
          if (Math.hypot(point.x - 11, point.z + 5) < 3.4) continue;
          placements.push([
            point.x,
            center.y - 0.025,
            point.z,
            0.41 + noise(seed++) * 0.08,
            0.45 + noise(seed++) * 0.09,
            Math.atan2(tangent.x, tangent.z) + (noise(seed++) - 0.5) * 0.13,
          ]);
        }
      }
    }
  const stones = instances(
    new THREE.BoxGeometry(1, 0.085, 1, 1, 1, 1),
    stoneColors,
    placements.length,
  );
  placements.forEach(([x, y, z, sx, sz, angle], index) =>
    place(stones, index, x, y, z, sx, 1, sz, angle),
  );
  group.add(stones);
  return group;
}

function river(): {
  group: THREE.Group;
  update: (time: number, reduced: boolean) => void;
} {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(4.4, 1, 8, 110);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const t = positions.getY(i) + 0.5;
    const center = RIVER_CURVE.getPoint(t),
      tangent = RIVER_CURVE.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    center.addScaledVector(side, positions.getX(i));
    positions.setXYZ(i, center.x, center.y, center.z);
  }
  geometry.computeVertexNormals();
  const water = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: "#429e9d",
      roughness: 0.23,
      metalness: 0.12,
      clearcoat: 0.65,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  water.receiveShadow = true;
  group.add(water);
  const bankStones = instances(
    new THREE.DodecahedronGeometry(1, 0),
    stoneColors,
    230,
  );
  for (let i = 0; i < 230; i++) {
    const center = RIVER_CURVE.getPoint(i / 229),
      tangent = RIVER_CURVE.getTangent(i / 229);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
      .normalize()
      .multiplyScalar((i % 2 ? -1 : 1) * (2.15 + noise(i) * 0.65));
    const x = center.x + side.x,
      z = center.z + side.z;
    const scale = 0.3 + noise(i * 3) * 0.55;
    place(
      bankStones,
      i,
      x,
      groundHeight(x, z) - 0.06,
      z,
      scale * 1.6,
      scale,
      scale,
      noise(i * 5) * 6,
    );
  }
  group.add(bankStones);
  const ripples = instances(
    new THREE.BoxGeometry(1, 0.012, 1),
    ["#9dcfc3", "#d0e6d7", "#73b6b2"],
    95,
  );
  ripples.castShadow = false;
  group.add(ripples);
  const update = (time: number, reduced: boolean) => {
    for (let i = 0; i < 95; i++) {
      const t = (noise(i * 7) + (reduced ? 0 : time * 0.000008)) % 1;
      const point = RIVER_CURVE.getPoint(t),
        tangent = RIVER_CURVE.getTangent(t);
      point.addScaledVector(
        new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(),
        (noise(i * 11) - 0.5) * 3.5,
      );
      place(
        ripples,
        i,
        point.x,
        -1.07,
        point.z,
        0.12 + noise(i) * 0.35,
        1,
        0.04 + noise(i * 2) * 0.17,
        Math.atan2(tangent.x, tangent.z),
      );
    }
    ripples.instanceMatrix.needsUpdate = true;
  };
  update(0, true);
  return { group, update };
}

function vegetation() {
  const group = new THREE.Group();
  const trees: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < 200; i++) {
    const x = (noise(i * 4 + 0.1) - 0.5) * 80,
      z = (noise(i * 9 + 1.3) - 0.5) * 76;
    const nearBuilding = Object.values(LOCATION_POSITIONS).some(
      ([bx, , bz]) => Math.hypot(x - bx, z - bz) < 4.7,
    );
    if (
      nearest(roadSamples, x, z).distance < 5.0 ||
      nearest(riverSamples, x, z).distance < 3.5 ||
      nearBuilding
    )
      continue;
    trees.push([x, z, 0.5 + noise(i * 13) * 0.35]);
  }
  const trunks = instances(
    new THREE.CylinderGeometry(0.16, 0.3, 2.7, 7),
    ["#766443", "#8a7049"],
    trees.length,
  );
  const crowns = instances(
    new THREE.IcosahedronGeometry(1, 2),
    grassColors,
    trees.length * 5,
  );
  trees.forEach(([x, z, scale], index) => {
    const y = groundHeight(x, z);
    place(trunks, index, x, y + 1.35 * scale, z, scale, scale, scale);
    for (let j = 0; j < 5; j++) {
      const angle = j * 2.39996;
      place(
        crowns,
        index * 5 + j,
        x + Math.cos(angle) * scale * 0.7,
        y + (2.5 + (j % 3) * 0.55) * scale,
        z + Math.sin(angle) * scale * 0.7,
        scale * 1.15,
        scale * (1.05 + j * 0.1),
        scale * 1.1,
        angle,
      );
    }
  });
  group.add(trunks, crowns);
  const bushes = instances(
    new THREE.IcosahedronGeometry(1, 1),
    ["#547347", "#6d8a4b", "#91a45a"],
    310,
  );
  const blossoms = instances(
    new THREE.IcosahedronGeometry(0.1, 0),
    ["#e5bb75", "#d28ca2", "#f2e3bc", "#a28db5"],
    930,
  );
  for (let i = 0; i < 310; i++) {
    const point = roadSamples[Math.floor(noise(i * 2.1) * roadSamples.length)]!;
    const angle = noise(i * 8) * Math.PI * 2;
    const x = point.x + Math.cos(angle) * 2.15,
      z = point.z + Math.sin(angle) * 2.15;
    const y = groundHeight(x, z);
    const size = 0.2 + noise(i * 3) * 0.32;
    place(bushes, i, x, y + size * 0.45, z, size * 1.5, size, size);
    for (let j = 0; j < 3; j++)
      place(
        blossoms,
        i * 3 + j,
        x + (noise(i + j) - 0.5) * size,
        y + size * 1.15,
        z + (noise(i * 7 + j) - 0.5) * size,
        1,
        1,
        1,
      );
  }
  group.add(bushes, blossoms);
  const trunkMatrices = trunks.instanceMatrix.array.slice();
  const crownMatrices = crowns.instanceMatrix.array.slice();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const treeHeights = trees.map(
    ([x, z, scale]) => groundHeight(x, z) + 3 * scale,
  );
  const line = new THREE.Line3();
  const center = new THREE.Vector3();
  const closest = new THREE.Vector3();
  return {
    group,
    updateView(camera: THREE.Vector3, target: THREE.Vector3) {
      trunks.instanceMatrix.array.set(trunkMatrices);
      crowns.instanceMatrix.array.set(crownMatrices);
      line.set(camera, target);
      trees.forEach(([x, z, scale], index) => {
        center.set(x, treeHeights[index]!, z);
        line.closestPointToPoint(center, true, closest);
        if (center.distanceTo(closest) < 2.4 * scale) {
          trunks.setMatrixAt(index, zero);
          for (let j = 0; j < 5; j++) crowns.setMatrixAt(index * 5 + j, zero);
        }
      });
      trunks.instanceMatrix.needsUpdate =
        crowns.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildLandscape(): {
  group: THREE.Group;
  update: (time: number, reduced: boolean) => void;
  updateView: (camera: THREE.Vector3, target: THREE.Vector3) => void;
} {
  const group = new THREE.Group();
  const stream = river();
  const plants = vegetation();
  group.add(terrain(), stream.group, bridge(), cobbles(), plants.group);
  // 后景山岩形成有高低起伏的天际线，避免圆形展示台边缘。
  const cliffs = instances(
    new THREE.DodecahedronGeometry(1, 1),
    ["#9caa9e", "#aeb6a4", "#bec3af"],
    35,
  );
  for (let i = 0; i < 35; i++) {
    const x = -42 + i * 2.5,
      z = -34 - noise(i) * 7;
    place(
      cliffs,
      i,
      x,
      -0.5 + noise(i * 5) * 2,
      z,
      3 + noise(i * 4) * 2,
      4 + noise(i * 8) * 6,
      3,
      noise(i) * 6,
    );
  }
  group.add(cliffs);
  return { group, update: stream.update, updateView: plants.updateView };
}

import * as THREE from "three";
import type { LocationId } from "../game/content";

export const LOCATION_POSITIONS: Record<
  LocationId,
  readonly [number, number, number]
> = {
  square: [-9, 0.2, 10],
  bakery: [-17, 1, 4],
  grocery: [-16, 1.8, -5],
  notice: [-11, 3.2, -13],
  market: [-3, 3.8, -16],
  research: [6, 4.8, -13],
  bridge: [11, 1, -5],
  bank: [16, 0.7, 1],
  gifts: [13, 0.4, 10],
  rival: [6, 0.3, 15],
  riverside: [0, 0.2, 17],
  cafe: [-5, 0.2, 15],
  repair: [-22, 2.5, -10],
  garden: [-14, 4.2, -20],
  music: [20, 0.7, -5],
  dock: [8.3, 0.3, 7.2],
};
export function routeCurve(
  from: LocationId,
  to: LocationId,
): THREE.CatmullRomCurve3 {
  const a = new THREE.Vector3(...LOCATION_POSITIONS[from]);
  const b = new THREE.Vector3(...LOCATION_POSITIONS[to]);
  const delta = b.clone().sub(a);
  const bend = new THREE.Vector3(-delta.z, 0, delta.x)
    .normalize()
    .multiplyScalar(Math.min(1.2, delta.length() * 0.12));
  return new THREE.CatmullRomCurve3([
    a,
    a.clone().lerp(b, 0.33).add(bend),
    a.clone().lerp(b, 0.7).add(bend.multiplyScalar(0.6)),
    b,
  ]);
}
export function ribbonGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  width: number,
  segments = 48,
  support = true,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPoint(i / segments);
    const t = curve.getTangent(i / segments);
    const side = new THREE.Vector3(-t.z, 0, t.x)
      .normalize()
      .multiplyScalar(width / 2);
    positions.push(
      p.x + side.x,
      p.y,
      p.z + side.z,
      p.x - side.x,
      p.y,
      p.z - side.z,
    );
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  // 道路两侧延伸至地基，保持高处街道有真实支撑。
  for (const side of support ? [-1, 1] : []) {
    const offset = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const p = curve.getPoint(i / segments);
      const t = curve.getTangent(i / segments);
      const edge = new THREE.Vector3(-t.z, 0, t.x)
        .normalize()
        .multiplyScalar((width / 2) * side);
      positions.push(
        p.x + edge.x,
        p.y,
        p.z + edge.z,
        p.x + edge.x,
        -0.3,
        p.z + edge.z,
      );
      if (i < segments) {
        const n = offset + i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

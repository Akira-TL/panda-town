import * as THREE from "three";

/** 连续宽缓山脊，避免独立圆锥形成尖齿天际线。 */
export function createDistantMountains(): THREE.Group {
  const group = new THREE.Group();
  const far: ReadonlyArray<readonly [number, number, number, number, number]> =
    [
      [-53, -74, 21, 14, 18],
      [-28, -67, 23, 15, 19],
      [0, -76, 25, 17, 20],
      [29, -66, 21, 14, 19],
      [53, -79, 24, 16, 20],
    ];
  const near: ReadonlyArray<readonly [number, number, number, number, number]> =
    [
      [-48, -45, 11, 10, 11],
      [-29, -43, 13, 10, 12],
      [-10, -46, 12, 11, 11],
      [14, -43, 13, 10, 10],
      [39, -46, 14, 11, 12],
      [57, -45, 10, 10, 10],
    ];
  for (let layer = 0; layer < 2; layer++) {
    const geometry = new THREE.PlaneGeometry(
      140,
      layer === 0 ? 56 : 34,
      84,
      34,
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, layer === 0 ? -75 : -45);
    const position = geometry.getAttribute("position");
    const colors: number[] = [];
    const peaks = layer === 0 ? far : near;
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index),
        z = position.getZ(index);
      let elevation = 0;
      for (const [px, pz, height, sx, sz] of peaks) {
        const value =
          height *
          Math.exp(
            -((x - px) ** 2 / (2 * sx * sx) + (z - pz) ** 2 / (2 * sz * sz)),
          );
        elevation = Math.max(elevation, value);
      }
      const front =
        layer === 0
          ? THREE.MathUtils.smoothstep(-z, 47, 59)
          : THREE.MathUtils.smoothstep(-z, 28, 39);
      const edge = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 59, 70);
      const variation =
        0.4 * Math.sin(x * 0.23 + z * 0.13) +
        0.22 * Math.sin(x * 0.49 - z * 0.18);
      const y = -2 + (elevation + variation) * front * edge;
      position.setY(index, y);
      const color = new THREE.Color(layer === 0 ? "#7899aa" : "#748b71");
      color.lerp(
        new THREE.Color(layer === 0 ? "#b3c7d0" : "#a7b0a3"),
        Math.min(1, Math.max(0, y / 24)),
      );
      color.multiplyScalar(0.98 + 0.025 * Math.sin(y * 2 + x * 0.12));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      ),
    );
  }
  return group;
}

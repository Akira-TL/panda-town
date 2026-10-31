import * as THREE from "three";
import { ribbonGeometry } from "./geometry";

function stone(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
}
function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.receiveShadow = true;
  object.castShadow = true;
  return object;
}

/** 几何远山、跌水及公共铺地区，不代替已导入的地标模型。 */
export function createScenery(heightAt: (x: number, z: number) => number) {
  const group = new THREE.Group();
  for (let layer = 0; layer < 2; layer++)
    for (let index = 0; index < 8; index++) {
      const seed = index * 1.7 + layer * 3.3;
      const geometry = new THREE.ConeGeometry(1, 1, 7, 5);
      const position = geometry.getAttribute("position");
      const colors: number[] = [];
      const width = 7 + (index % 3) * 2.2;
      const height = (layer === 0 ? 20 : 11) + (index % 4) * 2.4;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const x = position.getX(vertex),
          z = position.getZ(vertex),
          y = position.getY(vertex) + 0.5;
        const irregular =
          1 + 0.2 * Math.sin(x * 7.1 + z * 4.3 + y * 5.2 + seed);
        position.setXYZ(
          vertex,
          x * width * irregular,
          y * height,
          z * width * 0.8 * irregular,
        );
        const color = new THREE.Color(layer === 0 ? "#7795a6" : "#697e66");
        color.lerp(
          new THREE.Color(layer === 0 ? "#b8cbd2" : "#a9b0a6"),
          Math.min(1, y * 0.9),
        );
        color.multiplyScalar(0.93 + 0.07 * Math.sin(y * 25 + seed));
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      geometry.computeVertexNormals();
      const mountain = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          flatShading: true,
        }),
      );
      mountain.position.set(
        -50 + index * 14 + (layer ? 4 : 0),
        -3,
        layer === 0 ? -53 : -39,
      );
      group.add(mountain);
    }
  const fallCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3, 9.5, -40),
    new THREE.Vector3(3.5, 9.45, -37.4),
    new THREE.Vector3(4, 4.7, -35.8),
    new THREE.Vector3(4.8, -1.05, -33.3),
  ]);
  const ledge = mesh(
    new THREE.IcosahedronGeometry(1, 1),
    stone("#929e92"),
    3.6,
    3.9,
    -39.3,
  );
  ledge.scale.set(3, 5.7, 2.4);
  group.add(ledge);
  const fallingWater = new THREE.Mesh(
    ribbonGeometry(fallCurve, 1.7, 48, false),
    new THREE.MeshStandardMaterial({
      color: "#9ccdd3",
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  group.add(fallingWater);
  for (const offset of [-0.6, -0.2, 0.25, 0.6]) {
    const curve = new THREE.CatmullRomCurve3(
      fallCurve
        .getPoints(16)
        .map((point) => point.add(new THREE.Vector3(offset, 0, 0.035))),
    );
    const stream = new THREE.Mesh(
      ribbonGeometry(curve, 0.06, 40, false),
      new THREE.MeshStandardMaterial({
        color: "#edf4df",
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    group.add(stream);
  }
  const corners = [
    [-14, -2],
    [-9, -10],
    [-2, -8],
    [2, -1],
    [-1, 7],
    [-6, 10],
    [-13, 6],
  ] as const;
  function inside(x: number, z: number) {
    let result = false;
    for (let a = 0, b = corners.length - 1; a < corners.length; b = a++) {
      const [ax, az] = corners[a]!,
        [bx, bz] = corners[b]!;
      if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
        result = !result;
    }
    return result;
  }
  const plazaGeometry = new THREE.PlaneGeometry(16, 20, 32, 40);
  plazaGeometry.rotateX(-Math.PI / 2);
  plazaGeometry.translate(-6, 0, 0);
  const plazaVertices = plazaGeometry.getAttribute("position");
  for (let index = 0; index < plazaVertices.count; index++)
    plazaVertices.setY(
      index,
      heightAt(plazaVertices.getX(index), plazaVertices.getZ(index)) + 0.018,
    );
  const oldIndices = plazaGeometry.getIndex()!;
  const indices: number[] = [];
  for (let index = 0; index < oldIndices.count; index += 3) {
    const triangle = [
      oldIndices.getX(index),
      oldIndices.getX(index + 1),
      oldIndices.getX(index + 2),
    ];
    if (
      triangle.every((vertex) =>
        inside(plazaVertices.getX(vertex), plazaVertices.getZ(vertex)),
      )
    )
      indices.push(...triangle);
  }
  plazaGeometry.setIndex(indices);
  plazaGeometry.computeVertexNormals();
  const plaza = new THREE.Mesh(plazaGeometry, stone("#c8c0a8"));
  plaza.receiveShadow = true;
  group.add(plaza);
  const pavers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.65, 0.045, 0.42),
    stone("#ddd2b8"),
    420,
  );
  const transform = new THREE.Object3D();
  let count = 0;
  for (let row = 0; row < 22; row++)
    for (let column = 0; column < 22; column++) {
      const x = -13 + column * 0.66 + (row % 2) * 0.3,
        z = -7 + row * 0.46;
      if (((x + 6) / 7) ** 2 + ((z - 1) / 5.5) ** 2 > 1 || count >= 420)
        continue;
      transform.position.set(x, heightAt(x, z) + 0.04, z);
      transform.rotation.y = Math.sin(row * 11 + column) * 0.07;
      transform.updateMatrix();
      pavers.setMatrixAt(count++, transform.matrix);
    }
  pavers.count = count;
  pavers.receiveShadow = true;
  group.add(pavers);
  const fountain = new THREE.Group();
  fountain.position.set(-6, heightAt(-6, 2), 2);
  const rim = stone("#c1b69a"),
    base = stone("#a9a68c");
  fountain.add(
    mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.18, 16), base, 0, 0.1, 0),
  );
  const basin = mesh(
    new THREE.TorusGeometry(1.16, 0.16, 8, 32),
    rim,
    0,
    0.36,
    0,
  );
  basin.rotation.x = Math.PI / 2;
  fountain.add(basin);
  const pool = mesh(
    new THREE.CircleGeometry(1.14, 32),
    new THREE.MeshStandardMaterial({ color: "#6ab6b7", roughness: 0.2 }),
    0,
    0.34,
    0,
  );
  pool.rotation.x = -Math.PI / 2;
  fountain.add(pool);
  fountain.add(
    mesh(new THREE.CylinderGeometry(0.24, 0.4, 0.8, 12), rim, 0, 0.65, 0),
  );
  fountain.add(mesh(new THREE.SphereGeometry(0.3, 16, 10), rim, 0, 1.15, 0));
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2;
    const arc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(Math.cos(angle) * 0.5, 1.5, Math.sin(angle) * 0.5),
      new THREE.Vector3(Math.cos(angle) * 0.9, 0.4, Math.sin(angle) * 0.9),
    ]);
    fountain.add(
      mesh(
        new THREE.TubeGeometry(arc, 12, 0.022, 5, false),
        new THREE.MeshStandardMaterial({ color: "#c4e3dc", roughness: 0.2 }),
        0,
        0,
        0,
      ),
    );
  }
  group.add(fountain);
  return group;
}

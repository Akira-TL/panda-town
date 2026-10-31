import * as THREE from "three";
import type { LocationId } from "../game/content";

export type SurfaceName = "wood" | "plaster" | "roof" | "canvas";
export type SurfaceTextures = Record<SurfaceName, THREE.Texture>;

function part(
  geometry: THREE.BufferGeometry,
  color: string,
  x: number,
  y: number,
  z: number,
  texture?: THREE.Texture,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, map: texture ?? null, roughness: 0.9 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function window(
  surfaces: SurfaceTextures,
  width = 0.65,
  height = 0.85,
): THREE.Group {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: "#eac786",
    emissive: "#a66a2c",
    emissiveIntensity: 0.35,
    roughness: 0.55,
  });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), glass);
  pane.position.z = 0.02;
  group.add(pane);
  for (const side of [-1, 1]) {
    group.add(
      part(
        new THREE.BoxGeometry(0.07, height + 0.12, 0.15),
        "#7f6548",
        (side * width) / 2,
        0,
        0.04,
        surfaces.wood,
      ),
    );
    group.add(
      part(
        new THREE.BoxGeometry(width * 0.34, height + 0.1, 0.08),
        "#809674",
        side * width * 0.77,
        0,
        0.07,
        surfaces.wood,
      ),
    );
    group.add(
      part(
        new THREE.BoxGeometry(width + 0.12, 0.07, 0.15),
        "#7f6548",
        0,
        (side * height) / 2,
        0.04,
        surfaces.wood,
      ),
    );
  }
  group.add(
    part(new THREE.BoxGeometry(0.045, height, 0.15), "#7f6548", 0, 0, 0.08),
  );
  group.add(
    part(new THREE.BoxGeometry(width, 0.045, 0.15), "#7f6548", 0, 0, 0.08),
  );
  return group;
}
function planter(x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.add(part(new THREE.BoxGeometry(0.95, 0.25, 0.35), "#98734e", 0, 0, 0));
  for (let i = 0; i < 7; i++) {
    group.add(
      part(
        new THREE.IcosahedronGeometry(0.16, 1),
        "#587744",
        -0.4 + i * 0.13,
        0.2,
        0,
      ),
    );
    group.add(
      part(
        new THREE.IcosahedronGeometry(0.065, 0),
        i % 2 ? "#d999a4" : "#e9d69a",
        -0.4 + i * 0.13,
        0.33,
        0.04,
      ),
    );
  }
  return group;
}
function lantern(x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.add(part(new THREE.BoxGeometry(0.25, 0.38, 0.22), "#d6b66e", 0, 0, 0));
  const glass = part(
    new THREE.BoxGeometry(0.18, 0.28, 0.24),
    "#ffe1a1",
    0,
    0,
    0.015,
  );
  if (glass.material instanceof THREE.MeshStandardMaterial) {
    glass.material.emissive.set("#ffc46c");
    glass.material.emissiveIntensity = 0.8;
  }
  group.add(glass);
  group.add(part(new THREE.ConeGeometry(0.23, 0.17, 4), "#5b5c48", 0, 0.29, 0));
  group.add(
    part(new THREE.BoxGeometry(0.08, 0.35, 0.08), "#5b5c48", 0, 0.5, -0.1),
  );
  return group;
}
function pitchedRoof(
  width: number,
  depth: number,
  height: number,
  color: string,
  surfaces: SurfaceTextures,
): THREE.Group {
  const group = new THREE.Group();
  const rise = 1.45;
  const half = width / 2 + 0.3;
  const slope = Math.atan2(rise, half);
  const length = Math.hypot(half, rise);
  for (const side of [-1, 1]) {
    const roof = part(
      new THREE.BoxGeometry(length, 0.2, depth + 0.6),
      color,
      (side * half) / 2,
      height + rise / 2,
      0,
      surfaces.roof,
    );
    roof.rotation.z = -side * slope;
    group.add(roof);
    const fascia = part(
      new THREE.BoxGeometry(length + 0.08, 0.16, 0.16),
      "#826243",
      (side * half) / 2,
      height + rise / 2 - 0.07,
      depth / 2 + 0.32,
      surfaces.wood,
    );
    fascia.rotation.z = -side * slope;
    group.add(fascia);
  }
  group.add(
    part(
      new THREE.CylinderGeometry(0.13, 0.13, depth + 0.75, 8),
      color,
      0,
      height + rise + 0.03,
      0,
      surfaces.roof,
    ),
  );
  group.children[group.children.length - 1]!.rotation.x = Math.PI / 2;
  return group;
}

/** 六处自建地标及模型加载前的占位；真实模型就绪后由加载器整体替换。 */
export function buildLandmark(
  id: LocationId,
  index: number,
  surfaces: SurfaceTextures,
): THREE.Group {
  const group = new THREE.Group();
  if (id === "market") {
    for (const side of [-1, 1]) {
      group.add(
        part(
          new THREE.CylinderGeometry(0.1, 0.13, 2.8, 8),
          "#b59970",
          side * 1.6,
          1.4,
          1,
          surfaces.wood,
        ),
      );
      group.add(
        part(
          new THREE.CylinderGeometry(0.1, 0.13, 2.8, 8),
          "#b59970",
          side * 1.6,
          1.4,
          -1,
          surfaces.wood,
        ),
      );
    }
    group.add(
      part(
        new THREE.BoxGeometry(3.6, 0.65, 1.15),
        "#aa875f",
        0,
        0.8,
        0.8,
        surfaces.wood,
      ),
    );
    const canopy = part(
      new THREE.CylinderGeometry(1.85, 1.85, 2.8, 12, 1, true, 0, Math.PI),
      "#d6dfb2",
      0,
      2.4,
      0,
      surfaces.canvas,
    );
    canopy.rotation.x = Math.PI / 2;
    group.add(canopy);
    for (let i = 0; i < 5; i++) {
      group.add(
        part(
          new THREE.BoxGeometry(0.55, 0.28, 0.6),
          "#b9956d",
          -1.2 + i * 0.6,
          1.25,
          0.8,
          surfaces.wood,
        ),
      );
      for (let j = 0; j < 3; j++)
        group.add(
          part(
            new THREE.SphereGeometry(0.11, 8, 6),
            i % 2 ? "#c6955e" : "#8b9c5e",
            -1.35 + i * 0.6 + j * 0.14,
            1.45,
            0.8,
          ),
        );
    }
    group.add(planter(-1.9, 0.25, 1.4), lantern(1.6, 2.2, 1.1));
    return group;
  }
  const width = id === "bank" ? 4.1 : 3.6;
  const depth = id === "cafe" ? 3.4 : 3;
  const height = id === "bank" ? 4.6 : 2.9 + (index % 3) * 0.38;
  const wall = ["#f5e9d0", "#ebddbe", "#e6dec5"][index % 3]!;
  const gable = new THREE.Shape();
  gable.moveTo(-width / 2, 0);
  gable.lineTo(width / 2, 0);
  gable.lineTo(width / 2, height);
  gable.lineTo(0, height + 1.4);
  gable.lineTo(-width / 2, height);
  gable.closePath();
  group.add(
    part(
      new THREE.ExtrudeGeometry(gable, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.06,
        bevelSegments: 1,
        steps: 1,
      }),
      wall,
      0,
      0,
      -depth / 2,
      surfaces.plaster,
    ),
  );
  group.add(
    pitchedRoof(
      width,
      depth,
      height,
      id === "research" ? "#8aa794" : "#c58b6a",
      surfaces,
    ),
  );
  for (const x of [-width / 2, width / 2])
    group.add(
      part(
        new THREE.BoxGeometry(0.16, height, 0.18),
        "#9d805c",
        x,
        height / 2,
        depth / 2 + 0.04,
        surfaces.wood,
      ),
    );
  for (const y of [0.18, height - 0.15])
    group.add(
      part(
        new THREE.BoxGeometry(width + 0.1, 0.18, 0.18),
        "#a38a66",
        0,
        y,
        depth / 2 + 0.04,
        surfaces.wood,
      ),
    );
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.43, 0);
  doorShape.lineTo(0.43, 0);
  doorShape.lineTo(0.43, 1.2);
  doorShape.absarc(0, 1.2, 0.43, 0, Math.PI, false);
  doorShape.lineTo(-0.43, 0);
  group.add(
    part(
      new THREE.ExtrudeGeometry(doorShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.035,
        bevelSegments: 1,
      }),
      "#9a7651",
      0,
      0.08,
      depth / 2 + 0.04,
      surfaces.wood,
    ),
  );
  group.add(
    part(
      new THREE.SphereGeometry(0.055, 8, 6),
      "#d5b265",
      0.27,
      0.8,
      depth / 2 + 0.24,
    ),
  );
  for (const x of [-1.15, 1.15]) {
    const frontWindow = window(surfaces);
    frontWindow.position.set(x, 1.65, depth / 2 + 0.15);
    group.add(frontWindow, planter(x, 1.05, depth / 2 + 0.25));
    const sideWindow = window(surfaces);
    sideWindow.position.set(
      x < 0 ? -width / 2 - 0.13 : width / 2 + 0.13,
      1.7,
      0,
    );
    sideWindow.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(sideWindow);
  }
  const attic = window(surfaces, 0.6, 0.7);
  attic.position.set(0, height + 0.45, depth / 2 + 0.13);
  group.add(attic, lantern(-0.68, 1.95, depth / 2 + 0.3));
  const chimney = part(
    new THREE.BoxGeometry(0.48, 1.6, 0.5),
    "#c5b79a",
    -1.0,
    height + 1.25,
    -0.6,
    surfaces.plaster,
  );
  group.add(
    chimney,
    part(
      new THREE.BoxGeometry(0.65, 0.15, 0.66),
      "#a5977e",
      -1,
      height + 2.08,
      -0.6,
    ),
  );
  for (let i = 0; i < 3; i++)
    group.add(
      part(
        new THREE.BoxGeometry(1.1 + i * 0.22, 0.13, 0.35),
        "#cbbda1",
        0,
        0.02 - i * 0.08,
        depth / 2 + 0.3 + i * 0.27,
      ),
    );
  if (id === "research") {
    const tower = part(
      new THREE.CylinderGeometry(1.18, 1.18, 3.7, 16),
      "#efe5c8",
      2.0,
      1.85,
      -0.4,
      surfaces.plaster,
    );
    const dome = part(
      new THREE.SphereGeometry(1.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      "#91b2a2",
      2,
      3.7,
      -0.4,
    );
    group.add(tower, dome);
    for (let i = 0; i < 8; i++) {
      const rib = part(
        new THREE.TorusGeometry(1.38, 0.035, 4, 24, Math.PI),
        "#c6af75",
        2,
        3.7,
        -0.4,
      );
      rib.rotation.y = (i * Math.PI) / 8;
      group.add(rib);
    }
    group.add(
      part(new THREE.ConeGeometry(0.13, 0.7, 8), "#c6af75", 2, 5.35, -0.4),
    );
  } else if (id === "bank") {
    for (const side of [-1, 1])
      group.add(
        part(
          new THREE.CylinderGeometry(0.15, 0.21, 2.8, 12),
          "#d9cbae",
          side * 0.75,
          1.4,
          depth / 2 + 0.42,
        ),
      );
    const roundWindow = part(
      new THREE.CylinderGeometry(0.45, 0.45, 0.15, 20),
      "#d3b267",
      0,
      3.5,
      depth / 2 + 0.18,
    );
    roundWindow.rotation.x = Math.PI / 2;
    group.add(roundWindow);
  } else {
    const awning = part(
      new THREE.BoxGeometry(width + 0.2, 0.13, 1.2),
      id === "gifts" ? "#cfabc0" : id === "rival" ? "#bb9475" : "#d1d4a4",
      0,
      2.4,
      depth / 2 + 0.5,
      surfaces.canvas,
    );
    awning.rotation.x = 0.13;
    group.add(awning);
    for (let i = 0; i < 9; i++)
      group.add(
        part(
          new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          i % 2 ? "#f3e7ca" : "#d2c5a0",
          -1.6 + i * 0.4,
          2.22,
          depth / 2 + 1.1,
          surfaces.canvas,
        ),
      );
  }
  if (id === "cafe") {
    for (const x of [-2.4, 2.4]) {
      group.add(
        part(
          new THREE.CylinderGeometry(0.62, 0.62, 0.12, 16),
          "#ae8c60",
          x,
          0.95,
          2.6,
          surfaces.wood,
        ),
      );
      group.add(
        part(
          new THREE.CylinderGeometry(0.09, 0.13, 0.9, 8),
          "#9c7d58",
          x,
          0.46,
          2.6,
          surfaces.wood,
        ),
      );
      const umbrella = part(
        new THREE.ConeGeometry(1.3, 0.55, 12),
        "#f2e7c9",
        x,
        2.5,
        2.6,
        surfaces.canvas,
      );
      group.add(
        umbrella,
        part(
          new THREE.CylinderGeometry(0.045, 0.045, 2.5, 8),
          "#ab906a",
          x,
          1.25,
          2.6,
        ),
      );
    }
  }
  return group;
}

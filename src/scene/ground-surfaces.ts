import * as THREE from "three";

export type GroundSurface = "grass-earth" | "cobblestone-path" | "stone-wall";
const periods: Record<GroundSurface, number> = {
  "grass-earth": 2,
  "cobblestone-path": 1.4,
  "stone-wall": 2,
};

/** 按世界米投影；箱体侧面按法线选平面，避免墙面只剩一条水平像素。 */
export function setWorldSurfaceUV(mesh: THREE.Mesh, metres: number): void {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uv: number[] = [];
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let index = 0; index < positions.count; index++) {
    point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
    normal
      .fromBufferAttribute(normals, index)
      .applyMatrix3(normalMatrix)
      .normalize();
    const horizontal =
      Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z));
    const u =
      horizontal || Math.abs(normal.z) >= Math.abs(normal.x)
        ? point.x
        : point.z;
    uv.push(u / metres, (horizontal ? point.z : point.y) / metres);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

export function createGroundSurfaces(
  loader: THREE.TextureLoader,
  anisotropy: number,
  onStatus: (name: GroundSurface, loaded: boolean) => void,
) {
  const names: readonly GroundSurface[] = [
    "grass-earth",
    "cobblestone-path",
    "stone-wall",
  ];
  const textures = new Map<GroundSurface, THREE.Texture>();
  let disposed = false;
  for (const name of names) {
    const texture = loader.load(
      `/art/materials/${name}.webp`,
      (loaded) => {
        if (disposed) loaded.dispose();
        else onStatus(name, true);
      },
      undefined,
      () => {
        if (!disposed) onStatus(name, false);
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(4, anisotropy);
    textures.set(name, texture);
  }
  function apply(mesh: THREE.Mesh, name: GroundSurface): void {
    setWorldSurfaceUV(mesh, periods[name]);
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.map = textures.get(name)!;
      material.color.set("#ffffff");
      material.roughness = 1;
      material.needsUpdate = true;
    }
  }
  function applyGroup(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.name === "Terrain") apply(node, "grass-earth");
      else if (/^(Road|Plaza|Entrance:)/.test(node.name))
        apply(node, "cobblestone-path");
      else if (/^(BridgeStone|Foundation:)/.test(node.name))
        apply(node, "stone-wall");
    });
  }
  return {
    applyGroup,
    dispose() {
      disposed = true;
      textures.forEach((texture) => texture.dispose());
    },
  };
}

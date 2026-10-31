import * as THREE from "three";
import type { LocationId } from "../game/content";
import { LOCATION_POSITIONS } from "./geometry";
import { groundHeight } from "./landscape";

/** 以实际模型前沿留出门前净空；游戏停靠点和路线保持原位。 */
export function createLandmarkPlacement(
  anchor: THREE.Group,
  location: LocationId,
  initial: THREE.Box3,
) {
  const [x, y, z] = LOCATION_POSITIONS[location];
  const radial = new THREE.Vector3(x, 0, z).normalize();
  const group = new THREE.Group();
  group.name = `Terrace:${location}`;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: "#b3ab94", roughness: 0.95 }),
  );
  foundation.name = `Foundation:${location}`;
  foundation.castShadow = foundation.receiveShadow = true;
  const approach = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.12, 2.5),
    new THREE.MeshStandardMaterial({ color: "#cdc2a8", roughness: 0.95 }),
  );
  approach.name = `Entrance:${location}`;
  approach.position.set(x + radial.x * 1.15, y - 0.1, z + radial.z * 1.15);
  approach.rotation.y = Math.atan2(-radial.x, -radial.z);
  approach.receiveShadow = true;
  group.add(foundation, approach);
  function fit(bounds: THREE.Box3) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const setback = Math.max(0, bounds.max.z) + 2.3;
    anchor.position.set(
      x + radial.x * setback,
      y - 0.05,
      z + radial.z * setback,
    );
    anchor.rotation.y = Math.atan2(-radial.x, -radial.z);
    anchor.updateMatrixWorld(true);
    const width = size.x + 0.4,
      depth = size.z + 0.4;
    let lowest = Infinity;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const corner = new THREE.Vector3(
          center.x + (sx * width) / 2,
          0,
          center.z + (sz * depth) / 2,
        ).applyMatrix4(anchor.matrixWorld);
        lowest = Math.min(lowest, groundHeight(corner.x, corner.z));
      }
    const top = y - 0.05 + bounds.min.y;
    const thickness = Math.max(0.22, top - lowest);
    foundation.geometry.dispose();
    foundation.geometry = new THREE.BoxGeometry(width, thickness, depth);
    const position = new THREE.Vector3(center.x, 0, center.z).applyMatrix4(
      anchor.matrixWorld,
    );
    foundation.position.set(position.x, top - thickness / 2, position.z);
    foundation.rotation.y = anchor.rotation.y;
    return { width, depth, frontClearance: 2.3 };
  }
  fit(initial);
  return { group, fit };
}

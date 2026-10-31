import * as THREE from "three";

/** 只调整摄影，不改变路线、角色位置或领域证据。 */
export function planFollowCamera(
  focus: THREE.Vector3,
  obstacles: readonly THREE.Object3D[],
) {
  const target = focus.clone().add(new THREE.Vector3(0, 1.3, 0));
  const inward = new THREE.Vector3(-focus.x, 0, -focus.z).normalize();
  if (inward.lengthSq() < 0.1) inward.set(0, 0, 1);
  const boxes = obstacles.map((obstacle) =>
    new THREE.Box3().setFromObject(obstacle),
  );
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  function intersections(position: THREE.Vector3): number {
    const direction = position.clone().sub(target);
    const distance = direction.length();
    ray.set(target, direction.normalize());
    return boxes.filter((box) => {
      if (box.containsPoint(target)) return false;
      return (
        ray.intersectBox(box, hit) !== null &&
        hit.distanceTo(target) < distance + 0.2
      );
    }).length;
  }
  let best = focus.clone().add(new THREE.Vector3(0, 7, 8));
  let bestScore = Infinity;
  for (const height of [4.8, 7.5]) {
    for (const angle of [0, -0.6, 0.6, -1.2, 1.2, Math.PI]) {
      const offset = inward
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        .multiplyScalar(8);
      offset.y = height;
      const position = focus.clone().add(offset);
      const score =
        intersections(position) * 100 + Math.abs(angle) + (height - 4.8) * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = position;
      }
    }
  }
  return {
    position: best,
    blocked: intersections(best),
    intersects: intersections,
  };
}

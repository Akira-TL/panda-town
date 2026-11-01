import * as THREE from "three";
import {
  cameraFrameRegion,
  frameOverflow,
  isInFrame,
  projectBox,
  visibleBounds,
  type FramingLandmark,
} from "./camera-framing";

export interface FollowCameraOptions {
  camera?: THREE.PerspectiveCamera;
  playerBounds?: THREE.Box3;
  landmark?: FramingLandmark | null;
  width?: number;
  height?: number;
  decisionOpen?: boolean;
}

/** AABB只做粗筛；真正遮挡使用双面三角形射线，保留拱洞等实际空隙。 */
function occlusionQuery(
  obstacles: readonly THREE.Object3D[],
  samples: readonly THREE.Vector3[],
) {
  const boxes = obstacles.map((object) => visibleBounds(object));
  const raycaster = new THREE.Raycaster(),
    direction = new THREE.Vector3(),
    hit = new THREE.Vector3();
  function blocked(
    position: THREE.Vector3,
    target: THREE.Vector3,
    ignore?: THREE.Object3D,
  ): boolean {
    direction.copy(target).sub(position);
    const distance = direction.length();
    if (distance < 0.2) return false;
    raycaster.set(position, direction.divideScalar(distance));
    raycaster.near = 0.08;
    raycaster.far = distance - 0.12;
    return obstacles.some((object, index) => {
      if (object === ignore || !object.visible || boxes[index]!.isEmpty())
        return false;
      const box = boxes[index]!;
      if (box.containsPoint(position)) return true;
      if (
        raycaster.ray.intersectBox(box, hit) === null ||
        hit.distanceTo(position) > distance + 0.1
      )
        return false;
      const sides = new Map<THREE.Material, THREE.Side>();
      object.traverseVisible((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        for (const material of materials) {
          if (!sides.has(material)) sides.set(material, material.side);
          material.side = THREE.DoubleSide;
        }
      });
      try {
        return raycaster
          .intersectObject(object, true)
          .some((entry) => entry.distance < distance - 0.12);
      } finally {
        sides.forEach((side, material) => {
          material.side = side;
        });
      }
    });
  }
  return {
    blocked,
    intersects: (position: THREE.Vector3) =>
      samples.reduce(
        (count, sample) => count + Number(blocked(position, sample)),
        0,
      ),
  };
}

/** 用真实包围盒和相机投影拟合主角与邻近门面，距离有限，不移动任何实体。 */
export function planFollowCamera(
  focus: THREE.Vector3,
  obstacles: readonly THREE.Object3D[],
  forward: THREE.Vector3,
  options: FollowCameraOptions = {},
) {
  const width = options.width ?? 1440,
    height = options.height ?? 900;
  const region = cameraFrameRegion(width, height, !!options.decisionOpen);
  const player =
    options.playerBounds?.clone() ??
    new THREE.Box3(
      focus.clone().add(new THREE.Vector3(-0.6, 0, -0.6)),
      focus.clone().add(new THREE.Vector3(0.6, 2.1, 0.6)),
    );
  const landmark = options.landmark ?? null;
  const landmarkBounds = landmark ? visibleBounds(landmark.object) : null;
  // 始终以主角身体为注视中心，门面只参与可见范围约束。
  const target = player.getCenter(new THREE.Vector3());
  const center = target.clone();
  const samples = [
    center.clone(),
    new THREE.Vector3(center.x, player.max.y - 0.1, center.z),
    new THREE.Vector3(center.x, player.min.y + 0.15, center.z),
    new THREE.Vector3(player.min.x + 0.1, center.y, center.z),
    new THREE.Vector3(player.max.x - 0.1, center.y, center.z),
  ];
  const query = occlusionQuery(obstacles, samples);
  const referenceFocus = focus.clone(),
    movement = new THREE.Vector3(),
    sampleNow = new THREE.Vector3();
  const intersects = (position: THREE.Vector3) => {
    movement.copy(focus).sub(referenceFocus);
    return samples.reduce(
      (count, sample) =>
        count +
        Number(query.blocked(position, sampleNow.copy(sample).add(movement))),
      0,
    );
  };
  const projection =
    options.camera?.clone() ??
    new THREE.PerspectiveCamera(43, width / height, 0.2, 180);
  const front = landmark
    ? new THREE.Vector3(0, 0, 1).transformDirection(landmark.object.matrixWorld)
    : new THREE.Vector3(-forward.x, 0, -forward.z);
  front.y = 0;
  if (front.lengthSq() < 0.01) front.set(0, 0, 1);
  front.normalize();
  const minimumPixels = height < 720 ? 44 : 60;
  // 真实投影含前后深度、俯角和屏幕偏移；主角高度的正视近似不能当搜索上限。
  // 保留48的绝对距离上限，并在候选评分中用实际投影像素约束人物可辨程度。
  const maxDistance = 48;
  const facade = landmarkBounds?.getCenter(new THREE.Vector3()) ?? center;
  let best = focus.clone().add(new THREE.Vector3(0, 9, 14)),
    bestScore = Infinity;
  let bestFit = false;
  for (const elevation of [0.3, 0.48, 0.65])
    for (const angle of [0, -0.45, 0.45, -0.9, 0.9, -1.5, 1.5, Math.PI]) {
      const direction = front
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      direction.multiplyScalar(Math.cos(elevation));
      direction.y = Math.sin(elevation);
      const at = (distance: number) => {
        projection.position.copy(target).addScaledVector(direction, distance);
        projection.lookAt(target);
        projection.updateMatrixWorld(true);
      };
      const fits = (distance: number) => {
        at(distance);
        return (
          isInFrame(projectBox(projection, player), region) &&
          (!landmarkBounds ||
            isInFrame(projectBox(projection, landmarkBounds), region))
        );
      };
      let lower = 7,
        upper = maxDistance;
      const fit = fits(upper);
      if (fit)
        for (let step = 0; step < 11; step++) {
          const middle = (lower + upper) / 2;
          if (fits(middle)) upper = middle;
          else lower = middle;
        }
      at(Math.min(maxDistance, upper * 1.025));
      const playerProjection = projectBox(projection, player);
      const landmarkProjection = landmarkBounds
        ? projectBox(projection, landmarkBounds)
        : null;
      const pixels = (playerProjection.bottom - playerProjection.top) * height;
      const score =
        query.intersects(projection.position) * 5000 +
        Number(query.blocked(projection.position, facade, landmark?.object)) *
          300 +
        frameOverflow(playerProjection, region) * 5000 +
        (landmarkProjection ? frameOverflow(landmarkProjection, region) : 0) *
          1000 +
        Math.max(0, minimumPixels - pixels) * 20 +
        Math.abs(angle) * 0.7 +
        Math.abs(elevation - 0.3) +
        upper * 0.025;
      if (score < bestScore) {
        bestScore = score;
        best.copy(projection.position);
        bestFit = fit;
      }
    }
  return {
    position: best,
    target,
    blocked: query.intersects(best),
    intersects,
    landmarkBounds,
    playerBounds: player,
    region,
    fits: bestFit,
  };
}

/** 全局视图只拟合小镇地标，给实际界面区域留白，不把远山和地形算进缩放。 */
export function planOverviewCamera(
  camera: THREE.PerspectiveCamera,
  landmarks: readonly FramingLandmark[],
  width: number,
  height: number,
  decisionOpen: boolean,
) {
  const bounds = new THREE.Box3();
  for (const landmark of landmarks)
    bounds.union(visibleBounds(landmark.object));
  if (bounds.isEmpty()) {
    bounds.min.set(-30, 0, -22);
    bounds.max.set(30, 10, 25);
  }
  bounds.expandByScalar(1.2);
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(33, 35, 44).normalize();
  const region = cameraFrameRegion(width, height, decisionOpen);
  const projection = camera.clone();
  const place = (distance: number) => {
    projection.position.copy(target).addScaledVector(direction, distance);
    projection.lookAt(target);
    projection.updateMatrixWorld(true);
  };
  let low = 24;
  let high = 240;
  for (let step = 0; step < 14; step++) {
    const distance = (low + high) / 2;
    place(distance);
    if (isInFrame(projectBox(projection, bounds), region)) high = distance;
    else low = distance;
  }
  place(Math.min(240, high * 1.02));
  return { position: projection.position.clone(), target };
}

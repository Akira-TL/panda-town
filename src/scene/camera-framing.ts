import * as THREE from "three";

export interface FrameRegion {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  inDepth: boolean;
}
export interface FramingLandmark {
  id: string;
  object: THREE.Object3D;
}

/** 留出顶部HUD和下方交易卡；这里不修改canvas或世界坐标。 */
export function cameraFrameRegion(
  width: number,
  height: number,
  decisionOpen: boolean,
): FrameRegion {
  // 与trading.css的短横屏侧栏断点和min(550px,55vw)/8px右间距一致。
  if (decisionOpen && width > height && height <= 600) {
    const panelWidth = Math.min(550, width * 0.55);
    return {
      left: Math.max(0.02, 12 / width),
      right: (width - panelWidth - 8 - 12) / width,
      top: Math.min(0.45, 96 / height),
      bottom: Math.max(0.65, (height - 72) / height),
    };
  }
  return {
    left: width / height < 0.8 ? 0.07 : 0.05,
    right: width / height < 0.8 ? 0.93 : 0.95,
    top: Math.min(0.23, Math.max(0.12, 110 / Math.max(1, height))),
    bottom: decisionOpen ? 0.46 : 0.9,
  };
}
export function visibleBounds(
  root: THREE.Object3D,
  result = new THREE.Box3(),
): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  result.makeEmpty();
  const box = new THREE.Box3();
  root.traverseVisible((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node instanceof THREE.SkinnedMesh) {
      if (!node.boundingBox) node.computeBoundingBox();
      if (node.boundingBox) box.copy(node.boundingBox);
    } else {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if (!node.geometry.boundingBox) return;
      box.copy(node.geometry.boundingBox);
    }
    result.union(box.applyMatrix4(node.matrixWorld));
  });
  return result;
}
export function boxCorners(box: THREE.Box3): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        points.push(new THREE.Vector3(x, y, z));
  return points;
}
export function projectBox(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
): ScreenBounds {
  if (box.isEmpty())
    return { left: 0, right: 0, top: 0, bottom: 0, inDepth: false };
  const result = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
    inDepth: !box.isEmpty(),
  };
  for (const point of boxCorners(box)) {
    point.project(camera);
    result.left = Math.min(result.left, (point.x + 1) / 2);
    result.right = Math.max(result.right, (point.x + 1) / 2);
    result.top = Math.min(result.top, (1 - point.y) / 2);
    result.bottom = Math.max(result.bottom, (1 - point.y) / 2);
    if (!Number.isFinite(point.z) || point.z < -1 || point.z > 1)
      result.inDepth = false;
  }
  return result;
}
export function frameOverflow(
  bounds: ScreenBounds,
  region: FrameRegion,
): number {
  if (!bounds.inDepth) return 10;
  return (
    Math.max(0, region.left - bounds.left) +
    Math.max(0, bounds.right - region.right) +
    Math.max(0, region.top - bounds.top) +
    Math.max(0, bounds.bottom - region.bottom)
  );
}
export function isInFrame(bounds: ScreenBounds, region: FrameRegion): boolean {
  return frameOverflow(bounds, region) < 1e-6;
}
export function chooseNearbyLandmark(
  player: THREE.Vector3,
  landmarks: readonly FramingLandmark[],
  preferred: string,
): FramingLandmark | null {
  let best: FramingLandmark | null = null,
    distance = Infinity;
  for (const landmark of landmarks) {
    const box = visibleBounds(landmark.object);
    if (box.isEmpty()) continue;
    const next = box.distanceToPoint(player);
    if (landmark.id === preferred && next <= 7) return landmark;
    if (next < distance) {
      distance = next;
      best = landmark;
    }
  }
  return best;
}
/** 手动环绕时平移相机和注视点，保留用户选定的角度和缩放。 */
export function translateOrbit(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  movement: THREE.Vector3,
): void {
  camera.position.add(movement);
  target.add(movement);
}

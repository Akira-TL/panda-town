import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createDecisionFraming } from "./decision-framing";
import { planFollowCamera } from "./follow-camera";
import {
  cameraFrameRegion,
  chooseNearbyLandmark,
  isInFrame,
  projectBox,
  translateOrbit,
  visibleBounds,
} from "./camera-framing";
import { createTownCameraRig } from "./camera-rig";

function house(x = 0) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 4),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(x, 3, -5);
  return object;
}
function player() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.1, 1.2),
    new THREE.MeshBasicMaterial(),
  );
  body.position.y = 1.05;
  root.add(body);
  return root;
}
function near(actual: number, expected: number) {
  // BufferGeometry顶点采用Float32，几何尺寸允许微米级舍入。
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
}

test("自动取景在桌面/手机给主角和实际门面留出顶部HUD与半屏主卡，距离有限", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    const camera = new THREE.PerspectiveCamera(43, width! / height!, 0.2, 180);
    const region = cameraFrameRegion(width!, height!, true);
    createDecisionFraming(camera)(
      width!,
      height!,
      true,
      (region.top + region.bottom) / 2,
      (region.left + region.right) / 2,
    );
    const avatar = player(),
      landmark = house();
    const before = landmark.position.clone();
    const playerBox = visibleBounds(avatar);
    const plan = planFollowCamera(
      avatar.position,
      [landmark],
      new THREE.Vector3(1, 0, 0),
      {
        camera,
        width,
        height,
        decisionOpen: true,
        playerBounds: playerBox,
        landmark: { id: "bakery", object: landmark },
      },
    );
    camera.position.copy(plan.position);
    camera.lookAt(plan.target);
    camera.updateMatrixWorld(true);
    assert.ok(
      isInFrame(projectBox(camera, playerBox), region),
      `主角未入画 ${width}`,
    );
    assert.ok(
      isInFrame(projectBox(camera, visibleBounds(landmark)), region),
      `门面未入画 ${width}`,
    );
    assert.equal(plan.intersects(camera.position), 0);
    assert.ok(camera.position.distanceTo(plan.target) <= 48.001);
    assert.ok(
      (projectBox(camera, playerBox).bottom -
        projectBox(camera, playerBox).top) *
        height! >=
        44,
    );
    assert.ok(landmark.position.equals(before));
    assert.ok(avatar.position.equals(new THREE.Vector3()));
  }
});

test("844×390的主角与门面测试几何投影在右栏左边，顶部和左下导航均留空", () => {
  const camera = new THREE.PerspectiveCamera(43, 844 / 390, 0.2, 180);
  const region = cameraFrameRegion(844, 390, true);
  const panelLeft = 844 - Math.min(550, 844 * 0.55) - 8;
  near(region.right * 844, panelLeft - 12);
  assert.ok(region.top * 390 >= 96 && region.bottom * 390 <= 318.001);
  createDecisionFraming(camera)(
    844,
    390,
    true,
    (region.top + region.bottom) / 2,
    (region.left + region.right) / 2,
  );
  const avatar = player(),
    landmark = house();
  const bounds = visibleBounds(avatar);
  const plan = planFollowCamera(
    avatar.position,
    [landmark],
    new THREE.Vector3(1, 0, 0),
    {
      camera,
      width: 844,
      height: 390,
      decisionOpen: true,
      playerBounds: bounds,
      landmark: { id: "bakery", object: landmark },
    },
  );
  camera.position.copy(plan.position);
  camera.lookAt(plan.target);
  camera.updateMatrixWorld(true);
  for (const box of [bounds, visibleBounds(landmark)]) {
    const projected = projectBox(camera, box);
    assert.ok(isInFrame(projected, region));
    assert.ok(projected.right * 844 < panelLeft);
  }
  assert.ok(
    (projectBox(camera, bounds).bottom - projectBox(camera, bounds).top) *
      390 >=
      44,
  );
  assert.ok(camera.position.distanceTo(plan.target) <= 48);
});

test("研究站真实模型包围盒在390/844视口完整入画，距离不超48且主角保持可辨", () => {
  // 来自正式-v2 GLB按TownScene归一/placement后的静态几何，不取浏览器标记作为期望。
  for (const [width, height, min, max] of [
    [390, 844, [3.389638, 4.75, -22.803032], [13.337305, 10.95, -13.438678]],
    [844, 390, [3.374354, 4.75, -22.883594], [13.386515, 10.95, -13.431624]],
  ] as const) {
    const bounds = new THREE.Box3(
      new THREE.Vector3(...min),
      new THREE.Vector3(...max),
    );
    const size = bounds.getSize(new THREE.Vector3());
    const landmark = new THREE.Group();
    landmark.rotation.y = Math.atan2(-6, 13);
    const envelope = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial(),
    );
    // 世界AABB保持正式模型的实际包围盒，门面方向同时保持placement的方向。
    envelope.rotation.y = -landmark.rotation.y;
    envelope.position
      .copy(bounds.getCenter(new THREE.Vector3()))
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -landmark.rotation.y);
    landmark.add(envelope);
    const focus = new THREE.Vector3(6, 4.8, -13);
    const avatarBounds = new THREE.Box3(
      new THREE.Vector3(4.847769, 4.8, -14.085917),
      new THREE.Vector3(7.152231, 6.9, -11.914083),
    );
    const camera = new THREE.PerspectiveCamera(43, width / height, 0.2, 180);
    const region = cameraFrameRegion(width, height, true);
    createDecisionFraming(camera)(
      width,
      height,
      true,
      (region.top + region.bottom) / 2,
      (region.left + region.right) / 2,
    );
    const plan = planFollowCamera(focus, [], new THREE.Vector3(5, -3.8, 8), {
      camera,
      width,
      height,
      decisionOpen: true,
      playerBounds: avatarBounds,
      landmark: { id: "research", object: landmark },
    });
    camera.position.copy(plan.position);
    camera.lookAt(plan.target);
    camera.updateMatrixWorld(true);
    assert.ok(
      isInFrame(projectBox(camera, avatarBounds), region),
      `${width}主角越界`,
    );
    assert.ok(
      isInFrame(projectBox(camera, visibleBounds(landmark)), region),
      `${width}门面越界`,
    );
    const projected = projectBox(camera, avatarBounds);
    assert.ok(
      (projected.bottom - projected.top) * height >= (height < 720 ? 44 : 60),
    );
    assert.ok(camera.position.distanceTo(plan.target) <= 48.001);
  }
});

test("选择邻近实际地标，不因指定商店在地图另一端就把取景拉远", () => {
  const nearHouse = house(),
    distant = house(60);
  const selected = chooseNearbyLandmark(
    new THREE.Vector3(),
    [
      { id: "house:near", object: nearHouse },
      { id: "research", object: distant },
    ],
    "research",
  );
  assert.equal(selected?.id, "house:near");
});

test("实际三角形射线保留门洞；封住洞口后报告真实遮挡且恢复材质side", () => {
  const obstacle = new THREE.Group(),
    materials: THREE.MeshBasicMaterial[] = [];
  for (const x of [-1.5, 1.5]) {
    const material = new THREE.MeshBasicMaterial();
    materials.push(material);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
    wall.position.set(x, 1, 0);
    obstacle.add(wall);
  }
  const focus = new THREE.Vector3(),
    view = new THREE.Vector3(0, 1, 6);
  const open = planFollowCamera(focus, [obstacle], new THREE.Vector3(0, 0, -1));
  assert.equal(open.intersects(view), 0);
  const center = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2, 1),
    new THREE.MeshBasicMaterial(),
  );
  center.position.y = 1;
  obstacle.add(center);
  const closed = planFollowCamera(
    focus,
    [obstacle],
    new THREE.Vector3(0, 0, -1),
  );
  assert.ok(closed.intersects(view) > 0);
  assert.ok(materials.every((material) => material.side === THREE.FrontSide));
});

test("不可见的大物件不扩大实际取景包围盒；空盒和镜头背后不算入画", () => {
  const root = player(),
    hidden = house(100);
  hidden.visible = false;
  root.add(hidden);
  const box = visibleBounds(root);
  near(box.max.y, 2.1);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 180);
  camera.position.set(0, 1, 6);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const region = cameraFrameRegion(900, 900, false);
  assert.equal(isInFrame(projectBox(camera, new THREE.Box3()), region), false);
  assert.equal(
    isInFrame(
      projectBox(
        camera,
        new THREE.Box3(
          new THREE.Vector3(-1, 0, 8),
          new THREE.Vector3(1, 2, 10),
        ),
      ),
      region,
    ),
    false,
  );
});

test("手动环绕同时平移相机与注视点，角度和缩放不变", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(5, 8, 12);
  const target = new THREE.Vector3(1, 2, 3),
    offset = camera.position.clone().sub(target);
  translateOrbit(camera, target, new THREE.Vector3(2, 1, -4));
  assert.ok(camera.position.equals(new THREE.Vector3(7, 9, 8)));
  assert.ok(target.equals(new THREE.Vector3(3, 3, -1)));
  assert.ok(camera.position.clone().sub(target).equals(offset));
});

test("真实OrbitControls的手动旋转/缩放不被100帧自动规划覆盖，移动保留角度，resetKey恢复自动", () => {
  const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 180);
  camera.position.set(0, 9, 20);
  const controls = new OrbitControls(camera);
  const host = { dataset: {} } as HTMLElement;
  const avatar = player(),
    landmark = house();
  const rig = createTownCameraRig(
    camera,
    controls,
    host,
    [{ id: "bakery", object: landmark }],
    [],
    () => 0,
  );
  const state = {
    playerLocation: "bakery" as const,
    cameraMode: "follow" as const,
    decisionOpen: true,
    reducedMotion: true,
    cameraResetKey: 0,
  };
  rig.resize(1440, 900);
  rig.update(avatar, state, 0, 1 / 60, 1);
  const automatic = camera.position.clone();
  controls.dispatchEvent({ type: "start" });
  controls.rotateLeft(0.55);
  controls.dollyIn(1.15);
  rig.update(avatar, state, 16, 1 / 60, 1);
  const chosen = camera.position.clone(),
    chosenTarget = controls.target.clone();
  assert.ok(chosen.distanceTo(automatic) > 1);
  for (let frame = 1; frame <= 100; frame++)
    rig.update(avatar, state, 16 + frame * 16, 1 / 60, 1);
  assert.ok(camera.position.distanceTo(chosen) < 1e-8);
  assert.equal(host.dataset.manualOrbit, "true");
  const move = new THREE.Vector3(2, 0, 1);
  avatar.position.add(move);
  rig.update(avatar, state, 2000, 1 / 60, 1);
  assert.ok(camera.position.distanceTo(chosen.clone().add(move)) < 1e-8);
  assert.ok(controls.target.distanceTo(chosenTarget.clone().add(move)) < 1e-8);
  rig.update(avatar, { ...state, cameraResetKey: 1 }, 2100, 1 / 60, 1);
  assert.equal(host.dataset.manualOrbit, "false");
  assert.ok(camera.position.distanceTo(chosen.clone().add(move)) > 0.1);
  rig.update(avatar, { ...state, cameraMode: "overview" }, 2200, 1 / 60, 1);
  const overview = camera.position.clone();
  controls.dispatchEvent({ type: "start" });
  controls.rotateLeft(0.2);
  rig.update(avatar, { ...state, cameraMode: "overview" }, 2300, 1 / 60, 1);
  assert.ok(camera.position.distanceTo(overview) > 1);
  assert.equal(controls.enabled, true);
  rig.dispose();
});

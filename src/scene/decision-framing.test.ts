import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import { createDecisionFraming } from "./decision-framing";

function screenHeightFraction(camera: PerspectiveCamera): number {
  camera.updateMatrixWorld();
  return (1 - new Vector3(0, 0, -10).project(camera).y) / 2;
}

test("决策时注视点位于画面顶部35%，相机世界位置不变", () => {
  const camera = new PerspectiveCamera(43, 1, 0.2, 180);
  const update = createDecisionFraming(camera);
  const position = camera.position.clone();
  update(1440, 900, true);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.35) < 1e-12);
  assert.ok(camera.position.equals(position));
  update(390, 844, true);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.35) < 1e-12);
  assert.equal(camera.aspect, 390 / 844);
});

test("关闭决策或全局模式清除投影偏移并保持当前宽高比", () => {
  const camera = new PerspectiveCamera(43, 1, 0.2, 180);
  const update = createDecisionFraming(camera);
  update(1440, 900, true);
  update(390, 844, false);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.5) < 1e-12);
  assert.equal(camera.view?.enabled, false);
  assert.equal(camera.aspect, 390 / 844);
});

test("状态与尺寸未变时不重复更新投影，尺寸或决策改变才更新", () => {
  const camera = new PerspectiveCamera(43, 1, 0.2, 180);
  const update = createDecisionFraming(camera);
  let updates = 0;
  const original = camera.updateProjectionMatrix.bind(camera);
  camera.updateProjectionMatrix = () => {
    updates += 1;
    original();
  };
  update(1440, 900, true);
  for (let frame = 0; frame < 100; frame += 1) update(1440, 900, true);
  assert.equal(updates, 1);
  update(390, 844, true);
  update(390, 844, false);
  assert.equal(updates, 3);
});

test("自动构图可将注视点设为实际可用区域中点，关闭后仍归零", () => {
  const camera = new PerspectiveCamera(43, 1, 0.2, 180);
  const update = createDecisionFraming(camera);
  update(390, 844, true, 0.31);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.31) < 1e-12);
  update(390, 844, true, 0.33);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.33) < 1e-12);
  update(390, 844, false, 0.33);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.5) < 1e-12);
});

test("短横屏可把注视点横移到左侧，横向参数改变会更新投影，关闭恢复中线", () => {
  const camera = new PerspectiveCamera(43, 844 / 390, 0.2, 180);
  const update = createDecisionFraming(camera);
  const point = new Vector3(0, 0, -10);
  update(844, 390, true, 0.53, 0.22);
  camera.updateMatrixWorld(true);
  assert.ok(Math.abs((point.clone().project(camera).x + 1) / 2 - 0.22) < 1e-12);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.53) < 1e-12);
  update(844, 390, true, 0.53, 0.24);
  assert.ok(Math.abs((point.clone().project(camera).x + 1) / 2 - 0.24) < 1e-12);
  update(844, 390, false);
  assert.ok(Math.abs((point.clone().project(camera).x + 1) / 2 - 0.5) < 1e-12);
  assert.ok(Math.abs(screenHeightFraction(camera) - 0.5) < 1e-12);
});

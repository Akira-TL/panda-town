import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LOCATIONS, type LocationId } from "../game/content";
import { LOCATION_POSITIONS } from "./geometry";
import { createDecisionFraming } from "./decision-framing";
import { planFollowCamera, planOverviewCamera } from "./follow-camera";
import {
  cameraFrameRegion,
  chooseNearbyLandmark,
  isInFrame,
  projectBox,
  translateOrbit,
  visibleBounds,
  type FramingLandmark,
} from "./camera-framing";

export interface CameraRigState {
  playerLocation: LocationId;
  cameraMode: "follow" | "overview";
  decisionOpen?: boolean;
  cameraResetKey?: number;
  reducedMotion: boolean;
}
type FollowPlan = ReturnType<typeof planFollowCamera>;

export function createTownCameraRig(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  host: HTMLElement,
  landmarks: readonly FramingLandmark[],
  obstacles: readonly THREE.Object3D[],
  heightAt: (x: number, z: number) => number,
) {
  let width = 1,
    height = 1,
    resized = true;
  let mode: CameraRigState["cameraMode"] | null = null;
  let resetKey = 0,
    manual = false,
    dragging = false,
    returnPending = false;
  let interactionEndedAt = -Infinity,
    assetChangedAt = -Infinity;
  let observedRevision = -1,
    plannedRevision = -1;
  let shotLocation: LocationId | null = null;
  let plan: FollowPlan | null = null;
  let landmark: FramingLandmark | null = null;
  let overview: ReturnType<typeof planOverviewCamera> | null = null;
  let initialized = false,
    hasPrevious = false,
    bodyHeight = 1.2;
  let lastDiagnostics = -Infinity,
    lastOcclusion = -Infinity;
  let obstruction = 0,
    lift = 0;
  const shots = new Map<
    LocationId,
    { plan: FollowPlan; landmark: FramingLandmark | null }
  >();
  const previousPlayer = new THREE.Vector3(),
    movement = new THREE.Vector3();
  const boundsOrigin = new THREE.Vector3(),
    boundsMovement = new THREE.Vector3();
  const playerBox = new THREE.Box3(),
    fallbackSize = new THREE.Vector3(1.3, 2.4, 1.3);
  const hero = new THREE.Vector3(),
    offset = new THREE.Vector3(),
    desiredOffset = new THREE.Vector3();
  const followOffset = new THREE.Vector3(0, 9, 14);
  const fromOrbit = new THREE.Spherical(),
    toOrbit = new THREE.Spherical();
  const framing = createDecisionFraming(camera);
  camera.far = 400;
  camera.updateProjectionMatrix();
  controls.enabled = true;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 4;
  controls.maxDistance = 72;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.48;

  const manualStart = () => {
    manual = true;
    dragging = true;
    returnPending = false;
  };
  const manualEnd = () => {
    dragging = false;
    interactionEndedAt = performance.now();
  };
  controls.addEventListener("start", manualStart);
  controls.addEventListener("end", manualEnd);

  function measurePlayer(player: THREE.Object3D) {
    visibleBounds(player, playerBox);
    if (playerBox.isEmpty()) {
      hero.copy(player.position).y += bodyHeight;
      playerBox.setFromCenterAndSize(hero, fallbackSize);
    } else {
      bodyHeight = playerBox.getCenter(hero).y - player.position.y;
    }
    boundsOrigin.copy(player.position);
  }

  function settleOrbit(delta: number, snap: boolean) {
    desiredOffset.copy(followOffset);
    desiredOffset.y += lift;
    if (snap) {
      controls.target.copy(hero);
      camera.position.copy(hero).add(desiredOffset);
      return;
    }
    // 绕主角沿最短角度过渡，限制每秒转角；不沿穿过房屋的直线跳到新机位。
    offset.copy(camera.position).sub(controls.target);
    fromOrbit.setFromVector3(offset);
    toOrbit.setFromVector3(desiredOffset);
    const rate = 1 - Math.exp(-delta * 3);
    const angle =
      THREE.MathUtils.euclideanModulo(
        toOrbit.theta - fromOrbit.theta + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    const maxAngle = delta * 0.7;
    fromOrbit.theta += THREE.MathUtils.clamp(angle * rate, -maxAngle, maxAngle);
    fromOrbit.phi += THREE.MathUtils.clamp(
      (toOrbit.phi - fromOrbit.phi) * rate,
      -maxAngle,
      maxAngle,
    );
    const maxZoom = Math.max(10, fromOrbit.radius * 1.5) * delta;
    fromOrbit.radius += THREE.MathUtils.clamp(
      (toOrbit.radius - fromOrbit.radius) * rate,
      -maxZoom,
      maxZoom,
    );
    fromOrbit.makeSafe();
    controls.target.lerp(hero, rate);
    camera.position
      .copy(controls.target)
      .add(offset.setFromSpherical(fromOrbit));
  }

  return {
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      resized = true;
    },
    update(
      player: THREE.Object3D,
      state: CameraRigState,
      time: number,
      delta: number,
      revision: number,
      walking = false,
    ) {
      const firstFrame = !initialized;
      const changed =
        mode !== state.cameraMode || resetKey !== (state.cameraResetKey ?? 0);
      if (changed) {
        manual = false;
        dragging = false;
        returnPending = false;
        mode = state.cameraMode;
        resetKey = state.cameraResetKey ?? 0;
        controls.maxDistance = mode === "overview" ? 260 : 72;
      }
      if (revision !== observedRevision) {
        observedRevision = revision;
        assetChangedAt = time;
      }
      // 行走和弹窗使用同一留白，避免每次面板开关都把画面上下猛推。
      const region = cameraFrameRegion(width, height, true);
      framing(
        width,
        height,
        true,
        (region.top + region.bottom) / 2,
        (region.left + region.right) / 2,
      );
      movement.copy(player.position);
      if (hasPrevious) movement.sub(previousPlayer);
      else movement.set(0, 0, 0);
      if (state.cameraMode === "follow" && hasPrevious) {
        translateOrbit(camera, controls.target, movement);
      }
      if (manual && (walking || movement.lengthSq() > 0.000001))
        returnPending = true;
      if (
        state.cameraMode === "follow" &&
        manual &&
        returnPending &&
        !dragging &&
        time - interactionEndedAt > 750
      ) {
        manual = false;
        returnPending = false;
      }
      const assetsSettled =
        revision !== plannedRevision && time - assetChangedAt > 300;
      const atStop = !walking && !!state.decisionOpen;
      const approachingStop =
        walking &&
        !!state.decisionOpen &&
        shotLocation !== state.playerLocation;
      const needsPlan =
        !plan ||
        resized ||
        approachingStop ||
        (!walking && assetsSettled) ||
        (atStop && shotLocation !== state.playerLocation);
      if (needsPlan) {
        if (resized || assetsSettled) {
          shots.clear();
          overview = null;
        }
        measurePlayer(player);
        const cached = shots.get(state.playerLocation);
        let nextPlan = cached?.plan;
        if (cached) landmark = cached.landmark;
        if (!nextPlan) {
          const focus = approachingStop
            ? new THREE.Vector3(...LOCATION_POSITIONS[state.playerLocation])
            : player.position;
          const plannedBounds = playerBox
            .clone()
            .translate(boundsMovement.copy(focus).sub(player.position));
          const preferred = landmarks.some(
            (item) => item.id === state.playerLocation,
          )
            ? state.playerLocation
            : `outdoor:${state.playerLocation}`;
          landmark = chooseNearbyLandmark(focus, landmarks, preferred);
          const next = LOCATIONS.find(
            (item) => item.id === state.playerLocation,
          )!.next[0]!;
          const forward = new THREE.Vector3(...LOCATION_POSITIONS[next]).sub(
            focus,
          );
          nextPlan = planFollowCamera(focus, obstacles, forward, {
            camera,
            playerBounds: plannedBounds,
            landmark,
            width,
            height,
            decisionOpen: true,
          });
          shots.set(state.playerLocation, { plan: nextPlan, landmark });
        }
        plan = nextPlan;
        followOffset.copy(plan.position).sub(plan.target);
        shotLocation = state.playerLocation;
        plannedRevision = revision;
        lastOcclusion = -Infinity;
      } else {
        boundsMovement.copy(player.position).sub(boundsOrigin);
        playerBox.translate(boundsMovement);
        boundsOrigin.copy(player.position);
      }
      hero.set(
        player.position.x,
        player.position.y + bodyHeight,
        player.position.z,
      );
      controls.enablePan = state.cameraMode === "overview";
      controls.enableDamping = false;
      if (manual) {
        controls.update(delta);
      } else if (state.cameraMode === "follow") {
        settleOrbit(delta, firstFrame || state.reducedMotion);
      } else {
        overview ??= planOverviewCamera(camera, landmarks, width, height, true);
        const rate =
          firstFrame || state.reducedMotion ? 1 : 1 - Math.exp(-delta * 3);
        camera.position.lerp(overview.position, rate);
        controls.target.lerp(overview.target, rate);
      }
      const floor = heightAt(camera.position.x, camera.position.z);
      if (Number.isFinite(floor) && camera.position.y < floor + 0.8) {
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          floor + 0.8,
          8,
          delta,
        );
      }
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      // 重型三角形遮挡检查最多每200毫秒一次，绝不再用结果瞬移相机。
      if (
        atStop &&
        state.cameraMode === "follow" &&
        time - lastOcclusion >= 200
      ) {
        obstruction = plan!.intersects(camera.position);
        lastOcclusion = time;
      }
      const desiredLift =
        state.cameraMode === "follow" && obstruction > 0
          ? Math.min(5, obstruction * 0.8)
          : 0;
      lift = THREE.MathUtils.damp(lift, desiredLift, 3, delta);
      if (time - lastDiagnostics >= 200 || firstFrame || changed) {
        const playerScreen = projectBox(camera, playerBox);
        const playerInFrame = isInFrame(playerScreen, region);
        host.dataset.manualOrbit = String(manual);
        host.dataset.cameraPosition = JSON.stringify(
          camera.position.toArray().map((value) => Number(value.toFixed(3))),
        );
        host.dataset.cameraTarget = JSON.stringify(
          controls.target.toArray().map((value) => Number(value.toFixed(3))),
        );
        host.dataset.focusLandmark = landmark?.id ?? "";
        host.dataset.cameraObstructed = String(obstruction);
        host.dataset.playerInFrame = String(playerInFrame);
        host.dataset.playerVisible = String(playerInFrame && obstruction === 0);
        host.dataset.playerPixelHeight = (
          (playerScreen.bottom - playerScreen.top) *
          height
        ).toFixed(1);
        host.dataset.frameLandmark = String(
          !!plan?.landmarkBounds &&
            isInFrame(projectBox(camera, plan.landmarkBounds), region),
        );
        host.dataset.cameraUsableRegion = JSON.stringify([
          region.left,
          region.top,
          region.right,
          region.bottom,
        ]);
        lastDiagnostics = time;
      }
      previousPlayer.copy(player.position);
      hasPrevious = true;
      initialized = true;
      resized = false;
    },
    dispose() {
      controls.removeEventListener("start", manualStart);
      controls.removeEventListener("end", manualEnd);
      shots.clear();
    },
  };
}

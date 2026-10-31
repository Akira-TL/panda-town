import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

/** 开张后出现的迎宾熊猫；派生同一生成资产，单独骨骼与围裙。 */
export function createCafeWelcome(
  source: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
) {
  const group = new THREE.Group();
  group.name = "CafeWelcomeResident";
  group.visible = false;
  const body = clone(source);
  body.scale.multiplyScalar(0.8);
  group.add(body);
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 0.07),
    new THREE.MeshStandardMaterial({ color: "#668b75", roughness: 0.95 }),
  );
  apron.position.set(0, 0.76, 0.48);
  apron.castShadow = apron.receiveShadow = true;
  group.add(apron);
  const mixer = new THREE.AnimationMixer(body);
  const idle = clips.find((clip) => /idle/i.test(clip.name));
  if (idle) mixer.clipAction(idle).play();
  let upper: THREE.Bone | null = null;
  body.traverse((node) => {
    if (node instanceof THREE.Bone && /^UpperArm[._]?L$/.test(node.name))
      upper = node;
  });
  const arm = upper as THREE.Bone | null;
  const base = arm?.quaternion.clone();
  const greeting = new THREE.Quaternion();
  let time = 0;
  return {
    group,
    fit(bounds: THREE.Box3) {
      group.position.set(1.85, Math.max(0, bounds.min.y), bounds.max.z + 0.6);
    },
    update(opened: boolean, delta: number, reduced: boolean) {
      group.visible = opened;
      if (!opened) return;
      mixer.timeScale = reduced ? 0 : 1;
      mixer.update(delta);
      if (!reduced) time += delta;
      if (arm && base) {
        greeting.setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -0.6 + (reduced ? 0 : Math.sin(time * 2.4) * 0.18),
        );
        arm.quaternion.copy(base).multiply(greeting);
      }
    },
    dispose() {
      mixer.stopAllAction();
    },
  };
}

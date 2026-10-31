import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { LocationId } from "../game/content";
import { LOCATION_POSITIONS } from "./geometry";

export interface ResidentState {
  playerLocation: LocationId;
  reducedMotion: boolean;
}
interface Resident {
  location: LocationId;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
}
function cloth(
  geometry: THREE.BufferGeometry,
  color: string,
  y: number,
  z = 0,
): THREE.Mesh {
  const item = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );
  item.position.set(0, y, z);
  item.castShadow = item.receiveShadow = true;
  return item;
}

/** 居民派生于已生成的熊猫网格/骨骼；帽子围裙为项目自建，不冒充独立生成模型。 */
export function createResidents(
  source: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
) {
  const group = new THREE.Group();
  group.name = "TownResidents";
  const residents: Resident[] = [];
  const locations: readonly LocationId[] = [
    "bakery",
    "grocery",
    "market",
    "research",
    "bank",
    "gifts",
    "rival",
  ];
  const colors = [
    "#d8c39d",
    "#91a779",
    "#c5a467",
    "#72979c",
    "#7f8490",
    "#b78eaa",
    "#b27c58",
  ];
  locations.forEach((location, index) => {
    const root = new THREE.Group();
    root.name = `Resident:${location}`;
    const body = clone(source);
    body.scale.multiplyScalar(0.82);
    root.add(body);
    const apron = cloth(
      new THREE.BoxGeometry(0.64, 0.62, 0.07),
      colors[index]!,
      0.76,
      0.47,
    );
    root.add(apron);
    const hat = new THREE.Group();
    hat.add(
      cloth(
        new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16),
        colors[index]!,
        1.69,
      ),
    );
    hat.add(
      cloth(
        new THREE.CylinderGeometry(0.27, 0.3, index === 0 ? 0.3 : 0.16, 14),
        index === 0 ? "#f6efda" : colors[index]!,
        1.8,
      ),
    );
    root.add(hat);
    const [x, y, z] = LOCATION_POSITIONS[location];
    root.position.set(x + 1.6, y, z + 0.3);
    root.rotation.y = Math.atan2(-x, -z);
    const mixer = new THREE.AnimationMixer(body);
    const idle = clips.find((clip) => /idle/i.test(clip.name));
    if (idle) {
      const action = mixer.clipAction(idle);
      action.play();
      action.time = index * 0.19;
    }
    residents.push({ location, root, mixer });
    group.add(root);
  });
  return {
    group,
    update(delta: number, state: ResidentState) {
      for (const resident of residents) {
        resident.mixer.timeScale = state.reducedMotion ? 0 : 1;
        resident.mixer.update(delta);
        if (state.playerLocation === resident.location) {
          const [x, , z] = LOCATION_POSITIONS[state.playerLocation];
          resident.root.rotation.y = Math.atan2(
            x - resident.root.position.x,
            z - resident.root.position.z,
          );
        }
      }
    },
    dispose() {
      residents.forEach((resident) => resident.mixer.stopAllAction());
    },
  };
}

import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { LocationId } from "../game/content";
import { LOCATION_POSITIONS } from "./geometry";
import type { ResidentState } from "./residents";

interface OutdoorRole {
  location: LocationId;
  name: string;
  color: string;
  tool: "letter" | "wrench" | "flower" | "flute" | "net" | "book" | "map";
}
const roles: readonly OutdoorRole[] = [
  { location: "notice", name: "公告管理员", color: "#6c8a93", tool: "letter" },
  { location: "repair", name: "修理师傅", color: "#b88e59", tool: "wrench" },
  { location: "garden", name: "园丁", color: "#7d9c69", tool: "flower" },
  { location: "music", name: "乐手", color: "#b47d7d", tool: "flute" },
  { location: "dock", name: "码头看护人", color: "#7c9ca8", tool: "net" },
  { location: "riverside", name: "河岸读者", color: "#b59bb5", tool: "book" },
  { location: "square", name: "小镇向导", color: "#bd9f60", tool: "map" },
];

function outfit(role: OutdoorRole): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: role.color,
    roughness: 0.95,
  });
  const pale = new THREE.MeshStandardMaterial({
    color: "#f0e5c7",
    roughness: 0.95,
  });
  function part(
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    light = false,
  ) {
    const mesh = new THREE.Mesh(geometry, light ? pale : material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  part(new THREE.BoxGeometry(0.6, 0.48, 0.08), 0, 0.77, 0.48);
  part(new THREE.CylinderGeometry(0.4, 0.4, 0.045, 16), 0, 1.65, 0);
  part(new THREE.CylinderGeometry(0.27, 0.31, 0.18, 16), 0, 1.76, 0);
  const tool = new THREE.Group();
  tool.name = `RoleTool:${role.tool}`;
  group.add(tool);
  function held(geometry: THREE.BufferGeometry, y: number, light = false) {
    const mesh = part(geometry, 0.52, y, 0.48, light);
    group.remove(mesh);
    tool.add(mesh);
    return mesh;
  }
  switch (role.tool) {
    case "wrench":
      held(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), 0.9, true);
      held(
        new THREE.TorusGeometry(0.09, 0.03, 5, 10, Math.PI * 1.5),
        1.14,
        true,
      );
      break;
    case "flower":
      held(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 8), 0.85);
      held(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), 1.04);
      held(new THREE.SphereGeometry(0.09, 8, 6), 1.18, true);
      break;
    case "flute":
      held(
        new THREE.CylinderGeometry(0.035, 0.035, 0.6, 10),
        1.08,
        true,
      ).rotation.z = 0.65;
      break;
    case "net":
      held(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), 0.95, true);
      held(new THREE.TorusGeometry(0.18, 0.018, 5, 14), 1.42, true);
      for (const offset of [-0.09, 0, 0.09]) {
        const strand = held(
          new THREE.BoxGeometry(0.012, 0.3, 0.012),
          1.42,
          true,
        );
        strand.position.x += offset;
      }
      break;
    default:
      held(
        new THREE.BoxGeometry(0.3, role.tool === "letter" ? 0.22 : 0.34, 0.045),
        0.96,
        true,
      );
      if (role.tool === "book")
        held(new THREE.BoxGeometry(0.025, 0.35, 0.055), 0.96);
  }
  return group;
}

/** 七处户外居民共享生成熊猫资产，独立骨骼和职业服饰，不额外请求高模。 */
export function createOutdoorResidents(
  source: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
  heightAt: (x: number, z: number) => number,
) {
  const group = new THREE.Group();
  group.name = "OutdoorResidents";
  const actors = roles.map((role, index) => {
    const root = new THREE.Group();
    root.name = `OutdoorResident:${role.location}`;
    const body = clone(source);
    body.name = role.name;
    body.scale.multiplyScalar(0.78);
    root.add(body, outfit(role));
    const [x, y, z] = LOCATION_POSITIONS[role.location];
    const radial = new THREE.Vector3(x, 0, z).normalize();
    const side = new THREE.Vector3(-radial.z, 0, radial.x);
    const position = new THREE.Vector3(x, y, z)
      .addScaledVector(radial, 1.65)
      .addScaledVector(side, 1.6);
    if (role.location === "dock") position.set(x + 0.65, y, z + 1.35);
    if (role.location === "riverside") position.set(x - 1.5, y, z + 0.8);
    position.y = heightAt(position.x, position.z) + 0.03;
    root.position.copy(position);
    root.rotation.y = Math.atan2(x - position.x, z - position.z);
    const mixer = new THREE.AnimationMixer(body);
    const idle = clips.find((clip) => /idle/i.test(clip.name));
    if (idle) {
      const action = mixer.clipAction(idle);
      action.play();
      action.time = index * 0.23;
    }
    group.add(root);
    return { role, root, mixer };
  });
  return {
    group,
    locations: roles.map((role) => role.location),
    update(delta: number, state: ResidentState) {
      const player = new THREE.Vector3(
        ...LOCATION_POSITIONS[state.playerLocation],
      );
      for (const actor of actors) {
        if (actor.root.position.distanceToSquared(player) < 18 ** 2) {
          actor.mixer.timeScale = state.reducedMotion ? 0 : 1;
          actor.mixer.update(delta);
        }
        if (actor.role.location === state.playerLocation)
          actor.root.rotation.y = Math.atan2(
            player.x - actor.root.position.x,
            player.z - actor.root.position.z,
          );
      }
    },
    dispose() {
      actors.forEach((actor) => actor.mixer.stopAllAction());
    },
  };
}

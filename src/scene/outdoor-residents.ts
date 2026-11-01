import * as THREE from "three";
import { LOCATION_POSITIONS } from "./geometry";
import type { ResidentState } from "./residents";
import { createNpcActor, type NpcActorContext } from "./npc-actor";
import { NPC_MODELS } from "./npc-models";

/** 七处户外地点使用清单指定的独立模型，保留原站位与靠近转向。 */
export function createOutdoorResidents(
  context: NpcActorContext,
  heightAt: (x: number, z: number) => number,
) {
  const group = new THREE.Group();
  group.name = "OutdoorResidents";
  const actors = NPC_MODELS.filter((model) => model.kind === "outdoor").map(
    (definition) => {
      const root = new THREE.Group();
      root.name = `OutdoorResident:${definition.location}`;
      root.userData.npcId = definition.id;
      root.userData.location = definition.location;
      const actor = createNpcActor(definition, context);
      root.add(actor.group);
      const [x, y, z] = LOCATION_POSITIONS[definition.location];
      const radial = new THREE.Vector3(x, 0, z).normalize();
      const side = new THREE.Vector3(-radial.z, 0, radial.x);
      const position = new THREE.Vector3(x, y, z)
        .addScaledVector(radial, 1.65)
        .addScaledVector(side, 1.6);
      if (definition.location === "dock") position.set(x + 0.65, y, z + 1.35);
      if (definition.location === "riverside")
        position.set(x - 1.5, y, z + 0.8);
      position.y = heightAt(position.x, position.z) + 0.03;
      root.position.copy(position);
      root.rotation.y = Math.atan2(x - position.x, z - position.z);
      group.add(root);
      return { definition, root, actor };
    },
  );
  const player = new THREE.Vector3();
  return {
    group,
    locations: actors.map(({ definition }) => definition.location),
    update(delta: number, state: ResidentState) {
      player.set(...LOCATION_POSITIONS[state.playerLocation]);
      for (const { definition, root, actor } of actors) {
        if (root.position.distanceToSquared(player) < 18 ** 2)
          actor.update(delta, state.reducedMotion);
        if (definition.location === state.playerLocation)
          root.rotation.y = Math.atan2(
            player.x - root.position.x,
            player.z - root.position.z,
          );
      }
    },
    dispose() {
      actors.forEach(({ actor }) => actor.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}

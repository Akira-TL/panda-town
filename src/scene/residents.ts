import * as THREE from "three";
import type { LocationId } from "../game/content";
import { LOCATION_POSITIONS } from "./geometry";
import { createNpcActor, type NpcActorContext } from "./npc-actor";
import { NPC_MODELS } from "./npc-models";

export interface ResidentState {
  playerLocation: LocationId;
  reducedMotion: boolean;
}

/** 七家店使用各自职业模型；不添加熊猫替身、帽子或围裙。 */
export function createResidents(
  context: NpcActorContext,
  heightAt: (x: number, z: number) => number,
) {
  const group = new THREE.Group();
  group.name = "TownResidents";
  const residents = NPC_MODELS.filter((model) => model.kind === "shop").map(
    (definition) => {
      const root = new THREE.Group();
      root.name = `Resident:${definition.location}`;
      root.userData.npcId = definition.id;
      root.userData.location = definition.location;
      const actor = createNpcActor(definition, context);
      root.add(actor.group);
      const [x, , z] = LOCATION_POSITIONS[definition.location];
      root.position.set(x + 1.6, heightAt(x + 1.6, z + 0.3), z + 0.3);
      root.rotation.y = Math.atan2(-x, -z);
      group.add(root);
      return { definition, root, actor };
    },
  );
  return {
    group,
    update(delta: number, state: ResidentState) {
      for (const resident of residents) {
        resident.actor.update(delta, state.reducedMotion);
        if (state.playerLocation === resident.definition.location) {
          const [x, , z] = LOCATION_POSITIONS[state.playerLocation];
          resident.root.rotation.y = Math.atan2(
            x - resident.root.position.x,
            z - resident.root.position.z,
          );
        }
      }
    },
    dispose() {
      residents.forEach(({ actor }) => actor.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}

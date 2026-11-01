import * as THREE from "three";
import { createNpcActor, type NpcActorContext } from "./npc-actor";
import { getNpcModel } from "./npc-models";

/** 茶馆迎宾为清单指定的猫茶师，仅使用模型自身待机动画。 */
export function createCafeWelcome(context: NpcActorContext) {
  const definition = getNpcModel("cafe");
  const actor = createNpcActor(definition, context);
  const group = new THREE.Group();
  group.name = "CafeWelcomeResident";
  group.userData.npcId = definition.id;
  group.userData.location = definition.location;
  group.visible = false;
  group.add(actor.group);
  return {
    group,
    fit(bounds: THREE.Box3) {
      const floor = Number.isFinite(bounds.min.y)
        ? Math.max(0, bounds.min.y)
        : 0;
      const front = Number.isFinite(bounds.max.z) ? bounds.max.z : 0;
      group.position.set(1.85, floor, front + 0.6);
    },
    update(opened: boolean, delta: number, reduced: boolean) {
      group.visible = opened;
      if (opened) actor.update(delta, reduced);
    },
    dispose() {
      actor.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}

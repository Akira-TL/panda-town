import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SurfaceTextures } from "./architecture";
import { LOCATION_POSITIONS } from "./geometry";
import { groundHeight } from "./landscape";

export interface SceneInventoryState {
  purchasedItems?: readonly string[];
  toolQuality?: "used" | "premium" | null;
  toolPending?: boolean;
  opponentStallOwned?: boolean;
}
function part(
  geometry: THREE.BufferGeometry,
  color: string,
  texture?: THREE.Texture,
) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      map: texture ?? null,
      roughness: 0.85,
    }),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function gift(color: string, surfaces: SurfaceTextures) {
  const group = new THREE.Group();
  group.add(
    part(
      new RoundedBoxGeometry(0.36, 0.3, 0.28, 2, 0.035),
      color,
      surfaces.canvas,
    ),
  );
  for (const width of [0.36, 0.08]) {
    const ribbon = part(
      new THREE.BoxGeometry(width, 0.315, width === 0.36 ? 0.055 : 0.29),
      "#d9b96c",
    );
    group.add(ribbon);
  }
  for (const side of [-1, 1]) {
    const loop = part(new THREE.TorusGeometry(0.065, 0.016, 6, 12), "#dfbe75");
    loop.position.set(side * 0.052, 0.19, 0);
    loop.rotation.y = Math.PI / 2;
    loop.rotation.z = side * 0.6;
    group.add(loop);
  }
  return group;
}
function wrench(premium: boolean) {
  const group = new THREE.Group();
  const color = premium ? "#b7c8c5" : "#8d8f80";
  group.add(part(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 8), color));
  const head = part(
    new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI * 1.45),
    color,
  );
  head.position.y = 0.3;
  group.add(head);
  const grip = part(
    new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8),
    premium ? "#648e91" : "#8e7257",
  );
  grip.position.y = -0.16;
  group.add(grip);
  return group;
}

/** 几何为项目自建，复用imagegen布料/木材纹理；只表现账本传来的实际状态。 */
export function createInventoryProps(surfaces: SurfaceTextures) {
  const carried = new THREE.Group();
  carried.name = "PurchasedItems";
  carried.position.set(0.67, 0.65, 0.08);
  const practical = gift("#759b9b", surfaces);
  const novel = gift("#c797ad", surfaces);
  const breadGift = gift("#d5b87e", surfaces);
  const bread = new THREE.Group();
  practical.name = "practical-gift";
  novel.name = "novel-gift";
  breadGift.name = "bread-gift";
  bread.name = "bread";
  const bag = part(
    new RoundedBoxGeometry(0.27, 0.3, 0.18, 2, 0.02),
    "#ddc59c",
    surfaces.canvas,
  );
  bread.add(bag);
  const loaf = part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), "#b88348");
  loaf.position.y = 0.2;
  loaf.rotation.z = 0.45;
  bread.add(loaf);
  practical.position.z = -0.35;
  novel.position.z = 0.35;
  breadGift.position.y = 0.36;
  bread.position.y = -0.36;
  carried.add(practical, novel, breadGift, bread);
  const carriedViews: ReadonlyArray<readonly [string, THREE.Object3D]> = [
    ["bread", bread],
    ["bread-gift", breadGift],
    ["practical-gift", practical],
    ["novel-gift", novel],
  ];
  const workshop = new THREE.Group();
  workshop.name = "PlayerWorkshop";
  const [x, , z] = LOCATION_POSITIONS.market;
  workshop.position.set(x + 1.6, groundHeight(x + 1.6, z - 1.4) + 0.7, z - 1.4);
  const table = part(
    new THREE.BoxGeometry(0.85, 0.1, 0.6),
    "#a78b60",
    surfaces.wood,
  );
  table.position.y = -0.05;
  workshop.add(table);
  for (const side of [-1, 1])
    for (const depth of [-1, 1]) {
      const leg = part(
        new THREE.CylinderGeometry(0.035, 0.05, 0.65, 6),
        "#9b805d",
        surfaces.wood,
      );
      leg.position.set(side * 0.34, -0.4, depth * 0.22);
      workshop.add(leg);
    }
  const used = wrench(false),
    premium = wrench(true);
  used.rotation.z = premium.rotation.z = Math.PI / 2;
  const pending = part(
    new RoundedBoxGeometry(0.55, 0.32, 0.4, 2, 0.025),
    "#a8885e",
    surfaces.wood,
  );
  const screwdriver = part(
    new THREE.CylinderGeometry(0.035, 0.035, 0.48, 8),
    "#c5b57b",
  );
  screwdriver.position.set(0, 0.08, 0.15);
  screwdriver.rotation.z = Math.PI / 2;
  const premiumSet = new THREE.Group();
  pending.position.y = 0.16;
  used.position.y = premiumSet.position.y = 0.06;
  used.name = "used-tool";
  premiumSet.name = "premium-tools";
  pending.name = "pending-delivery";
  premiumSet.add(premium, screwdriver);
  workshop.add(used, premiumSet, pending);
  const opponentStall = new THREE.Group();
  opponentStall.name = "OpponentStall";
  opponentStall.position.set(10.4, 0.3, 18.2);
  opponentStall.scale.setScalar(0.65);
  let opponentModel: THREE.Object3D | null = null;
  return {
    carried,
    workshop,
    opponentStall,
    setMarketModel(model: THREE.Object3D) {
      if (opponentModel) opponentStall.remove(opponentModel);
      opponentModel = model.clone(true);
      opponentStall.add(opponentModel);
    },
    update(state: SceneInventoryState) {
      workshop.visible = Boolean(state.toolPending || state.toolQuality);
      practical.visible =
        state.purchasedItems?.includes("practical-gift") ?? false;
      novel.visible = state.purchasedItems?.includes("novel-gift") ?? false;
      breadGift.visible = state.purchasedItems?.includes("bread-gift") ?? false;
      bread.visible = state.purchasedItems?.includes("bread") ?? false;
      used.visible = state.toolQuality === "used" && !state.toolPending;
      premiumSet.visible =
        state.toolQuality === "premium" && !state.toolPending;
      pending.visible = state.toolPending ?? false;
      opponentStall.visible = state.opponentStallOwned ?? false;
      return {
        items: carriedViews
          .filter(([, object]) => object.visible)
          .map(([name]) => name),
        tool: pending.visible
          ? "pending"
          : used.visible
            ? "used"
            : premiumSet.visible
              ? "premium"
              : "none",
        opponent: opponentStall.visible && opponentModel !== null,
      };
    },
  };
}

import type { LocationId } from "../game/content";

export interface NpcModelDefinition {
  id: string;
  location: Exclude<LocationId, "bridge">;
  kind: "shop" | "outdoor" | "cafe";
  role: string;
  species: string;
  height: number;
  yaw: number;
}

export const NPC_MODELS = [
  {
    id: "01_bakery_rabbit",
    location: "bakery",
    kind: "shop",
    role: "面包师",
    species: "兔子",
    height: 1.65,
    yaw: 0,
  },
  {
    id: "02_grocery_beaver",
    location: "grocery",
    kind: "shop",
    role: "木材商",
    species: "河狸",
    height: 1.75,
    yaw: 0,
  },
  {
    id: "03_market_squirrel",
    location: "market",
    kind: "shop",
    role: "水果商",
    species: "松鼠",
    height: 1.6,
    yaw: 0,
  },
  {
    id: "04_research_fox",
    location: "research",
    kind: "shop",
    role: "芯片店技术员",
    species: "狐狸",
    height: 1.95,
    yaw: 0,
  },
  {
    id: "05_bank_owl",
    location: "bank",
    kind: "shop",
    role: "金券银行职员",
    species: "猫头鹰",
    height: 1.7,
    yaw: 0,
  },
  {
    id: "06_gifts_sheep",
    location: "gifts",
    kind: "shop",
    role: "花店店员",
    species: "绵羊",
    height: 1.65,
    yaw: 0,
  },
  {
    id: "07_rival_otter",
    location: "rival",
    kind: "shop",
    role: "咖啡豆商",
    species: "水獭",
    height: 1.8,
    yaw: 0,
  },
  {
    id: "08_cafe_cat",
    location: "cafe",
    kind: "cafe",
    role: "茶馆茶师",
    species: "姜黄虎斑猫",
    height: 1.75,
    yaw: 0,
  },
  {
    id: "09_notice_hedgehog",
    location: "notice",
    kind: "outdoor",
    role: "公告管理员",
    species: "刺猬",
    height: 1.5,
    yaw: 0,
  },
  {
    id: "10_repair_automaton",
    location: "repair",
    kind: "outdoor",
    role: "修理师傅",
    species: "发条机器人",
    height: 1.65,
    yaw: 0,
  },
  {
    id: "11_garden_deer",
    location: "garden",
    kind: "outdoor",
    role: "园丁",
    species: "梅花鹿",
    height: 1.95,
    yaw: 0,
  },
  {
    id: "12_music_frog",
    location: "music",
    kind: "outdoor",
    role: "乐手",
    species: "青蛙",
    height: 1.65,
    yaw: 0,
  },
  {
    id: "13_dock_turtle",
    location: "dock",
    kind: "outdoor",
    role: "码头看护人",
    species: "乌龟",
    height: 1.65,
    yaw: 0,
  },
  {
    id: "14_riverside_mouse",
    location: "riverside",
    kind: "outdoor",
    role: "河岸读者",
    species: "灰鼠",
    height: 1.45,
    yaw: 0,
  },
  {
    id: "15_square_dog",
    location: "square",
    kind: "outdoor",
    role: "小镇向导",
    species: "柯基犬",
    height: 1.5,
    yaw: 0,
  },
] as const satisfies readonly NpcModelDefinition[];

export function getNpcModel(location: LocationId): NpcModelDefinition {
  const definition = NPC_MODELS.find((model) => model.location === location);
  if (!definition) throw new Error(`地点没有NPC模型：${location}`);
  return definition;
}

export function npcModelUrl(model: NpcModelDefinition, mobile: boolean): string {
  return `/models/npc/${model.id}${mobile ? "-mobile" : ""}-v1.glb`;
}

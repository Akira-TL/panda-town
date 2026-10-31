import {
  currentPrice,
  type EventDefinition,
  type GameState,
  type Material,
  type OptionDefinition,
  type Question,
} from "./engine";

export const LOCATION_IDS = [
  "square",
  "bakery",
  "grocery",
  "notice",
  "market",
  "research",
  "bridge",
  "bank",
  "gifts",
  "rival",
  "riverside",
  "cafe",
  "repair",
  "garden",
  "music",
  "dock",
] as const;
export type LocationId = (typeof LOCATION_IDS)[number];
export type EventId =
  | "E01"
  | "E02"
  | "E03"
  | "E04"
  | "E05"
  | "E06"
  | "E07"
  | "E08"
  | "E09"
  | "E10"
  | "E11"
  | "E12";
export interface Location {
  id: LocationId;
  name: string;
  next: readonly LocationId[];
  theme: string;
}
export const LOCATIONS: readonly Location[] = [
  { id: "square", name: "小镇广场", next: ["bakery"], theme: "筹备" },
  { id: "bakery", name: "面包店", next: ["grocery"], theme: "消费" },
  { id: "grocery", name: "杂货铺", next: ["notice", "repair"], theme: "工具" },
  { id: "notice", name: "公告牌", next: ["market"], theme: "资料" },
  { id: "market", name: "集市", next: ["research"], theme: "经营" },
  { id: "research", name: "PandaAI 研究站", next: ["bridge"], theme: "资料" },
  { id: "bridge", name: "小桥", next: ["bank", "music"], theme: "合作" },
  { id: "bank", name: "银行", next: ["gifts"], theme: "投资" },
  { id: "gifts", name: "礼品店", next: ["rival"], theme: "消费" },
  { id: "rival", name: "对手小店", next: ["riverside"], theme: "合作" },
  { id: "riverside", name: "河岸观景点", next: ["cafe"], theme: "资料" },
  { id: "cafe", name: "我的咖啡馆", next: ["square"], theme: "筹备" },
  { id: "repair", name: "露天修理摊", next: ["garden"], theme: "居民" },
  { id: "garden", name: "花园", next: ["market"], theme: "居民" },
  { id: "music", name: "街头音乐角", next: ["dock"], theme: "居民" },
  { id: "dock", name: "码头", next: ["gifts"], theme: "资料" },
];

export const QUESTIONS: readonly Question[] = [
  {
    id: "K01",
    prompt: "第二天比第一天的演示营业额增加了多少？",
    answers: [
      { id: "20", label: "20" },
      { id: "30", label: "30" },
      { id: "unknown", label: "无法知道" },
    ],
    correctAnswerId: "20",
    explanation:
      "第一天 100，第二天 120；120－100＝20。这道题只检查可见数据的读数。",
  },
  {
    id: "K02",
    prompt: "哪条消息直接描述已经发生的成交？",
    answers: [
      { id: "A", label: "消息甲" },
      { id: "B", label: "消息乙" },
      { id: "neither", label: "两条都不是" },
    ],
    correctAnswerId: "B",
    explanation:
      "消息乙记录截至今天实际成交价为 100；消息甲只是商家的涨价意愿，不能作为已发生成交。",
  },
];
export const SALES_MATERIALS: readonly Material[] = [
  {
    id: "sales-record",
    sourceId: "town-ledger",
    text: "演示数据｜开局前已公布的历史样例：营业额样例第一天 100、第二天 120、第三天 90。来源：小镇营业记录，不是未来三天的预测。",
  },
  {
    id: "sales-rumor",
    sourceId: "merchant-interview",
    text: "演示资料｜开局前已公布的访谈：一位商家认为新口味受欢迎。这是访谈看法，不代表全镇销量或未来收益。",
  },
];
export const SUPPLY_MATERIALS: readonly Material[] = [
  {
    id: "supply-wish",
    sourceId: "supplier-message",
    text: "演示消息甲｜截至今天：商家希望下周涨价。这是意愿，尚未说明发生的成交。",
  },
  {
    id: "supply-trade",
    sourceId: "dock-record",
    text: "演示消息乙｜截至今天：实际成交价仍为 100。来源：码头成交记录。",
  },
];
interface EventCopy {
  title: string;
  speaker: string;
  text: string;
}
const COPIES: Record<EventId, EventCopy> = {
  E01: {
    title: "面包店的新口味",
    speaker: "面包店主",
    text: "普通面包熟悉又实惠，新口味礼盒多了一份惊喜。你也可以接一份临时工作。",
  },
  E02: {
    title: "挑选开店工具",
    speaker: "杂货店主",
    text: "工具只对已开始经营的摊位增加收入。看看还剩几天，再决定是否购入。",
  },
  E03: {
    title: "接手集市摊位",
    speaker: "集市管理员",
    text: "投入 600，次日起每天收入 100；第八天可按 480 退出。要接手吗？",
  },
  E04: {
    title: "看看销量记录",
    speaker: "研究站工作人员",
    text: "把实际营业记录和商家的看法放在一起，看看它们分别说明了什么。资料与题目都可跳过。",
  },
  E05: {
    title: "一笔演示投资",
    speaker: "银行工作人员",
    text: "可以投入 200 或 400，报价会变化，也可以选择工作。这里不使用真实资金。",
  },
  E06: {
    title: "行情更新了",
    speaker: "银行工作人员",
    text: "你可以查看已公布的报价，继续持有或按当前价全部退出。收益无法保证。",
  },
  E07: {
    title: "给朋友选礼物",
    speaker: "礼品店主",
    text: "实用礼物和新奇礼物都能传达心意，价格不同。礼物不计入可变现资产。",
  },
  E08: {
    title: "一起采购工具",
    speaker: "隔壁店长",
    text: "合购优质工具只需 100，明天交货；交货前没有收入加成。你也可以不参加。",
  },
  E09: {
    title: "修理摊的小麻烦",
    speaker: "修理摊居民",
    text: "可以自己帮一会儿忙，或者花 60 请师傅。两种方法都能把问题解决。",
  },
  E10: {
    title: "小镇慢时光",
    speaker: "街边居民",
    text: "想听听这里的故事，还是自己安静欣赏一会儿？",
  },
  E11: {
    title: "码头的采购消息",
    speaker: "码头居民",
    text: "有人说下周要涨价，记录里则是今天的成交。可以查看来源，再决定关注什么。",
  },
  E12: {
    title: "盘点咖啡馆筹备",
    speaker: "咖啡馆店主",
    text: "看看离开张还差多少，或者聊聊筹备计划。也可以通过临时工作增加现金。",
  },
};
export function getEventCopy(id: string): EventCopy {
  return COPIES[id as EventId] ?? COPIES.E12;
}
const option = (
  id: string,
  label: string,
  effect: OptionDefinition["effect"],
): OptionDefinition => ({ id, label, effect });
const work = (): OptionDefinition =>
  option("work", "做一份临时工作，收入 250", { kind: "work" });
function completed(state: GameState, id: EventId): boolean {
  return state.evidence.some(
    (e) =>
      e.eventId === id &&
      e.action === "choose" &&
      e.options.some((o) => o.id === e.choice && o.effect.kind !== "work"),
  );
}
function eligible(state: GameState, id: EventId): boolean {
  switch (id) {
    case "E01":
    case "E07":
    case "E09":
      return !completed(state, id);
    case "E02":
      return state.assets.tool.status === "none";
    case "E03":
      return state.assets.stall === null;
    case "E05":
      return state.day < 8 && state.assets.investment === null;
    case "E06":
      return state.day >= 4 && state.assets.investment !== null;
    case "E08":
      return (
        state.day >= 2 &&
        state.day <= 7 &&
        state.assets.tool.status === "none" &&
        !completed(state, id)
      );
    default:
      return true;
  }
}
function candidates(state: GameState, location: LocationId): EventId[] {
  switch (location) {
    case "bakery":
      return ["E01"];
    case "grocery":
      return ["E02"];
    case "market":
      return ["E03"];
    case "notice":
      return ["E06", "E04"];
    case "research":
      return state.evidence.some(
        (e) => e.eventId === "E04" && e.locationId === "research",
      )
        ? ["E05"]
        : ["E04"];
    case "bank":
      return ["E06", "E05"];
    case "bridge":
    case "rival":
      return ["E08"];
    case "gifts":
      return ["E07"];
    case "riverside":
      return ["E06", "E11"];
    case "repair":
      return ["E09"];
    case "garden":
    case "music":
      return ["E10"];
    case "dock":
      return ["E11"];
    default:
      return ["E12"];
  }
}
export function getEventForLocation(
  state: GameState,
  locationId: LocationId,
): EventDefinition {
  const id =
    candidates(state, locationId).find((candidate) =>
      eligible(state, candidate),
    ) ?? "E12";
  let options: OptionDefinition[];
  switch (id) {
    case "E01":
      options = [
        option("ordinary", "普通面包，60", {
          kind: "consume",
          itemId: "bread",
          amount: 60,
        }),
        option("novel", "新口味礼盒，120", {
          kind: "consume",
          itemId: "bread-gift",
          amount: 120,
        }),
      ];
      break;
    case "E02":
      options = [
        option("used", "二手工具，100；每次经营收入 +20", {
          kind: "buy-tool",
          quality: "used",
        }),
        option("premium", "优质工具，180；每次经营收入 +40", {
          kind: "buy-tool",
          quality: "premium",
        }),
      ];
      break;
    case "E03":
      options = [
        option("buy", "接手摊位，600", { kind: "buy-stall" }),
        option("keep", "暂不接手，保留现金", { kind: "observe" }),
      ];
      break;
    case "E04":
      options = [
        option("review", "记录自己对演示资料的看法", { kind: "observe" }),
        option("skip", "暂不研究", { kind: "observe" }),
      ];
      break;
    case "E05":
      options = [
        option("small", "投入 200", { kind: "invest", amount: 200 }),
        option("large", "投入 400", { kind: "invest", amount: 400 }),
      ];
      break;
    case "E06":
      options = [
        option("hold", "继续持有", { kind: "observe" }),
        option("sell", "按当前报价全部出售", { kind: "sell-investment" }),
      ];
      break;
    case "E07":
      options = [
        option("practical", "实用礼物，60", {
          kind: "consume",
          itemId: "practical-gift",
          amount: 60,
        }),
        option("novel", "新奇礼物，120", {
          kind: "consume",
          itemId: "novel-gift",
          amount: 120,
        }),
      ];
      break;
    case "E08":
      options = [
        option("cooperate", "一起采购，100，明天交付优质工具", {
          kind: "cooperate",
        }),
        option("decline", "暂不合作", { kind: "observe" }),
      ];
      break;
    case "E09":
      options = [
        option("help", "自己帮忙，不花现金", { kind: "observe" }),
        option("expert", "请师傅，60", {
          kind: "consume",
          itemId: "repair-service",
          amount: 60,
        }),
      ];
      break;
    case "E10":
      options = [
        option("talk", "主动问问居民的故事", { kind: "observe" }),
        option("watch", "自己欣赏一会儿", { kind: "observe" }),
      ];
      break;
    case "E11":
      options = [
        option("review", "记录核对消息后的看法", { kind: "observe" }),
        option("skip", "暂不关注", { kind: "observe" }),
      ];
      break;
    default:
      options = [
        option("plan", "主动盘点资金和退出报价", { kind: "observe" }),
        option("talk", "与店主聊聊筹备计划", { kind: "observe" }),
      ];
  }
  const event: EventDefinition = {
    id,
    contextId: id,
    locationId,
    options: [...options, work()],
  };
  if (id === "E04") {
    event.materials = SALES_MATERIALS.map((m) => ({ ...m }));
    event.questions = QUESTIONS.filter((q) => q.id === "K01").map((q) =>
      structuredClone(q),
    );
  }
  if (id === "E11") {
    event.materials = SUPPLY_MATERIALS.map((m) => ({ ...m }));
    event.questions = QUESTIONS.filter((q) => q.id === "K02").map((q) =>
      structuredClone(q),
    );
  }
  if (id === "E05" || id === "E06")
    event.materials = [
      {
        id: `quote-day-${state.day}`,
        sourceId: "demo-market",
        text: `演示数据｜截至第 ${state.day} 天，当前报价 ${currentPrice(state)}，费用为 0。情境等概率在开局固定，未来报价尚未公布；可能亏损，最多损失投入额。`,
      },
    ];
  return event;
}

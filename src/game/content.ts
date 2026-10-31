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
export function getEventDialogue(
  state: GameState,
  eventId: string,
  locationId: string,
): EventCopy {
  const base = getEventCopy(eventId);
  if (eventId === "E02")
    return {
      ...base,
      text: `今天是第 ${state.day} 天，之后还有 ${8 - state.day} 个回合。工具只有配合经营中的摊位才增加收入；已有摊位时当晚生效。`,
    };
  if (eventId === "E05")
    return {
      ...base,
      text: `当前演示报价 ${currentPrice(state)}，费用为 0。可以投入 200 或 400，也可以工作；最多损失已投入金额。`,
    };
  if (eventId === "E10" && locationId === "music")
    return {
      ...base,
      speaker: "街头乐手",
      text: "桥边传来一段轻快的旋律。想听听乐手的故事，还是自己欣赏一会儿？",
    };
  if (eventId === "E10" && locationId === "garden")
    return {
      ...base,
      speaker: "花园居民",
      text: "花园里有一张安静的长椅。想问问居民种花的故事，还是自己看看风景？",
    };
  if (eventId !== "E12") return base;
  if (
    locationId === "bakery" &&
    state.assets.items.some((id) => id === "bread" || id === "bread-gift")
  )
    return {
      title: "面包店的老朋友",
      speaker: "面包店主",
      text: state.assets.items.includes("bread-gift")
        ? "上次的新口味礼盒还合心意吗？这次不再重复购买，你可以看看开店资金，或者帮我接一份临时工作。"
        : "还记得你上回选的普通面包。今天可以聊聊开店筹备，也可以帮店里接一份临时工作。",
    };
  if (
    locationId === "gifts" &&
    state.assets.items.some(
      (id) => id === "practical-gift" || id === "novel-gift",
    )
  )
    return {
      title: "礼物送到了",
      speaker: "礼品店主",
      text: state.assets.items.includes("novel-gift")
        ? "朋友收到了那份新奇礼物，托我向你道谢。礼物留在这段故事里，不会变成金币。"
        : "朋友很喜欢那份实用礼物，托我向你道谢。今天不再重复购买，看看你的咖啡馆计划吧。",
    };
  if (locationId === "grocery" && state.assets.tool.status !== "none")
    return {
      title: "工具已经安排妥当",
      speaker: "杂货店主",
      text:
        state.assets.tool.status === "pending"
          ? `你的合购工具将在第 ${state.assets.tool.deliveryDay} 天开头送到。在此之前不重复采购，也不会提前增加经营收入。`
          : `你已经有${state.assets.tool.quality === "used" ? "二手" : "优质"}工具了，不需要再买一套。它只在摊位实际经营时增加收入。`,
    };
  if (locationId === "market" && state.assets.stall)
    return {
      title: "回到自己的摊位",
      speaker: "集市管理员",
      text:
        state.assets.stall.boughtDay < state.day
          ? "你的摊位今天继续营业，收入会在回合末统一到账。第八天还可以决定按 480 退出或保留经营资产。"
          : "招牌已经挂好，今天还在准备，明天起开始产生经营收入。",
    };
  if (
    (locationId === "bridge" || locationId === "rival") &&
    state.assets.tool.status === "pending"
  )
    return {
      title: "采购订单还在路上",
      speaker: "隔壁店长",
      text: `那份 100 金币的合购已经确认，第 ${state.assets.tool.deliveryDay} 天交货。放心，不会再收第二次钱。`,
    };
  if (
    (locationId === "bridge" || locationId === "rival") &&
    state.evidence.some(
      (e) =>
        e.eventId === "E08" && e.action === "choose" && e.choice === "decline",
    )
  )
    return {
      title: "各自的筹备节奏",
      speaker: "隔壁店长",
      text: "上回你决定暂不合购，我记住了。普通采购和临时工作机会都还在，我们按自己的节奏开店。",
    };
  if (
    locationId === "repair" &&
    state.evidence.some(
      (e) =>
        e.eventId === "E09" &&
        e.action === "choose" &&
        (e.choice === "help" || e.choice === "expert"),
    )
  )
    return {
      title: "修理摊恢复营业",
      speaker: "修理摊居民",
      text: state.assets.items.includes("repair-service")
        ? "师傅已经把摊位修好了，谢谢你替我安排！这次不再重复付维修费。"
        : "多亏你上次搭把手，摊位已经修好。谢谢你，今天可以安心继续自己的筹备了。",
    };
  return base;
}
export interface DecisionFeedback {
  title: string;
  speaker: string;
  text: string;
  detail: string;
}
export function getDecisionFeedback(state: GameState): DecisionFeedback {
  const evidence = [...state.evidence]
    .reverse()
    .find((e) => e.day === state.day && e.action === "choose");
  const selected = evidence?.options.find((o) => o.id === evidence.choice);
  if (!evidence || !selected)
    return {
      title: "这一步已经完成",
      speaker: "小镇居民",
      text: "收好这段经历，继续今天的筹备。",
      detail: "本回合只会确认一次主要选择。",
    };
  const copy = getEventDialogue(state, evidence.eventId, evidence.locationId);
  if (selected.effect.kind === "work") {
    const jobs: Record<string, string> = {
      E01: "帮面包店把新鲜面包装好",
      E02: "替杂货店整理货架",
      E03: "帮集市清点当天货物",
      E04: "替研究站录入一份公开资料",
      E05: "帮银行核对当天单据",
      E06: "帮忙整理已公布的报价记录",
      E07: "帮礼品店布置橱窗",
      E08: "帮隔壁店长核对采购清单",
      E09: "帮修理摊整理工具",
      E10: "帮居民收拾公共场地",
      E11: "帮码头整理货物清单",
      E12: "帮店主整理河边露台",
    };
    return {
      title: "一份踏实的报酬",
      speaker: copy.speaker,
      text: `你${jobs[evidence.eventId] ?? "完成了一份临时工作"}，250 金币已经到账。`,
      detail: "这份工作占用本回合的主要选择；回合末仍会领取基础收入。",
    };
  }
  switch (evidence.eventId) {
    case "E01":
      return {
        title:
          selected.id === "novel"
            ? "把一点新鲜感装进礼盒"
            : "熟悉的味道，也很好",
        speaker: copy.speaker,
        text:
          selected.id === "novel"
            ? "店主把新口味礼盒交到你手上，约好下次听听你的感想。"
            : "店主把普通面包包好递给你，笑着说下回见。",
        detail: "物件会留在旅程回顾中，不计入可出售资产。",
      };
    case "E02":
      return {
        title: "工具放进筹备清单",
        speaker: copy.speaker,
        text: `你买下了${state.assets.tool.status === "owned" && state.assets.tool.quality === "used" ? "二手工具" : "优质工具"}。`,
        detail:
          "工具已经可用；只有摊位开始经营后才会增加每次经营收入，不能单独出售。",
      };
    case "E03":
      return selected.id === "buy"
        ? {
            title: "挂上属于你的招牌",
            speaker: copy.speaker,
            text: "摊位交接完成，600 金币已支付。今晚先准备，明天起经营。",
            detail:
              "基础经营收入每回合 100，终局可选择按 480 出售；工具加成按实际持有情况计算。",
          }
        : {
            title: "先把现金留在手里",
            speaker: copy.speaker,
            text: "你暂时没有接手摊位，今天的现金保持不变。",
            detail:
              "这只是本次资金安排，不会被自动解释为拒绝风险或缺乏经营兴趣。",
          };
    case "E04":
    case "E11":
      return {
        title: selected.id === "skip" ? "先放下这份消息" : "把依据和看法分清楚",
        speaker: copy.speaker,
        text:
          selected.id === "skip"
            ? "你选择暂不研究，仍然可以按自己的节奏继续筹备。"
            : evidence.knownMaterials.length
              ? "你把查看过的资料带回这次选择；已公布的记录和他人的看法会分开保留。"
              : "你决定先保留判断。这次没有展开资料，不会被记为已经阅读或比较。",
        detail: state.evidence.some(
          (e) =>
            e.day === state.day &&
            e.eventId === evidence.eventId &&
            e.action === "compare",
        )
          ? "本局已记录你主动比较了两份不同来源。没有额外金币奖励。"
          : "只有实际点击查看或比较的动作才会成为信息使用证据。",
      };
    case "E05": {
      const amount =
        selected.effect.kind === "invest" ? selected.effect.amount : 0;
      const shares = state.assets.investment?.shares.toFixed(3);
      return {
        title: "一笔有边界的尝试",
        speaker: copy.speaker,
        text: `你投入 ${amount} 金币，按当时报价获得 ${shares} 份演示持仓。`,
        detail:
          "盈亏尚未确定，最多损失已投入金额；当前持仓和退出报价可在资产手记查看。",
      };
    }
    case "E06":
      return selected.id === "sell"
        ? {
            title: "按今天的报价退出",
            speaker: copy.speaker,
            text: `你卖出了全部演示持仓，${state.cash - evidence.cashBefore} 金币已回到现金。`,
            detail: "费用为 0，份额已经清空；本次盈亏不换算为交易能力。",
          }
        : {
            title: "继续持有，记住今天的信息",
            speaker: copy.speaker,
            text: "你选择继续持有，当前没有新增现金收支。",
            detail: "后续报价仍可能变化；持有不等于收益已经兑现。",
          };
    case "E07":
      return {
        title: "礼物带着心意送出",
        speaker: copy.speaker,
        text:
          selected.id === "novel"
            ? "那份新奇礼物已经送到朋友手里，居民记住了这次惊喜。"
            : "朋友收到了你挑的实用礼物，托店主向你道谢。",
        detail: "没有隐藏的金钱回礼；礼物不会计入期末可用现金。",
      };
    case "E08":
      return selected.id === "cooperate"
        ? {
            title: "采购约定，明天见",
            speaker: copy.speaker,
            text: `100 金币已经支付，优质工具会在第 ${state.day + 1} 天开头交付。`,
            detail: "交货前不增加经营收入，也不能重复下单。",
          }
        : {
            title: "这次先按自己的节奏来",
            speaker: copy.speaker,
            text: "隔壁店长尊重你的决定，没有扣除现金。",
            detail:
              "普通工具采购与临时工作都不受影响；这次拒绝没有道德或人格分数。",
          };
    case "E09":
      return {
        title: "修理摊的小麻烦解决了",
        speaker: copy.speaker,
        text:
          selected.id === "help"
            ? "你留下来搭把手，摊位终于修好了。居民认真向你道谢。"
            : "师傅接到你付的 60 金币，当场把摊位修好。居民终于放下心来。",
        detail: "两种办法都解决了同一件事，没有隐藏收入或关系分。",
      };
    case "E10":
      return {
        title:
          selected.id === "talk" ? "多认识一位小镇居民" : "把这片刻留给自己",
        speaker: copy.speaker,
        text:
          selected.id === "talk"
            ? evidence.locationId === "music"
              ? "乐手讲起桥边练习的日子，给你哼了一段最熟悉的旋律。"
              : "居民说起这片花园从春天到秋天的变化，欢迎你下次再来坐坐。"
            : evidence.locationId === "music"
              ? "你坐在路边听完一段旋律，给开店的忙碌留了一点空隙。"
              : "你沿着花坛慢慢看了一会儿，没有额外花钱。",
        detail: "同一基础事件的地点变体不会被累计成多个独立人格情境。",
      };
    default:
      return {
        title:
          selected.id === "plan" ? "把开张的差额算清楚" : "聊聊咖啡馆的第一天",
        speaker: copy.speaker,
        text:
          selected.id === "plan"
            ? `目前现金 ${state.cash}，${state.cash >= 3000 ? "已达到开店门槛，仍要保留至终局。" : `距离 3000 还差 ${3000 - state.cash}。`}`
            : "店主陪你聊了聊开张后的露台和第一杯咖啡，也提醒你按自己的筹备节奏前进。",
        detail: "只有实际变现的资产才计入开店现金，自动展示余额不算主动盘点。",
      };
  }
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

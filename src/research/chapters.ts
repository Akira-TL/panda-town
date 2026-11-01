import type { Chapter, QuizId, ResearchState, ResearchTopic } from "./model";

export interface ResearchQuiz {
  id: QuizId;
  day: 4 | 7;
  prompt: string;
  answers: readonly { id: "yes" | "no" | "unsure"; label: string }[];
  /** 界面只在首次作答后显示解释。 */
  explanation: string;
}

export const RESEARCH_TOPICS: Readonly<
  Record<
    ResearchTopic,
    {
      label: string;
      description: string;
    }
  >
> = {
  source: {
    label: "来源与日期",
    description:
      "商品名为游戏设定，走势映射自可核对的真实历史日线，尚未连接PandaData。核对日期和数据区间，不能把后来发生的结果当作当时已知。",
  },
  quality: {
    label: "缺失与异常记录",
    description:
      "四处错误是关卡人为设置的传输问题，原始历史数据单独保留。本局各条路径都使用同一个已核验副本，不会因检查顺序不同暗中换数据。",
  },
  explanation: {
    label: "请搭档解释",
    description:
      "量化策略是可以重复执行的规则；回测是在过去数据中检查它。自动解释是一种工具选择，不代表你不会操作，也不会替你决定真实投资。",
  },
  rule: {
    label: "规则与执行时点",
    description:
      "趋势规则比较此前5期和20期均价；均值回归在此前收盘价低于20期均价2%时参与，回到均价退出；固定配置首期等额配置两项资产后持有。信号只用此前收盘，随后开盘执行。",
  },
  comparison: {
    label: "统一条件的对照",
    description:
      "对照是100%等权持有两项资产，与策略使用相同初始资金、区间和费用。研究段和检验段分别从1000模拟币开始，不能拼成同一笔连续持仓。",
  },
  drawdown: {
    label: "中途最大的下跌",
    description:
      "最大回撤是这段记录中，从已经到过的高点到后来低点的最大跌幅。最终盈利也可能经历明显下跌；目标投入上限改变后需要重新计算。",
  },
  trades: {
    label: "委托与实际成交",
    description:
      "产生信号、发出委托和完成成交不是同一件事。按实际成交数量、价格、费用与现金核对结果；成交还受到可用资金和当期成交量限制。",
  },
  validation: {
    label: "新数据检验",
    description:
      "这60期没有用于前面的规则选择。第一次运行才揭晓；看过结果再改规则或参数，这段数据就不能再叫未见数据，当前版本仍需另一批新数据验证。",
  },
  cost: {
    label: "费用与操作频率",
    description:
      "1基点是万分之一，10基点是0.1%。费用从每笔实际成交中扣除，滑点改变成交价格；减少检查频率不保证收益更高，需要与原版按相同条件比较。",
  },
};

export const RESEARCH_QUIZZES: readonly ResearchQuiz[] = [
  {
    id: "backtest",
    day: 4,
    prompt: "过去这一段盈利，是否保证下一段也盈利？",
    answers: [
      { id: "yes", label: "是，过去盈利就能保证以后盈利" },
      { id: "no", label: "不保证，还需要进一步检验" },
      { id: "unsure", label: "暂时不确定" },
    ],
    explanation:
      "不保证。回测只说明这套规则在给定历史和假设下的结果，不能保证下一段盈利；还需检查新的数据和执行条件。",
  },
  {
    id: "fees",
    day: 7,
    prompt: "规则和成交不变，计入额外费用后，净收益会比未计费用时更高吗？",
    answers: [
      { id: "yes", label: "会，计费本身可以提高净收益" },
      { id: "no", label: "不会，额外费用会减少这组交易的净结果" },
      { id: "unsure", label: "暂时不确定" },
    ],
    explanation:
      "不会。题目固定了同一组规则和成交，增加的费用只会从结果中扣除。改变频率可能同时改变交易，不能拿不同交易的结果代替这道题的条件。",
  },
];

const CHAPTERS: readonly Omit<Chapter, "speaker">[] = [
  {
    day: 1,
    title: "怎么起步？",
    dialogue: "带着1000模拟币，你想怎么闯小镇？",
    options: [
      {
        id: "return",
        label: "争取多赚",
        detail: "先关注收益，其他指标仍可查看",
      },
      { id: "risk", label: "稳一点", detail: "先关注中途下跌" },
      { id: "cost", label: "少折腾", detail: "先关注买卖次数和费用" },
    ],
    topics: ["explanation"],
  },
  {
    day: 2,
    title: "报价有点怪",
    dialogue: "有4处传输问题，先查哪里？",
    options: [
      { id: "source", label: "查来源", detail: "核对报价来源和日期" },
      { id: "quality", label: "找异常", detail: "查看原值与核验记录" },
      { id: "assisted", label: "熊猫帮我查", detail: "查看本地检查与解释" },
    ],
    topics: ["source", "quality", "explanation"],
  },
  {
    day: 3,
    title: "买卖怎么定？",
    dialogue: "涨了跟着买，还是跌低了再买？",
    options: [
      {
        id: "trend",
        label: "顺着涨势买",
        detail: "此前5期均价高于20期均价参与，否则退出",
      },
      {
        id: "reversion",
        label: "跌低了再买",
        detail: "低于此前20期均价2%买入，回到均价退出",
      },
      {
        id: "hold",
        label: "买好先放着",
        detail: "首期等额配置两项商品，随后持有",
      },
    ],
    topics: ["rule", "explanation"],
  },
  {
    day: 4,
    title: "要换规则吗？",
    dialogue: "买卖点已经画出来了。换一套试试？",
    options: [
      {
        id: "keep",
        label: "照原规则走",
        detail: "同一条件再算一次，保留这一版",
      },
      {
        id: "trend",
        label: "顺着涨势买",
        detail: "此前5期均价高于20期均价参与，否则退出",
      },
      {
        id: "reversion",
        label: "跌低了再买",
        detail: "低于此前20期均价2%买入，回到均价退出",
      },
    ],
    topics: ["comparison", "drawdown", "trades", "explanation"],
  },
  {
    day: 5,
    title: "这次投多少？",
    dialogue: "涨跌会影响你的钱。拿几成来试？",
    options: [
      { id: "allocate30", label: "投3成", detail: "目标投入上限30%，其余现金" },
      { id: "allocate60", label: "投6成", detail: "目标投入上限60%，其余现金" },
      { id: "cash", label: "先拿现金", detail: "投入0%，现金保持1000" },
    ],
    topics: ["comparison", "drawdown", "rule"],
  },
  {
    day: 6,
    title: "换段行情试试",
    dialogue: "这段行情没见过。规则还管用吗？",
    options: [
      { id: "validate", label: "试新行情", detail: "预留60期，独立从1000开始" },
      { id: "explain", label: "帮我检验", detail: "先看解释，再运行检验" },
      {
        id: "defer",
        label: "暂不检验",
        detail: "保持新数据未揭晓，可稍后补验",
      },
    ],
    topics: ["validation", "comparison", "explanation"],
  },
  {
    day: 7,
    title: "算上手续费",
    dialogue: "每次买卖都要付钱。怎么做？",
    options: [
      { id: "fees10", label: "照常买卖 · 0.1%", detail: "每笔成交费用10基点" },
      {
        id: "lower-frequency",
        label: "每5期再看 · 0.1%",
        detail: "每5期检查，每笔成交费用10基点",
      },
      {
        id: "stress30",
        label: "多加费用 · 0.3%",
        detail: "每笔成交费用30基点",
      },
    ],
    topics: ["cost", "trades", "rule", "validation", "explanation"],
  },
  {
    day: 8,
    title: "准备登场",
    dialogue: "策略装好了。带哪一个决定去展会？",
    options: [
      {
        id: "simulate",
        label: "先做模拟",
        detail: "记为准备模拟，不启动外部交易",
      },
      { id: "revise", label: "再改一改", detail: "带着待修改的策略参加展会" },
      { id: "defer", label: "先不用它", detail: "展示研究过程，暂不采用" },
    ],
    topics: ["rule", "validation", "cost", "comparison"],
  },
];

export function getChapterTopics(day: number): readonly ResearchTopic[] {
  return CHAPTERS.find((chapter) => chapter.day === day)?.topics ?? [];
}

export function getChapter(state: ResearchState): Chapter {
  const chapter = CHAPTERS.find((item) => item.day === state.day);
  if (!chapter) throw new RangeError("研究章节必须在第1至8天");
  let options = chapter.options.map((option) => ({ ...option }));
  if (state.day === 4) {
    const ruleOptions = CHAPTERS.find((item) => item.day === 3)!.options;
    options = [
      options[0]!,
      ...ruleOptions
        .filter((option) => option.id !== (state.rule ?? "hold"))
        .map((option) => ({ ...option, label: `换：${option.label}` })),
    ];
  }
  const previousRule =
    state.rule === "trend"
      ? "跟着涨势买"
      : state.rule === "reversion"
        ? "等跌低再买"
        : "买好先放着";
  let dialogue = chapter.dialogue;
  if (state.day === 4) dialogue = `刚才${previousRule}。要换一套试试吗？`;
  if (state.day === 6 && state.allocation === 0)
    dialogue = "先拿着现金。也看看另一段行情？";
  if (state.day === 8 && state.validation === "needs-new-data")
    dialogue = "这版还缺新检验。带着问题也能参展。";
  if (state.phase === "exhibit") dialogue = "你的策略到站了！";
  return {
    ...chapter,
    speaker: "PandaAI",
    dialogue,
    options,
    topics: [...chapter.topics],
  };
}

export function getAvailableResearchQuizzes(
  state: ResearchState,
): readonly ResearchQuiz[] {
  if (state.phase !== "decision" && state.phase !== "feedback") return [];
  const topics = getChapterTopics(state.day);
  return RESEARCH_QUIZZES.filter((quiz) => {
    if (state.day < quiz.day) return false;
    if (quiz.id === "fees") return topics.includes("cost");
    return (
      state.runs.some((run) => run.config.segment === "research") &&
      topics.some((topic) =>
        ["comparison", "drawdown", "trades", "validation"].includes(topic),
      )
    );
  });
}

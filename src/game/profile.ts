import type { Assets, Evidence, PresentedOption } from "./engine";
import { QUESTIONS, getEventCopy } from "./content";

export type ObservationStatus = "observed" | "insufficient" | "not-assessed";
export interface ProfileFact {
  id: string;
  label: string;
  text: string;
  status: ObservationStatus;
  count: number;
  opportunities: number;
  evidenceIds: string[];
}
export interface InvestmentObservation {
  evidenceId: string;
  amount: number;
  cashBefore: number;
  fractionOfCash: number;
}
export interface KnowledgeAnswer {
  questionId: string;
  prompt: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation: string;
  evidenceId: string;
}
export interface EvidenceCard {
  id: string;
  day: number;
  eventId: string;
  contextId: string;
  locationId: string;
  title: string;
  action: Evidence["action"];
  actualChoice: string;
  cashBefore: number;
  cashAfter: number;
  assetsBefore: Assets;
  assetsAfter: Assets;
  assetChanges: AssetChange[];
  options: {
    label: string;
    available: boolean;
    cost: number;
    shortfall: number;
  }[];
  materials: { sourceId: string; text: string }[];
}
export type AssetChange =
  | {
      kind: "investment-purchase";
      amount: number;
      price: number;
      shares: number;
    }
  | { kind: "investment-sale"; amount: number; shares: number }
  | { kind: "stall-purchase"; cost: number; boughtDay: number }
  | {
      kind: "tool-purchase";
      cost: number;
      quality: "used" | "premium";
      deliveryDay: number | null;
    }
  | { kind: "story-item"; count: number };
/** 金额和份额来自已发生的交易快照，不由之后的行情或结果回填。 */
export function deriveAssetChanges(
  evidence: Pick<
    Evidence,
    "cashBefore" | "cashAfter" | "assetsBefore" | "assetsAfter"
  >,
): AssetChange[] {
  const before = evidence.assetsBefore,
    after = evidence.assetsAfter;
  const changes: AssetChange[] = [];
  if (!before.investment && after.investment)
    changes.push({
      kind: "investment-purchase",
      amount: after.investment.cost,
      price: after.investment.purchasePrice,
      shares: after.investment.shares,
    });
  if (before.investment && !after.investment)
    changes.push({
      kind: "investment-sale",
      amount: evidence.cashAfter - evidence.cashBefore,
      shares: before.investment.shares,
    });
  if (!before.stall && after.stall)
    changes.push({
      kind: "stall-purchase",
      cost: after.stall.cost,
      boughtDay: after.stall.boughtDay,
    });
  if (before.tool.status === "none" && after.tool.status !== "none")
    changes.push({
      kind: "tool-purchase",
      cost: evidence.cashBefore - evidence.cashAfter,
      quality: after.tool.status === "owned" ? after.tool.quality : "premium",
      deliveryDay:
        after.tool.status === "pending" ? after.tool.deliveryDay : null,
    });
  const count = after.items.filter((id) => !before.items.includes(id)).length;
  if (count > 0) changes.push({ kind: "story-item", count });
  return changes;
}
export interface ProfileReport {
  title: { label: string; reason: string; evidenceIds: string[] };
  consumption: ProfileFact[];
  trading: ProfileFact[];
  information: ProfileFact[];
  interests: ProfileFact[];
  personality: ProfileFact[];
  investments: InvestmentObservation[];
  knowledge: {
    status: "observed" | "not-assessed";
    correct: number;
    answered: number;
    answers: KnowledgeAnswer[];
    note: string;
  };
  evidence: EvidenceCard[];
  unknowns: string[];
}
type Predicate = (e: Evidence) => boolean;
const chosen = (e: Evidence): PresentedOption | undefined =>
  e.action === "choose"
    ? e.options.find((o) => o.id === e.choice && o.available)
    : undefined;
function describeAction(e: Evidence): string {
  const option = chosen(e);
  if (option) return option.label;
  if (e.action === "compare") return "主动比较两份不同来源的资料";
  if (e.action === "inspect") {
    const source = e.knownMaterials.find((m) => m.id === e.choice)?.sourceId;
    const labels: Record<string, string> = {
      "town-ledger": "营业记录",
      "merchant-interview": "商家访谈",
      "supplier-message": "采购消息",
      "dock-record": "码头成交记录",
      "demo-market": "演示市场报价",
    };
    return `主动查看${source ? (labels[source] ?? "资料") : "资料"}`;
  }
  if (e.action === "answer") {
    const [questionId, answerId] = e.choice.split(":");
    const selected = QUESTIONS.find((q) => q.id === questionId)?.answers.find(
      (a) => a.id === answerId,
    )?.label;
    return selected ? `回答理解题：${selected}` : "完成一道理解题";
  }
  return "本局操作";
}
function uniqueContexts(records: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return records.filter((e) => {
    if (seen.has(e.contextId)) return false;
    seen.add(e.contextId);
    return true;
  });
}
function fact(
  id: string,
  label: string,
  records: Evidence[],
  opportunities: number,
  description: string,
): ProfileFact {
  return {
    id,
    label,
    text: records.length ? description : "本局未观察到对应的主动行为。",
    status: records.length ? "observed" : "insufficient",
    count: records.length,
    opportunities,
    evidenceIds: records.map((e) => e.id),
  };
}
/** 只读分析本局实际记录；不生成心理分数、能力评级或对局外人格的推断。 */
export function buildProfile(input: readonly Evidence[]): ProfileReport {
  const seenIds = new Set<string>();
  const records = input.filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });
  const decisions = records.filter((e) => chosen(e) !== undefined);
  const select = (predicate: Predicate): Evidence[] =>
    uniqueContexts(decisions.filter(predicate));
  const opportunity = (predicate: Predicate): number =>
    uniqueContexts(decisions.filter(predicate)).length;
  const consumptionOpportunities = opportunity(
    (e) =>
      ["E01", "E07"].includes(e.eventId) &&
      e.options.filter((o) => o.effect.kind === "consume" && o.available)
        .length === 2,
  );
  const novel = select(
    (e) =>
      ["E01", "E07"].includes(e.eventId) &&
      e.choice === "novel" &&
      e.options.filter((o) => o.effect.kind === "consume" && o.available)
        .length === 2,
  );
  const conventional = select(
    (e) =>
      ((e.eventId === "E01" && e.choice === "ordinary") ||
        (e.eventId === "E07" && e.choice === "practical")) &&
      e.options.filter((o) => o.effect.kind === "consume" && o.available)
        .length === 2,
  );
  const tools = select(
    (e) => e.eventId === "E02" && chosen(e)?.effect.kind === "buy-tool",
  );
  const works = decisions.filter((e) => chosen(e)?.effect.kind === "work");
  const stalls = select((e) => chosen(e)?.effect.kind === "buy-stall");
  const investments = select((e) => chosen(e)?.effect.kind === "invest");
  const exits = select((e) => chosen(e)?.effect.kind === "sell-investment");
  const holds = select((e) => e.eventId === "E06" && e.choice === "hold");
  const declined = select(
    (e) =>
      (e.eventId === "E03" && e.choice === "keep") ||
      (e.eventId === "E08" && e.choice === "decline"),
  );
  const inspections = uniqueContexts(
    records.filter(
      (e) =>
        e.action === "inspect" &&
        e.knownMaterials.some((m) => m.id === e.choice),
    ),
  );
  const comparisons = uniqueContexts(
    records.filter((e) => {
      if (e.action !== "compare") return false;
      const ids = e.choice.split("|");
      const materials = ids.map((id) =>
        e.knownMaterials.find((m) => m.id === id),
      );
      return (
        ids.length === 2 &&
        materials[0] !== undefined &&
        materials[1] !== undefined &&
        materials[0].sourceId !== materials[1].sourceId
      );
    }),
  );
  const informationOpportunities = uniqueContexts(
    records.filter(
      (e) =>
        e.knownMaterials.length > 0 ||
        ["E04", "E05", "E06", "E11"].includes(e.eventId),
    ),
  ).length;
  const plans = select((e) => e.eventId === "E12" && e.choice === "plan");
  const talks = select(
    (e) => (e.eventId === "E10" || e.eventId === "E12") && e.choice === "talk",
  );
  const alone = select((e) => e.eventId === "E10" && e.choice === "watch");
  const cooperation = select(
    (e) =>
      chosen(e)?.effect.kind === "cooperate" ||
      (e.eventId === "E09" && e.choice === "help"),
  );
  const combine = (...groups: Evidence[][]): Evidence[] =>
    uniqueContexts(groups.flat());
  const noveltyText =
    novel.length >= 2 && conventional.length === 0
      ? "本局在两个不同情境中都选择了新奇物品。"
      : "本局的新奇物品选择不足以形成一致的探索线索；其他选择和资金情境一并保留。";
  const planning = combine(comparisons, plans);
  const personality: ProfileFact[] = [
    {
      ...fact(
        "openness",
        "开放性相关线索",
        combine(novel, conventional),
        consumptionOpportunities,
        noveltyText,
      ),
      status:
        novel.length >= 2 && conventional.length === 0
          ? "observed"
          : "insufficient",
    },
    {
      ...fact(
        "conscientiousness",
        "尽责性相关线索",
        planning,
        informationOpportunities + opportunity((e) => e.eventId === "E12"),
        "本局在不同情境主动核对资料或盘点筹备资金；这些行为不构成尽责性评分。",
      ),
      status: planning.length >= 2 ? "observed" : "insufficient",
      text:
        planning.length >= 2
          ? "本局在不同情境主动核对资料或盘点筹备资金；这些行为不构成尽责性评分。"
          : "筹备与核对的独立情境不足，不能概括一般人格。",
    },
    {
      ...fact(
        "extraversion",
        "外倾性相关线索",
        combine(talks, alone),
        opportunity((e) => e.eventId === "E10" || e.eventId === "E12"),
        "本局在两处主动发起交谈；不代表现实社交能力。",
      ),
      status:
        talks.length >= 2 && alone.length === 0 ? "observed" : "insufficient",
      text:
        talks.length >= 2 && alone.length === 0
          ? "本局在两个不同情境主动发起交谈；不代表现实社交能力。"
          : "主动交谈线索不足或同时出现独自观赏，保留各次情境，不概括现实外倾性。",
    },
    {
      ...fact(
        "agreeableness",
        "宜人性相关线索",
        cooperation,
        opportunity((e) => e.eventId === "E08" || e.eventId === "E09"),
        "合作可能包含价格和时间因素，本局只列实际合作行为，不推断宜人性。",
      ),
      status: "insufficient",
    },
    {
      id: "emotional-stability",
      label: "情绪稳定性相关线索",
      text: "本局未设置适合评估情绪稳定性的情境。",
      status: "not-assessed",
      count: 0,
      opportunities: 0,
      evidenceIds: [],
    },
  ];
  const knowledgeAnswers: KnowledgeAnswer[] = [];
  const seenQuestions = new Set<string>();
  for (const e of records) {
    if (e.action !== "answer") continue;
    const [questionId, answerId] = e.choice.split(":");
    const question = QUESTIONS.find((q) => q.id === questionId);
    const selected = question?.answers.find((a) => a.id === answerId);
    if (!question || !selected || seenQuestions.has(question.id)) continue;
    seenQuestions.add(question.id);
    knowledgeAnswers.push({
      questionId: question.id,
      prompt: question.prompt,
      selectedAnswer: selected.label,
      correctAnswer:
        question.answers.find((a) => a.id === question.correctAnswerId)
          ?.label ?? "",
      correct: answerId === question.correctAnswerId,
      explanation: question.explanation,
      evidenceId: e.id,
    });
  }
  const interestGroups: {
    id: string;
    label: string;
    records: Evidence[];
    opportunities: number;
  }[] = [
    {
      id: "data",
      label: "资料主题",
      records: combine(inspections, comparisons),
      opportunities: informationOpportunities,
    },
    {
      id: "business",
      label: "经营筹备主题",
      records: combine(stalls, tools, plans),
      opportunities: opportunity((e) =>
        ["E02", "E03", "E12"].includes(e.eventId),
      ),
    },
    {
      id: "residents",
      label: "居民故事主题",
      records: talks,
      opportunities: opportunity(
        (e) => e.eventId === "E10" || e.eventId === "E12",
      ),
    },
  ];
  const title =
    comparisons.length >= 2
      ? {
          label: "细心看账的店长",
          reason: "本局在两个独立情境主动比较不同来源资料。",
          evidenceIds: comparisons.map((e) => e.id),
        }
      : works.length >= 4
        ? {
            label: "踏实筹备的店长",
            reason: "本局至少四次选择临时工作。",
            evidenceIds: works.map((e) => e.id),
          }
        : {
            label: "初来小镇的店长",
            reason: "这是本局的游戏称号，不是心理分类。",
            evidenceIds: [],
          };
  return {
    title,
    consumption: [
      fact(
        "novel",
        "新奇取舍",
        novel,
        consumptionOpportunities,
        novel.length >= 2
          ? "本局多次选择新奇物品；请结合其他实际选择查看。"
          : "本局有一次可与常规物品比较的新奇选择。",
      ),
      fact(
        "conventional",
        "常规与实用取舍",
        conventional,
        consumptionOpportunities,
        "本局选择了价格较低的常规或实用物品；未推断其动机。",
      ),
      fact(
        "tools",
        "工具品质取舍",
        tools,
        opportunity(
          (e) =>
            e.eventId === "E02" &&
            e.options.filter((o) => o.available && o.effect.kind === "buy-tool")
              .length === 2,
        ),
        "工具选择及当时现金、剩余天数保存在证据中。",
      ),
    ],
    trading: [
      fact(
        "work",
        "确定收入",
        works,
        decisions.length,
        `本局 ${works.length} 次选择临时工作。`,
      ),
      fact(
        "stall",
        "持续经营",
        stalls,
        opportunity((e) =>
          e.options.some((o) => o.effect.kind === "buy-stall" && o.available),
        ),
        "本局接手了摊位，购买时机及现金可在证据中核对。",
      ),
      fact(
        "investment",
        "不确定收益投入",
        investments,
        opportunity((e) =>
          e.options.some((o) => o.effect.kind === "invest" && o.available),
        ),
        "本局参与了演示投资；收益不等于能力。",
      ),
      fact(
        "hold",
        "持有行为",
        holds,
        opportunity((e) => e.eventId === "E06"),
        "行情变化后有继续持有的选择。",
      ),
      fact(
        "exit",
        "退出行为",
        exits,
        opportunity((e) =>
          e.options.some(
            (o) => o.effect.kind === "sell-investment" && o.available,
          ),
        ),
        "本局按当时报价退出持仓；不推断恐慌或交易能力。",
      ),
      fact(
        "reserve",
        "暂缓投入",
        declined,
        opportunity((e) => e.eventId === "E03" || e.eventId === "E08"),
        "本局有暂缓接手或合作的选择，具体约束在证据中保留。",
      ),
    ],
    information: [
      fact(
        "inspect",
        "主动查看",
        inspections,
        informationOpportunities,
        `在 ${inspections.length} 个独立情境主动展开资料。`,
      ),
      fact(
        "compare",
        "不同来源比较",
        comparisons,
        informationOpportunities,
        `在 ${comparisons.length} 个独立情境比较了两个已查看的不同来源。`,
      ),
    ],
    interests: interestGroups.map((g) => ({
      ...fact(
        g.id,
        g.label,
        g.records,
        g.opportunities,
        g.records.length >= 2
          ? "本局在不同情境重复主动选择此主题。"
          : "只有一次主动行为，尚不足以概括重复兴趣。",
      ),
      status: g.records.length >= 2 ? "observed" : "insufficient",
    })),
    personality,
    investments: investments.flatMap((e) => {
      const effect = chosen(e)?.effect;
      return effect?.kind === "invest" && e.cashBefore > 0
        ? [
            {
              evidenceId: e.id,
              amount: effect.amount,
              cashBefore: e.cashBefore,
              fractionOfCash: effect.amount / e.cashBefore,
            },
          ]
        : [];
    }),
    knowledge: {
      status: knowledgeAnswers.length ? "observed" : "not-assessed",
      correct: knowledgeAnswers.filter((a) => a.correct).length,
      answered: knowledgeAnswers.length,
      answers: knowledgeAnswers,
      note: knowledgeAnswers.length
        ? "仅表示本局已答客观题的表现，不换算综合金融能力。"
        : "本局未评估；没有遇到题目或选择跳过均不视为答错。",
    },
    evidence: records.map((e) => ({
      id: e.id,
      day: e.day,
      eventId: e.eventId,
      contextId: e.contextId,
      locationId: e.locationId,
      title: getEventCopy(e.eventId).title,
      action: e.action,
      actualChoice: describeAction(e),
      cashBefore: e.cashBefore,
      cashAfter: e.cashAfter,
      assetsBefore: structuredClone(e.assetsBefore),
      assetsAfter: structuredClone(e.assetsAfter),
      assetChanges: deriveAssetChanges(e),
      options: e.options.map((o) => ({
        label: o.label,
        available: o.available,
        cost: o.cost,
        shortfall: o.shortfall,
      })),
      materials: e.knownMaterials.map((m) => ({
        sourceId: m.sourceId,
        text: m.text,
      })),
    })),
    unknowns: [
      "所有结论仅描述本局观察，游戏称号不是心理类型。",
      "随机经过、未展示与余额禁用不表示主动拒绝。",
      "相反方向的行为同时保留，目标压力与资金变化可能影响选择。",
      "两次独立情境是产品显示规则，不是经验证的心理测量阈值。",
    ],
  };
}

import { getChapterTopics, RESEARCH_QUIZZES } from "./chapters";
import type {
  QuizId,
  ResearchEvidence,
  ResearchState,
  ResearchTopic,
} from "./model";

export interface ResearchFact {
  id: string;
  label: string;
  text: string;
  count: number;
  opportunities: number;
  status: "observed" | "unobserved" | "mixed";
  evidenceIds: string[];
}
export interface ResearchSection {
  id: "interests" | "habits" | "allocation" | "tools";
  title: string;
  description: string;
  facts: ResearchFact[];
}
export interface ResearchKnowledgeAnswer {
  id: QuizId;
  prompt: string;
  selectedAnswer: string;
  correct: boolean;
  explanation: string;
  evidenceId: string;
}
export interface ResearchProfile {
  title: string;
  summary: string;
  sections: ResearchSection[];
  knowledge: {
    answered: number;
    correct: number;
    answers: ResearchKnowledgeAnswer[];
  };
  unknown: string[];
  evidence: ResearchEvidence[];
}
type Predicate = (record: ResearchEvidence) => boolean;

function uniqueContexts(
  records: readonly ResearchEvidence[],
): ResearchEvidence[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.contextId)) return false;
    seen.add(record.contextId);
    return true;
  });
}
const chosen = (
  record: ResearchEvidence,
  day: number,
  ids: readonly string[],
) =>
  record.action === "choose" &&
  record.day === day &&
  ids.includes(record.choice);
const inspected = (
  record: ResearchEvidence,
  topics: readonly ResearchTopic[],
) =>
  record.action === "inspect" &&
  topics.some((topic) => topic === record.choice);
const offered = (record: ResearchEvidence, topics: readonly ResearchTopic[]) =>
  getChapterTopics(record.day).some((topic) => topics.includes(topic));

/** 只归纳实际本局记录，不把收益、策略类型或工具选择换算为人的能力。 */
export function buildResearchProfile(state: ResearchState): ResearchProfile {
  const seen = new Set<string>();
  const records = state.evidence.filter((record) => {
    if (
      record.sessionId !== state.sessionId ||
      seen.has(record.id) ||
      record.day < 1 ||
      record.day > 8
    )
      return false;
    if (
      record.action === "inspect" &&
      !getChapterTopics(record.day).some((topic) => topic === record.choice)
    )
      return false;
    seen.add(record.id);
    return true;
  });
  function fact(
    id: string,
    label: string,
    match: Predicate,
    opportunity: Predicate,
    describe: (selected: ResearchEvidence[]) => string,
  ): ResearchFact {
    const selected = uniqueContexts(records.filter(match));
    return {
      id,
      label,
      count: selected.length,
      opportunities: uniqueContexts(records.filter(opportunity)).length,
      status: selected.length ? "observed" : "unobserved",
      text: selected.length
        ? describe(selected)
        : "本局未观察到对应的主动选择或查看，不视为拒绝。",
      evidenceIds: selected.map((record) => record.id),
    };
  }
  const attention = (selected: ResearchEvidence[], topic: string) =>
    selected.length >= 2
      ? `本局在${selected.length}个不同情境主动关注${topic}，实际选择和当时信息可展开。`
      : `本局一次主动关注${topic}，只记录本次事实，不概括长期偏好。`;
  const interests: ResearchFact[] = [
    fact(
      "return",
      "收益与统一对照",
      (record) =>
        chosen(record, 1, ["return"]) ||
        chosen(record, 4, ["comparison"]) ||
        inspected(record, ["comparison"]),
      (record) => record.day === 1 || offered(record, ["comparison"]),
      (selected) => attention(selected, "收益或统一条件的对照"),
    ),
    fact(
      "risk",
      "途中下跌",
      (record) =>
        chosen(record, 1, ["risk"]) ||
        chosen(record, 4, ["drawdown"]) ||
        inspected(record, ["drawdown"]),
      (record) => record.day === 1 || offered(record, ["drawdown"]),
      (selected) => attention(selected, "途中下跌"),
    ),
    fact(
      "cost",
      "费用与操作频率",
      (record) =>
        chosen(record, 1, ["cost"]) ||
        chosen(record, 7, ["stress30", "lower-frequency"]) ||
        inspected(record, ["cost"]),
      (record) => record.day === 1 || offered(record, ["cost"]),
      (selected) => attention(selected, "费用或操作频率"),
    ),
    fact(
      "data",
      "数据与验证依据",
      (record) =>
        chosen(record, 2, ["source", "quality"]) ||
        chosen(record, 6, ["validate", "explain"]) ||
        inspected(record, ["source", "quality", "validation"]),
      (record) => offered(record, ["source", "quality", "validation"]),
      (selected) => attention(selected, "数据或验证依据"),
    ),
  ];
  const validationRecords = records.filter(
    (record) =>
      record.action === "run" &&
      record.runIds.some((id) =>
        state.runs.some(
          (run) => run.id === id && run.config.segment === "validation",
        ),
      ),
  );
  const habits: ResearchFact[] = [
    fact(
      "data-check",
      "选择的数据核对重点",
      (record) => chosen(record, 2, ["source", "quality", "assisted"]),
      (record) => record.day === 2,
      (selected) =>
        `第二天选择“${selected[0]!.label}”。检查结果与核验数据分开保留，不由选择方式推断技术水平。`,
    ),
    fact(
      "manual-evidence",
      "手动展开研究资料",
      (record) =>
        inspected(record, ["source", "quality", "comparison", "validation"]),
      (record) =>
        offered(record, ["source", "quality", "comparison", "validation"]),
      (selected) =>
        `${selected.length >= 2 ? `在${selected.length}个不同情境` : "本局一次"}手动展开了资料；打开不等于已经理解。`,
    ),
    fact(
      "validation-run",
      "实际运行新数据检验",
      (record) => validationRecords.includes(record),
      (record) => offered(record, ["validation"]),
      () =>
        "实际运行过预留数据检验。研究段与检验段分别从1000开始，不拼成连续持仓；改参后是否仍有效以当前验证状态为准。",
    ),
  ];
  const allocation: ResearchFact[] = [
    fact(
      "intent",
      "最初表达的研究意图",
      (record) => chosen(record, 1, ["return", "risk", "cost"]),
      (record) => record.day === 1,
      (selected) =>
        `首先表示“${selected[0]!.label}”。这是本局自述，与实际操作和知识表现分开。`,
    ),
    fact(
      "rule",
      "实际保存的规则",
      (record) => chosen(record, 3, ["trend", "reversion", "hold"]),
      (record) => record.day === 3,
      (selected) =>
        `选择“${selected[0]!.label}”，当时保存为版本${selected[0]!.strategyVersion}。规则不同不代表能力或人格等级。`,
    ),
    fact(
      "allocation",
      "目标投入上限",
      (record) =>
        chosen(record, 5, ["allocate30", "allocate60", "cash"]) &&
        record.config !== null,
      (record) => record.day === 5,
      (selected) =>
        selected[0]!.allocation === 0
          ? "第五天选择保留全部现金，目标投入上限0%。这不是对风险或能力的总体判断。"
          : `第五天选择目标投入上限${selected[0]!.allocation * 100}%，实际成交仍受信号、价格、费用和成交量限制。`,
    ),
    fact(
      "cost-config",
      "实际费用与检查频率",
      (record) =>
        chosen(record, 7, ["fees10", "lower-frequency", "stress30"]) &&
        record.config !== null,
      (record) => record.day === 7,
      (selected) => {
        const config = selected[0]!.config!;
        return `当时按每${config.frequency}期检查、单笔${config.feeBps}基点费用重算研究段，保留原版结果；不把同一已揭晓段重新当作新数据。`;
      },
    ),
    fact(
      "final",
      "最后的研究决定",
      (record) => chosen(record, 8, ["simulate", "revise", "defer"]),
      (record) => record.day === 8,
      (selected) =>
        `最后选择“${selected[0]!.label}”。三种态度都完成策略展，不会因此启动外部交易。`,
    ),
  ];
  const firstIntent = records.find((record) => chosen(record, 1, ["return"]));
  const finalDefer = records.find((record) =>
    chosen(record, 8, ["defer", "revise"]),
  );
  if (firstIntent && finalDefer)
    allocation.push({
      id: "changed-position",
      label: "不同信息下的变化",
      count: 2,
      opportunities: 2,
      status: "mixed",
      text: "起初表达收益意图，最后选择修改或暂缓。保留两次情境，不把变化解释为矛盾人格。",
      evidenceIds: [firstIntent.id, finalDefer.id],
    });
  const tools: ResearchFact[] = [
    fact(
      "explanation",
      "说明与自动检查",
      (record) =>
        chosen(record, 2, ["assisted"]) ||
        chosen(record, 6, ["explain"]) ||
        inspected(record, ["explanation"]),
      (record) => offered(record, ["explanation"]),
      (selected) =>
        `本局在${selected.length}个情境选择说明或自动检查；这是工具使用记录，不能据此判断编程水平。`,
    ),
    fact(
      "details",
      "规则与交易细节",
      (record) =>
        chosen(record, 4, ["trades"]) || inspected(record, ["rule", "trades"]),
      (record) => offered(record, ["rule", "trades"]),
      (selected) =>
        `本局在${selected.length}个情境选择检查交易或手动查看细节；不会把自动生成的曲线当作主动查看代码。`,
    ),
  ];
  const answers: ResearchKnowledgeAnswer[] = [];
  for (const quiz of RESEARCH_QUIZZES) {
    const first = state.answers.find((answer) => answer.id === quiz.id);
    const record = records.find(
      (item) =>
        item.action === "answer" && item.choice.startsWith(`${quiz.id}:`),
    );
    if (
      !first ||
      !record ||
      record.choice !== `${quiz.id}:${first.answer}` ||
      record.day < quiz.day
    )
      continue;
    const selected = quiz.answers.find((answer) => answer.id === first.answer);
    if (!selected) continue;
    answers.push({
      id: quiz.id,
      prompt: quiz.prompt,
      selectedAnswer: selected.label,
      correct: first.answer === "no",
      explanation: quiz.explanation,
      evidenceId: record.id,
    });
  }
  const unknown: string[] = [];
  if (!validationRecords.length)
    unknown.push("没有实际运行预留数据检验，不能宣称策略已通过新样本验证。");
  if (state.validation === "needs-new-data")
    unknown.push("此前检验结果属于旧参数，当前版本仍需另一批新数据验证。");
  if (!answers.length)
    unknown.push("两道可选知识题尚未作答，不视为答错，也不填能力分。");
  else if (answers.length === 1)
    unknown.push("另一道知识题未作答，不进入正确率分母。");
  unknown.push("本局没有足够情境评估一般人格、编程能力或现实投资适当性。");
  const manualContexts = uniqueContexts(
    records.filter((record) => record.action === "inspect"),
  );
  return {
    title: manualContexts.length >= 2 ? "先看依据的研究搭档" : "本局研究记录",
    summary:
      "这里区分自述、实际研究操作和已答知识，不用模拟收益给人打分。未观察与信息变化同样保留。",
    sections: [
      {
        id: "interests",
        title: "量化研究兴趣",
        description: "只归纳实际选择的重点或主动展开的主题。",
        facts: interests,
      },
      {
        id: "habits",
        title: "数据与证据习惯",
        description: "选择重点、主动展开和实际运行分别记录。",
        facts: habits,
      },
      {
        id: "allocation",
        title: "策略与资金取舍",
        description: "保留当时规则、参数、意图与最后决定。",
        facts: allocation,
      },
      {
        id: "tools",
        title: "研究工具使用",
        description: "工具偏好不是编程能力或理解程度。",
        facts: tools,
      },
    ],
    knowledge: {
      answered: answers.length,
      correct: answers.filter((answer) => answer.correct).length,
      answers,
    },
    unknown,
    evidence: structuredClone(records),
  };
}

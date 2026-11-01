import { LOCATION_IDS } from "../game/content";
import {
  getAvailableResearchQuizzes,
  getChapter,
  RESEARCH_TOPICS,
} from "./chapters";
import { DATASET_VERSION, getDataIssues, getResearchData } from "./data";
import { getRuleDescription, runSimulation } from "./simulation";
import type {
  ResearchAction,
  ResearchEvidence,
  ResearchState,
  ResearchTopic,
  SimulationConfig,
  SimulationResult,
  StudySegment,
} from "./model";

export function createResearch(sessionId: string): ResearchState {
  if (!sessionId.trim()) throw new Error("研究局必须有非空标识");
  return {
    version: 3,
    sessionId,
    day: 1,
    phase: "travel",
    intent: null,
    dataFocus: null,
    rule: null,
    allocation: 1,
    frequency: 1,
    feeBps: 0,
    slippageBps: 0,
    strategyVersion: 0,
    validation: "unseen",
    finalDecision: null,
    runs: [],
    evidence: [],
    answers: [],
    processed: [],
    location: "square",
    feedback: "",
  };
}

function config(
  state: ResearchState,
  segment: StudySegment,
): SimulationConfig | null {
  return state.rule
    ? {
        rule: state.rule,
        allocation: state.allocation,
        frequency: state.frequency,
        feeBps: state.feeBps,
        slippageBps: state.slippageBps,
        initialCash: 1000,
        segment,
      }
    : null;
}
function context(day: number) {
  return `chapter-${day}`;
}
function hasValidation(state: ResearchState): boolean {
  return state.runs.some((run) => run.config.segment === "validation");
}
function run(state: ResearchState, segment: StudySegment): SimulationResult {
  const parameters = config(state, segment);
  if (!parameters) throw new Error("保存规则后才能运行研究");
  const result = runSimulation(parameters);
  if (!state.runs.some((previous) => previous.id === result.id))
    state.runs.push(result);
  if (segment === "validation") state.validation = "checked";
  return result;
}
function changeVersion(state: ResearchState): void {
  state.strategyVersion++;
  if (hasValidation(state)) state.validation = "needs-new-data";
}
function resultText(result: SimulationResult): string {
  const metrics = result.metrics;
  return (
    `净变动${(metrics.netReturn * 100).toFixed(1)}%，最大回撤${(metrics.maxDrawdown * 100).toFixed(1)}%，` +
    `实际成交${metrics.tradeCount}次，总费用${metrics.fees.toFixed(2)}模拟币。`
  );
}
function record(
  next: ResearchState,
  before: ResearchState,
  action: ResearchAction,
  kind: ResearchEvidence["action"],
  choice: string,
  label: string,
  outcome: string,
  related: readonly string[] = [],
): void {
  const known = before.evidence
    .filter(
      (item) =>
        item.contextId === context(before.day) && item.action === "inspect",
    )
    .map((item) => item.choice)
    .filter((topic): topic is ResearchTopic =>
      getChapter(before).topics.some((offered) => offered === topic),
    );
  if (kind === "inspect" && action.type === "inspect") known.push(action.topic);
  const relatedRuns = related.filter((id) =>
    next.runs.some((result) => result.id === id),
  );
  next.evidence.push({
    id: kind === "run" ? `${action.id}:run` : action.id,
    sessionId: next.sessionId,
    day: before.day,
    contextId: context(before.day),
    location: before.location,
    action: kind,
    choice,
    label,
    knownTopics: [...new Set(known)],
    options: getChapter(before).options.map((option) => option.label),
    runIds: [...new Set(relatedRuns)],
    rule: next.rule,
    allocation: next.allocation,
    config: config(
      next,
      relatedRuns.some((id) =>
        next.runs.some(
          (result) =>
            result.id === id && result.config.segment === "validation",
        ),
      ) && kind === "run"
        ? "validation"
        : "research",
    ),
    strategyVersion: next.strategyVersion,
    datasetVersion: DATASET_VERSION,
    validation: next.validation,
    outcome,
  });
}
function latestResearch(state: ResearchState): string[] {
  const result = [...state.runs]
    .reverse()
    .find((item) => item.config.segment === "research");
  return result ? [result.id] : [];
}
function mainChoice(
  next: ResearchState,
  optionId: string,
): SimulationResult | null {
  switch (next.day) {
    case 1:
      if (optionId !== "return" && optionId !== "risk" && optionId !== "cost")
        return null;
      next.intent = optionId;
      next.feedback = "研究意图已记下，接下来用同一份历史行情映射检验想法。";
      return null;
    case 2: {
      next.dataFocus =
        optionId === "source"
          ? "source"
          : optionId === "quality"
            ? "quality"
            : "assisted";
      const data = getResearchData();
      next.feedback =
        `本地检查使用${data[0]!.date}至${data.at(-1)!.date}的${data.length}期研究记录，` +
        `有${getDataIssues().length}条接收问题记录可逐条核对。各条路径统一使用已核验副本；未连接PandaData。`;
      return null;
    }
    case 3: {
      if (
        optionId !== "trend" &&
        optionId !== "reversion" &&
        optionId !== "hold"
      )
        throw new Error("未定义的买卖规则");
      next.rule = optionId;
      next.strategyVersion = 1;
      const result = run(next, "research");
      next.feedback = `规则版本1已保存，并沿竹材、松果价格实际执行。${getRuleDescription(next.rule)}${resultText(result)}`;
      return result;
    }
    case 4: {
      if (optionId !== "keep") {
        if (
          optionId !== "trend" &&
          optionId !== "reversion" &&
          optionId !== "hold"
        )
          throw new Error("未定义的买卖规则");
        next.rule = optionId;
        changeVersion(next);
      }
      const result = run(next, "research");
      next.feedback =
        `${optionId === "keep" ? "保留当前规则，再按同样条件核验" : "已换规则并保留旧版对照"}。` +
        `当前版本${next.strategyVersion}。${resultText(result)}未见数据还没有揭晓。`;
      return result;
    }
    case 5: {
      next.allocation =
        optionId === "allocate30" ? 0.3 : optionId === "allocate60" ? 0.6 : 0;
      changeVersion(next);
      const result = run(next, "research");
      next.feedback =
        `目标投入上限改为${next.allocation * 100}%，规则触发时才参与，实际成交还受量价和成本约束。` +
        `${resultText(result)}原版曲线仍然保留。`;
      return result;
    }
    case 6:
      if (optionId === "defer") {
        next.validation = "deferred";
        next.feedback =
          "你暂不采用，也还没有运行新数据检验。预留段保持不可见，第7、8天仍可明确选择运行；这条暂缓记录会保留。";
        return null;
      } else {
        const result = run(next, "validation");
        next.feedback =
          `${optionId === "explain" ? `${RESEARCH_TOPICS.validation.description} ` : ""}` +
          `新数据已首次检验，独立从1000模拟币起步。${resultText(result)}不能与研究段拼接成同一笔持仓。`;
        return result;
      }
    case 7: {
      next.feeBps = optionId === "stress30" ? 30 : 10;
      if (optionId === "lower-frequency") next.frequency = 5;
      changeVersion(next);
      const result = run(next, "research");
      next.feedback =
        `版本${next.strategyVersion}按每${next.frequency}期检查、单笔${next.feeBps}基点费用重算。` +
        `${resultText(result)}` +
        (next.validation === "needs-new-data"
          ? "旧检验保留，但当前参数需要另一批新数据；不能重用已揭晓段充当未见数据。"
          : "新数据还未揭晓，你仍可主动运行一次检验。") +
        (next.rule === "hold"
          ? "固定配置首期建仓后持有，改变检查频率不保证减少交易。"
          : "");
      return result;
    }
    case 8:
      next.finalDecision =
        optionId === "simulate"
          ? "simulate"
          : optionId === "revise"
            ? "revise"
            : "defer";
      next.feedback =
        optionId === "simulate"
          ? "展品已完成，你选择先做小规模模拟。这里只记录本局态度，不会启动外部交易；尚未完成的验证仍会写在策略卡上。"
          : optionId === "revise"
            ? "展品已完成，你选择保留这一版并说明要修改的地方。旧规则、结果和未解决问题都会一起带到策略展。"
            : "展品已完成，你选择暂不采用。这次研究为什么停下来，同样值得在策略展讲清楚，不需要靠盈利换取展示资格。";
      return null;
    default:
      return null;
  }
}

export function dispatchResearch(
  state: ResearchState,
  action: ResearchAction,
): ResearchState {
  if (
    state.version !== 3 ||
    action.day !== state.day ||
    !action.id.trim() ||
    state.processed.includes(action.id) ||
    state.evidence.some((item) => item.id === action.id)
  )
    return state;
  const reading = state.phase === "decision" || state.phase === "feedback";
  if (
    action.type === "arrive" &&
    (state.phase !== "travel" || !LOCATION_IDS.includes(action.location))
  )
    return state;
  if (
    action.type === "choose" &&
    (state.phase !== "decision" ||
      !getChapter(state).options.some(
        (option) => option.id === action.optionId,
      ) ||
      (state.day >= 4 && !state.rule))
  )
    return state;
  if (action.type === "continue" && state.phase !== "feedback") return state;
  if (
    action.type === "report" &&
    (state.phase !== "exhibit" || state.day !== 8)
  )
    return state;
  if (
    action.type === "inspect" &&
    (!reading ||
      !getChapter(state).topics.includes(action.topic) ||
      state.evidence.some(
        (item) =>
          item.contextId === context(state.day) &&
          item.action === "inspect" &&
          item.choice === action.topic,
      ))
  )
    return state;
  if (
    action.type === "answer" &&
    (!reading ||
      state.answers.some((answer) => answer.id === action.question) ||
      !getAvailableResearchQuizzes(state).some(
        (quiz) =>
          quiz.id === action.question &&
          quiz.answers.some((answer) => answer.id === action.answer),
      ))
  )
    return state;
  const next = structuredClone(state);
  next.processed.push(action.id);
  switch (action.type) {
    case "arrive":
      next.location = action.location;
      next.phase = "decision";
      next.feedback = "";
      break;
    case "choose": {
      const option = getChapter(state).options.find(
        (item) => item.id === action.optionId,
      )!;
      const result = mainChoice(next, action.optionId);
      next.phase = "feedback";
      const ids = [...latestResearch(state), ...(result ? [result.id] : [])];
      record(
        next,
        state,
        action,
        "choose",
        option.id,
        option.label,
        next.feedback,
        ids,
      );
      if (result)
        record(
          next,
          state,
          action,
          "run",
          result.config.segment,
          result.config.segment === "research"
            ? "运行研究段"
            : "首次运行新数据检验",
          resultText(result),
          [result.id],
        );
      break;
    }
    case "inspect": {
      const lateValidation =
        action.topic === "validation" &&
        state.day >= 7 &&
        state.rule !== null &&
        !hasValidation(state) &&
        (state.validation === "unseen" || state.validation === "deferred");
      const result = lateValidation ? run(next, "validation") : null;
      const oldValidation = [...state.runs]
        .reverse()
        .find((item) => item.config.segment === "validation");
      const ids = result
        ? [result.id]
        : action.topic === "validation"
          ? oldValidation
            ? [oldValidation.id]
            : []
          : latestResearch(state);
      record(
        next,
        state,
        action,
        "inspect",
        action.topic,
        RESEARCH_TOPICS[action.topic].label,
        result
          ? `你主动补做新数据检验。${resultText(result)}早先的暂缓证据保留。`
          : action.topic === "validation" &&
              state.validation === "needs-new-data"
            ? "查看的是旧参数的检验；当前版本仍需另一批新数据。"
            : RESEARCH_TOPICS[action.topic].description,
        ids,
      );
      if (result)
        record(
          next,
          state,
          action,
          "run",
          "validation",
          "主动补做新数据检验",
          resultText(result),
          [result.id],
        );
      break;
    }
    case "answer":
      next.answers.push({
        id: action.question,
        answer: action.answer,
        correct: action.answer === "no",
        day: state.day,
      });
      record(
        next,
        state,
        action,
        "answer",
        `${action.question}:${action.answer}`,
        action.question === "backtest"
          ? "回测理解题首次答案"
          : "费用理解题首次答案",
        action.answer === "no"
          ? "本题答对；只记录本题理解情况。"
          : "本题未答对，首次答案保留；解释可回看。",
        latestResearch(state),
      );
      break;
    case "continue":
      if (state.day === 8) {
        next.phase = "exhibit";
        next.location = "cafe";
      } else {
        next.day++;
        next.phase = "travel";
        next.feedback = "";
      }
      break;
    case "report":
      next.phase = "report";
      break;
  }
  return next;
}

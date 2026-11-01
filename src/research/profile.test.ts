import assert from "node:assert/strict";
import test from "node:test";
import { DATASET_VERSION } from "./data";
import { buildResearchProfile } from "./profile";
import { runSimulation } from "./simulation";
import type { ResearchEvidence, ResearchState } from "./model";

/** 只读画像的明确输入记录，不代替完整章节或模拟计算测试。 */
function state(): ResearchState {
  return {
    version: 3,
    sessionId: "profile-test",
    day: 8,
    phase: "report",
    intent: null,
    dataFocus: null,
    rule: "trend",
    allocation: 0.3,
    frequency: 1,
    feeBps: 10,
    slippageBps: 0,
    strategyVersion: 3,
    validation: "deferred",
    finalDecision: null,
    runs: [],
    evidence: [],
    answers: [],
    processed: [],
    location: "square",
    feedback: "",
  };
}
function evidence(id: string, day: number): ResearchEvidence {
  return {
    id,
    sessionId: "profile-test",
    day,
    contextId: `chapter-${day}`,
    location: "square",
    action: "inspect",
    choice: "cost",
    label: "费用与操作频率",
    knownTopics: ["cost"],
    options: ["实际展示的选项"],
    runIds: [],
    rule: "trend",
    allocation: 0.3,
    strategyVersion: 3,
    datasetVersion: DATASET_VERSION,
    config: {
      rule: "trend",
      allocation: 0.3,
      frequency: 1,
      feeBps: 10,
      slippageBps: 0,
      initialCash: 1000,
      segment: "research",
    },
    validation: "deferred",
    outcome: "主动展开费用解释，没有触发新的交易。",
  };
}

test("两个独立费用情境才描述多次关注，重复记录与外局记录不增加计数", () => {
  const input = state();
  input.evidence = [
    evidence("a", 7),
    evidence("repeat", 7),
    evidence("b", 8),
    { ...evidence("foreign", 8), sessionId: "another-session" },
  ];
  const before = structuredClone(input);
  const profile = buildResearchProfile(input);
  const fact = profile.sections
    .find((section) => section.id === "interests")!
    .facts.find((item) => item.id === "cost")!;
  assert.equal(fact.count, 2);
  assert.equal(fact.opportunities, 2);
  assert.match(fact.text, /两个|2个/);
  assert.equal(profile.evidence.length, 3);
  assert.deepEqual(input, before);
  assert.ok(
    fact.evidenceIds.every((id) =>
      profile.evidence.some((item) => item.id === id),
    ),
  );
});

test("没有记录时不从当前规则或仓位补造观察，知识保持未评估", () => {
  const profile = buildResearchProfile(state());
  assert.ok(
    profile.sections.every((section) =>
      section.facts.every(
        (fact) =>
          fact.count === 0 &&
          fact.opportunities === 0 &&
          fact.status === "unobserved",
      ),
    ),
  );
  assert.equal(profile.knowledge.answered, 0);
  assert.equal(profile.knowledge.correct, 0);
  assert.equal(profile.evidence.length, 0);
  assert.ok(profile.unknown.some((item) => item.includes("没有实际运行")));
});

test("知识只按首次答案和真实答题证据计数，错误后的改答不能洗成正确", () => {
  const input = state();
  input.answers = [
    { id: "backtest", answer: "yes", correct: false, day: 4 },
    { id: "backtest", answer: "no", correct: true, day: 4 },
    { id: "fees", answer: "no", correct: true, day: 7 },
  ];
  input.evidence = [
    {
      ...evidence("wrong", 4),
      action: "answer",
      choice: "backtest:yes",
      knownTopics: ["comparison"],
    },
    {
      ...evidence("retry", 4),
      action: "answer",
      choice: "backtest:no",
      knownTopics: ["comparison"],
    },
    { ...evidence("correct", 7), action: "answer", choice: "fees:no" },
  ];
  const knowledge = buildResearchProfile(input).knowledge;
  assert.equal(knowledge.answered, 2);
  assert.equal(knowledge.correct, 1);
  assert.equal(
    knowledge.answers.find((answer) => answer.id === "backtest")?.evidenceId,
    "wrong",
  );
  assert.equal(
    knowledge.answers.find((answer) => answer.id === "backtest")?.correct,
    false,
  );
});

test("旧参数曾运行检验与当前版本仍需新数据并列保留，不把费用变更洗成已验证", () => {
  const input = state();
  const oldRun = runSimulation({
    rule: "trend",
    allocation: 0.3,
    frequency: 1,
    feeBps: 0,
    slippageBps: 0,
    initialCash: 1000,
    segment: "validation",
  });
  input.validation = "needs-new-data";
  input.runs = [oldRun];
  input.evidence = [
    {
      ...evidence("old-validation-run", 6),
      action: "run",
      choice: "validation",
      label: "首次运行新数据检验",
      knownTopics: [],
      runIds: [oldRun.id],
      config: { ...oldRun.config },
      strategyVersion: 2,
      validation: "checked",
      outcome: "按当时零费用参数运行预留段，当前费用尚未修改。",
    },
    {
      ...evidence("fee-change", 7),
      action: "choose",
      choice: "fees10",
      label: "计入10基点费用",
      validation: "needs-new-data",
      outcome: "费用改变后旧检验保留，当前版本需要另一批新数据。",
    },
  ];
  const before = structuredClone(input);
  const profile = buildResearchProfile(input);
  const validation = profile.sections
    .find((section) => section.id === "habits")!
    .facts.find((fact) => fact.id === "validation-run")!;
  assert.equal(validation.count, 1);
  assert.deepEqual(validation.evidenceIds, ["old-validation-run"]);
  assert.ok(
    profile.unknown.some(
      (item) => item.includes("旧参数") && item.includes("当前版本"),
    ),
  );
  assert.ok(profile.unknown.every((item) => !item.includes("没有实际运行")));
  assert.equal(
    profile.evidence.find((record) => record.id === "old-validation-run")
      ?.config?.feeBps,
    0,
  );
  assert.equal(
    profile.evidence.find((record) => record.id === "fee-change")?.config
      ?.feeBps,
    10,
  );
  assert.deepEqual(input, before);
});

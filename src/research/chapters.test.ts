import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableResearchQuizzes, getChapter } from "./chapters";
import type { ResearchState } from "./model";

function state(day: number): ResearchState {
  return {
    version: 3,
    sessionId: "chapter-test",
    day,
    phase: "decision",
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

test("第三天各落点均可选择规则，短对话不重复地点说明", () => {
  const square = getChapter(state(3));
  const bakery = getChapter({ ...state(3), location: "bakery" });
  assert.equal(square.title, "买卖怎么定？");
  assert.deepEqual(
    square.options.map((option) => option.id),
    ["trend", "reversion", "hold"],
  );
  assert.deepEqual(bakery.options, square.options);
  assert.equal(bakery.dialogue, square.dialogue);
});

test("未运行和未来题不提前出现，费用题仅相关章节可答", () => {
  assert.deepEqual(getAvailableResearchQuizzes(state(3)), []);
  assert.deepEqual(getAvailableResearchQuizzes(state(4)), []);
  assert.deepEqual(
    getAvailableResearchQuizzes({ ...state(7), phase: "travel" }),
    [],
  );
  assert.deepEqual(
    getAvailableResearchQuizzes(state(7)).map((quiz) => quiz.id),
    ["fees"],
  );
  assert.deepEqual(
    getAvailableResearchQuizzes({ ...state(8), phase: "report" }),
    [],
  );
});

test("章六说明后检验和章八三种展示决定都有明确语义，返回副本不污染目录", () => {
  const sixth = getChapter(state(6));
  assert.match(
    sixth.options.find((option) => option.id === "explain")!.detail,
    /再运行检验/,
  );
  assert.deepEqual(
    getChapter(state(8)).options.map((option) => option.id),
    ["simulate", "revise", "defer"],
  );
  sixth.options[0]!.label = "外部修改";
  sixth.topics.length = 0;
  assert.notEqual(getChapter(state(6)).options[0]!.label, "外部修改");
  assert.ok(getChapter(state(6)).topics.includes("validation"));
});

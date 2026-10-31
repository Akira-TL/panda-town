import assert from "node:assert/strict";
import test from "node:test";
import type { ResearchSession } from "./model";
import { restoreResearchSession } from "./session";

function initial(): ResearchSession {
  return {
    research: {
      version: 3,
      sessionId: "restore-known",
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
    },
    position: "square",
    remaining: 0,
    die: 0,
    rolled: false,
    branch: false,
  };
}

test("版本3已知初始局可从JSON恢复，同一标识与状态不变", () => {
  const session = initial();
  assert.deepEqual(restoreResearchSession(JSON.stringify(session)), session);
});

test("旧开店记录、未知版本和损坏JSON拒绝，不混接证据", () => {
  for (const raw of ["{", "null", '{"game":{"rulesVersion":2}}'])
    assert.equal(restoreResearchSession(raw), null);
  const old = initial();
  assert.equal(
    restoreResearchSession(
      JSON.stringify({ ...old, research: { ...old.research, version: 2 } }),
    ),
    null,
  );
});

test("骰6行走到杂货岔路剩4步可恢复，步数与非岔路伪状态拒绝", () => {
  const paused: ResearchSession = {
    ...initial(),
    position: "grocery",
    remaining: 4,
    die: 6,
    rolled: true,
    branch: true,
  };
  assert.deepEqual(restoreResearchSession(JSON.stringify(paused)), paused);
  for (const broken of [
    { ...paused, position: "bakery" },
    { ...paused, remaining: 7 },
    { ...paused, remaining: -1 },
    { ...paused, rolled: false },
    { ...paused, position: "missing-place" },
  ])
    assert.equal(restoreResearchSession(JSON.stringify(broken)), null);
});

test("已到达的决策与移动上下文冲突时拒绝恢复", () => {
  const session = initial();
  session.research.phase = "decision";
  session.rolled = true;
  session.die = 1;
  assert.deepEqual(restoreResearchSession(JSON.stringify(session)), session);
  assert.equal(
    restoreResearchSession(JSON.stringify({ ...session, remaining: 1 })),
    null,
  );
  assert.equal(
    restoreResearchSession(JSON.stringify({ ...session, position: "bank" })),
    null,
  );
});

test("损坏的参数、重复已处理标识和不合规则答案不静默恢复", () => {
  for (const research of [
    { ...initial().research, allocation: 2 },
    { ...initial().research, day: 9 },
    { ...initial().research, feeBps: -1 },
    { ...initial().research, processed: ["x", "x"] },
    {
      ...initial().research,
      answers: [{ id: "fees", answer: "yes", correct: true, day: 1 }],
    },
    { ...initial().research, phase: "report", finalDecision: "simulate" },
  ])
    assert.equal(
      restoreResearchSession(JSON.stringify({ ...initial(), research })),
      null,
    );
});

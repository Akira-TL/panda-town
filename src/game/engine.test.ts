import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, visibleGame, currentPrice, type Effect, type GameState } from "./engine";

function choose(state: GameState, effect: Effect): GameState {
  const day = state.day;
  const opened = dispatch(state, {
    id: `open-${day}`,
    day,
    type: "open-event",
    event: {
      id: "E12",
      contextId: "E12",
      locationId: "square",
      options: [{ id: "choice", label: "选择", effect }],
    },
  });
  return dispatch(opened, { id: `choose-${day}`, day, type: "choose", optionId: "choice" });
}
function turn(state: GameState, effect: Effect): GameState {
  return dispatch(choose(state, effect), { id: `end-${state.day}`, day: state.day, type: "end-turn" });
}
function finish(state: GameState, sellStall = false, sellInvestment = false): GameState {
  return dispatch(state, { id: "finish", day: 8, type: "finish", sellStall, sellInvestment });
}
test("四次工作与四次观察：3200，开店后200；八次工作4200", () => {
  let state = createGame("one", "A");
  for (let d = 1; d <= 8; d++) state = turn(state, { kind: d <= 4 ? "work" : "observe" });
  assert.equal(state.cash, 3200);
  state = finish(state);
  assert.equal(state.cash, 200);
  assert.equal(state.result?.opened, true);
  assert.equal(finish(state), state);
  let worker = createGame("two", "B");
  for (let d = 1; d <= 8; d++) worker = turn(worker, { kind: "work" });
  assert.equal(worker.cash, 4200);
});
test("第二天购摊，六次经营收入，两次工作，终局3180", () => {
  let state = createGame("stall", "A");
  for (let d = 1; d <= 8; d++)
    state = turn(state, d === 2 ? { kind: "buy-stall" } : { kind: d <= 3 ? "work" : "observe" });
  assert.equal(state.cash, 2700);
  state = finish(state, true);
  assert.equal(state.result?.cashBeforeOpening, 3180);
  assert.equal(state.cash, 180);
});
test("工具当日影响已经营摊位，合购次日交付", () => {
  let ordinary = turn(createGame("ordinary", "A"), { kind: "buy-stall" });
  ordinary = turn(ordinary, { kind: "buy-tool", quality: "premium" });
  assert.equal(ordinary.cash, 660); // 1000-600+150-180+150+140
  let coop = turn(createGame("coop", "A"), { kind: "buy-stall" });
  coop = choose(coop, { kind: "cooperate" });
  assert.deepEqual(coop.assets.tool, { status: "pending", deliveryDay: 3 });
  assert.equal(coop.cash, 450);
  const duplicate = dispatch(coop, { id: "another", day: 2, type: "choose", optionId: "choice" });
  assert.equal(duplicate, coop);
  coop = dispatch(coop, { id: "end-2", day: 2, type: "end-turn" });
  assert.equal(coop.cash, 700);
  assert.deepEqual(coop.assets.tool, { status: "owned", quality: "premium" });
  coop = turn(coop, { kind: "observe" });
  assert.equal(coop.cash, 990);
});
test("投资情境独立报价、终局卖出220或180", () => {
  for (const [scenario, expected] of [
    ["A", 2220],
    ["B", 2180],
  ] as const) {
    let state = turn(createGame("invest", scenario), { kind: "invest", amount: 200 });
    assert.equal(currentPrice(state), 100);
    assert.equal("scenario" in visibleGame(state), false);
    for (let d = 2; d <= 8; d++) state = turn(state, { kind: "observe" });
    state = finish(state, false, true);
    assert.equal(state.cash, expected);
    assert.equal(state.result?.opened, false);
  }
});
test("决策幂等、阶段锁、恢复、旧日提交均不重复入账且输入不变", () => {
  const original = createGame("idempotent", "A");
  const state = choose(original, { kind: "work" });
  assert.equal(original.cash, 1000);
  assert.equal(state.cash, 1250);
  const restored: GameState = JSON.parse(JSON.stringify(state));
  assert.equal(dispatch(restored, { id: "choose-1", day: 1, type: "choose", optionId: "choice" }), restored);
  const next = dispatch(restored, { id: "end-1", day: 1, type: "end-turn" });
  assert.equal(next.cash, 1400);
  assert.equal(dispatch(next, { id: "old", day: 1, type: "end-turn" }), next);
  assert.equal(
    dispatch({ ...next, rulesVersion: 999 }, { id: "invalid", day: 2, type: "end-turn" }).cash,
    1400,
  );
});
test("余额不足禁用选项，资料比较要求不同来源，题目首次答复冻结", () => {
  let state = createGame("evidence", "A");
  state.cash = 50;
  state = dispatch(state, {
    id: "event",
    day: 1,
    type: "open-event",
    event: {
      id: "E04",
      contextId: "E04",
      locationId: "research",
      options: [{ id: "buy", label: "买", effect: { kind: "consume", itemId: "bread", amount: 60 } }],
      materials: [
        { id: "a", sourceId: "a", text: "甲" },
        { id: "b", sourceId: "b", text: "乙" },
      ],
      questions: [
        {
          id: "K01",
          prompt: "120-100",
          answers: [
            { id: "20", label: "20" },
            { id: "30", label: "30" },
          ],
          correctAnswerId: "20",
          explanation: "减法",
        },
      ],
    },
  });
  assert.equal(state.event?.options[0]?.shortfall, 10);
  assert.equal(dispatch(state, { id: "bad", day: 1, type: "choose", optionId: "buy" }), state);
  assert.equal(dispatch(state, { id: "compare", day: 1, type: "compare", materialIds: ["a", "b"] }), state);
  state = dispatch(state, { id: "inspect-a", day: 1, type: "inspect", materialId: "a" });
  state = dispatch(state, { id: "inspect-b", day: 1, type: "inspect", materialId: "b" });
  state = dispatch(state, { id: "compare", day: 1, type: "compare", materialIds: ["a", "b"] });
  state = dispatch(state, { id: "answer", day: 1, type: "answer", questionId: "K01", answerId: "30" });
  assert.equal(state.evidence.at(-1)?.correct, false);
  assert.equal(
    dispatch(state, { id: "correct-later", day: 1, type: "answer", questionId: "K01", answerId: "20" }),
    state,
  );
  assert.equal(state.evidence.length, 4);
});
test("第四天买入分数份额，现金出售四舍五入，第八天禁止新投资和合购", () => {
  let state = createGame("fraction", "B");
  for (let d = 1; d <= 3; d++) state = turn(state, { kind: "observe" });
  state = turn(state, { kind: "invest", amount: 200 });
  assert.equal(state.assets.investment?.shares, 200 / 120);
  for (let d = 5; d <= 7; d++) state = turn(state, { kind: "observe" });
  state = turn(state, { kind: "observe" });
  assert.equal(finish(state, false, true).cash, 2150); // 1000+1200-200+150
  let late = createGame("late", "A");
  for (let d = 1; d <= 7; d++) late = turn(late, { kind: "observe" });
  const rejected = choose(late, { kind: "invest", amount: 200 });
  assert.equal(rejected.phase, "decision");
  assert.equal(rejected.event?.options[0]?.available, false);
  const cooperation = choose(late, { kind: "cooperate" });
  assert.equal(cooperation.event?.options[0]?.available, false);
});

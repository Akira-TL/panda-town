import assert from "node:assert/strict";
import test from "node:test";
import { createTradingGame, dispatchTrading } from "../engine";
import { createLearningState, recordLearningAction } from "./state";
import { getKnowledgePrompt } from "./knowledge";
import {
  clearLearningStorage,
  LEARNING_STORAGE_KEY,
  restoreLearningState,
  saveLearningState,
} from "./storage";
import type { LearningState } from "./types";

function fixture() {
  const moving = dispatchTrading(createTradingGame("learning-storage"), {
    type: "start-round",
    id: "round:1",
  });
  const game = dispatchTrading(moving, {
    type: "arrive",
    id: "arrival:1",
    location: "bakery",
  });
  let state = createLearningState(game.sessionId);
  state = recordLearningAction(state, game, {
    type: "indicator",
    id: "view",
    indicator: "macd",
    interaction: "view",
    index: game.marketIndex,
    product: "bread",
  });
  const prompt = getKnowledgePrompt(game, state, "bread")!;
  state = recordLearningAction(state, game, {
    type: "answer",
    id: "answer",
    promptId: prompt.id,
    answerId: "a",
    product: "bread",
  });
  state = recordLearningAction(state, game, {
    type: "set-rule",
    id: "rule",
    product: "bread",
    rule: { entry: "ema", allocation: 0.5, exit: "manual" },
  });
  return { game, state };
}
test("学习记录按本局真实到达情境重放，保持首次答案及明确规则", () => {
  const { game, state } = fixture();
  assert.deepEqual(restoreLearningState(JSON.stringify(state), game), state);
  const report = dispatchTrading(game, { type: "settle", id: "settle" });
  assert.deepEqual(restoreLearningState(JSON.stringify(state), report), state);
  assert.equal(
    restoreLearningState(
      JSON.stringify(state),
      createTradingGame("another-session"),
    ),
    null,
  );
});
test("篡改正确、选项、指标触发、未来索引、动作标识或规则不能被信任", () => {
  const { game, state } = fixture();
  const corruptions: Array<(state: LearningState) => void> = [
    (changed) => {
      const event = changed.events.find((event) => event.kind === "knowledge")!;
      if (event.kind === "knowledge") event.correct = false;
    },
    (changed) => {
      const event = changed.events.find((event) => event.kind === "knowledge")!;
      if (event.kind === "knowledge")
        event.prompt.options[0]!.label = "虚构答案";
    },
    (changed) => {
      const event = changed.events[0]!;
      if (event.kind === "indicator") event.triggered = true;
    },
    (changed) => {
      changed.events[0]!.marketIndex++;
    },
    (changed) => {
      changed.events[0]!.location = "bank";
    },
    (changed) => {
      changed.events.push(structuredClone(changed.events[0]!));
    },
    (changed) => {
      changed.rule = { entry: "manual", allocation: 0.25, exit: "manual" };
    },
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(state);
    corrupt(changed);
    assert.equal(restoreLearningState(JSON.stringify(changed), game), null);
  }
  for (const raw of [
    "null",
    "[]",
    "{",
    JSON.stringify({ ...state, version: 2 }),
    JSON.stringify({ ...state, events: [null] }),
  ])
    assert.equal(restoreLearningState(raw, game), null);
});
test("删除和保存拒绝均返回失败，不虚报已删除；本机键固定且序列化不改原记录", () => {
  const { state } = fixture();
  const calls: string[] = [];
  const before = structuredClone(state);
  assert.equal(
    clearLearningStorage({
      removeItem: (key) => {
        calls.push(key);
      },
    }),
    true,
  );
  assert.deepEqual(calls, ["panda-town.learning.v1"]);
  assert.equal(LEARNING_STORAGE_KEY, calls[0]);
  assert.equal(
    clearLearningStorage({
      removeItem: () => {
        throw new Error("denied");
      },
    }),
    false,
  );
  assert.equal(
    saveLearningState(
      {
        setItem: () => {
          throw new Error("denied");
        },
      },
      state,
    ),
    false,
  );
  let written = "";
  assert.equal(
    saveLearningState(
      {
        setItem: (key, value) => {
          assert.equal(key, LEARNING_STORAGE_KEY);
          written = value;
        },
      },
      state,
    ),
    true,
  );
  assert.deepEqual(JSON.parse(written) as LearningState, state);
  assert.deepEqual(state, before);
});

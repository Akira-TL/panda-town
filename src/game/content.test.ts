import assert from "node:assert/strict";
import test from "node:test";
import { createGame, dispatch, type GameState } from "./engine";
import {
  getDecisionFeedback,
  getEventDialogue,
  getEventForLocation,
  type LocationId,
} from "./content";

function choose(
  state: GameState,
  location: LocationId,
  optionId: string,
): GameState {
  const opened = dispatch(state, {
    type: "open-event",
    id: `open-${state.day}`,
    day: state.day,
    event: getEventForLocation(state, location),
  });
  return dispatch(opened, {
    type: "choose",
    id: `choice-${state.day}`,
    day: state.day,
    optionId,
  });
}
function tomorrow(state: GameState): GameState {
  return dispatch(state, {
    type: "end-turn",
    id: `night-${state.day}`,
    day: state.day,
  });
}
test("面包店记住实际口味，重访不重复购买或赠送", () => {
  const ordinary = tomorrow(
    choose(createGame("bread-ordinary", "A"), "bakery", "ordinary"),
  );
  const novel = tomorrow(
    choose(createGame("bread-novel", "A"), "bakery", "novel"),
  );
  assert.equal(getEventForLocation(ordinary, "bakery").id, "E12");
  const before = structuredClone(ordinary);
  assert.match(getEventDialogue(ordinary, "E12", "bakery").text, /普通面包/);
  assert.match(getEventDialogue(novel, "E12", "bakery").text, /新口味礼盒/);
  assert.deepEqual(ordinary, before);
  assert.equal(ordinary.assets.items.length, 1);
});
test("未消费时不伪造礼物，实用和新奇礼物有不同回话", () => {
  const initial = createGame("gift-empty", "A");
  assert.ok(!getEventDialogue(initial, "E12", "gifts").text.includes("送到"));
  const practical = choose(initial, "gifts", "practical");
  const novel = choose(createGame("gift-novel", "A"), "gifts", "novel");
  assert.match(getDecisionFeedback(practical).text, /实用礼物/);
  assert.match(getDecisionFeedback(novel).text, /新奇礼物/);
  assert.match(
    getEventDialogue(tomorrow(novel), "E12", "gifts").text,
    /不会变成金币/,
  );
});
test("摊位购买与重访说明生效时机，不让看回话产生收入", () => {
  const bought = choose(createGame("stall-story", "A"), "market", "buy");
  assert.match(getDecisionFeedback(bought).text, /明天起经营/);
  const next = tomorrow(bought),
    cash = next.cash;
  assert.match(getEventDialogue(next, "E12", "market").text, /回合末统一到账/);
  assert.equal(next.cash, cash);
});
test("合购待交货与已有工具的后续回话符合真实状态", () => {
  const day2 = tomorrow(
    choose(createGame("delivery-story", "A"), "square", "work"),
  );
  const ordered = choose(day2, "bridge", "cooperate");
  assert.match(getDecisionFeedback(ordered).text, /第 3 天开头交付/);
  assert.match(
    getEventDialogue(ordered, "E12", "grocery").text,
    /不会提前增加/,
  );
  const delivered = tomorrow(ordered);
  assert.equal(delivered.assets.tool.status, "owned");
  assert.match(getEventDialogue(delivered, "E12", "grocery").text, /优质工具/);
});
test("修理摊两种方法解决同一问题，但保留各自实际代价", () => {
  const helped = choose(createGame("repair-help", "A"), "repair", "help");
  const expert = choose(createGame("repair-expert", "A"), "repair", "expert");
  assert.equal(helped.cash, 1000);
  assert.equal(expert.cash, 940);
  assert.match(getDecisionFeedback(helped).text, /留下来搭把手/);
  assert.match(getDecisionFeedback(expert).text, /60 金币/);
  assert.match(
    getEventDialogue(tomorrow(helped), "E12", "repair").text,
    /多亏你/,
  );
  assert.match(
    getEventDialogue(tomorrow(expert), "E12", "repair").text,
    /不再重复付/,
  );
});
test("花园与音乐角有不同故事，但仍是同一个基础情境", () => {
  const garden = choose(createGame("garden-story", "A"), "garden", "talk");
  const music = choose(createGame("music-story", "A"), "music", "talk");
  assert.match(getDecisionFeedback(garden).text, /花园/);
  assert.match(getDecisionFeedback(music).text, /乐手/);
  assert.equal(garden.evidence[0]?.contextId, music.evidence[0]?.contextId);
});
test("未展开资料不冒称已读，真实比较后反馈引用实际动作", () => {
  const unread = choose(createGame("unread-story", "A"), "research", "review");
  assert.match(getDecisionFeedback(unread).text, /没有展开资料/);
  let state = createGame("read-story", "A");
  state = dispatch(state, {
    type: "open-event",
    id: "open",
    day: 1,
    event: getEventForLocation(state, "research"),
  });
  state = dispatch(state, {
    type: "inspect",
    id: "read-record",
    day: 1,
    materialId: "sales-record",
  });
  state = dispatch(state, {
    type: "inspect",
    id: "read-rumor",
    day: 1,
    materialId: "sales-rumor",
  });
  state = dispatch(state, {
    type: "compare",
    id: "compare",
    day: 1,
    materialIds: ["sales-record", "sales-rumor"],
  });
  state = dispatch(state, {
    type: "choose",
    id: "review",
    day: 1,
    optionId: "review",
  });
  assert.match(getDecisionFeedback(state).detail, /主动比较了两份不同来源/);
  assert.equal(state.cash, 1000);
});
test("临时工作反馈使用实际地点的任务且不额外入账", () => {
  const state = choose(createGame("work-story", "A"), "bakery", "work");
  const before = structuredClone(state);
  assert.match(getDecisionFeedback(state).text, /新鲜面包装好/);
  assert.equal(state.cash, 1250);
  assert.deepEqual(state, before);
});

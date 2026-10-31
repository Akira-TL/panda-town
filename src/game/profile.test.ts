import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  dispatch,
  type GameState,
  type GameAction,
} from "./engine";
import {
  getEventForLocation,
  LOCATIONS,
  LOCATION_IDS,
  type LocationId,
} from "./content";
import { buildProfile } from "./profile";

function driver(initial = createGame("profile-test", "A")) {
  let state = initial;
  let sequence = 0;
  return {
    get state() {
      return state;
    },
    act(
      payload:
        | Omit<Extract<GameAction, { type: "choose" }>, "id" | "day">
        | Omit<Extract<GameAction, { type: "inspect" }>, "id" | "day">
        | Omit<Extract<GameAction, { type: "compare" }>, "id" | "day">
        | Omit<Extract<GameAction, { type: "answer" }>, "id" | "day">,
    ) {
      state = dispatch(state, {
        ...payload,
        id: `action-${++sequence}`,
        day: state.day,
      });
    },
    open(location: LocationId) {
      state = dispatch(state, {
        type: "open-event",
        id: `open-${++sequence}`,
        day: state.day,
        event: getEventForLocation(state, location),
      });
    },
    end() {
      state = dispatch(state, {
        type: "end-turn",
        id: `end-${++sequence}`,
        day: state.day,
      });
    },
  };
}
test("十六个地点都有合法路线、完整选项与工作兜底", () => {
  assert.equal(LOCATIONS.length, 16);
  const state = createGame("locations", "A");
  for (const place of LOCATIONS) {
    assert.ok(place.next.every((id) => LOCATION_IDS.includes(id)));
    const event = getEventForLocation(state, place.id);
    assert.equal(event.options.length, 3);
    assert.equal(
      event.options.filter((o) => o.effect.kind === "work").length,
      1,
    );
  }
});
test("空报告保留未知，不填人格分数或知识分母", () => {
  const report = buildProfile([]);
  assert.equal(report.title.label, "初来小镇的店长");
  assert.equal(report.knowledge.status, "not-assessed");
  assert.equal(report.knowledge.answered, 0);
  assert.ok(report.personality.every((f) => f.status !== "observed"));
  assert.equal(
    report.personality.find((f) => f.id === "emotional-stability")?.status,
    "not-assessed",
  );
});
test("四次实际工作即使同属盘点情境也能获得工作称号", () => {
  const d = driver();
  for (let i = 0; i < 4; i++) {
    d.open("square");
    d.act({ type: "choose", optionId: "work" });
    d.end();
  }
  const report = buildProfile(d.state.evidence);
  assert.equal(report.title.label, "踏实筹备的店长");
  assert.equal(report.trading.find((f) => f.id === "work")?.count, 4);
});
test("两处新奇消费才有探索线索，证据保留当时选择与约束", () => {
  const d = driver();
  d.open("bakery");
  d.act({ type: "choose", optionId: "novel" });
  d.end();
  d.open("gifts");
  d.act({ type: "choose", optionId: "novel" });
  const report = buildProfile(d.state.evidence);
  const novelty = report.consumption.find((f) => f.id === "novel");
  assert.equal(novelty?.count, 2);
  assert.equal(novelty?.opportunities, 2);
  assert.equal(
    report.personality.find((f) => f.id === "openness")?.status,
    "observed",
  );
  assert.equal(report.evidence[0]?.cashBefore, 1000);
  assert.equal(report.evidence[0]?.cashAfter, 880);
});
test("不同方向消费并列呈现，不概括一致探索人格", () => {
  const d = driver();
  d.open("bakery");
  d.act({ type: "choose", optionId: "ordinary" });
  d.end();
  d.open("gifts");
  d.act({ type: "choose", optionId: "novel" });
  const report = buildProfile(d.state.evidence);
  assert.equal(report.consumption.find((f) => f.id === "novel")?.count, 1);
  assert.equal(
    report.consumption.find((f) => f.id === "conventional")?.count,
    1,
  );
  assert.equal(
    report.personality.find((f) => f.id === "openness")?.status,
    "insufficient",
  );
});
test("余额不足的商品不形成主动消费机会或拒绝", () => {
  const initial: GameState = {
    ...createGame("cash-constrained", "A"),
    cash: 50,
  };
  const d = driver(initial);
  d.open("bakery");
  d.act({ type: "choose", optionId: "work" });
  const report = buildProfile(d.state.evidence);
  assert.equal(
    report.consumption.find((f) => f.id === "novel")?.opportunities,
    0,
  );
  assert.equal(
    report.consumption.find((f) => f.id === "conventional")?.count,
    0,
  );
  assert.equal(
    report.evidence[0]?.options.filter((o) => !o.available).length,
    2,
  );
});
test("相同情境重复查看比较不增加独立资料证据", () => {
  const d = driver();
  for (let i = 0; i < 2; i++) {
    d.open("notice");
    d.act({ type: "inspect", materialId: "sales-record" });
    d.act({ type: "inspect", materialId: "sales-rumor" });
    d.act({ type: "compare", materialIds: ["sales-record", "sales-rumor"] });
    d.act({ type: "choose", optionId: "review" });
    d.end();
  }
  const report = buildProfile(d.state.evidence);
  assert.equal(report.information.find((f) => f.id === "compare")?.count, 1);
  assert.equal(report.title.label, "初来小镇的店长");
});
test("不同来源在两个独立情境比较后触发看账称号", () => {
  const d = driver();
  d.open("research");
  d.act({ type: "inspect", materialId: "sales-record" });
  d.act({ type: "inspect", materialId: "sales-rumor" });
  d.act({ type: "compare", materialIds: ["sales-record", "sales-rumor"] });
  d.act({ type: "choose", optionId: "review" });
  d.end();
  d.open("dock");
  d.act({ type: "inspect", materialId: "supply-wish" });
  d.act({ type: "inspect", materialId: "supply-trade" });
  d.act({ type: "compare", materialIds: ["supply-wish", "supply-trade"] });
  const report = buildProfile(d.state.evidence);
  assert.equal(report.title.label, "细心看账的店长");
  assert.equal(report.information.find((f) => f.id === "compare")?.count, 2);
  assert.equal(
    report.interests.find((f) => f.id === "data")?.status,
    "observed",
  );
});
test("题目首次作答计分，重复改答不计入，未答题不当作错误", () => {
  const d = driver();
  d.open("research");
  d.act({ type: "answer", questionId: "K01", answerId: "30" });
  d.act({ type: "answer", questionId: "K01", answerId: "20" });
  let report = buildProfile(d.state.evidence);
  assert.equal(report.knowledge.answered, 1);
  assert.equal(report.knowledge.correct, 0);
  assert.equal(report.knowledge.answers[0]?.selectedAnswer, "30");
  d.act({ type: "choose", optionId: "review" });
  d.end();
  d.open("dock");
  d.act({ type: "answer", questionId: "K02", answerId: "B" });
  report = buildProfile(d.state.evidence);
  assert.equal(report.knowledge.answered, 2);
  assert.equal(report.knowledge.correct, 1);
});
test("投资占比以当时现金为分母，不使用后来的结局余额", () => {
  const d = driver();
  d.open("bank");
  d.act({ type: "choose", optionId: "small" });
  d.end();
  assert.equal(d.state.cash, 950);
  const report = buildProfile(d.state.evidence);
  assert.equal(report.investments[0]?.fractionOfCash, 0.2);
  assert.equal(report.investments[0]?.cashBefore, 1000);
});
test("花园和音乐角变体属于同一情境，不堆积社交或兴趣证据", () => {
  const d = driver();
  d.open("garden");
  d.act({ type: "choose", optionId: "talk" });
  d.end();
  d.open("music");
  d.act({ type: "choose", optionId: "talk" });
  const report = buildProfile(d.state.evidence);
  assert.equal(report.interests.find((f) => f.id === "residents")?.count, 1);
  assert.equal(
    report.personality.find((f) => f.id === "extraversion")?.status,
    "insufficient",
  );
});
test("事件前提与重复物件回退不泄漏未来报价", () => {
  const d = driver();
  d.open("bakery");
  d.act({ type: "choose", optionId: "ordinary" });
  d.end();
  assert.equal(getEventForLocation(d.state, "bakery").id, "E12");
  assert.equal(getEventForLocation({ ...d.state, day: 8 }, "bank").id, "E12");
  const quote = getEventForLocation(d.state, "bank").materials?.[0]?.text ?? "";
  assert.ok(quote.includes("当前报价 100"));
  assert.ok(!quote.includes("110"));
});
test("画像构建不改变输入，重复同一证据编号不重复计算", () => {
  const d = driver();
  d.open("bank");
  d.act({ type: "choose", optionId: "large" });
  const before = structuredClone(d.state.evidence);
  const report = buildProfile([...d.state.evidence, ...d.state.evidence]);
  assert.deepEqual(d.state.evidence, before);
  assert.equal(report.evidence.length, 1);
  assert.ok(
    report.consumption
      .concat(report.trading, report.information, report.personality)
      .every((f) =>
        f.evidenceIds.every((id) => report.evidence.some((e) => e.id === id)),
      ),
  );
});

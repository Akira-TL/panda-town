import assert from "node:assert/strict";
import test from "node:test";
import {
  createTradingGame,
  dispatchTrading,
  getAccountSnapshot,
} from "../engine";
import type { TradingGame } from "../model";
import {
  buildOpponent,
  calculateMaximumDrawdown,
  replayAccount,
} from "./accounts";
import { buildLearningSummary } from "./summary";
import { createLearningState } from "./state";

function next(game: TradingGame, buy = false): TradingGame {
  const round = game.round + 1;
  const moving = dispatchTrading(game, {
    type: "start-round",
    id: `round:${round}`,
  });
  const arrived = dispatchTrading(moving, {
    type: "arrive",
    id: `arrival:${round}`,
    location: "bakery",
  });
  return buy
    ? dispatchTrading(arrived, { type: "buy", id: `buy:${round}`, quantity: 1 })
    : dispatchTrading(arrived, { type: "hold", id: `hold:${round}` });
}
test("回撤独立手算从已观察高点计算，不把上涨幅度或日内影线当账户亏损", () => {
  assert.equal(calculateMaximumDrawdown([1000, 1200, 900, 1100]), 0.25);
  assert.equal(calculateMaximumDrawdown([1000, 1100, 1200]), 0);
  assert.equal(calculateMaximumDrawdown([1000, 0]), 1);
  assert.equal(calculateMaximumDrawdown([]), 0);
  assert.throws(() => calculateMaximumDrawdown([1000, NaN]), RangeError);
});
test("账户曲线保留到达和扣费时点，实际期末余额等于真实账本", () => {
  let game = next(createTradingGame("curve-test"), true);
  const first = replayAccount(game);
  assert.equal(first.curve.length, 3);
  assert.equal(first.curve[0]!.equity, 1000);
  assert.equal(first.curve[1]!.equity, 1000);
  // BTC 01-21收归一113.43060186372574，买1仅费用降低总资产。
  assert.ok(Math.abs(first.curve[2]!.equity - 999.8865693981363) < 1e-9);
  assert.ok(
    Math.abs(
      calculateMaximumDrawdown(first.curve.map((point) => point.equity)) -
        0.00011343060186372574,
    ) < 1e-12,
  );
  for (let round = 2; round <= 12; round++) game = next(game);
  const reconstructed = replayAccount(game);
  const actual = getAccountSnapshot(game);
  assert.equal(reconstructed.curve.length, 25);
  assert.deepEqual(getAccountSnapshot(reconstructed.account), actual);
  assert.equal(reconstructed.curve.at(-1)!.equity, actual.totalAssets);
  const snapshot = structuredClone(game);
  buildLearningSummary(game, createLearningState(game.sessionId));
  assert.deepEqual(game, snapshot);
});
test("公开固定商人同起点同落点一轮一行动，延长已知历史不改先前决定", () => {
  let game = createTradingGame("opponent-test");
  for (let round = 1; round <= 12; round++) game = next(game);
  const prefix = buildOpponent(game);
  assert.equal(prefix.curve[0]!.equity, 1000);
  assert.equal(prefix.summary.actions.length, 12);
  assert.equal(
    new Set(prefix.summary.actions.map((action) => action.round)).size,
    12,
  );
  assert.ok(
    prefix.summary.actions.every((action) => action.product === "bread"),
  );
  assert.ok(
    prefix.summary.actions.every(
      (action) => action.fee >= 0 && action.quantity >= 0,
    ),
  );
  assert.match(prefix.summary.description, /一行动/);
  for (let round = 13; round <= 60; round++) game = next(game);
  const extended = buildOpponent(game);
  assert.deepEqual(
    extended.summary.actions.slice(0, 12),
    prefix.summary.actions,
  );
  assert.deepEqual(extended.curve.slice(0, prefix.curve.length), prefix.curve);
  assert.ok(extended.summary.actions.some((action) => action.action === "buy"));
  assert.ok(
    extended.summary.actions.some((action) => action.action === "sell"),
  );
  const moving = dispatchTrading(game, { type: "start-round", id: "round:61" });
  const decision = dispatchTrading(moving, {
    type: "arrive",
    id: "arrival:61",
    location: "grocery",
  });
  const pending = buildOpponent(decision);
  assert.equal(pending.summary.actions.length, 60);
  assert.equal(pending.curve.at(-1)!.stage, "arrival");
  assert.equal(pending.curve.at(-1)!.marketIndex, decision.marketIndex);
});
test("没有作答或采用规则时，结算问题与复制文本保留未知而非生成能力标签", () => {
  const game = next(createTradingGame("summary-test"));
  const summary = buildLearningSummary(
    game,
    createLearningState(game.sessionId),
  );
  assert.equal(summary.ruleLabel, "本局手动交易");
  assert.equal(summary.knowledge.answered, 0);
  assert.match(summary.question, /规则|条件/);
  assert.doesNotMatch(summary.question, /这几次|已经盈利|已掌握|能力等级/);
  assert.match(summary.copyText, /总资产1000.00/);
  assert.match(summary.copyText, /费用0.00/);
  assert.match(summary.copyText, /不是真实证券代码/);
  assert.ok(summary.facts.every((fact) => !/能力分|人格等级/.test(fact)));
});

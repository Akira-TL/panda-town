import assert from "node:assert/strict";
import test from "node:test";
import { LOCATIONS } from "../game/content";
import { getQuote } from "./market";
import {
  advanceTradingStep,
  applyTradingAction,
  chooseTradingBranch,
  rollTradingSession,
} from "./navigation";
import { freshTradingSession, restoreTradingSession } from "./session";
import type { TradingSession } from "./model";

function restored(session: TradingSession): void {
  assert.deepEqual(restoreTradingSession(JSON.stringify(session)), session);
}
function arrive(session: TradingSession): TradingSession {
  let next = rollTradingSession(session, 1);
  restored(next);
  while (next.game.phase === "travel") {
    next = next.branch
      ? chooseTradingBranch(
          next,
          LOCATIONS.find((item) => item.id === next.position)!.next[0]!,
        )
      : advanceTradingStep(next);
    restored(next);
  }
  return next;
}

test("真实道路连续十三轮：每步可恢复，八轮后继续；跨店卖出不重置现金与成本", () => {
  let session = freshTradingSession("road-ledger");
  const stops: string[] = [];
  let expectedCash = 1000;
  for (let round = 1; round <= 13; round++) {
    session = arrive(session);
    assert.equal(session.game.round, round);
    assert.equal(session.game.marketIndex, 19 + round);
    assert.equal(session.position, session.game.location);
    stops.push(session.position);
    if (round === 1) {
      expectedCash -= getQuote("bread", 20).close * 2 * 1.001;
      session = applyTradingAction(session, {
        type: "buy",
        id: "buy-bread",
        quantity: 2,
      });
    } else if (round === 2) {
      assert.equal(session.position, "grocery");
      expectedCash += getQuote("bread", 21).close * 0.999;
      session = applyTradingAction(session, {
        type: "sell",
        id: "sell-bread-at-timber",
        product: "bread",
        quantity: 1,
      });
      assert.equal(session.game.feedback?.product, "bread");
      assert.equal(session.game.holdings.bread.quantity, 1);
    } else
      session = applyTradingAction(session, {
        type: "hold",
        id: `hold:${round}`,
      });
    assert.ok(Math.abs(session.game.cash - expectedCash) < 1e-8);
    assert.equal(session.game.phase, "feedback");
    restored(session);
  }
  assert.deepEqual(stops, [
    "bakery",
    "grocery",
    "notice",
    "market",
    "research",
    "bridge",
    "bank",
    "gifts",
    "rival",
    "riverside",
    "cafe",
    "square",
    "bakery",
  ]);
  assert.equal(session.game.trades.length, 2);
  assert.equal(session.game.holdings.bread.quantity, 1);
});

test("六步行走中可结算，结算保留位置并冻结后续行情和重复行动", () => {
  let session = rollTradingSession(freshTradingSession("mid-travel"), 6);
  session = advanceTradingStep(session);
  assert.equal(session.position, "bakery");
  assert.equal(session.remaining, 5);
  const atSettlement = applyTradingAction(session, {
    type: "settle",
    id: "settle-on-road",
  });
  assert.equal(atSettlement.position, "bakery");
  assert.equal(atSettlement.game.location, "square");
  assert.equal(atSettlement.game.marketIndex, 19);
  assert.equal(atSettlement.game.settlement?.snapshot.totalAssets, 1000);
  assert.equal(atSettlement.remaining, 0);
  assert.equal(atSettlement.branch, false);
  restored(atSettlement);
  assert.equal(advanceTradingStep(atSettlement), atSettlement);
  assert.equal(rollTradingSession(atSettlement, 1), atSettlement);
  assert.equal(
    applyTradingAction(atSettlement, { type: "settle", id: "again" }),
    atSettlement,
  );
});

test("岔路选择消耗一步；非法骰子、未掷骰及错误岔路不改变游戏", () => {
  const initial = freshTradingSession("fork-road");
  assert.equal(advanceTradingStep(initial), initial);
  for (const die of [-1, 0, 7, 1.5, NaN])
    assert.equal(rollTradingSession(initial, die), initial);
  let session = rollTradingSession(initial, 4);
  session = advanceTradingStep(advanceTradingStep(session));
  assert.equal(session.position, "grocery");
  assert.equal(session.branch, true);
  assert.equal(session.remaining, 2);
  restored(session);
  assert.equal(advanceTradingStep(session), session);
  assert.equal(chooseTradingBranch(session, "cafe"), session);
  session = chooseTradingBranch(session, "repair");
  assert.equal(session.position, "repair");
  assert.equal(session.remaining, 1);
  session = advanceTradingStep(session);
  assert.equal(session.position, "garden");
  assert.equal(session.game.phase, "decision");
  restored(session);
});

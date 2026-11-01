import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTrading } from "./engine";
import {
  freshTradingSession,
  restoreTradingSession,
  TRADING_STORAGE_KEY,
} from "./session";
import type { LocationId } from "../game/content";
import type { TradingSession } from "./model";

function restored(session: TradingSession): void {
  assert.deepEqual(restoreTradingSession(JSON.stringify(session)), session);
}
function start(session: TradingSession, die = 1): TradingSession {
  return {
    ...session,
    game: dispatchTrading(session.game, {
      type: "start-round",
      id: `round:${session.game.round + 1}`,
    }),
    die,
    remaining: die,
    rolled: true,
    branch: false,
  };
}
function arrive(
  session: TradingSession,
  location: LocationId = "bakery",
): TradingSession {
  return {
    ...session,
    game: dispatchTrading(session.game, {
      type: "arrive",
      id: `arrival:${session.game.round}`,
      location,
    }),
    position: location,
    remaining: 0,
    branch: false,
  };
}
function traded(): TradingSession {
  let session = arrive(start(freshTradingSession("saved-trades")));
  session.game = dispatchTrading(session.game, {
    type: "buy",
    id: "first-buy",
    quantity: 2,
  });
  session = arrive(start(session));
  session.game = dispatchTrading(session.game, {
    type: "sell",
    id: "partial-sell",
    quantity: 1,
  });
  return session;
}

test("新键和初始局恢复；旧研究、旧版本、损坏数据与未来版本拒绝", () => {
  const initial = freshTradingSession("new-session");
  assert.equal(TRADING_STORAGE_KEY, "panda-town.trading.v1");
  restored(initial);
  for (const raw of [
    "null",
    "[]",
    "{",
    JSON.stringify({ research: { version: 3 } }),
    JSON.stringify({ ...initial, game: { ...initial.game, version: 2 } }),
    JSON.stringify({
      ...initial,
      game: { ...initial.game, marketVersion: "old-market" },
    }),
    JSON.stringify({
      ...initial,
      game: { ...initial.game, initialCash: 2000 },
    }),
    JSON.stringify({ ...initial, game: { ...initial.game, feeBps: 0 } }),
  ])
    assert.equal(restoreTradingSession(raw), null);
  assert.equal(restoreTradingSession(" ".repeat(4_000_001)), null);
});

test("连续12轮每个阶段恢复，买卖成本、主动资料与动作标识不会随刷新改变", () => {
  let session = freshTradingSession("twelve-restores");
  for (let round = 1; round <= 12; round++) {
    session = start(session);
    restored(session);
    session = arrive(session);
    restored(session);
    session.game = dispatchTrading(session.game, {
      type: "inspect",
      id: `inspect:${round}`,
      topic: "cost",
    });
    restored(session);
    session.game =
      round === 1
        ? dispatchTrading(session.game, { type: "buy", id: "buy", quantity: 2 })
        : round === 2
          ? dispatchTrading(session.game, {
              type: "sell",
              id: "sell",
              quantity: 1,
            })
          : dispatchTrading(session.game, {
              type: "hold",
              id: `hold:${round}`,
            });
    restored(session);
  }
  assert.equal(session.game.round, 12);
  assert.equal(session.game.trades.length, 2);
  assert.equal(session.game.holdings.bread.quantity, 1);
  assert.ok(session.game.holdings.bread.costBasis > 0);
  session.game = dispatchTrading(session.game, {
    type: "settle",
    id: "report",
  });
  restored(session);
});

test("合法岔路与移动中结算可恢复，报告当前位置与上次成交店可以不同", () => {
  let session = start(freshTradingSession("fork-settlement"), 6);
  session = { ...session, position: "grocery", remaining: 4, branch: true };
  restored(session);
  const report: TradingSession = {
    ...session,
    remaining: 0,
    branch: false,
    game: dispatchTrading(session.game, {
      type: "settle",
      id: "settle-at-fork",
    }),
  };
  assert.notEqual(report.position, report.game.location);
  assert.equal(report.game.round, 1);
  assert.equal(report.game.marketIndex, 19);
  restored(report);
  const beforeRound = freshTradingSession("settle-before-roll");
  beforeRound.game = dispatchTrading(beforeRound.game, {
    type: "settle",
    id: "immediate-settle",
  });
  restored(beforeRound);
  session = { ...session, position: "notice", remaining: 3, branch: false };
  restored(session);
});

test("篡改现金、成本、成交费用、数量或未来行情不能靠合法结构蒙混恢复", () => {
  const valid = traded();
  restored(valid);
  const corruptions: Array<(session: TradingSession) => void> = [
    (session) => {
      session.game.cash += 10;
    },
    (session) => {
      session.game.holdings.bread.costBasis += 10;
    },
    (session) => {
      session.game.holdings.bread.quantity += 1;
    },
    (session) => {
      session.game.trades[0]!.fee = 0;
    },
    (session) => {
      session.game.trades[0]!.requestedQuantity = 20;
    },
    (session) => {
      session.game.trades[0]!.marketIndex += 1;
    },
    (session) => {
      session.game.evidence[0]!.quote += 1;
    },
    (session) => {
      session.game.evidence[0]!.opportunities.sell = true;
    },
    (session) => {
      session.game.arrivalDelta += 1;
    },
    (session) => {
      session.game.marketIndex = 200;
    },
    (session) => {
      session.game.round += 1;
    },
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(valid);
    corrupt(changed);
    assert.equal(restoreTradingSession(JSON.stringify(changed)), null);
  }
});

test("交易引用、跨局证据、重复标识、丢失动作或重排行为均拒绝", () => {
  const valid = traded();
  const corruptions: Array<(session: TradingSession) => void> = [
    (session) => {
      session.game.evidence[0]!.tradeId = "missing-trade";
    },
    (session) => {
      session.game.evidence[0]!.sessionId = "another-session";
    },
    (session) => {
      session.game.evidence.push(structuredClone(session.game.evidence[0]!));
    },
    (session) => {
      session.game.trades.push(structuredClone(session.game.trades[0]!));
    },
    (session) => {
      session.game.processed.push(session.game.processed[0]!);
    },
    (session) => {
      session.game.processed.shift();
    },
    (session) => {
      session.game.processed.reverse();
    },
    (session) => {
      session.game.evidence.reverse();
    },
    (session) => {
      session.game.evidence.splice(0, 1);
    },
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(valid);
    corrupt(changed);
    assert.equal(restoreTradingSession(JSON.stringify(changed)), null);
  }
});

test("骰子、岔路和到达位置相互约束；报告快照必须等于真实账户估值", () => {
  const valid = traded();
  const invalid = [
    { ...valid, position: "notice" },
    { ...valid, remaining: 1 },
    { ...valid, die: 7 },
    { ...valid, rolled: false },
    { ...valid, game: { ...valid.game, location: "unknown-shop" } },
    {
      ...valid,
      game: {
        ...valid.game,
        holdings: { ...valid.game.holdings, bread: null },
      },
    },
  ];
  for (const session of invalid)
    assert.equal(restoreTradingSession(JSON.stringify(session)), null);
  const fakeFork = {
    ...start(freshTradingSession("wrong-fork"), 6),
    position: "bakery",
    branch: true,
  };
  assert.equal(restoreTradingSession(JSON.stringify(fakeFork)), null);
  const report = {
    ...valid,
    game: dispatchTrading(valid.game, { type: "settle", id: "finish" }),
  };
  restored(report);
  const changed = structuredClone(report);
  changed.game.settlement!.snapshot.totalAssets += 1;
  assert.equal(restoreTradingSession(JSON.stringify(changed)), null);
  const fakeFeedback = structuredClone(valid);
  fakeFeedback.game.feedback!.fee += 1;
  assert.equal(restoreTradingSession(JSON.stringify(fakeFeedback)), null);
});

test("背包跨店卖出与两商品同主题资料可恢复，重放使用记录商品而非店铺商品", () => {
  let session = arrive(start(freshTradingSession("backpack-restore")));
  session.game = dispatchTrading(session.game, {
    type: "buy",
    id: "buy-bread",
    quantity: 2,
  });
  session = arrive(start(session), "grocery");
  session.game = dispatchTrading(session.game, {
    type: "inspect",
    id: "inspect-bread",
    topic: "price",
    product: "bread",
  });
  session.game = dispatchTrading(session.game, {
    type: "inspect",
    id: "inspect-timber",
    topic: "price",
  });
  restored(session);
  session.game = dispatchTrading(session.game, {
    type: "sell",
    id: "sell-backpack-bread",
    product: "bread",
    quantity: 1,
  });
  assert.equal(session.game.location, "grocery");
  assert.equal(session.game.trades.at(-1)!.product, "bread");
  assert.equal(session.game.holdings.bread.quantity, 1);
  assert.equal(session.game.holdings.timber.quantity, 0);
  restored(session);
  session.game = dispatchTrading(session.game, {
    type: "settle",
    id: "settle-backpack",
  });
  restored(session);
  const changed = structuredClone(session);
  changed.game.trades.at(-1)!.product = "timber";
  assert.equal(restoreTradingSession(JSON.stringify(changed)), null);
});

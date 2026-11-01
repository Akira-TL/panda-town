import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAccountSnapshot,
  calculateQuotedTrade,
  createTradingGame,
  dispatchTrading,
  getAccountSnapshot,
  previewTrade,
} from "./engine";
import { LAST_MARKET_INDEX, START_MARKET_INDEX, getQuote } from "./market";
import type { LocationId } from "../game/content";
import type { ProductQuote, TradingGame } from "./model";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} 应接近 ${expected}`);
const quote = (price: number, volume = 1000): ProductQuote => ({
  date: "2025-01-01",
  open: price,
  high: price,
  low: price,
  close: price,
  volume,
});
function arrive(
  game: TradingGame,
  location: LocationId = "bakery",
): TradingGame {
  const moving = dispatchTrading(game, {
    type: "start-round",
    id: `start-${game.round + 1}`,
  });
  assert.equal(moving.phase, "travel");
  assert.equal(moving.round, game.round + 1);
  const arrived = dispatchTrading(moving, {
    type: "arrive",
    id: `arrive-${moving.round}`,
    location,
  });
  assert.equal(arrived.phase, "decision");
  return arrived;
}

test("手算：100买2再110卖1，含费成本与已实现/未实现盈亏分别保留", () => {
  const bought = calculateQuotedTrade({
    product: "bread",
    side: "buy",
    requestedQuantity: 2,
    quote: quote(100),
    cash: 1000,
    holding: { quantity: 0, costBasis: 0 },
    feeBps: 10,
  });
  assert.equal(bought.enabled, true);
  close(bought.cashAfter, 799.8);
  close(bought.quantityAfter, 2);
  close(bought.costBasisAfter, 200.2);
  close(bought.fee, 0.2);
  close(bought.realizedProfit, 0);
  const sold = calculateQuotedTrade({
    product: "bread",
    side: "sell",
    requestedQuantity: 1,
    quote: quote(110),
    cash: bought.cashAfter,
    holding: { quantity: 2, costBasis: bought.costBasisAfter },
    feeBps: 10,
  });
  close(sold.cashAfter, 909.69);
  close(sold.quantityAfter, 1);
  close(sold.costBasisAfter, 100.1);
  close(sold.realizedProfit, 9.79);
  close(sold.fee, 0.11);
  const snapshot = calculateAccountSnapshot({
    cash: sold.cashAfter,
    initialCash: 1000,
    positions: [
      { holding: { quantity: 1, costBasis: sold.costBasisAfter }, price: 110 },
    ],
    realizedProfit: sold.realizedProfit,
    fees: bought.fee + sold.fee,
  });
  close(snapshot.totalAssets, 1019.69);
  close(snapshot.unrealizedProfit, 9.9);
  close(snapshot.realizedProfit, 9.79);
  close(snapshot.netProfit, 19.69);
  close(snapshot.fees, 0.31);
});

test("现金、真实成交量和持仓限制实际成交，原始请求数量仍保留", () => {
  const volumeLimited = calculateQuotedTrade({
    product: "bread",
    side: "buy",
    requestedQuantity: 5,
    quote: quote(100, 0.5),
    cash: 1000,
    holding: { quantity: 0, costBasis: 0 },
    feeBps: 10,
  });
  assert.equal(volumeLimited.requestedQuantity, 5);
  assert.equal(volumeLimited.quantity, 0.5);
  close(volumeLimited.cashAfter, 949.95);
  const cashLimited = calculateQuotedTrade({
    product: "bread",
    side: "buy",
    requestedQuantity: 2,
    quote: quote(100),
    cash: 100.1,
    holding: { quantity: 0, costBasis: 0 },
    feeBps: 10,
  });
  close(cashLimited.quantity, 1);
  close(cashLimited.cashAfter, 0);
  assert.ok(cashLimited.cashAfter >= 0);
  const soldAll = calculateQuotedTrade({
    product: "bread",
    side: "sell",
    requestedQuantity: 10,
    quote: quote(110),
    cash: 0,
    holding: { quantity: 1, costBasis: 100.1 },
    feeBps: 10,
  });
  close(soldAll.quantity, 1);
  assert.equal(soldAll.quantityAfter, 0);
  assert.equal(soldAll.costBasisAfter, 0);
  close(soldAll.cashAfter, 109.89);
  close(soldAll.realizedProfit, 9.79);
  assert.equal(
    calculateQuotedTrade({
      product: "bread",
      side: "buy",
      requestedQuantity: 1,
      quote: quote(100, 0),
      cash: 1000,
      holding: { quantity: 0, costBasis: 0 },
      feeBps: 10,
    }).enabled,
    false,
  );
});

test("交易只在到达后一次执行，报价来自当前收盘，证据与预览一致且不修改输入", () => {
  const start = createTradingGame("actual-trade");
  assert.equal(start.marketIndex, START_MARKET_INDEX);
  assert.equal(previewTrade(start, "buy", 1).enabled, false);
  assert.equal(
    dispatchTrading(start, {
      type: "arrive",
      id: "early-arrival",
      location: "bakery",
    }),
    start,
  );
  const game = arrive(start);
  const before = structuredClone(game);
  const preview = previewTrade(game, "buy", 2);
  assert.equal(preview.enabled, true);
  assert.equal(preview.price, getQuote("bread", game.marketIndex).close);
  const bought = dispatchTrading(game, {
    type: "buy",
    id: "buy-one",
    quantity: 2,
  });
  assert.equal(bought.phase, "feedback");
  close(bought.cash, preview.cashAfter);
  close(bought.holdings.bread.quantity, preview.quantityAfter);
  assert.equal(bought.trades.length, 1);
  assert.equal(bought.evidence.length, 1);
  assert.equal(bought.trades[0]!.requestedQuantity, 2);
  assert.equal(bought.trades[0]!.price, preview.price);
  assert.equal(bought.evidence[0]!.tradeId, "buy-one");
  assert.deepEqual(bought.evidence[0]!.opportunities, {
    buy: true,
    sell: false,
    hold: true,
  });
  close(bought.evidence[0]!.cashBefore, 1000);
  close(bought.evidence[0]!.cashAfter, bought.cash);
  assert.equal(
    dispatchTrading(bought, { type: "buy", id: "buy-one", quantity: 2 }),
    bought,
  );
  assert.equal(
    dispatchTrading(bought, { type: "sell", id: "second-action", quantity: 1 }),
    bought,
  );
  assert.deepEqual(game, before);
  assert.equal(start.cash, 1000);
  assert.equal(start.holdings.bread.quantity, 0);
});

test("下一轮所有商品共同推进，账户与持仓连续，持有不重置资金或伪造交易", () => {
  const first = dispatchTrading(arrive(createTradingGame("continuous")), {
    type: "buy",
    id: "first-buy",
    quantity: 2,
  });
  const before = getAccountSnapshot(first);
  const next = arrive(first, "grocery");
  assert.equal(next.marketIndex, first.marketIndex + 1);
  assert.equal(next.cash, first.cash);
  assert.deepEqual(next.holdings, first.holdings);
  close(
    next.arrivalDelta,
    getAccountSnapshot(next).totalAssets - before.totalAssets,
  );
  const held = dispatchTrading(next, { type: "hold", id: "hold-timber" });
  assert.equal(held.phase, "feedback");
  assert.equal(held.cash, first.cash);
  assert.deepEqual(held.holdings, first.holdings);
  assert.deepEqual(held.trades, first.trades);
  assert.equal(held.evidence.at(-1)?.product, "timber");
  assert.equal(held.feedback?.cashDelta, 0);
});

test("无效份数与无持仓卖出不成交，资料按同轮同商品主题去重且不耗回合", () => {
  const game = arrive(createTradingGame("invalid-and-inspect"));
  for (const quantity of [0, -1, NaN, Infinity]) {
    assert.equal(
      dispatchTrading(game, {
        type: "buy",
        id: `invalid-${quantity}`,
        quantity,
      }),
      game,
    );
  }
  assert.equal(
    dispatchTrading(game, { type: "sell", id: "naked-sell", quantity: 1 }),
    game,
  );
  const inspected = dispatchTrading(game, {
    type: "inspect",
    id: "inspect-price",
    topic: "price",
  });
  assert.equal(inspected.phase, "decision");
  assert.equal(inspected.round, game.round);
  assert.equal(inspected.marketIndex, game.marketIndex);
  assert.equal(inspected.cash, game.cash);
  assert.equal(inspected.evidence.length, 1);
  assert.equal(
    dispatchTrading(inspected, {
      type: "inspect",
      id: "repeat",
      topic: "price",
    }),
    inspected,
  );
  assert.equal(
    dispatchTrading(inspected, { type: "hold", id: "inspect-price" }),
    inspected,
  );
});

test("没有八轮上限且每轮只推进一天，已在移动时不能重复开始", () => {
  let game = createTradingGame("twelve-rounds");
  for (let round = 1; round <= 12; round++) {
    const moving = dispatchTrading(game, {
      type: "start-round",
      id: `start-${round}`,
    });
    assert.equal(
      dispatchTrading(moving, { type: "start-round", id: `double-${round}` }),
      moving,
    );
    game = dispatchTrading(moving, {
      type: "arrive",
      id: `arrive-${round}`,
      location: "bakery",
    });
    game = dispatchTrading(game, { type: "hold", id: `hold-${round}` });
    assert.equal(game.round, round);
    assert.equal(game.marketIndex, START_MARKET_INDEX + round);
    assert.equal(game.cash, 1000);
  }
  assert.equal(game.phase, "feedback");
  assert.equal(game.trades.length, 0);
});

test("任何阶段可按市值结算且不收假想卖出费，报告后所有操作冻结", () => {
  const initial = createTradingGame("settle-anytime");
  const moving = dispatchTrading(initial, { type: "start-round", id: "start" });
  const decision = dispatchTrading(moving, {
    type: "arrive",
    id: "arrive",
    location: "bakery",
  });
  const bought = dispatchTrading(decision, {
    type: "buy",
    id: "buy",
    quantity: 1,
  });
  for (const state of [initial, moving, decision, bought]) {
    const snapshot = getAccountSnapshot(state);
    const report = dispatchTrading(state, { type: "settle", id: "settle" });
    assert.equal(report.phase, "report");
    assert.deepEqual(report.settlement?.snapshot, snapshot);
    assert.deepEqual(report.trades, state.trades);
    assert.deepEqual(report.holdings, state.holdings);
    assert.equal(report.cash, state.cash);
    assert.equal(
      dispatchTrading(report, { type: "start-round", id: "after-start" }),
      report,
    );
    assert.equal(
      dispatchTrading(report, {
        type: "arrive",
        id: "after-arrive",
        location: "bank",
      }),
      report,
    );
    assert.equal(
      dispatchTrading(report, { type: "buy", id: "after-buy", quantity: 1 }),
      report,
    );
    assert.equal(
      dispatchTrading(report, {
        type: "inspect",
        id: "after-inspect",
        topic: "risk",
      }),
      report,
    );
    assert.equal(
      dispatchTrading(report, { type: "settle", id: "again" }),
      report,
    );
  }
});

test("样本末尾仍能处理最后报价与结算，不越界或循环造未来", () => {
  const nearEnd = createTradingGame("last-day");
  nearEnd.marketIndex = LAST_MARKET_INDEX - 1;
  const last = arrive(nearEnd);
  assert.equal(last.marketIndex, LAST_MARKET_INDEX);
  const held = dispatchTrading(last, { type: "hold", id: "last-hold" });
  assert.equal(
    dispatchTrading(held, { type: "start-round", id: "too-far" }),
    held,
  );
  const report = dispatchTrading(held, { type: "settle", id: "last-settle" });
  assert.equal(report.phase, "report");
  assert.equal(report.marketIndex, LAST_MARKET_INDEX);
});

test("木材铺可卖背包里的面包，按面包当前价格成交且占本轮行动", () => {
  const bought = dispatchTrading(arrive(createTradingGame("backpack-sale")), {
    type: "buy",
    id: "bread-buy",
    quantity: 2,
  });
  const shop = arrive(bought, "grocery");
  const before = structuredClone(shop);
  assert.equal(previewTrade(shop, "buy", 1, "bread").enabled, false);
  assert.equal(previewTrade(shop, "sell", 1).enabled, false);
  const preview = previewTrade(shop, "sell", 1, "bread");
  assert.equal(preview.enabled, true);
  const price = getQuote("bread", shop.marketIndex).close;
  const sold = dispatchTrading(shop, {
    type: "sell",
    id: "backpack-sell",
    product: "bread",
    quantity: 1,
  });
  assert.equal(sold.phase, "feedback");
  assert.equal(sold.location, "grocery");
  assert.equal(sold.holdings.bread.quantity, 1);
  assert.equal(sold.holdings.timber.quantity, 0);
  close(sold.cash, shop.cash + price - price * 0.001);
  close(sold.holdings.bread.costBasis, bought.holdings.bread.costBasis / 2);
  close(
    sold.trades.at(-1)!.realizedProfit,
    price - price * 0.001 - bought.holdings.bread.costBasis / 2,
  );
  assert.equal(sold.trades.at(-1)!.product, "bread");
  assert.equal(sold.feedback?.product, "bread");
  assert.equal(sold.evidence.at(-1)!.product, "bread");
  assert.equal(sold.evidence.at(-1)!.quote, price);
  assert.deepEqual(sold.evidence.at(-1)!.opportunities, {
    buy: false,
    sell: true,
    hold: true,
  });
  assert.equal(
    dispatchTrading(sold, {
      type: "buy",
      id: "second-main-action",
      quantity: 1,
    }),
    sold,
  );
  assert.deepEqual(shop, before);
});

test("跨商品资料查看按轮次、商品、主题去重，不耗交易行动或误记店铺商品", () => {
  const shop = arrive(createTradingGame("backpack-inspect"), "grocery");
  const bread = dispatchTrading(shop, {
    type: "inspect",
    id: "bread-price",
    topic: "price",
    product: "bread",
  });
  assert.equal(bread.phase, "decision");
  assert.equal(bread.cash, shop.cash);
  assert.equal(bread.evidence[0]!.product, "bread");
  assert.equal(bread.evidence[0]!.opportunities.buy, false);
  assert.equal(
    dispatchTrading(bread, {
      type: "inspect",
      id: "repeat-bread-price",
      topic: "price",
      product: "bread",
    }),
    bread,
  );
  const timber = dispatchTrading(bread, {
    type: "inspect",
    id: "timber-price",
    topic: "price",
  });
  assert.equal(timber.evidence.length, 2);
  assert.equal(timber.evidence[1]!.product, "timber");
  const bought = dispatchTrading(timber, {
    type: "buy",
    id: "buy-timber",
    quantity: 1,
  });
  assert.equal(bought.holdings.timber.quantity, 1);
  assert.equal(bought.holdings.bread.quantity, 0);
});

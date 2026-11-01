import assert from "node:assert/strict";
import test from "node:test";
import type { LocationId } from "../game/content";
import { createTradingGame, dispatchTrading } from "./engine";
import { getQuote } from "./market";
import { buildTradingProfile } from "./profile";
import type { TradingGame } from "./model";

function atShop(game: TradingGame, location: LocationId): TradingGame {
  return dispatchTrading(
    dispatchTrading(game, {
      type: "start-round",
      id: `round:${game.round + 1}`,
    }),
    { type: "arrive", id: `arrive:${game.round + 1}`, location },
  );
}

test("没有交易的随机落点不变成商品兴趣，初始画像不补人格和能力分数", () => {
  let game = atShop(createTradingGame("observation-only"), "bank");
  game = dispatchTrading(game, { type: "hold", id: "watch-gold" });
  const profile = buildTradingProfile(game);
  assert.deepEqual(profile.interests, []);
  assert.equal(profile.facts[0]!.value, "还没买过");
  assert.equal(profile.facts[1]!.value, "观察不足");
  assert.equal(profile.facts[2]!.value, "持仓0%");
  assert.equal(profile.account.totalAssets, 1000);
  assert.ok(profile.unknown.some((text) => text.includes("知识水平未评估")));
});

test("跨店实际买卖和主动查看构成可追溯画像，账户按现金和剩余持仓市值结算", () => {
  let game = atShop(createTradingGame("profile-ledger"), "bakery");
  game = dispatchTrading(game, { type: "buy", id: "buy-two", quantity: 2 });
  game = atShop(game, "grocery");
  game = dispatchTrading(game, {
    type: "inspect",
    id: "view-bread",
    topic: "price",
    product: "bread",
  });
  game = dispatchTrading(game, {
    type: "inspect",
    id: "view-again",
    topic: "price",
    product: "bread",
  });
  game = dispatchTrading(game, {
    type: "inspect",
    id: "view-holdings",
    topic: "holdings",
    product: "timber",
  });
  game = dispatchTrading(game, {
    type: "sell",
    id: "sell-one",
    quantity: 1,
    product: "bread",
  });
  game = dispatchTrading(game, { type: "settle", id: "finish" });
  const profile = buildTradingProfile(game);
  const buyPrice = getQuote("bread", 20).close;
  const sellPrice = getQuote("bread", 21).close;
  const expectedCash = 1000 - 2 * buyPrice * 1.001 + sellPrice * 0.999;
  assert.ok(Math.abs(profile.account.cash - expectedCash) < 1e-8);
  assert.ok(
    Math.abs(profile.account.totalAssets - (expectedCash + sellPrice)) < 1e-8,
  );
  assert.deepEqual(profile.interests, [
    { product: "bread", buys: 1, sells: 1, inspections: 1, contexts: 2 },
  ]);
  assert.equal(profile.facts[0]!.value, "面包");
  assert.equal(profile.facts[3]!.value, "主动看过1轮");
  assert.deepEqual(profile.facts[0]!.evidenceIds, ["buy-two"]);
  assert.equal(
    profile.evidence.filter((row) => row.id === "view-again").length,
    0,
  );
  assert.equal(
    profile.evidence.find((row) => row.id === "sell-one")?.product,
    "bread",
  );
  assert.equal(
    profile.evidence.find((row) => row.id === "sell-one")?.opportunities.buy,
    false,
  );
  assert.equal(game.holdings.bread.quantity, 1);
  assert.equal(game.trades.length, 2);
});

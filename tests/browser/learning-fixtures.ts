import assert from "node:assert/strict";
import { expect, type Locator, type Page } from "@playwright/test";
import { NPC_MODELS } from "../../src/scene/npc-models";
import { LOCATIONS } from "../../src/game/content";
import {
  applyTradingAction,
  advanceTradingStep,
  chooseTradingBranch,
  rollTradingSession,
} from "../../src/trading/navigation";
import {
  freshTradingSession,
  restoreTradingSession,
} from "../../src/trading/session";
import {
  createLearningState,
  getKnowledgePrompt,
  recordLearningAction,
  restoreLearningState,
  evaluateRule,
  buildLearningSummary,
} from "../../src/trading/learning";
import { getAccountSnapshot } from "../../src/trading/engine";
import { getVisibleCandles } from "../../src/trading/market";
import { getIndicatorSeries } from "../../src/trading/indicators";
import { getLocationProduct } from "../../src/trading/products";
import type { LearningState } from "../../src/trading/learning";
import { PRODUCT_IDS } from "../../src/trading/model";
import type { ProductId, TradingSession } from "../../src/trading/model";

export interface LearningFixture {
  trading: TradingSession;
  learning: LearningState;
}
export interface MacdFixture extends LearningFixture {
  product: ProductId;
  markerIndex: number;
  markerDate: string;
}
/** 测试专用：通过公开导航走一格及合法岔路，不直接改现金、日期、轮次或阶段。 */
function nextArrival(session: TradingSession): TradingSession {
  let next = rollTradingSession(session, 1);
  for (let step = 0; next.game.phase === "travel" && step < 8; step++) {
    next = next.branch
      ? chooseTradingBranch(
          next,
          LOCATIONS.find((item) => item.id === next.position)!.next[0]!,
        )
      : advanceTradingStep(next);
  }
  assert.equal(next.game.phase, "decision");
  return next;
}
function waitHere(session: TradingSession): TradingSession {
  return applyTradingAction(session, {
    type: "hold",
    id: `fixture-hold:${session.game.round}`,
  });
}
function validate(fixture: LearningFixture): LearningFixture {
  assert.deepEqual(
    restoreTradingSession(JSON.stringify(fixture.trading)),
    fixture.trading,
  );
  assert.deepEqual(
    restoreLearningState(
      JSON.stringify(fixture.learning),
      fixture.trading.game,
    ),
    fixture.learning,
  );
  return fixture;
}
/** 明确的存档夹具，不表示浏览器已操作过这些回合。 */
export function makeLearningFixture(
  rounds = 1,
  seededLearning = false,
): LearningFixture {
  let trading = freshTradingSession(
    `learning-fixture-${rounds}-${seededLearning}`,
  );
  for (let round = 1; round <= rounds; round++) {
    trading = nextArrival(trading);
    if (round < rounds) trading = waitHere(trading);
  }
  let learning = createLearningState(trading.game.sessionId);
  const product = getLocationProduct(trading.game.location).id;
  if (seededLearning) {
    const prompt = getKnowledgePrompt(trading.game, learning, product)!;
    learning = recordLearningAction(learning, trading.game, {
      type: "answer",
      id: "fixture-skip",
      promptId: prompt.id,
      answerId: null,
      product,
    });
    learning = recordLearningAction(learning, trading.game, {
      type: "set-rule",
      id: "fixture-adopt",
      product,
      rule: { entry: "ma_cross_up", allocation: 0.5, exit: "ma_cross_down" },
    });
  }
  return validate({ trading, learning });
}

/** 完整决策界面的合法存档夹具：公开导航买三种商品后再到已持有的咖啡店，不声称UI走完这些轮。 */
export function makePortfolioDecisionFixture(): LearningFixture {
  let trading = freshTradingSession("learning-full-portfolio-decision");
  const targets: readonly ProductId[] = ["bread", "timber", "coffee"];
  for (let round = 1; round <= 60; round++) {
    trading = nextArrival(trading);
    const product = getLocationProduct(trading.game.location).id;
    const held = PRODUCT_IDS.filter(
      (id) => trading.game.holdings[id].quantity > 0,
    );
    if (
      held.length >= 3 &&
      product === "coffee" &&
      trading.game.holdings.coffee.quantity > 0
    ) {
      const initial = createLearningState(trading.game.sessionId);
      const learning = recordLearningAction(initial, trading.game, {
        type: "set-rule",
        id: "fixture-full-ma-rule",
        product,
        rule: { entry: "ma_cross_up", allocation: 0.5, exit: "ma_cross_down" },
      });
      assert.equal(trading.game.phase, "decision");
      assert.equal(trading.position, trading.game.location);
      assert.ok(trading.game.holdings.coffee.costBasis > 0);
      return validate({ trading, learning });
    }
    if (
      targets.includes(product) &&
      trading.game.holdings[product].quantity === 0
    ) {
      trading = applyTradingAction(trading, {
        type: "buy",
        id: `fixture-portfolio-buy:${round}`,
        quantity: 1,
      });
      assert.ok(
        trading.game.holdings[product].quantity > 0,
        "三持仓夹具必须真实成交成功",
      );
    } else trading = waitHere(trading);
  }
  throw new Error("合法路线未构成三持仓的咖啡店决策，不能直接改位置或份数");
}
/** 测试专用：寻找公开前缀里已发生的MACD上穿，避免UI跑完数十轮；不是择优游戏政策。 */
export function makeMacdFixture(): MacdFixture {
  let trading = freshTradingSession("learning-macd-known-cross");
  for (let round = 1; round <= 100; round++) {
    trading = nextArrival(trading);
    const product = getLocationProduct(trading.game.location).id;
    const points = getIndicatorSeries(
      getVisibleCandles(product, trading.game.marketIndex),
    );
    const crosses = points.filter(
      (point, index) =>
        index > 0 &&
        point.macd !== null &&
        points[index - 1]!.macd !== null &&
        ((points[index - 1]!.macd!.histogram <= 0 &&
          point.macd.histogram > 0) ||
          (points[index - 1]!.macd!.histogram >= 0 &&
            point.macd.histogram < 0)),
    );
    const marker = [...crosses.slice(-3)]
      .reverse()
      .find((point) => point.macd!.histogram > 0);
    if (round >= 20 && marker) {
      const fixture = {
        trading,
        learning: createLearningState(trading.game.sessionId),
      };
      validate(fixture);
      return {
        ...fixture,
        product,
        markerIndex: marker.index,
        markerDate: marker.date,
      };
    }
    trading = waitHere(trading);
  }
  throw new Error("100个合法测试回合中没有可用MACD上穿，不能编造交叉夹具");
}

/** UI规则题的独立窗口预期：显式按已知收盘手算各时点排当期20均价，不调用evaluateRule。 */
export function maCrossOracle(product: ProductId, index: number): boolean {
  const candles = getVisibleCandles(product, index);
  assert.ok(index >= 21);
  const previousMean =
    candles
      .slice(index - 21, index - 1)
      .reduce((sum, point) => sum + point.close, 0) / 20;
  const currentMean =
    candles
      .slice(index - 20, index)
      .reduce((sum, point) => sum + point.close, 0) / 20;
  return (
    candles[index - 1]!.close <= previousMean &&
    candles[index]!.close > currentMean
  );
}

/** 相邻有效MACD读数作为UI接线预期；不使用所点选的旧交叉日期代替当前条件。 */
export function currentMacdCrossOracle(
  product: ProductId,
  index: number,
): boolean {
  const points = getIndicatorSeries(getVisibleCandles(product, index));
  const previous = points.at(-2)?.macd,
    current = points.at(-1)?.macd;
  assert.ok(previous && current, "MACD规则题需要前后两个有效的当前已知读数");
  return previous.dif <= previous.dea && current.dif > current.dea;
}

/** 临时定骰前必须等待真实3D资产完成，避免污染Three.js模型、材质和纹理UUID。 */
export async function waitForLearningScene(page: Page): Promise<void> {
  const scene = page.locator("[data-expected-npc-models]");
  await expect(scene).toHaveAttribute("data-npc-model-count", "15", {
    timeout: 90_000,
  });
  const assets = [
    "panda",
    "tree",
    "bakery",
    "grocery",
    "market",
    "research",
    "bank",
    "gifts",
    "rival",
    "cafe",
    "texture-wood",
    "texture-plaster",
    "texture-roof",
    "texture-canvas",
    "material-grass-earth",
    "material-cobblestone-path",
    "material-stone-wall",
    ...NPC_MODELS.map((model) => `npc-${model.id}`),
  ];
  for (const asset of assets)
    await expect(scene).toHaveAttribute(
      "data-loaded-models",
      new RegExp(`(?:^| )${asset}(?: |$)`),
      { timeout: 90_000 },
    );
}

/** 仅覆盖已就绪的掷骰按钮点击窗口；finally总是恢复，页面加载期间保持真实随机。 */
export async function clickWithDieOne(
  page: Page,
  button: Locator,
): Promise<void> {
  await waitForLearningScene(page);
  await button.click({ trial: true });
  await page.evaluate(() => {
    const holder = window as Window & { __learningDiceRandom?: () => number };
    if (holder.__learningDiceRandom) throw new Error("定骰范围意外嵌套");
    holder.__learningDiceRandom = Math.random;
    Math.random = () => 1 / 12;
  });
  try {
    await button.click();
  } finally {
    if (!page.isClosed()) {
      const restored = await page.evaluate(() => {
        const holder = window as Window & {
          __learningDiceRandom?: () => number;
        };
        const original = holder.__learningDiceRandom;
        if (!original) return false;
        Math.random = original;
        delete holder.__learningDiceRandom;
        return Math.random === original;
      });
      expect(restored, "点击完成或失败后都应恢复原始随机函数").toBe(true);
    }
  }
}

/** 真正点下一站及合法岔路，不直接提交arrival或修改行情。 */
export async function nextStationUI(page: Page): Promise<TradingSession> {
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "下一站 →", exact: true }),
  );
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = async (): Promise<TradingSession | null> =>
      page.evaluate(() => {
        const raw = sessionStorage.getItem("panda-town.trading.v1");
        return raw ? (JSON.parse(raw) as TradingSession) : null;
      });
    await expect
      .poll(async () => {
        const next = await current();
        return Boolean(next?.branch || next?.game.phase === "decision");
      })
      .toBe(true);
    const session = (await current())!;
    if (session.game.phase === "decision") return session;
    expect(session.branch).toBe(true);
    const nextId = LOCATIONS.find((item) => item.id === session.position)!
      .next[0]!;
    const name = LOCATIONS.find((item) => item.id === nextId)!.name;
    await page
      .getByRole("region", { name: "选择岔路", exact: true })
      .getByRole("button")
      .filter({ hasText: name })
      .click();
  }
  throw new Error("合法下一站未到达决策阶段");
}

export async function compactActions(page: Page): Promise<void> {
  const actions = page.locator(".shop-panel .shop-actions button");
  await expect(actions).toHaveCount(3);
  const boxes = await actions.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      const panel = button.closest(".shop-panel")!.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        inside:
          box.top >= Math.max(0, panel.top) &&
          box.bottom <= Math.min(innerHeight, panel.bottom) &&
          box.left >= 0 &&
          box.right <= innerWidth,
      };
    }),
  );
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.inside, "三个主要行动必须处在主卡及视口可见区域").toBe(true);
  }
}

/** 按实际完整主卡DOM核对规则、成本、背包与同条件金额；不只检查存档里有rule。 */
export async function completePortfolioContext(
  page: Page,
  fixture: LearningFixture,
): Promise<void> {
  const { game } = fixture.trading;
  const rule = fixture.learning.rule;
  assert.ok(rule);
  const evaluation = evaluateRule(game, rule, "coffee");
  const state = (value: boolean | null) =>
    value === null ? "预热不足" : value ? "满足" : "未满足";
  const summary = page.locator(".shop-panel .shop-rule-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute(
    "data-rule-entry-state",
    state(evaluation.entry),
  );
  await expect(summary).toHaveAttribute(
    "data-rule-exit-state",
    state(evaluation.exit),
  );
  await expect(summary.locator(".shop-rule-capsules > span")).toHaveCount(3);
  await expect(summary.locator(".shop-rule-capsules > span").nth(1)).toHaveText(
    "≤50%",
  );
  expect(await summary.getAttribute("aria-label")).toContain(evaluation.label);
  const box = await summary.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const format = (value: number) =>
    value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  const account = getAccountSnapshot(game),
    learning = buildLearningSummary(game, fixture.learning);
  await expect(
    page.locator('.shop-panel [data-account-comparison="true"]'),
  ).toHaveText(
    `我 ${format(account.totalAssets)} · 规则商人 ${format(learning.opponent.snapshot.totalAssets)}`,
  );
}

import { expect, test, type Locator, type Page } from "@playwright/test";
import { LOCATIONS } from "../../src/game/content";
import { PRODUCT_IDS, type TradingSession } from "../../src/trading/model";
import { getQuote, LAST_MARKET_INDEX } from "../../src/trading/market";
import { getLocationProduct } from "../../src/trading/products";
import { restoreTradingSession } from "../../src/trading/session";
import {
  clickWithDieOne,
  makeLearningFixture,
  nextStationUI,
  waitForLearningScene,
} from "./learning-fixtures";

const money = (value: number) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;

async function saved(page: Page): Promise<TradingSession> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("panda-town.trading.v1");
    if (!raw) throw new Error("此用例要求真实已保存的当前交易局");
    return JSON.parse(raw) as TradingSession;
  });
}

async function begin(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await waitForLearningScene(page);
}

async function sixSteps(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "掷骰出发", exact: true });
  await waitForLearningScene(page);
  await button.click({ trial: true });
  await page.evaluate(() => {
    const holder = window as Window & { __boundaryDiceRandom?: () => number };
    if (holder.__boundaryDiceRandom) throw new Error("定骰范围意外嵌套");
    holder.__boundaryDiceRandom = Math.random;
    Math.random = () => 11 / 12;
  });
  try {
    await button.click();
  } finally {
    if (!page.isClosed()) {
      const restored = await page.evaluate(() => {
        const holder = window as Window & {
          __boundaryDiceRandom?: () => number;
        };
        const original = holder.__boundaryDiceRandom;
        if (!original) return false;
        Math.random = original;
        delete holder.__boundaryDiceRandom;
        return Math.random === original;
      });
      expect(restored, "掷骰点击成功或失败后均恢复真实随机函数").toBe(true);
    }
  }
}

async function settings(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "设置，随时结算", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** 真实取消重开，再关闭设置；不要求不存在的结算确认框。 */
async function pauseAndCancel(page: Page): Promise<TradingSession> {
  const dialog = await settings(page);
  const before = await saved(page);
  // 正常移动每650ms一步，900ms足以观察至少一次本应发生的自动推进。
  await page.waitForTimeout(900);
  expect(await saved(page), "设置打开后交易/位置/剩余点数均保持").toEqual(
    before,
  );
  await dialog.getByRole("button", { name: "重开一局 ↗", exact: true }).click();
  const confirmation = dialog.getByRole("alertdialog", {
    name: "重新开始一局？",
    exact: true,
  });
  const cancel = confirmation.getByRole("button", {
    name: "取消，保留本局",
    exact: true,
  });
  await expect(cancel).toBeFocused();
  await cancel.click();
  expect(await saved(page), "取消不能重开、回滚或推进当前局").toEqual(before);
  await expect(confirmation).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "关闭，返回原处", exact: true })
    .click();
  return before;
}

/** 独立估值只用持仓份数和已知现价，不调用生产账户汇总函数。 */
function markedAssets(session: TradingSession): number {
  return (
    session.game.cash +
    PRODUCT_IDS.reduce(
      (sum, product) =>
        sum +
        session.game.holdings[product].quantity *
          getQuote(product, session.game.marketIndex).close,
      0,
    )
  );
}

async function settleFromSettings(page: Page): Promise<TradingSession> {
  const dialog = await settings(page);
  const before = await saved(page);
  await dialog.getByRole("button", { name: "结算本局 ↗", exact: true }).click();
  await expect(page.locator("[data-trading-report]")).toBeVisible();
  await expect.poll(async () => (await saved(page)).game.phase).toBe("report");
  const after = await saved(page);
  expect(after.game.marketIndex).toBe(before.game.marketIndex);
  expect(after.game.round).toBe(before.game.round);
  expect(after.position).toBe(before.position);
  expect(after.remaining).toBe(0);
  expect(after.branch).toBe(false);
  expect(after.game.cash).toBe(before.game.cash);
  expect(after.game.holdings).toEqual(before.game.holdings);
  expect(after.game.trades).toEqual(before.game.trades);
  expect(after.game.settlement?.snapshot.totalAssets).toBeCloseTo(
    markedAssets(before),
    8,
  );
  return after;
}

async function restartFromReport(page: Page): Promise<void> {
  const previous = await saved(page);
  await page.getByRole("button", { name: "重开一局", exact: true }).click();
  await page
    .getByRole("dialog", { name: "重新开始交易？", exact: true })
    .getByRole("button", { name: "确认重开", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await saved(page)).game.sessionId)
    .not.toBe(previous.game.sessionId);
  expect((await saved(page)).game.round).toBe(0);
}

test("四阶段设置暂停、取消保留及关闭后真实继续，决策可直接结算", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await begin(page);
  await sixSteps(page);
  const moving = await pauseAndCancel(page);
  expect(moving.game.phase).toBe("travel");
  expect(moving.remaining).toBeGreaterThan(0);
  expect(moving.branch).toBe(false);
  await expect
    .poll(async () => (await saved(page)).position)
    .not.toBe(moving.position);
  await expect.poll(async () => (await saved(page)).branch).toBe(true);

  const fork = await pauseAndCancel(page);
  expect(fork.game.phase).toBe("travel");
  expect(fork.branch).toBe(true);
  expect(await saved(page), "关闭设置仍保留未选岔路与剩余步数").toEqual(fork);
  const target = LOCATIONS.find((location) => location.id === fork.position)!
    .next[0]!;
  const name = LOCATIONS.find((location) => location.id === target)!.name;
  await page
    .getByRole("region", { name: "选择岔路", exact: true })
    .getByRole("button")
    .filter({ hasText: name })
    .click();
  await expect
    .poll(async () => (await saved(page)).game.phase)
    .toBe("decision");
  const decision = await pauseAndCancel(page);
  expect(decision.game.phase).toBe("decision");
  expect(await saved(page)).toEqual(decision);
  await page.getByRole("button", { name: /^(持有|先看看)/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );

  const feedback = await pauseAndCancel(page);
  expect(feedback.game.phase).toBe("feedback");
  expect(await saved(page)).toEqual(feedback);
  const next = await nextStationUI(page);
  expect(next.game.round).toBe(feedback.game.round + 1);
  expect(next.game.marketIndex).toBe(feedback.game.marketIndex + 1);
  expect(next.game.cash).toBe(1000);
  expect(next.game.trades).toEqual([]);
  const report = await settleFromSettings(page);
  expect(report.game.settlement?.snapshot.fees).toBe(0);
  await page.screenshot({ path: "logs/learning-boundaries-four-phases.png" });
});

test("移动中和未选岔路均可原地结算，取消重开不会暗中继续或换局", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await begin(page);
  for (const stage of ["moving", "fork"] as const) {
    if (stage === "fork") await restartFromReport(page);
    await sixSteps(page);
    if (stage === "fork")
      await expect.poll(async () => (await saved(page)).branch).toBe(true);
    const dialog = await settings(page);
    const before = await saved(page);
    expect(before.game.phase).toBe("travel");
    expect(before.branch).toBe(stage === "fork");
    expect(before.remaining).toBeGreaterThan(0);
    await page.waitForTimeout(900);
    expect(await saved(page)).toEqual(before);
    await dialog
      .getByRole("button", { name: "重开一局 ↗", exact: true })
      .click();
    await dialog
      .getByRole("alertdialog", { name: "重新开始一局？", exact: true })
      .getByRole("button", { name: "取消，保留本局", exact: true })
      .click();
    expect(await saved(page)).toEqual(before);
    // 保持设置打开并直接结算，不能短暂恢复移动再取另一个位置。
    await dialog
      .getByRole("button", { name: "结算本局 ↗", exact: true })
      .click();
    await expect(page.locator("[data-trading-report]")).toBeVisible();
    const report = await saved(page);
    expect(report.game.phase).toBe("report");
    expect(report.position).toBe(before.position);
    expect(report.game.location).toBe(before.game.location);
    expect(report.remaining).toBe(0);
    expect(report.branch).toBe(false);
    expect(report.game.trades).toEqual([]);
    expect(report.game.settlement?.snapshot.totalAssets).toBe(1000);
    await page.reload();
    await expect(page.locator("[data-trading-report]")).toBeVisible();
    expect(await saved(page)).toEqual(report);
    await page.screenshot({
      path: `logs/learning-boundaries-settle-${stage}.png`,
    });
  }
});

test("真实四站双持仓：跨店部分卖出区分本品变化、全账户变化与含费成本释放", async ({
  page,
}, info) => {
  await begin(page);
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-product",
    "bread",
  );
  await page
    .getByRole("spinbutton", { name: "交易数量", exact: true })
    .fill("2");
  await page.getByRole("button", { name: /^买入/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  const second = await nextStationUI(page);
  expect(second.game.location).toBe("grocery");
  await page.getByRole("button", { name: /^买入/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  await nextStationUI(page);
  await page.getByRole("button", { name: /^(持有|先看看)/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  const before = await nextStationUI(page);
  expect(before.game.location).toBe("market");
  expect(before.game.round).toBe(4);
  expect(before.game.marketIndex).toBe(23);
  expect(before.game.holdings.bread.quantity).toBe(2);
  expect(before.game.holdings.timber.quantity).toBe(1);

  // 预期只由真实已知价格与公开0.1%费手算，不调用生产preview/account/cost函数。
  const breadCost = getQuote("bread", 20).close * 1.001;
  const timberCost = getQuote("timber", 21).close * 1.001;
  const breadNow = getQuote("bread", 23).close;
  const timberNow = getQuote("timber", 23).close;
  const cashBefore = 1000 - 2 * breadCost - timberCost;
  const selectedChange = 2 * (breadNow - getQuote("bread", 22).close);
  const allChange = selectedChange + timberNow - getQuote("timber", 22).close;
  expect(before.game.cash).toBeCloseTo(cashBefore, 8);
  expect(before.game.arrivalDelta).toBeCloseTo(allChange, 8);
  await page
    .getByRole("button", { name: "查看面包持仓2份", exact: true })
    .click();
  await expect(page.locator(".shop-panel .shop-price-chart")).toHaveAttribute(
    "data-product",
    "bread",
  );
  await expect(page.getByRole("button", { name: /^加仓/ })).toBeDisabled();
  await expect(page.locator(".shop-arrival")).toContainText(
    `本品随价 ${signed(selectedChange)}`,
  );
  await expect(page.locator(".shop-arrival small")).toHaveText(
    `全持仓 ${signed(allChange)}`,
  );
  expect(await saved(page), "选背包不成交、不推进行情").toEqual(before);
  await page
    .getByRole("spinbutton", { name: "交易数量", exact: true })
    .fill("0.5");
  const soldQuantity = 0.5;
  const fee = soldQuantity * breadNow * 0.001;
  const releasedCost = soldQuantity * breadCost;
  const net = soldQuantity * breadNow - fee;
  const remainingCost = 1.5 * breadCost;
  const realized = net - releasedCost;
  await expect(page.getByRole("button", { name: /^卖出/ })).toContainText(
    `净得${money(net)}`,
  );
  await page.getByRole("button", { name: /^卖出/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  const after = await saved(page);
  expect(after.game.cash).toBeCloseTo(cashBefore + net, 8);
  expect(after.game.holdings.bread.quantity).toBe(1.5);
  expect(after.game.holdings.bread.costBasis).toBeCloseTo(remainingCost, 8);
  expect(
    before.game.holdings.bread.costBasis - after.game.holdings.bread.costBasis,
  ).toBeCloseTo(releasedCost, 8);
  expect(after.game.holdings.timber).toEqual(before.game.holdings.timber);
  const trade = after.game.trades.at(-1)!;
  expect(trade.product).toBe("bread");
  expect(trade.location).toBe("market");
  expect(trade.quantity).toBe(soldQuantity);
  expect(trade.fee).toBeCloseTo(fee, 8);
  expect(trade.realizedProfit).toBeCloseTo(realized, 8);
  expect(after.game.trades).toHaveLength(3);
  await expect(page.locator(".shop-feedback")).toContainText(
    money(cashBefore + net),
  );
  await expect(page.locator(".shop-feedback")).toContainText(
    `费 ${money(fee)}`,
  );
  const report = await settleFromSettings(page);
  expect(report.game.settlement?.snapshot.totalAssets).toBeCloseTo(
    cashBefore + net + 1.5 * breadNow + timberNow,
    8,
  );
  expect(report.game.settlement?.snapshot.realizedProfit).toBeCloseTo(
    realized,
    8,
  );
  const totalFees =
    2 * getQuote("bread", 20).close * 0.001 +
    getQuote("timber", 21).close * 0.001 +
    fee;
  const unrealized = 1.5 * breadNow - remainingCost + timberNow - timberCost;
  expect(report.game.settlement?.snapshot.fees).toBeCloseTo(totalFees, 8);
  expect(report.game.settlement?.snapshot.unrealizedProfit).toBeCloseTo(
    unrealized,
    8,
  );
  await page.getByRole("button", { name: "查看依据", exact: true }).click();
  const evidence = page.getByRole("dialog", {
    name: "本局交易与学习依据",
    exact: true,
  });
  await evidence
    .locator("summary")
    .filter({ hasText: "现金、持仓、成本和费用" })
    .click();
  const holdingRow = evidence
    .getByRole("region", { name: "结算持仓表", exact: true })
    .locator("tbody tr")
    .filter({ hasText: "面包" });
  await expect(holdingRow).toContainText(
    `${money(remainingCost)} / ${money(breadCost)}`,
  );
  await expect(holdingRow).toContainText("1.5");
  await evidence.locator("summary").filter({ hasText: "全部实际成交" }).click();
  const saleRow = evidence
    .getByRole("region", { name: "全部实际成交", exact: true })
    .locator("tbody tr")
    .filter({ hasText: "面包 · 卖出" });
  await expect(saleRow).toContainText("0.5 / 0.5");
  await expect(saleRow).toContainText(signed(realized));
  await info.attach("partial-sale-independent-oracle", {
    body: JSON.stringify({
      category: "四站真实按钮交易与独立价格/0.1%手算",
      selectedChange,
      allChange,
      cashBefore,
      soldQuantity,
      fee,
      releasedCost,
      remainingCost,
      realized,
      totalFees,
      unrealized,
    }),
    contentType: "application/json",
  });
  await page.screenshot({
    path: "logs/learning-boundaries-cross-store-cost.png",
  });
});

test("合法末期存档夹具：第199索引无未来或假下一轮，持有后可直接结算", async ({
  page,
}, info) => {
  // 这是公开导航/hold构造的180轮合法存档，不声称浏览器实际走过180轮。
  const fixture = makeLearningFixture(180);
  expect(fixture.trading.game.marketIndex).toBe(LAST_MARKET_INDEX);
  expect(LAST_MARKET_INDEX).toBe(199);
  expect(restoreTradingSession(JSON.stringify(fixture.trading))).toEqual(
    fixture.trading,
  );
  await info.attach("last-period-canonical-fixture", {
    body: JSON.stringify({
      category: "公开导航生成并通过restore的边界夹具，非180轮UI操作",
      round: fixture.trading.game.round,
      marketIndex: fixture.trading.game.marketIndex,
      phase: fixture.trading.game.phase,
      location: fixture.trading.position,
    }),
    contentType: "application/json",
  });
  await page.goto("/");
  await page.evaluate((value) => {
    sessionStorage.setItem(
      "panda-town.trading.v1",
      JSON.stringify(value.trading),
    );
    sessionStorage.setItem(
      "panda-town.learning.v1",
      JSON.stringify(value.learning),
    );
  }, fixture);
  await page.reload();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
  await waitForLearningScene(page);
  expect(await saved(page)).toEqual(fixture.trading);
  const product = getLocationProduct(fixture.trading.game.location).id;
  const chart = page.locator(".shop-panel .shop-price-chart");
  await expect(chart).toHaveAttribute("data-market-index", "199");
  await expect(chart).toHaveAttribute("data-visible-price-count", "200");
  await expect(chart).toHaveAttribute(
    "data-visible-price-date",
    getQuote(product, 199).date,
  );
  expect(
    await chart
      .locator("[data-candle-index]")
      .evaluateAll((elements) =>
        elements.every(
          (element) => Number(element.getAttribute("data-candle-index")) <= 199,
        ),
      ),
  ).toBe(true);
  await expect(chart.locator('[data-candle-index="200"]')).toHaveCount(0);
  await page.getByRole("button", { name: /^(持有|先看看)/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  const feedback = await saved(page);
  expect(feedback.game.marketIndex).toBe(199);
  expect(feedback.game.round).toBe(180);
  expect(feedback.game.cash).toBe(1000);
  expect(feedback.game.trades).toEqual([]);
  await expect(
    page.getByRole("button", { name: "下一站 →", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "行情到末尾 · 结算", exact: true })
    .click();
  await expect(page.locator("[data-trading-report]")).toBeVisible();
  const report = await saved(page);
  expect(report.game.marketIndex).toBe(199);
  expect(report.game.round).toBe(180);
  expect(report.game.trades).toEqual([]);
  expect(report.game.settlement?.snapshot.totalAssets).toBe(1000);
  expect(report.game.settlement?.snapshot.fees).toBe(0);
  await page.reload();
  await expect(page.locator("[data-trading-report]")).toBeVisible();
  expect(await saved(page)).toEqual(report);
  await page.screenshot({ path: "logs/learning-boundaries-last-period.png" });
});

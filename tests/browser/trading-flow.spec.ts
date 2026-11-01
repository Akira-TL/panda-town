import { expect, test, type Locator, type Page } from "@playwright/test";
import { LOCATIONS } from "../../src/game/content";
import { getQuote } from "../../src/trading/market";
import { getLocationProduct } from "../../src/trading/products";
import type { TradingSession } from "../../src/trading/model";
import type { LearningState } from "../../src/trading/learning";
import { clickWithDieOne, waitForLearningScene } from "./learning-fixtures";

async function session(page: Page): Promise<TradingSession | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("panda-town.trading.v1");
    return raw ? (JSON.parse(raw) as TradingSession) : null;
  });
}
const money = (value: number) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
}
/** 六步仅用于实际点击；不在模型加载或页面刷新期间固定随机函数。 */
async function clickWithDieSix(page: Page, button: Locator) {
  await waitForLearningScene(page);
  await button.click({ trial: true });
  await page.evaluate(() => {
    const holder = window as Window & { __tradingDiceRandom?: () => number };
    if (holder.__tradingDiceRandom) throw new Error("定骰范围意外嵌套");
    holder.__tradingDiceRandom = Math.random;
    Math.random = () => 11 / 12;
  });
  try {
    await button.click();
  } finally {
    if (!page.isClosed()) {
      const restored = await page.evaluate(() => {
        const holder = window as Window & {
          __tradingDiceRandom?: () => number;
        };
        const original = holder.__tradingDiceRandom;
        if (!original) return false;
        Math.random = original;
        delete holder.__tradingDiceRandom;
        return Math.random === original;
      });
      expect(restored, "点击后恢复原始随机函数").toBe(true);
    }
  }
}
async function arrive(page: Page, round: number) {
  await clickWithDieOne(
    page,
    page.getByRole("button", {
      name: round === 1 ? "掷骰出发" : "下一站 →",
      exact: true,
    }),
  );
  for (let step = 0; step < 10; step++) {
    await expect
      .poll(async () => {
        const next = await session(page);
        return Boolean(next?.branch || next?.game.phase === "decision");
      })
      .toBe(true);
    const current = (await session(page))!;
    if (current.game.phase === "decision") break;
    const next = LOCATIONS.find((location) => location.id === current.position)!
      .next[0]!;
    await page
      .getByRole("region", { name: "选择岔路" })
      .getByRole("button")
      .filter({
        hasText: LOCATIONS.find((location) => location.id === next)!.name,
      })
      .click();
  }
  const current = (await session(page))!;
  expect(current.game.round).toBe(round);
  expect(current.game.marketIndex).toBe(19 + round);
  await expect(page.locator('[data-trading-panel="true"]')).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
  return current;
}
async function compact(page: Page) {
  const panel = page.locator(".shop-panel");
  expect(
    ((await panel.innerText()).match(/[\u3400-\u9fff]/g) ?? []).length,
  ).toBeLessThanOrEqual(140);
  expect(
    await panel.evaluate(
      (element) => element.getBoundingClientRect().height / innerHeight,
    ),
  ).toBeLessThanOrEqual(0.5);
  expect(
    await panel.locator(".shop-actions button").evaluateAll(
      (buttons) =>
        buttons.length === 3 &&
        buttons.every((button) => {
          const box = button.getBoundingClientRect();
          const panelBox = button
            .closest(".shop-panel")!
            .getBoundingClientRect();
          return (
            box.width >= 44 &&
            box.height >= 44 &&
            box.top >= Math.max(0, panelBox.top) &&
            box.bottom <= Math.min(innerHeight, panelBox.bottom) &&
            box.left >= 0 &&
            box.right <= innerWidth
          );
        }),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "设置，随时结算" }),
  ).toBeInViewport();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`连续13轮商店交易、跨店卖出、恢复和设置结算 ${viewport.width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    await waitForLearningScene(page);
    for (let round = 1; round <= 13; round++) {
      const current = await arrive(page, round);
      const product = getLocationProduct(current.game.location);
      const chart = page.locator(".shop-panel .shop-price-chart");
      await expect(chart).toHaveAttribute("data-product", product.id);
      await expect(chart).toHaveAttribute("data-chart-mode", "candle");
      const candle = chart.locator(`[data-candle-index="${19 + round}"]`);
      const quote = getQuote(product.id, 19 + round);
      for (const field of ["open", "high", "low", "close"] as const)
        await expect(candle).toHaveAttribute(
          `data-${field}`,
          String(quote[field]),
        );
      await expect(chart).toHaveAttribute(
        "data-visible-price-count",
        String(20 + round),
      );
      await expect(chart.locator(".shop-price-readout strong")).toHaveText(
        `现价 ${money(getQuote(product.id, 19 + round).close)}`,
      );
      await compact(page);
      if (round === 1) {
        // 当前已知第20期非平K线；独立以真实开盘报价选择，不借用答案解析函数。
        expect(getQuote("bread", 20).open).not.toBe(
          getQuote("bread", 20).close,
        );
        await page.getByRole("button", { name: "挂价牌", exact: true }).click();
        const card = page.getByRole("dialog", {
          name: "帮店员挂价牌",
          exact: true,
        });
        await expect(card.locator("[data-correct]")).toHaveCount(0);
        await expect(
          card.getByText("帮店员挂价牌：这根K线的开盘价是？", { exact: true }),
        ).toBeVisible();
        const openLabel = getQuote("bread", 20).open.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        await card
          .getByRole("button", { name: openLabel, exact: true })
          .click();
        await expect(card.locator(".shop-knowledge-result")).toHaveAttribute(
          "data-correct",
          "true",
        );
        await expect(card.locator(".shop-knowledge-result p")).toContainText(
          "开盘",
        );
        await card
          .getByRole("button", { name: "回到买卖", exact: true })
          .click();
        expect((await session(page))!.game).toEqual(current.game);
        const learning = await page.evaluate(
          () =>
            JSON.parse(
              sessionStorage.getItem("panda-town.learning.v1")!,
            ) as LearningState,
        );
        const answered = learning.events.filter(
          (event) => event.kind === "knowledge",
        );
        expect(answered).toHaveLength(1);
        expect(answered[0]?.kind === "knowledge" && answered[0].correct).toBe(
          true,
        );
        await expect(
          page.getByRole("button", { name: /^卖出/ }),
        ).toBeDisabled();
        await page.getByRole("spinbutton", { name: "交易数量" }).fill("2");
        await page.getByRole("button", { name: /^买入/ }).click();
        const bought = (await session(page))!;
        expect(bought.game.holdings.bread.quantity).toBe(2);
        expect(bought.game.cash).toBeCloseTo(
          1000 - 2 * getQuote("bread", 20).close * 1.001,
          8,
        );
        await expect(chart.locator("[data-trade-id]")).toHaveCount(1);
        await expect(chart.locator("[data-cost-price]")).toHaveCount(1);
      } else if (round === 2) {
        await page
          .getByRole("button", { name: "查看面包持仓2份", exact: true })
          .click();
        await expect(chart).toHaveAttribute("data-product", "bread");
        await expect(
          page.getByRole("button", { name: /^加仓/ }),
        ).toBeDisabled();
        await page.getByRole("button", { name: "资料", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "面包 · 交易资料" });
        await dialog
          .locator("summary")
          .filter({ hasText: "价格与来源" })
          .click();
        await expect(
          dialog.getByText("映射历史产品：BTCUSDT", { exact: false }),
        ).toBeVisible();
        await dialog.getByRole("button", { name: "关闭，返回原处" }).click();
        const before = (await session(page))!;
        await page.getByRole("button", { name: /^卖出/ }).click();
        const sold = (await session(page))!;
        expect(sold.game.location).toBe("grocery");
        expect(sold.game.feedback?.product).toBe("bread");
        expect(sold.game.holdings.bread.quantity).toBe(1);
        expect(sold.game.cash).toBeCloseTo(
          before.game.cash + getQuote("bread", 21).close * 0.999,
          8,
        );
        expect(sold.game.evidence.at(-1)?.opportunities.buy).toBe(false);
        await expect(chart.locator("[data-trade-id]")).toHaveCount(2);
        await page.screenshot({
          path: `logs/trading-sell-${viewport.width}.png`,
        });
      } else if (round === 13) {
        expect(product.id).toBe("bread");
        expect(current.game.holdings.bread.quantity).toBe(1);
        await page.getByRole("spinbutton", { name: "交易数量" }).fill("1");
        await page.getByRole("button", { name: /^加仓/ }).click();
        const added = (await session(page))!;
        expect(added.game.holdings.bread.quantity).toBe(2);
        expect(added.game.cash).toBeCloseTo(
          current.game.cash - quote.close * 1.001,
          8,
        );
        expect(added.game.holdings.bread.costBasis).toBeCloseTo(
          current.game.holdings.bread.costBasis + quote.close * 1.001,
          8,
        );
        await expect(chart.locator("[data-trade-id]")).toHaveCount(3);
      } else if ([4, 5, 7, 8, 9, 11].includes(round)) {
        await page.getByRole("button", { name: /^买入/ }).click();
        expect(
          (await session(page))!.game.holdings[product.id].quantity,
        ).toBeGreaterThan(0);
      } else await page.getByRole("button", { name: /^(持有|先看看)/ }).click();
      await expect(page.locator(".shop-panel")).toHaveAttribute(
        "data-trading-phase",
        "feedback",
      );
      if (round === 9) {
        const saved = await session(page);
        await page.reload();
        await expect(page.locator(".shop-panel")).toHaveAttribute(
          "data-trading-phase",
          "feedback",
        );
        expect(await session(page)).toEqual(saved);
        await waitForLearningScene(page);
      }
    }
    const last = (await session(page))!;
    expect(last.game.round).toBe(13);
    expect(last.game.trades.length).toBe(9);
    await page.getByRole("button", { name: "设置，随时结算" }).click();
    const settings = page.getByRole("dialog", { name: "设置", exact: true });
    await expect(settings).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    expect(
      await settings.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    expect(
      await settings.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await settings
      .getByRole("button", { name: "结算本局 ↗", exact: true })
      .click();
    await expect(page.locator('[data-trading-report="true"]')).toBeVisible();
    const settled = (await session(page))!;
    expect(settled.game.phase).toBe("report");
    expect(settled.game.trades).toEqual(last.game.trades);
    expect(settled.game.cash).toBe(last.game.cash);
    const panda = page.getByRole("link", {
      name: "去 PandaAI 验证 ↗",
      exact: true,
    });
    await expect(panda).toHaveAttribute(
      "href",
      "https://www.pandaaiquant.com/agent_quant/",
    );
    await expect(panda).toHaveAttribute("target", "_blank");
    await expect(panda).toHaveAttribute("rel", "noopener noreferrer");
    // 只核对主动跳转合同，不点击外站；结算不应自行创建页面。
    expect(context.pages()).toHaveLength(1);
    await page.screenshot({
      path: `logs/trading-report-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "查看依据", exact: true }).click();
    const evidence = page.getByRole("dialog", {
      name: "本局交易与学习依据",
      exact: true,
    });
    await evidence
      .locator("summary")
      .filter({ hasText: "全部实际成交" })
      .click();
    await expect(
      evidence
        .getByRole("region", { name: "全部实际成交", exact: true })
        .locator("tbody tr"),
    ).toHaveCount(last.game.trades.length);
    await evidence.getByRole("button", { name: "关闭，返回原处" }).click();
    await page.getByRole("button", { name: "清除记录", exact: true }).click();
    await page
      .getByRole("button", { name: "取消，保留本局", exact: true })
      .click();
    expect(await session(page)).toEqual(settled);
    await page.getByRole("button", { name: "清除记录", exact: true }).click();
    await page.getByRole("button", { name: "确认清除", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "开始小镇交易", exact: true }),
    ).toBeVisible();
    expect(await session(page)).toBeNull();
    expect(errors).toEqual([]);
  });
}

test("移动与岔路中的设置会暂停步行，可当场结算且刷新保留结果", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await start(page);
  await clickWithDieSix(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await page.getByRole("button", { name: "设置，随时结算" }).click();
  const paused = (await session(page))!;
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await page.waitForTimeout(900);
  expect(await session(page)).toEqual(paused);
  await settings.getByRole("button", { name: "关闭，返回原处" }).click();
  await expect.poll(async () => (await session(page))?.branch).toBe(true);
  await page.getByRole("button", { name: "设置，随时结算" }).click();
  const fork = (await session(page))!;
  expect(fork.branch).toBe(true);
  await settings
    .getByRole("button", { name: "结算本局 ↗", exact: true })
    .click();
  await expect(page.locator('[data-trading-report="true"]')).toBeVisible();
  const settled = (await session(page))!;
  expect(settled.position).toBe(fork.position);
  expect(settled.remaining).toBe(0);
  expect(settled.branch).toBe(false);
  expect(settled.game.settlement?.snapshot.totalAssets).toBe(1000);
  await page.reload();
  await expect(page.locator('[data-trading-report="true"]')).toBeVisible();
  expect(await session(page)).toEqual(settled);
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import type { TradingSession } from "../../src/trading/model";
import type { LearningState } from "../../src/trading/learning";
import { getQuote } from "../../src/trading/market";
import { waitForLearningScene } from "./learning-fixtures";

interface StoredGame {
  trading: TradingSession | null;
  learning: LearningState | null;
}

/** 仅读取公开UI写下的存档；本用例不注入、修改或替换任何局状态。 */
async function stored(page: Page): Promise<StoredGame> {
  return page.evaluate(() => {
    const trading = sessionStorage.getItem("panda-town.trading.v1");
    const learning = sessionStorage.getItem("panda-town.learning.v1");
    return {
      trading: trading ? JSON.parse(trading) as TradingSession : null,
      learning: learning ? JSON.parse(learning) as LearningState : null,
    };
  });
}

async function learningReady(page: Page) {
  await expect.poll(async () => {
    const state = await stored(page);
    return !!state.learning && state.learning.sessionId === state.trading?.game.sessionId;
  }).toBe(true);
}

/** 通过真实文档焦点顺序到达控件；禁止locator.focus或DOM焦点注入。 */
async function tabTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab") {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let step = 0; step < 150; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeFocused();
      return;
    }
    await page.keyboard.press(key);
  }
  const active = await page.evaluate(() => {
    const element = document.activeElement;
    return `${element?.tagName}: ${element?.getAttribute("aria-label") ?? element?.textContent?.slice(0, 100)}`;
  });
  throw new Error(`真实${key}遍历未到达目标；当前焦点${active}`);
}

async function activate(page: Page, target: Locator, key: "Enter" | "Space" = "Enter") {
  await tabTo(page, target);
  await page.keyboard.press(key);
}

/** 等资产就绪并先用Tab定位，随机函数仅在骰子按钮的真实按键窗口中暂时替换。 */
async function dieOne(page: Page, button: Locator) {
  await waitForLearningScene(page);
  await tabTo(page, button);
  await page.evaluate(() => {
    const holder = window as Window & { __learningKeyboardDieRandom?: () => number };
    if (holder.__learningKeyboardDieRandom) throw new Error("键盘定骰窗口意外嵌套");
    holder.__learningKeyboardDieRandom = Math.random;
    Math.random = () => 1 / 12;
  });
  try {
    await page.keyboard.press("Enter");
  } finally {
    if (!page.isClosed()) {
      const restored = await page.evaluate(() => {
        const holder = window as Window & { __learningKeyboardDieRandom?: () => number };
        const original = holder.__learningKeyboardDieRandom;
        if (!original) return false;
        Math.random = original;
        delete holder.__learningKeyboardDieRandom;
        return Math.random === original;
      });
      expect(restored, "按键成功或失败后均恢复原始随机函数").toBe(true);
    }
  }
}

async function details(page: Page) {
  await activate(page, page.getByRole("button", { name: "资料", exact: true }));
  const dialog = page.getByRole("dialog", { name: / · 交易资料$/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function settle(page: Page) {
  await activate(page, page.getByRole("button", { name: "设置，随时结算", exact: true }));
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(settings).toBeVisible();
  await activate(page, settings.getByRole("button", { name: "结算本局 ↗", exact: true }));
  await expect(page.locator("[data-trading-report]")).toHaveAttribute("data-learning-ready", "true");
  await expect.poll(async () => (await stored(page)).trading?.game.phase).toBe("report");
}

test("纯键盘公开开局、真实买卖、六指标与规则知识、跨店退出、结算及双记录生命周期", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await activate(page, page.getByRole("button", { name: "开始小镇交易", exact: true }));
  await learningReady(page);
  const initial = (await stored(page)).trading!.game;
  expect(initial.cash).toBe(1000);
  await dieOne(page, page.getByRole("button", { name: "掷骰出发", exact: true }));
  await expect(page.locator(".shop-panel")).toHaveAttribute("data-product", "bread");
  await expect(page.locator(".shop-panel")).toHaveAttribute("data-trading-phase", "decision");
  await activate(page, page.locator(".shop-actions button").first());
  await expect.poll(async () => (await stored(page)).trading?.game.phase).toBe("feedback");
  const bought = (await stored(page)).trading!.game;
  expect(bought.trades).toHaveLength(1);
  const purchase = bought.trades[0]!;
  expect(purchase.side).toBe("buy");
  expect(purchase.product).toBe("bread");
  expect(purchase.quantity).toBe(1);
  expect(purchase.price).toBe(getQuote("bread", bought.marketIndex).close);
  expect(purchase.fee).toBeCloseTo(purchase.price * 0.001, 8);
  expect(bought.cash).toBeCloseTo(1000 - purchase.price - purchase.fee, 8);

  await dieOne(page, page.getByRole("button", { name: "下一站 →", exact: true }));
  await expect(page.locator(".shop-panel")).toHaveAttribute("data-product", "timber");
  await expect(page.locator(".shop-panel")).toHaveAttribute("data-trading-phase", "decision");
  const beforeResearch = (await stored(page)).trading!;
  const dossier = await details(page);
  await expect(dossier.getByRole("heading", { name: / · 交易资料$/ })).toBeFocused();
  // 原生模态中由标题向后遍历再回绕，不借用脚本焦点模拟键盘陷阱。
  await page.keyboard.press("Shift+Tab");
  await expect(dossier.getByRole("button", { name: "返回工作台", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dossier.getByRole("button", { name: "关闭，返回原处", exact: true })).toBeFocused();
  await activate(page, dossier.getByRole("button", { name: "指标研究", exact: true }));
  const study = page.getByRole("dialog", { name: / · 指标研究$/ });
  await expect(study).toBeVisible();
  await tabTo(page, study.getByRole("tab", { name: "EMA", exact: true }));
  const tabs = [
    { name: "EMA", id: "ema" }, { name: "MACD", id: "macd" },
    { name: "RSI", id: "rsi" }, { name: "KDJ", id: "kdj" },
    { name: "布林带", id: "boll" }, { name: "ATR", id: "atr" },
  ] as const;
  for (let index = 0; index < tabs.length; index++) {
    if (index) await page.keyboard.press("ArrowRight");
    const tab = study.getByRole("tab", { name: tabs[index]!.name, exact: true });
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(study.locator(".indicator-research")).toHaveAttribute("data-active-indicator", tabs[index]!.id);
    await expect.poll(async () => (await stored(page)).learning?.events.some(
      (event) => event.kind === "indicator" && event.indicator === tabs[index]!.id && event.interaction === "view",
    )).toBe(true);
  }
  await page.keyboard.press("Home");
  await expect(study.getByRole("tab", { name: "EMA", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(study.getByRole("tab", { name: "ATR", exact: true })).toBeFocused();
  expect((await stored(page)).learning!.rule).toBeNull();
  expect((await stored(page)).trading).toEqual(beforeResearch);
  await activate(page, study.getByRole("button", { name: "返回交易", exact: true }), "Space");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".shop-panel")).toBeVisible();

  // 查看不等于采用；再次进入后以实际键盘按钮明确保存EMA条件。
  await activate(page, (await details(page)).getByRole("button", { name: "指标研究", exact: true }));
  await expect(study.locator(".indicator-research")).toHaveAttribute("data-active-indicator", "ema");
  await activate(page, study.getByRole("button", { name: "用于我的规则", exact: true }));
  await expect.poll(async () => (await stored(page)).learning?.rule?.entry).toBe("ema");
  await expect(page.locator(".shop-learning-notice")).toContainText("已保存");
  await page.keyboard.press("Escape");
  await expect(page.locator(".shop-rule-summary")).toBeVisible();
  await activate(page, page.locator(".shop-rule-summary"));
  const editor = page.getByRole("dialog", { name: "给买卖加个条件", exact: true });
  const entry = editor.getByLabel("什么时候买", { exact: true });
  await tabTo(page, entry);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(entry).toHaveValue("ma_cross_up");
  await activate(page, editor.getByRole("button", { name: "50%", exact: true }), "Space");
  const exit = editor.getByLabel("何时退出", { exact: true });
  await tabTo(page, exit);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(exit).toHaveValue("ma_cross_down");
  await activate(page, editor.getByRole("button", { name: "保存我的规则", exact: true }));
  await expect.poll(async () => (await stored(page)).learning?.rule).toEqual({
    entry: "ma_cross_up", allocation: 0.5, exit: "ma_cross_down",
  });
  await page.keyboard.press("Escape");
  const knowledgeEntry = (await details(page)).getByRole("button", { name: "帮店员挂价牌", exact: true });
  await activate(page, knowledgeEntry);
  const question = page.getByRole("dialog", { name: "帮店员挂价牌", exact: true });
  await activate(page, question.getByRole("button", { name: "跳过，不计错误", exact: true }), "Space");
  await expect(question.locator(".shop-knowledge-result")).toHaveAttribute("data-correct", "null");
  await expect(question.locator(".shop-knowledge-result h3")).toBeFocused();
  await expect.poll(async () => (await stored(page)).learning?.events.filter(
    (event) => event.kind === "knowledge" && event.answerId === null && event.correct === null,
  ).length).toBe(1);
  expect((await stored(page)).trading).toEqual(beforeResearch);
  await activate(page, question.getByRole("button", { name: "回到买卖", exact: true }));

  // 第二站木材铺只通过背包选择自有面包，再以真实卖出结束本轮。
  await activate(page, page.getByRole("button", { name: /^查看面包持仓/ }), "Space");
  await expect(page.locator(".shop-panel")).toHaveAttribute("data-product", "bread");
  expect((await stored(page)).trading!.game.location).toBe("grocery");
  await expect(page.locator(".shop-actions button").first()).toBeDisabled();
  const beforeSale = (await stored(page)).trading!.game;
  await activate(page, page.locator(".shop-actions button").nth(2));
  await expect.poll(async () => (await stored(page)).trading?.game.phase).toBe("feedback");
  const sold = (await stored(page)).trading!.game;
  expect(sold.trades).toHaveLength(2);
  const sale = sold.trades[1]!;
  expect(sale.side).toBe("sell");
  expect(sale.product).toBe("bread");
  expect(sale.location).toBe("grocery");
  expect(sale.quantity).toBe(1);
  expect(sold.holdings.bread.quantity).toBe(0);
  expect(sold.cash).toBeCloseTo(beforeSale.cash + sale.price - sale.fee, 8);
  expect(sale.realizedProfit).toBeCloseTo(sale.price - sale.fee - purchase.price - purchase.fee, 8);
  await settle(page);
  const settled = await stored(page);
  expect(settled.trading!.game.cash).toBe(sold.cash);
  expect(settled.trading!.game.trades).toEqual(sold.trades);
  expect(settled.trading!.game.holdings).toEqual(sold.holdings);
  expect(settled.learning!.events.every((event) => event.marketIndex <= sold.marketIndex)).toBe(true);
  const evidenceTrigger = page.getByRole("button", { name: "查看依据", exact: true });
  await activate(page, evidenceTrigger);
  const evidence = page.getByRole("dialog", { name: "本局交易与学习依据", exact: true });
  await tabTo(page, evidence.getByRole("textbox", { name: "可手动复制的研究问题原文", exact: true }));
  await expect(evidence.getByRole("textbox")).toHaveValue(/小镇商品只是历史金融产品/);
  await page.keyboard.press("Escape");
  await expect(evidenceTrigger).toBeFocused();

  await activate(page, page.getByRole("button", { name: "重开一局", exact: true }));
  const restart = page.getByRole("dialog", { name: "重新开始交易？", exact: true });
  await expect(restart.getByRole("button", { name: "取消，保留本局", exact: true })).toBeFocused();
  await activate(page, restart.getByRole("button", { name: "取消，保留本局", exact: true }), "Space");
  expect(await stored(page)).toEqual(settled);
  await activate(page, page.getByRole("button", { name: "重开一局", exact: true }));
  await activate(page, restart.getByRole("button", { name: "确认重开", exact: true }));
  await learningReady(page);
  await expect.poll(async () => (await stored(page)).trading?.game.sessionId).not.toBe(sold.sessionId);
  const fresh = await stored(page);
  expect(fresh.trading!.game.cash).toBe(1000);
  expect(fresh.trading!.game.trades).toEqual([]);
  expect(fresh.learning!.events).toEqual([]);
  expect(fresh.learning!.rule).toBeNull();
  await settle(page);
  const freshReport = await stored(page);
  await activate(page, page.getByRole("button", { name: "清除记录", exact: true }));
  const clear = page.getByRole("dialog", { name: "清除本局记录？", exact: true });
  await activate(page, clear.getByRole("button", { name: "取消，保留本局", exact: true }), "Space");
  expect(await stored(page)).toEqual(freshReport);
  await activate(page, page.getByRole("button", { name: "清除记录", exact: true }));
  await activate(page, clear.getByRole("button", { name: "确认清除", exact: true }));
  await expect(page.getByRole("button", { name: "开始小镇交易", exact: true })).toBeVisible();
  await expect.poll(() => stored(page)).toEqual({ trading: null, learning: null });
  expect(errors).toEqual([]);
});

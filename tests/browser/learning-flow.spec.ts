import { expect, test, type Locator, type Page } from "@playwright/test";
import type { TradingSession } from "../../src/trading/model";
import type { LearningState } from "../../src/trading/learning";
import { getQuote } from "../../src/trading/market";
import { getLocationProduct } from "../../src/trading/products";
import { NPC_MODELS } from "../../src/scene/npc-models";
import {
  makeLearningFixture,
  makePortfolioDecisionFixture,
  makeMacdFixture,
  maCrossOracle,
  currentMacdCrossOracle,
  nextStationUI,
  clickWithDieOne,
  compactActions,
  completePortfolioContext,
  type LearningFixture,
} from "./learning-fixtures";

async function stores(
  page: Page,
): Promise<{ trading: TradingSession | null; learning: LearningState | null }> {
  return page.evaluate(() => {
    const trading = sessionStorage.getItem("panda-town.trading.v1");
    const learning = sessionStorage.getItem("panda-town.learning.v1");
    return {
      trading: trading ? (JSON.parse(trading) as TradingSession) : null,
      learning: learning ? (JSON.parse(learning) as LearningState) : null,
    };
  });
}
async function learningReady(page: Page) {
  await expect
    .poll(async () => {
      const current = await stores(page);
      return Boolean(
        current.learning &&
        current.learning.sessionId === current.trading?.game.sessionId,
      );
    })
    .toBe(true);
}
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await learningReady(page);
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-product",
    "bread",
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
}
async function loadFixture(page: Page, fixture: LearningFixture) {
  // 单次注入canonical存档；不使用持久addInitScript，以免刷新时覆盖UI新事件。
  await page.goto("/");
  await page.evaluate((value: LearningFixture) => {
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
  await learningReady(page);
}
async function details(page: Page) {
  await page.getByRole("button", { name: "资料", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: / · 交易资料$/ });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function trapped(page: Page, dialog: Locator) {
  expect(
    await dialog.evaluate(
      (element) =>
        element instanceof HTMLDialogElement && element.matches(":modal"),
    ),
  ).toBe(true);
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press(index % 2 ? "Tab" : "Shift+Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
}
async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 100; count++) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  throw new Error("真实Tab遍历未找到目标控件");
}
test("真实首两站：K线独立数值题、明确均价规则与新商品判断不消耗交易", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  const before = (await stores(page)).trading!;
  const trigger = page.getByRole("button", { name: "挂价牌", exact: true });
  await trigger.click();
  const card = page.getByRole("dialog", { name: "帮店员挂价牌", exact: true });
  await expect(
    card.getByRole("heading", { name: "帮店员挂价牌", exact: true }),
  ).toBeFocused();
  await expect(
    card.getByText("帮店员挂价牌：这根K线的开盘价是？", { exact: true }),
  ).toBeVisible();
  const options = card.locator(".shop-knowledge-options button");
  await expect(options).toHaveCount(2);
  expect(
    await options.evaluateAll((buttons) =>
      buttons.every(
        (button) =>
          !button.hasAttribute("aria-pressed") &&
          !button.hasAttribute("data-correct") &&
          !/[✓✕✔✖]/.test(button.textContent ?? ""),
      ),
    ),
  ).toBe(true);
  await expect(card.locator("[data-correct]")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => {
      const styles = await options.evaluateAll((buttons) =>
        buttons.map((button) => {
          const style = getComputedStyle(button);
          return [
            style.color,
            style.backgroundColor,
            style.borderColor,
            style.fontWeight,
          ].join("|");
        }),
      );
      return styles[0] === styles[1];
    })
    .toBe(true);
  const quote = getQuote("bread", before.game.marketIndex);
  const priceOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const answerLabel = quote.open.toLocaleString("zh-CN", priceOptions);
  expect(answerLabel).not.toBe(
    quote.close.toLocaleString("zh-CN", priceOptions),
  );
  // 题干实际询问开盘，按真实OHLC选开盘；不把收盘错误地标为正确。
  await card.getByRole("button", { name: answerLabel, exact: true }).click();
  await expect(card.locator(".shop-knowledge-result")).toHaveAttribute(
    "data-correct",
    "true",
  );
  await expect(card.getByText(/该日开盘/)).toBeVisible();
  await expect(options.first()).toBeDisabled();
  await expect(options.last()).toBeDisabled();
  await expect
    .poll(
      async () =>
        (await stores(page)).learning?.events.filter(
          (event) => event.kind === "knowledge",
        ).length,
    )
    .toBe(1);
  expect((await stores(page)).trading).toEqual(before);
  await card.getByRole("button", { name: "回到买卖", exact: true }).click();
  await expect(trigger).toBeFocused();
  const dossier = await details(page);
  await dossier
    .getByRole("button", { name: "编辑我的规则", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "给买卖加个条件",
    exact: true,
  });
  await editor
    .getByLabel("什么时候买", { exact: true })
    .selectOption("ma_cross_up");
  await editor.getByRole("button", { name: "50%", exact: true }).click();
  await editor
    .getByLabel("何时退出", { exact: true })
    .selectOption("ma_cross_down");
  await editor
    .getByRole("button", { name: "保存我的规则", exact: true })
    .click();
  await expect
    .poll(async () => (await stores(page)).learning?.rule)
    .toEqual({
      entry: "ma_cross_up",
      allocation: 0.5,
      exit: "ma_cross_down",
    });
  expect((await stores(page)).trading).toEqual(before);
  await page.keyboard.press("Escape");
  const learned = (await stores(page)).learning;
  await page.reload();
  await learningReady(page);
  expect((await stores(page)).learning).toEqual(learned);
  expect((await stores(page)).trading).toEqual(before);
  await page.getByRole("button", { name: /^买入/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "下一站 →", exact: true }),
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-product",
    "timber",
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
  const second = (await stores(page)).trading!;
  const expected = maCrossOracle("timber", second.game.marketIndex);
  await (
    await details(page)
  )
    .getByRole("button", { name: "帮学徒看规则", exact: true })
    .click();
  const ruleQuestion = page.getByRole("dialog", {
    name: "帮学徒看规则",
    exact: true,
  });
  await ruleQuestion
    .getByRole("button", { name: expected ? "已满足" : "未满足", exact: true })
    .click();
  await expect(ruleQuestion.locator(".shop-knowledge-result")).toHaveAttribute(
    "data-correct",
    "true",
  );
  await expect
    .poll(
      async () =>
        (await stores(page)).learning?.events.filter(
          (event) => event.kind === "knowledge",
        ).length,
    )
    .toBe(2);
  expect((await stores(page)).trading).toEqual(second);
  const answers = (await stores(page)).learning!.events.filter(
    (event) => event.kind === "knowledge",
  );
  expect(answers).toHaveLength(2);
  expect(
    answers.every((event) => event.kind === "knowledge" && event.correct),
  ).toBe(true);
  expect(
    answers.at(-1)?.kind === "knowledge" && answers.at(-1)!.prompt.transfer,
  ).toBe(true);
  await page.screenshot({ path: "logs/learning-new-context-answer.png" });
  expect(errors).toEqual([]);
});

test("六研究页、首站MACD不足与合法后期交叉夹具：查看不等于采用，刷新保留", async ({
  page,
}, info) => {
  const first = makeLearningFixture();
  await loadFixture(page, first);
  await page.getByRole("button", { name: "挂价牌", exact: true }).click();
  const card = page.getByRole("dialog", { name: "帮店员挂价牌", exact: true });
  await card
    .getByRole("button", { name: "跳过，不计错误", exact: true })
    .click();
  await expect(card.locator(".shop-knowledge-result")).toHaveAttribute(
    "data-correct",
    "null",
  );
  await expect
    .poll(async () =>
      (await stores(page)).learning?.events.some(
        (event) => event.kind === "knowledge",
      ),
    )
    .toBe(true);
  const skipped = (await stores(page)).learning!.events.at(-1)!;
  expect(
    skipped.kind === "knowledge" &&
      skipped.answerId === null &&
      skipped.correct === null,
  ).toBe(true);
  expect((await stores(page)).trading).toEqual(first.trading);
  await card.getByRole("button", { name: "回到买卖", exact: true }).click();
  await (
    await details(page)
  )
    .getByRole("button", { name: "指标研究", exact: true })
    .click();
  let research = page.getByRole("dialog", { name: / · 指标研究$/ });
  for (const [label, id] of [
    ["EMA", "ema"],
    ["MACD", "macd"],
    ["RSI", "rsi"],
    ["KDJ", "kdj"],
    ["布林带", "boll"],
    ["ATR", "atr"],
  ] as const) {
    await research.getByRole("tab", { name: label, exact: true }).click();
    await expect(research.locator(".indicator-research")).toHaveAttribute(
      "data-active-indicator",
      id,
    );
    await expect(
      research.getByRole("tab", { name: label, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    if (id === "macd") {
      // 初始20根前史＋首次到达为21根；不伪造一个index19的决策存档。
      await expect(research.locator(".indicator-warmup")).toContainText(
        "已知21期",
      );
      await expect(research.locator(".indicator-warmup")).toContainText("34");
      await expect(
        research.getByRole("button", { name: "标记选中读数", exact: true }),
      ).toBeDisabled();
    }
  }
  expect((await stores(page)).learning!.rule).toBeNull();
  await expect
    .poll(
      async () =>
        (await stores(page)).learning?.events.filter(
          (event) => event.kind === "indicator" && event.interaction === "view",
        ).length,
    )
    .toBe(6);
  const fixture = makeMacdFixture();
  await info.attach("canonical-MACD-fixture", {
    body: JSON.stringify({
      purpose: "公开导航/引擎生成合法存档，并非浏览器已玩完这些回合",
      round: fixture.trading.game.round,
      product: fixture.product,
      marketIndex: fixture.trading.game.marketIndex,
      markerIndex: fixture.markerIndex,
    }),
    contentType: "application/json",
  });
  await loadFixture(page, fixture);
  await (
    await details(page)
  )
    .getByRole("button", { name: "指标研究", exact: true })
    .click();
  research = page.getByRole("dialog", { name: / · 指标研究$/ });
  await tabTo(page, research.getByRole("tab", { name: "EMA", exact: true }));
  await page.keyboard.press("ArrowRight");
  await expect(
    research.getByRole("tab", { name: "MACD", exact: true }),
  ).toBeFocused();
  await expect(research.locator(".indicator-research")).toHaveAttribute(
    "data-active-indicator",
    "macd",
  );
  await trapped(page, research);
  await research
    .locator(".indicator-keypoint-list button")
    .filter({ hasText: `${fixture.markerDate.slice(5)} · DIF上穿DEA` })
    .click();
  await expect(research.locator(".indicator-research")).toHaveAttribute(
    "data-selected-index",
    String(fixture.markerIndex),
  );
  await expect(research.locator(".indicator-event-readout")).toContainText(
    "DIF上穿DEA",
  );
  await expect
    .poll(async () =>
      (await stores(page)).learning?.events.some(
        (event) =>
          event.kind === "indicator" &&
          event.indicator === "macd" &&
          event.interaction === "mark" &&
          event.index === fixture.markerIndex,
      ),
    )
    .toBe(true);
  const marked = (await stores(page)).learning!.events.find(
    (event) =>
      event.kind === "indicator" &&
      event.indicator === "macd" &&
      event.interaction === "mark",
  );
  expect(
    marked?.kind === "indicator" &&
      marked.index === fixture.markerIndex &&
      marked.triggered,
  ).toBe(true);
  expect((await stores(page)).learning!.rule).toBeNull();
  await page.screenshot({ path: "logs/learning-indicator-macd.png" });
  await research
    .getByRole("button", { name: "用于我的规则", exact: true })
    .click();
  await expect
    .poll(async () => (await stores(page)).learning?.rule?.entry)
    .toBe("macd");
  const saved = await stores(page);
  expect(
    saved.learning!.events.every(
      (event) => event.marketIndex <= saved.trading!.game.marketIndex,
    ),
  ).toBe(true);
  await page.reload();
  await learningReady(page);
  expect(await stores(page)).toEqual(saved);
  await page.screenshot({ path: "logs/learning-macd-restored.png" });
  const adopted = [...saved.learning!.events]
    .reverse()
    .find((event) => event.kind === "rule");
  expect(adopted?.marketIndex).toBe(fixture.trading.game.marketIndex);
  expect(adopted?.marketIndex).toBeGreaterThan(fixture.markerIndex);
  // 后期夹具尚未处理第一种互动，先用真实控件跳过，不消费交易机会。
  const beforeSkip = (await stores(page)).trading!;
  await (
    await details(page)
  )
    .getByRole("button", { name: "帮店员挂价牌", exact: true })
    .click();
  const candle = page.getByRole("dialog", {
    name: "帮店员挂价牌",
    exact: true,
  });
  await candle
    .getByRole("button", { name: "跳过，不计错误", exact: true })
    .click();
  await expect(candle.locator(".shop-knowledge-result")).toHaveAttribute(
    "data-correct",
    "null",
  );
  expect((await stores(page)).trading).toEqual(beforeSkip);
  await candle.getByRole("button", { name: "回到买卖", exact: true }).click();
  await page.locator(".shop-actions button").nth(1).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  const next = await nextStationUI(page);
  expect(next.game.marketIndex).toBe(beforeSkip.game.marketIndex + 1);
  expect(next.game.round).toBe(beforeSkip.game.round + 1);
  expect(next.game.trades).toEqual(beforeSkip.game.trades);
  expect(next.game.cash).toBe(beforeSkip.game.cash);
  const product = getLocationProduct(next.game.location).id;
  const expected = currentMacdCrossOracle(product, next.game.marketIndex);
  await (
    await details(page)
  )
    .getByRole("button", { name: "帮学徒看规则", exact: true })
    .click();
  const transferred = page.getByRole("dialog", {
    name: "帮学徒看规则",
    exact: true,
  });
  await transferred
    .getByRole("button", { name: expected ? "已满足" : "未满足", exact: true })
    .click();
  await expect(transferred.locator(".shop-knowledge-result")).toHaveAttribute(
    "data-correct",
    "true",
  );
  await expect
    .poll(
      async () =>
        (await stores(page)).learning?.events.filter(
          (event) => event.kind === "knowledge",
        ).length,
    )
    .toBe(2);
  const checked = await stores(page);
  const answer = [...checked.learning!.events]
    .reverse()
    .find((event) => event.kind === "knowledge");
  expect(answer?.kind).toBe("knowledge");
  if (answer?.kind === "knowledge") {
    expect(answer.correct).toBe(true);
    expect(answer.prompt.transfer).toBe(true);
    expect(answer.prompt.rule?.entry).toBe("macd");
    expect(answer.prompt.index).toBe(next.game.marketIndex);
    expect(answer.prompt.product).toBe(product);
  }
  expect(checked.trading).toEqual(next);
  await page.screenshot({ path: "logs/learning-macd-transfer-answer.png" });
  await page.reload();
  await learningReady(page);
  expect(await stores(page)).toEqual(checked);
});

test("设置结算保留真实世界与15居民，复制成功/拒绝、外链属性和双记录隔离", async ({
  page,
  context,
}) => {
  const errors: string[] = [],
    uploads: string[] = [],
    externalRequests: string[] = [];
  const copied: string[] = [];
  let popups = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("page", () => popups++);
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      uploads.push(request.url());
    if (new URL(request.url()).hostname.endsWith("pandaaiquant.com"))
      externalRequests.push(request.url());
  });
  await page.exposeBinding(
    "recordLearningClipboard",
    (_source, text: unknown) => {
      if (typeof text !== "string") throw new Error("复制内容应为明确文本");
      copied.push(text);
    },
  );
  await loadFixture(page, makeLearningFixture(1, true));
  const scene = page.locator("[data-expected-npc-models]");
  expect(NPC_MODELS).toHaveLength(15);
  await expect(scene).toHaveAttribute("data-expected-npc-models", "15");
  await expect(scene).toHaveAttribute("data-npc-model-count", "15", {
    timeout: 90_000,
  });
  for (const model of NPC_MODELS)
    await expect(scene).toHaveAttribute(
      "data-loaded-npc-models",
      new RegExp(`(?:^| )${model.id}(?: |$)`),
    );
  await expect(page.locator("canvas")).toHaveCount(1);
  await page
    .getByRole("button", { name: "设置，随时结算", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await settings
    .getByRole("button", { name: "结算本局 ↗", exact: true })
    .click();
  await expect(page.locator("[data-trading-report]")).toHaveAttribute(
    "data-learning-ready",
    "true",
  );
  await expect
    .poll(async () => (await stores(page)).trading?.game.phase)
    .toBe("report");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-npc-model-count", "15");
  await expect(page.locator("canvas")).toHaveCount(1);
  const link = page.getByRole("link", {
    name: "去 PandaAI 验证 ↗",
    exact: true,
  });
  await expect(link).toHaveAttribute(
    "href",
    "https://www.pandaaiquant.com/agent_quant/",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  expect(new URL((await link.getAttribute("href"))!).search).toBe("");
  await page.evaluate(() => {
    const capture = (
      window as Window & {
        recordLearningClipboard?: (text: string) => Promise<void>;
      }
    ).recordLearningClipboard;
    if (!capture) throw new Error("测试剪贴板捕获未注册");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => capture(text),
      },
    });
  });
  await page.getByRole("button", { name: "复制我的问题", exact: true }).click();
  await expect(page.locator(".learning-report-copy-status")).toContainText(
    "已复制，请自行粘贴到PandaAI；尚未发送。",
  );
  expect(copied).toHaveLength(1);
  expect(copied[0]).toContain("最大回撤");
  await page.screenshot({ path: "logs/learning-report-copy-success.png" });
  expect(copied[0]).toContain("不是真实证券代码");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("test denied", "NotAllowedError");
        },
      },
    });
  });
  await page.getByRole("button", { name: "复制我的问题", exact: true }).click();
  await expect(page.locator(".learning-report-copy-status")).toContainText(
    "复制失败",
  );
  expect(copied).toHaveLength(1);
  const evidenceTrigger = page.getByRole("button", {
    name: "查看依据",
    exact: true,
  });
  await evidenceTrigger.click();
  const evidence = page.getByRole("dialog", {
    name: "本局交易与学习依据",
    exact: true,
  });
  await trapped(page, evidence);
  await expect(
    evidence.getByRole("textbox", {
      name: "可手动复制的研究问题原文",
      exact: true,
    }),
  ).toHaveValue(copied[0]!);
  await page.keyboard.press("Escape");
  await expect(evidenceTrigger).toBeFocused();
  const settled = await stores(page);
  for (const [button, title] of [
    ["重开一局", "重新开始交易？"],
    ["清除记录", "清除本局记录？"],
  ] as const) {
    const trigger = page.getByRole("button", { name: button, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(
      dialog.getByRole("button", { name: "取消，保留本局", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(await stores(page)).toEqual(settled);
  }
  await page.screenshot({ path: "logs/learning-report-world-and-copy.png" });
  await page.getByRole("button", { name: "重开一局", exact: true }).click();
  await page
    .getByRole("dialog", { name: "重新开始交易？", exact: true })
    .getByRole("button", { name: "确认重开", exact: true })
    .click();
  await expect
    .poll(async () => (await stores(page)).trading?.game.sessionId)
    .not.toBe(settled.trading!.game.sessionId);
  await learningReady(page);
  const fresh = await stores(page);
  expect(fresh.trading!.game.sessionId).not.toBe(
    settled.trading!.game.sessionId,
  );
  expect(fresh.trading!.game.evidence).toHaveLength(0);
  expect(fresh.trading!.game.cash).toBe(1000);
  expect(fresh.learning!.rule).toBeNull();
  expect(fresh.learning!.events).toHaveLength(0);
  await page
    .getByRole("button", { name: "设置，随时结算", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "设置", exact: true })
    .getByRole("button", { name: "结算本局 ↗", exact: true })
    .click();
  await expect(page.locator("[data-trading-report]")).toHaveAttribute(
    "data-learning-ready",
    "true",
  );
  await page.getByRole("button", { name: "清除记录", exact: true }).click();
  await page
    .getByRole("dialog", { name: "清除本局记录？", exact: true })
    .getByRole("button", { name: "确认清除", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "开始小镇交易", exact: true }),
  ).toBeVisible();
  expect(await stores(page)).toEqual({ trading: null, learning: null });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始小镇交易", exact: true }),
  ).toBeVisible();
  expect(await stores(page)).toEqual({ trading: null, learning: null });
  expect(popups).toBe(0);
  expect(externalRequests).toEqual([]);
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("桌面、390/360竖屏及横屏三行动触达，小互动模态焦点与研究切换", async ({
  page,
}, info) => {
  // 都是桌面Edge的视口模拟；不是实体手机、触屏性能或人类试玩结论。
  const fixture = makePortfolioDecisionFixture();
  await info.attach("full-portfolio-fixture", {
    body: JSON.stringify({
      category:
        "公开导航/交易引擎构造并通过两种restore深等的合法完整存档；不是UI逐轮游玩证据",
      round: fixture.trading.game.round,
      product: getLocationProduct(fixture.trading.game.location).id,
      cash: fixture.trading.game.cash,
      holdings: fixture.trading.game.holdings,
      rule: fixture.learning.rule,
    }),
    contentType: "application/json",
  });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await loadFixture(page, fixture);
    await expect(page.locator(".shop-panel")).toHaveAttribute(
      "data-product",
      "coffee",
    );
    await expect(page.locator(".shop-panel")).toHaveAttribute(
      "data-has-holdings",
      "true",
    );
    await expect(
      page.locator(".shop-panel .shop-bag button[aria-pressed]"),
    ).toHaveCount(3);
    await expect(page.locator(".shop-panel .shop-holding-cost")).toBeVisible();
    expect((await stores(page)).learning!.rule).toEqual(fixture.learning.rule);
    await completePortfolioContext(page, fixture);
    await compactActions(page);
    const trigger = page.getByRole("button", { name: "资料", exact: true });
    await (
      await details(page)
    )
      .getByRole("button", { name: "帮店员挂价牌", exact: true })
      .click();
    const card = page.getByRole("dialog", {
      name: "帮店员挂价牌",
      exact: true,
    });
    await trapped(page, card);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    const dossier = await details(page);
    await dossier
      .getByRole("button", { name: "指标研究", exact: true })
      .click();
    const research = page.getByRole("dialog", { name: / · 指标研究$/ });
    await trapped(page, research);
    await tabTo(page, research.getByRole("tab", { name: "EMA", exact: true }));
    await page.keyboard.press("ArrowRight");
    await expect(
      research.getByRole("tab", { name: "MACD", exact: true }),
    ).toBeFocused();
    await expect(
      research.getByRole("tab", { name: "MACD", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    // 指标页按用户的精简导航直接回交易；不再要求旧版多退一层资料。
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await compactActions(page);
    await page.screenshot({
      path: `logs/learning-layout-${viewport.width}x${viewport.height}.png`,
    });
  }
  await info.attach("viewport-scope", {
    body: "仅Playwright隔离Edge视口1440×900、390×844、360×640、844×390；未实测实体手机。",
    contentType: "text/plain",
  });
});

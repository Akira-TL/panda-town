import { expect, test, type Page } from "@playwright/test";
import type { GameState } from "../../src/game/engine";

interface SavedSession {
  game: GameState;
  position: string;
  branch: boolean;
  remaining: number;
  die: number;
  rolled: boolean;
}
declare global {
  interface Window {
    __pandaOriginalRandom: () => number;
  }
}
const key = "panda-town.current.v1";
const networkFailures = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  networkFailures.set(page, failures);
  page.on("requestfailed", (request) =>
    failures.push(
      `${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    ),
  );
});
test.afterEach(async ({ page }, info) => {
  const failures = networkFailures.get(page) ?? [];
  if (failures.length)
    await info.attach("network-failures", {
      body: failures.join("\n"),
      contentType: "text/plain",
    });
});

async function saved(page: Page): Promise<SavedSession | null> {
  return page.evaluate((storageKey) => {
    const value = sessionStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as SavedSession) : null;
  }, key);
}
async function begin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /出发去小镇/ }).click();
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
}
async function arrive(page: Page, die: number, branch = 0) {
  await page.evaluate((value) => {
    window.__pandaOriginalRandom = Math.random;
    Math.random = () => (value - 0.5) / 6;
  }, die);
  await page.getByRole("button", { name: /掷骰出发/ }).click();
  await page.evaluate(() => {
    Math.random = window.__pandaOriginalRandom;
  });
  for (let step = 0; step < 8; step++) {
    await page.waitForFunction((storageKey) => {
      const raw = sessionStorage.getItem(storageKey);
      const value = raw ? (JSON.parse(raw) as SavedSession) : null;
      return value?.branch || value?.game.phase === "decision";
    }, key);
    const state = await saved(page);
    if (state?.game.phase === "decision") return state;
    await page
      .getByRole("region", { name: "选择岔路" })
      .getByRole("button")
      .nth(branch)
      .click();
  }
  throw new Error("合法六面骰移动未能在有限分支后到达事件");
}
async function choose(page: Page, optionId: string) {
  const state = await saved(page);
  const option = state?.game.event?.options.find(
    (entry) => entry.id === optionId,
  );
  if (!option) throw new Error(`当前事件没有选项 ${optionId}`);
  await page
    .getByRole("button")
    .filter({ has: page.getByText(option.label, { exact: true }) })
    .click();
  await expect
    .poll(async () => (await saved(page))?.game.phase)
    .toBe("feedback");
}
async function advance(page: Page) {
  await page
    .getByRole("button", { name: /收好今天的收入，继续|结算第八天，准备开张/ })
    .click();
  await expect
    .poll(async () => (await saved(page))?.game.phase)
    .toMatch(/travel|settlement/);
}
async function finish(page: Page, sell = false) {
  if (sell) await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /确认结算/ }).click();
  await expect(page.getByRole("region", { name: "咖啡馆结局" })).toBeVisible();
  await page.getByRole("button", { name: /看看本局的选择与画像/ }).click();
  await expect(
    page.getByRole("button", { name: "清除记录", exact: true }),
  ).toBeVisible();
}

test("八次真实工作完成开店，刷新、证据、重开与清除不串局", async ({ page }) => {
  const outgoing: string[] = [];
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).hostname !== "127.0.0.1"
    )
      outgoing.push(request.url());
  });
  await begin(page);
  const id = (await saved(page))!.game.sessionId;
  for (let day = 1; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, "work");
    if (day === 2) {
      const before = (await saved(page))!.game;
      await page.reload();
      await expect
        .poll(async () => (await saved(page))?.game.phase)
        .toBe("feedback");
      expect((await saved(page))!.game.cash).toBe(before.cash);
      expect((await saved(page))!.game.evidence).toHaveLength(
        before.evidence.length,
      );
    }
    await advance(page);
  }
  expect((await saved(page))!.game.cash).toBe(4200);
  await finish(page);
  expect((await saved(page))!.game.cash).toBe(1200);
  expect(
    (await saved(page))!.game.evidence.filter(
      (entry) => entry.action === "choose",
    ),
  ).toHaveLength(8);
  await expect(page.getByText("踏实筹备的店长", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /证据/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭证据", exact: true }).click();
  await page.getByRole("button", { name: /重开一局/ }).click();
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
  expect((await saved(page))!.game.sessionId).not.toBe(id);
  expect((await saved(page))!.game.evidence).toHaveLength(0);
  for (let day = 1; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
  }
  await finish(page);
  await page.getByRole("button", { name: "清除记录", exact: true }).click();
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
  expect(await saved(page)).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
  expect(outgoing).toEqual([]);
});

test("四次工作四次零收支的真实路线到3200", async ({ page }) => {
  await begin(page);
  const dice = [3, 1, 1, 1, 1, 1, 1, 1];
  const options = [
    "skip",
    "keep",
    "skip",
    "decline",
    "work",
    "work",
    "work",
    "work",
  ];
  for (let i = 0; i < 8; i++) {
    await arrive(page, dice[i]);
    await choose(page, options[i]);
    await advance(page);
  }
  expect((await saved(page))!.game.cash).toBe(3200);
  await finish(page);
  expect((await saved(page))!.game.cash).toBe(200);
});

test("第二天购摊六次收入两次工作，真实支路终局3180", async ({ page }) => {
  await begin(page);
  const dice = [3, 1, 1, 1, 1, 1, 2, 1];
  const options = [
    "work",
    "buy",
    "skip",
    "decline",
    "work",
    "skip",
    "plan",
    "skip",
  ];
  for (let i = 0; i < 8; i++) {
    await arrive(page, dice[i], i === 4 ? 1 : 0);
    await choose(page, options[i]);
    await advance(page);
  }
  expect((await saved(page))!.game.cash).toBe(2700);
  await finish(page, true);
  expect((await saved(page))!.game.result?.cashBeforeOpening).toBe(3180);
  expect((await saved(page))!.game.cash).toBe(180);
});

test("未达标仍展示完整画像与800缺口", async ({ page }) => {
  await begin(page);
  const dice = [3, 1, 1, 1, 1, 1, 2, 1];
  const options = [
    "skip",
    "keep",
    "skip",
    "decline",
    "watch",
    "skip",
    "plan",
    "skip",
  ];
  for (let i = 0; i < 8; i++) {
    await arrive(page, dice[i], i === 4 ? 1 : 0);
    await choose(page, options[i]);
    await advance(page);
  }
  await finish(page);
  expect((await saved(page))!.game.result?.gap).toBe(800);
  await expect(page.getByText("咖啡馆筹备中", { exact: true })).toBeVisible();
});

test("三条八回合路线覆盖16落点、两处分支和11类基础事件", async ({ page }) => {
  const places = new Set<string>();
  const events = new Set<string>();
  const tours = [
    { dice: [1, 1, 1, 1, 1, 1, 1, 1], branches: [] },
    { dice: [2, 1, 1, 1, 1, 1, 1, 1], branches: [1, 6] },
    { dice: [6, 3, 1, 1, 1, 1, 1, 1], branches: [] },
  ];
  for (const tour of tours) {
    await begin(page);
    for (let i = 0; i < 8; i++) {
      const state = await arrive(
        page,
        tour.dice[i],
        tour.branches.includes(i) ? 1 : 0,
      );
      places.add(state.position);
      events.add(state.game.event!.id);
      await choose(page, "work");
      await advance(page);
    }
    await finish(page);
    await page.getByRole("button", { name: "清除记录", exact: true }).click();
  }
  expect([...places].sort()).toEqual(
    [
      "square",
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
      "repair",
      "garden",
      "music",
      "dock",
    ].sort(),
  );
  expect([...events].sort()).toEqual([
    "E01",
    "E02",
    "E03",
    "E04",
    "E05",
    "E07",
    "E08",
    "E09",
    "E10",
    "E11",
    "E12",
  ]);
});

test("资料比较、客观题及持仓更新补齐第12类事件", async ({ page }) => {
  await begin(page);
  await arrive(page, 3);
  await page.getByRole("button", { name: /查看资料 · 营业记录/ }).click();
  await page.getByRole("button", { name: /查看资料 · 商家访谈/ }).click();
  await page.getByRole("button", { name: /比较两份来源/ }).click();
  await page
    .getByText("可选理解题 · 不影响金币，可直接跳过", { exact: true })
    .click();
  await page.getByRole("button", { name: "20", exact: true }).click();
  expect(
    (await saved(page))!.game.evidence.some(
      (entry) => entry.action === "answer" && entry.correct,
    ),
  ).toBe(true);
  await choose(page, "skip");
  await advance(page);
  await arrive(page, 4);
  await choose(page, "small");
  await advance(page);
  await arrive(page, 2);
  await choose(page, "decline");
  await advance(page);
  const update = await arrive(page, 1);
  expect(update.game.event?.id).toBe("E06");
  const before = update.game.cash;
  await choose(page, "sell");
  expect((await saved(page))!.game.cash).toBe(
    before + (update.game.scenario === "A" ? 160 : 240),
  );
});

test("手机竖屏无横向溢出且真实流程可继续", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await arrive(page, 2);
  await expect(
    page.getByRole("region", { name: "挑选开店工具" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await choose(page, "work");
  await advance(page);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("损坏版本不能恢复为合法游戏", async ({ page }) => {
  await page.addInitScript(
    (storageKey) =>
      sessionStorage.setItem(storageKey, '{"game":{"rulesVersion":-1}}'),
    key,
  );
  await page.goto("/");
  await expect(
    page.getByText("记录版本不兼容或内容损坏，请重新开始。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
});

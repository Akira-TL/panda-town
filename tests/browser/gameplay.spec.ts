import { expect, test, type Page } from "@playwright/test";
import {
  saved,
  begin,
  arrive,
  choose,
  advance,
  finish,
  key,
  resetSession,
} from "./helpers";

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
  await resetSession(page, "restart");
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
  expect((await saved(page))!.game.sessionId).not.toBe(id);
  expect((await saved(page))!.game.evidence).toHaveLength(0);
  for (let day = 1; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
  }
  await finish(page);
  await resetSession(page, "clear");
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
    await resetSession(page, "clear");
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
  await page.getByRole("button", { name: /先看看资料/ }).click();
  await page
    .getByRole("button", { name: /展开这份资料/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /展开这份资料/ })
    .first()
    .click();
  await page.getByRole("button", { name: "比较两份来源", exact: true }).click();
  await page.screenshot({ path: "logs/validation-study.png" });
  await page.getByRole("button", { name: /理解题 · 可跳过/ }).click();
  await page.getByRole("button", { name: "20", exact: true }).click();
  expect(
    (await saved(page))!.game.evidence.some(
      (entry) => entry.action === "answer" && entry.correct,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "关闭资料", exact: true }).click();
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

for (const example of [
  { name: "旧版本与无效结构", raw: '{"game":{"rulesVersion":-1}}' },
  { name: "无法解析的JSON", raw: "{" },
]) {
  test(`损坏记录明确提示重新开始：${example.name}`, async ({ page }) => {
    await page.addInitScript(
      ({ storageKey, raw }) => {
        sessionStorage.setItem(storageKey, raw);
      },
      { storageKey: key, raw: example.raw },
    );
    await page.goto("/");
    await expect(
      page.getByText("记录版本不兼容或内容损坏，请重新开始。", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /出发去小镇/ }).click();
    await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
    expect((await saved(page))!.game.rulesVersion).toBe(2);
    expect((await saved(page))!.game.cash).toBe(1000);
    expect((await saved(page))!.game.evidence).toHaveLength(0);
  });
}

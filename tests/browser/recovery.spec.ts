import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, finish, saved, key } from "./helpers";

test("移动、待选择、已提交、终局和报告刷新均保持本局且不重复发钱", async ({
  page,
}) => {
  await begin(page);
  const original = (await saved(page))!;
  await page.reload();
  await expect(page.getByRole("button", { name: /掷骰出发/ })).toBeVisible();
  expect((await saved(page))!.game).toEqual(original.game);
  await page.getByRole("button", { name: "简化动画 ✓", exact: true }).click();
  await page.evaluate(() => {
    window.__pandaOriginalRandom = Math.random;
    Math.random = () => 0.99;
  });
  await page.getByRole("button", { name: /掷骰出发/ }).click();
  await page.evaluate(() => {
    Math.random = window.__pandaOriginalRandom;
  });
  const moving = (await saved(page))!;
  expect(moving.game.phase).toBe("travel");
  expect(moving.remaining).toBeGreaterThan(0);
  await page.reload();
  for (let iteration = 0; iteration < 8; iteration++) {
    await page.waitForFunction((storageKey) => {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return false;
      const state = JSON.parse(raw) as {
        branch: boolean;
        game: { phase: string };
      };
      return state.branch || state.game.phase === "decision";
    }, key);
    if ((await saved(page))!.game.phase === "decision") break;
    await page
      .getByRole("region", { name: "选择岔路" })
      .getByRole("button")
      .first()
      .click();
  }
  const decision = (await saved(page))!;
  expect(decision.game.sessionId).toBe(original.game.sessionId);
  expect(decision.die).toBe(6);
  expect(decision.position).toBe("bridge");
  expect(decision.game.cash).toBe(1000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "做一份临时工作，收入 250", exact: true }),
  ).toBeVisible();
  expect((await saved(page))!.game).toEqual(decision.game);
  await choose(page, "work");
  const feedback = (await saved(page))!.game;
  await page.reload();
  await expect(
    page.getByRole("button", { name: /收好今天的收入/ }),
  ).toBeVisible();
  expect((await saved(page))!.game).toEqual(feedback);
  await advance(page);
  expect((await saved(page))!.game.cash).toBe(1400);
  for (let day = 2; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
  }
  const settlement = (await saved(page))!.game;
  await page.reload();
  await expect(page.getByRole("button", { name: /确认结算/ })).toBeVisible();
  expect((await saved(page))!.game).toEqual(settlement);
  await finish(page);
  const report = (await saved(page))!.game;
  expect(report.cash).toBe(1200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "清除记录", exact: true }),
  ).toBeVisible();
  expect((await saved(page))!.game).toEqual(report);
});

import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, saved, finish } from "./helpers";

test("模型请求失败明确提示开发预览，决策与收入仍可完成", async ({ page }) => {
  await page.route("**/models/*.glb", (route) => route.abort("failed"));
  await begin(page);
  await expect(
    page.getByText("开发预览 · 部分正式模型待接入", { exact: true }),
  ).toBeVisible();
  await arrive(page, 1);
  await choose(page, "work");
  await advance(page);
  expect((await saved(page))!.game.cash).toBe(1400);
  expect((await saved(page))!.game.day).toBe(2);
});

test("三维能力不可用显示明确错误与重试，不冒充完整场景", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: () => null,
    });
  });
  await begin(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "三维场景暂时无法显示" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "刷新重试", exact: true }),
  ).toBeVisible();
});

test("本机会话存储拒绝时提示并保留内存玩法", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value: () => {
        throw new Error("test storage unavailable");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("test storage unavailable");
      },
    });
  });
  await begin(page);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /记录无法保存|本设备记录不可用|进度无法保存/ }),
  ).toBeVisible();
  for (let day = 1; day <= 8; day++) {
    await page.evaluate(() => {
      window.__pandaOriginalRandom = Math.random;
      Math.random = () => 0.01;
    });
    await page.getByRole("button", { name: /掷骰出发/ }).click();
    await page.evaluate(() => {
      Math.random = window.__pandaOriginalRandom;
    });
    const work = page.getByRole("button", {
      name: "做一份临时工作，收入 250",
      exact: true,
    });
    const branch = page.getByRole("region", { name: "选择岔路" });
    await expect(work.or(branch)).toBeVisible();
    if (await branch.isVisible())
      await branch.getByRole("button").first().click();
    await work.click();
    await page
      .getByRole("button", { name: /收好(?:今天|第八天)的收入/ })
      .click();
  }
  await finish(page);
  await expect(
    page
      .getByRole("region", { name: "用户画像", exact: true })
      .getByText("4,200", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("开店后余额 1,200", { exact: true }),
  ).toBeVisible();
});

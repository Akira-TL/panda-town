import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, finish, saved } from "./helpers";

test("手机390px完整八回合与报告，360px和横屏不丢进度", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  for (let day = 1; day <= 8; day++) {
    await arrive(page, 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (day === 2) {
      await page.screenshot({ path: "logs/validation-mobile-decision.png" });
      await page.setViewportSize({ width: 844, height: 390 });
      expect((await saved(page))!.game.day).toBe(2);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.screenshot({
        path: "logs/validation-mobile-360-decision.png",
      });
    }
    await choose(page, "work");
    await advance(page);
  }
  await finish(page);
  await page.screenshot({
    path: "logs/validation-mobile-360-report.png",
    fullPage: true,
  });
  expect((await saved(page))!.game.result?.cashBeforeOpening).toBe(4200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "logs/validation-mobile-report.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

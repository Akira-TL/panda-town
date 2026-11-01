import { expect, test } from "@playwright/test";
import { clickWithDieOne } from "./learning-fixtures";

test("短竖屏与横屏的主要交易操作可见可点", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await page.getByRole("button", { name: /^买入/ }).click();
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "下一站 →", exact: true }),
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
  await expect(page.locator(".shop-panel .market-candles")).toHaveAttribute(
    "data-chart-mode",
    "candle",
  );
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const boxes = await page
      .locator(".shop-actions button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          const panel = button.closest(".shop-panel")!.getBoundingClientRect();
          const x = rect.left + rect.width / 2,
            y = rect.top + rect.height / 2;
          return {
            label: button.textContent,
            width: rect.width,
            height: rect.height,
            inside:
              rect.top >= Math.max(0, panel.top) &&
              rect.bottom <= Math.min(innerHeight, panel.bottom),
            hit: button.contains(document.elementFromPoint(x, y)),
          };
        }),
      );
    await page.screenshot({
      path: `logs/trading-layout-${viewport.width}x${viewport.height}.png`,
    });
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box.height, box.label ?? "").toBeGreaterThanOrEqual(44);
      expect(box.width, box.label ?? "").toBeGreaterThanOrEqual(44);
      expect(box.inside, JSON.stringify({ viewport, box })).toBe(true);
      expect(box.hit, JSON.stringify({ viewport, box })).toBe(true);
    }
  }
});

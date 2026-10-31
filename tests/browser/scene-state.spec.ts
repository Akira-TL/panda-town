import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, resetSession, saved } from "./helpers";

test("七名居民与十类模型加载后的跟随全局手机三图", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const selector = [
    "panda",
    "tree",
    "bakery",
    "grocery",
    "market",
    "research",
    "bank",
    "gifts",
    "rival",
    "cafe",
  ]
    .map((id) => `[data-loaded-models~="${id}"]`)
    .join("");
  const ready = page.locator(`${selector}[data-resident-count="7"]`);
  await begin(page);
  await expect(ready).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "logs/validation-follow.png" });
  await page.getByRole("button", { name: "全局", exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "logs/validation-overview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(ready).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "logs/validation-mobile.png" });
  expect(errors).toEqual([]);
});

test("真实购买使场景物件和工具出现，第二天对手开摊且清除后为空", async ({
  page,
}) => {
  await begin(page);
  const scene = page.locator('[data-resident-count="7"]');
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-scene-items", "");
  await expect(scene).toHaveAttribute("data-tool-state", "none");
  await expect(scene).toHaveAttribute("data-opponent-stall", "false");
  await arrive(page, 1);
  await choose(page, "ordinary");
  await expect(scene).toHaveAttribute("data-scene-items", "bread");
  await page.screenshot({ path: "logs/validation-scene-bread.png" });
  await advance(page);
  await arrive(page, 1);
  await choose(page, "used");
  await expect(scene).toHaveAttribute("data-tool-state", "used");
  await advance(page);
  expect((await saved(page))!.game.opponent.stallBoughtDay).toBe(2);
  await expect(scene).toHaveAttribute("data-opponent-stall", "true");
  await page.getByRole("button", { name: "全局", exact: true }).click();
  await page.screenshot({ path: "logs/validation-scene-opponent-stall.png" });
  await page.getByRole("button", { name: "跟随", exact: true }).click();
  const market = await arrive(page, 2, 0);
  expect(market.position).toBe("market");
  await expect(scene).toHaveAttribute("data-tool-state", "used");
  await page.screenshot({ path: "logs/validation-scene-used-tool.png" });
  await page
    .getByRole("button", { name: "资产与旅程手记", exact: true })
    .click();
  await resetSession(page, "clear");
  await begin(page);
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-scene-items", "");
  await expect(scene).toHaveAttribute("data-tool-state", "none");
  await expect(scene).toHaveAttribute("data-opponent-stall", "false");
});

test("桥上真实合作先显示待交货，第三天才显示优质工具", async ({ page }) => {
  await begin(page);
  const scene = page.locator('[data-resident-count="7"]');
  await expect(scene).toBeVisible();
  await arrive(page, 5, 0);
  await choose(page, "work");
  await advance(page);
  const bridge = await arrive(page, 1);
  expect(bridge.position).toBe("bridge");
  await choose(page, "cooperate");
  expect((await saved(page))!.game.assets.tool).toEqual({
    status: "pending",
    deliveryDay: 3,
  });
  await expect(scene).toHaveAttribute("data-tool-state", "pending");
  await page.getByRole("button", { name: "全局", exact: true }).click();
  await page.screenshot({ path: "logs/validation-scene-pending-tool.png" });
  await advance(page);
  expect((await saved(page))!.game.assets.tool).toEqual({
    status: "owned",
    quality: "premium",
  });
  await expect(scene).toHaveAttribute("data-tool-state", "premium");
  await page.getByRole("button", { name: "跟随", exact: true }).click();
  await arrive(page, 6, 0);
  await choose(page, "work");
  await advance(page);
  const market = await arrive(page, 4, 0);
  expect(market.position).toBe("market");
  await page.screenshot({ path: "logs/validation-scene-premium-tool.png" });
});

for (const item of [
  { id: "bread-gift", option: "novel", bakery: true },
  { id: "practical-gift", option: "practical", bakery: false },
  { id: "novel-gift", option: "novel", bakery: false },
] as const) {
  test(`实际购买${item.id}只显示对应纪念物，不伪造另一物件`, async ({
    page,
  }) => {
    await begin(page);
    const scene = page.locator('[data-resident-count="7"]');
    await expect(scene).toBeVisible();
    if (item.bakery) await arrive(page, 1);
    else {
      await arrive(page, 6, 0);
      await choose(page, "work");
      await advance(page);
      const gifts = await arrive(page, 2, 0);
      expect(gifts.position).toBe("gifts");
    }
    await choose(page, item.option);
    expect((await saved(page))!.game.assets.items).toEqual([item.id]);
    await expect(scene).toHaveAttribute("data-scene-items", item.id);
    await page.screenshot({ path: `logs/validation-scene-${item.id}.png` });
  });
}

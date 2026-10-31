import { expect, test } from "@playwright/test";
import {
  begin,
  arrive,
  choose,
  advance,
  finish,
  resetSession,
} from "./helpers";

test("真实面包店门前双镜头及390双移动模型", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page);
  const scene = page.locator(
    '[data-loaded-models~="panda"][data-loaded-models~="bakery"]',
  );
  await expect(scene).toBeVisible();
  await arrive(page, 1);
  await page.waitForTimeout(200);
  await expect(scene).toHaveAttribute("data-camera-obstructed", "0");
  await page.screenshot({ path: "logs/validation-bakery-follow.png" });
  await page.getByRole("button", { name: "全局", exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "logs/validation-bakery-overview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const bakeryResponse = page.waitForResponse((response) =>
    response.url().endsWith("/models/bakery-mobile-v2.glb"),
  );
  const pandaResponse = page.waitForResponse((response) =>
    response.url().endsWith("/models/panda-mobile-rigged-v2.glb"),
  );
  await page.reload();
  expect((await bakeryResponse).status()).toBe(200);
  expect((await pandaResponse).status()).toBe(200);
  await expect(scene).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "logs/validation-bakery-mobile.png" });
  expect(errors).toEqual([]);
});

test("十六个实际落点的第三人称视线与截图证据", async ({ page }) => {
  test.setTimeout(240_000);
  const visited = new Set<string>();
  const tours = [
    { dice: [1, 1, 1, 1, 1, 1, 1, 1], branches: [] },
    { dice: [2, 1, 1, 1, 1, 1, 1, 1], branches: [1, 6] },
    { dice: [6, 3, 1, 1, 1, 1, 1, 1], branches: [] },
  ];
  for (const tour of tours) {
    await begin(page);
    await expect(page.locator('[data-loaded-models~="panda"]')).toBeVisible();
    for (let index = 0; index < 8; index++) {
      const session = await arrive(
        page,
        tour.dice[index],
        tour.branches.includes(index) ? 1 : 0,
      );
      await page.waitForTimeout(200);
      const scene = page.locator('[data-loaded-models~="panda"]');
      await expect(scene).toHaveAttribute("data-camera-obstructed", "0");
      if (!visited.has(session.position)) {
        await page.screenshot({ path: `logs/camera-${session.position}.png` });
        visited.add(session.position);
      }
      await choose(page, "work");
      await advance(page);
    }
    await finish(page);
    await resetSession(page, "clear");
  }
  expect(visited.size).toBe(16);
});

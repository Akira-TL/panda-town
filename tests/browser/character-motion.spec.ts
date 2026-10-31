import { expect, test } from "@playwright/test";
import { begin } from "./helpers";

test("真实骨骼熊猫加载Idle和Walk并在自动移动时切换", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const modelResponse = page.waitForResponse((response) =>
    response.url().endsWith("/models/panda-rigged-v2.glb"),
  );
  await begin(page);
  expect((await modelResponse).status()).toBe(200);
  const character = page.locator('[data-loaded-models~="panda"]');
  await expect(character).toHaveAttribute("data-character-animations", /Idle/);
  await expect(character).toHaveAttribute("data-character-animations", /Walk/);
  await expect(character).toHaveAttribute("data-character-state", "Idle");
  await page.getByRole("button", { name: "简化动画 ✓", exact: true }).click();
  await page.evaluate(() => {
    window.__pandaOriginalRandom = Math.random;
    Math.random = () => 0.01;
  });
  await page.getByRole("button", { name: /掷骰出发/ }).click();
  await page.evaluate(() => {
    Math.random = window.__pandaOriginalRandom;
  });
  await expect(character).toHaveAttribute("data-character-state", "Walk");
  await page.screenshot({ path: "logs/validation-panda-walk.png" });
  await expect(character).toHaveAttribute("data-character-state", "Idle");
  await expect(
    page.getByRole("button", { name: "做一份临时工作，收入 250", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "logs/validation-panda-idle.png" });
  expect(errors).toEqual([]);
});

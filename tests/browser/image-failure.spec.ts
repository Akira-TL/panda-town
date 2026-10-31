import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, saved } from "./helpers";

test("图像请求失败显示资源缺失，文字与实际选择仍可操作", async ({ page }) => {
  await page.route("**/art/*", (route) => route.abort("failed"));
  await begin(page);
  const missing = page.getByText("开发预览 · 部分模型或纹理未加载", {
    exact: true,
  });
  await expect(missing).toBeVisible();
  await expect(missing).toHaveAttribute("title", /texture-/);
  await arrive(page, 1);
  await choose(page, "work");
  await advance(page);
  expect((await saved(page))!.game.cash).toBe(1400);
  expect((await saved(page))!.game.day).toBe(2);
  await expect(page.getByRole("button", { name: /掷骰出发/ })).toBeVisible();
  await page.screenshot({ path: "logs/validation-image-failure.png" });
});

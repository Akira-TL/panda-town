import { expect, test } from "@playwright/test";

test("保存十类真实模型加载后的双镜头与手机截图，供视觉对照", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const pandaResponse = page.waitForResponse((response) =>
    /\/models\/panda-rigged-v2\.glb$/.test(response.url()),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /出发去小镇/ }).click();
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
  await expect(page.getByRole("button", { name: /掷骰出发/ })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /熊猫小镇三维场景/ }),
  ).toBeVisible();
  const response = await pandaResponse;
  expect(response.status()).toBe(200);
  await response.finished();
  const loadedScene = page.locator(
    [
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
      .map((name) => `[data-loaded-models~="${name}"]`)
      .join(""),
  );
  await expect(loadedScene).toBeVisible({ timeout: 60_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => {
          if (++frames >= 80) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.screenshot({ path: "logs/validation-follow.png" });
  await page.getByRole("button", { name: "全局", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => {
          if (++frames >= 40) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.screenshot({ path: "logs/validation-overview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileResponse = page.waitForResponse((entry) =>
    /\/models\/panda-mobile-rigged-v2\.glb$/.test(entry.url()),
  );
  await page.reload();
  const mobile = await mobileResponse;
  expect(mobile.status()).toBe(200);
  await mobile.finished();
  await expect(loadedScene).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "logs/validation-mobile.png" });
  expect(pageErrors).toEqual([]);
});

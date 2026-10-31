import { expect, test } from "@playwright/test";

test("保存当前开发场景的双镜头与手机截图，不宣称正式模型完成", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /出发去小镇/ }).click();
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
  await expect(page.getByRole("button", { name: /掷骰出发/ })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /熊猫小镇三维场景/ }),
  ).toBeVisible();
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
  await page.screenshot({ path: "logs/validation-mobile.png" });
});

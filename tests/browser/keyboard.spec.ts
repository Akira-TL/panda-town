import { expect, test, type Locator, type Page } from "@playwright/test";
import { saved, type SavedSession } from "./helpers";

async function keyboardActivate(page: Page, target: Locator) {
  for (let step = 0; step < 100; step++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await page.keyboard.press("Enter");
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("无法仅通过Tab到达目标操作");
}

test("仅键盘从开场经过分支与八天选择到报告", async ({ page }) => {
  await page.goto("/");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /出发去小镇/ }),
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /明白了，开始第一天/ }),
  );
  for (let day = 1; day <= 8; day++) {
    await page.evaluate(() => {
      window.__pandaOriginalRandom = Math.random;
      Math.random = () => 0.01;
    });
    await keyboardActivate(
      page,
      page.getByRole("button", { name: /掷骰出发/ }),
    );
    await page.evaluate(() => {
      Math.random = window.__pandaOriginalRandom;
    });
    await page.waitForFunction(() => {
      const value = JSON.parse(
        sessionStorage.getItem("panda-town.current.v1") ?? "null",
      ) as SavedSession | null;
      return value?.branch || value?.game.phase === "decision";
    });
    if ((await saved(page))?.branch) {
      await keyboardActivate(
        page,
        page
          .getByRole("region", { name: "选择岔路" })
          .getByRole("button")
          .first(),
      );
    }
    await expect
      .poll(async () => (await saved(page))?.game.phase)
      .toBe("decision");
    await keyboardActivate(
      page,
      page.getByRole("button", {
        name: "做一份临时工作，收入 250",
        exact: true,
      }),
    );
    await keyboardActivate(
      page,
      page.getByRole("button", {
        name: /收好(?:今天|第八天)的收入/,
      }),
    );
  }
  await keyboardActivate(page, page.getByRole("button", { name: /确认结算/ }));
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /看看本局的选择与画像/ }),
  );
  await expect(
    page.getByRole("button", { name: "清除记录", exact: true }),
  ).toBeVisible();
});

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

test("仅键盘完成八天及资料证据焦点、重开和清除确认", async ({ page }) => {
  await page.goto("/");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /出发去小镇/ }),
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /明白了，开始第一天/ }),
  );
  const initial = (await saved(page))!;
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "简化动画 ✓", exact: true }),
  );
  expect(await saved(page)).toEqual(initial);
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "简化动画", exact: true }),
  );
  expect(await saved(page)).toEqual(initial);
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
    if (day === 5) {
      expect((await saved(page))!.position).toBe("research");
      const beforeStudy = (await saved(page))!.game;
      const entry = page.getByRole("button", { name: /先看看资料/ });
      await keyboardActivate(page, entry);
      const dialog = page.getByRole("dialog");
      const close = dialog.getByRole("button", {
        name: "关闭资料",
        exact: true,
      });
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        dialog.getByRole("button", { name: /回到街边/ }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      for (let source = 0; source < 2; source++)
        await keyboardActivate(
          page,
          dialog.getByRole("button", { name: /展开这份资料/ }).first(),
        );
      await keyboardActivate(
        page,
        dialog.getByRole("button", { name: "比较两份来源", exact: true }),
      );
      await expect(
        dialog.getByRole("group", { name: "资料比较" }),
      ).toBeFocused();
      const studied = (await saved(page))!.game;
      expect(studied.cash).toBe(beforeStudy.cash);
      expect(studied.day).toBe(beforeStudy.day);
      expect(studied.phase).toBe("decision");
      expect(
        studied.evidence.filter((entry) => entry.action === "compare"),
      ).toHaveLength(1);
      await page.screenshot({ path: "logs/validation-keyboard-study.png" });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(entry).toBeFocused();
    }
    await keyboardActivate(
      page,
      page.getByRole("button", {
        name: "做一份临时工作，收入 250",
        exact: true,
      }),
    );
    if (day === 1) {
      await expect
        .poll(async () => (await saved(page))!.game.phase)
        .toBe("feedback");
      const selected = (await saved(page))!;
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      expect(await saved(page)).toEqual(selected);
    }
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
  const completed = (await saved(page))!.game;
  expect(completed.cash).toBe(1200);
  const source = page.locator(".journal-days button").first();
  await keyboardActivate(page, source);
  const evidence = page.getByRole("dialog");
  const closeEvidence = evidence.getByRole("button", {
    name: "关闭证据",
    exact: true,
  });
  await expect(closeEvidence).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    evidence.getByRole("button", { name: "下一条 →", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeEvidence).toBeFocused();
  await page.screenshot({ path: "logs/validation-keyboard-evidence.png" });
  await page.keyboard.press("Escape");
  await expect(evidence).toHaveCount(0);
  await expect(source).toBeFocused();
  await keyboardActivate(page, page.getByRole("button", { name: /重开一局/ }));
  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByRole("button", { name: "取消，保留本局", exact: true }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    confirmation.getByRole("button", { name: "确认重开", exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: /明白了，开始第一天/ }),
  );
  const restarted = (await saved(page))!.game;
  expect(restarted.sessionId).not.toBe(completed.sessionId);
  expect(restarted.cash).toBe(1000);
  expect(restarted.evidence).toHaveLength(0);
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "资产与旅程手记", exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "清除记录", exact: true }),
  );
  await expect(
    confirmation.getByRole("button", { name: "取消，保留本局", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "logs/validation-keyboard-clear-confirmation.png",
  });
  await keyboardActivate(
    page,
    confirmation.getByRole("button", { name: "确认清除", exact: true }),
  );
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
  expect(await saved(page)).toBeNull();
});

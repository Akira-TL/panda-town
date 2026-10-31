import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, saved } from "./helpers";

test("手机真实码头路线作答K02，首次答案与资料焦点均保留", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await arrive(page, 6, 0);
  await choose(page, "work");
  await advance(page);
  await arrive(page, 2, 1);
  expect((await saved(page))!.position).toBe("dock");
  const cash = (await saved(page))!.game.cash;
  await page.getByRole("button", { name: /先看看资料/ }).click();
  await page
    .getByRole("button", { name: /展开这份资料/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /展开这份资料/ })
    .first()
    .click();
  await page.getByRole("button", { name: /理解题 · 可跳过/ }).click();
  await page.getByRole("button", { name: "消息乙", exact: true }).click();
  const answers = (await saved(page))!.game.evidence.filter(
    (entry) => entry.action === "answer",
  );
  expect(answers).toHaveLength(1);
  expect(answers[0].choice).toBe("K02:B");
  expect(answers[0].correct).toBe(true);
  expect((await saved(page))!.game.cash).toBe(cash);
  await expect(page.getByRole("dialog")).toContainText("已记录首次答案");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.screenshot({ path: "logs/validation-mobile-k02.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /先看看资料/ })).toBeFocused();
  await choose(page, "skip");
  await advance(page);
});

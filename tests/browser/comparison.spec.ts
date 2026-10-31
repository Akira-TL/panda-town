import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, saved } from "./helpers";

const examples = [
  {
    location: "research",
    label: "研究站的记录与访谈",
    explanation: "营业记录提供已发生的历史样例，访谈记录个人看法",
  },
  {
    location: "dock",
    label: "码头的计划与成交",
    explanation: "两份消息的时间范围和证据类型不同",
  },
] as const;

for (const example of examples) {
  test(`真实资料比较：${example.label}刷新后仍只计一次且不泄露答案`, async ({
    page,
  }) => {
    await begin(page);
    if (example.location === "research") await arrive(page, 5);
    else {
      await arrive(page, 6, 0);
      await choose(page, "work");
      await advance(page);
      await arrive(page, 2, 1);
    }
    const before = (await saved(page))!;
    expect(before.position).toBe(example.location);
    const priorCount = before.game.evidence.filter(
      (entry) => entry.action === "compare",
    ).length;
    await page.getByRole("button", { name: /先看看资料/ }).click();
    const dialog = page.getByRole("dialog");
    const compare = dialog.getByRole("button", {
      name: "比较两份来源",
      exact: true,
    });
    await expect(compare).toBeDisabled();
    await dialog
      .getByRole("button", { name: /展开这份资料/ })
      .first()
      .click();
    await expect(compare).toBeDisabled();
    await dialog
      .getByRole("button", { name: /展开这份资料/ })
      .first()
      .click();
    await expect(compare).toBeEnabled();
    await compare.click();
    const panel = dialog.getByRole("group", { name: "资料比较", exact: true });
    await expect(panel).toBeFocused();
    const explanation = panel.getByRole("status");
    await expect(explanation).toContainText(example.explanation);
    await expect(explanation).not.toContainText(
      /120|100|20|消息甲|消息乙|正确答案/,
    );
    await expect(
      panel.getByRole("button", { name: "✓ 已比较两份来源", exact: true }),
    ).toBeDisabled();
    const compared = (await saved(page))!.game;
    expect(compared.cash).toBe(before.game.cash);
    expect(compared.day).toBe(before.game.day);
    expect(compared.phase).toBe("decision");
    expect(
      compared.evidence.filter((entry) => entry.action === "compare"),
    ).toHaveLength(priorCount + 1);
    await page.screenshot({
      path: `logs/validation-comparison-${example.location}.png`,
    });
    await page.reload();
    await page.getByRole("button", { name: /先看看资料/ }).click();
    await expect(
      dialog.getByRole("button", { name: "✓ 已比较两份来源", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole("group", { name: "资料比较" })).toContainText(
      example.explanation,
    );
    expect((await saved(page))!.game).toEqual(compared);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /先看看资料/ }),
    ).toBeFocused();
  });
}

test("360像素长存储失败提示可关闭，按钮至少44像素且无横向溢出", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("测试写入拒绝", "SecurityError");
    };
  });
  await begin(page);
  const notice = page.getByRole("status").filter({ hasText: "进度无法保存" });
  await expect(notice).toContainText("刷新可能丢失进度或恢复较早记录");
  const close = page.getByRole("button", { name: "关闭提示", exact: true });
  const bounds = await close.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  await page.screenshot({ path: "logs/validation-mobile-storage-notice.png" });
  await close.click();
  await expect(notice).toHaveCount(0);
});

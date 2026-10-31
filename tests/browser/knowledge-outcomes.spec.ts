import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, finish, saved } from "./helpers";

const cases = [
  { id: "correct", label: "正确作答", answer: "20", correct: 1 },
  { id: "incorrect", label: "错误作答", answer: "30", correct: 0 },
  { id: "skipped", label: "跳过题目", answer: null, correct: 0 },
  { id: "reopened", label: "重开资料不能重复作答", answer: "20", correct: 1 },
] as const;

for (const example of cases) {
  test(`资料理解题真实操作：${example.label}不改变现金与主要行动`, async ({
    page,
  }) => {
    await begin(page);
    await arrive(page, 5);
    expect((await saved(page))!.position).toBe("research");
    const cash = (await saved(page))!.game.cash;
    await page.getByRole("button", { name: /先看看资料/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "比较两份来源", exact: true }),
    ).toBeDisabled();
    for (let source = 0; source < 2; source++)
      await dialog
        .getByRole("button", { name: /展开这份资料/ })
        .first()
        .click();
    await dialog
      .getByRole("button", { name: "理解题 · 可跳过", exact: true })
      .click();
    await expect(dialog).toContainText("第二天比第一天的演示营业额增加了多少");
    if (example.answer !== null) {
      await dialog
        .getByRole("button", { name: example.answer, exact: true })
        .click();
      await expect(dialog).toContainText("已记录首次答案");
      await expect(dialog).toContainText("120－100＝20");
      if (example.id === "incorrect")
        await expect(dialog).toContainText("看看这道题的解释");
      else await expect(dialog).toContainText("这次答对了");
    }
    await page.screenshot({
      path: `logs/validation-knowledge-${example.id}.png`,
    });
    await page.getByRole("button", { name: "关闭资料", exact: true }).click();
    if (example.id === "reopened") {
      await page.getByRole("button", { name: /先看看资料/ }).click();
      await dialog
        .getByRole("button", { name: "理解题 · 可跳过", exact: true })
        .click();
      await expect(dialog).toContainText("已记录首次答案");
      await expect(
        dialog.getByRole("button", { name: "30", exact: true }),
      ).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: "20", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "关闭资料", exact: true }).click();
    }
    const beforeChoice = (await saved(page))!.game;
    expect(beforeChoice.phase).toBe("decision");
    expect(beforeChoice.cash).toBe(cash);
    const answers = beforeChoice.evidence.filter(
      (entry) => entry.action === "answer",
    );
    expect(answers).toHaveLength(example.answer === null ? 0 : 1);
    if (answers.length) {
      expect(answers[0].choice).toBe(`K01:${example.answer}`);
      expect(answers[0].correct).toBe(example.correct === 1);
    }
    for (let day = 1; day <= 8; day++) {
      if (day > 1) await arrive(page, 1);
      await choose(page, "work");
      await advance(page);
    }
    await finish(page);
    expect((await saved(page))!.game.result?.cashBeforeOpening).toBe(4200);
    expect((await saved(page))!.game.cash).toBe(1200);
    const knowledge = page.locator(".knowledge-card");
    if (example.answer === null) {
      await expect(knowledge).toContainText("本局未评估");
      await expect(knowledge.locator(".knowledge-answer")).toHaveCount(0);
    } else {
      await expect(knowledge.locator(".knowledge-medallion strong")).toHaveText(
        String(example.correct),
      );
      await expect(knowledge).toContainText("/ 1 题答对");
      await knowledge.locator("summary").click();
      await expect(knowledge).toContainText(`你的答案：${example.answer}`);
      await expect(knowledge).toContainText("正确答案：20");
    }
    await knowledge.screenshot({
      path: `logs/validation-knowledge-${example.id}-report.png`,
    });
  });
}

import { expect, test } from "@playwright/test";
import { arrive, choose, advance, finish, saved } from "./helpers";

for (const scenario of [
  { id: "A", random: 0.1, middleValue: 160, finalValue: 220 },
  { id: "B", random: 0.9, middleValue: 240, finalValue: 180 },
] as const) {
  test(`真实可达投资路径${scenario.id}：第二天投入200，第八天退出${scenario.finalValue}`, async ({
    page,
  }) => {
    await page.goto("/");
    const start = page.getByRole("button", { name: /出发去小镇/ });
    await expect(start).toBeVisible();
    // 仅在正式建局按钮处理期间固定情境随机输入，不改写本局记录。
    await page.evaluate((value) => {
      window.__pandaOriginalRandom = Math.random;
      Math.random = () => value;
    }, scenario.random);
    await start.click();
    await page.evaluate(() => {
      Math.random = window.__pandaOriginalRandom;
    });
    await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
    expect((await saved(page))!.game.scenario).toBe(scenario.id);
    // 银行距起点七步；六面骰第一天到桥，第二天再前进一步。
    await arrive(page, 6, 0);
    await choose(page, "work");
    await advance(page);
    const bank = await arrive(page, 1, 0);
    expect(bank.position).toBe("bank");
    expect(bank.game.event?.id).toBe("E05");
    await choose(page, "small");
    expect((await saved(page))!.game.assets.investment).toEqual({
      cost: 200,
      shares: 2,
      purchasePrice: 100,
    });
    await advance(page);
    for (let day = 3; day <= 8; day++) {
      if (day === 4)
        await expect(
          page.getByText(`演示持仓 · 当前退出价值 ${scenario.middleValue}`, {
            exact: true,
          }),
        ).toBeVisible();
      if (day === 8)
        await expect(
          page.getByText(`演示持仓 · 当前退出价值 ${scenario.finalValue}`, {
            exact: true,
          }),
        ).toBeVisible();
      await arrive(page, 1);
      await choose(page, "work");
      await advance(page);
    }
    // 1000初始+1200基础+7次工作1750-投入200=3750。
    expect((await saved(page))!.game.cash).toBe(3750);
    await page.getByRole("checkbox").check();
    await finish(page);
    const result = (await saved(page))!.game;
    expect(result.result?.cashBeforeOpening).toBe(3750 + scenario.finalValue);
    expect(result.cash).toBe(750 + scenario.finalValue);
    expect(result.assets.investment).toBeNull();
    await page.screenshot({
      path: `logs/validation-investment-${scenario.id}-report.png`,
      fullPage: true,
    });
  });
}

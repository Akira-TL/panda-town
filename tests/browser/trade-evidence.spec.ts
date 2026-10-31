import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance, finish, saved } from "./helpers";

test("真实投资报告按投入时现金显示比例并可核对成交份额", async ({ page }) => {
  await begin(page);
  await arrive(page, 2);
  await choose(page, "work");
  await advance(page);
  await arrive(page, 5);
  expect((await saved(page))!.position).toBe("bank");
  expect((await saved(page))!.game.cash).toBe(1400);
  await choose(page, "small");
  const trade = (await saved(page))!.game.evidence.at(-1)!;
  expect(trade.knownMaterials).toHaveLength(0);
  expect(trade.assetsAfter.investment?.cost).toBe(200);
  expect(trade.assetsAfter.investment?.purchasePrice).toBe(100);
  expect(trade.assetsAfter.investment?.shares).toBe(2);
  await advance(page);
  for (let day = 3; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
  }
  await finish(page);
  expect((await saved(page))!.game.result?.cashBeforeOpening).toBe(3750);
  expect((await saved(page))!.game.cash).toBe(750);
  const observation = page.locator(".investment-observations");
  await expect(observation).toContainText("200 / 当时现金 1400");
  await expect(observation).toContainText("14.3%");
  const investment = page
    .locator("article.profile-fact")
    .filter({ has: page.getByText("不确定收益投入", { exact: true }) });
  await investment.getByRole("button").click();
  const evidence = page.getByRole("dialog");
  await expect(evidence).toContainText("实际投入 200 金币");
  await expect(evidence).toContainText("买入报价 100");
  await expect(evidence).toContainText("2.000 份");
  await expect(
    evidence.getByText("当时查看过的资料", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "logs/validation-trade-evidence.png" });
  await page.getByRole("button", { name: "关闭证据", exact: true }).click();
  await observation.screenshot({
    path: "logs/validation-investment-proportion.png",
  });
});

import { expect, test } from "@playwright/test";
import {
  begin,
  arrive,
  choose,
  advance,
  finish,
  saved,
  resetSession,
} from "./helpers";

test("连续五位参观者完整八回合，清除后证据与会话不继承", async ({ page }) => {
  test.setTimeout(420_000);
  const sessions = new Set<string>();
  for (let visitor = 0; visitor < 5; visitor++) {
    await begin(page);
    const state = (await saved(page))!;
    expect(sessions.has(state.game.sessionId)).toBe(false);
    sessions.add(state.game.sessionId);
    expect(state.game.evidence).toHaveLength(0);
    for (let day = 1; day <= 8; day++) {
      await arrive(page, 1);
      await choose(page, "work");
      await advance(page);
    }
    await finish(page);
    expect((await saved(page))!.game.result?.cashBeforeOpening).toBe(4200);
    expect(
      (await saved(page))!.game.evidence.filter(
        (entry) => entry.action === "choose",
      ),
    ).toHaveLength(8);
    await resetSession(page, "clear");
    await expect(
      page.getByRole("button", { name: /出发去小镇/ }),
    ).toBeVisible();
    expect(await saved(page)).toBeNull();
  }
});

test("中途取消不改变本局，确认重开新ID且确认清除后刷新为空", async ({
  page,
}) => {
  await begin(page);
  await arrive(page, 1);
  await choose(page, "work");
  const before = (await saved(page))!;
  await page
    .getByRole("button", { name: "资产与旅程手记", exact: true })
    .click();
  await page.getByRole("button", { name: "清除记录", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByRole("button", { name: "取消，保留本局", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "确认清除", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    confirmation.getByRole("button", { name: "取消，保留本局", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "关闭资产手记", exact: true }),
  ).toBeVisible();
  expect((await saved(page))!.game).toEqual(before.game);
  await page.getByRole("button", { name: /重开一局/ }).click();
  await page
    .getByRole("button", { name: "取消，保留本局", exact: true })
    .click();
  expect((await saved(page))!.game).toEqual(before.game);
  await resetSession(page, "restart");
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
  expect((await saved(page))!.game.sessionId).not.toBe(before.game.sessionId);
  expect((await saved(page))!.game.evidence).toHaveLength(0);
  expect((await saved(page))!.game.cash).toBe(1000);
  await page
    .getByRole("button", { name: "资产与旅程手记", exact: true })
    .click();
  await resetSession(page, "clear");
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
  expect(await saved(page)).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
});

test("浏览器拒绝删除旧记录时准确提示，不虚报完全清除", async ({ page }) => {
  await begin(page);
  await arrive(page, 1);
  await choose(page, "work");
  const before = (await saved(page))!;
  await page.evaluate(() =>
    Object.defineProperty(Storage.prototype, "removeItem", {
      value: () => {
        throw new Error("test remove refused");
      },
    }),
  );
  await page
    .getByRole("button", { name: "资产与旅程手记", exact: true })
    .click();
  await resetSession(page, "clear");
  await expect(page.getByRole("button", { name: /出发去小镇/ })).toBeVisible();
  await expect(
    page.getByText(
      "界面已清空，但浏览器拒绝删除旧记录。换人前请在浏览器设置中清除此站点数据。",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await saved(page))!.game.sessionId).toBe(before.game.sessionId);
});

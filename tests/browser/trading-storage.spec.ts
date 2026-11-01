import { expect, test } from "@playwright/test";
import type { TradingSession } from "../../src/trading/model";
import type { LearningState } from "../../src/trading/learning";
import { clickWithDieOne } from "./learning-fixtures";

test("保存受阻仍可在内存交易，刷新提示丢失；不声称保存成功", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await page.getByRole("button", { name: /^买入/ }).click();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "进度无法保存" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("panda-town.trading.v1")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始小镇交易", exact: true }),
  ).toBeVisible();
});

test("删除被拒不虚报清除，旧进度仍可恢复；确认取消与重开隔离会话", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.removeItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await clickWithDieOne(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  await page.getByRole("button", { name: /^买入/ }).click();
  const raw = await page.evaluate(() =>
    sessionStorage.getItem("panda-town.trading.v1"),
  );
  await page.getByRole("button", { name: "设置，随时结算" }).click();
  await page.getByRole("button", { name: "清除记录", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "清除这一局的记录？",
  });
  await confirmation.getByRole("button", { name: "取消，保留本局" }).click();
  expect(
    await page.evaluate(() => sessionStorage.getItem("panda-town.trading.v1")),
  ).toBe(raw);
  await page.getByRole("button", { name: "清除记录", exact: true }).click();
  await page.getByRole("button", { name: "确认清除", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("旧记录可能残留");
  expect(
    await page.evaluate(() => sessionStorage.getItem("panda-town.trading.v1")),
  ).toBe(raw);
  await page.reload();
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
  await page.getByRole("button", { name: "设置，随时结算" }).click();
  await page.getByRole("button", { name: "重开一局 ↗", exact: true }).click();
  const restart = page.getByRole("alertdialog", { name: "重新开始一局？" });
  await restart.getByRole("button", { name: "取消，保留本局" }).click();
  expect(
    await page.evaluate(() => sessionStorage.getItem("panda-town.trading.v1")),
  ).toBe(raw);
  await page.getByRole("button", { name: "重开一局 ↗", exact: true }).click();
  await page.getByRole("button", { name: "确认重开", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  ).toBeVisible();
  const fresh = await page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem("panda-town.trading.v1")!,
      ) as TradingSession,
  );
  const previous = JSON.parse(raw!) as TradingSession;
  expect(fresh.game.sessionId).not.toBe(previous.game.sessionId);
  expect(fresh.game.trades).toEqual([]);
  expect(fresh.game.cash).toBe(1000);
  expect(fresh.game.round).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = sessionStorage.getItem("panda-town.learning.v1");
        return raw ? (JSON.parse(raw) as LearningState).sessionId : null;
      }),
    )
    .toBe(fresh.game.sessionId);
  const learning = await page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem("panda-town.learning.v1")!,
      ) as LearningState,
  );
  expect(learning.events).toEqual([]);
  expect(learning.rule).toBeNull();
});

test("损坏记录返回开场，读取被拒有准确提示且仍可开始交易", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("panda-town.trading.v1", "{invalid"),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText(
    "进度已过期或损坏，请重新出发。",
  );
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(
    "本设备无法读取进度；仍可开始，刷新可能丢失。",
  );
  await page.getByRole("button", { name: "开始小镇交易", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  ).toBeVisible();
});

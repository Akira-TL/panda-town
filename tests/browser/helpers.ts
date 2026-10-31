import { expect, type Page } from "@playwright/test";
import type { GameState } from "../../src/game/engine";

export interface SavedSession {
  game: GameState;
  position: string;
  branch: boolean;
  remaining: number;
  die: number;
  rolled: boolean;
}
declare global {
  interface Window {
    __pandaOriginalRandom: () => number;
  }
}
export const key = "panda-town.current.v1";
export async function saved(page: Page): Promise<SavedSession | null> {
  return page.evaluate((storageKey) => {
    const value = sessionStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as SavedSession) : null;
  }, key);
}
export async function begin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /出发去小镇/ }).click();
  await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
}
export async function arrive(page: Page, die: number, branch = 0) {
  await page.evaluate((value) => {
    window.__pandaOriginalRandom = Math.random;
    Math.random = () => (value - 0.5) / 6;
  }, die);
  await page.getByRole("button", { name: /掷骰出发/ }).click();
  await page.evaluate(() => {
    Math.random = window.__pandaOriginalRandom;
  });
  for (let step = 0; step < 8; step++) {
    await page.waitForFunction((storageKey) => {
      const raw = sessionStorage.getItem(storageKey);
      const value = raw ? (JSON.parse(raw) as SavedSession) : null;
      return value?.branch || value?.game.phase === "decision";
    }, key);
    const state = await saved(page);
    if (state?.game.phase === "decision") {
      await expect(
        page.getByRole("button", {
          name: "做一份临时工作，收入 250",
          exact: true,
        }),
      ).toBeVisible();
      if (state.game.day === 1 && (page.viewportSize()?.width ?? 0) > 1000) {
        await page.screenshot({ path: "logs/validation-desktop-decision.png" });
      }
      return state;
    }
    await page
      .getByRole("region", { name: "选择岔路" })
      .getByRole("button")
      .nth(branch)
      .click();
  }
  throw new Error("合法六面骰移动未能在有限分支后到达事件");
}
export async function choose(page: Page, optionId: string) {
  const state = await saved(page);
  const option = state?.game.event?.options.find(
    (entry) => entry.id === optionId,
  );
  if (!option) throw new Error(`当前事件没有选项 ${optionId}`);
  await page.getByRole("button", { name: option.label, exact: true }).click();
  await expect
    .poll(async () => (await saved(page))?.game.phase)
    .toBe("feedback");
}
export async function advance(page: Page) {
  await page.getByRole("button", { name: /收好(?:今天|第八天)的收入/ }).click();
  await expect
    .poll(async () => (await saved(page))?.game.phase)
    .toMatch(/travel|settlement/);
}
export async function finish(page: Page, sell = false) {
  if (sell) await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /确认结算/ }).click();
  await expect(page.getByRole("region", { name: "咖啡馆结局" })).toBeVisible();
  await page.getByRole("button", { name: /看看本局的选择与画像/ }).click();
  await expect(
    page.getByRole("button", { name: "清除记录", exact: true }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 1000) {
    await page.screenshot({
      path: "logs/validation-desktop-report.png",
      fullPage: true,
    });
  }
}

export async function resetSession(page: Page, action: "restart" | "clear") {
  await page
    .getByRole("button", {
      name: action === "restart" ? /重开一局/ : "清除记录",
      exact: action === "clear",
    })
    .click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", {
      name: action === "restart" ? "确认重开" : "确认清除",
      exact: true,
    })
    .click();
}

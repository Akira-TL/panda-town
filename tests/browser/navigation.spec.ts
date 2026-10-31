import { expect, test, type Page } from "@playwright/test";
import { begin, arrive, choose, advance, saved } from "./helpers";

async function roll(page: Page, die: number) {
  await page.evaluate((value) => {
    window.__pandaOriginalRandom = Math.random;
    Math.random = () => (value - 0.5) / 6;
  }, die);
  await page.getByRole("button", { name: /掷骰出发/ }).click();
  await page.evaluate(() => {
    Math.random = window.__pandaOriginalRandom;
  });
}

async function unchangedAtFork(page: Page, remaining: number) {
  const fork = page.getByRole("region", { name: "选择岔路" });
  await expect(fork).toContainText(`还剩 ${remaining} 步`);
  const before = (await saved(page))!;
  expect(before.remaining).toBe(remaining);
  expect(before.game.event).toBeNull();
  expect(
    before.game.evidence.filter((entry) => entry.action === "choose"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "全局", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "跟随", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  return fork;
}

for (const path of [
  { branch: 0, destination: "gifts" },
  { branch: 1, destination: "dock" },
] as const) {
  test(`恰停岔路后骰6连续过两岔路：选择${path.branch}到${path.destination}`, async ({
    page,
  }) => {
    await begin(page);
    const grocery = await arrive(page, 2);
    expect(grocery.position).toBe("grocery");
    expect(grocery.remaining).toBe(0);
    await expect(page.getByRole("region", { name: "选择岔路" })).toHaveCount(0);
    await choose(page, "work");
    await advance(page);
    await page.getByRole("button", { name: "简化动画 ✓", exact: true }).click();
    await roll(page, 6);
    const first = await unchangedAtFork(page, 6);
    expect((await saved(page))!.position).toBe("grocery");
    await first.getByRole("button").first().click();
    const moving = (await saved(page))!;
    expect(moving.branch).toBe(false);
    expect(moving.game.phase).toBe("travel");
    expect(moving.game.event).toBeNull();
    await page.getByRole("button", { name: "全局", exact: true }).click();
    const switched = (await saved(page))!;
    expect(switched.die).toBe(moving.die);
    expect(switched.game.day).toBe(moving.game.day);
    expect(switched.game.cash).toBe(moving.game.cash);
    expect(switched.game.evidence).toEqual(moving.game.evidence);
    await page.getByRole("button", { name: "跟随", exact: true }).click();
    await expect.poll(async () => (await saved(page))!.position).toBe("bridge");
    const second = await unchangedAtFork(page, 2);
    await page.screenshot({
      path: `logs/validation-navigation-${path.destination}-fork.png`,
    });
    await second.getByRole("button").nth(path.branch).click();
    await expect
      .poll(async () => (await saved(page))!.game.phase)
      .toBe("decision");
    const landed = (await saved(page))!;
    expect(landed.position).toBe(path.destination);
    expect(landed.die).toBe(6);
    expect(landed.remaining).toBe(0);
    expect(landed.game.day).toBe(2);
    expect(landed.game.cash).toBe(1400);
    expect(landed.game.event?.locationId).toBe(path.destination);
    expect(
      landed.game.evidence.filter((entry) => entry.action === "choose"),
    ).toHaveLength(1);
    await choose(page, "work");
    expect(
      (await saved(page))!.game.evidence.filter(
        (entry) => entry.action === "choose",
      ),
    ).toHaveLength(2);
    await advance(page);
    expect((await saved(page))!.game.cash).toBe(1800);
  });
}

test("骰6恰停小桥、骰5至咖啡馆、骰1跨循环起点不提前弹事件", async ({
  page,
}) => {
  await begin(page);
  const bridge = await arrive(page, 6, 0);
  expect(bridge.position).toBe("bridge");
  expect(bridge.remaining).toBe(0);
  await expect(page.getByRole("region", { name: "选择岔路" })).toHaveCount(0);
  await choose(page, "work");
  await advance(page);
  const cafe = await arrive(page, 5, 0);
  expect(cafe.position).toBe("cafe");
  expect(cafe.remaining).toBe(0);
  await choose(page, "work");
  await advance(page);
  const square = await arrive(page, 1);
  expect(square.position).toBe("square");
  expect(square.die).toBe(1);
  expect(square.remaining).toBe(0);
  expect(square.game.event?.locationId).toBe("square");
  expect(square.game.day).toBe(3);
  expect(square.game.cash).toBe(1800);
  await page.screenshot({ path: "logs/validation-navigation-loop.png" });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ResearchSession } from "../../src/research/model";

async function session(page: Page): Promise<ResearchSession | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("panda-town.research.v3");
    return raw ? (JSON.parse(raw) as ResearchSession) : null;
  });
}

/** 只读焦点；实际定位与激活始终通过物理键盘输入，不调用 focus/click。 */
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  const active = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim().slice(0, 100),
  }));
  throw new Error(`120次Tab仍未到达目标，当前焦点：${JSON.stringify(active)}`);
}

async function enter(page: Page, target: Locator) {
  await tabTo(page, target);
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
}

async function keyboardArrive(page: Page, day: number): Promise<string[]> {
  await enter(
    page,
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  );
  const forks: string[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    await expect
      .poll(async () => {
        const current = await session(page);
        return Boolean(
          current?.branch || current?.research.phase === "decision",
        );
      })
      .toBe(true);
    const current = await session(page);
    if (current?.research.phase === "decision") break;
    expect(current?.branch).toBe(true);
    expect(["grocery", "bridge"]).toContain(current?.position);
    forks.push(current!.position);
    const branch = page.getByRole("region", { name: "选择岔路", exact: true });
    const buttons = branch.getByRole("button");
    await expect(buttons).toHaveCount(2);
    await enter(page, buttons.nth(day % 2));
  }
  await expect(page.locator(`[data-research-day="${day}"]`)).toHaveAttribute(
    "data-research-phase",
    "decision",
  );
  return forks;
}

async function keyboardDossier(page: Page, expandQuality: boolean) {
  const trigger = page.getByRole("button", { name: "资料", exact: true });
  const before = await session(page);
  await enter(page, trigger);
  const dialog = page.getByRole("dialog", { name: "资料", exact: true });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) =>
        element instanceof HTMLDialogElement &&
        element.open &&
        element.matches(":modal"),
    ),
  ).toBe(true);
  // 原生模态必须使键盘焦点保持在自己的活动区域内。
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  if (expandQuality) {
    const summary = dialog
      .locator("summary")
      .filter({ hasText: "缺失与异常记录" });
    await enter(page, summary);
    await expect(summary.locator("..")).toHaveAttribute("open", "");
    await expect(dialog.getByText("收到：", { exact: false })).toHaveCount(4);
    await expect
      .poll(
        async () =>
          (await session(page))?.research.evidence.filter(
            (record) =>
              record.day === 2 &&
              record.action === "inspect" &&
              record.choice === "quality",
          ).length,
      )
      .toBe(1);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const after = await session(page);
  expect(after?.research.day).toBe(before?.research.day);
  expect(after?.research.phase).toBe("decision");
  expect(after?.research.answers).toHaveLength(0);
}

test("仅键盘完成八天、资料与证据模态、减少动画和清除确认", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.86;
  });
  await page.goto("/");
  await enter(
    page,
    page.getByRole("button", { name: "开始小镇量化之旅", exact: true }),
  );
  await enter(page, page.getByRole("button", { name: "记录", exact: true }));
  const record = page.getByRole("dialog", { name: "本局记录", exact: true });
  await expect(
    record.getByRole("button", { name: "减少动画 ✓", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "记录", exact: true }),
  ).toBeFocused();
  const forks: string[] = [];
  for (let day = 1; day <= 8; day++) {
    forks.push(...(await keyboardArrive(page, day)));
    if (day === 2 || day === 4) await keyboardDossier(page, day === 2);
    const choices = page.locator(".research-play-actions button");
    await expect(choices).toHaveCount(3);
    await enter(page, choices.first());
    await expect(page.locator(".research-panel")).toHaveAttribute(
      "data-research-phase",
      "feedback",
    );
    if (day === 3) {
      const chart = page.locator(".research-play .research-price-chart");
      await expect(chart).toHaveAttribute("data-price-playing", "false");
      await expect(chart).toHaveAttribute("data-visible-price-count", "120");
    }
    await enter(
      page,
      page.getByRole("button", { name: "记下结果，进入下一天", exact: true }),
    );
  }
  expect(forks).toContain("grocery");
  expect(forks).toContain("bridge");
  await expect(page.locator(".research-panel")).toHaveAttribute(
    "data-research-phase",
    "exhibit",
  );
  await enter(
    page,
    page.getByRole("button", { name: "查看我的量化研究画像", exact: true }),
  );
  const report = page.locator("[data-research-report]");
  await expect(report).toHaveAttribute("data-reduced-motion", "true");
  await expect(
    page.getByRole("heading", { name: "你的量化研究画像", exact: true }),
  ).toBeFocused();
  expect(
    ((await report.innerText()).match(/[\u3400-\u9fff]/g) ?? []).length,
  ).toBeLessThanOrEqual(220);
  const external = page.getByRole("link", { name: /打开 PandaAI/ });
  await expect(external).toHaveAttribute(
    "href",
    "https://www.pandaaiquant.com/",
  );
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", /noopener/);
  await expect(external).toHaveAttribute("rel", /noreferrer/);
  // 只核对链接属性，不激活外站。
  const evidence = page.getByRole("button", { name: "查看依据", exact: true });
  await enter(page, evidence);
  const details = page.getByRole("dialog", {
    name: "本局完整依据",
    exact: true,
  });
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(evidence).toBeFocused();
  await enter(page, evidence);
  await enter(
    page,
    details.getByRole("button", { name: /查看本局全部原始记录/ }),
  );
  const raw = page.getByRole("dialog", {
    name: "本局全部行为记录",
    exact: true,
  });
  await expect(raw).toBeVisible();
  await expect(
    raw
      .getByRole("heading", { name: "当时可见的主要选项", exact: true })
      .first(),
  ).toBeVisible();
  const completed = await session(page);
  expect(
    completed?.research.evidence.filter((item) => item.action === "choose"),
  ).toHaveLength(8);
  expect(completed?.research.answers).toHaveLength(0);
  await page.screenshot({ path: "logs/research-keyboard-evidence.png" });
  await page.keyboard.press("Escape");
  await expect(raw).toHaveCount(0);
  await expect(details).toBeVisible();
  await expect(
    details.getByRole("button", { name: /查看本局全部原始记录/ }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(evidence).toBeFocused();
  const clear = page.getByRole("button", { name: "清除记录", exact: true });
  await enter(page, clear);
  const confirmation = page.getByRole("alertdialog", {
    name: "清除这一局的记录？",
    exact: true,
  });
  const cancel = confirmation.getByRole("button", {
    name: "取消，保留本局",
    exact: true,
  });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    confirmation.getByRole("button", { name: "确认清除", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(clear).toBeFocused();
  expect(await session(page)).toEqual(completed);
  await enter(page, clear);
  await enter(
    page,
    confirmation.getByRole("button", { name: "确认清除", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "开始小镇量化之旅", exact: true }),
  ).toBeVisible();
  expect(await session(page)).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始小镇量化之旅", exact: true }),
  ).toBeVisible();
  expect(await session(page)).toBeNull();
  await info.attach("keyboard-path", {
    body: JSON.stringify(
      { forks, days: 8, input: "Tab/Shift+Tab/Enter/Escape", errors },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

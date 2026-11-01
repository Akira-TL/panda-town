import { expect, test, type Page } from "@playwright/test";
import type { ResearchSession } from "../../src/research/model";

async function readSession(page: Page): Promise<ResearchSession | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("panda-town.research.v3");
    return raw ? (JSON.parse(raw) as ResearchSession) : null;
  });
}

async function arrive(page: Page, day: number, branch: number) {
  await page.getByRole("button", { name: "掷骰出发", exact: true }).click();
  for (let attempt = 0; attempt < 12; attempt++) {
    const session = await readSession(page);
    if (session?.research.phase === "decision") break;
    if (session?.branch) {
      await page
        .getByRole("region", { name: "选择岔路" })
        .locator("button")
        .nth(branch)
        .click();
    }
    await expect
      .poll(
        async () => {
          const next = await readSession(page);
          return next?.branch || next?.research.phase === "decision";
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  }
  await expect(page.locator(`[data-research-day="${day}"]`)).toHaveAttribute(
    "data-research-phase",
    "decision",
  );
}

async function assertCompactChoiceScreen(page: Page) {
  const panel = page.locator(".research-panel");
  const chineseCharacters = (
    (await panel.innerText()).match(/[\u3400-\u9fff]/g) ?? []
  ).length;
  expect(chineseCharacters, "主决策区不应退回长篇阅读").toBeLessThanOrEqual(
    140,
  );
  const visible = await panel
    .locator(".research-play-actions button")
    .evaluateAll(
      (buttons) =>
        buttons.length === 3 &&
        buttons.every((button) => {
          const box = button.getBoundingClientRect();
          const panelBox = button
            .closest(".research-panel")!
            .getBoundingClientRect();
          return (
            box.width >= 44 &&
            box.height >= 44 &&
            box.top >= Math.max(0, panelBox.top) &&
            box.bottom <= Math.min(innerHeight, panelBox.bottom) &&
            box.left >= 0 &&
            box.right <= innerWidth
          );
        }),
    );
  expect(visible, "三项主要行动应无需滚动同时可见").toBe(true);
  const ratio = await panel.evaluate(
    (element) => element.getBoundingClientRect().height / innerHeight,
  );
  expect(ratio, "决策面板应给场景保留至少半屏").toBeLessThanOrEqual(0.5);
}

async function inspectOptionalMaterials(page: Page, day: number) {
  const information = page.getByRole("button", { name: "资料", exact: true });
  await information.click();
  const dossier = page.getByRole("dialog", { name: "资料", exact: true });
  await expect(dossier).toBeVisible();
  await expect(dossier.locator("details[open]")).toHaveCount(0);
  if (day === 2) {
    await dossier
      .locator("summary")
      .filter({ hasText: "缺失与异常记录" })
      .click();
    await expect(dossier.getByText("收到：", { exact: false })).toHaveCount(4);
    await expect
      .poll(
        async () =>
          (await readSession(page))?.research.evidence.filter(
            (item) =>
              item.day === 2 &&
              item.action === "inspect" &&
              item.choice === "quality",
          ).length,
      )
      .toBe(1);
  } else {
    await dossier
      .locator("summary")
      .filter({ hasText: "说明与可跳过理解题" })
      .click();
    await dossier
      .getByRole("button", { name: "不保证，还需要进一步检验", exact: true })
      .click();
    await expect
      .poll(async () => (await readSession(page))?.research.answers.length)
      .toBe(1);
    expect((await readSession(page))?.research.answers[0]?.correct).toBe(true);
  }
  await dossier
    .getByRole("button", { name: "关闭，返回原处", exact: true })
    .click();
  await expect(information).toBeFocused();
  expect((await readSession(page))?.research.phase).toBe("decision");
}

for (const branch of [0, 1]) {
  test(`真实八天量化路线${branch + 1}：规则、运行、恢复与画像证据`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (branch === 0)
      await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Math.random = () => 0.86;
    });
    await page.goto("/");
    await page.getByRole("button", { name: "开始小镇量化之旅" }).click();
    await expect(
      page.getByRole("button", { name: "掷骰出发", exact: true }),
    ).toBeVisible();
    if (branch === 1) {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    for (let day = 1; day <= 8; day++) {
      await arrive(page, day, branch);
      const choices = page.locator(".research-play-actions button");
      await expect(choices).toHaveCount(3);
      await assertCompactChoiceScreen(page);
      if (branch === 0 && (day === 2 || day === 4))
        await inspectOptionalMaterials(page, day);
      if (day === 3)
        await page.screenshot({
          path: `logs/compact-play-route${branch + 1}.png`,
        });
      await choices.nth(branch).click();
      await expect(page.locator(".research-panel")).toHaveAttribute(
        "data-research-phase",
        "feedback",
      );
      if (day === 3) {
        const current = await readSession(page);
        expect(current?.research.runs).toHaveLength(1);
        expect(current?.research.runs[0]?.config.segment).toBe("research");
        expect(current?.research.runs[0]?.datasetVersion).toBe(
          "panda-binance-spot-1d-20250101-20250719-v1",
        );
        expect(current?.research.runs[0]?.points).toHaveLength(121);
        const price = page.locator(".research-price-chart");
        await expect(price).toHaveAttribute("data-price-segment", "research");
        if (branch === 0) {
          await expect(price).toHaveAttribute("data-price-playing", "true");
          const shown = Number(
            await price.getAttribute("data-visible-price-count"),
          );
          expect(shown).toBeGreaterThan(0);
          expect(shown).toBeLessThan(120);
          await page
            .getByRole("button", { name: "暂停价格回放", exact: true })
            .click();
          await expect(price).toHaveAttribute("data-price-playing", "false");
        } else {
          await expect(price).toHaveAttribute(
            "data-visible-price-count",
            "120",
          );
        }
        await page.screenshot({
          path: `logs/research-day3-route${branch + 1}.png`,
        });
        await page.reload();
        await expect(page.locator(".research-panel")).toHaveAttribute(
          "data-research-phase",
          "feedback",
        );
        expect((await readSession(page))?.research.runs).toHaveLength(1);
      }
      if (day === 5) {
        const current = await readSession(page);
        expect(current?.research.allocation).toBe(branch ? 0.6 : 0.3);
        expect(
          current?.research.runs.some(
            (run) => run.config.segment === "validation",
          ),
        ).toBe(false);
      }
      await page.locator(".research-play-next").click();
    }
    await expect(page.locator(".research-panel")).toHaveAttribute(
      "data-research-phase",
      "exhibit",
    );
    const finish = page.locator(".research-play-next");
    await finish.click();
    await expect(
      page.getByRole("heading", { name: "你的量化研究画像", exact: true }),
    ).toBeVisible();
    const panda = page.getByRole("link", { name: /打开 PandaAI/ });
    await expect(panda).toHaveAttribute(
      "href",
      "https://www.pandaaiquant.com/",
    );
    await expect(panda).toHaveAttribute("target", "_blank");
    await expect(panda).toHaveAttribute("rel", /noopener/);
    const reportCharacters = (
      (await page.locator("[data-research-report]").innerText()).match(
        /[\u3400-\u9fff]/g,
      ) ?? []
    ).length;
    expect(
      reportCharacters,
      "结果首屏应简洁，依据按需查看",
    ).toBeLessThanOrEqual(220);
    await expect
      .poll(async () =>
        page
          .locator("[data-research-report] img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const completed = await readSession(page);
    expect(completed?.research.phase).toBe("report");
    expect(
      completed?.research.evidence.filter((item) => item.action === "choose"),
    ).toHaveLength(8);
    expect(completed?.research.runs.length).toBeGreaterThanOrEqual(3);
    await page.screenshot({
      path: `logs/research-report-route${branch + 1}.png`,
    });
    expect(errors).toEqual([]);
    await page.getByRole("button", { name: "清除记录", exact: true }).click();
    await page.getByRole("button", { name: "确认清除", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "开始小镇量化之旅" }),
    ).toBeVisible();
    expect(await readSession(page)).toBeNull();
  });
}

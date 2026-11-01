import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { arrive, choose, advance } from "./helpers";
import { readyVisualScene } from "./scene-ready";

interface ResponseRecord {
  requestId: string;
  response: { url: string; status: number };
}
interface FinishedRecord {
  requestId: string;
  encodedDataLength: number;
}
interface Resource {
  path: string;
  status: number;
  bytes: number;
}

for (const viewport of [
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile-viewport", width: 390, height: 844 },
] as const) {
  test(`禁用缓存的开场及全部场景资源传输预算：${viewport.id}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    const resources = new Map<string, Resource>();
    client.on("Network.responseReceived", (record: ResponseRecord) => {
      if (!/^https?:/.test(record.response.url)) return;
      resources.set(record.requestId, {
        path: new URL(record.response.url).pathname,
        status: record.response.status,
        bytes: 0,
      });
    });
    client.on("Network.loadingFinished", (record: FinishedRecord) => {
      const resource = resources.get(record.requestId);
      if (resource) resource.bytes = record.encodedDataLength;
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /出发去小镇/ }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    const welcomeBytes = [...resources.values()].reduce(
      (sum, resource) => sum + resource.bytes,
      0,
    );
    await page.getByRole("button", { name: /出发去小镇/ }).click();
    await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
    const scene = await readyVisualScene(page);
    await expect(scene).toHaveAttribute("data-cafe-welcome", "false");
    expect(Number(await scene.getAttribute("data-cafe-opening"))).toBe(0);
    await page.waitForLoadState("networkidle");
    const loadedSceneBytes = [...resources.values()].reduce(
      (sum, resource) => sum + resource.bytes,
      0,
    );
    for (let day = 1; day <= 8; day++) {
      await arrive(page, day === 8 ? 4 : 1);
      await choose(page, "work");
      await advance(page);
    }
    await page.screenshot({
      path: `logs/validation-cafe-closed-${viewport.id}.png`,
    });
    await page.getByRole("button", { name: /确认结算/ }).click();
    await expect(
      page.getByRole("region", { name: "咖啡馆结局" }),
    ).toBeVisible();
    await expect
      .poll(async () => Number(await scene.getAttribute("data-cafe-opening")))
      .toBeCloseTo(1, 3);
    await expect(scene).toHaveAttribute("data-cafe-welcome", "true");
    await page.screenshot({
      path: `logs/validation-cafe-open-${viewport.id}.png`,
    });
    await page.getByRole("button", { name: /看看本局的选择与画像/ }).click();
    await expect(
      page.getByRole("button", { name: "清除记录", exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    const items = [...resources.values()];
    const totalBytes = items.reduce((sum, resource) => sum + resource.bytes, 0);
    const report = {
      viewport,
      browser: page.context().browser()?.version(),
      welcomeBytes,
      loadedSceneBytes,
      firstSessionBytes: totalBytes,
      welcomeBudgetBytes: 15_000_000,
      firstSessionBudgetBytes: 40_000_000,
      resources: items,
      caveat:
        "CDP禁用HTTP缓存的实际编码传输量，含欢迎页、十模型/店内七居民/户外七居民与三地表材质，八天工作在咖啡馆结算并展示开门迎宾后进入报告。未枚举所有事件的延迟资源；390像素为同一电脑，并非实体手机网络。",
    };
    await writeFile(
      `logs/cold-load-${viewport.id}.json`,
      JSON.stringify(report, null, 2),
    );
    expect(items.filter((item) => item.status >= 400)).toEqual([]);
    expect(welcomeBytes).toBeGreaterThan(0);
    expect(welcomeBytes).toBeLessThanOrEqual(15_000_000);
    expect(totalBytes).toBeLessThanOrEqual(40_000_000);
  });
}

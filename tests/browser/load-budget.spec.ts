import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { arrive, choose, advance, finish } from "./helpers";

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
    const selector = [
      "panda",
      "tree",
      "bakery",
      "grocery",
      "market",
      "research",
      "bank",
      "gifts",
      "rival",
      "cafe",
    ]
      .map((id) => `[data-loaded-models~="${id}"]`)
      .join("");
    await expect(
      page.locator(`${selector}[data-resident-count="7"]`),
    ).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    const loadedSceneBytes = [...resources.values()].reduce(
      (sum, resource) => sum + resource.bytes,
      0,
    );
    for (let day = 1; day <= 8; day++) {
      await arrive(page, 1);
      await choose(page, "work");
      await advance(page);
    }
    await finish(page);
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
        "CDP禁用HTTP缓存的实际编码传输量，含欢迎页、十模型/七居民及八天工作到报告路径。未枚举所有不同事件的延迟资源；390像素使用同一电脑，并非实体手机网络。",
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

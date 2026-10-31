import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { cpus, platform, totalmem } from "node:os";
import { begin, arrive, choose, advance, resetSession, saved } from "./helpers";

const requiredModels = [
  "panda",
  "bakery",
  "grocery",
  "market",
  "research",
  "bank",
  "gifts",
  "rival",
  "cafe",
  "tree",
] as const;

async function waitForFullScene(page: Page) {
  const scene = page.locator('[data-loaded-models~="panda"]');
  await expect(scene).toBeVisible({ timeout: 60_000 });
  for (const model of requiredModels)
    await expect(scene).toHaveAttribute(
      "data-loaded-models",
      new RegExp(`(?:^| )${model}(?: |$)`),
      { timeout: 60_000 },
    );
  return scene;
}

for (const device of [
  { id: "desktop", width: 1440, height: 900, targetFps: 60 },
  { id: "mobile-viewport", width: 390, height: 844, targetFps: 30 },
] as const) {
  test(`全部正式模型后的60秒帧耗时与加载体积：${device.id}`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: device.width, height: device.height });
    await begin(page);
    const scene = await waitForFullScene(page);
    await page.getByRole("button", { name: "简化动画 ✓", exact: true }).click();
    const recording = page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const deltas: number[] = [];
          let start = 0,
            previous = 0;
          function tick(now: number) {
            if (!start) start = previous = now;
            else {
              deltas.push(now - previous);
              previous = now;
            }
            if (now - start >= 60_000) resolve(deltas);
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }),
    );
    // 采样包含真实移动、选择及两种镜头，不只测静止开场。
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
    await page.getByRole("button", { name: "全局", exact: true }).click();
    await arrive(page, 1);
    await choose(page, "work");
    await advance(page);
    await page.getByRole("button", { name: "跟随", exact: true }).click();
    const frames = await recording;
    const resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          path: new URL(resource.name).pathname,
          encodedBytes: resource.encodedBodySize,
          decodedBytes: resource.decodedBodySize,
          transferBytes: resource.transferSize,
          durationMs: resource.duration,
        };
      }),
    );
    const sorted = [...frames].sort((a, b) => a - b);
    const bytes = resources.reduce((sum, item) => sum + item.encodedBytes, 0);
    const graphics = await page.locator("canvas").evaluate((canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
      if (!gl) return null;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: String(
          gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        ),
        vendor: String(
          gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
        ),
      };
    });
    const metrics = {
      durationMs: frames.reduce((sum, value) => sum + value, 0),
      frames: frames.length,
      medianMs: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      budgetFrameMs: 1000 / device.targetFps,
      totalEncodedBytes: bytes,
      firstSessionBudgetBytes: 40_000_000,
      withinFirstSessionBudget: bytes <= 40_000_000,
      viewport: page.viewportSize(),
      browser: page.context().browser()?.version(),
      host: {
        platform: platform(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        totalMemoryBytes: totalmem(),
      },
      graphics,
      loadedModels: await scene.getAttribute("data-loaded-models"),
      resources,
      errors,
      caveat:
        "本机隔离的headless Edge；390像素仅模拟视口，并非实体手机。资源体积为本页资源计时所见的编码响应正文之和，不等同冷缓存首屏压缩传输或整局所有延迟资源。",
    };
    const body = JSON.stringify(metrics, null, 2);
    await writeFile(`logs/frame-metrics-${device.id}.json`, body);
    await info.attach(`frame-metrics-${device.id}`, {
      body,
      contentType: "application/json",
    });
    expect(metrics.durationMs).toBeGreaterThanOrEqual(60_000);
    expect(errors).toEqual([]);
  });
}

test("全部正式模型后连续确认重开五次的角色与浏览器资源观测", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page);
  await waitForFullScene(page);
  const client = await page.context().newCDPSession(page);
  const observations: Array<{
    cycle: number;
    nodes: number;
    listeners: number;
    heapBytes: number;
  }> = [];
  const sessionIds = new Set<string>();
  for (let cycle = 0; cycle <= 5; cycle++) {
    await expect(page.locator("canvas")).toHaveCount(1);
    const current = (await saved(page))!.game;
    expect(current.cash).toBe(1000);
    expect(current.evidence).toHaveLength(0);
    expect(sessionIds.has(current.sessionId)).toBe(false);
    sessionIds.add(current.sessionId);
    await client.send("HeapProfiler.collectGarbage");
    const dom = await client.send("Memory.getDOMCounters");
    const heap = await client.send("Runtime.getHeapUsage");
    observations.push({
      cycle,
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      heapBytes: heap.usedSize,
    });
    if (cycle === 5) break;
    await page
      .getByRole("button", { name: "资产与旅程手记", exact: true })
      .click();
    await resetSession(page, "restart");
    await page.getByRole("button", { name: /明白了，开始第一天/ }).click();
    await waitForFullScene(page);
  }
  const first = observations[0]!,
    last = observations.at(-1)!;
  const result = {
    observations,
    errors,
    growth: {
      nodes: last.nodes - first.nodes,
      listeners: last.listeners - first.listeners,
      heapBytes: last.heapBytes - first.heapBytes,
    },
    caveat:
      "CDP在每次垃圾回收后记录DOM/监听和JavaScript堆；它不直接证明GPU资源已释放。五次重开均真实确认，并核对一个canvas、新局标识和空证据。",
  };
  const body = JSON.stringify(result, null, 2);
  await writeFile("logs/restart-resource-metrics.json", body);
  await info.attach("restart-resource-metrics", {
    body,
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  // 相同初始界面不应随着重开不断增加节点和监听。
  expect(result.growth.listeners).toBeLessThanOrEqual(10);
  expect(result.growth.nodes).toBeLessThanOrEqual(30);
});

import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { cpus, platform, totalmem } from "node:os";
import type { ResearchSession } from "../../src/research/model";
import { readyVisualScene } from "./scene-ready";

interface ResponseRecord {
  requestId: string;
  response: {
    url: string;
    status: number;
    fromDiskCache?: boolean;
    fromServiceWorker?: boolean;
  };
}
interface FinishedRecord {
  requestId: string;
  encodedDataLength: number;
}
interface FailedRecord {
  requestId: string;
  errorText: string;
  canceled?: boolean;
}
interface Resource {
  url: string;
  path: string;
  status: number;
  bytes: number;
  finished: boolean;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
}
interface FrameSample {
  elapsedMs: number;
  visibleElapsedMs: number;
  hiddenElapsedMs: number;
  callbackCount: number;
  visibleDeltasMs: number[];
  visibility: Array<{ atMs: number; state: string }>;
}

async function saved(page: Page): Promise<ResearchSession | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("panda-town.research.v3");
    return raw ? (JSON.parse(raw) as ResearchSession) : null;
  });
}

async function begin(page: Page) {
  await page
    .getByRole("button", { name: "开始小镇量化之旅", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "掷骰出发", exact: true }),
  ).toBeVisible();
}

async function arrive(page: Page, day: number) {
  await page.getByRole("button", { name: "掷骰出发", exact: true }).click();
  for (let attempt = 0; attempt < 12; attempt++) {
    await expect
      .poll(async () => {
        const current = await saved(page);
        return Boolean(
          current?.branch || current?.research.phase === "decision",
        );
      })
      .toBe(true);
    const current = await saved(page);
    if (current?.research.phase === "decision") break;
    await page
      .getByRole("region", { name: "选择岔路", exact: true })
      .getByRole("button")
      .nth(day % 2)
      .click();
  }
  await expect(page.locator(`[data-research-day="${day}"]`)).toHaveAttribute(
    "data-research-phase",
    "decision",
  );
}

/** 60秒墙钟采样；隐藏区间及跨可见性边界的间隔不混入可见回调分布。 */
function sampleFrames(page: Page): Promise<FrameSample> {
  return page.evaluate(
    () =>
      new Promise<FrameSample>((resolve) => {
        const start = performance.now();
        let previous: number | null = null;
        let previousVisible = document.visibilityState === "visible";
        let boundary = start;
        let visibleMs = 0;
        let hiddenMs = 0;
        let callbackCount = 0;
        const deltas: number[] = [];
        const visibility = [
          { atMs: 0, state: document.visibilityState as string },
        ];
        function accumulate(now: number) {
          if (previousVisible) visibleMs += now - boundary;
          else hiddenMs += now - boundary;
          boundary = now;
        }
        function changed() {
          const now = performance.now();
          accumulate(now);
          previousVisible = document.visibilityState === "visible";
          previous = null;
          visibility.push({
            atMs: now - start,
            state: document.visibilityState,
          });
        }
        document.addEventListener("visibilitychange", changed);
        let raf = 0;
        let finished = false;
        function tick(now: number) {
          if (finished) return;
          callbackCount++;
          if (previousVisible && previous !== null) deltas.push(now - previous);
          previous = now;
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        setTimeout(() => {
          finished = true;
          const end = performance.now();
          accumulate(end);
          cancelAnimationFrame(raf);
          document.removeEventListener("visibilitychange", changed);
          resolve({
            elapsedMs: end - start,
            visibleElapsedMs: visibleMs,
            hiddenElapsedMs: hiddenMs,
            callbackCount,
            visibleDeltasMs: deltas,
            visibility,
          });
        }, 60_000);
      }),
  );
}

function frameSummary(sample: FrameSample, targetFps: number) {
  const sorted = [...sample.visibleDeltasMs].sort(
    (left, right) => left - right,
  );
  const percentile = (fraction: number) =>
    sorted.length
      ? sorted[
          Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
        ]!
      : null;
  const budgetMs = 1000 / targetFps;
  const measuredMs = sample.visibleDeltasMs.reduce(
    (sum, delta) => sum + delta,
    0,
  );
  return {
    ...sample,
    medianCallbackIntervalMs: percentile(0.5),
    p95CallbackIntervalMs: percentile(0.95),
    visibleCallbackRateHz:
      measuredMs > 0
        ? (sample.visibleDeltasMs.length * 1000) / measuredMs
        : null,
    targetCallbackRateHz: targetFps,
    budgetCallbackIntervalMs: budgetMs,
    aboveBudgetIntervals: sample.visibleDeltasMs.filter(
      (delta) => delta > budgetMs,
    ).length,
    p95WithinTarget:
      percentile(0.95) === null ? null : percentile(0.95)! <= budgetMs,
  };
}

async function graphics(page: Page) {
  return page.locator("canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("webgl2");
    if (!context) return null;
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: String(
        context.getParameter(
          extension ? extension.UNMASKED_RENDERER_WEBGL : context.RENDERER,
        ),
      ),
      vendor: String(
        context.getParameter(
          extension ? extension.UNMASKED_VENDOR_WEBGL : context.VENDOR,
        ),
      ),
    };
  });
}

for (const device of [
  { id: "desktop", width: 1440, height: 900, targetFps: 60 },
  { id: "mobile-viewport", width: 390, height: 844, targetFps: 30 },
] as const) {
  test(`新量化首局禁缓存传输与60秒可见回调采样：${device.id}`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    const failed: FailedRecord[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Math.random = () => 0.86;
    });
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await client.send("Network.setBypassServiceWorker", { bypass: true });
    const resources = new Map<string, Resource>();
    client.on("Network.responseReceived", (record: ResponseRecord) => {
      if (!/^https?:/.test(record.response.url)) return;
      resources.set(record.requestId, {
        url: record.response.url,
        path: new URL(record.response.url).pathname,
        status: record.response.status,
        bytes: 0,
        finished: false,
        fromDiskCache: record.response.fromDiskCache ?? false,
        fromServiceWorker: record.response.fromServiceWorker ?? false,
      });
    });
    client.on("Network.loadingFinished", (record: FinishedRecord) => {
      const resource = resources.get(record.requestId);
      if (resource) {
        resource.bytes = record.encodedDataLength;
        resource.finished = true;
      }
    });
    client.on("Network.loadingFailed", (record: FailedRecord) =>
      failed.push(record),
    );
    const totalBytes = () =>
      [...resources.values()].reduce((sum, item) => sum + item.bytes, 0);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "开始小镇量化之旅", exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    const welcomeBytes = totalBytes();
    await begin(page);
    const scene = await readyVisualScene(page);
    const renderer = await graphics(page);
    await page.waitForLoadState("networkidle");
    const readySceneBytes = totalBytes();
    const loadedModels = await scene.getAttribute("data-loaded-models");
    const recording = sampleFrames(page);
    // 同一60秒窗口内做移动、两种镜头、运行与资料展开，停在仍有三维场景的第3天反馈。
    // 报告会卸载场景，因此完整首局在采样后继续到画像，避免把空报告页冒充三维帧表现。
    await arrive(page, 1);
    await page.locator(".research-play-actions button").first().click();
    await page
      .getByRole("button", { name: "记下结果，进入下一天", exact: true })
      .click();
    await page.getByRole("button", { name: "全局", exact: true }).click();
    await arrive(page, 2);
    await page.locator(".research-play-actions button").first().click();
    await page
      .getByRole("button", { name: "记下结果，进入下一天", exact: true })
      .click();
    await page.getByRole("button", { name: "跟随", exact: true }).click();
    await arrive(page, 3);
    await page.locator(".research-play-actions button").first().click();
    await page.getByRole("button", { name: "资料", exact: true }).click();
    const dossier = page.getByRole("dialog", { name: "资料", exact: true });
    await dossier
      .locator("summary")
      .filter({ hasText: "资金曲线、历史运行与成交" })
      .click();
    await expect(dossier.locator(".research-simulation")).toBeVisible();
    await dossier
      .getByRole("button", { name: "关闭，返回原处", exact: true })
      .click();
    const frames = await recording;
    await expect(page.locator("canvas")).toHaveCount(1);
    // 从第3天当前反馈继续完成本局，所有延迟界面资产也进入首局传输量。
    await page
      .getByRole("button", { name: "记下结果，进入下一天", exact: true })
      .click();
    for (let day = 4; day <= 8; day++) {
      await arrive(page, day);
      await page.locator(".research-play-actions button").first().click();
      await page
        .getByRole("button", { name: "记下结果，进入下一天", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "查看我的量化研究画像", exact: true })
      .click();
    await expect(page.locator("[data-research-report]")).toBeVisible();
    await page.getByRole("button", { name: "查看依据", exact: true }).click();
    const detail = page.getByRole("dialog", {
      name: "本局完整依据",
      exact: true,
    });
    await detail
      .locator("summary")
      .filter({ hasText: "策略、参数与全部运行" })
      .click();
    await expect(detail.locator(".research-simulation")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const completed = await saved(page);
    const observed = [...resources.values()];
    const result = {
      device,
      browser: page.context().browser()?.version(),
      environment:
        "本机Playwright无头Edge软件浏览器；手机项仅390×844视口模拟，未模拟实体设备或移动网络",
      host: {
        platform: platform(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        totalMemoryBytes: totalmem(),
      },
      graphics: renderer,
      loadedModels,
      workload:
        "全模型就绪后60秒，前3天移动/岔路/双镜头/规则运行/资料，其后等待仍保留WebGL场景",
      frames: frameSummary(frames, device.targetFps),
      transfer: {
        welcomeBytes,
        readySceneBytes,
        firstSessionBytes: totalBytes(),
        welcomeBudgetBytes: 15_000_000,
        firstSessionBudgetBytes: 40_000_000,
        resources: observed,
        failed,
      },
      completed: {
        phase: completed?.research.phase,
        days: completed?.research.day,
        choices: completed?.research.evidence.filter(
          (record) => record.action === "choose",
        ).length,
      },
      errors,
      caveat: [
        "rAF是浏览器回调间隔，不是WebGL实际提交帧/GPU帧率；未观察到的帧不推算或补齐。",
        "60秒按墙钟计时；隐藏时间和跨隐藏边界间隔单列，隐藏或样本不足时不得宣称达到目标帧率。",
        "传输量为CDP禁缓存/绕过Service Worker所见encodedDataLength，不含操作系统/TLS网络开销。",
        "首局覆盖本条固定路线及结果依据，不代表所有可选资料或其他路线的最大资源量。",
      ],
    };
    const body = JSON.stringify(result, null, 2);
    await writeFile(`logs/research-performance-${device.id}.json`, body);
    await info.attach(`research-performance-${device.id}`, {
      body,
      contentType: "application/json",
    });
    await page.screenshot({
      path: `logs/research-performance-${device.id}-report.png`,
    });
    expect(frames.elapsedMs).toBeGreaterThanOrEqual(60_000);
    expect(
      frames.visibleDeltasMs.length,
      "无有效可见采样时不能生成性能结论",
    ).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    expect(failed.filter((record) => !record.canceled)).toEqual([]);
    expect(observed.filter((resource) => resource.status >= 400)).toEqual([]);
    expect(observed.filter((resource) => !resource.finished)).toEqual([]);
    expect(
      observed.some(
        (resource) => resource.fromDiskCache || resource.fromServiceWorker,
      ),
    ).toBe(false);
    expect(welcomeBytes).toBeGreaterThan(0);
    expect(welcomeBytes).toBeLessThanOrEqual(15_000_000);
    expect(totalBytes()).toBeLessThanOrEqual(40_000_000);
    expect(completed?.research.phase).toBe("report");
    expect(
      completed?.research.evidence.filter(
        (record) => record.action === "choose",
      ),
    ).toHaveLength(8);
    await client.detach();
  });
}

test("新研究局连续五次真实确认重开的canvas与DOM监听观测", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await begin(page);
  await readyVisualScene(page);
  const client = await page.context().newCDPSession(page);
  const observations: Array<{
    cycle: number;
    sessionId: string;
    canvases: number;
    connectedElements: number;
    nodes: number;
    listeners: number;
    heapBytes: number;
  }> = [];
  const ids = new Set<string>();
  for (let cycle = 0; cycle <= 5; cycle++) {
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "掷骰出发", exact: true }),
    ).toBeVisible();
    const current = (await saved(page))!;
    expect(ids.has(current.research.sessionId)).toBe(false);
    ids.add(current.research.sessionId);
    expect(current.research.day).toBe(1);
    expect(current.research.phase).toBe("travel");
    expect(current.research.evidence).toHaveLength(0);
    expect(current.research.runs).toHaveLength(0);
    expect(current.research.answers).toHaveLength(0);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await client.send("HeapProfiler.collectGarbage");
    const dom: { nodes: number; jsEventListeners: number } = await client.send(
      "Memory.getDOMCounters",
    );
    const heap: { usedSize: number } = await client.send(
      "Runtime.getHeapUsage",
    );
    observations.push({
      cycle,
      sessionId: current.research.sessionId,
      canvases: await page.locator("canvas").count(),
      connectedElements: await page.locator("*").count(),
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      heapBytes: heap.usedSize,
    });
    if (cycle === 5) break;
    await page.getByRole("button", { name: "记录", exact: true }).click();
    const record = page.getByRole("dialog", { name: "本局记录", exact: true });
    await record
      .getByRole("button", { name: "重开一局 ↗", exact: true })
      .click();
    const confirm = record.getByRole("alertdialog", {
      name: "重新开始八天旅程？",
      exact: true,
    });
    await expect(
      confirm.getByRole("button", { name: "取消，保留本局", exact: true }),
    ).toBeFocused();
    await confirm
      .getByRole("button", { name: "确认重开", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await readyVisualScene(page);
  }
  const first = observations[0]!,
    last = observations.at(-1)!;
  const result = {
    browser: page.context().browser()?.version(),
    environment:
      "本机Playwright无头Edge软件浏览器，1440×900视口；非实体设备测试",
    observations,
    growth: {
      nodes: last.nodes - first.nodes,
      listeners: last.listeners - first.listeners,
      heapBytes: last.heapBytes - first.heapBytes,
      connectedElements: last.connectedElements - first.connectedElements,
    },
    errors,
    caveat:
      "每次强制垃圾回收后的CDP全页面DOM/监听/JS堆观测，不能定位所有监听所属对象，不能证明GPU纹理/几何已释放。重开复用同一个场景组件，本测试也不等同场景卸载压力测试。",
  };
  const body = JSON.stringify(result, null, 2);
  await writeFile("logs/research-restart-resources.json", body);
  await info.attach("research-restart-resources", {
    body,
    contentType: "application/json",
  });
  expect(ids.size).toBe(6);
  expect(errors).toEqual([]);
  expect(result.growth.connectedElements).toBe(0);
  // 沿用既有作者测试的观测阈值；堆增长仅报告，不把五次采样推断为无泄漏证明。
  expect(result.growth.listeners).toBeLessThanOrEqual(10);
  expect(result.growth.nodes).toBeLessThanOrEqual(30);
  await client.detach();
});

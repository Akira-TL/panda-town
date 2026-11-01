import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NPC_MODELS, npcModelUrl } from "../../src/scene/npc-models";
import type { TradingSession } from "../../src/trading/model";

// 作者机械检查；不连接用户浏览器，不冒充真机测量或独立验收。
const DIRECTORY = resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
  "logs/learning-performance",
);
const BASE_URL = process.env.PANDA_TEST_URL ?? "http://127.0.0.1:3018";
const BASE_MODELS = [
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
];
const TEXTURES = [
  "texture-wood",
  "texture-plaster",
  "texture-roof",
  "texture-canvas",
];
const MATERIALS = [
  "material-grass-earth",
  "material-cobblestone-path",
  "material-stone-wall",
];
const KEY = "panda-town.trading.v1";

interface ContextObservation {
  id: number;
  type: string;
  createdAt: number;
  collected: boolean;
  canvasConnected: boolean;
  contextLost: boolean | null;
  lossEvents: number;
  restoreEvents: number;
}
interface RuntimeSnapshot {
  time: number;
  heap: { used: number; total: number; limit: number } | null;
  contexts: ContextObservation[];
  visibleCanvasCount: number;
}
interface AuditWindow extends Window {
  __learningRuntime?: { snapshot: () => RuntimeSnapshot };
  __performanceDiceRandom?: () => number;
}
interface ResourceRow {
  path: string;
  status: number | null;
  finishedAt: number;
  responseBodyBytes: number | null;
  responseHeaderBytes: number | null;
  failure: string | null;
}
interface ConsoleRow {
  type: string;
  text: string;
}
interface LifecycleRow {
  operation: string;
  sessionId: string | null;
  snapshot: RuntimeSnapshot;
}

async function installObservations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(4000);
    type GL = WebGLRenderingContext | WebGL2RenderingContext;
    interface TrackedContext {
      id: number;
      type: string;
      createdAt: number;
      canvas: WeakRef<HTMLCanvasElement>;
      context: WeakRef<GL>;
      lossEvents: number;
      restoreEvents: number;
    }
    const observations: TrackedContext[] = [];
    const known = new WeakSet<GL>();
    const original = HTMLCanvasElement.prototype.getContext;
    // 只观测公开getContext调用，不持有强引用、不触碰Three.js内部缓存、不强制GC。
    HTMLCanvasElement.prototype.getContext = new Proxy(original, {
      apply(target, canvas: HTMLCanvasElement, args: unknown[]) {
        const result: unknown = Reflect.apply(target, canvas, args);
        if (
          (result instanceof WebGLRenderingContext ||
            result instanceof WebGL2RenderingContext) &&
          !known.has(result)
        ) {
          known.add(result);
          const row: TrackedContext = {
            id: observations.length + 1,
            type: String(args[0]),
            createdAt: performance.now(),
            canvas: new WeakRef(canvas),
            context: new WeakRef(result),
            lossEvents: 0,
            restoreEvents: 0,
          };
          observations.push(row);
          canvas.addEventListener("webglcontextlost", () => row.lossEvents++);
          canvas.addEventListener(
            "webglcontextrestored",
            () => row.restoreEvents++,
          );
        }
        return result;
      },
    });
    (window as AuditWindow).__learningRuntime = {
      snapshot() {
        const memory = (
          performance as Performance & {
            memory?: {
              usedJSHeapSize: number;
              totalJSHeapSize: number;
              jsHeapSizeLimit: number;
            };
          }
        ).memory;
        return {
          time: performance.now(),
          heap: memory
            ? {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
              }
            : null,
          visibleCanvasCount: document.querySelectorAll(".scene canvas").length,
          contexts: observations.map((row) => {
            const canvas = row.canvas.deref(),
              context = row.context.deref();
            return {
              id: row.id,
              type: row.type,
              createdAt: row.createdAt,
              collected: !canvas || !context,
              canvasConnected: canvas?.isConnected ?? false,
              contextLost: context?.isContextLost() ?? null,
              lossEvents: row.lossEvents,
              restoreEvents: row.restoreEvents,
            };
          }),
        };
      },
    };
  });
}

function collectNetwork(page: Page) {
  const rows: ResourceRow[] = [],
    consoleRows: ConsoleRow[] = [],
    errors: string[] = [],
    pending: Promise<void>[] = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      consoleRows.push({
        type: message.type(),
        text: message.text().slice(0, 1000),
      });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfinished", (request) => {
    pending.push(
      (async () => {
        const sizes = await request.sizes().catch(() => null);
        const response = await request.response();
        rows.push({
          path: new URL(request.url()).pathname,
          status: response?.status() ?? null,
          finishedAt: Date.now(),
          responseBodyBytes: sizes?.responseBodySize ?? null,
          responseHeaderBytes: sizes?.responseHeadersSize ?? null,
          failure: null,
        });
      })(),
    );
  });
  page.on("requestfailed", (request) => {
    rows.push({
      path: new URL(request.url()).pathname,
      status: null,
      finishedAt: Date.now(),
      responseBodyBytes: null,
      responseHeaderBytes: null,
      failure: request.failure()?.errorText ?? "请求失败",
    });
  });
  return {
    rows,
    consoleRows,
    errors,
    drain: () => Promise.allSettled(pending),
  };
}

async function stored(page: Page): Promise<TradingSession | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TradingSession) : null;
  }, KEY);
}
async function snapshot(page: Page): Promise<RuntimeSnapshot> {
  return page.evaluate(() => {
    const audit = (window as AuditWindow).__learningRuntime;
    if (!audit) throw new Error("公开画布观察器没有初始化");
    return audit.snapshot();
  });
}
function token(id: string): RegExp {
  return new RegExp(`(?:^| )${id}(?: |$)`);
}
async function assetsReady(
  page: Page,
  missing: readonly string[] = [],
): Promise<Locator> {
  const scene = page.locator("[data-expected-npc-models]");
  const npcIds = NPC_MODELS.filter(
    (model) => !missing.includes(`npc-${model.id}`),
  );
  await expect(scene).toHaveAttribute("data-expected-npc-models", "15");
  await expect(scene).toHaveAttribute(
    "data-npc-model-count",
    String(npcIds.length),
    { timeout: 90_000 },
  );
  for (const id of [
    ...BASE_MODELS,
    ...TEXTURES,
    ...MATERIALS,
    ...npcIds.map((model) => `npc-${model.id}`),
  ]) {
    if (!missing.includes(id))
      await expect(scene).toHaveAttribute("data-loaded-models", token(id), {
        timeout: 90_000,
      });
  }
  for (const model of npcIds)
    await expect(scene).toHaveAttribute(
      "data-loaded-npc-models",
      token(model.id),
    );
  await expect(scene.locator("canvas")).toHaveCount(1);
  return scene;
}

async function settings(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "设置，随时结算", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function settle(page: Page): Promise<void> {
  const dialog = await settings(page);
  await dialog.getByRole("button", { name: "结算本局 ↗", exact: true }).click();
  await expect(page.locator("[data-trading-report='true']")).toBeVisible();
  expect((await stored(page))?.game.phase).toBe("report");
}
async function diceOne(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "掷骰出发", exact: true });
  await button.click({ trial: true });
  // 仅固定真实骰子点击，避免固定随机数污染资源UUID；不改存档或账户。
  await page.evaluate(() => {
    (window as AuditWindow).__performanceDiceRandom = Math.random;
    Math.random = () => 1 / 12;
  });
  try {
    await button.click();
  } finally {
    await page.evaluate(() => {
      const holder = window as AuditWindow;
      if (holder.__performanceDiceRandom)
        Math.random = holder.__performanceDiceRandom;
      delete holder.__performanceDiceRandom;
    });
  }
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-product",
    "bread",
  );
  await expect(page.locator(".shop-panel")).toHaveAttribute(
    "data-trading-phase",
    "decision",
  );
}

async function sampleFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        durationMs: number;
        intervalsMs: number[];
        hiddenSamples: number;
      }>((done) => {
        const start = performance.now(),
          intervalsMs: number[] = [];
        let previous: number | null = null,
          hiddenSamples = 0;
        const tick = (now: number) => {
          if (previous !== null) intervalsMs.push(now - previous);
          previous = now;
          if (document.visibilityState !== "visible") hiddenSamples++;
          if (now - start >= 60_000)
            done({ durationMs: now - start, intervalsMs, hiddenSamples });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}
function percentile(
  values: readonly number[],
  percentile: number,
): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)]!;
}
async function save(name: string, value: unknown): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(
    resolve(DIRECTORY, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

test("桌面与390新隔离环境冷加载、60秒帧间隔、连续五次真实重开和画布生命周期", async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  await mkdir(DIRECTORY, { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const network = collectNetwork(page);
    const lifecycle: LifecycleRow[] = [];
    const started = Date.now();
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await installObservations(page);
      await page.goto(BASE_URL);
      const clickAt = Date.now();
      await page
        .getByRole("button", { name: "开始小镇交易", exact: true })
        .click();
      const scene = await assetsReady(page);
      const readyAt = Date.now();
      await expect(scene).toHaveAttribute("data-missing-npc-models", "");
      await expect(
        page.getByText("部分素材未加载", { exact: true }),
      ).toHaveCount(0);
      const timing = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        devicePixelRatio,
        resources: performance.getEntriesByType("resource").map((entry) => {
          const value = entry as PerformanceResourceTiming;
          return {
            path: new URL(value.name).pathname,
            transferBytes: value.transferSize,
            encodedBytes: value.encodedBodySize,
            decodedBytes: value.decodedBodySize,
            durationMs: value.duration,
          };
        }),
      }));
      const mobile = viewport.width < 720;
      const expectedModels = [
        ...BASE_MODELS.map(
          (id) =>
            `/models/${id}${mobile ? "-mobile" : ""}${id === "panda" ? "-rigged" : ""}-v2.glb`,
        ),
        ...NPC_MODELS.map((model) => npcModelUrl(model, mobile)),
      ];
      const actualModels = timing.resources.filter((row) =>
        row.path.endsWith(".glb"),
      );
      expect(actualModels.map((row) => row.path)).toEqual(
        expect.arrayContaining(expectedModels),
      );
      expect(new Set(actualModels.map((row) => row.path))).toEqual(
        new Set(expectedModels),
      );
      expect(
        actualModels.filter((row) => row.path.startsWith("/models/npc/")),
      ).toHaveLength(15);
      lifecycle.push({
        operation: "初次全部就绪",
        sessionId: (await stored(page))!.game.sessionId,
        snapshot: await snapshot(page),
      });
      await page.screenshot({
        path: resolve(DIRECTORY, `${viewport.width}-cold-ready.png`),
      });
      // 保持真实动画偏好，移动到首站后静止取样；不将rAF回调当GPU耗时或真机FPS。
      await diceOne(page);
      const sampled = await sampleFrames(page);
      expect(sampled.durationMs).toBeGreaterThanOrEqual(60_000);
      expect(sampled.hiddenSamples, "隐藏页面不能作为可见帧间隔测量").toBe(0);
      expect(sampled.intervalsMs.length).toBeGreaterThan(0);
      for (let cycle = 1; cycle <= 5; cycle++) {
        const before = (await stored(page))!;
        const dialog = await settings(page);
        await dialog
          .getByRole("button", { name: "重开一局 ↗", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "确认重开", exact: true })
          .click();
        await expect
          .poll(async () => (await stored(page))?.game.sessionId)
          .not.toBe(before.game.sessionId);
        await assetsReady(page);
        const session = (await stored(page))!;
        expect(session.game.trades).toHaveLength(0);
        expect(session.game.cash).toBe(1000);
        const observed = await snapshot(page);
        expect(observed.visibleCanvasCount).toBe(1);
        expect(
          observed.contexts.filter((row) => row.canvasConnected),
        ).toHaveLength(1);
        expect(
          observed.contexts.filter(
            (row) => row.canvasConnected && row.contextLost,
          ),
        ).toHaveLength(0);
        lifecycle.push({
          operation: `真实重开${cycle}`,
          sessionId: session.game.sessionId,
          snapshot: observed,
        });
      }
      const dialog = await settings(page);
      await dialog
        .getByRole("button", { name: "清除记录", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "确认清除", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "开始小镇交易", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".scene canvas")).toHaveCount(0);
      const cleared = await snapshot(page);
      expect(
        cleared.contexts.filter((row) => row.canvasConnected),
      ).toHaveLength(0);
      lifecycle.push({
        operation: "确认清除后回开场",
        sessionId: null,
        snapshot: cleared,
      });
      await network.drain();
      const glbs = timing.resources.filter((row) => row.path.endsWith(".glb"));
      const report = {
        scope:
          "项目msedge隔离桌面浏览器；390是模拟视口，不是实体手机；无网络节流，禁HTTP缓存、阻ServiceWorker。",
        limits:
          "系统/服务器/浏览器进程缓存未清。rAF统计不是GPU耗时或真机FPS。堆无强制GC，不据其单次变化断言泄漏。",
        disposalBoundary:
          "仅观测画布连接、上下文创建/丢失/回收；场景常驻时可复用上下文。不能证明私有缓存或GPU资源全部释放。",
        viewport,
        browserVersion: browser.version(),
        startedAt: new Date(started).toISOString(),
        pageAndInitialLoadMs: readyAt - started,
        clickToAllAssetsMs: readyAt - clickAt,
        initialBodyBytes: timing.resources.reduce(
          (sum, row) => sum + row.encodedBytes,
          0,
        ),
        glbEncodedBytes: glbs.reduce((sum, row) => sum + row.encodedBytes, 0),
        glbDecodedBytes: glbs.reduce((sum, row) => sum + row.decodedBytes, 0),
        raf: {
          durationMs: sampled.durationMs,
          count: sampled.intervalsMs.length,
          p50Ms: percentile(sampled.intervalsMs, 0.5),
          p95Ms: percentile(sampled.intervalsMs, 0.95),
          maxMs: Math.max(...sampled.intervalsMs),
          hiddenSamples: sampled.hiddenSamples,
          intervalsMs: sampled.intervalsMs,
        },
        expectedModels,
        timing,
        lifecycle,
        network: network.rows,
        console: network.consoleRows,
        pageErrors: network.errors,
      };
      await save(`${viewport.width}-performance.json`, report);
      await testInfo.attach(`${viewport.width}冷加载与五次重开`, {
        body: JSON.stringify(report),
        contentType: "application/json",
      });
      expect(network.errors).toEqual([]);
      expect(
        network.rows.filter((row) => row.failure || (row.status ?? 0) >= 400),
      ).toEqual([]);
    } finally {
      await network.drain();
      await save(`${viewport.width}-observations.json`, {
        viewport,
        lifecycle,
        network: network.rows,
        console: network.consoleRows,
        pageErrors: network.errors,
        status: testInfo.status,
        expectedStatus: testInfo.expectedStatus,
        scope: "故障/中断也保留已获取数据；此文件存在不表示性能用例通过。",
      });
      await context.close();
    }
  }
});

test("单个NPC或纹理请求失败准确降级，仍可实际买入和随时结算", async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  for (const failure of ["npc", "texture"] as const) {
    const viewport =
      failure === "npc"
        ? { width: 1440, height: 900 }
        : { width: 390, height: 844 };
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const network = collectNetwork(page);
    const model = NPC_MODELS[0];
    const target =
      failure === "npc" ? npcModelUrl(model, false) : "/art/texture-wood.webp";
    const missing = failure === "npc" ? `npc-${model.id}` : "texture-wood";
    let intercepted = 0;
    try {
      await context.route(
        (url) => url.pathname === target,
        async (route) => {
          intercepted++;
          await route.abort("failed");
        },
        { times: 1 },
      );
      await page.goto(BASE_URL);
      await page
        .getByRole("button", { name: "开始小镇交易", exact: true })
        .click();
      const scene = await assetsReady(page, [missing]);
      await expect(
        page.getByText("部分素材未加载", { exact: true }),
      ).toBeVisible();
      expect(intercepted).toBe(1);
      await expect(scene).not.toHaveAttribute(
        "data-loaded-models",
        token(missing),
      );
      if (failure === "npc") {
        await expect(scene).toHaveAttribute("data-npc-model-count", "14");
        await expect(scene).toHaveAttribute(
          "data-missing-npc-models",
          model.id,
        );
        await expect(scene).not.toHaveAttribute(
          "data-loaded-npc-models",
          token(model.id),
        );
      } else {
        await expect(scene).toHaveAttribute("data-npc-model-count", "15");
        await expect(scene).toHaveAttribute("data-missing-npc-models", "");
      }
      // 不使用要求15模型的共享定骰helper，避免把本次有意缺失当作页面未就绪。
      await diceOne(page);
      const before = (await stored(page))!;
      await page
        .locator(".shop-panel .shop-actions button")
        .filter({ hasText: "买入" })
        .click();
      await expect
        .poll(async () => (await stored(page))?.game.trades.length)
        .toBe(1);
      const after = (await stored(page))!;
      expect(after.game.holdings.bread.quantity).toBeGreaterThan(0);
      expect(after.game.cash).toBeLessThan(before.game.cash);
      await mkdir(DIRECTORY, { recursive: true });
      await page.screenshot({
        path: resolve(DIRECTORY, `${failure}-trade.png`),
      });
      await settle(page);
      await expect(scene).not.toHaveAttribute(
        "data-loaded-models",
        token(missing),
      );
      await expect(
        page.getByText("部分素材未加载", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: resolve(DIRECTORY, `${failure}-report.png`),
      });
      await network.drain();
      expect(network.errors).toEqual([]);
      const intentional = network.rows.filter(
        (row) => row.failure && row.path === target,
      );
      expect(intentional).toHaveLength(1);
      expect(
        network.rows.filter(
          (row) =>
            (row.failure || (row.status ?? 0) >= 400) && row.path !== target,
        ),
      ).toEqual([]);
      await save(`${failure}-degraded.json`, {
        viewport,
        intercepted,
        missing,
        target,
        beforeSession: before,
        afterBuy: after,
        reportSession: await stored(page),
        loaded: await scene.getAttribute("data-loaded-models"),
        missingNpc: await scene.getAttribute("data-missing-npc-models"),
        network: network.rows,
        console: network.consoleRows,
        pageErrors: network.errors,
        scope: "仅一次故障注入；实际界面买入和结算，不以缺失槽位当加载成功。",
      });
    } finally {
      await network.drain();
      await save(`${failure}-failure-observations.json`, {
        viewport,
        target,
        intercepted,
        network: network.rows,
        console: network.consoleRows,
        pageErrors: network.errors,
        status: testInfo.status,
      });
      await context.close();
    }
  }
});

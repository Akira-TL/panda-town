import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCATION_IDS,
  LOCATIONS,
  type LocationId,
} from "../../src/game/content";
import { NPC_MODELS } from "../../src/scene/npc-models";
import type { TradingSession } from "../../src/trading/model";
import { TRADING_STORAGE_KEY } from "../../src/trading/session";

interface CameraTestWindow extends Window {
  __learningCameraRandom?: () => number;
}
interface CameraRecord {
  round: number;
  location: LocationId;
  screenshot: string;
  manualOrbit: boolean;
  cameraPosition: number[];
  cameraTarget: number[];
  playerVisible: boolean;
  playerInFrame: boolean;
  frameLandmark: boolean;
  cameraObstructed: number;
  playerPixelHeight: number;
  focusLandmark: string;
  usableRegion: number[];
}
interface BranchRecord {
  round: number;
  from: LocationId;
  to: LocationId;
  targetPreviouslyVisited: boolean;
}
interface InteractionRecord {
  kind: string;
  before: CameraRecord;
  after: CameraRecord;
}
const MODELS = [
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
const MATERIALS = [
  "material-grass-earth",
  "material-cobblestone-path",
  "material-stone-wall",
];
const soft = expect.configure({ soft: true });
const PROJECT_DIRECTORY = fileURLToPath(new URL("../../", import.meta.url));
const ARTIFACT_DIRECTORY = resolve(PROJECT_DIRECTORY, "logs/learning-camera");
test.use({ channel: "msedge", headless: true, reducedMotion: "reduce" });

async function stored(page: Page): Promise<TradingSession | null> {
  // 只读正常页面已写入的状态；不注入位置、日期、账户或存档夹具。
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TradingSession) : null;
  }, TRADING_STORAGE_KEY);
}
function vector(raw: string | null | undefined, count: number): number[] {
  const value: unknown = JSON.parse(raw ?? "null");
  expect(Array.isArray(value)).toBe(true);
  const values = value as unknown[];
  expect(values).toHaveLength(count);
  expect(
    values.every((item) => typeof item === "number" && Number.isFinite(item)),
  ).toBe(true);
  return values.map(Number);
}
function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(...a.map((value, index) => value - b[index]!));
}
function offset(record: CameraRecord): number[] {
  return record.cameraPosition.map(
    (value, index) => value - record.cameraTarget[index]!,
  );
}
async function frames(page: Page, count = 12): Promise<void> {
  await page.evaluate(
    (target) =>
      new Promise<void>((done) => {
        let count = 0;
        const tick = () => {
          if (++count >= target) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}
async function record(
  page: Page,
  scene: Locator,
  screenshot = "",
): Promise<CameraRecord> {
  const state = await stored(page);
  expect(state).not.toBeNull();
  const data = await scene.evaluate((element) => {
    const d = (element as HTMLElement).dataset;
    return {
      manual: d.manualOrbit,
      position: d.cameraPosition,
      target: d.cameraTarget,
      player: d.playerVisible,
      inFrame: d.playerInFrame,
      landmark: d.frameLandmark,
      obstruction: d.cameraObstructed,
      height: d.playerPixelHeight,
      focus: d.focusLandmark,
      region: d.cameraUsableRegion,
    };
  });
  return {
    round: state!.game.round,
    location: state!.position,
    screenshot,
    manualOrbit: data.manual === "true",
    cameraPosition: vector(data.position, 3),
    cameraTarget: vector(data.target, 3),
    playerVisible: data.player === "true",
    playerInFrame: data.inFrame === "true",
    frameLandmark: data.landmark === "true",
    cameraObstructed: Number(data.obstruction),
    playerPixelHeight: Number(data.height),
    focusLandmark: data.focus ?? "",
    usableRegion: vector(data.region, 4),
  };
}
async function rollOne(page: Page, button: Locator): Promise<void> {
  // 模型全部加载后才临时固定骰子，避免全局恒定Math.random破坏Three.js资源UUID。
  await page.evaluate(() => {
    const testWindow = window as CameraTestWindow;
    testWindow.__learningCameraRandom = Math.random;
    Math.random = () => 1 / 12;
  });
  try {
    await button.click();
  } finally {
    if (!page.isClosed())
      await page.evaluate(() => {
        const testWindow = window as CameraTestWindow;
        if (testWindow.__learningCameraRandom)
          Math.random = testWindow.__learningCameraRandom;
        delete testWindow.__learningCameraRandom;
      });
  }
}
async function reachDecision(
  page: Page,
  visited: ReadonlySet<LocationId>,
  branches: BranchRecord[],
): Promise<TradingSession> {
  for (let guard = 0; guard < 4; guard++) {
    await expect
      .poll(
        async () => {
          const state = await stored(page);
          return state?.branch
            ? "branch"
            : state?.game.phase === "decision"
              ? "decision"
              : "moving";
        },
        { timeout: 20_000, intervals: [80, 160, 300] },
      )
      .toMatch(/^(branch|decision)$/);
    const state = (await stored(page))!;
    expect(state.die).toBe(1);
    if (state.game.phase === "decision") {
      await expect(page.locator("[data-trading-panel]")).toHaveAttribute(
        "data-trading-phase",
        "decision",
      );
      return state;
    }
    const exits = LOCATIONS.find((place) => place.id === state.position)!.next;
    const target =
      exits.find((id) => !visited.has(id)) ??
      exits[state.game.round % exits.length]!;
    branches.push({
      round: state.game.round,
      from: state.position,
      to: target,
      targetPreviouslyVisited: visited.has(target),
    });
    const targetName = LOCATIONS.find((place) => place.id === target)!.name;
    await page
      .getByRole("region", { name: "选择岔路", exact: true })
      .getByRole("button")
      .filter({ hasText: targetName })
      .click();
  }
  throw new Error("一格骰子在有限分支后仍未到达，不能伪造位置继续测试");
}
async function hold(page: Page): Promise<void> {
  await page
    .locator("[data-trading-panel]")
    .getByRole("button", { name: /^(先看看|持有)/ })
    .click();
  await expect(page.locator("[data-trading-panel]")).toHaveAttribute(
    "data-trading-phase",
    "feedback",
  );
}
async function motion(page: Page, reduced: boolean): Promise<void> {
  await page
    .getByRole("button", { name: "设置，随时结算", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "设置", exact: true });
  const toggle = dialog.getByRole("button", { name: /^减少动画/ });
  if ((await toggle.getAttribute("aria-pressed")) !== String(reduced))
    await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(reduced));
  await dialog
    .getByRole("button", { name: "关闭，返回原处", exact: true })
    .click();
}
async function automaticFrame(
  page: Page,
  scene: Locator,
  width: number,
): Promise<void> {
  await expect(scene).toHaveAttribute("data-character-state", "Idle");
  // 组合条件宽松等待；软断言保留全部16站截图，失败站由根Agent目视复核。
  await soft
    .poll(
      async () => {
        const sample = await record(page, scene);
        return {
          automatic: !sample.manualOrbit,
          player: sample.playerVisible && sample.playerInFrame,
          landmark: sample.frameLandmark,
          clear: sample.cameraObstructed === 0,
          readable: sample.playerPixelHeight >= (width >= 720 ? 40 : 32),
          named: !!sample.focusLandmark,
        };
      },
      { timeout: 6_000, intervals: [100, 200, 400] },
    )
    .toEqual({
      automatic: true,
      player: true,
      landmark: true,
      clear: true,
      readable: true,
      named: true,
    });
}
async function gesturePoint(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize()!;
  if (viewport.width > viewport.height && viewport.height <= 600) {
    const panel = await page.locator("[data-trading-panel]").boundingBox();
    const freeRight = (panel?.x ?? box.x + box.width * 0.44) - 12;
    return { x: (box.x + freeRight) / 2, y: box.y + box.height * 0.5 };
  }
  return { x: box.x + box.width * 0.55, y: box.y + box.height * 0.28 };
}
async function orbit(
  page: Page,
  scene: Locator,
  mode: "跟随" | "全局",
  interactions: InteractionRecord[],
): Promise<void> {
  await page.getByRole("button", { name: mode, exact: true }).click();
  await expect(scene).toHaveAttribute("data-manual-orbit", "false");
  const unchanged = (await stored(page))!;
  const canvas = scene.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const start = await gesturePoint(page, box!);
  const before = await record(page, scene);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x + Math.min(90, box!.width * 0.16, box!.height * 0.12),
    start.y + 12,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-manual-orbit", "true");
  await frames(page);
  const dragged = await record(page, scene);
  expect(
    distance(dragged.cameraPosition, before.cameraPosition),
  ).toBeGreaterThan(0.25);
  await frames(page, 18);
  const retained = await record(page, scene);
  expect(
    distance(retained.cameraPosition, dragged.cameraPosition),
  ).toBeLessThan(0.3);
  interactions.push({
    kind: `${mode}真实鼠标拖动且18帧不回弹`,
    before,
    after: retained,
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.wheel(0, -80);
  await frames(page);
  const zoomed = await record(page, scene);
  expect(
    Math.abs(
      distance(zoomed.cameraPosition, zoomed.cameraTarget) -
        distance(retained.cameraPosition, retained.cameraTarget),
    ),
  ).toBeGreaterThan(0.1);
  expect(zoomed.manualOrbit).toBe(true);
  expect((await stored(page))!).toEqual(unchanged);
  interactions.push({
    kind: `${mode}真实滚轮缩放且不改交易/路线`,
    before: retained,
    after: zoomed,
  });
  await page.screenshot({
    path: resolve(
      ARTIFACT_DIRECTORY,
      `${page.viewportSize()!.width}-bakery-${mode === "跟随" ? "follow" : "overview"}-manual.png`,
    ),
  });
  await page.getByRole("button", { name: "跟随", exact: true }).click();
  await expect(scene).toHaveAttribute("data-manual-orbit", "false");
  await frames(page);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`${viewport.width}视口真实16站相机与专属NPC`, () => {
    // 项目msedge隔离context；不连接用户IAB/Edge既有标签或个人配置。
    test.use({
      viewport,
    });
    test("真实骰子一格、岔路和持有遍历16位置，留图并检查旋转/缩放/重置", async ({
      page,
    }, testInfo) => {
      test.setTimeout(360_000);
      const directory = ARTIFACT_DIRECTORY;
      await mkdir(directory, { recursive: true });
      const visited = new Set<LocationId>(),
        records: CameraRecord[] = [];
      const branches: BranchRecord[] = [],
        interactions: InteractionRecord[] = [];
      const errors: string[] = [],
        failedAssets: { path: string; status: number | string }[] = [];
      const modelResponses = new Set<string>();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith("/models/") && path.endsWith(".glb")) {
          if (response.ok()) modelResponses.add(path);
          else failedAssets.push({ path, status: response.status() });
        }
      });
      page.on("requestfailed", (request) => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith("/models/") && path.endsWith(".glb"))
          failedAssets.push({
            path,
            status: request.failure()?.errorText ?? "请求失败",
          });
      });
      await page.addInitScript(() =>
        performance.setResourceTimingBufferSize(3000),
      );
      const mobile = viewport.width < 720;
      const expectedNpcUrls = NPC_MODELS.map(
        (model) => `/models/npc/${model.id}${mobile ? "-mobile" : ""}-v1.glb`,
      );
      const expectedBaseUrls = MODELS.map(
        (id) =>
          `/models/${id}${mobile ? "-mobile" : ""}${id === "panda" ? "-rigged" : ""}-v2.glb`,
      );
      try {
        await page.goto("/");
        await page
          .getByRole("button", { name: "开始小镇交易", exact: true })
          .click();
        const scene = page.locator("[data-expected-npc-models]");
        await expect(scene).toHaveAttribute("data-expected-npc-models", "15");
        await expect(scene).toHaveAttribute("data-npc-model-count", "15", {
          timeout: 90_000,
        });
        for (const id of [...MODELS, ...MATERIALS])
          await expect(scene).toHaveAttribute(
            "data-loaded-models",
            new RegExp(`(?:^| )${id}(?: |$)`),
          );
        for (const model of NPC_MODELS)
          await expect(scene).toHaveAttribute(
            "data-loaded-npc-models",
            new RegExp(`(?:^| )${model.id}(?: |$)`),
          );
        await expect(scene).toHaveAttribute("data-missing-npc-models", "");
        await expect(
          page.getByText("部分素材未加载", { exact: true }),
        ).toHaveCount(0);
        await expect(scene.locator("canvas")).toHaveCount(1);
        const paths = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .map((entry) => new URL(entry.name).pathname),
        );
        expect(
          [
            ...new Set(paths.filter((path) => path.startsWith("/models/npc/"))),
          ].sort(),
        ).toEqual([...expectedNpcUrls].sort());
        expect([
          ...new Set(
            paths.filter((path) => /^\/models\/panda.*\.glb$/.test(path)),
          ),
        ]).toEqual([expectedBaseUrls[0]]);
        expect(paths).toEqual(expect.arrayContaining(expectedBaseUrls));
        await rollOne(
          page,
          page.getByRole("button", { name: "掷骰出发", exact: true }),
        );
        for (let stop = 0; stop < 30; stop++) {
          const current = await reachDecision(page, visited, branches);
          if (!visited.has(current.position)) {
            await automaticFrame(page, scene, viewport.width);
            const image = `logs/learning-camera/${viewport.width}-${current.position}.png`;
            await page.screenshot({ path: resolve(PROJECT_DIRECTORY, image) });
            const captured = await record(page, scene, image);
            records.push(captured);
            if (viewport.width > viewport.height && viewport.height <= 600) {
              const canvas = (await scene.locator("canvas").boundingBox())!;
              const panel = (await page
                .locator("[data-trading-panel]")
                .boundingBox())!;
              soft(
                canvas.x + captured.usableRegion[2]! * canvas.width,
              ).toBeLessThanOrEqual(panel.x - 8);
            }
            visited.add(current.position);
          }
          if (visited.size === LOCATION_IDS.length) break;
          if (current.position === "bakery" && interactions.length === 0) {
            await orbit(page, scene, "跟随", interactions);
            await orbit(page, scene, "全局", interactions);
            // 再作小幅手动环绕，观察真实一段行走；不篡改任何路线/位置/存档。
            const box = (await scene.locator("canvas").boundingBox())!;
            const { x, y } = await gesturePoint(page, box);
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + 18, y, { steps: 6 });
            await page.mouse.up();
            await expect(scene).toHaveAttribute("data-manual-orbit", "true");
            await motion(page, false);
            const beforeMove = await record(page, scene);
            await hold(page);
            await rollOne(
              page,
              page.getByRole("button", { name: "下一站 →", exact: true }),
            );
            await expect
              .poll(() => scene.getAttribute("data-character-state"), {
                timeout: 12_000,
                intervals: [40, 60, 100],
              })
              .toBe("Walk");
            const duringMove = await record(page, scene);
            const arrived = await reachDecision(page, visited, branches);
            expect(arrived.position).toBe("grocery");
            await expect(scene).toHaveAttribute("data-character-state", "Idle");
            const moved = await record(page, scene);
            expect(moved.manualOrbit).toBe(true);
            expect(
              distance(moved.cameraTarget, beforeMove.cameraTarget),
            ).toBeGreaterThan(0.5);
            expect(distance(offset(moved), offset(beforeMove))).toBeLessThan(1);
            interactions.push(
              {
                kind: "非减少动画：真实行走中仍为手动环绕",
                before: beforeMove,
                after: duringMove,
              },
              {
                kind: "到达后相机与注视点等量平移、保留所选角度/缩放",
                before: beforeMove,
                after: moved,
              },
            );
            await motion(page, true);
            await page
              .getByRole("button", { name: "跟随", exact: true })
              .click();
            await expect(scene).toHaveAttribute("data-manual-orbit", "false");
            continue;
          }
          await hold(page);
          await rollOne(
            page,
            page.getByRole("button", { name: "下一站 →", exact: true }),
          );
        }
        expect([...visited].sort()).toEqual([...LOCATION_IDS].sort());
        expect(records).toHaveLength(16);
        await soft(page.locator("[data-expected-npc-models]")).toHaveAttribute(
          "data-npc-model-count",
          "15",
        );
        soft(failedAssets).toEqual([]);
        soft(errors).toEqual([]);
        soft([...modelResponses]).toEqual(
          expect.arrayContaining([...expectedNpcUrls, ...expectedBaseUrls]),
        );
      } finally {
        const path = resolve(directory, `${viewport.width}-records.json`);
        await writeFile(
          path,
          JSON.stringify(
            {
              viewport,
              page: page.url(),
              capturedAt: new Date().toISOString(),
              scope:
                "作者机械集成；投影和资源状态不替代截图目视，390/844为桌面模拟视口，不是实体手机。",
              evidenceBoundary:
                "15独立URL与真实load状态、单一玩家panda资源；不靠children=7证明加载，也不遍历WebGL内部树。",
              coverageComplete: visited.size === 16,
              statusMeaning:
                "仅表示16站留图是否齐全，不代表取景或视觉通过；终态以Playwright结果为准。",
              visited: [...visited],
              expectedNpcUrls,
              expectedBaseUrls,
              modelResponses: [...modelResponses].sort(),
              failedAssets,
              errors,
              branches,
              interactions,
              records,
              softFailures: testInfo.errors.map((error) => error.message),
            },
            null,
            2,
          ),
          "utf8",
        );
        await testInfo.attach(`${viewport.width}相机与NPC实际记录`, {
          path,
          contentType: "application/json",
        });
      }
    });
  });
}

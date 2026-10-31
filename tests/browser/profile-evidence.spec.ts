import { expect, test, type Page } from "@playwright/test";
import { createGame, dispatch, type GameAction } from "../../src/game/engine";
import { getEventForLocation, type LocationId } from "../../src/game/content";
import { STORAGE_KEY, type Session } from "../../src/game/session";

interface FixtureStep {
  location: LocationId;
  option: string;
  compare?: boolean;
  repeat?: boolean;
}
type FixtureId =
  "sufficient" | "insufficient" | "contradictory" | "disabled" | "repeated";
interface Fixture {
  id: FixtureId;
  label: string;
  steps: FixtureStep[];
  initialCash?: number;
}
const fixtures: Fixture[] = [
  {
    id: "sufficient",
    label: "两个消费情境与两个资料来源比较情境",
    steps: [
      { location: "bakery", option: "novel" },
      { location: "gifts", option: "novel" },
      { location: "research", option: "review", compare: true },
      { location: "dock", option: "review", compare: true },
    ],
  },
  {
    id: "insufficient",
    label: "仅一次消费线索，其他主题未观察",
    steps: [{ location: "bakery", option: "novel" }],
  },
  {
    id: "contradictory",
    label: "常规与新奇选择并列，不形成一致人格判断",
    steps: [
      { location: "bakery", option: "ordinary" },
      { location: "gifts", option: "novel" },
    ],
  },
  {
    id: "disabled",
    label: "边界验收：初始现金50，两个商品均不可购买",
    initialCash: 50,
    steps: [{ location: "bakery", option: "work" }],
  },
  {
    id: "repeated",
    label: "两天重复同一资料情境，不累计独立线索",
    steps: [
      { location: "notice", option: "review", compare: true, repeat: true },
      { location: "notice", option: "review", compare: true, repeat: true },
    ],
  },
];

/** 专属验收记录：地点与边界现金由测试设定，不冒充骰子真实路线。 */
function makeFixture(fixture: Fixture): Session {
  let game = createGame(`profile-fixture-${fixture.id}`, "A");
  if (fixture.initialCash !== undefined) game.cash = fixture.initialCash;
  let sequence = 0;
  let position: LocationId = "square";
  type Payload = GameAction extends infer A
    ? A extends GameAction
      ? Omit<A, "id" | "day">
      : never
    : never;
  function act(payload: Payload) {
    const next = dispatch(game, {
      ...payload,
      id: `fixture-${++sequence}`,
      day: game.day,
    });
    if (next === game) throw new Error(`验收记录的动作被拒绝：${payload.type}`);
    game = next;
  }
  for (let turn = 0; turn < 8; turn++) {
    const step = fixture.steps[turn] ?? { location: "square", option: "work" };
    position = step.location;
    const event = getEventForLocation(game, step.location);
    act({ type: "open-event", event });
    if (step.compare) {
      const first = event.materials?.[0],
        second = event.materials?.[1];
      if (!first || !second) throw new Error("验收情境缺少两份资料");
      for (let repeat = 0; repeat < (step.repeat ? 3 : 1); repeat++) {
        act({ type: "inspect", materialId: first.id });
        act({ type: "inspect", materialId: second.id });
        act({ type: "compare", materialIds: [first.id, second.id] });
      }
    }
    act({ type: "choose", optionId: step.option });
    act({ type: "end-turn" });
  }
  act({ type: "finish", sellStall: false, sellInvestment: false });
  return {
    game,
    position,
    remaining: 0,
    rolled: true,
    branch: false,
    die: 1,
    sellStall: false,
    sellInvestment: false,
  };
}

async function openFixture(page: Page, fixture: Fixture) {
  await page.addInitScript(
    ({ key, session }) => {
      sessionStorage.setItem(key, JSON.stringify(session));
    },
    { key: STORAGE_KEY, session: makeFixture(fixture) },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "用户画像", exact: true }),
  ).toBeVisible();
  // 仅验收截图加标识，产品源码及正式模式均无记录注入入口。
  await page.evaluate((label) => {
    const notice = document.createElement("div");
    notice.textContent = `验收记录｜${label}｜非真实参观者经历`;
    notice.setAttribute("role", "note");
    Object.assign(notice.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "10000",
      padding: "6px 12px",
      background: "#fff1a8",
      color: "#3b361b",
      fontSize: "14px",
      pointerEvents: "none",
      textAlign: "center",
    });
    document.body.append(notice);
  }, fixture.label);
}

const fact = (page: Page, label: string) =>
  page
    .locator("article.profile-fact")
    .filter({ has: page.getByText(label, { exact: true }) });
const openness = (page: Page) =>
  page
    .locator(".personality-observations article")
    .filter({
      has: page.getByRole("heading", { name: "开放性相关线索", exact: true }),
    });

for (const fixture of fixtures) {
  test(`画像验收记录：${fixture.label}`, async ({ page }) => {
    await openFixture(page, fixture);
    if (fixture.id === "sufficient") {
      await expect(
        fact(page, "新奇取舍").locator(".profile-count b"),
      ).toHaveText("2");
      await expect(fact(page, "新奇取舍")).toContainText("2 个可选机会");
      await expect(
        fact(page, "不同来源比较").locator(".profile-count b"),
      ).toHaveText("2");
      await expect(openness(page)).toContainText("有情境线索");
      await expect(
        page.getByText("细心看账的店长", { exact: true }),
      ).toBeVisible();
    } else if (fixture.id === "insufficient") {
      await expect(
        fact(page, "新奇取舍").locator(".profile-count b"),
      ).toHaveText("1");
      await expect(fact(page, "新奇取舍")).not.toContainText("本局多次");
      await expect(openness(page)).toContainText("线索不足");
      await expect(
        page.getByText("本局未评估", { exact: true }).first(),
      ).toBeVisible();
    } else if (fixture.id === "contradictory") {
      for (const label of ["新奇取舍", "常规与实用取舍"])
        await expect(fact(page, label).locator(".profile-count b")).toHaveText(
          "1",
        );
      await expect(openness(page)).toContainText("线索不足");
      await fact(page, "常规与实用取舍").getByRole("button").click();
      await expect(page.getByRole("dialog")).toContainText("普通面包，60");
      await page.getByRole("button", { name: "关闭证据", exact: true }).click();
    } else if (fixture.id === "disabled") {
      await expect(fact(page, "新奇取舍")).toHaveCount(0);
      await page.locator(".journal-days button").first().click();
      await expect(page.getByRole("dialog")).toContainText("50");
      await expect(page.getByRole("dialog")).toContainText("当时现金不足，还差 10");
      await expect(page.getByRole("dialog")).toContainText("当时现金不足，还差 70");
      await page.screenshot({
        path: "logs/validation-profile-disabled-evidence.png",
      });
      await page.getByRole("button", { name: "关闭证据", exact: true }).click();
    } else {
      await expect(
        fact(page, "不同来源比较").locator(".profile-count b"),
      ).toHaveText("1");
      await expect(
        fact(page, "主动查看").locator(".profile-count b"),
      ).toHaveText("1");
      await expect(
        page.getByText("踏实筹备的店长", { exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `logs/validation-profile-${fixture.id}.png`,
      fullPage: true,
    });
  });
}

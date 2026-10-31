import assert from "node:assert/strict";
import test from "node:test";
import { createGame, dispatch, type GameState } from "../src/game/engine";
import {
  getEventForLocation,
  LOCATIONS,
  type LocationId,
} from "../src/game/content";

function next(state: GameState, location: LocationId, choice = "work") {
  const opened = dispatch(state, {
    id: `open-${state.day}`,
    day: state.day,
    type: "open-event",
    event: getEventForLocation(state, location),
  });
  const chosen = dispatch(opened, {
    id: `choose-${state.day}`,
    day: state.day,
    type: "choose",
    optionId: choice,
  });
  assert.equal(chosen.phase, "feedback");
  return dispatch(chosen, {
    id: `end-${state.day}`,
    day: state.day,
    type: "end-turn",
  });
}

test("实际路线条件下第二天购摊六次经营、两次工作、出售后3180", () => {
  const locations: LocationId[] = [
    "notice",
    "market",
    "research",
    "bridge",
    "music",
    "dock",
    "rival",
    "riverside",
  ];
  const choices = [
    "work",
    "buy",
    "skip",
    "decline",
    "work",
    "skip",
    "plan",
    "skip",
  ];
  let state = createGame("route-3180", "A");
  for (let day = 0; day < 8; day++)
    state = next(state, locations[day], choices[day]);
  assert.equal(state.cash, 2700);
  state = dispatch(state, {
    id: "finish",
    day: 8,
    type: "finish",
    sellStall: true,
    sellInvestment: false,
  });
  assert.equal(state.result?.cashBeforeOpening, 3180);
  assert.equal(state.cash, 180);
});

test("12基础事件均可在合法八回合局中出现，未达标2200仍进入报告", () => {
  const tours: LocationId[][] = [
    [
      "bakery",
      "grocery",
      "notice",
      "market",
      "research",
      "bridge",
      "bank",
      "gifts",
    ],
    [
      "grocery",
      "repair",
      "garden",
      "market",
      "research",
      "bridge",
      "music",
      "dock",
    ],
    [
      "bridge",
      "rival",
      "riverside",
      "cafe",
      "square",
      "bakery",
      "grocery",
      "notice",
    ],
  ];
  const events = new Set<string>();
  for (const [index, tour] of tours.entries()) {
    let state = createGame(`events-${index}`, "A");
    for (const location of tour) {
      events.add(getEventForLocation(state, location).id);
      state = next(state, location);
    }
    assert.equal(
      state.evidence.filter((entry) => entry.action === "choose").length,
      8,
    );
  }
  let invested = createGame("event-update", "A");
  invested = next(invested, "bridge");
  invested = next(invested, "bank", "small");
  invested = next(invested, "rival", "decline");
  events.add(getEventForLocation(invested, "riverside").id);
  assert.deepEqual(
    [...events].sort(),
    Array.from(
      { length: 12 },
      (_, index) => `E${String(index + 1).padStart(2, "0")}`,
    ),
  );
  let failure = createGame("failure", "A");
  for (let day = 1; day <= 8; day++) failure = next(failure, "square", "plan");
  failure = dispatch(failure, {
    id: "finish",
    day: 8,
    type: "finish",
    sellStall: false,
    sellInvestment: false,
  });
  assert.equal(failure.result?.cashBeforeOpening, 2200);
  assert.equal(failure.result.gap, 800);
  assert.equal(failure.phase, "report");
});

test("16种固定落点各自连续八天都保留工作，结算现金4200", () => {
  for (const location of LOCATIONS) {
    let state = createGame(`location-${location.id}`, "A");
    for (let day = 1; day <= 8; day++) {
      const event = getEventForLocation(state, location.id);
      assert.ok(event.options.some((option) => option.id === "work"));
      state = next(state, location.id);
    }
    assert.equal(state.phase, "settlement");
    assert.equal(state.cash, 4200);
  }
});

test("32个固定随机种子驱动合法分支与八回合，稳定工作均可开张", () => {
  const visited = new Set<LocationId>();
  for (let seed = 1; seed <= 32; seed++) {
    let rng = seed;
    const random = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    let state = createGame(`seed-${seed}`, seed % 2 ? "A" : "B");
    let position: LocationId = "square";
    for (let day = 1; day <= 8; day++) {
      const die = 1 + Math.floor(random() * 6);
      for (let step = 0; step < die; step++) {
        const paths = LOCATIONS.find((entry) => entry.id === position)!.next;
        position = paths[Math.floor(random() * paths.length)];
      }
      visited.add(position);
      state = next(state, position);
      assert.equal(state.cash, 1000 + day * 400);
      assert.equal(
        state.evidence.filter((entry) => entry.action === "choose").length,
        day,
      );
    }
    state = dispatch(state, {
      id: "finish",
      day: 8,
      type: "finish",
      sellStall: false,
      sellInvestment: false,
    });
    assert.equal(state.cash, 1200);
    assert.equal(state.result?.cashBeforeOpening, 4200);
    assert.equal(state.result.opened, true);
  }
  assert.equal(visited.size, 16);
});

test("工具购入日期对应独立算出的收入，加成从已持有工具的当晚开始", () => {
  for (const [quality, cost, bonus] of [
    ["used", 100, 20],
    ["premium", 180, 40],
  ] as const) {
    for (let buyDay = 2; buyDay <= 8; buyDay++) {
      let state = createGame(`tool-${quality}-${buyDay}`, "A");
      state = next(state, "market", "buy");
      for (let day = 2; day <= 8; day++) {
        state =
          day === buyDay
            ? next(state, "grocery", quality)
            : next(state, "square", "plan");
      }
      // 第1天买摊位，七次基本经营；工具在buyDay当晚至第8晚生效。
      assert.equal(
        state.cash,
        1000 + 1200 - 600 - cost + 700 + (9 - buyDay) * bonus,
      );
    }
  }
});

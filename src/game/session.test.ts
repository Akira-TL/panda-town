import assert from "node:assert/strict";
import test from "node:test";
import { createGame, dispatch } from "./engine";
import { getEventForLocation } from "./content";
import { restoreSession, type Session } from "./session";

function snapshot(): Session {
  return {
    game: createGame("restore-test", "A"),
    position: "square",
    remaining: 0,
    rolled: false,
    branch: false,
    die: 0,
    sellStall: false,
    sellInvestment: false,
  };
}
test("开局与移动中恢复保留位置、骰数和剩余步数", () => {
  const start = snapshot();
  assert.deepEqual(restoreSession(JSON.stringify(start)), start);
  const moving: Session = {
    ...start,
    position: "grocery",
    die: 4,
    remaining: 2,
    rolled: true,
    branch: true,
  };
  assert.deepEqual(restoreSession(JSON.stringify(moving)), moving);
});
test("待选择和选择后恢复不会再次发钱或重开事件", () => {
  const s = snapshot();
  s.game = dispatch(s.game, {
    type: "open-event",
    id: "open",
    day: 1,
    event: getEventForLocation(s.game, "square"),
  });
  assert.deepEqual(restoreSession(JSON.stringify(s)), s);
  s.game = dispatch(s.game, {
    type: "choose",
    id: "work",
    day: 1,
    optionId: "work",
  });
  const restored = restoreSession(JSON.stringify(s));
  assert.equal(restored?.game.cash, 1250);
  assert.equal(restored?.game.evidence.length, 1);
  assert.equal(restored?.game.phase, "feedback");
  assert.equal(
    dispatch(restored!.game, {
      type: "choose",
      id: "work",
      day: 1,
      optionId: "work",
    }),
    restored!.game,
  );
});
test("八天结果可恢复，不能重复支付开店款", () => {
  const s = snapshot();
  for (let day = 1; day <= 8; day++) {
    s.game = dispatch(s.game, {
      type: "open-event",
      id: `open-${day}`,
      day,
      event: getEventForLocation(s.game, "square"),
    });
    s.game = dispatch(s.game, {
      type: "choose",
      id: `work-${day}`,
      day,
      optionId: "work",
    });
    s.game = dispatch(s.game, { type: "end-turn", id: `night-${day}`, day });
  }
  s.game = dispatch(s.game, {
    type: "finish",
    id: "finish",
    day: 8,
    sellStall: false,
    sellInvestment: false,
  });
  const restored = restoreSession(JSON.stringify(s));
  assert.equal(restored?.game.result?.cashBeforeOpening, 4200);
  assert.equal(restored?.game.cash, 1200);
  assert.equal(
    dispatch(restored!.game, {
      type: "finish",
      id: "again",
      day: 8,
      sellStall: false,
      sellInvestment: false,
    }),
    restored!.game,
  );
});
test("旧规则、混局记录、不合法位置及步数无法恢复", () => {
  const old = snapshot();
  old.game.rulesVersion = -1;
  assert.equal(restoreSession(JSON.stringify(old)), null);
  const mixed = snapshot();
  mixed.game = dispatch(mixed.game, {
    type: "open-event",
    id: "open",
    day: 1,
    event: getEventForLocation(mixed.game, "square"),
  });
  mixed.game = dispatch(mixed.game, {
    type: "choose",
    id: "work",
    day: 1,
    optionId: "work",
  });
  mixed.game.evidence[0]!.sessionId = "somebody-else";
  assert.equal(restoreSession(JSON.stringify(mixed)), null);
  assert.equal(
    restoreSession(JSON.stringify({ ...snapshot(), position: "unknown" })),
    null,
  );
  assert.equal(
    restoreSession(
      JSON.stringify({ ...snapshot(), die: 2, remaining: 3, rolled: true }),
    ),
    null,
  );
  assert.equal(restoreSession(JSON.stringify({ game: null })), null);
});
test("损坏JSON交给调用方的恢复提示处理", () => {
  assert.throws(() => restoreSession("{"), SyntaxError);
});

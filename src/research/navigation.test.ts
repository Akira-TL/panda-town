import assert from "node:assert/strict";
import test from "node:test";
import { createResearch } from "./campaign";
import { getChapter } from "./chapters";
import type { ResearchSession } from "./model";
import {
  advanceResearchStep,
  applyResearchAction,
  chooseResearchBranch,
  rollResearchDie,
} from "./navigation";
import { restoreResearchSession } from "./session";
import { LOCATIONS } from "../game/content";

function fresh(): ResearchSession {
  return {
    research: createResearch("navigation-fixture"),
    position: "square",
    remaining: 0,
    die: 0,
    rolled: false,
    branch: false,
  };
}

test("六点走两步到杂货铺暂停，选支路消耗一步，不会重复掷骰或跳过岔路", () => {
  let session = rollResearchDie(fresh(), 6);
  assert.equal(rollResearchDie(session, 1), session);
  session = advanceResearchStep(advanceResearchStep(session));
  assert.equal(session.position, "grocery");
  assert.equal(session.remaining, 4);
  assert.equal(session.branch, true);
  assert.equal(advanceResearchStep(session), session);
  assert.equal(chooseResearchBranch(session, "bank"), session);
  session = chooseResearchBranch(session, "repair");
  assert.equal(session.position, "repair");
  assert.equal(session.remaining, 3);
  while (session.remaining) session = advanceResearchStep(session);
  assert.equal(session.position, "research");
  assert.equal(session.research.phase, "decision");
  assert.equal(session.research.location, "research");
});

test("任意骰与岔路组合可玩满八天，每个到达和提交后都能恢复真实运行记录", () => {
  for (const branchIndex of [0, 1]) {
    let session = fresh();
    for (let day = 1; day <= 8; day++) {
      session = rollResearchDie(session, (day % 6) + 1);
      let moves = 0;
      while (session.remaining > 0) {
        assert.ok(moves++ < 7, "一个骰数不应产生无限移动");
        session = session.branch
          ? chooseResearchBranch(
              session,
              LOCATIONS.find((place) => place.id === session.position)!.next[
                branchIndex
              ]!,
            )
          : advanceResearchStep(session);
      }
      assert.deepEqual(
        restoreResearchSession(JSON.stringify(session)),
        session,
      );
      const option = getChapter(session.research).options[branchIndex]!;
      session = applyResearchAction(session, {
        type: "choose",
        id: `choose:${day}`,
        day,
        optionId: option.id,
      });
      assert.equal(session.research.phase, "feedback");
      assert.deepEqual(
        restoreResearchSession(JSON.stringify(session)),
        session,
      );
      session = applyResearchAction(session, {
        type: "continue",
        id: `next:${day}`,
        day,
      });
      if (day < 8) {
        assert.equal(session.research.day, day + 1);
        assert.equal(session.research.phase, "travel");
        assert.equal(session.rolled, false);
      }
    }
    assert.equal(session.research.phase, "exhibit");
    session = applyResearchAction(session, {
      type: "report",
      id: "report",
      day: 8,
    });
    assert.equal(session.research.phase, "report");
    assert.deepEqual(restoreResearchSession(JSON.stringify(session)), session);
    assert.ok(session.research.runs.length >= 3);
  }
});

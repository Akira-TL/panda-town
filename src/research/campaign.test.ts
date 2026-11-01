import assert from "node:assert/strict";
import test from "node:test";
import { createResearch, dispatchResearch } from "./campaign";
import type { ResearchState } from "./model";

function arrive(state: ResearchState): ResearchState {
  const next = dispatchResearch(state, {
    type: "arrive",
    id: `arrive-${state.day}`,
    day: state.day,
    location: "research",
  });
  assert.equal(next.phase, "decision");
  return next;
}

function choose(state: ResearchState, optionId: string): ResearchState {
  const next = dispatchResearch(state, {
    type: "choose",
    id: `choose-${state.day}`,
    day: state.day,
    optionId,
  });
  assert.equal(next.phase, "feedback");
  return next;
}

function proceed(state: ResearchState): ResearchState {
  return dispatchResearch(state, {
    type: "continue",
    id: `continue-${state.day}`,
    day: state.day,
  });
}

function daySix(allocation = "allocate30"): ResearchState {
  let state = createResearch(`boundary-${allocation}`);
  for (const option of ["return", "quality", "trend", "keep", allocation]) {
    state = proceed(choose(arrive(state), option));
  }
  assert.equal(state.day, 6);
  return state;
}

test("只有落点才能选择，重复标识与旧日动作不改变状态，继续不发收入", () => {
  const start = createResearch("campaign-test");
  assert.equal(
    dispatchResearch(start, {
      type: "choose",
      id: "too-early",
      day: 1,
      optionId: "return",
    }),
    start,
  );
  const arrived = dispatchResearch(start, {
    type: "arrive",
    id: "arrive",
    day: 1,
    location: "bakery",
  });
  assert.equal(arrived.phase, "decision");
  const chosen = dispatchResearch(arrived, {
    type: "choose",
    id: "choice",
    day: 1,
    optionId: "return",
  });
  assert.equal(chosen.phase, "feedback");
  assert.equal(chosen.intent, "return");
  assert.equal(chosen.evidence.length, 1);
  assert.equal(
    dispatchResearch(chosen, {
      type: "choose",
      id: "choice",
      day: 1,
      optionId: "risk",
    }),
    chosen,
  );
  const next = dispatchResearch(chosen, {
    type: "continue",
    id: "next",
    day: 1,
  });
  assert.equal(next.day, 2);
  assert.equal(next.phase, "travel");
  assert.equal(next.runs.length, 0);
  assert.equal(
    dispatchResearch(next, {
      type: "arrive",
      id: "stale",
      day: 1,
      location: "bank",
    }),
    next,
  );
  assert.equal(start.phase, "travel");
  assert.equal(start.processed.length, 0);
});

test("已检验策略改费用后旧检验保留，查看不能把旧数据重新标为未见", () => {
  const checked = choose(arrive(daySix()), "validate");
  assert.equal(checked.validation, "checked");
  const original = structuredClone(checked);
  const validation = checked.runs.find(
    (run) => run.config.segment === "validation",
  )!;
  assert.equal(validation.config.feeBps, 0);

  const changed = choose(arrive(proceed(checked)), "stress30");
  assert.equal(changed.validation, "needs-new-data");
  assert.equal(changed.strategyVersion, checked.strategyVersion + 1);
  assert.equal(changed.feeBps, 30);
  assert.deepEqual(
    changed.runs.find((run) => run.id === validation.id),
    validation,
  );
  assert.deepEqual(checked, original);
  const newRun = changed.runs.at(-1)!;
  assert.equal(newRun.config.segment, "research");
  assert.equal(newRun.config.feeBps, 30);
  assert.equal(
    changed.evidence.find((record) => record.id === "choose-7")?.config?.feeBps,
    30,
  );

  const viewed = dispatchResearch(changed, {
    type: "inspect",
    id: "view-old-validation",
    day: 7,
    topic: "validation",
  });
  assert.equal(viewed.validation, "needs-new-data");
  assert.deepEqual(viewed.runs, changed.runs);
  assert.deepEqual(viewed.evidence.at(-1)?.runIds, [validation.id]);
  assert.equal(
    dispatchResearch(viewed, {
      type: "inspect",
      id: "repeat-old-validation",
      day: 7,
      topic: "validation",
    }),
    viewed,
  );
});

test("暂缓检验后可按当前费用补验一次，跨日查看也不重复揭晓", () => {
  const deferred = choose(arrive(daySix()), "defer");
  assert.equal(deferred.validation, "deferred");
  assert.ok(deferred.runs.every((run) => run.config.segment === "research"));
  const changed = choose(arrive(proceed(deferred)), "fees10");
  assert.equal(changed.validation, "deferred");
  const checked = dispatchResearch(changed, {
    type: "inspect",
    id: "late-validation",
    day: 7,
    topic: "validation",
  });
  assert.equal(checked.validation, "checked");
  const validations = checked.runs.filter(
    (run) => run.config.segment === "validation",
  );
  assert.equal(validations.length, 1);
  assert.equal(validations[0]!.config.feeBps, 10);
  assert.equal(validations[0]!.config.initialCash, 1000);
  assert.equal(validations[0]!.points.length, 61);
  assert.equal(
    checked.evidence.find((record) => record.id === "choose-6")?.choice,
    "defer",
  );
  assert.deepEqual(
    checked.evidence.find((record) => record.id === "late-validation:run")
      ?.runIds,
    [validations[0]!.id],
  );
  assert.equal(
    dispatchResearch(checked, {
      type: "inspect",
      id: "repeat-late-validation",
      day: 7,
      topic: "validation",
    }),
    checked,
  );
  const finalDay = arrive(proceed(checked));
  const viewed = dispatchResearch(finalDay, {
    type: "inspect",
    id: "day-eight-validation",
    day: 8,
    topic: "validation",
  });
  assert.deepEqual(viewed.runs, checked.runs);
  assert.equal(viewed.validation, "checked");
});

test("全现金并暂缓检验仍保持1000平线，三种最终决定都完成展会和画像", () => {
  const deferred = choose(arrive(daySix("cash")), "defer");
  const finalDay = arrive(proceed(choose(arrive(proceed(deferred)), "fees10")));
  assert.equal(finalDay.validation, "deferred");
  assert.ok(finalDay.runs.every((run) => run.config.segment === "research"));
  const cashRuns = finalDay.runs.filter((run) => run.config.allocation === 0);
  assert.equal(cashRuns.length, 2);
  for (const run of cashRuns) {
    assert.equal(run.points.length, 121);
    assert.ok(
      run.points.every((point) => point.equity === 1000 && point.cash === 1000),
    );
    assert.equal(run.metrics.finalEquity, 1000);
    assert.equal(run.metrics.netReturn, 0);
    assert.equal(run.metrics.fees, 0);
    assert.equal(run.metrics.tradeCount, 0);
    assert.equal(run.trades.length, 0);
  }
  for (const decision of ["simulate", "revise", "defer"] as const) {
    const exhibition = proceed(choose(finalDay, decision));
    assert.equal(exhibition.phase, "exhibit");
    assert.equal(exhibition.location, "cafe");
    assert.equal(exhibition.finalDecision, decision);
    const report = dispatchResearch(exhibition, {
      type: "report",
      id: "open-report",
      day: 8,
    });
    assert.equal(report.phase, "report");
    assert.equal(report.validation, "deferred");
    assert.deepEqual(report.runs, finalDay.runs);
  }
});

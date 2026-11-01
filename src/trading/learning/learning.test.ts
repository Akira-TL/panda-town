import assert from "node:assert/strict";
import test from "node:test";
import { createTradingGame, dispatchTrading } from "../engine";
import type { CandlePoint } from "../market";
import type { TradingGame } from "../model";
import { evaluateEntry, evaluateEntryOnCandles, evaluateRule } from "./rules";
import { createLearningState, recordLearningAction } from "./state";
import { getKnowledgePrompt } from "./knowledge";
import { buildLearningSummary } from "./summary";
import type { TradingRule } from "./types";

function candles(values: readonly number[]): CandlePoint[] {
  return values.map((close, index) => ({
    index,
    date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
    open: close,
    close,
    high: close,
    low: close,
    volume: 100,
  }));
}
function shop(): TradingGame {
  const moving = dispatchTrading(createTradingGame("learning-test"), {
    type: "start-round",
    id: "round:1",
  });
  return dispatchTrading(moving, {
    type: "arrive",
    id: "arrival:1",
    location: "bakery",
  });
}
const rule: TradingRule = { entry: "ema", allocation: 0.5, exit: "manual" };

test("独立可手算价格验证上穿、突破、六指标条件及不足边界", () => {
  const level = Array.from({ length: 34 }, () => 10);
  const jumped = candles([...level, 11]);
  for (const entry of [
    "ma_cross_up",
    "breakout20",
    "ema",
    "macd",
    "kdj",
    "boll",
  ] as const) {
    assert.equal(evaluateEntryOnCandles(entry, jumped).triggered, true, entry);
  }
  // 14个单位下跌后一次上涨14，RSI从0变为51.85，真实上穿30。
  const rsi = candles([
    ...Array.from({ length: 15 }, (_, index) => 30 - index),
    30,
  ]);
  assert.equal(evaluateEntryOnCandles("rsi", rsi).triggered, true);
  const range = candles(Array.from({ length: 14 }, () => 10)).map((point) => ({
    ...point,
    high: 10.5,
    low: 9.5,
  }));
  assert.equal(evaluateEntryOnCandles("atr", range).triggered, true);
  assert.match(evaluateEntryOnCandles("atr", range).reason, /不预测方向/);
  assert.equal(evaluateEntryOnCandles("atr", candles(level)).triggered, false);
  assert.equal(evaluateEntryOnCandles("manual", jumped).triggered, null);
  assert.equal(
    evaluateEntryOnCandles("macd", candles(level.slice(0, 33))).triggered,
    null,
  );
  assert.equal(
    evaluateEntryOnCandles("ma_cross_up", candles(level.slice(0, 21)))
      .triggered,
    null,
  );
  assert.equal(evaluateEntryOnCandles("ema", candles(level)).triggered, false);
});

test("含费成本退出与手动条件分开，不把空仓或资料不足假作已触发", () => {
  const game = shop();
  const loss: TradingRule = { entry: "manual", allocation: 0.5, exit: "loss5" };
  assert.equal(evaluateRule(game, loss, "bread").exit, false);
  // 当天已独立核验的面包价格113.4306，低于120×95%=114。
  game.holdings.bread = { quantity: 1, costBasis: 120 };
  const evaluated = evaluateRule(game, loss, "bread");
  assert.equal(evaluated.exit, true);
  assert.equal(evaluated.entry, null);
  assert.equal(evaluateRule(game, rule, "bread").exit, null);
});

test("规则采用、指标查看和点选分开，同主题重复不增证据且不改账户", () => {
  const game = shop(),
    before = structuredClone(game);
  let state = createLearningState(game.sessionId);
  state = recordLearningAction(state, game, {
    type: "indicator",
    id: "view",
    indicator: "macd",
    interaction: "view",
    index: game.marketIndex,
    product: "bread",
  });
  assert.equal(state.rule, null);
  const repeated = recordLearningAction(state, game, {
    type: "indicator",
    id: "repeat",
    indicator: "macd",
    interaction: "view",
    index: game.marketIndex - 1,
    product: "bread",
  });
  assert.equal(repeated, state);
  const future = recordLearningAction(state, game, {
    type: "indicator",
    id: "future",
    indicator: "macd",
    interaction: "mark",
    index: game.marketIndex + 1,
    product: "bread",
  });
  assert.equal(future, state);
  state = recordLearningAction(state, game, {
    type: "set-rule",
    id: "adopt",
    rule,
    product: "bread",
  });
  assert.deepEqual(state.rule, rule);
  assert.equal(state.events[0]!.kind, "indicator");
  assert.equal(state.events[1]!.kind, "rule");
  assert.equal(
    recordLearningAction(state, game, {
      type: "set-rule",
      id: "same",
      rule,
      product: "bread",
    }),
    state,
  );
  assert.deepEqual(game, before);
  const summary = buildLearningSummary(game, state);
  assert.equal(summary.knowledge.answered, 0);
  assert.match(summary.facts.join(""), /未观察/);
});

test("K线数值题无预先正误提示，首次答案冻结；跳过不计错误", () => {
  const game = shop(),
    initial = createLearningState(game.sessionId);
  const prompt = getKnowledgePrompt(game, initial, "bread")!;
  assert.equal(prompt.kind, "candle");
  assert.equal(prompt.index, 20);
  assert.ok(
    prompt.options.every((option) => !/[✓✕勾叉正确错误]/.test(option.label)),
  );
  // 索引20的开盘在选项a；先选b后改a不能覆盖第一次判断。
  const answered = recordLearningAction(initial, game, {
    type: "answer",
    id: "wrong",
    promptId: prompt.id,
    answerId: "b",
    product: "bread",
  });
  const event = answered.events[0]!;
  assert.equal(event.kind, "knowledge");
  if (event.kind === "knowledge") assert.equal(event.correct, false);
  assert.equal(
    recordLearningAction(answered, game, {
      type: "answer",
      id: "retry",
      promptId: prompt.id,
      answerId: "a",
      product: "bread",
    }),
    answered,
  );
  const skipped = recordLearningAction(initial, game, {
    type: "answer",
    id: "skip",
    promptId: prompt.id,
    answerId: null,
    product: "bread",
  });
  const summary = buildLearningSummary(game, skipped);
  assert.deepEqual(summary.knowledge, {
    answered: 0,
    correct: 0,
    skipped: 1,
    transferCorrect: 0,
  });
});

test("规则客观互动必须先明确采用，再到新商品或日期，知识结果不使用收益", () => {
  const game = shop();
  let state = createLearningState(game.sessionId);
  const candle = getKnowledgePrompt(game, state, "bread")!;
  state = recordLearningAction(state, game, {
    type: "answer",
    id: "skip-candle",
    promptId: candle.id,
    answerId: null,
    product: "bread",
  });
  assert.equal(getKnowledgePrompt(game, state, "bread"), null);
  state = recordLearningAction(state, game, {
    type: "set-rule",
    id: "adopt-rule",
    rule,
    product: "bread",
  });
  assert.equal(getKnowledgePrompt(game, state, "bread"), null);
  const transferred = getKnowledgePrompt(game, state, "timber")!;
  assert.equal(transferred.kind, "rule");
  assert.equal(transferred.transfer, true);
  assert.equal(transferred.ruleEventId, "adopt-rule");
  const expected = evaluateEntry(
    rule.entry,
    "timber",
    game.marketIndex,
  ).triggered;
  state = recordLearningAction(state, game, {
    type: "answer",
    id: "new-context",
    promptId: transferred.id,
    answerId: expected ? "yes" : "no",
    product: "timber",
  });
  const summary = buildLearningSummary(game, state);
  assert.equal(summary.knowledge.answered, 1);
  assert.equal(summary.knowledge.transferCorrect, 1);
  assert.equal(getKnowledgePrompt(game, state, "timber"), null);
  assert.match(summary.copyText, /游戏映射/);
  assert.match(summary.copyText, /尚未由PandaAI验证/);
});

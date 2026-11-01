import { getAccountSnapshot } from "../engine";
import { getQuote } from "../market";
import type { TradingGame } from "../model";
import { buildOpponent, calculateMaximumDrawdown, replayAccount } from "./accounts";
import { getRuleLabel } from "./rules";
import { createLearningState } from "./state";
import type { LearningState, LearningSummary } from "./types";

export function buildLearningSummary(game: TradingGame, learning: LearningState): LearningSummary {
  const state =
    learning.sessionId === game.sessionId ? learning : createLearningState(game.sessionId);
  const player = replayAccount(game),
    opponent = buildOpponent(game);
  const maximumDrawdown = calculateMaximumDrawdown(player.curve.map((point) => point.equity));
  const snapshot = getAccountSnapshot(game);
  const answers = state.events.filter((event) => event.kind === "knowledge");
  const knowledge = {
    answered: answers.filter((event) => event.answerId !== null && event.correct !== null).length,
    correct: answers.filter((event) => event.correct === true).length,
    skipped: answers.filter((event) => event.answerId === null).length,
    transferCorrect: answers.filter((event) => event.correct === true && event.prompt.transfer)
      .length,
  };
  const viewed = state.events.filter((event) => event.kind === "indicator");
  const indicatorCount = new Set(viewed.map((event) => event.indicator)).size;
  const adopted = state.events.filter((event) => event.kind === "rule");
  const facts = [`实际成交${game.trades.length}笔，费用${snapshot.fees.toFixed(2)}枚小镇币`];
  if (indicatorCount) facts.push(`主动查看或点选${indicatorCount}种指标；查看不等于采用或掌握`);
  if (knowledge.answered)
    facts.push(
      `客观互动已答${knowledge.answered}次、答对${knowledge.correct}次，` +
        `其中新情境答对${knowledge.transferCorrect}次；仅描述这些情境`,
    );
  else
    facts.push(
      knowledge.skipped
        ? `跳过${knowledge.skipped}次互动，不计为答错`
        : "还没有客观互动答案，知识保持未观察",
    );
  const roseThenFell = game.trades.some((trade) => {
    if (
      trade.side !== "buy" ||
      trade.marketIndex >= game.marketIndex ||
      trade.price <= getQuote(trade.product, trade.marketIndex - 1).close
    )
      return false;
    for (let index = trade.marketIndex + 1; index <= game.marketIndex; index++)
      if (getQuote(trade.product, index).close < trade.price) return true;
    return false;
  });
  const question = roseThenFell
    ? "为什么跟着上涨买，也会遇到回落？"
    : adopted.length >= 3
      ? "固定一套条件后，会有什么不同？"
      : game.trades.length >= 4 && snapshot.fees > 0
        ? "少交易几次，费用与结果会怎样变化？"
        : state.rule
          ? "换一段没看过的行情，这条规则还有效吗？"
          : game.trades.length === 0
            ? "如果先固定一条规则，会发生什么？"
            : "怎样把自己的买卖写成可回测的固定条件？";
  const ruleLabel = getRuleLabel(state.rule);
  const copyText = [
    `我完成了Panda Town纸上模拟。我的办法：${ruleLabel}。`,
    `实际总资产${snapshot.totalAssets.toFixed(2)}、盈亏${snapshot.netProfit.toFixed(2)}、` +
      `费用${snapshot.fees.toFixed(2)}枚小镇币；从已观察账户估值计算的最大回撤${(maximumDrawdown * 100).toFixed(2)}%。`,
    `实际成交${game.trades.length}笔；客观互动已答${knowledge.answered}次、答对${knowledge.correct}次、` +
      `新情境答对${knowledge.transferCorrect}次，未答不记错。`,
    `我想研究：${question}`,
    state.rule
      ? "请把明确选择的办法写成可回测规则，计入费用，与买入持有比较并解释局限。"
      : "我还没有明确规则，请先协助定义入场、投入和退出条件，再进行回测比较。",
    "小镇商品只是历史金融产品的游戏映射，不是真实证券代码；这些是游戏记录，尚未由PandaAI验证，不是真实投资资料。",
  ].join("\n");
  return {
    ruleLabel,
    facts,
    question,
    copyText,
    maximumDrawdown,
    equityCurve: player.curve,
    opponentCurve: opponent.curve,
    opponent: opponent.summary,
    knowledge,
  };
}

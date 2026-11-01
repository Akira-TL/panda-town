import { getVisibleCandles, getQuote } from "../market";
import type { ProductId, TradingGame } from "../model";
import { evaluateEntry } from "./rules";
import type { KnowledgePrompt, LearningState } from "./types";

export function getKnowledgePrompt(
  game: TradingGame,
  state: LearningState,
  product: ProductId,
): KnowledgePrompt | null {
  if (
    state.sessionId !== game.sessionId ||
    !(game.phase === "decision" || game.phase === "feedback")
  )
    return null;
  const answeredCandle = state.events.some(
    (event) => event.kind === "knowledge" && event.prompt.kind === "candle",
  );
  if (!answeredCandle) {
    const candle = [...getVisibleCandles(product, game.marketIndex)]
      .reverse()
      .find((point) => point.open !== point.close);
    if (!candle) return null;
    let open = Number(candle.open.toPrecision(10)).toString();
    let close = Number(candle.close.toPrecision(10)).toString();
    if (open === close) {
      open = String(candle.open);
      close = String(candle.close);
    }
    const labels = candle.index % 2 ? [close, open] : [open, close];
    return {
      kind: "candle",
      id: `candle:${product}:${candle.index}`,
      title: "帮店员挂价牌：这根K线的开盘价是？",
      options: labels.map((label, index) => ({
        id: index === 0 ? "a" : "b",
        label,
      })),
      product,
      index: candle.index,
      rule: null,
      ruleEventId: null,
      transfer: false,
    };
  }
  const adopted = [...state.events]
    .reverse()
    .find((event) => event.kind === "rule");
  if (
    !adopted ||
    adopted.kind !== "rule" ||
    adopted.rule.entry === "manual" ||
    state.events.some(
      (event) =>
        event.kind === "knowledge" && event.prompt.ruleEventId === adopted.id,
    ) ||
    (adopted.product === product && adopted.marketIndex === game.marketIndex)
  )
    return null;
  if (
    evaluateEntry(adopted.rule.entry, product, game.marketIndex).triggered ===
    null
  )
    return null;
  return {
    kind: "rule",
    id: `rule:${adopted.id}:${product}:${game.marketIndex}`,
    title: "帮学徒判断：当前满足你选定的入场条件吗？",
    options: [
      { id: "yes", label: "已满足" },
      { id: "no", label: "未满足" },
    ],
    product,
    index: game.marketIndex,
    rule: { ...adopted.rule },
    ruleEventId: adopted.id,
    transfer: true,
  };
}

/** 答案在提交后由真实数据重新核对；不接收界面传入的correct。 */
export function resolveKnowledgeAnswer(
  prompt: KnowledgePrompt,
  answerId: string | null,
): {
  correct: boolean | null;
  explanation: string;
} {
  if (answerId === null)
    return { correct: null, explanation: "本次跳过，不算答错，也不推断已掌握" };
  if (prompt.kind === "candle") {
    const quote = getQuote(prompt.product, prompt.index);
    const expectedId = prompt.index % 2 ? "b" : "a";
    return {
      correct: answerId === expectedId,
      explanation: `该日开盘${quote.open.toFixed(4)}，收盘${quote.close.toFixed(4)}；实体两端对应开收盘，影线另示高低价`,
    };
  }
  const signal = prompt.rule
    ? evaluateEntry(prompt.rule.entry, prompt.product, prompt.index)
    : null;
  if (signal?.triggered == null)
    return { correct: null, explanation: "本情境不足以判断，未计入正确或错误" };
  return {
    correct: answerId === (signal.triggered ? "yes" : "no"),
    explanation: signal.reason,
  };
}

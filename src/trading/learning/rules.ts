import { getIndicatorSeries } from "../indicators";
import { getVisibleCandles } from "../market";
import type { CandlePoint } from "../market";
import type { ProductId, TradingGame } from "../model";
import { INDICATOR_IDS } from "./types";
import type {
  EntryRule,
  ExitRule,
  IndicatorId,
  RuleEvaluation,
  TradingRule,
} from "./types";

export const ENTRY_RULES: readonly EntryRule[] = [
  "manual",
  "ma_cross_up",
  "breakout20",
  ...INDICATOR_IDS,
];
export const EXIT_RULES: readonly ExitRule[] = [
  "manual",
  "ma_cross_down",
  "loss5",
];
export const ENTRY_LABELS: Record<EntryRule, string> = {
  manual: "手动决定买入",
  ma_cross_up: "收盘上穿此前20期均价买入",
  breakout20: "收盘高于此前20根最高价买入",
  ema: "收盘上穿12期指数均线买入",
  macd: "MACD差值线上穿信号线买入",
  rsi: "RSI上穿30买入",
  kdj: "KDJ的K上穿D买入",
  boll: "收盘上穿布林带中轨买入",
  atr: "ATR占收盘价达到3%时关注波动",
};
export const EXIT_LABELS: Record<ExitRule, string> = {
  manual: "手动决定退出",
  ma_cross_down: "收盘跌回此前20期均价退出",
  loss5: "低于含费均价5%时退出",
};
export function getRuleLabel(rule: TradingRule | null): string {
  return rule
    ? `${ENTRY_LABELS[rule.entry]}；目标上限${rule.allocation * 100}%；${EXIT_LABELS[rule.exit]}`
    : "本局手动交易";
}
export function validRule(value: unknown): value is TradingRule {
  if (typeof value !== "object" || value === null) return false;
  const rule = value as Partial<TradingRule>;
  return (
    ENTRY_RULES.some((entry) => entry === rule.entry) &&
    EXIT_RULES.some((exit) => exit === rule.exit) &&
    [0.25, 0.5, 0.75].some((value) => value === rule.allocation)
  );
}
export interface EntrySignal {
  triggered: boolean | null;
  reason: string;
}

/** 只取截至指定点的真实前缀，供规则、图上标记、客观互动共用。 */
export function evaluateEntry(
  entry: EntryRule,
  product: ProductId,
  index: number,
): EntrySignal {
  return evaluateEntryOnCandles(entry, getVisibleCandles(product, index));
}

/** 独立已知行情计算入口，便于用可手算的价格序列核对触发条件。 */
export function evaluateEntryOnCandles(
  entry: EntryRule,
  candles: readonly CandlePoint[],
): EntrySignal {
  if (entry === "manual")
    return { triggered: null, reason: "手动决定没有可自动判定的入场条件" };
  if (!candles.length)
    return { triggered: null, reason: "已知历史不足以判断本条件" };
  const points = getIndicatorSeries(candles);
  const current = points.at(-1)!,
    previous = points.at(-2);
  const candle = candles.at(-1)!,
    prior = candles.at(-2);
  const insufficient = { triggered: null, reason: "已知历史不足以判断本条件" };
  function cross(
    oldFast: number | null | undefined,
    oldSlow: number | null | undefined,
    fast: number | null,
    slow: number | null,
  ): EntrySignal {
    if (oldFast == null || oldSlow == null || fast === null || slow === null)
      return insufficient;
    const triggered = oldFast <= oldSlow && fast > slow;
    return {
      triggered,
      reason: triggered
        ? "当前已发生上穿；这不保证后续上涨"
        : "当前没有发生所选上穿",
    };
  }
  switch (entry) {
    case "ma_cross_up":
      return cross(prior?.close, previous?.ma20, candle.close, current.ma20);
    case "breakout20":
      return current.priorHigh20 === null
        ? insufficient
        : {
            triggered: candle.close > current.priorHigh20,
            reason: `收盘${candle.close.toFixed(2)}与此前20根最高${current.priorHigh20.toFixed(2)}比较，参考不含当期`,
          };
    case "ema":
      return cross(prior?.close, previous?.ema, candle.close, current.ema);
    case "macd":
      return cross(
        previous?.macd?.dif,
        previous?.macd?.dea,
        current.macd?.dif ?? null,
        current.macd?.dea ?? null,
      );
    case "rsi":
      return cross(previous?.rsi, 30, current.rsi, 30);
    case "kdj":
      return cross(
        previous?.kdj?.k,
        previous?.kdj?.d,
        current.kdj?.k ?? null,
        current.kdj?.d ?? null,
      );
    case "boll":
      return cross(
        prior?.close,
        previous?.boll?.middle,
        candle.close,
        current.boll?.middle ?? null,
      );
    case "atr":
      return current.atr === null
        ? insufficient
        : {
            triggered: current.atr / candle.close >= 0.03,
            reason: `ATR/收盘为${((current.atr / candle.close) * 100).toFixed(2)}%，阈值3%；仅表示波动条件，不预测方向`,
          };
  }
}
export function getIndicatorSignal(
  indicator: IndicatorId,
  product: ProductId,
  index: number,
): EntrySignal {
  return evaluateEntry(indicator, product, index);
}
export function evaluateRule(
  game: TradingGame,
  rule: TradingRule,
  product: ProductId,
): RuleEvaluation {
  const entry = evaluateEntry(rule.entry, product, game.marketIndex);
  let exit: boolean | null = null;
  let reason = "手动退出没有自动条件";
  if (rule.exit === "loss5") {
    const holding = game.holdings[product];
    const close = getVisibleCandles(product, game.marketIndex).at(-1)!.close;
    exit =
      holding.quantity > 0 &&
      close <= (holding.costBasis / holding.quantity) * 0.95;
    reason =
      holding.quantity > 0
        ? "当前收盘与含费持仓均价的95%比较；成交仍需手动确认"
        : "当前没有该商品持仓";
  } else if (rule.exit === "ma_cross_down") {
    const candles = getVisibleCandles(product, game.marketIndex);
    const points = getIndicatorSeries(candles);
    const previous = points.at(-2),
      current = points.at(-1)!;
    const priorClose = candles.at(-2)?.close;
    if (
      priorClose !== undefined &&
      previous?.ma20 != null &&
      current.ma20 !== null
    ) {
      exit =
        priorClose >= previous.ma20 && candles.at(-1)!.close < current.ma20;
      reason = exit
        ? "收盘已下穿各自时点的此前20期均价"
        : "当前没有发生所选下穿";
    } else reason = "已知历史不足以判断下穿";
  }
  return {
    entry: entry.triggered,
    exit,
    label: getRuleLabel(rule),
    reason: `${entry.reason}；退出：${reason}`,
  };
}

import { getIndicatorSeries } from "../indicators";
import { getVisibleCandles } from "../market";
import type { ProductId, TradingGame } from "../model";
import { getAccountSnapshot } from "../engine";
import { money, signed } from "./format";
import type { EntryRule, ExitRule } from "../learning";

export const SHORT_ENTRY_LABELS: Record<EntryRule, string> = {
  manual: "手动买入",
  ma_cross_up: "上穿前均价",
  breakout20: "突破前高",
  ema: "上穿EMA12",
  macd: "MACD上穿",
  rsi: "RSI穿30",
  kdj: "K上穿D",
  boll: "穿布林中轨",
  atr: "ATR/价≥3%",
};
export const SHORT_EXIT_LABELS: Record<ExitRule, string> = {
  manual: "手动退出",
  ma_cross_down: "跌回前均价",
  loss5: "亏至5%退出",
};

export const SHOP_LESSONS: Record<
  ProductId,
  { title: string; action: string }
> = {
  bread: { title: "先看价格，再进货", action: "挂价牌" },
  timber: { title: "给买卖加个条件", action: "选规则" },
  fruit: { title: "涨跌，也看成交量", action: "看量价" },
  chips: { title: "现价，离成本多远？", action: "看盈亏" },
  gold: { title: "这次，投入多少？", action: "选仓位" },
  flowers: { title: "等待，也是一种选择", action: "看费用" },
  coffee: { title: "同样行情，不同决定", action: "看对照" },
  tea: { title: "你的规则，触发了吗？", action: "小互动" },
};

/** 情境只描述当前已知事实，不用预设剧情制造突破、亏损或放量。 */
export function getShopFact(game: TradingGame, product: ProductId): string {
  const candles = getVisibleCandles(product, game.marketIndex);
  const current = candles.at(-1)!;
  const indicator = getIndicatorSeries(candles).at(-1)!;
  if (product === "fruit") {
    return indicator.volumeRatio5 === null
      ? "量比：此前5期不足"
      : `量比 ${money(indicator.volumeRatio5)}倍 · 对比此前5期`;
  }
  if (product === "chips") {
    return indicator.priorHigh20 === null
      ? "此前高点：历史不足"
      : `此前20根最高 ${money(indicator.priorHigh20)} · ${current.close > indicator.priorHigh20 ? "已突破" : "尚未突破"}`;
  }
  if (product === "flowers") {
    return `成交 ${game.trades.length}笔 · 累计费用 ${money(getAccountSnapshot(game).fees)}`;
  }
  const previous = candles.at(-2)?.close;
  return previous === undefined
    ? "日线 · 每根一天"
    : `日涨跌 ${signed(((current.close - previous) / previous) * 100)}% · 每根一天`;
}

/** 预算是本次可用现金比例；仍须由previewTrade约束成交量、费用与实际份数。 */
export function getBudgetQuantity(
  game: TradingGame,
  price: number,
  fraction: number,
): number {
  return (
    Math.floor(
      ((game.cash * fraction) / (price * (1 + game.feeBps / 10_000))) *
        1_000_000,
    ) / 1_000_000
  );
}

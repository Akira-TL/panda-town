import { getResearchData, getSimulationInput } from "../data";
import type { AssetId, MarketBar, SimulationResult, Trade } from "../model";

export interface PriceWindow {
  bars: MarketBar[];
  warmup: MarketBar[];
  trades: readonly Trade[];
  segment: "research" | "validation";
  runId: string | null;
}
export interface PricePoint {
  date: string;
  close: number;
  previousClose: number | null;
  change: number | null;
  ma5: number | null;
  ma20: number | null;
  crossing: "above" | "below" | null;
}

/** 未匹配实际完成的运行时，只取得公开研究段，不提前调用检验段入口。 */
export function selectPriceWindow(
  runs: readonly SimulationResult[],
  runId?: string,
): PriceWindow {
  const run = runs.find((candidate) => candidate.id === runId);
  if (!run)
    return {
      bars: getResearchData(),
      warmup: getSimulationInput("research").warmup,
      trades: [],
      segment: "research",
      runId: null,
    };
  const input = getSimulationInput(run.config.segment);
  const before = input.bars.filter((bar) => bar.date < run.startDate);
  return {
    bars: input.bars.filter(
      (bar) => bar.date >= run.startDate && bar.date <= run.endDate,
    ),
    warmup: [...input.warmup, ...before].slice(-20),
    trades: run.trades,
    segment: run.config.segment,
    runId: run.id,
  };
}

/** 均线只用当前日期之前的收盘价；不把今天或后来的价格放进信号。 */
export function buildPriceSeries(
  bars: readonly MarketBar[],
  warmup: readonly MarketBar[],
  asset: AssetId,
): PricePoint[] {
  const history = warmup.map((bar) => bar[asset].close);
  const mean = (count: number, end = history.length): number | null =>
    end < count
      ? null
      : history.slice(end - count, end).reduce((sum, value) => sum + value, 0) /
        count;
  return bars.map((bar) => {
    const close = bar[asset].close;
    const previousClose = history.at(-1) ?? null;
    const ma5 = mean(5),
      ma20 = mean(20);
    const previousMa20 = mean(20, history.length - 1);
    let crossing: PricePoint["crossing"] = null;
    if (previousClose !== null && ma20 !== null && previousMa20 !== null) {
      if (previousClose >= previousMa20 && close < ma20) crossing = "below";
      else if (previousClose <= previousMa20 && close > ma20)
        crossing = "above";
    }
    history.push(close);
    return {
      date: bar.date,
      close,
      previousClose,
      change: previousClose === null ? null : close - previousClose,
      ma5,
      ma20,
      crossing,
    };
  });
}

/** 播放帧的线、纵轴范围及成交点都由已显示前缀产生，不用CSS遮住完整未来曲线。 */
export function visiblePriceFrame(
  series: readonly PricePoint[],
  count: number,
  trades: readonly Trade[],
  asset: AssetId,
) {
  const safeCount = Math.max(0, Math.min(series.length, Math.floor(count)));
  const points = series.slice(0, safeCount);
  const first = points[0],
    current = points.at(-1);
  const visibleTrades =
    first && current
      ? trades.filter(
          (trade) =>
            trade.asset === asset &&
            trade.date >= first.date &&
            trade.date <= current.date,
        )
      : [];
  const values = points
    .flatMap((point) => [point.close, point.ma5, point.ma20])
    .filter((value): value is number => value !== null);
  values.push(...visibleTrades.map((trade) => trade.price));
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const padding = Math.max(0.1, (high - low) * 0.1);
  return {
    points,
    current,
    trades: visibleTrades,
    min: low - padding,
    max: high + padding,
  };
}

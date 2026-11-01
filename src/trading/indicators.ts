import type { CandlePoint } from "./market";

export interface MacdValue {
  dif: number;
  dea: number;
  /** DIF-DEA，不采用部分终端的乘2柱体。 */
  histogram: number;
}
export interface KdjValue {
  k: number;
  d: number;
  j: number;
}
export interface BollValue {
  middle: number;
  upper: number;
  lower: number;
}
export interface IndicatorPoint {
  index: number;
  date: string;
  ema: number | null;
  macd: MacdValue | null;
  rsi: number | null;
  kdj: KdjValue | null;
  boll: BollValue | null;
  atr: number | null;
  /** 此前20个收盘均价，排除当期，保持既有市场口径。 */
  ma20: number | null;
  /** 此前20根最高价的最大值，排除当期。 */
  priorHigh20: number | null;
  /** 当期数量/此前5期均量；此前均量为0或不足返回null。 */
  volumeRatio5: number | null;
}
export interface IndicatorOptions {
  emaPeriod?: number;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 首个有效窗口以简单平均初始化；不足窗口不从首价伪造历史。 */
function emaSeries(
  values: readonly (number | null)[],
  period: number,
): Array<number | null> {
  let previous: number | null = null;
  let count = 0;
  let seed = 0;
  const alpha = 2 / (period + 1);
  return values.map((value) => {
    if (value === null) {
      previous = null;
      count = 0;
      seed = 0;
      return null;
    }
    if (previous !== null) {
      previous += alpha * (value - previous);
      return previous;
    }
    count++;
    seed += value;
    if (count < period) return null;
    previous = seed / period;
    return previous;
  });
}

function rsiSeries(candles: readonly CandlePoint[]): Array<number | null> {
  let gain = 0;
  let loss = 0;
  return candles.map((candle, index) => {
    if (!index) return null;
    const delta = candle.close - candles[index - 1]!.close;
    const up = Math.max(0, delta),
      down = Math.max(0, -delta);
    if (index <= 14) {
      gain += up;
      loss += down;
    } else {
      gain = (gain * 13 + up) / 14;
      loss = (loss * 13 + down) / 14;
    }
    if (index < 14) return null;
    if (index === 14) {
      gain /= 14;
      loss /= 14;
    }
    // 两者都为0时公式为0/0，本项目明确显示中性50，不声称为唯一行业约定。
    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;
    if (gain === 0) return 0;
    return 100 - 100 / (1 + gain / loss);
  });
}

function atrSeries(candles: readonly CandlePoint[]): Array<number | null> {
  let seed = 0;
  let previous: number | null = null;
  return candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close;
    const tr =
      previousClose === undefined
        ? candle.high - candle.low
        : Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - previousClose),
            Math.abs(candle.low - previousClose),
          );
    if (previous !== null) {
      previous = (previous * 13 + tr) / 14;
      return previous;
    }
    seed += tr;
    if (index < 13) return null;
    previous = seed / 14;
    return previous;
  });
}

function kdjSeries(candles: readonly CandlePoint[]): Array<KdjValue | null> {
  let k = 50,
    d = 50;
  return candles.map((candle, index) => {
    if (index < 8) return null;
    const window = candles.slice(index - 8, index + 1);
    const high = Math.max(...window.map((item) => item.high));
    const low = Math.min(...window.map((item) => item.low));
    // 零区间没有可辨位置，明确采用RSV=50的项目边界规则。
    const rsv = high === low ? 50 : ((candle.close - low) / (high - low)) * 100;
    k = (k * 2) / 3 + rsv / 3;
    d = (d * 2) / 3 + k / 3;
    return { k, d, j: k * 3 - d * 2 };
  });
}

function bollinger(
  candles: readonly CandlePoint[],
  index: number,
): BollValue | null {
  if (index < 19) return null;
  const values = candles.slice(index - 19, index + 1).map((item) => item.close);
  const middle = mean(values);
  const deviation = Math.sqrt(
    mean(values.map((value) => (value - middle) ** 2)),
  );
  return {
    middle,
    upper: middle + 2 * deviation,
    lower: middle - 2 * deviation,
  };
}

function validate(candles: readonly CandlePoint[]): void {
  candles.forEach((candle, index) => {
    if (
      candle.index !== index ||
      !/^\d{4}-\d{2}-\d{2}$/.test(candle.date) ||
      (index > 0 && candle.date <= candles[index - 1]!.date) ||
      ![
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
      ].every(Number.isFinite) ||
      candle.low <= 0 ||
      candle.volume < 0 ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close)
    ) {
      throw new RangeError(
        "指标输入必须为从索引0起、日期递增、四价有效的已知前缀",
      );
    }
  });
}

/** 只消费调用者给定的已知前缀，不读市场全表，不修改输入；所有窗口只看本点及过去。 */
export function getIndicatorSeries(
  candles: readonly CandlePoint[],
  options: IndicatorOptions = {},
): IndicatorPoint[] {
  const period = options.emaPeriod ?? 12;
  if (!Number.isInteger(period) || period < 2 || period > 200)
    throw new RangeError("指数移动平均周期必须为2至200的整数");
  validate(candles);
  const closes = candles.map((candle) => candle.close);
  const ema = emaSeries(closes, period);
  const fast = emaSeries(closes, 12),
    slow = emaSeries(closes, 26);
  const dif = fast.map((value, index) =>
    value === null || slow[index] === null ? null : value - slow[index]!,
  );
  const dea = emaSeries(dif, 9);
  const rsi = rsiSeries(candles),
    atr = atrSeries(candles),
    kdj = kdjSeries(candles);
  return candles.map((candle, index) => {
    const prior20 = candles.slice(Math.max(0, index - 20), index);
    const volumeMean =
      index >= 5
        ? mean(candles.slice(index - 5, index).map((item) => item.volume))
        : null;
    return {
      index: candle.index,
      date: candle.date,
      ema: ema[index]!,
      macd:
        dif[index] !== null && dea[index] !== null
          ? {
              dif: dif[index]!,
              dea: dea[index]!,
              histogram: dif[index]! - dea[index]!,
            }
          : null,
      rsi: rsi[index]!,
      kdj: kdj[index]!,
      boll: bollinger(candles, index),
      atr: atr[index]!,
      ma20: index >= 20 ? mean(prior20.map((item) => item.close)) : null,
      priorHigh20:
        index >= 20 ? Math.max(...prior20.map((item) => item.high)) : null,
      volumeRatio5:
        volumeMean !== null && volumeMean > 0
          ? candle.volume / volumeMean
          : null,
    };
  });
}

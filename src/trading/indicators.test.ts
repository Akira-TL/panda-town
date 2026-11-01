import assert from "node:assert/strict";
import test from "node:test";
import { getIndicatorSeries } from "./indicators";
import { getVisibleCandles, type CandlePoint } from "./market";
import { PRODUCT_IDS } from "./model";

function near(actual: number | null | undefined, expected: number): void {
  assert.equal(typeof actual, "number");
  assert.ok(Math.abs(actual! - expected) < 1e-9, `${actual}应接近${expected}`);
}
function candles(closes: readonly number[]): CandlePoint[] {
  return closes.map((close, index) => ({
    index,
    date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 10,
  }));
}

test("预热窗口逐项明确，不足时返回null而不是从未来补齐", () => {
  const series = getIndicatorSeries(
    candles(Array.from({ length: 40 }, (_, index) => index + 1)),
  );
  assert.ok(series.slice(0, 11).every((point) => point.ema === null));
  near(series[11]!.ema, 6.5);
  assert.ok(series.slice(0, 33).every((point) => point.macd === null));
  assert.notEqual(series[33]!.macd, null);
  assert.equal(series[13]!.rsi, null);
  near(series[14]!.rsi, 100);
  assert.equal(series[7]!.kdj, null);
  assert.notEqual(series[8]!.kdj, null);
  assert.equal(series[18]!.boll, null);
  assert.notEqual(series[19]!.boll, null);
  assert.equal(series[12]!.atr, null);
  assert.notEqual(series[13]!.atr, null);
  assert.equal(series[19]!.ma20, null);
  near(series[20]!.ma20, 10.5);
});

test("EMA手算：三期简单均价初始化后按1/2权重递推，默认12期没有首价假种子", () => {
  const input = candles([1, 2, 3, 7]);
  const three = getIndicatorSeries(input, { emaPeriod: 3 });
  assert.equal(three[1]!.ema, null);
  near(three[2]!.ema, 2);
  near(three[3]!.ema, 4.5);
  assert.ok(getIndicatorSeries(input).every((point) => point.ema === null));
});

test("MACD手算：线性价格差为7，突升后的DIF/DEA和柱值不乘2", () => {
  const input = candles([
    ...Array.from({ length: 34 }, (_, index) => index + 1),
    100,
  ]);
  const series = getIndicatorSeries(input);
  // 等差价格使12/26期EMA分别滞后5.5/12.5，差恒为7。
  near(series[33]!.macd?.dif, 7);
  near(series[33]!.macd?.dea, 7);
  near(series[33]!.macd?.histogram, 0);
  // 前EMA12=28.5、EMA26=21.5；新收100，手算得DIF=329/27。
  near(series[34]!.macd?.dif, 12.185185185185185);
  near(series[34]!.macd?.dea, 8.037037037037036);
  near(series[34]!.macd?.histogram, 4.148148148148149);
});

test("RSI按14个变动初始化及Wilder递推，连续涨跌和全平边界明确", () => {
  const mixed = [
    100, 101, 102, 103, 104, 105, 106, 107, 106, 105, 104, 103, 102, 101, 100,
    102, 100,
  ];
  const series = getIndicatorSeries(candles(mixed));
  // 前14步各7次涨1/跌1；随后涨2，平滑加权总涨8.5、总跌6.5。
  near(series[14]!.rsi, 50);
  near(series[15]!.rsi, 56.66666666666667);
  near(series[16]!.rsi, 49.55156950672646);
  near(
    getIndicatorSeries(
      candles(Array.from({ length: 20 }, (_, index) => 30 - index)),
    ).at(-1)!.rsi,
    0,
  );
  const flat = getIndicatorSeries(candles(Array(40).fill(10) as number[]));
  near(flat.at(-1)!.rsi, 50);
});

test("KDJ手算9/3/3种子50，J保留超过100，零高低区间返回中性位置", () => {
  const rising = candles(
    Array.from({ length: 12 }, (_, index) => index + 1),
  ).map((candle) => ({ ...candle, high: candle.close, low: candle.close }));
  const series = getIndicatorSeries(rising);
  near(series[8]!.kdj?.k, 66.66666666666667);
  near(series[8]!.kdj?.d, 55.55555555555556);
  near(series[8]!.kdj?.j, 88.88888888888889);
  near(series[9]!.kdj?.j, 107.4074074074074);
  const flat = candles(Array(12).fill(10) as number[]).map((candle) => ({
    ...candle,
    high: 10,
    low: 10,
  }));
  const last = getIndicatorSeries(flat).at(-1)!.kdj!;
  near(last.k, 50);
  near(last.d, 50);
  near(last.j, 50);
});

test("BOLL包含当期20根并用总体标准差，区别于排除当期的既有均线", () => {
  const series = getIndicatorSeries(
    candles([...Array.from({ length: 20 }, (_, index) => index + 1), 1000]),
  );
  // 1至20均值10.5，总体方差33.25；不是除以19的样本方差。
  near(series[19]!.boll?.middle, 10.5);
  near(series[19]!.boll?.upper, 22.032562594670797);
  near(series[19]!.boll?.lower, -1.0325625946707966);
  near(series[20]!.ma20, 10.5);
  near(series[20]!.priorHigh20, 20.5);
  assert.ok(series[20]!.boll!.middle > 50);
});

test("ATR首根用高减低，14期初始化，跳空涨跌均按前收真实波幅计入", () => {
  const input = candles([...Array(14).fill(10), 20, 5] as number[]).map(
    (candle, index) => ({
      ...candle,
      high: index < 14 ? 11 : candle.close + 1,
      low: index < 14 ? 9 : candle.close - 1,
    }),
  );
  const series = getIndicatorSeries(input);
  near(series[13]!.atr, 2);
  // 跳高TR=11，跳低TR=16，独立手算37/14与705/196。
  near(series[14]!.atr, 2.642857142857143);
  near(series[15]!.atr, 3.5969387755102042);
});

test("量比只除以前5期均量，参考前高排除当前突变，零均量显示不足", () => {
  const input = candles(Array(21).fill(10) as number[]).map(
    (candle, index) => ({
      ...candle,
      volume: index < 5 ? index + 1 : 10,
      high: index === 20 ? 1000 : 11,
    }),
  );
  const series = getIndicatorSeries(input);
  assert.equal(series[4]!.volumeRatio5, null);
  near(series[5]!.volumeRatio5, 3.3333333333333335);
  near(series[20]!.priorHigh20, 11);
  const zeros = input.map((candle) => ({ ...candle, volume: 0 }));
  assert.ok(
    getIndicatorSeries(zeros).every((point) => point.volumeRatio5 === null),
  );
});

test("八个真实商品的多个已知前缀结果稳定；修改未来不影响已知指标且输入不变", () => {
  for (const product of PRODUCT_IDS) {
    const input = getVisibleCandles(product, 199);
    const before = structuredClone(input);
    const full = getIndicatorSeries(input);
    for (const index of [
      0, 5, 8, 11, 13, 14, 19, 20, 25, 32, 33, 60, 150, 199,
    ]) {
      assert.deepEqual(
        getIndicatorSeries(input.slice(0, index + 1)),
        full.slice(0, index + 1),
      );
    }
    const futureChanged = input.map((candle, index) =>
      index <= 40
        ? candle
        : {
            ...candle,
            open: candle.open * 10,
            high: candle.high * 10,
            low: candle.low * 10,
            close: candle.close * 10,
            volume: candle.volume * 2,
          },
    );
    assert.deepEqual(
      getIndicatorSeries(futureChanged).slice(0, 41),
      full.slice(0, 41),
    );
    assert.deepEqual(input, before);
  }
});

test("空输入、无效四价、非前缀索引和坏周期不补伪线", () => {
  assert.deepEqual(getIndicatorSeries([]), []);
  const input = candles([10, 11]);
  assert.throws(
    () => getIndicatorSeries([{ ...input[0]!, high: 5 }]),
    RangeError,
  );
  assert.throws(
    () => getIndicatorSeries([{ ...input[0]!, volume: NaN }]),
    RangeError,
  );
  assert.throws(() => getIndicatorSeries([input[1]!]), RangeError);
  for (const emaPeriod of [0, 1, 2.5, 201, NaN])
    assert.throws(() => getIndicatorSeries(input, { emaPeriod }), RangeError);
});

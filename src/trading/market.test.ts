import assert from "node:assert/strict";
import test from "node:test";
import type { ProductId } from "./model";
import {
  getQuote,
  getMarketDate,
  getVisibleSeries,
  getVisibleCandles,
  LAST_MARKET_INDEX,
  START_MARKET_INDEX,
} from "./market";

function closeTo(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12,
  );
}

test("公开报价保留独立抄核的BTC历史值，价格与数量相反缩放", () => {
  // 已核验BTCUSDT 01-01开93576；01-21收106143.82、量45941.02002。
  closeTo(getQuote("bread", 0).open, 100);
  closeTo(getQuote("bread", 20).close, 113.43060186372574);
  closeTo(getQuote("bread", 20).volume, 42989768.8939152);
  assert.equal(getMarketDate(START_MARKET_INDEX), "2025-01-20");
  assert.equal(getMarketDate(LAST_MARKET_INDEX), "2025-07-19");
});

test("公开图表只含已知前缀，均线不使用当期或未来收盘", () => {
  const current = getVisibleSeries("bread", 5);
  assert.equal(current.length, 6);
  assert.equal(current[0]!.previousClose, null);
  assert.equal(current[0]!.change, null);
  assert.equal(current[4]!.ma5, null);
  // 独立CSV前5根收94591.79/96984.79/98174.18/98220.50/98363.61，
  // 十进制均价97266.974，经首开93576归一；不含01-06收盘。
  closeTo(current[5]!.ma5!, 103.94435966487133);
  assert.equal(current[5]!.ma20, null);
  assert.deepEqual(current, getVisibleSeries("bread", 199).slice(0, 6));
  const twenty = getVisibleSeries("bread", 20);
  assert.equal(twenty[19]!.ma20, null);
  // 原CSV前20根收盘的独立十进制均价98040.812；不含01-21收106143.82。
  closeTo(twenty[20]!.ma20!, 104.77132170642045);
});

test("八商品分别保留八份独立CSV的收盘与成交量，不是两条曲线换名", () => {
  // 各自01-01开盘和01-21收盘/量从已核验CSV独立抄核，见来源文档。
  const expected: readonly [ProductId, number, number][] = [
    ["bread", 113.43060186372574, 42989768.8939152],
    ["timber", 99.6932092588487, 18314600.83908114],
    ["fruit", 98.56188862468141, 2066220.3971801],
    ["chips", 132.23284559716867, 14922809.9012267],
    ["gold", 152.32290266845844, 7843160.087672],
    ["flowers", 119.02958579881657, 2563204.83419],
    ["coffee", 117.64873417721519, 14624366.6666],
    ["tea", 133.21678321678322, 2104047.379434],
  ];
  for (const [product, close, volume] of expected) {
    closeTo(getQuote(product, 0).open, 100);
    closeTo(getQuote(product, 20).close, close);
    closeTo(getQuote(product, 20).volume, volume);
    assert.equal(getQuote(product, 199).date, "2025-07-19");
    const dates = getVisibleSeries(product, 199).map((point) => point.date);
    assert.equal(dates.length, 200);
    assert.equal(new Set(dates).size, 200);
  }
});

test("调用者改变返回的报价和图表不会污染后续市场读取", () => {
  const quote = getQuote("bread", 20);
  quote.close = -1;
  const points = getVisibleSeries("bread", 20);
  points[0]!.price = -1;
  points.pop();
  closeTo(getQuote("bread", 20).close, 113.43060186372574);
  assert.equal(getVisibleSeries("bread", 20).length, 21);
  assert.ok(getVisibleSeries("bread", 0)[0]!.price > 0);
});

test("末尾不循环，拒绝未来、负数及非整数索引", () => {
  for (const index of [-1, 200, 0.5, NaN, Infinity]) {
    assert.throws(() => getQuote("bread", index), RangeError);
    assert.throws(() => getMarketDate(index), RangeError);
    assert.throws(() => getVisibleSeries("bread", index), RangeError);
    assert.throws(() => getVisibleCandles("bread", index), RangeError);
  }
  assert.equal(getVisibleSeries("bread", 199).length, 200);
});

test("八商品高低价独立抄自原CSV，OHLC同分母缩放且不根据实体编影线", () => {
  // 各01-21原CSV的high/low独立读取后用十进制算术除以各首开×100。
  const expected: readonly [ProductId, number, number][] = [
    ["bread", 114.60290031632042, 106.99222022740873],
    ["timber", 100.90539220679613, 96.00992276303411],
    ["fruit", 99.24392362347112, 96.11282766869331],
    ["chips", 137.37256352015213, 121.49384607257937],
    ["gold", 155.78805912843156, 144.57669418314456],
    ["flowers", 121.75147928994083, 112.5207100591716],
    ["coffee", 127.79113924050633, 106.24050632911393],
    ["tea", 135.3146853146853, 118.28171828171828],
  ];
  for (const [product, high, low] of expected) {
    closeTo(getQuote(product, 20).high, high);
    closeTo(getQuote(product, 20).low, low);
    for (const candle of getVisibleCandles(product, 199)) {
      assert.ok(candle.low <= Math.min(candle.open, candle.close));
      assert.ok(candle.high >= Math.max(candle.open, candle.close));
    }
  }
});

test("K线只暴露已知前缀，含四价和量且返回副本，未来极值不进入当前窗口", () => {
  const known = getVisibleCandles("bread", 19);
  assert.equal(known.length, 20);
  assert.deepEqual(known, getVisibleCandles("bread", 199).slice(0, 20));
  const first = getVisibleSeries("bread", 19)[0]!;
  closeTo(first.open, known[0]!.open);
  closeTo(first.high, known[0]!.high);
  closeTo(first.low, known[0]!.low);
  closeTo(first.close, known[0]!.close);
  closeTo(first.volume, known[0]!.volume);
  known[0]!.high = 1_000_000;
  assert.notEqual(getVisibleCandles("bread", 19)[0]!.high, 1_000_000);
});

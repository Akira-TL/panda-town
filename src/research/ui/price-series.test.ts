import assert from "node:assert/strict";
import test from "node:test";
import type { MarketBar, Trade } from "../model";
import { runSimulation } from "../simulation";
import {
  buildPriceSeries,
  selectPriceWindow,
  visiblePriceFrame,
} from "./price-series";

function bar(day: number, close: number): MarketBar {
  return {
    date: `2025-01-${String(day).padStart(2, "0")}`,
    bamboo: { open: close, close, volume: 100 },
    pine: { open: close, close, volume: 100 },
  };
}

test("第一天此前均线来自20条前史，极大当期价格不能反写信号", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(index + 1, index + 1),
  );
  const first = buildPriceSeries([bar(21, 999)], warmup, "bamboo")[0]!;
  assert.equal(first.ma5, 18);
  assert.equal(first.ma20, 10.5);
  assert.equal(first.change, 979);
  const alteredFuture = buildPriceSeries(
    [bar(21, 999), bar(22, 1000000)],
    warmup,
    "bamboo",
  );
  assert.deepEqual(alteredFuture[0], first);
});

test("播放前缀不会包含后来的价格、纵轴极值和未来成交", () => {
  const series = buildPriceSeries(
    [bar(21, 10), bar(22, 11), bar(23, 100000)],
    [],
    "bamboo",
  );
  const trades: Trade[] = [
    {
      id: "later",
      signalDate: "2025-01-22",
      date: "2025-01-23",
      asset: "bamboo",
      side: "buy",
      quantity: 1,
      price: 100000,
      gross: 100000,
      fee: 0,
      cashAfter: 0,
    },
  ];
  const frame = visiblePriceFrame(series, 2, trades, "bamboo");
  assert.equal(frame.current?.date, "2025-01-22");
  assert.equal(frame.points.length, 2);
  assert.equal(frame.trades.length, 0);
  assert.ok(frame.max < 12);
  assert.equal(
    visiblePriceFrame(series, 3, trades, "bamboo").trades[0]?.id,
    "later",
  );
});

test("没有真实运行或请求不存在运行时只给公开研究段", () => {
  const frame = selectPriceWindow([], "invented-validation-run");
  assert.equal(frame.segment, "research");
  assert.equal(frame.bars.length, 120);
  assert.equal(frame.runId, null);
  assert.equal(frame.bars.at(-1)?.date, "2025-05-20");
});

test("检验价格只对本局已保存的那个运行开放，且限制到其区间", () => {
  const run = runSimulation({
    rule: "hold",
    allocation: 0.3,
    frequency: 1,
    feeBps: 0,
    slippageBps: 0,
    initialCash: 1000,
    segment: "validation",
  });
  assert.equal(selectPriceWindow([], run.id).segment, "research");
  assert.equal(selectPriceWindow([run], "another-id").segment, "research");
  const window = selectPriceWindow([run], run.id);
  assert.equal(window.segment, "validation");
  assert.equal(window.bars.length, 60);
  assert.equal(window.bars[0]?.date, run.startDate);
  assert.equal(window.bars.at(-1)?.date, run.endDate);
});

test("跌破文字来自实际前后价格与此前均线，而非随机标签", () => {
  const warmup = Array.from({ length: 20 }, (_, index) => bar(index + 1, 10));
  const points = buildPriceSeries([bar(21, 12), bar(22, 1)], warmup, "bamboo");
  assert.equal(points[1]?.ma20, 10.1);
  assert.equal(points[1]?.crossing, "below");
});

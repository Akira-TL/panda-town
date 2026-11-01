import test from "node:test";
import assert from "node:assert/strict";
import type { MarketBar, SimulationConfig } from "./model";
import { runSimulation, simulateBars } from "./simulation";

const config: SimulationConfig = {
  rule: "hold",
  allocation: 1,
  frequency: 1,
  feeBps: 0,
  slippageBps: 0,
  initialCash: 1000,
  segment: "research",
};
function bar(
  date: string,
  open: number,
  close: number,
  volume = 1000,
): MarketBar {
  return {
    date,
    bamboo: { open, close, volume },
    pine: { open, close, volume },
  };
}
function near(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual}应接近独立手算${expected}`,
  );
}

test("零仓位1000平线，对照仍以100%初始等权持有而非跟随零仓位", () => {
  const result = simulateBars(
    [bar("2025-01-21", 100, 110), bar("2025-01-22", 110, 90)],
    { ...config, allocation: 0 },
  );
  assert.deepEqual(
    result.points.map((point) => point.equity),
    [1000, 1000, 1000],
  );
  assert.deepEqual(
    result.points.map((point) => point.benchmark),
    [1000, 1100, 900],
  );
  assert.equal(result.trades.length, 0);
  assert.equal(result.orders.length, 0);
  assert.equal(result.metrics.netProfit, 0);
  assert.equal(result.metrics.maxDrawdown, 0);
  assert.equal(result.metrics.benchmarkReturn, -0.1);
});

test("100基点费率与100基点买入滑点真实扣除，回撤包含未成交的1000起点", () => {
  // 平价市场：1000÷1.01÷1.01=980.2960494069，费用9.9009900990。
  const result = simulateBars([bar("2025-01-21", 100, 100)], {
    ...config,
    feeBps: 100,
    slippageBps: 100,
  });
  near(result.metrics.finalEquity, 980.2960494069209);
  near(result.metrics.fees, 9.9009900990099);
  near(result.metrics.maxDrawdown, 0.0197039505930791);
  near(result.points[1]!.benchmark, 980.2960494069209);
  assert.equal(result.trades.length, 2);
  assert.equal(result.orders.length, 2);
  assert.ok(result.orders.every((order) => order.status === "filled"));
  near(result.trades[0]!.price, 101);
  near(result.trades[0]!.quantity, 4.901480247034604);
  near(result.trades[0]!.fee, 4.95049504950495);
  near(result.trades[0]!.cashAfter, 500);
  assert.ok(result.points.every((point) => point.cash >= 0));
});

test("本期成交量限额产生部分成交和拒单，只对实际成交收费且未成交不排队", () => {
  const first = bar("2025-01-21", 100, 100, 1);
  first.pine.volume = 0;
  const result = simulateBars([first, bar("2025-01-22", 100, 50)], {
    ...config,
    feeBps: 100,
  });
  assert.deepEqual(
    result.orders.map((order) => [order.status, order.filledQuantity]),
    [
      ["partial", 1],
      ["rejected", 0],
    ],
  );
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0]!.quantity, 1);
  assert.equal(result.trades[0]!.fee, 1);
  assert.equal(result.trades[0]!.cashAfter, 899);
  assert.deepEqual(
    result.points.map((point) => point.equity),
    [1000, 999, 949],
  );
  assert.deepEqual(
    result.points.map((point) => point.benchmark),
    [1000, 999, 949],
  );
  near(result.metrics.maxDrawdown, 0.051);
  assert.ok(result.orders.every((order) => /成交量/.test(order.reason)));
});

test("趋势只读前收盘形成信号，次期开盘成交，不能用本期收盘躲开损失", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(
      `2025-01-${String(index + 1).padStart(2, "0")}`,
      100,
      index < 15 ? 110 : 100,
    ),
  );
  const result = simulateBars(
    [
      bar("2025-01-21", 100, 200),
      bar("2025-01-22", 50, 100),
      bar("2025-01-23", 80, 10),
    ],
    { ...config, rule: "trend" },
    warmup,
  );
  // 首期信号仍走弱所以持币；次期以50买入共20份，最后收盘10只剩200。
  assert.deepEqual(
    result.points.map((point) => point.equity),
    [1000, 1000, 2000, 200],
  );
  assert.equal(result.trades.length, 2);
  assert.equal(result.trades[0]!.signalDate, "2025-01-21");
  assert.equal(result.trades[0]!.date, "2025-01-22");
  assert.equal(result.trades[0]!.price, 50);
  assert.equal(result.trades[0]!.quantity, 10);
  near(result.metrics.maxDrawdown, 0.9);
});

test("均值回归低于均价2%才进入，有持仓时等回到均价再于次期开盘退出", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(`2025-01-${String(index + 1).padStart(2, "0")}`, 100, 100),
  );
  const result = simulateBars(
    [
      bar("2025-01-21", 100, 97),
      bar("2025-01-22", 50, 99),
      bar("2025-01-23", 70, 98),
      bar("2025-01-24", 80, 102),
      bar("2025-01-25", 110, 1),
    ],
    { ...config, rule: "reversion" },
    warmup,
  );
  assert.deepEqual(
    result.points.map((point) => point.equity),
    [1000, 1000, 1980, 1960, 2040, 2200],
  );
  assert.deepEqual(
    result.trades.map((trade) => [trade.side, trade.date, trade.price]),
    [
      ["buy", "2025-01-22", 50],
      ["buy", "2025-01-22", 50],
      ["sell", "2025-01-25", 110],
      ["sell", "2025-01-25", 110],
    ],
  );
  assert.equal(result.trades[2]!.signalDate, "2025-01-24");
  assert.equal(result.points.at(-1)!.cash, 2200);
});

test("相同输入逐字段可重复，改变费用得到独立运行标识且不改输入", () => {
  const input = { ...config, rule: "trend" as const };
  const before = structuredClone(input);
  const first = runSimulation(input);
  assert.deepEqual(runSimulation(input), first);
  assert.notEqual(runSimulation({ ...input, feeBps: 30 }).id, first.id);
  assert.deepEqual(input, before);
});

test("预热必须严格早于运行段，不能把当日或未来收盘注入历史窗口", () => {
  assert.throws(
    () =>
      simulateBars([bar("2025-01-21", 100, 100)], config, [
        bar("2025-01-21", 100, 999),
      ]),
    /预热.*早于/,
  );
});

test("负费率不能当补贴计成盈利，无效开盘价不能制造非有限份额", () => {
  const bars = [bar("2025-01-21", 100, 100)];
  assert.throws(
    () => simulateBars(bars, { ...config, feeBps: -1 }),
    /费用|费率/,
  );
  assert.throws(
    () => simulateBars([bar("2025-01-21", 0, 100)], config),
    /报价/,
  );
});

test("卖出使用不利滑点并扣卖出费，现金来自实际到账而非收盘价", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(
      `2025-01-${String(index + 1).padStart(2, "0")}`,
      100,
      index < 15 ? 100 : 110,
    ),
  );
  const result = simulateBars(
    [bar("2025-01-21", 100, 1), bar("2025-01-22", 100, 100)],
    { ...config, rule: "trend", feeBps: 100, slippageBps: 100 },
    warmup,
  );
  // 买入除以1.01²；卖出再乘0.99²，最终960.7881580237。
  near(result.metrics.finalEquity, 960.7881580237232);
  near(result.metrics.fees, 19.60592098813842);
  assert.equal(result.trades.length, 4);
  assert.equal(result.trades[2]!.side, "sell");
  assert.equal(result.trades[2]!.price, 99);
  assert.ok(result.points.every((point) => point.cash >= 0));
});

test("每五期检查在第六根才再次下单，频率改变实际委托日期", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(
      `2025-01-${String(index + 1).padStart(2, "0")}`,
      100,
      index < 15 ? 110 : 100,
    ),
  );
  const bars = Array.from({ length: 6 }, (_, index) =>
    bar(`2025-01-${21 + index}`, 100, index === 0 ? 200 : 100),
  );
  const daily = simulateBars(
    bars,
    { ...config, rule: "trend", frequency: 1 },
    warmup,
  );
  const sparse = simulateBars(
    bars,
    { ...config, rule: "trend", frequency: 5 },
    warmup,
  );
  assert.equal(daily.trades[0]!.date, "2025-01-22");
  assert.equal(sparse.trades[0]!.date, "2025-01-26");
  assert.equal(sparse.trades[0]!.signalDate, "2025-01-25");
});

test("研究与检验分别重置1000，曲线含初始点且严格止于各自区间", () => {
  const research = runSimulation(config);
  const validation = runSimulation({ ...config, segment: "validation" });
  assert.deepEqual(
    [research.startDate, research.endDate, research.points.length],
    ["2025-01-21", "2025-05-20", 121],
  );
  assert.deepEqual(
    [validation.startDate, validation.endDate, validation.points.length],
    ["2025-05-21", "2025-07-19", 61],
  );
  assert.equal(research.points[0]!.date, "2025-01-20");
  assert.equal(validation.points[0]!.date, "2025-05-20");
  assert.equal(validation.points[0]!.equity, 1000);
  assert.equal(validation.points[0]!.benchmark, 1000);
  assert.notEqual(research.id, validation.id);
});

test("改变末期未来收盘不会改之前曲线与当期开盘委托，也不改传入报价", () => {
  const bars = [bar("2025-01-21", 100, 110), bar("2025-01-22", 110, 90)];
  const before = structuredClone(bars);
  const original = simulateBars(bars, config);
  const changed = structuredClone(bars);
  changed[1]!.bamboo.close = 5000;
  const next = simulateBars(changed, config);
  assert.deepEqual(next.points.slice(0, 2), original.points.slice(0, 2));
  assert.deepEqual(next.trades, original.trades);
  assert.deepEqual(bars, before);
});

test("相同小数价格的均线相等，不因浮点尾差制造趋势交易", () => {
  const warmup = Array.from({ length: 20 }, (_, index) =>
    bar(`2025-01-${String(index + 1).padStart(2, "0")}`, 110.1, 110.1),
  );
  const result = simulateBars(
    [bar("2025-01-21", 110.1, 110.1)],
    { ...config, rule: "trend" },
    warmup,
  );
  assert.equal(result.metrics.tradeCount, 0);
  assert.equal(result.metrics.finalEquity, 1000);
});

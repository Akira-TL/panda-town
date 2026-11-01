import test from "node:test";
import assert from "node:assert/strict";
import { getDataIssues, getResearchData, getSimulationInput } from "./data";

function closeTo(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12,
    `${actual} 与独立核对值 ${expected} 不符`,
  );
}

test("真实日线按首日开盘归一至100，价格和数量相反缩放且保留完整日期", () => {
  // 独立核对已通过官方SHA256的CSV：BTC首开93576、ETH首开3337.78。
  // 01-21 BTC收106143.82/量45941.02002；ETH收3327.54/量548706.0513。
  const { bars, warmup } = getSimulationInput("research");
  const first = bars[0]!;
  closeTo(warmup[0]!.bamboo.open, 100);
  closeTo(warmup[0]!.pine.open, 100);
  closeTo(warmup[0]!.bamboo.close, 101.08552406599983);
  closeTo(warmup[0]!.pine.close, 100.67709675293159);
  closeTo(first.bamboo.close, 113.43060186372574);
  closeTo(first.pine.close, 99.6932092588487);
  closeTo(first.bamboo.volume, 42989768.8939152);
  closeTo(first.pine.volume, 18314600.83908114);
  const last = getSimulationInput("validation").bars.at(-1)!;
  // 07-19原收盘：BTC117840、ETH3592.01；不是生成器提供的预期值。
  closeTo(last.bamboo.close, 125.92972557065914);
  closeTo(last.pine.close, 107.61673926981407);
});

test("研究界面只取得120根研究报价，不含20根预热或60根留出数据", () => {
  const bars = getResearchData();
  assert.deepEqual(
    [bars.length, bars[0]?.date, bars.at(-1)?.date],
    [120, "2025-01-21", "2025-05-20"],
  );
});

test("留出段是独立60期，只用研究末20期预热，不混入留出段未来报价", () => {
  const { bars, warmup } = getSimulationInput("validation");
  assert.deepEqual(
    [
      bars.length,
      bars[0]?.date,
      bars.at(-1)?.date,
      warmup.length,
      warmup[0]?.date,
      warmup.at(-1)?.date,
    ],
    [60, "2025-05-21", "2025-07-19", 20, "2025-05-01", "2025-05-20"],
  );
});

test("损坏传输行重读同日期演示源，不以前日成交量冒充本日", () => {
  const issues = getDataIssues();
  // 原始CSV独立抄核：97869.99、788739.6763、1896.90、22157.53351。
  const expected = [
    {
      date: "2025-02-12",
      asset: "bamboo",
      field: "close",
      received: null,
      restored: 104.58877276224673,
    },
    {
      date: "2025-03-12",
      asset: "pine",
      field: "volume",
      received: null,
      restored: 26326395.16760614,
    },
    {
      date: "2025-03-28",
      asset: "pine",
      field: "close",
      received: 9999,
      restored: 56.83118719628016,
    },
    {
      date: "2025-04-28",
      asset: "bamboo",
      field: "volume",
      received: -4,
      restored: 20734133.5573176,
    },
  ];
  const metadata = ({
    date,
    asset,
    field,
    received,
  }: (typeof expected)[number]) => ({
    date,
    asset,
    field,
    received,
  });
  assert.deepEqual(issues.map(metadata), expected.map(metadata));
  issues.forEach((issue, index) =>
    closeTo(issue.restored, expected[index]!.restored),
  );
  const restored = getResearchData().find((bar) => bar.date === "2025-02-12")!;
  closeTo(restored.bamboo.close, 104.58877276224673);
  assert.ok(
    issues.every((issue) => issue.explanation.includes("人为教学传输错误")),
  );
});

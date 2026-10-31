import test from "node:test";
import assert from "node:assert/strict";
import { getDataIssues, getResearchData } from "./data";

test("研究界面只取得120根研究报价，不含20根预热或60根留出数据", () => {
  const bars = getResearchData();
  assert.deepEqual(
    [bars.length, bars[0]?.date, bars.at(-1)?.date],
    [120, "2025-01-21", "2025-05-20"],
  );
});

test("损坏传输行重读同日期演示源，不以前日成交量冒充本日", () => {
  const issues = getDataIssues();
  assert.deepEqual(
    issues.map(({ date, asset, field, received, restored }) => ({
      date,
      asset,
      field,
      received,
      restored,
    })),
    [
      {
        date: "2025-02-12",
        asset: "bamboo",
        field: "close",
        received: null,
        restored: 112.3,
      },
      {
        date: "2025-03-12",
        asset: "pine",
        field: "volume",
        received: null,
        restored: 1203,
      },
      {
        date: "2025-03-28",
        asset: "pine",
        field: "close",
        received: 9999,
        restored: 78.39,
      },
      {
        date: "2025-04-28",
        asset: "bamboo",
        field: "volume",
        received: -4,
        restored: 1029,
      },
    ],
  );
  const restored = getResearchData().find((bar) => bar.date === "2025-02-12")!;
  assert.equal(restored.bamboo.close, 112.3);
  assert.ok(issues.every((issue) => issue.explanation.length > 0));
});

import type { ResearchIntent, SimulationResult } from "../model";
import { number, percent } from "./format";

/** 研究意图决定实际优先显示的指标，不仅改变一句反馈。 */
export function SimulationMetrics({
  result,
  priority = "return",
}: {
  result: SimulationResult;
  priority?: ResearchIntent;
}) {
  const metrics = result.metrics;
  const items = {
    return: {
      label: "扣费后收益",
      value: number(metrics.netProfit),
      detail: `模拟币 · ${percent(metrics.netReturn)}`,
    },
    risk: {
      label: "最大回撤",
      value: percent(metrics.maxDrawdown),
      detail: "从已有高点到后来低点",
    },
    cost: {
      label: "交易费用",
      value: number(metrics.fees),
      detail: `模拟币 · ${metrics.tradeCount}笔成交`,
    },
    equity: {
      label: "期末总资产",
      value: number(metrics.finalEquity),
      detail: "现金与持仓合计",
    },
  };
  const order: (ResearchIntent | "equity")[] = [
    priority,
    ...(["return", "risk", "cost"] as const).filter(
      (item) => item !== priority,
    ),
    "equity",
  ];
  return (
    <dl className="research-metrics" aria-label="按本局研究意图排列的实际指标">
      {order.map((key, index) => (
        <div key={key} data-metric={key} data-priority={index === 0}>
          <dt>
            {items[key].label}
            {index === 0 && (
              <span className="research-priority-label">你先关注</span>
            )}
          </dt>
          <dd>
            {items[key].value}
            <small>{items[key].detail}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}

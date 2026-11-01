"use client";

import { useId } from "react";
import type { ResearchIntent, ResearchTopic, SimulationResult } from "../model";
import { SimulationMetrics } from "./SimulationMetrics";
import { number, percent, ruleNames } from "./format";
import { getRuleDescription } from "../simulation";

export function SimulationView({
  result,
  onInspect,
  focus,
  priority = "return",
}: {
  result: SimulationResult;
  onInspect?: (topic: ResearchTopic) => void;
  focus?: ResearchTopic;
  priority?: ResearchIntent;
}) {
  const chartId = useId();
  const values = result.points
    .flatMap((point) => [point.equity, point.benchmark])
    .filter(Number.isFinite);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const margin = Math.max(
    (high - low) * 0.12,
    result.config.initialCash * 0.015,
  );
  const min = low - margin,
    max = high + margin;
  const x = (index: number) =>
    58 + (index / Math.max(1, result.points.length - 1)) * 630;
  const y = (value: number) =>
    180 - ((value - min) / Math.max(0.001, max - min)) * 150;
  const line = (key: "equity" | "benchmark") =>
    result.points
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`,
      )
      .join(" ");
  const metrics = result.metrics;
  return (
    <section
      className="research-simulation"
      aria-label="本次真实计算结果"
      data-run-id={result.id}
    >
      <div className="research-run-heading">
        <h3>
          {result.config.segment === "research"
            ? "研究数据结果"
            : "新数据检验结果"}
        </h3>
        <span>
          {result.startDate} — {result.endDate}
        </span>
      </div>
      <div className="research-chart-wrap">
        <svg
          viewBox="0 0 720 220"
          role="img"
          aria-labelledby={`${chartId}-title`}
          aria-describedby={`${chartId}-desc`}
        >
          <title id={`${chartId}-title`}>策略与固定持有的资金曲线</title>
          <desc id={`${chartId}-desc`}>
            初始资金{number(result.config.initialCash)}模拟币， 策略净收益率
            {percent(metrics.netReturn)}，对照收益率
            {percent(metrics.benchmarkReturn)}。
            纵轴显示模拟资金，横轴按日期排列。绿色实线是策略，金色虚线是固定持有。
          </desc>
          {[0, 0.5, 1].map((fraction) => {
            const value = min + (max - min) * fraction;
            return (
              <g key={fraction}>
                <line
                  x1="58"
                  x2="688"
                  y1={y(value)}
                  y2={y(value)}
                  className="research-chart-grid"
                />
                <text x="49" y={y(value) + 4} textAnchor="end">
                  {number(value)}
                </text>
              </g>
            );
          })}
          <path d={line("benchmark")} className="research-line-benchmark" />
          <path d={line("equity")} className="research-line-strategy" />
          <text x="58" y="208">
            {result.points[0]?.date}
          </text>
          <text x="688" y="208" textAnchor="end">
            {result.points.at(-1)?.date}
          </text>
        </svg>
      </div>
      <p className="research-chart-legend">
        <span>━ 你的策略</span>
        <span>┄ 固定持有对照</span>
        <span>单位：模拟币</span>
      </p>
      <SimulationMetrics result={result} priority={priority} />
      <details className="research-details">
        <summary
          onClick={(event) => {
            if (!event.currentTarget.parentElement?.hasAttribute("open"))
              onInspect?.("rule");
          }}
        >
          核对本次输入与方法
        </summary>
        <p>{getRuleDescription(result.config.rule)}</p>
        <dl className="research-inputs">
          <div>
            <dt>规则</dt>
            <dd>{ruleNames[result.config.rule]}</dd>
          </div>
          <div>
            <dt>投入比例</dt>
            <dd>{percent(result.config.allocation)}</dd>
          </div>
          <div>
            <dt>检查频率</dt>
            <dd>每{result.config.frequency}个样本</dd>
          </div>
          <div>
            <dt>手续费 / 成交偏移</dt>
            <dd>
              {percent(result.config.feeBps / 10000)} /{" "}
              {percent(result.config.slippageBps / 10000)}
            </dd>
          </div>
          <div>
            <dt>初始资金</dt>
            <dd>{number(result.config.initialCash)}模拟币</dd>
          </div>
          <div>
            <dt>数据版本</dt>
            <dd>{result.datasetVersion}</dd>
          </div>
        </dl>
        <p>
          只使用当时已知的数据形成信号，实际成交另行核对；历史表现不能保证下一段结果。
        </p>
      </details>
      <details
        className="research-details"
        open={focus === "trades" ? true : undefined}
      >
        <summary
          onClick={(event) => {
            if (!event.currentTarget.parentElement?.hasAttribute("open"))
              onInspect?.("trades");
          }}
        >
          展开委托与实际成交（{result.orders.length}次委托 /{" "}
          {result.trades.length}笔成交）
        </summary>
        <p>发出委托不等于成交；下表分别保留请求数量与实际成交数量。</p>
        <div
          className="research-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="委托记录，可横向滚动"
        >
          <table>
            <caption>委托及执行状态</caption>
            <thead>
              <tr>
                <th>信号日期</th>
                <th>执行日期</th>
                <th>标的 / 方向</th>
                <th>请求 / 成交</th>
                <th>结果与原因</th>
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.signalDate}</td>
                  <td>{order.date}</td>
                  <td>
                    {order.asset === "bamboo" ? "竹材" : "松果"} ·{" "}
                    {order.side === "buy" ? "买入" : "卖出"}
                  </td>
                  <td>
                    {order.requestedQuantity} / {order.filledQuantity}
                  </td>
                  <td>
                    {
                      {
                        filled: "全部成交",
                        partial: "部分成交",
                        rejected: "未成交",
                      }[order.status]
                    }
                    ：{order.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.orders.length && (
            <p>本次没有产生委托，保持现金也是实际结果。</p>
          )}
          <table>
            <caption>实际成交与逐笔费用</caption>
            <thead>
              <tr>
                <th>日期</th>
                <th>标的 / 方向</th>
                <th>数量</th>
                <th>成交价</th>
                <th>费用</th>
                <th>成交后现金</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.date}</td>
                  <td>
                    {trade.asset === "bamboo" ? "竹材" : "松果"} ·{" "}
                    {trade.side === "buy" ? "买入" : "卖出"}
                  </td>
                  <td>{trade.quantity}</td>
                  <td>{number(trade.price)}</td>
                  <td>{number(trade.fee)}</td>
                  <td>{number(trade.cashAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.trades.length && (
            <p>本次没有实际成交，因此不补造交易或收益。</p>
          )}
        </div>
      </details>
      <details className="research-details">
        <summary>查看曲线的原始数值（{result.points.length}条）</summary>
        <div
          className="research-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="曲线原始数值，可横向滚动"
        >
          <table>
            <caption>各日期收盘后的模拟资金</caption>
            <thead>
              <tr>
                <th>日期</th>
                <th>策略资产</th>
                <th>固定持有</th>
                <th>现金</th>
              </tr>
            </thead>
            <tbody>
              {result.points.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{number(point.equity)}</td>
                  <td>{number(point.benchmark)}</td>
                  <td>{number(point.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {result.warnings.length > 0 && (
        <aside className="research-caveat" aria-label="本次计算说明">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </aside>
      )}
    </section>
  );
}

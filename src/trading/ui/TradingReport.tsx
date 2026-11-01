"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameDialog } from "../../ui/GameDialog";
import { getAccountSnapshot } from "../engine";
import { getMarketDate, getQuote } from "../market";
import {
  PRODUCT_IDS,
  type ShopEvidence,
  type TradingGame,
  type TradingTopic,
} from "../model";
import { getProduct } from "../products";
import { buildLearningSummary } from "../learning/summary";
import { getRuleLabel } from "../learning/rules";
import type {
  AccountCurvePoint,
  IndicatorId,
  LearningEvent,
} from "../learning/types";
import type { useLearningSession } from "../useLearningSession";
import { money, signed, units } from "./format";
import "./trading.css";
import "./learning-report.css";

const actionNames: Record<ShopEvidence["action"], string> = {
  buy: "买入",
  sell: "卖出",
  hold: "持有或先看看",
  inspect: "主动查看",
};
const topicNames: Record<TradingTopic, string> = {
  price: "价格",
  risk: "风险",
  cost: "费用",
  history: "成交记录",
  holdings: "持仓",
};
const indicatorNames: Record<IndicatorId, string> = {
  ema: "指数移动平均线",
  macd: "指数平滑异同移动平均线",
  rsi: "相对强弱指数",
  kdj: "随机指标",
  boll: "布林带",
  atr: "平均真实波幅",
};
type Overlay = "evidence" | "restart" | "clear";
export interface TradingReportProps {
  game: TradingGame;
  learning: ReturnType<typeof useLearningSession>;
  onRestart: () => void;
  onClear: () => void;
}

function EvidenceTable({
  label,
  headers,
  rows,
  empty,
}: {
  label: string;
  headers: readonly string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <div
      className="learning-report-table"
      role="region"
      tabIndex={0}
      aria-label={label}
    >
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index}>
              {cells.map((cell, column) => (
                <td key={column}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>{empty}</p>}
    </div>
  );
}
function AccountCurve({ curve }: { curve: readonly AccountCurvePoint[] }) {
  if (!curve.length) return <p>没有已观察账户估值点。</p>;
  const low = Math.min(...curve.map((point) => point.equity));
  const high = Math.max(...curve.map((point) => point.equity));
  const pad = Math.max(1, (high - low) * 0.12);
  const x = (index: number) =>
    12 + (index / Math.max(1, curve.length - 1)) * 596;
  const y = (equity: number) =>
    100 - ((equity - low + pad) / (high - low + 2 * pad)) * 88;
  const d = curve
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.equity)}`)
    .join(" ");
  return (
    <figure className="learning-report-curve">
      <svg
        viewBox="0 0 620 115"
        role="img"
        aria-label="已观察账户总资产曲线，单位为小镇币"
      >
        <title>{`账户估值从${money(curve[0]!.equity)}到${money(curve.at(-1)!.equity)}小镇币。`}</title>
        <line x1={12} x2={608} y1={100} y2={100} stroke="#dcccab" />
        <path d={d} stroke="#4c7957" strokeWidth={2} fill="none" />
      </svg>
      <figcaption>
        按实际到达、行动后的账户估值排列；不是日内逐笔资金曲线。
      </figcaption>
    </figure>
  );
}
function LearningRecord({ event }: { event: LearningEvent }) {
  const heading = `第${event.round}轮 · ${getProduct(event.product).name}`;
  if (event.kind === "rule")
    return (
      <article className="learning-report-record">
        <h4>{heading} · 明确选择规则</h4>
        <p>{getRuleLabel(event.rule)}</p>
        <small>
          {getMarketDate(event.marketIndex)}，仅记录主动选择，不推断长期策略。
        </small>
      </article>
    );
  if (event.kind === "indicator")
    return (
      <article className="learning-report-record">
        <h4>
          {heading} · {event.interaction === "view" ? "主动查看" : "点选或标记"}
          {indicatorNames[event.indicator]}
        </h4>
        <p>
          选中日期 {getMarketDate(event.index)}；条件状态：
          {event.triggered === null
            ? "未得出判断"
            : event.triggered
              ? "当时满足"
              : "当时未满足"}
          。
        </p>
        <p>{event.explanation}</p>
      </article>
    );
  const chosen =
    event.answerId === null
      ? "主动跳过"
      : (event.prompt.options.find((option) => option.id === event.answerId)
          ?.label ?? "原选项已不可用");
  return (
    <article className="learning-report-record">
      <h4>
        {heading} · {event.prompt.kind === "candle" ? "日K线读数" : "规则判断"}·{" "}
        {event.prompt.transfer ? "新情境复验" : "首次情境"}
      </h4>
      <p>{event.prompt.title}</p>
      <p>
        选择：{chosen}；
        {event.correct === null
          ? "未评分，跳过不记错"
          : event.correct
            ? "本题正确"
            : "本题未答对"}
        。
      </p>
      <p>{event.explanation}</p>
    </article>
  );
}

export function TradingReport({
  game,
  learning,
  onRestart,
  onClear,
}: TradingReportProps) {
  const heading = useRef<HTMLHeadingElement>(null),
    cancel = useRef<HTMLButtonElement>(null);
  const session = useRef(game.sessionId);
  session.current = game.sessionId;
  const copySequence = useRef(0);
  const [dialog, setDialog] = useState<{
    sessionId: string;
    kind: Overlay;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    sessionId: string;
    text: string;
  } | null>(null);
  const [copyPending, setCopyPending] = useState<string | null>(null);
  const currentState =
    learning.state?.sessionId === game.sessionId ? learning.state : null;
  const summary = useMemo(
    () =>
      currentState
        ? (learning.summary ?? buildLearningSummary(game, currentState))
        : null,
    [game, currentState, learning.summary],
  );
  const account = game.settlement?.snapshot ?? getAccountSnapshot(game);
  const date = game.settlement?.date ?? getMarketDate(game.marketIndex);
  const evidence = useMemo(
    () => [
      ...new Map(
        game.evidence
          .filter((row) => row.sessionId === game.sessionId)
          .map((row) => [row.id, row]),
      ).values(),
    ],
    [game],
  );
  const overlay = dialog?.sessionId === game.sessionId ? dialog.kind : null;
  const feedback =
    copyFeedback?.sessionId === game.sessionId ? copyFeedback.text : "";
  const facts = summary
    ? summary.facts.length > 2
      ? summary.facts.slice(-2)
      : summary.facts
    : [];
  useEffect(() => {
    heading.current?.focus();
    copySequence.current++;
    setCopyFeedback(null);
    setCopyPending(null);
    setDialog(null);
    return () => {
      copySequence.current++;
    };
  }, [game.sessionId]);
  useEffect(() => {
    if (overlay === "restart" || overlay === "clear") cancel.current?.focus();
  }, [overlay]);
  const open = (kind: Overlay) =>
    setDialog({ sessionId: game.sessionId, kind });
  async function copyQuestion() {
    if (!summary) return;
    const at = game.sessionId,
      sequence = ++copySequence.current;
    setCopyPending(at);
    setCopyFeedback({ sessionId: at, text: "正在复制…" });
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
        throw new Error("浏览器未提供剪贴板");
      await navigator.clipboard.writeText(summary.copyText);
      if (sequence === copySequence.current && session.current === at)
        setCopyFeedback({
          sessionId: at,
          text: "已复制，请自行粘贴到PandaAI；尚未发送。",
        });
    } catch {
      if (sequence === copySequence.current && session.current === at)
        setCopyFeedback({
          sessionId: at,
          text: "复制失败。请在“查看依据”的“研究问题原文”中手动选择复制。",
        });
    } finally {
      if (sequence === copySequence.current && session.current === at)
        setCopyPending(null);
    }
  }
  return (
    <section
      className="shop-report learning-report"
      data-trading-report="true"
      data-learning-ready={!!summary}
      aria-label="本局交易与学习结果"
    >
      <header className="learning-report-heading">
        <img src="/art/panda-portrait.webp" alt="" width={52} height={62} />
        <div>
          <h1 ref={heading} tabIndex={-1}>
            把你的办法，再验证一次
          </h1>
          <p>
            第{game.settlement?.round ?? game.round}轮 · {date} · 持仓按市值结算
          </p>
        </div>
      </header>
      <dl className="learning-report-metrics">
        <div>
          <dt>总资产 · 小镇币</dt>
          <dd>{money(account.totalAssets)}</dd>
        </div>
        <div>
          <dt>本局净盈亏 · 小镇币</dt>
          <dd data-sign={account.netProfit >= 0 ? "positive" : "negative"}>
            {signed(account.netProfit)}
          </dd>
        </div>
        <div>
          <dt title="从已观察的账户估值计算，不是日内逐笔回撤">最大回撤</dt>
          <dd>
            {summary
              ? `${(summary.maximumDrawdown * 100).toFixed(2)}%`
              : "待计算"}
          </dd>
        </div>
        <div>
          <dt>实际成交</dt>
          <dd>
            {game.trades.length}
            <small> 笔</small>
          </dd>
        </div>
      </dl>
      <p className="learning-report-rule">
        <span>我的办法</span>
        <strong>{summary?.ruleLabel ?? "正在核对本局办法…"}</strong>
      </p>
      <div className="learning-report-facts">
        {facts.map((fact, index) => (
          <button
            type="button"
            key={index}
            onClick={() => open("evidence")}
            aria-haspopup="dialog"
          >
            {fact}
            <span aria-hidden="true"> ›</span>
          </button>
        ))}
        {!summary && (
          <p role="status">正在整理本局学习记录，不接续其他局的观察。</p>
        )}
      </div>
      <div className="learning-report-question">
        <span>我想继续验证</span>
        <strong>{summary?.question ?? "正在整理本局研究问题…"}</strong>
      </div>
      <div className="learning-report-actions">
        <a
          href="https://www.pandaaiquant.com/agent_quant/"
          target="_blank"
          rel="noopener noreferrer"
          title="手动打开PandaAI；本局记录不会自动发送"
        >
          去 PandaAI 验证 ↗
        </a>
        <button
          type="button"
          disabled={!summary || copyPending === game.sessionId}
          onClick={copyQuestion}
        >
          复制我的问题
        </button>
      </div>
      {feedback && (
        <p className="learning-report-copy-status" role="status">
          {feedback}
        </p>
      )}
      <div className="learning-report-session">
        <button
          type="button"
          onClick={() => open("evidence")}
          aria-haspopup="dialog"
        >
          查看依据
        </button>
        <button
          type="button"
          onClick={() => open("restart")}
          aria-haspopup="dialog"
        >
          重开一局
        </button>
        <button
          type="button"
          onClick={() => open("clear")}
          aria-haspopup="dialog"
        >
          清除记录
        </button>
      </div>
      {learning.notice && (
        <p className="learning-report-notice" role="status">
          {learning.notice}
        </p>
      )}
      <p className="learning-report-note">
        网页跳转不携带画像；问题由你自行粘贴。本局盈亏不换算人格或能力。
      </p>
      {overlay === "evidence" && (
        <GameDialog title="本局交易与学习依据" onClose={() => setDialog(null)}>
          <div className="learning-report-evidence">
            <p>
              只展示本局实际交易、明确规则、主动查看和客观作答。没有操作或回答的部分保留未观察。
            </p>
            <details open>
              <summary>研究问题原文</summary>
              {summary ? (
                <textarea
                  readOnly
                  aria-label="可手动复制的研究问题原文"
                  value={summary.copyText}
                  rows={7}
                />
              ) : (
                <p>本局学习记录尚未就绪，暂不生成问题或数值。</p>
              )}
            </details>
            <details>
              <summary>现金、持仓、成本和费用</summary>
              <p>
                现金{money(account.cash)}；持仓市值
                {money(account.holdingsValue)}；费用{money(account.fees)}
                小镇币。 已实现盈亏{signed(account.realizedProfit)}，未实现盈亏
                {signed(account.unrealizedProfit)}。
                结算未自动卖出，也未虚构卖出手续费。
              </p>
              <EvidenceTable
                label="结算持仓表"
                headers={["商品", "持有份数", "含费总成本/每份", "当前市值"]}
                empty="没有持仓记录。"
                rows={PRODUCT_IDS.map((product) => {
                  const holding = game.holdings[product];
                  const average =
                    holding.quantity > 0
                      ? money(holding.costBasis / holding.quantity)
                      : "—";
                  return [
                    getProduct(product).name,
                    units(holding.quantity),
                    `${money(holding.costBasis)} / ${average}`,
                    money(
                      holding.quantity *
                        getQuote(product, game.marketIndex).close,
                    ),
                  ];
                })}
              />
            </details>
            <details>
              <summary>全部实际成交 · {game.trades.length}笔</summary>
              <EvidenceTable
                label="全部实际成交"
                headers={[
                  "轮次/日期",
                  "商品/动作",
                  "请求/实际份数",
                  "价格/份",
                  "费用",
                  "现金余额",
                  "已实现盈亏",
                ]}
                empty="本局没有成交，不补造买卖。"
                rows={game.trades.map((row) => [
                  `${row.round} · ${row.date}`,
                  `${getProduct(row.product).name} · ${row.side === "buy" ? "买入" : "卖出"}`,
                  `${units(row.requestedQuantity)} / ${units(row.quantity)}`,
                  money(row.price),
                  money(row.fee),
                  money(row.cashAfter),
                  signed(row.realizedProfit),
                ])}
              />
            </details>
            <details>
              <summary>原始交易动作与当时机会 · {evidence.length}条</summary>
              {evidence.map((row) => (
                <article className="learning-report-record" key={row.id}>
                  <h4>
                    第{row.round}轮 · {getProduct(row.product).name} ·{" "}
                    {actionNames[row.action]}
                    {row.topic ? ` · ${topicNames[row.topic]}` : ""}
                  </h4>
                  <p>
                    {getMarketDate(row.marketIndex)}，报价{money(row.quote)}
                    币/份； 当时日涨跌
                    {row.dailyChange === null
                      ? "无前值"
                      : `${signed(row.dailyChange * 100)}%`}
                    。
                  </p>
                  <p>
                    现金{money(row.cashBefore)} → {money(row.cashAfter)}；持有
                    {units(row.quantityBefore)} →{units(row.quantityAfter)}
                    份；行动前总资产{money(row.assetsBefore)}。
                  </p>
                  <p>
                    当时可买：{row.opportunities.buy ? "是" : "否"}；可卖：
                    {row.opportunities.sell ? "是" : "否"}； 可持有或观察：
                    {row.opportunities.hold ? "是" : "否"}。
                  </p>
                </article>
              ))}
              {!evidence.length && (
                <p>本局尚无主要决定或主动查看，不补默认偏好。</p>
              )}
            </details>
            <details>
              <summary>规则变更、指标查看与客观互动</summary>
              {currentState?.events.map((event) => (
                <LearningRecord key={event.id} event={event} />
              ))}
              {!currentState?.events.length && (
                <p>尚无本局规则或学习事件，知识与策略保持未观察。</p>
              )}
              {summary && (
                <p>
                  实际已答{summary.knowledge.answered}次，正确
                  {summary.knowledge.correct}次， 新情境正确
                  {summary.knowledge.transferCorrect}次，跳过
                  {summary.knowledge.skipped}次。
                  仅描述这些题目与情境，查看资料和本局盈亏不算知识分数。
                </p>
              )}
            </details>
            <details>
              <summary>账户估值与最大回撤依据</summary>
              {summary ? (
                <>
                  <AccountCurve curve={summary.equityCurve} />
                  <p>
                    最大回撤{(summary.maximumDrawdown * 100).toFixed(2)}
                    %，从初始资金与已观察估值的高点到后续低点计算。
                  </p>
                </>
              ) : (
                <p>学习记录尚未就绪，暂不展示回撤数值。</p>
              )}
            </details>
            <details>
              <summary>固定规则商人的同机会对照</summary>
              {summary ? (
                <>
                  <h3>{summary.opponent.label}</h3>
                  <p>{summary.opponent.description}</p>
                  <p>
                    对齐行动{summary.opponent.alignedRounds}轮；总资产
                    {money(summary.opponent.snapshot.totalAssets)}， 净盈亏
                    {signed(summary.opponent.snapshot.netProfit)}，费用
                    {money(summary.opponent.snapshot.fees)}小镇币。
                    仅是相同机会下的固定政策比较，不是人的能力评分。
                  </p>
                  <EvidenceTable
                    label="固定规则商人实际行动"
                    headers={[
                      "轮次",
                      "商品",
                      "行动",
                      "份数",
                      "价格",
                      "费用",
                      "原因",
                    ]}
                    empty="尚无已完成回合的对照行动。"
                    rows={summary.opponent.actions.map((row) => [
                      row.round,
                      getProduct(row.product).name,
                      actionNames[row.action],
                      units(row.quantity),
                      money(row.price),
                      money(row.fee),
                      row.reason,
                    ])}
                  />
                </>
              ) : (
                <p>本局对照尚未就绪。</p>
              )}
            </details>
            <details>
              <summary>未观察部分与数据来源</summary>
              <p>
                没有参与的知识互动不算答错，没有主动查看的主题不算兴趣；一般人格与现实投资适当性未评估。
              </p>
              <p>
                商品采用独立历史金融产品的游戏映射，不是真实商品市场价格；未接入PandaData或实盘执行。
                第三方历史与派生快照遵循原数据许可，不按项目源码MIT重新授权。手动打开PandaAI不会自动发送这些记录。
              </p>
            </details>
          </div>
        </GameDialog>
      )}
      {(overlay === "restart" || overlay === "clear") && (
        <GameDialog
          title={overlay === "restart" ? "重新开始交易？" : "清除本局记录？"}
          onClose={() => setDialog(null)}
        >
          <p>
            {overlay === "restart"
              ? "本局现金、持仓、规则和学习记录将由新局替换。"
              : "清除当前标签页的交易与学习记录，返回开场。"}
          </p>
          <div className="learning-report-confirm">
            <button ref={cancel} type="button" onClick={() => setDialog(null)}>
              取消，保留本局
            </button>
            <button
              type="button"
              onClick={overlay === "restart" ? onRestart : onClear}
            >
              {overlay === "restart" ? "确认重开" : "确认清除"}
            </button>
          </div>
        </GameDialog>
      )}
    </section>
  );
}

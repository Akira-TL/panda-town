"use client";

import { useEffect, useRef, useState } from "react";
import { GameDialog } from "../../ui/GameDialog";
import { getAccountSnapshot, previewTrade } from "../engine";
import type { useLearningSession } from "../useLearningSession";
import { getKnowledgePrompt, getRuleLabel } from "../learning";
import type { LearningSummary } from "../learning";
import {
  getMarketDate,
  getQuote,
  getVisibleSeries,
  MARKET_VERSION,
} from "../market";
import type {
  ProductId,
  TradingAction,
  TradingGame,
  TradingTopic,
} from "../model";
import { PRODUCT_IDS } from "../model";
import { getLocationProduct, getProduct } from "../products";
import { TradingPriceChart } from "./TradingPriceChart";
import { IndicatorResearch } from "./IndicatorResearch";
import { ResearchCards } from "./ResearchCards";
import { getBudgetQuantity } from "./shop-lessons";
import { money, signed, units } from "./format";

export type DetailSection =
  "overview" | "allocation" | "comparison" | "knowledge" | TradingTopic;

export function TradingDetails({
  game,
  onAction,
  onClose,
  productId,
  learning,
  initialSection = "overview",
  quantity,
  onQuantityChange,
  onEditRule,
  onKnowledge,
}: {
  game: TradingGame;
  onAction: (action: TradingAction) => void;
  onClose: () => void;
  productId?: ProductId;
  learning: ReturnType<typeof useLearningSession>;
  initialSection?: DetailSection;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onEditRule: () => void;
  onKnowledge: () => void;
}) {
  const [indicators, setIndicators] = useState(false);
  const [researchCards, setResearchCards] = useState(false);
  const [notice, setNotice] = useState("");
  const inspected = useRef(false);
  const product = productId
    ? getProduct(productId)
    : getLocationProduct(game.location);
  const account = getAccountSnapshot(game);
  const rows = getVisibleSeries(product.id, game.marketIndex);
  const current = getQuote(product.id, game.marketIndex);
  const buy = previewTrade(game, "buy", quantity, product.id);
  const holding = game.holdings[product.id];
  const question = learning.state
    ? getKnowledgePrompt(game, learning.state, product.id)
    : null;
  useEffect(() => {
    const topic =
      initialSection === "allocation"
        ? "holdings"
        : initialSection === "comparison"
          ? "history"
          : initialSection === "price" ||
              initialSection === "risk" ||
              initialSection === "cost"
            ? initialSection
            : null;
    if (!topic || inspected.current) return;
    inspected.current = true;
    onAction({
      type: "inspect",
      id: crypto.randomUUID(),
      topic,
      product: product.id,
    });
  }, [initialSection, onAction, product.id]);
  const sections: readonly { topic: TradingTopic; label: string }[] = [
    { topic: "price", label: "价格与来源" },
    { topic: "risk", label: "价格变化与持仓盈亏" },
    { topic: "cost", label: "费用与成本" },
    { topic: "holdings", label: "全部现金与持仓" },
    { topic: "history", label: "逐笔交易记录" },
  ];
  if (researchCards)
    return (
      <ResearchCards
        game={game}
        product={product.id}
        learning={learning}
        onAction={onAction}
        onClose={() => setResearchCards(false)}
      />
    );
  if (indicators)
    return (
      <IndicatorResearch
        game={game}
        product={product.id}
        onClose={onClose}
        onInspect={(id, kind, index) =>
          learning.inspectIndicator(id, kind, index, product.id)
        }
        onUseIndicator={(entry) => {
          if (!learning.state) return;
          const rule = {
            entry,
            allocation: learning.state.rule?.allocation ?? 0.5,
            exit: learning.state.rule?.exit ?? "manual",
          } as const;
          learning.setRule(rule, product.id);
          setNotice(`已保存：${getRuleLabel(rule)}。仍需手动交易。`);
          setIndicators(false);
        }}
      />
    );
  return (
    <GameDialog title={`${product.name} · 交易资料`} onClose={onClose}>
      <div className="shop-learning-toolbar">
        <button type="button" onClick={() => setIndicators(true)}>
          指标研究
        </button>
        <button type="button" onClick={onEditRule}>
          编辑我的规则
        </button>
        <button type="button" onClick={() => setResearchCards(true)}>
          继续研究
        </button>
        {question && (
          <button type="button" onClick={onKnowledge}>
            {question.kind === "candle" ? "帮店员挂价牌" : "帮学徒看规则"}
          </button>
        )}
      </div>
      {notice && (
        <p className="shop-learning-notice" role="status">
          {notice}
        </p>
      )}
      <p>{getRuleLabel(learning.state?.rule ?? null)}</p>
      <p>
        本地模拟，未连接PandaData或真实交易。商品是游戏设定，各自走势来自独立历史产品，价格按首日开盘缩放；不是商品真实市场报价。
      </p>
      {initialSection === "knowledge" && !question && (
        <p>
          本情境暂无新的可答互动。已答或跳过的题目仍保留在本局依据中；可先明确选定规则，再到下一期或另一商品判断。
        </p>
      )}
      {(product.id === "gold" || initialSection === "allocation") && (
        <section
          className="shop-allocation-preview"
          aria-label="买后资金分配预览"
        >
          <h3>这笔用多少现金？</h3>
          <div className="shop-rule-options">
            {([0.25, 0.5, 0.75] as const).map((fraction) => (
              <button
                type="button"
                key={fraction}
                disabled={game.phase !== "decision"}
                onClick={() =>
                  onQuantityChange(
                    getBudgetQuantity(game, current.close, fraction),
                  )
                }
              >
                {fraction * 100}%
                <small>现金预算 {money(game.cash * fraction)}</small>
              </button>
            ))}
          </div>
          <p>
            预算比例以本次可用现金为分母；未下单。实际数量仍受费用和当日成交量限制。
          </p>
          {buy.enabled ? (
            <>
              <dl className="shop-preview-numbers">
                <div>
                  <dt>请求 / 实际可成交</dt>
                  <dd>
                    {quantity.toFixed(6)} / {buy.quantity.toFixed(6)}份
                  </dd>
                </div>
                <div>
                  <dt>现金预览</dt>
                  <dd>
                    {money(game.cash)} → {money(buy.cashAfter)}
                  </dd>
                </div>
                <div>
                  <dt>持有预览</dt>
                  <dd>
                    {units(holding.quantity)} → {units(buy.quantityAfter)}份
                  </dd>
                </div>
                <div>
                  <dt>本笔费用</dt>
                  <dd>{money(buy.fee)}</dd>
                </div>
              </dl>
              <div
                className="shop-allocation-bar"
                role="img"
                aria-label="买后持仓与现金比例预览"
              >
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      ((account.holdingsValue + buy.gross) /
                        Math.max(0.000001, account.totalAssets - buy.fee)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <p>
                买后全部持仓{" "}
                {money(
                  ((account.holdingsValue + buy.gross) /
                    Math.max(0.000001, account.totalAssets - buy.fee)) *
                    100,
                )}
                %；余下为现金。{buy.reason}
              </p>
              <button
                className="shop-learning-primary"
                type="button"
                onClick={onClose}
              >
                使用此数量，回到买卖
              </button>
            </>
          ) : (
            <p>{buy.reason}</p>
          )}
        </section>
      )}
      {(product.id === "coffee" || initialSection === "comparison") &&
        learning.summary && (
          <OpponentComparison
            summary={learning.summary}
            playerAssets={account.totalAssets}
          />
        )}
      {sections.map(({ topic, label }) => (
        <details
          className="shop-detail"
          key={topic}
          open={initialSection === topic || undefined}
        >
          <summary
            onClick={(event) => {
              if (!event.currentTarget.parentElement?.hasAttribute("open"))
                onAction({
                  type: "inspect",
                  id: crypto.randomUUID(),
                  topic,
                  product: product.id,
                });
            }}
          >
            {label}
          </summary>
          {topic === "price" && (
            <>
              <p>
                映射历史产品：{product.symbol}；版本{MARKET_VERSION}。只显示到
                {getMarketDate(game.marketIndex)}，不揭示未来。
              </p>
              <TradingPriceChart game={game} product={product.id} detailed />
              <div
                className="shop-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="已知报价数值，可滚动"
              >
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>价格</th>
                      <th>此前5期均价</th>
                      <th>此前20期均价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{money(row.price)}</td>
                        <td>{row.ma5 === null ? "不足" : money(row.ma5)}</td>
                        <td>{row.ma20 === null ? "不足" : money(row.ma20)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {topic === "risk" && (
            <>
              <p>
                本次到站，原有持仓随价格变化{signed(game.arrivalDelta)}
                小镇币；当前全部持仓未实现盈亏{signed(account.unrealizedProfit)}
                。历史涨跌不保证下一期结果。
              </p>
              <p>
                {product.name}：现价{money(current.close)}；
                {holding.quantity > 0
                  ? `含费均价${money(holding.costBasis / holding.quantity)}；` +
                    `浮动盈亏${signed(current.close * holding.quantity - holding.costBasis)}。`
                  : "当前无持仓成本。"}
                未卖出的估值变化与已经卖出的盈亏分别记录。
              </p>
            </>
          )}
          {topic === "cost" && (
            <p>
              每笔成交费用{game.feeBps / 100}%，本局累计费用
              {money(account.fees)}
              。买入费用计入持仓成本；卖出净款扣除卖出费用。虚线为当前持仓的含费平均成本，不是过去每一天的成本。
            </p>
          )}
          {topic === "holdings" && (
            <>
              <p>
                现金{money(account.cash)}；持仓市值
                {money(account.holdingsValue)}；总资产
                {money(account.totalAssets)}；总盈亏{signed(account.netProfit)}
                。
              </p>
              <div
                className="shop-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="持仓表"
              >
                <table>
                  <thead>
                    <tr>
                      <th>商品</th>
                      <th>份数</th>
                      <th>成本</th>
                      <th>当前市值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCT_IDS.map((id) => (
                      <tr key={id}>
                        <td>{getProduct(id).name}</td>
                        <td>{units(game.holdings[id].quantity)}</td>
                        <td>{money(game.holdings[id].costBasis)}</td>
                        <td>
                          {money(
                            getQuote(id, game.marketIndex).close *
                              game.holdings[id].quantity,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {topic === "history" && (
            <div
              className="shop-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="成交记录"
            >
              <table>
                <thead>
                  <tr>
                    <th>轮次/日期</th>
                    <th>商品/动作</th>
                    <th>请求/实际</th>
                    <th>价格</th>
                    <th>费用</th>
                    <th>现金余额</th>
                  </tr>
                </thead>
                <tbody>
                  {game.trades.map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        {trade.round} · {trade.date}
                      </td>
                      <td>
                        {getProduct(trade.product).name} ·{" "}
                        {trade.side === "buy" ? "买入" : "卖出"}
                      </td>
                      <td>
                        {units(trade.requestedQuantity)} /{" "}
                        {units(trade.quantity)}
                      </td>
                      <td>{money(trade.price)}</td>
                      <td>{money(trade.fee)}</td>
                      <td>{money(trade.cashAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!game.trades.length && <p>本局尚无实际成交。</p>}
            </div>
          )}
        </details>
      ))}
    </GameDialog>
  );
}

function OpponentComparison({
  summary,
  playerAssets,
}: {
  summary: LearningSummary;
  playerAssets: number;
}) {
  const curves = [summary.equityCurve, summary.opponentCurve];
  const values = curves.flatMap((curve) => curve.map((point) => point.equity));
  const low = Math.min(...values),
    high = Math.max(...values);
  const margin = Math.max(1, (high - low) * 0.1);
  const length = Math.max(...curves.map((curve) => curve.length), 2);
  const path = (curve: LearningSummary["equityCurve"]) =>
    curve
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${20 + (index / (length - 1)) * 580},` +
          `${150 - ((point.equity - low + margin) / (high - low + 2 * margin)) * 130}`,
      )
      .join(" ");
  return (
    <section className="shop-comparison" aria-label="同机会固定规则商人对照">
      <h3>同一起点 · 同一交易机会</h3>
      <div className="shop-comparison-values">
        <strong>我 {money(playerAssets)}</strong>
        <strong>规则商人 {money(summary.opponent.snapshot.totalAssets)}</strong>
      </div>
      <svg
        viewBox="0 0 620 170"
        role="img"
        aria-label="玩家和固定规则商人的实际账户曲线"
      >
        <path
          d={path(summary.equityCurve)}
          fill="none"
          stroke="#3f7957"
          strokeWidth="3"
        />
        <path
          d={path(summary.opponentCurve)}
          fill="none"
          stroke="#bd8b36"
          strokeWidth="3"
          strokeDasharray="6 3"
        />
      </svg>
      <p>{summary.opponent.description}</p>
      <details className="shop-detail">
        <summary>看每轮为何不同</summary>
        <ol>
          {summary.opponent.actions.map((action) => (
            <li key={action.round}>
              第{action.round}轮 · {getProduct(action.product).name} ·
              {action.action === "buy"
                ? "买入"
                : action.action === "sell"
                  ? "卖出"
                  : "等待"}
              {action.quantity > 0 ? `${units(action.quantity)}份` : ""}：
              {action.reason}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

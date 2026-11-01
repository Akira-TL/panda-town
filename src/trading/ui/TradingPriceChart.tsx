"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { getVisibleCandles } from "../market";
import { getIndicatorSeries } from "../indicators";
import type { ProductId, TradingGame } from "../model";
import { getProduct } from "../products";
import { money, signed, units } from "./format";
import "./indicator-research.css";

export interface TradingPriceChartProps {
  game: TradingGame;
  product: ProductId;
  detailed?: boolean;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}

const LEFT = 34,
  RIGHT = 608,
  TOP = 8,
  PRICE_BOTTOM = 93,
  VOLUME_TOP = 102,
  VOLUME_BOTTOM = 126;
const compact = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function TradingPriceChart({
  game,
  product,
  detailed = false,
  selectedIndex: controlledIndex,
  onSelectIndex,
}: TradingPriceChartProps) {
  const titleId = useId(),
    readoutId = useId();
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [localIndex, setLocalIndex] = useState(game.marketIndex);
  useEffect(() => setLocalIndex(game.marketIndex), [product, game.marketIndex]);
  const candles = useMemo(
    () => getVisibleCandles(product, game.marketIndex),
    [product, game.marketIndex],
  );
  const indicators = useMemo(() => getIndicatorSeries(candles), [candles]);
  const selectedIndex = Math.max(
    0,
    Math.min(controlledIndex ?? localIndex, game.marketIndex),
  );
  const selected = candles[selectedIndex]!,
    current = candles.at(-1)!;
  const windowStart = Math.max(
    0,
    Math.min(selectedIndex - 12, candles.length - 24),
  );
  const window = candles.slice(windowStart, windowStart + 24);
  const lastWindowIndex = window.at(-1)!.index;
  const holding = game.holdings[product];
  const cost =
    holding.quantity > 0 ? holding.costBasis / holding.quantity : null;
  // 直接采用规则计算模块的此前窗口，排除当期，不在界面另算前高。
  const priorHigh =
    product === "chips" ? indicators[current.index]!.priorHigh20 : null;
  const trades = game.trades.filter(
    (trade) =>
      trade.product === product &&
      trade.marketIndex >= windowStart &&
      trade.marketIndex <= lastWindowIndex &&
      trade.marketIndex <= game.marketIndex,
  );
  const references = window.flatMap(
    (point) => indicators[point.index]!.ma20 ?? [],
  );
  const values = [
    ...window.flatMap((point) => [point.low, point.high]),
    ...references,
    ...trades.map((trade) => trade.price),
    ...(cost === null ? [] : [cost]),
    ...(priorHigh === null ? [] : [priorHigh]),
  ];
  const low = Math.min(...values),
    high = Math.max(...values);
  const pad = Math.max(0.1, (high - low) * 0.1);
  const y = (price: number) =>
    PRICE_BOTTOM -
    ((price - low + pad) / (high - low + 2 * pad)) * (PRICE_BOTTOM - TOP);
  const x = (index: number) =>
    LEFT +
    ((index - windowStart) / Math.max(1, window.length - 1)) * (RIGHT - LEFT);
  const volumeMax = Math.max(1, ...window.map((point) => point.volume));
  const bodyWidth = Math.min(13, ((RIGHT - LEFT) / window.length) * 0.56);
  const previous = candles[current.index - 1]?.close ?? null;
  const change = previous === null ? null : current.close - previous;
  const percentage =
    previous === null || change === null ? null : (change / previous) * 100;
  const selectedIndicator = indicators[selectedIndex]!;
  const name = getProduct(product).name;
  function select(index: number) {
    const next = Math.max(0, Math.min(index, game.marketIndex));
    setLocalIndex(next);
    onSelectIndex?.(next);
  }
  function keySelect(event: KeyboardEvent<SVGSVGElement>) {
    const next =
      event.key === "ArrowLeft"
        ? selectedIndex - 1
        : event.key === "ArrowRight"
          ? selectedIndex + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? game.marketIndex
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }
  function pointSelect(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    const pixel = ((event.clientX - bounds.left) / bounds.width) * 620;
    select(
      windowStart +
        Math.round(((pixel - LEFT) / (RIGHT - LEFT)) * (window.length - 1)),
    );
  }
  let meanPath = "",
    meanStarted = false;
  for (const point of window) {
    const value = indicators[point.index]!.ma20;
    if (value === null) {
      meanStarted = false;
      continue;
    }
    meanPath += `${meanStarted ? "L" : "M"}${x(point.index)},${y(value)} `;
    meanStarted = true;
  }
  return (
    <section
      className="shop-price-chart market-candles"
      data-detailed={detailed}
      data-product={product}
      data-visible-price-count={candles.length}
      data-visible-price-date={current.date}
      data-market-index={game.marketIndex}
      data-selected-index={selectedIndex}
      data-chart-mode={mode}
      aria-label={`${name}已知历史日线`}
    >
      <div className="shop-price-readout">
        <strong title={`${current.date} · 小镇币/份`}>
          现价 {money(current.close)}
        </strong>
        <span
          className="market-day-change"
          data-direction={(change ?? 0) >= 0 ? "up" : "down"}
        >
          日涨跌{" "}
          {change === null
            ? "无前收"
            : `${change >= 0 ? "↑" : "↓"} ${signed(change)}小镇币/份（${signed(percentage!)}%）`}
        </span>
        {cost !== null && <small>┄ 当前含费成本 {money(cost)}小镇币/份</small>}
      </div>
      <svg
        className="market-candle-svg"
        viewBox="0 0 620 140"
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={readoutId}
        tabIndex={0}
        onKeyDown={keySelect}
        onPointerDown={pointSelect}
      >
        <title id={titleId}>
          {`${name}真实历史游戏映射，每根一天，已知截至${current.date}。` +
            (mode === "candle"
              ? "实体连接开盘与收盘，影线表示最高与最低。"
              : "折线连接每日收盘。") +
            "价格单位为小镇币/份，下方为对应成交量。左右键或下方滑块选择日期。" +
            "金色虚线为当前含费成本，不是预测。" +
            (priorHigh === null
              ? ""
              : `${current.date}的此前20根最高为${money(priorHigh)}小镇币/份，灰橙虚线排除当期。`)}
        </title>
        {[0, 0.5, 1].map((fraction) => {
          const value = high + pad - fraction * (high - low + pad * 2);
          const py = TOP + fraction * (PRICE_BOTTOM - TOP);
          return (
            <g key={fraction}>
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={py}
                y2={py}
                className="shop-price-grid"
              />
              <text
                x={LEFT - 4}
                y={py + 3}
                textAnchor="end"
                className="market-axis"
              >
                {money(value)}
              </text>
            </g>
          );
        })}
        {window.map((point) => {
          const rising = point.close >= point.open;
          const px = x(point.index),
            bodyTop = Math.min(y(point.open), y(point.close));
          return (
            <g
              key={point.index}
              data-candle-index={point.index}
              data-candle-date={point.date}
              data-open={point.open}
              data-high={point.high}
              data-low={point.low}
              data-close={point.close}
              className={rising ? "market-candle-up" : "market-candle-down"}
            >
              {mode === "candle" && (
                <>
                  <line
                    x1={px}
                    x2={px}
                    y1={y(point.high)}
                    y2={y(point.low)}
                    className="market-wick"
                  />
                  <rect
                    x={px - bodyWidth / 2}
                    y={bodyTop}
                    width={bodyWidth}
                    height={Math.max(
                      1,
                      Math.abs(y(point.open) - y(point.close)),
                    )}
                    className="market-body"
                  />
                </>
              )}
              <rect
                data-volume={point.volume}
                x={px - bodyWidth / 2}
                y={
                  VOLUME_BOTTOM -
                  (point.volume / volumeMax) * (VOLUME_BOTTOM - VOLUME_TOP)
                }
                width={bodyWidth}
                height={
                  (point.volume / volumeMax) * (VOLUME_BOTTOM - VOLUME_TOP)
                }
                className="market-volume-bar"
              />
            </g>
          );
        })}
        {mode === "line" && (
          <path
            className="market-close-line"
            d={window
              .map(
                (point, i) =>
                  `${i ? "L" : "M"}${x(point.index)},${y(point.close)}`,
              )
              .join(" ")}
          />
        )}
        {meanPath && <path d={meanPath} className="market-mean-line" />}
        {priorHigh !== null && (
          <line
            data-prior-high20={priorHigh}
            data-reference-index={current.index}
            x1={LEFT}
            x2={RIGHT}
            y1={y(priorHigh)}
            y2={y(priorHigh)}
            className="market-prior-high-line"
          >
            <title>
              {`${current.date} 此前20根最高 ${money(priorHigh)}小镇币/份（不含当期）`}
            </title>
          </line>
        )}
        {cost !== null && (
          <line
            data-cost-price={cost}
            x1={LEFT}
            x2={RIGHT}
            y1={y(cost)}
            y2={y(cost)}
            className="shop-cost-line"
          />
        )}
        {trades.map((trade) => {
          const px = x(trade.marketIndex),
            py = y(trade.price);
          return (
            <path
              key={trade.id}
              data-trade-id={trade.id}
              data-trade-date={trade.date}
              d={
                trade.side === "buy"
                  ? `M${px},${py - 7} l-5,9 h10 Z`
                  : `M${px},${py + 7} l-5,-9 h10 Z`
              }
              className={
                trade.side === "buy" ? "shop-buy-point" : "shop-sell-point"
              }
            >
              <title>
                {`${trade.date} ${trade.side === "buy" ? "买入" : "卖出"}${units(trade.quantity)}份，` +
                  `${money(trade.price)}小镇币/份，费用${money(trade.fee)}小镇币`}
              </title>
            </path>
          );
        })}
        <line
          x1={x(selectedIndex)}
          x2={x(selectedIndex)}
          y1={TOP}
          y2={VOLUME_BOTTOM}
          className="market-selection-line"
        />
        <circle
          cx={x(selectedIndex)}
          cy={y(selected.close)}
          r={3}
          className="shop-last-price"
        />
        <text x={LEFT} y={138} className="market-axis">
          {window[0]!.date.slice(5)}
        </text>
        <text x={RIGHT} y={138} textAnchor="end" className="market-axis">
          {window.at(-1)!.date.slice(5)} · 日线
        </text>
        {(priorHigh !== null || trades.length > 0) && (
          <text
            x={(LEFT + RIGHT) / 2}
            y={138}
            textAnchor="middle"
            className="market-axis market-inline-legend"
          >
            {priorHigh !== null && (
              <tspan className="market-prior-high-label">┄ 此前20根最高 </tspan>
            )}
            {trades.some((trade) => trade.side === "buy") && (
              <tspan className="market-buy-label">▲买 </tspan>
            )}
            {trades.some((trade) => trade.side === "sell") && (
              <tspan className="market-sell-label">▼卖</tspan>
            )}
          </text>
        )}
      </svg>
      <output id={readoutId} className="market-four-prices" aria-live="polite">
        <b>{selected.date}</b>
        <span>开 {money(selected.open)}</span>
        <span>高 {money(selected.high)}</span>
        <span>低 {money(selected.low)}</span>
        <span>收 {money(selected.close)}小镇币/份</span>
        <span>
          {selected.close > selected.open
            ? "阳线（收>开）"
            : selected.close < selected.open
              ? "阴线（收<开）"
              : "平线（收=开）"}
        </span>
        <span title={`${units(selected.volume)}份`}>
          量 {compact.format(selected.volume)}份
        </span>
        {product === "fruit" && (
          <span>
            量比{" "}
            {selectedIndicator.volumeRatio5 === null
              ? "前史不足"
              : `${money(selectedIndicator.volumeRatio5)}倍（此前5期）`}
          </span>
        )}
      </output>
      <div className="market-chart-controls">
        <button
          type="button"
          aria-pressed={mode === "candle"}
          onClick={() => setMode("candle")}
        >
          K线
        </button>
        <button
          type="button"
          aria-pressed={mode === "line"}
          onClick={() => setMode("line")}
        >
          折线
        </button>
        <button
          type="button"
          onClick={() => select(selectedIndex - 1)}
          disabled={selectedIndex === 0}
          aria-label="查看前一根日线"
        >
          ‹
        </button>
        <input
          type="range"
          min={0}
          max={game.marketIndex}
          value={selectedIndex}
          aria-label={`选择${name}已知日线日期`}
          aria-valuetext={selected.date}
          onChange={(event) => select(Number(event.target.value))}
        />
        <button
          type="button"
          onClick={() => select(selectedIndex + 1)}
          disabled={selectedIndex === game.marketIndex}
          aria-label="查看后一根日线"
        >
          ›
        </button>
      </div>
      {detailed && (
        <p className="market-chart-legend">
          {candles[0]!.date} — {current.date} · 价格：小镇币/份 · 量：份 ·
          橙线：此前20期均价（不含当期）
          {cost !== null && " · 金色虚线：当前含费成本"}
          {priorHigh !== null && " · 灰橙虚线：此前20根最高（不含当期）"}
          {trades.some((trade) => trade.side === "buy") && " · ▲实际买入"}
          {trades.some((trade) => trade.side === "sell") && " · ▼实际卖出"}
        </p>
      )}
    </section>
  );
}

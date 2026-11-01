"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { GameDialog } from "../../ui/GameDialog";
import { getVisibleCandles, type CandlePoint } from "../market";
import { getIndicatorSeries, type IndicatorPoint } from "../indicators";
import type { ProductId, TradingGame } from "../model";
import { getProduct } from "../products";
import { TradingPriceChart } from "./TradingPriceChart";
import "./indicator-research.css";

export type IndicatorId = "ema" | "macd" | "rsi" | "kdj" | "boll" | "atr";
const IDS: readonly IndicatorId[] = [
  "ema",
  "macd",
  "rsi",
  "kdj",
  "boll",
  "atr",
];
const META: Record<
  IndicatorId,
  {
    tab: string;
    title: string;
    parameters: string;
    explanation: string;
    warmup: number;
    unit: string;
  }
> = {
  ema: {
    tab: "EMA",
    title: "指数移动平均线（EMA）",
    parameters: "12期；首12个收盘的简单平均作种子",
    explanation: "近期价格权重更高；均线仍会滞后，不保证之后涨跌。",
    warmup: 12,
    unit: "小镇币/份",
  },
  macd: {
    tab: "MACD",
    title: "指数平滑异同移动平均线（MACD）",
    parameters: "12、26、9；柱体=DIF−DEA，不乘2；完整读数需34期",
    explanation: "比较差值线与信号线，观察动量变化；交叉不是必涨必跌。",
    warmup: 34,
    unit: "小镇币/份",
  },
  rsi: {
    tab: "RSI",
    title: "相对强弱指数（RSI）",
    parameters: "14期，Wilder平滑；30/70为常用参考",
    explanation: "比较近期上涨与下跌的相对强度；越过70或30不等于马上反转。",
    warmup: 15,
    unit: "指数值",
  },
  kdj: {
    tab: "KDJ",
    title: "随机指标（KDJ）",
    parameters: "9、3、3；K和D初始为50",
    explanation: "观察收盘在近期高低区间中的位置；J可超出0至100。",
    warmup: 9,
    unit: "指标值",
  },
  boll: {
    tab: "布林带",
    title: "布林带",
    parameters: "20期、2倍总体标准差，窗口含当期收盘",
    explanation: "观察价格相对均价和波动范围的位置；触轨不是买卖命令。",
    warmup: 20,
    unit: "小镇币/份",
  },
  atr: {
    tab: "ATR",
    title: "平均真实波幅（ATR）",
    parameters: "14期Wilder平滑；考虑前收盘与当日高低价",
    explanation: "度量价格波动幅度，不判断涨跌方向；可标记真实波幅读数。",
    warmup: 14,
    unit: "小镇币/份",
  },
};
interface KeyPoint {
  index: number;
  date: string;
  direction: "向上" | "向下";
  label: string;
  threshold: number;
}
interface PlotLine {
  label: string;
  color: string;
  values: Array<number | null>;
}
const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });
function valid(point: IndicatorPoint | undefined, id: IndicatorId): boolean {
  return !!point && point[id] !== null;
}

/** 只检测相邻两根已经有效的读数；不补造预热段或盘中交叉。 */
function keyPoints(
  id: IndicatorId,
  points: readonly IndicatorPoint[],
  candles: readonly CandlePoint[],
): KeyPoint[] {
  const result: KeyPoint[] = [];
  for (let index = 1; index < points.length; index++) {
    const current = points[index]!,
      previous = points[index - 1]!;
    if (!valid(current, id) || !valid(previous, id)) continue;
    const cross = (
      before: number,
      now: number,
      threshold: number,
      up: string,
      down: string,
    ) => {
      const direction =
        before <= 0 && now > 0
          ? "向上"
          : before >= 0 && now < 0
            ? "向下"
            : null;
      if (direction)
        result.push({
          index,
          date: current.date,
          direction,
          label: direction === "向上" ? up : down,
          threshold,
        });
    };
    if (id === "ema")
      cross(
        candles[index - 1]!.close - previous.ema!,
        candles[index]!.close - current.ema!,
        current.ema!,
        "收盘上穿EMA12",
        "收盘下穿EMA12",
      );
    if (id === "macd")
      cross(
        previous.macd!.dif - previous.macd!.dea,
        current.macd!.dif - current.macd!.dea,
        current.macd!.dea,
        "DIF上穿DEA",
        "DIF下穿DEA",
      );
    if (id === "rsi")
      for (const threshold of [30, 70])
        cross(
          previous.rsi! - threshold,
          current.rsi! - threshold,
          threshold,
          `RSI上穿${threshold}`,
          `RSI下穿${threshold}`,
        );
    if (id === "kdj")
      cross(
        previous.kdj!.k - previous.kdj!.d,
        current.kdj!.k - current.kdj!.d,
        current.kdj!.d,
        "K上穿D",
        "K下穿D",
      );
    if (id === "boll") {
      cross(
        candles[index - 1]!.close - previous.boll!.upper,
        candles[index]!.close - current.boll!.upper,
        current.boll!.upper,
        "收盘穿出上轨",
        "收盘回到上轨内",
      );
      cross(
        candles[index - 1]!.close - previous.boll!.lower,
        candles[index]!.close - current.boll!.lower,
        current.boll!.lower,
        "收盘回到下轨内",
        "收盘穿出下轨",
      );
    }
  }
  return result;
}
function linesFor(
  id: IndicatorId,
  points: readonly IndicatorPoint[],
  candles: readonly CandlePoint[],
): PlotLine[] {
  const line = (
    label: string,
    color: string,
    read: (point: IndicatorPoint) => number | null,
  ) => ({ label, color, values: points.map(read) });
  if (id === "ema")
    return [
      line("EMA12", "#396d4b", (p) => p.ema),
      { label: "收盘", color: "#8b927f", values: candles.map((c) => c.close) },
    ];
  if (id === "macd")
    return [
      line("DIF", "#377ca0", (p) => p.macd?.dif ?? null),
      line("DEA", "#cf8535", (p) => p.macd?.dea ?? null),
    ];
  if (id === "rsi") return [line("RSI14", "#547c58", (p) => p.rsi)];
  if (id === "kdj")
    return [
      line("K", "#377ca0", (p) => p.kdj?.k ?? null),
      line("D", "#cf8535", (p) => p.kdj?.d ?? null),
      line("J", "#9b709b", (p) => p.kdj?.j ?? null),
    ];
  if (id === "boll")
    return [
      line("中轨", "#cf8535", (p) => p.boll?.middle ?? null),
      line("上轨", "#66967a", (p) => p.boll?.upper ?? null),
      line("下轨", "#66967a", (p) => p.boll?.lower ?? null),
      { label: "收盘", color: "#737e79", values: candles.map((c) => c.close) },
    ];
  return [line("ATR14", "#547c58", (p) => p.atr)];
}
function readings(
  id: IndicatorId,
  point: IndicatorPoint,
): Array<[string, number]> {
  if (id === "ema" && point.ema !== null) return [["EMA12", point.ema]];
  if (id === "macd" && point.macd)
    return [
      ["DIF", point.macd.dif],
      ["DEA", point.macd.dea],
      ["柱体", point.macd.histogram],
    ];
  if (id === "rsi" && point.rsi !== null) return [["RSI14", point.rsi]];
  if (id === "kdj" && point.kdj)
    return [
      ["K", point.kdj.k],
      ["D", point.kdj.d],
      ["J", point.kdj.j],
    ];
  if (id === "boll" && point.boll)
    return [
      ["上轨", point.boll.upper],
      ["中轨", point.boll.middle],
      ["下轨", point.boll.lower],
    ];
  if (id === "atr" && point.atr !== null) return [["ATR14", point.atr]];
  return [];
}

export interface IndicatorResearchProps {
  game: TradingGame;
  product: ProductId;
  onClose: () => void;
  onUseIndicator: (indicator: IndicatorId) => void;
  onInspect?: (
    indicator: IndicatorId,
    kind: "view" | "mark",
    index: number,
  ) => void;
}
export function IndicatorResearch({
  game,
  product,
  onClose,
  onUseIndicator,
  onInspect,
}: IndicatorResearchProps) {
  const [active, setActive] = useState<IndicatorId>("ema");
  const [selected, setSelected] = useState(game.marketIndex);
  const currentInspect = useRef(onInspect);
  currentInspect.current = onInspect;
  const id = useId(),
    plotTitle = useId();
  const candles = useMemo(
    () => getVisibleCandles(product, game.marketIndex),
    [product, game.marketIndex],
  );
  const points = useMemo(() => getIndicatorSeries(candles), [candles]);
  const markers = useMemo(
    () => keyPoints(active, points, candles),
    [active, points, candles],
  );
  const index = Math.min(selected, game.marketIndex),
    point = points[index]!;
  const meta = META[active],
    isValid = valid(point, active);
  useEffect(() => setSelected(game.marketIndex), [product, game.marketIndex]);
  useEffect(() => {
    currentInspect.current?.(
      active,
      "view",
      Math.min(selected, game.marketIndex),
    );
  }, [active, product, game.marketIndex]);
  function select(next: number, mark = true) {
    const safe = Math.max(0, Math.min(next, game.marketIndex));
    setSelected(safe);
    if (mark && valid(points[safe], active))
      currentInspect.current?.(active, "mark", safe);
  }
  const start = Math.max(0, Math.min(index - 15, candles.length - 30));
  const end = Math.min(candles.length, start + 30);
  const lines = linesFor(
    active,
    points.slice(start, end),
    candles.slice(start, end),
  );
  const visibleMarkers = markers.filter(
    (marker) => marker.index >= start && marker.index < end,
  );
  const hasPlot = points.slice(start, end).some((item) => valid(item, active));
  const reference =
    active === "rsi"
      ? [30, 70]
      : active === "kdj"
        ? [20, 80]
        : active === "macd"
          ? [0]
          : [];
  const values = lines.flatMap((line) =>
    line.values.filter((value): value is number => value !== null),
  );
  if (active === "macd")
    values.push(
      ...points
        .slice(start, end)
        .flatMap((item) => (item.macd ? [item.macd.histogram] : [])),
      0,
    );
  if (active === "rsi" || active === "kdj") values.push(0, 100);
  if (active === "atr") values.push(0);
  const min = values.length ? Math.min(...values, ...reference) : 0;
  const max = values.length ? Math.max(...values, ...reference) : 1;
  const pad = Math.max(0.01, (max - min) * 0.12);
  const low = active === "rsi" ? 0 : min - pad,
    high = active === "rsi" ? 100 : max + pad;
  const x = (at: number) =>
    40 + ((at - start) / Math.max(1, end - start - 1)) * 566;
  const y = (value: number) => 116 - ((value - low) / (high - low)) * 106;
  const selectedEvents = markers.filter((marker) => marker.index === index);
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, tab: IndicatorId) {
    const at = IDS.indexOf(tab);
    const next =
      event.key === "ArrowRight"
        ? (at + 1) % IDS.length
        : event.key === "ArrowLeft"
          ? (at + IDS.length - 1) % IDS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? IDS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(IDS[next]!);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }
  return (
    <GameDialog
      title={`${getProduct(product).name} · 指标研究`}
      onClose={onClose}
    >
      <div
        className="indicator-research"
        data-active-indicator={active}
        data-selected-index={index}
      >
        <div
          role="tablist"
          aria-label="选择研究指标"
          className="indicator-tabs"
        >
          {IDS.map((tab) => (
            <button
              type="button"
              role="tab"
              key={tab}
              id={`${id}-${tab}`}
              aria-selected={active === tab}
              aria-controls={`${id}-panel`}
              tabIndex={active === tab ? 0 : -1}
              onKeyDown={(event) => tabKey(event, tab)}
              onClick={() => setActive(tab)}
            >
              {META[tab].tab}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-${active}`}
        >
          <TradingPriceChart
            game={game}
            product={product}
            detailed
            selectedIndex={index}
            onSelectIndex={select}
          />
          <div className="indicator-study-grid">
            <section className="indicator-plot-card" aria-label={meta.title}>
              <div className="indicator-plot-heading">
                <strong>{meta.title}</strong>
                <small>{meta.unit}</small>
              </div>
              {hasPlot ? (
                <svg
                  viewBox="0 0 620 140"
                  preserveAspectRatio="none"
                  className="indicator-value-plot"
                  role="img"
                  aria-labelledby={plotTitle}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight"
                    ) {
                      event.preventDefault();
                      select(index + (event.key === "ArrowLeft" ? -1 : 1));
                    }
                  }}
                  onPointerDown={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    if (bounds.width)
                      select(
                        start +
                          Math.round(
                            ((((event.clientX - bounds.left) / bounds.width) *
                              620 -
                              40) /
                              566) *
                              (end - start - 1),
                          ),
                      );
                  }}
                >
                  <title id={plotTitle}>
                    {`${meta.title}，${meta.parameters}。只含截至${candles.at(-1)!.date}的已知数据。` +
                      "点按图或使用左右键选择读数。圆圈是相邻有效收盘读数确认的穿越，不代表盘中时点或预测。"}
                  </title>
                  {[0, 0.5, 1].map((fraction) => {
                    const value = high - fraction * (high - low);
                    return (
                      <g key={fraction}>
                        <line
                          x1={40}
                          x2={606}
                          y1={y(value)}
                          y2={y(value)}
                          className="shop-price-grid"
                        />
                        <text
                          x={35}
                          y={y(value) + 3}
                          textAnchor="end"
                          className="market-axis"
                        >
                          {decimal.format(value)}
                        </text>
                      </g>
                    );
                  })}
                  {reference.map((value) => (
                    <g key={value}>
                      <line
                        x1={40}
                        x2={606}
                        y1={y(value)}
                        y2={y(value)}
                        className="indicator-threshold"
                      />
                      <text x={44} y={y(value) - 3} className="market-axis">
                        {value}参考
                      </text>
                    </g>
                  ))}
                  {active === "macd" &&
                    points
                      .slice(start, end)
                      .map(
                        (item) =>
                          item.macd && (
                            <rect
                              key={item.index}
                              data-macd-histogram={item.macd.histogram}
                              x={x(item.index) - 4}
                              width={8}
                              y={Math.min(y(0), y(item.macd.histogram))}
                              height={Math.abs(y(0) - y(item.macd.histogram))}
                              className={
                                item.macd.histogram >= 0
                                  ? "indicator-hist-positive"
                                  : "indicator-hist-negative"
                              }
                            />
                          ),
                      )}
                  {lines.map((line) => {
                    let started = false;
                    const d = line.values
                      .map((value, offset) => {
                        if (value === null) {
                          started = false;
                          return "";
                        }
                        const segment = `${started ? "L" : "M"}${x(start + offset)},${y(value)}`;
                        started = true;
                        return segment;
                      })
                      .join(" ");
                    return d ? (
                      <path
                        key={line.label}
                        d={d}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null;
                  })}
                  {visibleMarkers.map((marker, offset) => {
                    const value = lines[0]!.values[marker.index - start];
                    return value === null || value === undefined ? null : (
                      <circle
                        key={`${marker.index}-${offset}`}
                        data-keypoint-index={marker.index}
                        cx={x(marker.index)}
                        cy={y(value)}
                        r={5}
                        className="indicator-keypoint"
                      >
                        <title>
                          {`${marker.date} ${marker.label}，参考值` +
                            `${decimal.format(marker.threshold)}${meta.unit}`}
                        </title>
                      </circle>
                    );
                  })}
                  <line
                    x1={x(index)}
                    x2={x(index)}
                    y1={10}
                    y2={116}
                    className="market-selection-line"
                  />
                  <text x={40} y={137} className="market-axis">
                    {candles[start]!.date.slice(5)}
                  </text>
                  <text
                    x={606}
                    y={137}
                    textAnchor="end"
                    className="market-axis"
                  >
                    {candles[end - 1]!.date.slice(5)}
                  </text>
                </svg>
              ) : (
                <div className="indicator-warmup" role="status">
                  已知{candles.length}期；{meta.tab}需要至少{meta.warmup}
                  期，当前窗口尚无有效读数。
                </div>
              )}
              <div className="indicator-legend">
                {lines.map((line) => (
                  <span key={line.label}>
                    <i style={{ background: line.color }} />
                    {line.label}
                  </span>
                ))}
                {active === "macd" && <span>柱体 DIF−DEA</span>}
              </div>
              <div
                className="indicator-current"
                aria-live="polite"
                data-indicator-valid={isValid}
              >
                <strong>{point.date}</strong>
                {isValid ? (
                  readings(active, point).map(([label, value]) => (
                    <span key={label}>
                      {label} {decimal.format(value)}
                    </span>
                  ))
                ) : (
                  <span>该期仍在预热，不显示数值</span>
                )}
              </div>
            </section>
            <aside className="indicator-facts">
              <p>{meta.explanation}</p>
              <details>
                <summary>参数与计算口径</summary>
                <p>{meta.parameters}</p>
                <p>
                  指标取已知收盘数据；交易图橙线是此前20期均价，排除当期。所有值来自同一计算模块。
                </p>
              </details>
              <div className="indicator-event-readout" aria-live="polite">
                {selectedEvents.length ? (
                  selectedEvents.map((event, at) => (
                    <p key={at}>
                      {event.date} · {event.direction} · {event.label}
                      <br />
                      参考值 {decimal.format(event.threshold)}
                      {meta.unit}
                    </p>
                  ))
                ) : (
                  <p>
                    {active === "atr"
                      ? "ATR没有涨跌方向或交叉信号，可记录真实波幅。"
                      : "该期没有由相邻有效读数确认的穿越。"}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="indicator-mark"
                disabled={!isValid}
                onClick={() => currentInspect.current?.(active, "mark", index)}
              >
                标记选中读数
              </button>
              <div
                className="indicator-keypoint-list"
                aria-label="最近已知穿越"
              >
                {markers
                  .slice(-3)
                  .reverse()
                  .map((event, at) => (
                    <button
                      type="button"
                      key={`${event.index}-${at}`}
                      onClick={() => select(event.index)}
                    >
                      {event.date.slice(5)} · {event.label}
                    </button>
                  ))}
                {!markers.length && active !== "atr" && (
                  <small>已知区间暂无有效穿越；不补造参考点。</small>
                )}
              </div>
              <button
                type="button"
                className="indicator-use"
                onClick={() => onUseIndicator(active)}
              >
                用于我的规则
              </button>
              <small>仅记录你的主动选择，不执行交易或保证收益。</small>
              <button
                type="button"
                className="indicator-back"
                onClick={onClose}
              >
                返回交易
              </button>
            </aside>
          </div>
        </div>
      </div>
    </GameDialog>
  );
}

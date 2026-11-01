"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AssetId, SimulationResult } from "../model";
import {
  buildPriceSeries,
  selectPriceWindow,
  visiblePriceFrame,
} from "./price-series";
import { number } from "./format";
import "./price-chart.css";

export interface PriceChartProps {
  runs: readonly SimulationResult[];
  runId?: string;
  reducedMotion?: boolean;
  suspended?: boolean;
  replayKey?: string;
  compact?: boolean;
}

/** 实际商品收盘价回放；检验段只有匹配已完成运行后才取得。 */
export function PriceChart({
  runs,
  runId,
  reducedMotion = false,
  suspended = false,
  replayKey,
  compact = false,
}: PriceChartProps) {
  const id = useId();
  const [asset, setAsset] = useState<AssetId>("bamboo");
  const window = useMemo(() => selectPriceWindow(runs, runId), [runs, runId]);
  const series = useMemo(
    () => buildPriceSeries(window.bars, window.warmup, asset),
    [window, asset],
  );
  const [count, setCount] = useState(series.length);
  const [playing, setPlaying] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const noMotion = reducedMotion || systemReduced;
  const playbackAllowed = useRef({ noMotion, suspended });
  playbackAllowed.current = { noMotion, suspended };
  const visible = noMotion ? series.length : Math.min(count, series.length);
  const frame = visiblePriceFrame(series, visible, window.trades, asset);
  const current = frame.current;
  const name = asset === "bamboo" ? "竹材" : "松果";
  useEffect(() => {
    const media = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const replayResult =
      Boolean(window.runId) &&
      !playbackAllowed.current.noMotion &&
      !playbackAllowed.current.suspended;
    setCount(replayResult ? 1 : window.bars.length);
    setPlaying(replayResult);
  }, [window.runId, window.bars.length, replayKey]);
  useEffect(() => {
    if (noMotion || suspended) {
      setPlaying(false);
      if (noMotion) setCount(series.length);
    }
  }, [noMotion, suspended, series.length]);
  useEffect(() => {
    if (!playing || noMotion || suspended) return;
    const timer = globalThis.setInterval(
      () =>
        setCount((value) =>
          Math.min(
            series.length,
            value + Math.max(1, Math.ceil(series.length / 60)),
          ),
        ),
      85,
    );
    return () => globalThis.clearInterval(timer);
  }, [playing, noMotion, suspended, series.length]);
  useEffect(() => {
    if (playing && count >= series.length) setPlaying(false);
  }, [count, series.length, playing]);
  const x = (index: number) =>
    10 + (index / Math.max(1, series.length - 1)) * 620;
  const y = (value: number) =>
    135 - ((value - frame.min) / Math.max(0.001, frame.max - frame.min)) * 120;
  const averagePath = (key: "ma5" | "ma20") =>
    frame.points.reduce(
      (path, point, index) =>
        point[key] === null
          ? path
          : `${path}${path ? " L" : "M"}${x(index)},${y(point[key])}`,
      "",
    );
  const direction = !current?.change
    ? "flat"
    : current.change > 0
      ? "up"
      : "down";
  function replay() {
    setCount(1);
    setPlaying(true);
  }
  function toggle() {
    if (playing) setPlaying(false);
    else {
      if (visible >= series.length) setCount(1);
      setPlaying(true);
    }
  }
  const latestTrade = frame.trades.at(-1);
  const changeWords = {
    up: compact ? "↑" : "↑ 较前期上涨",
    down: compact ? "↓" : "↓ 较前期下跌",
    flat: compact ? "—" : "— 与前期持平",
  };
  const changeText =
    current?.change === null || !current
      ? "无前期可比记录"
      : changeWords[direction] + " " + number(Math.abs(current.change));
  return (
    <section
      className="research-price-chart"
      aria-label="小镇商品实际价格回放"
      data-price-segment={window.segment}
      data-visible-price-count={frame.points.length}
      data-visible-price-date={current?.date ?? ""}
      data-price-playing={playing}
      data-compact={compact}
    >
      <header className="research-price-heading">
        {!compact && (
          <h3>
            小镇商品价格 · 历史回放{" "}
            <small>
              {window.segment === "research" ? "公开研究段" : "已实际检验段"}
            </small>
          </h3>
        )}
        <div
          className="research-price-assets"
          role="group"
          aria-label="选择商品"
        >
          <button
            type="button"
            aria-pressed={asset === "bamboo"}
            onClick={() => setAsset("bamboo")}
          >
            竹材
          </button>
          <button
            type="button"
            aria-pressed={asset === "pine"}
            onClick={() => setAsset("pine")}
          >
            松果
          </button>
        </div>
        {compact && (
          <button
            className="research-price-mini-play"
            type="button"
            disabled={noMotion || !series.length}
            onClick={toggle}
            aria-label={playing ? "暂停价格回放" : "播放价格回放"}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
        )}
      </header>
      <div className="research-price-readout" data-direction={direction}>
        <strong
          title={
            compact
              ? `${current?.date ?? ""} · ${name} · 模拟币/单位`
              : undefined
          }
          aria-label={
            compact
              ? `${current?.date ?? ""}，${name}当前价格${current ? number(current.close) : "暂无"}模拟币每单位`
              : undefined
          }
        >
          {!compact && (
            <>
              {current?.date} · {name}{" "}
            </>
          )}
          {current ? number(current.close) : "暂无"}
          {!compact && <small>模拟币/单位</small>}
        </strong>
        <span>{changeText}</span>
        {!compact && current?.crossing && (
          <span>
            {current.crossing === "below" ? "跌破" : "上穿"}此前20期均价
          </span>
        )}
      </div>
      <svg
        viewBox="0 0 640 150"
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
      >
        <title id={`${id}-title`}>
          {name}
          {compact ? "商品价格与实际成交" : "已显示价格与此前5期、20期均线"}
        </title>
        <desc id={`${id}-desc`}>
          只显示到{current?.date}。当前价格
          {current ? number(current.close) : "暂无"}，此前5期均价
          {current?.ma5 === null || !current ? "样本不足" : number(current.ma5)}
          ，此前20期均价
          {current?.ma20 === null || !current
            ? "样本不足"
            : number(current.ma20)}
          。图中有{frame.trades.length}笔已发生的实际成交点。
        </desc>
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1="10"
            x2="630"
            y1={15 + fraction * 120}
            y2={15 + fraction * 120}
            className="research-price-grid"
          />
        ))}
        {!compact && (
          <path d={averagePath("ma20")} className="research-price-ma20" />
        )}
        {!compact && (
          <path d={averagePath("ma5")} className="research-price-ma5" />
        )}
        {frame.points.map(
          (point, index) =>
            index > 0 && (
              <path
                key={point.date}
                data-price-date={point.date}
                d={`M${x(index - 1)},${y(frame.points[index - 1]!.close)} L${x(index)},${y(point.close)}`}
                className={
                  point.close >= frame.points[index - 1]!.close
                    ? "research-price-up"
                    : "research-price-down"
                }
              />
            ),
        )}
        {current && (
          <circle
            cx={x(frame.points.length - 1)}
            cy={y(current.close)}
            r="3.5"
            className="research-price-cursor"
          />
        )}
        {frame.trades.map((trade) => {
          const index = frame.points.findIndex(
            (point) => point.date === trade.date,
          );
          if (index < 0) return null;
          const px = x(index),
            py = y(trade.price);
          return (
            <path
              key={trade.id}
              data-trade-date={trade.date}
              d={
                trade.side === "buy"
                  ? `M${px},${py - 7} l-5,9 h10 Z`
                  : `M${px},${py + 7} l-5,-9 h10 Z`
              }
              className={
                trade.side === "buy"
                  ? "research-price-buy"
                  : "research-price-sell"
              }
            >
              <title>
                {trade.date} {trade.side === "buy" ? "买入" : "卖出"}
                {name}，成交价{number(trade.price)}，数量
                {number(trade.quantity)}
              </title>
            </path>
          );
        })}
      </svg>
      {!compact && (
        <>
          <div className="research-price-axis">
            <span>{frame.points[0]?.date}</span>
            <span>
              当前显示 {current?.date} · 纵轴{number(frame.min)}–
              {number(frame.max)}
              模拟币/单位
            </span>
          </div>
          <div className="research-price-legend">
            <span>━ 商品收盘价</span>
            <span>
              ┄ 此前5期均价{" "}
              {current?.ma5 !== null && current ? number(current.ma5) : "不足"}
            </span>
            <span>
              ┈ 此前20期均价{" "}
              {current?.ma20 !== null && current
                ? number(current.ma20)
                : "不足"}
            </span>
            <span>▲买入 ▼卖出</span>
          </div>
          <div className="research-price-controls">
            <button
              type="button"
              onClick={toggle}
              disabled={noMotion || !series.length}
              aria-label={playing ? "暂停价格回放" : "播放价格回放"}
            >
              {playing ? "Ⅱ 暂停" : "▶ 播放"}
            </button>
            <button
              type="button"
              onClick={replay}
              disabled={noMotion || !series.length}
            >
              ↻ 重播
            </button>
            <button
              type="button"
              disabled={noMotion || visible >= series.length}
              onClick={() => {
                setPlaying(false);
                setCount(series.length);
              }}
            >
              看完整
            </button>
            <label>
              显示日期
              <input
                type="range"
                min={1}
                max={Math.max(1, series.length)}
                value={Math.max(1, visible)}
                disabled={noMotion || !series.length}
                aria-label="逐期查看已公开商品价格"
                aria-valuetext={`${current?.date ?? "无记录"}，${current ? number(current.close) : "暂无"}模拟币每单位`}
                onChange={(event) => {
                  setPlaying(false);
                  setCount(Number(event.target.value));
                }}
              />
            </label>
            <output>
              {visible}/{series.length}期
            </output>
          </div>
          <p className="research-price-note" role="status">
            {noMotion
              ? "已启用减少动画，直接显示完整的已公开记录。"
              : playing
                ? "正在回放已经发生的演示历史，可随时暂停；不是未来行情预测。"
                : "历史回放已暂停，可逐期查看或看完整。"}
          </p>
          {latestTrade && (
            <p className="research-price-note">
              最近显示成交：{latestTrade.date}{" "}
              {latestTrade.side === "buy" ? "买入" : "卖出"}
              {number(latestTrade.quantity)}单位{name}，成交价
              {number(latestTrade.price)}。仅标记真实成交，不把信号当成交。
            </p>
          )}
          <p className="research-price-note">
            真实历史走势的游戏映射；均线不含当期收盘。
            {window.segment === "research"
              ? "未运行的新数据检验不会在本图提前揭晓。"
              : "这里只显示本局已经实际运行的检验区间。"}
          </p>
        </>
      )}
    </section>
  );
}

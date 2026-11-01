"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GameDialog } from "../../ui/GameDialog";
import { getQuote } from "../market";
import { getRuleLabel, type KnowledgePrompt } from "../learning";
import type { TradingGame } from "../model";
import type { useLearningSession } from "../useLearningSession";
import { TradingPriceChart } from "./TradingPriceChart";

export function KnowledgeCard({
  game,
  prompt: initialPrompt,
  learning,
  onClose,
}: {
  game: TradingGame;
  prompt: KnowledgePrompt;
  learning: ReturnType<typeof useLearningSession>;
  onClose: () => void;
}) {
  // 保留打开时的题目；提交后引擎可能给出下一题，不能吞掉本题解释。
  const [prompt] = useState(initialPrompt);
  const [submitted, setSubmitted] = useState(false);
  const feedbackHeading = useRef<HTMLHeadingElement>(null);
  const focusedFeedback = useRef(false);
  const explanationId = useId();
  const answer = [...(learning.state?.events ?? [])]
    .reverse()
    .find(
      (event) => event.kind === "knowledge" && event.prompt.id === prompt.id,
    );
  const result = answer?.kind === "knowledge" ? answer : null;
  useEffect(() => {
    if (result && !focusedFeedback.current) {
      focusedFeedback.current = true;
      feedbackHeading.current?.focus();
    }
  }, [result]);
  // 只缩短显示：同一精度用于选项与图上端点，答案id和原始记录不变。
  const priceValues =
    prompt.kind === "candle"
      ? prompt.options.map((option) => Number(option.label))
      : [];
  let decimals = 2;
  const formatAt = (value: number, digits: number) =>
    new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  while (
    decimals < 7 &&
    new Set(priceValues.map((value) => formatAt(value, decimals))).size <
      priceValues.length
  )
    decimals++;
  const priceLabel = (value: number) => formatAt(value, decimals);
  const quote = getQuote(prompt.product, prompt.index);
  const high = Math.max(quote.high, quote.low + 0.001);
  const y = (value: number) =>
    142 - ((value - quote.low) / (high - quote.low)) * 116;
  function submit(answerId: string | null) {
    if (submitted || result) return;
    setSubmitted(true);
    learning.answerKnowledge(prompt.id, answerId, prompt.product);
  }
  return (
    <GameDialog
      title={prompt.kind === "candle" ? "帮店员挂价牌" : "帮学徒看规则"}
      onClose={onClose}
    >
      <div className="shop-learning-content" data-knowledge-card={prompt.kind}>
        <h3>{prompt.title}</h3>
        {prompt.kind === "candle" ? (
          <svg
            className="shop-knowledge-candle"
            viewBox="0 0 320 170"
            role="img"
            aria-label={`待识别的日K线，实体两端价格${priceLabel(quote.open)}与${priceLabel(quote.close)}`}
          >
            <line
              x1="160"
              x2="160"
              y1={y(quote.high)}
              y2={y(quote.low)}
              stroke="#b67749"
              strokeWidth="3"
            />
            <rect
              x="140"
              width="40"
              y={Math.min(y(quote.open), y(quote.close))}
              height={Math.max(3, Math.abs(y(quote.open) - y(quote.close)))}
              rx="3"
              fill={quote.close > quote.open ? "#c96547" : "#4e886e"}
            />
            {[quote.open, quote.close].map((value, index) => (
              <text
                key={index}
                x={index === 0 ? 126 : 194}
                y={y(value) + 4}
                textAnchor={index === 0 ? "end" : "start"}
              >
                {priceLabel(value)}
              </text>
            ))}
            <text x="160" y="164" textAnchor="middle">
              {quote.close > quote.open
                ? "阳线：收盘高于开盘"
                : "阴线：收盘低于开盘"}
            </text>
          </svg>
        ) : (
          <>
            <p>{getRuleLabel(prompt.rule)}</p>
            <TradingPriceChart
              game={game}
              product={prompt.product}
              selectedIndex={prompt.index}
              detailed
            />
          </>
        )}
        <div className="shop-knowledge-options">
          {prompt.options.map((option) => (
            <button
              type="button"
              key={option.id}
              disabled={submitted || !!result}
              aria-pressed={result ? result.answerId === option.id : undefined}
              onClick={() => submit(option.id)}
            >
              {prompt.kind === "candle" && Number.isFinite(Number(option.label))
                ? priceLabel(Number(option.label))
                : option.label}
            </button>
          ))}
        </div>
        {!result && (
          <button
            className="shop-learning-skip"
            type="button"
            disabled={submitted}
            onClick={() => submit(null)}
          >
            跳过，不计错误
          </button>
        )}
        {result && (
          <div
            className="shop-knowledge-result"
            role="status"
            data-correct={String(result.correct)}
          >
            <h3
              ref={feedbackHeading}
              tabIndex={-1}
              aria-describedby={explanationId}
            >
              {result.correct === null
                ? "这次跳过"
                : result.correct
                  ? "这次判断正确"
                  : "再看实体两端或规则条件"}
            </h3>
            <p id={explanationId}>{result.explanation}</p>
            <button
              className="shop-learning-primary"
              type="button"
              onClick={onClose}
            >
              回到买卖
            </button>
          </div>
        )}
      </div>
    </GameDialog>
  );
}

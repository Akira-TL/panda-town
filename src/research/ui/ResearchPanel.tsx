"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getChapter } from "../chapters";
import type { ResearchAction, ResearchState } from "../model";
import { PriceChart } from "./PriceChart";
import { ResearchDossier } from "./ResearchDossier";
import { number, percent } from "./format";
import "./research.css";
import "./compact-play.css";

function shortResult(state: ResearchState): string {
  if (state.day === 8)
    return state.finalDecision === "simulate"
      ? "准备模拟。"
      : state.finalDecision === "revise"
        ? "留待修改。"
        : "暂不采用。";
  if (state.phase === "exhibit") return "带着依据，登场！";
  if (state.day === 1)
    return state.intent === "risk"
      ? "先看中途损失。"
      : state.intent === "cost"
        ? "先看操作成本。"
        : "先看收益。";
  if (state.day === 2) return "数据核对好了。";
  if (state.day === 3)
    return state.runs.length ? "规则已保存，试跑完成。" : "规则已保存。";
  if (state.day === 4) return "这版已重新试跑。";
  if (state.day === 5)
    return state.allocation
      ? `投入上限${state.allocation * 100}%。`
      : "这次保留现金。";
  if (state.day === 6)
    return state.validation === "checked" ? "新数据已检验。" : "暂不检验。";
  return "费用已计入。";
}

export function ResearchPanel({
  state,
  onAction,
  reducedMotion = false,
}: {
  state: ResearchState;
  onAction: (action: ResearchAction) => void;
  reducedMotion?: boolean;
}) {
  const chapter = getChapter(state);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const lock = useRef(false);
  const [dossier, setDossier] = useState(false);
  const run = state.runs.at(-1);
  useEffect(() => {
    lock.current = false;
    heading.current?.focus();
  }, [state.day, state.phase]);
  if (state.phase === "travel" || state.phase === "report") return null;
  function choose(optionId: string) {
    if (lock.current || state.phase !== "decision") return;
    lock.current = true;
    onAction({
      type: "choose",
      id: crypto.randomUUID(),
      day: state.day,
      optionId,
    });
  }
  const secondary =
    state.intent === "risk"
      ? { label: "回撤", value: run ? percent(run.metrics.maxDrawdown) : "—" }
      : state.intent === "cost"
        ? { label: "费用", value: run ? number(run.metrics.fees) : "—" }
        : {
            label: "盈亏",
            value: run
              ? `${run.metrics.netProfit > 0 ? "+" : ""}${number(run.metrics.netProfit)}`
              : "—",
          };
  return (
    <section
      className="research-panel research-play"
      aria-labelledby={titleId}
      data-research-day={state.day}
      data-research-phase={state.phase}
    >
      <header className="research-play-header">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {chapter.title}
        </h2>
        <div
          className="research-play-dots"
          aria-label={`第${state.day}天，共8天`}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} data-done={index < state.day} />
          ))}
        </div>
        <button
          type="button"
          className="research-play-info"
          onClick={() => setDossier(true)}
        >
          <img
            src="/art/research/research-scroll.webp"
            width={22}
            height={22}
            alt=""
          />
          资料
        </button>
      </header>
      <div className="research-play-line">
        <img
          src="/art/panda-portrait.webp"
          width={36}
          height={42}
          alt="熊猫搭档"
        />
        <p role={state.phase === "decision" ? undefined : "status"}>
          {state.phase === "decision" ? chapter.dialogue : shortResult(state)}
        </p>
      </div>
      <div className="research-play-visuals">
        <PriceChart
          compact
          runs={state.runs}
          runId={run?.id}
          reducedMotion={reducedMotion}
          suspended={dossier}
          replayKey={
            state.evidence.filter((record) => record.action === "run").at(-1)
              ?.id
          }
        />
        <dl className="research-play-numbers">
          <div>
            <dt>模拟币</dt>
            <dd>{number(run?.metrics.finalEquity ?? 1000)}</dd>
          </div>
          <div>
            <dt>{secondary.label}</dt>
            <dd>{secondary.value}</dd>
          </div>
        </dl>
      </div>
      {state.phase === "decision" ? (
        <div className="research-play-actions" aria-label="本章三个行动">
          {chapter.options.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => choose(option.id)}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="research-play-next"
          aria-label={
            state.phase === "exhibit"
              ? "查看我的量化研究画像"
              : "记下结果，进入下一天"
          }
          onClick={() =>
            onAction({
              type: state.phase === "exhibit" ? "report" : "continue",
              id: crypto.randomUUID(),
              day: state.day,
            })
          }
        >
          {state.phase === "exhibit" ? "看画像" : "继续"}
          <span aria-hidden="true"> →</span>
        </button>
      )}
      {dossier && (
        <ResearchDossier
          state={state}
          onAction={onAction}
          reducedMotion={reducedMotion}
          onClose={() => setDossier(false)}
        />
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { getChapter, RESEARCH_TOPICS } from "../chapters";
import type { ResearchAction, ResearchState, ResearchTopic } from "../model";
import { ResearchModal } from "./ResearchModal";
import { ResearchMaterials } from "./ResearchMaterials";
import { SimulationView } from "./SimulationView";
import { PriceChart } from "./PriceChart";
import { ruleNames } from "./format";
import { getRuleDescription } from "../simulation";

/** 细节集中在一个原生模态；首次打开时每节保持收起。 */
export function ResearchDossier({
  state,
  onAction,
  onClose,
  reducedMotion,
}: {
  state: ResearchState;
  onAction: (action: ResearchAction) => void;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const [opened, setOpened] = useState<readonly string[]>([]);
  const [runId, setRunId] = useState(state.runs.at(-1)?.id ?? "");
  const run = state.runs.find((item) => item.id === runId) ?? state.runs.at(-1);
  const chapter = getChapter(state);
  const topics = [...new Set(chapter.topics)];
  function inspect(topic: ResearchTopic) {
    if (!chapter.topics.includes(topic)) return;
    onAction({
      type: "inspect",
      id: crypto.randomUUID(),
      day: state.day,
      topic,
    });
  }
  function toggle(key: string, isOpen: boolean) {
    setOpened((previous) =>
      isOpen
        ? [...new Set([...previous, key])]
        : previous.filter((item) => item !== key),
    );
  }
  const hasValidation = state.runs.some(
    (item) => item.config.segment === "validation",
  );
  const canRunValidation =
    !hasValidation &&
    state.day >= 7 &&
    (state.phase === "decision" || state.phase === "feedback");
  return (
    <ResearchModal title="资料" onClose={onClose}>
      <p className="research-caveat">
        PandaAI研究流程演示 · 本地计算 ·
        尚未连接PandaData。商品名和资金为游戏设定，走势来自真实历史映射；记录仅保存在本设备。
      </p>
      {!topics.includes("rule") && (
        <details className="research-details">
          <summary>规则说明</summary>
          <p>
            {state.rule
              ? getRuleDescription(state.rule)
              : "尚未选择规则。确认后可在这里核对完整条件。"}
          </p>
          <p>这是静态参数说明，不计作当章的主动研究主题。</p>
        </details>
      )}
      <details
        className="research-details"
        onToggle={(event) => toggle("chapter", event.currentTarget.open)}
      >
        <summary>本章选择与结果</summary>
        {opened.includes("chapter") && (
          <>
            <p>{chapter.dialogue}</p>
            <ul>
              {chapter.options.map((option) => (
                <li key={option.id}>
                  <strong>{option.label}</strong>：{option.detail}
                </li>
              ))}
            </ul>
            <p>{state.feedback}</p>
          </>
        )}
      </details>
      <details
        className="research-details"
        onToggle={(event) => toggle("price", event.currentTarget.open)}
      >
        <summary>完整价格图与回放控制</summary>
        {opened.includes("price") && (
          <PriceChart
            runs={state.runs}
            runId={run?.id}
            reducedMotion={reducedMotion}
          />
        )}
      </details>
      <details
        className="research-details"
        onToggle={(event) => toggle("runs", event.currentTarget.open)}
      >
        <summary>资金曲线、历史运行与成交</summary>
        {opened.includes("runs") && (
          <>
            {state.runs.length > 1 && (
              <label className="research-run-select">
                选择已保存运行
                <select
                  value={run?.id ?? ""}
                  onChange={(event) => {
                    setRunId(event.target.value);
                    inspect("comparison");
                  }}
                >
                  {state.runs.map((result, index) => (
                    <option key={result.id} value={result.id}>
                      第{index + 1}次 ·{" "}
                      {result.config.segment === "research"
                        ? "研究段"
                        : "检验段"}{" "}
                      · {ruleNames[result.config.rule]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {run ? (
              <SimulationView
                result={run}
                priority={state.intent ?? "return"}
                onInspect={inspect}
              />
            ) : (
              <p>尚未运行规则。</p>
            )}
          </>
        )}
      </details>
      {topics.map((topic) => (
        <details
          className="research-details"
          key={topic}
          onToggle={(event) => toggle(topic, event.currentTarget.open)}
        >
          <summary
            onClick={(event) => {
              if (
                (topic !== "validation" || !canRunValidation) &&
                !event.currentTarget.parentElement?.hasAttribute("open")
              )
                inspect(topic);
            }}
          >
            {topic === "explanation"
              ? "说明与可跳过理解题"
              : RESEARCH_TOPICS[topic].label}
          </summary>
          {opened.includes(topic) && (
            <>
              {topic === "validation" && canRunValidation && (
                <button
                  type="button"
                  className="research-primary"
                  onClick={() => inspect("validation")}
                >
                  运行新数据检验
                </button>
              )}
              <ResearchMaterials
                embedded
                state={state}
                topic={topic}
                onAction={onAction}
                onClose={onClose}
              />
            </>
          )}
        </details>
      ))}
    </ResearchModal>
  );
}

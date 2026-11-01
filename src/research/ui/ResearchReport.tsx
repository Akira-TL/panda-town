"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ResearchState, SimulationResult } from "../model";
import { buildResearchProfile, type ResearchFact } from "../profile";
import { SessionActions } from "../../ui/SessionActions";
import { ResearchModal } from "./ResearchModal";
import { ResearchEvidenceDialog } from "./ResearchEvidenceDialog";
import { SimulationView } from "./SimulationView";
import {
  decisionNames,
  intentNames,
  percent,
  ruleNames,
  validationNames,
} from "./format";
import "./research.css";
import "./compact-report.css";

type Overlay =
  | { kind: "details" }
  | { kind: "records"; title: string; ids: readonly string[] }
  | null;

/** 只用所选运行的真实资金点，无自动播放、随机线或跨区间拼接。 */
function ResultSparkline({ result }: { result: SimulationResult }) {
  const values = result.points.flatMap((point) => [
    point.equity,
    point.benchmark,
  ]);
  const low = Math.min(...values),
    high = Math.max(...values);
  const padding = Math.max(1, (high - low) * 0.1);
  const line = (key: "equity" | "benchmark") =>
    result.points
      .map((point, index) => {
        const x = 8 + (index / Math.max(1, result.points.length - 1)) * 604;
        const y =
          66 - ((point[key] - low + padding) / (high - low + padding * 2)) * 58;
        return `${index ? "L" : "M"}${x},${y}`;
      })
      .join(" ");
  return (
    <svg
      viewBox="0 0 620 76"
      preserveAspectRatio="none"
      role="img"
      aria-label={`所选运行的策略与固定持有曲线，净收益${percent(result.metrics.netReturn)}，最大回撤${percent(result.metrics.maxDrawdown)}`}
    >
      <path d={line("benchmark")} className="result-line-benchmark" />
      <path d={line("equity")} className="result-line-strategy" />
    </svg>
  );
}

function factStatus(fact: ResearchFact): string {
  return fact.status === "unobserved"
    ? "观察不足"
    : fact.status === "mixed"
      ? "保留不同选择"
      : `${fact.count}个独立情境`;
}

function shortInterest(fact: ResearchFact): string {
  if (fact.id === "return") return "收益对照";
  if (fact.id === "risk") return "途中下跌";
  if (fact.id === "cost") return "费用频率";
  if (fact.id === "data") return "数据依据";
  return fact.label;
}

export function ResearchReport({
  state,
  onRestart,
  onClear,
  reducedMotion = false,
}: {
  state: ResearchState;
  onRestart: () => void;
  onClear: () => void;
  reducedMotion?: boolean;
}) {
  const profile = useMemo(() => buildResearchProfile(state), [state]);
  const heading = useRef<HTMLHeadingElement>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [runId, setRunId] = useState(state.runs.at(-1)?.id ?? "");
  const result =
    state.runs.find((run) => run.id === runId) ?? state.runs.at(-1);
  const interests =
    profile.sections
      .find((section) => section.id === "interests")
      ?.facts.filter((fact) => fact.count > 0) ?? [];
  const tools =
    profile.sections
      .find((section) => section.id === "tools")
      ?.facts.filter((fact) => fact.count > 0) ?? [];
  const validationFact = profile.sections
    .find((section) => section.id === "habits")
    ?.facts.find((fact) => fact.id === "validation-run");
  const validationLabel =
    state.validation === "needs-new-data"
      ? "待新数据"
      : validationFact?.count
        ? "已检验"
        : state.validation === "deferred"
          ? "暂缓检验"
          : "尚未检验";
  const ruleLabel =
    state.rule === "trend"
      ? "顺势"
      : state.rule === "reversion"
        ? "等回落"
        : state.rule === "hold"
          ? "持有"
          : "未选规则";
  const cards = [
    {
      title: "规则与上限",
      image: "/art/research/research-scroll.webp",
      value: `${ruleLabel} · ${state.allocation * 100}%`,
      detail: `当前第${state.strategyVersion}版`,
    },
    {
      title: "关注主题",
      image: "/art/icon-cash.webp",
      value: interests.length
        ? interests.slice(0, 2).map(shortInterest).join(" · ")
        : "观察不足",
      detail: interests.length ? "来自本局主动选择" : "不填默认偏好",
    },
    {
      title: "检验记录",
      image: "/art/research/verification-badge.webp",
      value: validationLabel,
      detail:
        state.validation === "needs-new-data"
          ? "旧检验不代表新版"
          : validationFact?.count
            ? "实际运行过新数据"
            : "没有补造通过记录",
    },
    {
      title: "工具使用",
      image: "/art/icon-information.webp",
      value:
        tools.length > 1
          ? "说明与细节"
          : tools[0]?.id === "details"
            ? "查看过细节"
            : tools.length
              ? "使用过说明"
              : "观察不足",
      detail: "不换算能力分",
    },
  ];
  useEffect(() => {
    heading.current?.focus();
  }, [state.sessionId]);
  function showRecords(title: string, ids: readonly string[]) {
    setOverlay({ kind: "records", title, ids });
  }
  return (
    <section
      className="research-report compact-report"
      aria-label="你的量化研究画像"
      data-research-report="true"
      data-reduced-motion={reducedMotion}
    >
      <header className="compact-report-hero">
        <img
          src="/art/panda-portrait.webp"
          alt="熊猫研究搭档"
          width={96}
          height={116}
        />
        <div>
          <h1 ref={heading} tabIndex={-1} aria-label="你的量化研究画像">
            你的策略登场了
          </h1>
          <p>
            {state.finalDecision === "simulate"
              ? "先模拟，继续观察。"
              : state.finalDecision === "revise"
                ? "这版留下，继续修改。"
                : "暂不采用，也有依据。"}
          </p>
        </div>
      </header>
      <div className="compact-report-cards" aria-label="本局真实研究观察">
        {cards.map((card) => (
          <button
            type="button"
            className="compact-report-card"
            key={card.title}
            title={card.detail}
            onClick={() => setOverlay({ kind: "details" })}
            aria-label={`${card.title}：${card.value}，查看依据`}
          >
            <img src={card.image} alt="" width={60} height={60} />
            <div>
              <h2>{card.title}</h2>
              <strong>{card.value}</strong>
            </div>
          </button>
        ))}
      </div>
      <section
        className="compact-report-performance"
        aria-label="策略表现，与人的观察分开"
      >
        <div className="compact-report-performance-title">
          <h2>策略表现</h2>
          <span>
            {result
              ? `第${state.runs.indexOf(result) + 1}次 · ${result.config.segment === "research" ? "研究段" : "检验段"}`
              : "未运行"}
          </span>
        </div>
        {result ? (
          <>
            <ResultSparkline result={result} />
            <p>
              <span>━ 策略　┄ 固定持有</span>
              <strong>净收益 {percent(result.metrics.netReturn)}</strong>
            </p>
          </>
        ) : (
          <p>没有已保存的运行，不补造结果。</p>
        )}
      </section>
      <div className="compact-report-actions">
        <a
          className="compact-report-pandaai"
          href="https://www.pandaaiquant.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          打开 PandaAI ↗
        </a>
        <button
          type="button"
          className="compact-report-evidence"
          aria-haspopup="dialog"
          onClick={() => setOverlay({ kind: "details" })}
        >
          查看依据
        </button>
      </div>
      <SessionActions onRestart={onRestart} onClear={onClear} />
      <p className="compact-report-local">
        本局记录留在本设备。外链不携带画像。
      </p>
      {overlay && (
        <ResearchModal title="本局完整依据" onClose={() => setOverlay(null)}>
          <p className="research-caveat">
            历史数据：
            <a
              href="https://data.binance.vision/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Binance Vision
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY-NC-SA 4.0
            </a>
            。 价格与数量已缩放为游戏单位。
          </p>
          <h3>{profile.title}</h3>
          <p>{profile.summary}</p>
          <details className="research-details">
            <summary>策略、参数与全部运行</summary>
            <dl className="research-inputs">
              <div>
                <dt>研究意图</dt>
                <dd>{state.intent ? intentNames[state.intent] : "未记录"}</dd>
              </div>
              <div>
                <dt>规则</dt>
                <dd>
                  {state.rule ? ruleNames[state.rule] : "未确认"} · 第
                  {state.strategyVersion}版
                </dd>
              </div>
              <div>
                <dt>目标投入上限</dt>
                <dd>{percent(state.allocation)}</dd>
              </div>
              <div>
                <dt>当前检验</dt>
                <dd>{validationNames[state.validation]}</dd>
              </div>
              <div>
                <dt>最后决定</dt>
                <dd>
                  {state.finalDecision
                    ? decisionNames[state.finalDecision]
                    : "未决定"}
                </dd>
              </div>
              <div>
                <dt>保存的运行</dt>
                <dd>{state.runs.length}次；结果不换算为能力分</dd>
              </div>
            </dl>
            <p>
              研究段和检验段各自从1000模拟币独立运行，不拼成连续收益；修改后，旧检验不能证明新版有效。
            </p>
            {state.runs.length > 1 && (
              <label className="research-run-select">
                选择实际保存的运行
                <select
                  value={result?.id ?? ""}
                  onChange={(event) => setRunId(event.target.value)}
                >
                  {state.runs.map((run, index) => (
                    <option key={run.id} value={run.id}>
                      第{index + 1}次 ·{" "}
                      {run.config.segment === "research" ? "研究段" : "检验段"}{" "}
                      · {ruleNames[run.config.rule]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {result ? (
              <SimulationView
                result={result}
                priority={state.intent ?? "return"}
              />
            ) : (
              <p>本局没有已保存计算。</p>
            )}
          </details>
          {profile.sections.map((section) => (
            <details className="research-details" key={section.id}>
              <summary>{section.title}</summary>
              <p>{section.description}</p>
              {!section.facts.length && <p>观察不足，不填默认分数。</p>}
              {section.facts.map((fact) => (
                <article className="research-profile-fact" key={fact.id}>
                  <h3>{fact.label}</h3>
                  <p>{fact.text}</p>
                  <p>
                    {factStatus(fact)} · {fact.opportunities}次可观察机会
                  </p>
                  {!!fact.evidenceIds.length && (
                    <button
                      type="button"
                      className="research-evidence-button"
                      onClick={() =>
                        showRecords(`${fact.label}：原始依据`, fact.evidenceIds)
                      }
                    >
                      查看依据（{fact.evidenceIds.length}条）
                    </button>
                  )}
                </article>
              ))}
            </details>
          ))}
          <details className="research-details">
            <summary>已作答知识与原题</summary>
            <p>
              {profile.knowledge.answered
                ? `已答${profile.knowledge.answered}题，其中${profile.knowledge.correct}题正确；不换算综合量化能力。`
                : "本局未评估；未答题不计入分母。"}
            </p>
            {profile.knowledge.answers.map((answer) => (
              <article className="research-profile-fact" key={answer.id}>
                <h3>{answer.prompt}</h3>
                <p>
                  首次答案：{answer.selectedAnswer} ·{" "}
                  {answer.correct ? "本题正确" : "本题与解释不同"}
                </p>
                <p>{answer.explanation}</p>
                <button
                  type="button"
                  className="research-evidence-button"
                  onClick={() =>
                    showRecords("这道题的原始作答", [answer.evidenceId])
                  }
                >
                  查看原始作答
                </button>
              </article>
            ))}
          </details>
          <details className="research-details">
            <summary>未知、变化与未评估</summary>
            <ul>
              {profile.unknown.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p>没有合适的人格观察情境；不把规则、持仓或合作转换成人格分数。</p>
          </details>
          <button
            type="button"
            className="research-evidence-button"
            onClick={() =>
              showRecords(
                "本局全部行为记录",
                profile.evidence.map((record) => record.id),
              )
            }
          >
            查看本局全部原始记录（{profile.evidence.length}条）
          </button>
          <p className="research-caveat">
            PandaAI研究流程演示 · 本地计算 ·
            未连接PandaData。点击官方主页链接只打开网页，不传送本局画像、不启动交易。
          </p>
        </ResearchModal>
      )}
      {overlay?.kind === "records" && (
        <ResearchEvidenceDialog
          title={overlay.title}
          records={profile.evidence.filter((record) =>
            overlay.ids.includes(record.id),
          )}
          runs={state.runs}
          onClose={() => setOverlay({ kind: "details" })}
        />
      )}
    </section>
  );
}

"use client";

import type { ResearchEvidence, SimulationResult } from "../model";
import { RESEARCH_TOPICS } from "../chapters";
import { ResearchModal } from "./ResearchModal";
import { SimulationView } from "./SimulationView";
import { percent, ruleNames, validationNames } from "./format";

export function ResearchEvidenceDialog({
  title,
  records,
  runs,
  onClose,
}: {
  title: string;
  records: readonly ResearchEvidence[];
  runs: readonly SimulationResult[];
  onClose: () => void;
}) {
  return (
    <ResearchModal title={title} onClose={onClose}>
      <p>这里保留动作发生时的信息与结果；不拿后来的收益改写当时的选择。</p>
      {!records.length && (
        <div className="research-empty">没有对应的本局记录，不补造证据。</div>
      )}
      {records.map((record) => (
        <article className="research-raw-record" key={record.id}>
          <div className="research-eyebrow">
            第{record.day}天 · {record.contextId}
          </div>
          <h3>{record.label}</h3>
          <dl className="research-inputs">
            <div>
              <dt>动作</dt>
              <dd>
                {
                  {
                    choose: "主要选择",
                    inspect: "主动查看",
                    answer: "作答",
                    run: "计算运行",
                  }[record.action]
                }
              </dd>
            </div>
            <div>
              <dt>当时版本</dt>
              <dd>
                策略第{record.strategyVersion}版 · {record.datasetVersion}
              </dd>
            </div>
            <div>
              <dt>当时规则 / 投入</dt>
              <dd>
                {record.rule ? ruleNames[record.rule] : "尚未确认"} /{" "}
                {percent(record.allocation)}
              </dd>
            </div>
            <div>
              <dt>当时检验状态</dt>
              <dd>{validationNames[record.validation]}</dd>
            </div>
          </dl>
          <h4>当时可见的主要选项</h4>
          {record.options.length ? (
            <ul>
              {record.options.map((option, index) => (
                <li key={index}>{option}</li>
              ))}
            </ul>
          ) : (
            <p>该动作未展示主要决策选项。</p>
          )}
          <p>
            <strong>实际动作：</strong>
            {record.label}（记录值：{record.choice}）
          </p>
          <p>
            <strong>此前已知主题：</strong>
            {record.knownTopics.length
              ? record.knownTopics
                  .map((topic) => RESEARCH_TOPICS[topic].label)
                  .join("、")
              : "记录中没有额外已知主题"}
          </p>
          <p>
            <strong>当次结果：</strong>
            {record.outcome || "本动作未产生交易结果"}
          </p>
          {record.config && (
            <p>
              运行快照：每{record.config.frequency}个样本检查；手续费
              {percent(record.config.feeBps / 10000)}；成交偏移
              {percent(record.config.slippageBps / 10000)}。
            </p>
          )}
          {record.runIds.map((id) => {
            const run = runs.find((item) => item.id === id);
            return run ? (
              <details className="research-details" key={id}>
                <summary>
                  展开当次计算结果 ·{" "}
                  {run.config.segment === "research" ? "研究段" : "新数据段"}
                </summary>
                <SimulationView result={run} />
              </details>
            ) : (
              <p key={id}>
                记录引用了计算{id}，当前会话未包含该结果，无法展开。
              </p>
            );
          })}
        </article>
      ))}
    </ResearchModal>
  );
}

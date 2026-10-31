"use client";

import { useEffect, useRef, useState } from "react";
import type { EvidenceCard, ProfileFact, ProfileReport } from "../game/profile";
import { LOCATIONS } from "../game/content";
import { TradeEvidence } from "./TradeEvidence";

type OpenEvidence = (
  id: string,
  trigger: HTMLButtonElement,
  related?: readonly string[],
) => void;
function Facts({ facts, open }: { facts: ProfileFact[]; open: OpenEvidence }) {
  const observed = facts.filter((f) => f.count > 0);
  const missing = facts.filter((f) => f.count === 0);
  return (
    <div className="profile-facts">
      {observed.map((f) => (
        <article key={f.id} className="profile-fact">
          <div className="profile-fact-copy">
            <strong>{f.label}</strong>
            <p>{f.text}</p>
          </div>
          <div className="profile-count">
            <b>{f.count}</b>
            <span>次</span>
            <small>{f.opportunities} 个可选机会</small>
          </div>
          <button
            className="evidence-pill"
            onClick={(e) =>
              open(f.evidenceIds[0]!, e.currentTarget, f.evidenceIds)
            }
          >
            证据 {f.evidenceIds.length} <span>›</span>
          </button>
        </article>
      ))}
      {!observed.length && (
        <div className="profile-empty">
          <span>✧</span>
          <p>
            这次旅程还没有留下足够线索。
            <br />
            <small>未出现的情境不会被记作主动拒绝。</small>
          </p>
        </div>
      )}
      {missing.length > 0 && (
        <details className="profile-missing">
          <summary>本局未观察的 {missing.length} 项</summary>
          {missing.map((f) => (
            <p key={f.id}>
              <strong>{f.label}</strong> · {f.text}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
function EvidenceDetail({
  evidence,
  close,
  next,
  previous,
  index,
  total,
}: {
  evidence: EvidenceCard;
  close: () => void;
  next: () => void;
  previous: () => void;
  index: number;
  total: number;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [evidence.id]);
  const location =
    LOCATIONS.find((l) => l.id === evidence.locationId)?.name ?? evidence.title;
  const delta = evidence.cashAfter - evidence.cashBefore;
  return (
    <div className="evidence-backdrop" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-heading"
        className="evidence-sheet"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <span className="eyebrow">旅程手记 · 第 {evidence.day} 天</span>
          <button
            ref={closeRef}
            className="sheet-close"
            aria-label="关闭证据"
            onClick={close}
          >
            ×
          </button>
          <h2 id="evidence-heading">{evidence.title}</h2>
          <p>⌖ {location}</p>
        </header>
        <div className="evidence-step">
          <span className="step-number">01</span>
          <div>
            <h3>当时的你</h3>
            <p>
              手头现金{" "}
              <strong>{evidence.cashBefore.toLocaleString("zh-CN")}</strong>{" "}
              金币
            </p>
            <div className="evidence-asset-tags">
              <span>
                {evidence.assetsBefore.stall ? "经营着摊位" : "尚未经营摊位"}
              </span>
              <span>
                {evidence.assetsBefore.investment
                  ? "持有演示投资"
                  : "无投资持仓"}
              </span>
              <span>
                {evidence.assetsBefore.tool.status === "pending"
                  ? "工具待交货"
                  : evidence.assetsBefore.tool.status === "owned"
                    ? "已持有工具"
                    : "尚无工具"}
              </span>
            </div>
          </div>
        </div>
        <div className="evidence-step">
          <span className="step-number">02</span>
          <div>
            <h3>你看到的选择</h3>
            {evidence.options.map((o, i) => (
              <div
                className={[
                  "evidence-option",
                  o.label === evidence.actualChoice ? "chosen" : "",
                  !o.available ? "unavailable" : "",
                ].join(" ")}
                key={i}
              >
                <span>{o.label === evidence.actualChoice ? "✓" : "›"}</span>
                <div>
                  {o.label}
                  {!o.available && (
                    <small>
                      {o.shortfall > 0
                        ? `当时现金不足，还差 ${o.shortfall}`
                        : "当时条件不满足"}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {evidence.materials.length > 0 && (
          <div className="evidence-step">
            <span className="step-number">03</span>
            <div>
              <h3>当时查看过的资料</h3>
              {evidence.materials.map((m, i) => (
                <p className="evidence-material" key={i}>
                  {m.text}
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="evidence-result">
          <small>实际行动</small>
          <strong>{evidence.actualChoice}</strong>
          <p>
            现金 {evidence.cashBefore.toLocaleString("zh-CN")} →{" "}
            {evidence.cashAfter.toLocaleString("zh-CN")}{" "}
            <span className={delta >= 0 ? "positive" : "negative"}>
              {delta > 0 ? `+${delta}` : delta < 0 ? delta : "无即时收支"}
            </span>
          </p>
        </div>
        <TradeEvidence evidence={evidence} />
        <footer className="evidence-pager">
          <button onClick={previous} disabled={index === 0}>
            ← 上一条
          </button>
          <span>
            {index + 1} / {total}
          </span>
          <button onClick={next} disabled={index === total - 1}>
            下一条 →
          </button>
        </footer>
      </section>
    </div>
  );
}
export function ReportPanel({ report }: { report: ProfileReport }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [relatedIds, setRelatedIds] = useState<readonly string[] | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const open: OpenEvidence = (id, trigger, related) => {
    if (!report.evidence.some((e) => e.id === id)) return;
    returnFocus.current = trigger;
    setRelatedIds(related ?? null);
    setSelected(id);
  };
  const close = () => {
    setSelected(null);
    returnFocus.current?.focus();
  };
  const availableEvidence = relatedIds
    ? report.evidence.filter((e) => relatedIds.includes(e.id))
    : report.evidence;
  const index = availableEvidence.findIndex((e) => e.id === selected);
  const evidence = availableEvidence[index];
  return (
    <>
      <div className="profile-grid">
        <section className="profile-card">
          <h2>
            <img src="/art/icon-cash.webp" alt="" />
            消费与经营<small>花在哪里，如何筹备</small>
          </h2>
          <Facts
            facts={[...report.consumption, ...report.trading]}
            open={open}
          />
        </section>
        <section className="profile-card">
          <h2>
            <img src="/art/icon-information.webp" alt="" />
            信息使用习惯<small>选择前，你看了什么</small>
          </h2>
          <Facts facts={report.information} open={open} />
          {report.investments.length > 0 && (
            <div className="investment-observations">
              <h3>真实投入比例</h3>
              {report.investments.map((i) => (
                <div key={i.evidenceId}>
                  <span>
                    {i.amount} / 当时现金 {i.cashBefore}
                  </span>
                  <strong>{(i.fractionOfCash * 100).toFixed(1)}%</strong>
                  <div className="proportion-track">
                    <i
                      style={{
                        width: `${Math.min(100, i.fractionOfCash * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="profile-card">
          <h2>
            <span className="botanical-symbol">❧</span>兴趣线索
            <small>你主动靠近的主题</small>
          </h2>
          <Facts facts={report.interests} open={open} />
        </section>
        <section className="profile-card knowledge-card">
          <h2>
            <span className="botanical-symbol">✧</span>知识表现
            <small>仅记录已答的客观题</small>
          </h2>
          <div className="knowledge-medallion">
            <strong>
              {report.knowledge.status === "observed"
                ? report.knowledge.correct
                : "—"}
            </strong>
            <span>
              {report.knowledge.status === "observed"
                ? `/ ${report.knowledge.answered} 题答对`
                : "本局未评估"}
            </span>
          </div>
          <p>{report.knowledge.note}</p>
          {report.knowledge.answers.map((a) => (
            <details key={a.questionId} className="knowledge-answer">
              <summary>
                <span className={a.correct ? "positive" : "negative"}>
                  {a.correct ? "✓" : "○"}
                </span>
                {a.prompt}
              </summary>
              <p>你的答案：{a.selectedAnswer}</p>
              <p>
                正确答案：{a.correctAnswer}。{a.explanation}
              </p>
            </details>
          ))}
        </section>
        <section className="profile-card personality-card">
          <h2>
            <span className="botanical-symbol">♧</span>一般人格线索
            <small>本局观察，不是人格测验</small>
          </h2>
          <div className="personality-observations">
            {report.personality.map((f) => (
              <article key={f.id}>
                <span className={`observation-seal ${f.status}`}>
                  {f.status === "observed" ? "❧" : "?"}
                </span>
                <div>
                  <h3>{f.label}</h3>
                  <p>{f.text}</p>
                  <span className="observation-status">
                    {f.status === "observed"
                      ? "有情境线索"
                      : f.status === "not-assessed"
                        ? "本局未评估"
                        : "线索不足"}
                  </span>
                </div>
                {f.evidenceIds.length > 0 && (
                  <button
                    className="evidence-pill"
                    onClick={(e) =>
                      open(f.evidenceIds[0]!, e.currentTarget, f.evidenceIds)
                    }
                  >
                    证据 ›
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="journey-journal">
        <div>
          <span className="eyebrow">小镇手记</span>
          <h2>每个判断，都有来处。</h2>
          <p>打开一条记录，回到你当时面对的情境。</p>
        </div>
        <div className="journal-days">
          {Array.from({ length: 8 }, (_, i) => {
            const record = report.evidence.find(
              (e) => e.day === i + 1 && e.action === "choose",
            );
            return (
              <button
                key={i}
                disabled={!record}
                onClick={(e) => record && open(record.id, e.currentTarget)}
              >
                <small>第 {i + 1} 天</small>
                <span>{record ? "✎" : "·"}</span>
                <strong>{record ? record.title : "未记录"}</strong>
              </button>
            );
          })}
        </div>
      </section>
      <details className="profile-method">
        <summary>这些线索怎样得出？</summary>
        {report.unknowns.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </details>
      {evidence && (
        <EvidenceDetail
          evidence={evidence}
          close={close}
          index={index}
          total={availableEvidence.length}
          previous={() =>
            setSelected(availableEvidence[index - 1]?.id ?? selected)
          }
          next={() => setSelected(availableEvidence[index + 1]?.id ?? selected)}
        />
      )}
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { type GameState, type visibleGame } from "../game/engine";
import { getMaterialComparison } from "../game/content";
import { MaterialChart } from "./GameDetails";

type PublicEvent = NonNullable<ReturnType<typeof visibleGame>["event"]>;
function sourceName(source: string): string {
  switch (source) {
    case "town-ledger":
      return "营业记录";
    case "merchant-interview":
      return "商家访谈";
    case "supplier-message":
      return "采购消息";
    case "dock-record":
      return "码头记录";
    default:
      return "演示市场报价";
  }
}
export function StudyPanel({
  event,
  game,
  inspect,
  compare,
  answer,
}: {
  event: PublicEvent;
  game: GameState;
  inspect: (id: string) => void;
  compare: (ids: [string, string]) => void;
  answer: (questionId: string, answerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"materials" | "questions">("materials");
  const entryRef = useRef<HTMLButtonElement>(null),
    closeRef = useRef<HTMLButtonElement>(null);
  const materials = event.materials ?? [];
  const comparisonIds = materials.slice(0, 2).map((material) => material.id);
  const compared =
    comparisonIds.length === 2 &&
    game.evidence.some(
      (entry) =>
        entry.action === "compare" &&
        entry.day === game.day &&
        entry.contextId === event.contextId &&
        entry.choice.split("|").length === 2 &&
        comparisonIds.every((id) => entry.choice.split("|").includes(id)),
    );
  const comparisonExplanation = compared
    ? getMaterialComparison(materials.slice(0, 2))
    : null;
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  if (!materials.length && !event.questions?.length) return null;
  function close() {
    setOpen(false);
    entryRef.current?.focus();
  }
  return (
    <>
      <div className="study-entry">
        <button ref={entryRef} onClick={() => setOpen(true)}>
          <img src="/art/icon-information.webp" alt="" />
          <span>
            先看看资料
            <small>
              {materials.length} 份演示资料
              {event.questions?.length ? " · 可选理解题" : ""}
            </small>
          </span>
          <b>↗</b>
        </button>
        <small>多看一眼，也许会改变选择。</small>
      </div>
      {open && (
        <div className="evidence-backdrop study-backdrop" onClick={close}>
          <section
            className="evidence-sheet study-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-heading"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Tab") {
                const buttons = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled),summary",
                  ),
                );
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
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
              <span className="eyebrow">PandaAI · 小镇研究手记</span>
              <button
                ref={closeRef}
                aria-label="关闭资料"
                className="sheet-close"
                onClick={close}
              >
                ×
              </button>
              <h2 id="study-heading">做选择前，看清一点。</h2>
              <p>演示数据 · 只显示截至当前已公布的信息</p>
            </header>
            <nav className="study-tabs" aria-label="资料内容">
              <button
                aria-pressed={tab === "materials"}
                onClick={() => setTab("materials")}
              >
                查看与比较
              </button>
              {event.questions?.length ? (
                <button
                  aria-pressed={tab === "questions"}
                  onClick={() => setTab("questions")}
                >
                  理解题 · 可跳过
                </button>
              ) : null}
            </nav>
            {tab === "materials" ? (
              <>
                <div className="study-sources">
                  {materials.map((m, i) => (
                    <article
                      key={m.id}
                      tabIndex={-1}
                      className={game.inspected.includes(m.id) ? "read" : ""}
                    >
                      <div>
                        <span className="source-initial">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <h3>{sourceName(m.sourceId)}</h3>
                        <small>
                          {game.inspected.includes(m.id)
                            ? "已查看"
                            : "尚未展开"}
                        </small>
                      </div>
                      {game.inspected.includes(m.id) ? (
                        <p>{m.text}</p>
                      ) : (
                        <button
                          className="secondary"
                          onClick={(event) => {
                            event.currentTarget
                              .closest<HTMLElement>("article")
                              ?.focus();
                            inspect(m.id);
                          }}
                        >
                          展开这份资料 ↗
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {(event.id === "E04"
                  ? game.inspected.includes("sales-record")
                  : materials.some((m) => game.inspected.includes(m.id))) && (
                  <MaterialChart eventId={event.id} game={game} />
                )}{" "}
                {materials.length >= 2 && (
                  <div
                    className="compare-panel"
                    tabIndex={-1}
                    role="group"
                    aria-label="资料比较"
                  >
                    <p>来源不同，能支持的判断也不同。</p>
                    <button
                      className="primary"
                      disabled={
                        !materials
                          .slice(0, 2)
                          .every((m) => game.inspected.includes(m.id)) ||
                        compared
                      }
                      onClick={(event) => {
                        event.currentTarget
                          .closest<HTMLElement>(".compare-panel")
                          ?.focus();
                        compare([materials[0]!.id, materials[1]!.id]);
                      }}
                    >
                      {compared ? "✓ 已比较两份来源" : "比较两份来源"}
                    </button>
                    <small>
                      {compared
                        ? "本局记录了这次主动比较，现金与回合不变。"
                        : "先分别展开两份资料，再比较。"}
                    </small>
                    {comparisonExplanation && (
                      <div className="study-explanation" role="status">
                        <p>{comparisonExplanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="study-questions">
                {event.questions?.map((q) => (
                  <article key={q.id} tabIndex={-1}>
                    <span className="eyebrow">不奖励金币 · 可以跳过</span>
                    <h3>{q.prompt}</h3>
                    {game.answered.includes(q.id) ? (
                      <div className="study-explanation" role="status">
                        <span>
                          {game.evidence.find(
                            (e) =>
                              e.action === "answer" &&
                              e.choice.startsWith(`${q.id}:`),
                          )?.correct
                            ? "✓ 这次答对了"
                            : "○ 看看这道题的解释"}{" "}
                          · 已记录首次答案
                        </span>
                        <p>{q.explanation}</p>
                      </div>
                    ) : (
                        q.id === "K01"
                          ? game.inspected.includes("sales-record")
                          : ["supply-wish", "supply-trade"].every((id) =>
                              game.inspected.includes(id),
                            )
                      ) ? (
                      <div className="study-answer-options">
                        {q.answers.map((a) => (
                          <button
                            className="choice"
                            key={a.id}
                            onClick={(event) => {
                              event.currentTarget
                                .closest<HTMLElement>("article")
                                ?.focus();
                              answer(q.id, a.id);
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="study-explanation">
                        <p>
                          先展开题目相关资料，再回来选择答案。也可以直接回到街边继续游戏。
                        </p>
                        <button
                          className="secondary"
                          onClick={() => setTab("materials")}
                        >
                          去看看资料 ↗
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            <footer className="study-footer">
              <button className="secondary" onClick={close}>
                回到街边，继续选择 ↗
              </button>
              <p>查看资料与理解题不消耗本回合的主要选择。</p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

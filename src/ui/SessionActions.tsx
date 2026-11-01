"use client";

import { useEffect, useId, useRef, useState } from "react";

type Request = "restart" | "clear";
interface SessionActionsProps {
  onRestart: () => void;
  onClear: () => void;
}

export function SessionActions({ onRestart, onClear }: SessionActionsProps) {
  const [request, setRequest] = useState<Request | null>(null);
  const previous = useRef<Request | null>(null);
  const restart = useRef<HTMLButtonElement>(null);
  const clear = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const heading = useId(),
    description = useId();
  useEffect(() => {
    if (request) cancel.current?.focus();
    else if (previous.current) {
      (previous.current === "restart" ? restart : clear).current?.focus();
    }
    previous.current = request;
  }, [request]);
  return (
    <div className="session-actions">
      <div className="session-action-buttons" hidden={request !== null}>
        <button
          ref={restart}
          className="primary"
          onClick={() => setRequest("restart")}
        >
          重开一局 ↗
        </button>
        <button
          ref={clear}
          className="secondary"
          onClick={() => setRequest("clear")}
        >
          清除记录
        </button>
      </div>
      {request && (
        <section
          className="session-confirmation"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={heading}
          aria-describedby={description}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setRequest(null);
            }
            if (event.key === "Tab") {
              event.stopPropagation();
              const buttons = event.currentTarget.querySelectorAll("button");
              const target = event.shiftKey
                ? buttons[0]
                : buttons[buttons.length - 1];
              if (document.activeElement === target) {
                event.preventDefault();
                (event.shiftKey
                  ? buttons[buttons.length - 1]
                  : buttons[0]
                )?.focus();
              }
            }
          }}
        >
          <h3 id={heading}>
            {request === "restart" ? "重新开始一局？" : "清除这一局的记录？"}
          </h3>
          <p id={description}>
            {request === "restart"
              ? "当前进度、资产和画像证据会被新局替换，不能返回。"
              : "将清除本标签页保存的进度与画像，回到开场。下一位参观者会从新局开始。"}
          </p>
          <div className="session-action-buttons">
            <button
              ref={cancel}
              className="secondary"
              onClick={() => setRequest(null)}
            >
              取消，保留本局
            </button>
            <button
              className="primary"
              onClick={request === "restart" ? onRestart : onClear}
            >
              {request === "restart" ? "确认重开" : "确认清除"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

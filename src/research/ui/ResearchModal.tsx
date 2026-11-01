"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function ResearchModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    heading.current?.focus();
    const element = dialog.current;
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="research-modal"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const selector = [
          "button:not([disabled])",
          "a[href]",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "summary",
          "[tabindex]:not([tabindex='-1'])",
        ].join(",");
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(selector),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        const active = document.activeElement;
        const outside = !event.currentTarget.contains(active);
        if (!first || !last) {
          event.preventDefault();
          heading.current?.focus();
        } else if (
          event.shiftKey &&
          (active === first || active === heading.current || outside)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || outside)) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="research-modal-inner">
        <header className="research-modal-heading">
          <h2 ref={heading} tabIndex={-1} id={titleId}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="关闭，返回原处">
            ×
          </button>
        </header>
        {children}
        <button type="button" className="research-secondary" onClick={onClose}>
          返回工作台
        </button>
      </div>
    </dialog>
  );
}

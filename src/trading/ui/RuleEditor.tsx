"use client";

import { useState } from "react";
import { GameDialog } from "../../ui/GameDialog";
import type { ProductId, TradingGame } from "../model";
import type { useLearningSession } from "../useLearningSession";
import {
  ENTRY_LABELS,
  EXIT_LABELS,
  evaluateRule,
  type EntryRule,
  type ExitRule,
  type TradingRule,
} from "../learning";

export function RuleEditor({
  game,
  product,
  learning,
  onClose,
}: {
  game: TradingGame;
  product: ProductId;
  learning: ReturnType<typeof useLearningSession>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TradingRule>(
    learning.state?.rule ?? {
      entry: "ma_cross_up",
      allocation: 0.5,
      exit: "ma_cross_down",
    },
  );
  const [saved, setSaved] = useState(false);
  const evaluation = evaluateRule(game, draft, product);
  const stateLabel = (value: boolean | null) =>
    value === null ? "手动／历史不足" : value ? "当前已满足" : "当前未满足";
  return (
    <GameDialog title="给买卖加个条件" onClose={onClose}>
      <div className="shop-learning-content" data-rule-editor="true">
        <p>选好三件事；保存后仍由你手动买卖，不会自动下单。</p>
        <label className="shop-rule-field">
          <strong>什么时候买</strong>
          <select
            aria-label="什么时候买"
            value={draft.entry}
            onChange={(event) => {
              setDraft({ ...draft, entry: event.target.value as EntryRule });
              setSaved(false);
            }}
          >
            {(Object.keys(ENTRY_LABELS) as EntryRule[]).map((entry) => (
              <option key={entry} value={entry}>
                {ENTRY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="shop-rule-field">
          <legend>投入多少 · 目标上限</legend>
          <div className="shop-rule-options">
            {([0.25, 0.5, 0.75] as const).map((allocation) => (
              <button
                type="button"
                key={allocation}
                aria-pressed={draft.allocation === allocation}
                onClick={() => {
                  setDraft({ ...draft, allocation });
                  setSaved(false);
                }}
              >
                {allocation * 100}%
              </button>
            ))}
          </div>
        </fieldset>
        <label className="shop-rule-field">
          <strong>何时退出</strong>
          <select
            aria-label="何时退出"
            value={draft.exit}
            onChange={(event) => {
              setDraft({ ...draft, exit: event.target.value as ExitRule });
              setSaved(false);
            }}
          >
            {(Object.keys(EXIT_LABELS) as ExitRule[]).map((exit) => (
              <option key={exit} value={exit}>
                {EXIT_LABELS[exit]}
              </option>
            ))}
          </select>
        </label>
        <div className="shop-rule-evaluation" aria-live="polite">
          <strong>入场：{stateLabel(evaluation.entry)}</strong>
          <strong>退出：{stateLabel(evaluation.exit)}</strong>
          <p>{evaluation.reason}</p>
        </div>
        <button
          className="shop-learning-primary"
          type="button"
          disabled={!learning.state}
          onClick={() => {
            learning.setRule(draft, product);
            setSaved(true);
          }}
        >
          {saved ? "已保存我的规则" : "保存我的规则"}
        </button>
        {saved && (
          <p role="status">只记录明确选择；资金比例仍以实际成交为准。</p>
        )}
      </div>
    </GameDialog>
  );
}

import { LOCATION_IDS } from "../../game/content";
import { PRODUCT_IDS } from "../model";
import type { TradingGame } from "../model";
import { replayAccount } from "./accounts";
import { validRule } from "./rules";
import { createLearningState, recordLearningAction } from "./state";
import { INDICATOR_IDS } from "./types";
import type {
  KnowledgePrompt,
  LearningAction,
  LearningEvent,
  LearningState,
  TradingRule,
} from "./types";

export const LEARNING_STORAGE_KEY = "panda-town.learning.v1";
const object = (value: unknown): value is object =>
  typeof value === "object" && value !== null;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 2000;
const id = (value: unknown): value is string =>
  text(value) && value.trim().length > 0 && value.length <= 400;
const index = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 199;
function promptValid(value: unknown): value is KnowledgePrompt {
  if (!object(value)) return false;
  const prompt = value as Partial<KnowledgePrompt>;
  return (
    (prompt.kind === "candle" || prompt.kind === "rule") &&
    id(prompt.id) &&
    text(prompt.title) &&
    Array.isArray(prompt.options) &&
    prompt.options.length === 2 &&
    prompt.options.every((item: unknown) => {
      if (!object(item)) return false;
      const option = item as Partial<KnowledgePrompt["options"][number]>;
      return id(option.id) && text(option.label);
    }) &&
    PRODUCT_IDS.some((product) => product === prompt.product) &&
    index(prompt.index) &&
    (prompt.rule === null || validRule(prompt.rule)) &&
    (prompt.ruleEventId === null || id(prompt.ruleEventId)) &&
    typeof prompt.transfer === "boolean"
  );
}
function eventValid(value: unknown): value is LearningEvent {
  if (!object(value)) return false;
  const event = value as Partial<LearningEvent>;
  if (
    !id(event.id) ||
    !id(event.sessionId) ||
    !index(event.round) ||
    event.round === 0 ||
    !LOCATION_IDS.some((location) => location === event.location) ||
    !PRODUCT_IDS.some((product) => product === event.product) ||
    !index(event.marketIndex)
  )
    return false;
  if (event.kind === "rule") return validRule(event.rule);
  if (event.kind === "indicator")
    return (
      INDICATOR_IDS.some((indicator) => indicator === event.indicator) &&
      (event.interaction === "view" || event.interaction === "mark") &&
      index(event.index) &&
      (event.triggered === null || typeof event.triggered === "boolean") &&
      text(event.explanation)
    );
  if (event.kind === "knowledge")
    return (
      promptValid(event.prompt) &&
      (event.answerId === null || id(event.answerId)) &&
      (event.correct === null || typeof event.correct === "boolean") &&
      text(event.explanation)
    );
  return false;
}
function sameRule(
  left: TradingRule | null,
  right: TradingRule | null,
): boolean {
  return left === null || right === null
    ? left === right
    : left.entry === right.entry &&
        left.allocation === right.allocation &&
        left.exit === right.exit;
}
function samePrompt(left: KnowledgePrompt, right: KnowledgePrompt): boolean {
  return (
    left.kind === right.kind &&
    left.id === right.id &&
    left.title === right.title &&
    left.product === right.product &&
    left.index === right.index &&
    left.ruleEventId === right.ruleEventId &&
    left.transfer === right.transfer &&
    sameRule(left.rule, right.rule) &&
    left.options.every(
      (option, position) =>
        option.id === right.options[position]?.id &&
        option.label === right.options[position]?.label,
    )
  );
}
function sameEvent(left: LearningEvent, right: LearningEvent): boolean {
  if (
    left.id !== right.id ||
    left.sessionId !== right.sessionId ||
    left.round !== right.round ||
    left.location !== right.location ||
    left.product !== right.product ||
    left.marketIndex !== right.marketIndex
  )
    return false;
  if (left.kind === "rule" && right.kind === "rule")
    return sameRule(left.rule, right.rule);
  if (left.kind === "indicator" && right.kind === "indicator")
    return (
      left.indicator === right.indicator &&
      left.interaction === right.interaction &&
      left.index === right.index &&
      left.triggered === right.triggered &&
      left.explanation === right.explanation
    );
  if (left.kind === "knowledge" && right.kind === "knowledge")
    return (
      left.answerId === right.answerId &&
      left.correct === right.correct &&
      left.explanation === right.explanation &&
      samePrompt(left.prompt, right.prompt)
    );
  return false;
}
export function restoreLearningState(
  raw: string,
  game: TradingGame,
): LearningState | null {
  if (raw.length > 8_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value)) return null;
    const state = value as Partial<LearningState>;
    if (
      state.version !== 1 ||
      state.sessionId !== game.sessionId ||
      !(state.rule === null || validRule(state.rule)) ||
      !Array.isArray(state.events) ||
      state.events.length > 10_000 ||
      !state.events.every(eventValid)
    )
      return null;
    const contexts = replayAccount(game).contexts;
    let restored = createLearningState(game.sessionId),
      previousRound = 0;
    for (const event of state.events) {
      const context = contexts.get(event.round);
      if (
        !context ||
        event.round < previousRound ||
        event.sessionId !== game.sessionId ||
        event.marketIndex !== context.marketIndex ||
        event.location !== context.location
      )
        return null;
      previousRound = event.round;
      let action: LearningAction;
      if (event.kind === "rule")
        action = {
          type: "set-rule",
          id: event.id,
          rule: event.rule,
          product: event.product,
        };
      else if (event.kind === "indicator")
        action = {
          type: "indicator",
          id: event.id,
          indicator: event.indicator,
          interaction: event.interaction,
          index: event.index,
          product: event.product,
        };
      else
        action = {
          type: "answer",
          id: event.id,
          promptId: event.prompt.id,
          answerId: event.answerId,
          product: event.product,
        };
      const next = recordLearningAction(restored, context, action);
      const generated = next.events.at(-1);
      if (next === restored || !generated || !sameEvent(event, generated))
        return null;
      restored = next;
    }
    return sameRule(state.rule, restored.rule) ? restored : null;
  } catch {
    return null;
  }
}
export function clearLearningStorage(
  storage: Pick<Storage, "removeItem">,
): boolean {
  try {
    storage.removeItem(LEARNING_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function saveLearningState(
  storage: Pick<Storage, "setItem">,
  state: LearningState,
): boolean {
  try {
    storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

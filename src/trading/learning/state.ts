import { PRODUCT_IDS } from "../model";
import type { TradingGame } from "../model";
import { getKnowledgePrompt, resolveKnowledgeAnswer } from "./knowledge";
import { getIndicatorSignal, validRule } from "./rules";
import { INDICATOR_IDS } from "./types";
import type { LearningAction, LearningContext, LearningState } from "./types";

export function createLearningState(sessionId: string): LearningState {
  if (!sessionId.trim()) throw new Error("学习记录必须关联非空局标识");
  return { version: 1, sessionId, rule: null, events: [] };
}
export function recordLearningAction(
  state: LearningState,
  game: TradingGame,
  action: LearningAction,
): LearningState {
  if (
    state.sessionId !== game.sessionId ||
    !(game.phase === "decision" || game.phase === "feedback") ||
    !action.id.trim() ||
    state.events.some((event) => event.id === action.id) ||
    !PRODUCT_IDS.includes(action.product)
  )
    return state;
  const context: LearningContext = {
    id: action.id,
    sessionId: game.sessionId,
    round: game.round,
    location: game.location,
    product: action.product,
    marketIndex: game.marketIndex,
  };
  if (action.type === "set-rule") {
    if (
      !validRule(action.rule) ||
      (state.rule &&
        state.rule.entry === action.rule.entry &&
        state.rule.exit === action.rule.exit &&
        state.rule.allocation === action.rule.allocation)
    )
      return state;
    return {
      ...state,
      rule: { ...action.rule },
      events: [
        ...state.events,
        { ...context, kind: "rule", rule: { ...action.rule } },
      ],
    };
  }
  if (action.type === "indicator") {
    if (
      !INDICATOR_IDS.includes(action.indicator) ||
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index > game.marketIndex ||
      state.events.some(
        (event) =>
          event.kind === "indicator" &&
          event.round === game.round &&
          event.product === action.product &&
          event.indicator === action.indicator &&
          event.interaction === action.interaction,
      )
    )
      return state;
    const signal = getIndicatorSignal(
      action.indicator,
      action.product,
      action.index,
    );
    return {
      ...state,
      events: [
        ...state.events,
        {
          ...context,
          kind: "indicator",
          indicator: action.indicator,
          interaction: action.interaction,
          index: action.index,
          triggered: signal.triggered,
          explanation: signal.reason,
        },
      ],
    };
  }
  const prompt = getKnowledgePrompt(game, state, action.product);
  if (
    !prompt ||
    prompt.id !== action.promptId ||
    (action.answerId !== null &&
      !prompt.options.some((option) => option.id === action.answerId))
  )
    return state;
  const answer = resolveKnowledgeAnswer(prompt, action.answerId);
  return {
    ...state,
    events: [
      ...state.events,
      {
        ...context,
        kind: "knowledge",
        prompt,
        answerId: action.answerId,
        correct: answer.correct,
        explanation: answer.explanation,
      },
    ],
  };
}

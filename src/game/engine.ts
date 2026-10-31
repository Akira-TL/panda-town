export const RULES_VERSION = 2;
export type Scenario = "A" | "B";
export type Effect =
  | { kind: "work" | "observe" | "buy-stall" | "cooperate" | "sell-investment" }
  | { kind: "consume"; itemId: string; amount: 60 | 120 }
  | { kind: "buy-tool"; quality: "used" | "premium" }
  | { kind: "invest"; amount: 200 | 400 };
export interface OptionDefinition {
  id: string;
  label: string;
  effect: Effect;
}
export interface Material {
  id: string;
  sourceId: string;
  text: string;
}
export interface Question {
  id: string;
  prompt: string;
  answers: { id: string; label: string }[];
  correctAnswerId: string;
  explanation: string;
}
export interface EventDefinition {
  id: string;
  contextId: string;
  locationId: string;
  options: OptionDefinition[];
  materials?: Material[];
  questions?: Question[];
}
export interface PresentedOption extends OptionDefinition {
  available: boolean;
  cost: number;
  shortfall: number;
}
export interface PresentedEvent extends Omit<EventDefinition, "options"> {
  options: PresentedOption[];
}
export type Tool =
  | { status: "none" }
  | { status: "pending"; deliveryDay: number }
  | { status: "owned"; quality: "used" | "premium" };
export interface Assets {
  stall: { boughtDay: number; cost: 600 } | null;
  tool: Tool;
  investment: { cost: number; shares: number; purchasePrice: number } | null;
  items: string[];
}
export interface Evidence {
  id: string;
  sessionId: string;
  rulesVersion: number;
  day: number;
  eventId: string;
  contextId: string;
  locationId: string;
  action: "inspect" | "compare" | "answer" | "choose";
  choice: string;
  cashBefore: number;
  cashAfter: number;
  assetsBefore: Assets;
  assetsAfter: Assets;
  options: PresentedOption[];
  knownMaterials: Material[];
  correct: boolean | null;
}
export interface GameState {
  rulesVersion: number;
  sessionId: string;
  scenario: Scenario;
  day: number;
  phase: "travel" | "decision" | "feedback" | "settlement" | "report";
  cash: number;
  assets: Assets;
  event: PresentedEvent | null;
  evidence: Evidence[];
  inspected: string[];
  answered: string[];
  processed: string[];
  opponent: { cash: number; stallBoughtDay: number | null };
  result: { opened: boolean; cashBeforeOpening: number; gap: number } | null;
}
type ActionPayload =
  | { type: "open-event"; event: EventDefinition }
  | { type: "inspect"; materialId: string }
  | { type: "compare"; materialIds: [string, string] }
  | { type: "answer"; questionId: string; answerId: string }
  | { type: "choose"; optionId: string }
  | { type: "end-turn" }
  | { type: "finish"; sellStall: boolean; sellInvestment: boolean };
export type GameAction = ActionPayload & { id: string; day: number };
export function createGame(sessionId: string, scenario: Scenario): GameState {
  return {
    rulesVersion: RULES_VERSION,
    sessionId,
    scenario,
    day: 1,
    phase: "travel",
    cash: 1000,
    assets: { stall: null, tool: { status: "none" }, investment: null, items: [] },
    event: null,
    evidence: [],
    inspected: [],
    answered: [],
    processed: [],
    opponent: { cash: 1000, stallBoughtDay: null },
    result: null,
  };
}
export function currentPrice(state: Pick<GameState, "day" | "scenario">): number {
  return state.day >= 8
    ? state.scenario === "A"
      ? 110
      : 90
    : state.day >= 4
      ? state.scenario === "A"
        ? 80
        : 120
      : 100;
}
export function investmentValue(state: GameState): number {
  return Math.round((state.assets.investment?.shares ?? 0) * currentPrice(state));
}
function costOf(effect: Effect): number {
  switch (effect.kind) {
    case "consume":
    case "invest":
      return effect.amount;
    case "buy-stall":
      return 600;
    case "buy-tool":
      return effect.quality === "used" ? 100 : 180;
    case "cooperate":
      return 100;
    default:
      return 0;
  }
}
function allowed(state: GameState, effect: Effect): boolean {
  if (state.cash < costOf(effect)) return false;
  switch (effect.kind) {
    case "consume":
      return !state.assets.items.includes(effect.itemId);
    case "buy-stall":
      return state.assets.stall === null;
    case "buy-tool":
      return state.assets.tool.status === "none";
    case "cooperate":
      return state.day >= 2 && state.day <= 7 && state.assets.tool.status === "none";
    case "invest":
      return state.day <= 7 && state.assets.investment === null;
    case "sell-investment":
      return state.day >= 4 && state.assets.investment !== null;
    default:
      return true;
  }
}
function applyEffect(state: GameState, effect: Effect): void {
  state.cash -= costOf(effect);
  switch (effect.kind) {
    case "work":
      state.cash += 250;
      break;
    case "consume":
      state.assets.items.push(effect.itemId);
      break;
    case "buy-stall":
      state.assets.stall = { boughtDay: state.day, cost: 600 };
      break;
    case "buy-tool":
      state.assets.tool = { status: "owned", quality: effect.quality };
      break;
    case "cooperate":
      state.assets.tool = { status: "pending", deliveryDay: state.day + 1 };
      break;
    case "invest":
      state.assets.investment = {
        cost: effect.amount,
        shares: effect.amount / currentPrice(state),
        purchasePrice: currentPrice(state),
      };
      break;
    case "sell-investment":
      state.cash += investmentValue(state);
      state.assets.investment = null;
      break;
  }
}
function record(
  state: GameState,
  before: GameState,
  action: GameAction,
  kind: Evidence["action"],
  choice: string,
  correct: boolean | null = null,
): void {
  const event = before.event;
  if (!event) return;
  state.evidence.push({
    id: action.id,
    sessionId: state.sessionId,
    rulesVersion: RULES_VERSION,
    day: state.day,
    eventId: event.id,
    contextId: event.contextId,
    locationId: event.locationId,
    action: kind,
    choice,
    cashBefore: before.cash,
    cashAfter: state.cash,
    assetsBefore: structuredClone(before.assets),
    assetsAfter: structuredClone(state.assets),
    options: structuredClone(event.options),
    knownMaterials: (event.materials ?? []).filter((m) => state.inspected.includes(m.id)),
    correct,
  });
}
/** 仅接受当前阶段动作；返回原对象表示动作被拒绝或已经执行。 */
export function dispatch(state: GameState, action: GameAction): GameState {
  if (
    state.rulesVersion !== RULES_VERSION ||
    state.day !== action.day ||
    state.processed.includes(action.id) ||
    state.phase === "report"
  )
    return state;
  const next = structuredClone(state);
  switch (action.type) {
    case "open-event": {
      if (
        state.phase !== "travel" ||
        new Set(action.event.options.map((o) => o.id)).size !== action.event.options.length
      )
        return state;
      const options = structuredClone(action.event.options);
      if (!options.some((o) => o.effect.kind === "work")) {
        if (options.some((o) => o.id === "__work")) return state;
        options.push({ id: "__work", label: "临时工作 +250", effect: { kind: "work" } });
      }
      next.event = {
        ...structuredClone(action.event),
        options: options.map((o) => ({
          ...o,
          cost: costOf(o.effect),
          available: allowed(state, o.effect),
          shortfall: Math.max(0, costOf(o.effect) - state.cash),
        })),
      };
      next.phase = "decision";
      break;
    }
    case "choose": {
      if (state.phase !== "decision") return state;
      const option = state.event?.options.find((o) => o.id === action.optionId);
      if (!option?.available || !allowed(state, option.effect)) return state;
      applyEffect(next, option.effect);
      next.phase = "feedback";
      record(next, state, action, "choose", option.id);
      break;
    }
    case "inspect": {
      if (state.phase !== "decision" || !state.event?.materials?.some((m) => m.id === action.materialId))
        return state;
      if (!next.inspected.includes(action.materialId)) next.inspected.push(action.materialId);
      record(next, state, action, "inspect", action.materialId);
      break;
    }
    case "compare": {
      if (state.phase !== "decision") return state;
      const materials = action.materialIds.map((id) => state.event?.materials?.find((m) => m.id === id));
      if (
        !materials[0] ||
        !materials[1] ||
        materials[0].sourceId === materials[1].sourceId ||
        !action.materialIds.every((id) => state.inspected.includes(id))
      )
        return state;
      record(next, state, action, "compare", action.materialIds.join("|"));
      break;
    }
    case "answer": {
      const question = state.event?.questions?.find((q) => q.id === action.questionId);
      if (
        state.phase !== "decision" ||
        !question ||
        state.answered.includes(question.id) ||
        !question.answers.some((a) => a.id === action.answerId)
      )
        return state;
      next.answered.push(question.id);
      record(
        next,
        state,
        action,
        "answer",
        `${question.id}:${action.answerId}`,
        question.correctAnswerId === action.answerId,
      );
      break;
    }
    case "end-turn": {
      if (state.phase !== "feedback") return state;
      next.cash += 150;
      if (state.assets.stall && state.assets.stall.boughtDay < state.day)
        next.cash +=
          100 + (state.assets.tool.status === "owned" ? (state.assets.tool.quality === "used" ? 20 : 40) : 0);
      if (state.day === 2 && next.opponent.cash >= 600) {
        next.opponent.cash -= 600;
        next.opponent.stallBoughtDay = 2;
      } else next.opponent.cash += 250;
      next.opponent.cash +=
        150 + (next.opponent.stallBoughtDay !== null && next.opponent.stallBoughtDay < state.day ? 100 : 0);
      next.event = null;
      if (state.day === 8) next.phase = "settlement";
      else {
        next.day++;
        next.phase = "travel";
        if (next.assets.tool.status === "pending" && next.assets.tool.deliveryDay === next.day)
          next.assets.tool = { status: "owned", quality: "premium" };
      }
      break;
    }
    case "finish": {
      if (state.phase !== "settlement") return state;
      if (action.sellStall && next.assets.stall) {
        next.cash += 480;
        next.assets.stall = null;
      }
      if (action.sellInvestment && next.assets.investment) {
        next.cash += investmentValue(next);
        next.assets.investment = null;
      }
      next.result = {
        opened: next.cash >= 3000,
        cashBeforeOpening: next.cash,
        gap: Math.max(0, 3000 - next.cash),
      };
      if (next.result.opened) next.cash -= 3000;
      next.phase = "report";
      break;
    }
  }
  next.processed.push(action.id);
  return next;
}
/** 内部情境和未作答的答案不进入界面模型。 */
export function visibleGame(state: GameState) {
  const { scenario: _scenario, event, ...visible } = state;
  return {
    ...visible,
    price: currentPrice(state),
    investmentValue: investmentValue(state),
    event: event
      ? {
          ...event,
          questions: event.questions?.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            answers: q.answers,
            ...(state.answered.includes(q.id)
              ? { correctAnswerId: q.correctAnswerId, explanation: q.explanation }
              : {}),
          })),
        }
      : null,
  };
}

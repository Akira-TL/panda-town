import {
  createGame,
  RULES_VERSION,
  type Assets,
  type Evidence,
  type GameAction,
  type GameState,
  type PresentedOption,
} from "./engine";
import { LOCATION_IDS, LOCATIONS, type LocationId } from "./content";

export const STORAGE_KEY = "panda-town.current.v1";
export type ActionInput = GameAction extends infer A
  ? A extends GameAction
    ? Omit<A, "id" | "day">
    : never
  : never;
export interface Session {
  game: GameState;
  position: LocationId;
  remaining: number;
  rolled: boolean;
  branch: boolean;
  die: number;
  sellStall: boolean;
  sellInvestment: boolean;
}
export function freshSession(): Session {
  return {
    game: createGame(crypto.randomUUID(), Math.random() < 0.5 ? "A" : "B"),
    position: "square",
    remaining: 0,
    rolled: false,
    branch: false,
    die: 0,
    sellStall: false,
    sellInvestment: false,
  };
}
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((v) => typeof v === "string");
const object = (x: unknown): x is object => typeof x === "object" && x !== null;
function assetsValid(x: unknown): x is Assets {
  if (!object(x)) return false;
  const a = x as Partial<Assets>;
  if (!strings(a.items) || !object(a.tool)) return false;
  if (
    a.stall !== null &&
    (!object(a.stall) ||
      !Number.isInteger(a.stall.boughtDay) ||
      a.stall.boughtDay < 1 ||
      a.stall.boughtDay > 8 ||
      a.stall.cost !== 600)
  )
    return false;
  if (
    a.investment !== null &&
    (!object(a.investment) ||
      !finite(a.investment.cost) ||
      !finite(a.investment.shares) ||
      !finite(a.investment.purchasePrice) ||
      a.investment.shares <= 0 ||
      a.investment.purchasePrice <= 0)
  )
    return false;
  return (
    a.tool.status === "none" ||
    (a.tool.status === "owned" &&
      ["used", "premium"].includes(a.tool.quality)) ||
    (a.tool.status === "pending" &&
      Number.isInteger(a.tool.deliveryDay) &&
      a.tool.deliveryDay >= 2 &&
      a.tool.deliveryDay <= 8)
  );
}
function optionValid(x: unknown): x is PresentedOption {
  if (!object(x)) return false;
  const o = x as Partial<PresentedOption>;
  if (
    typeof o.id !== "string" ||
    typeof o.label !== "string" ||
    typeof o.available !== "boolean" ||
    !finite(o.cost) ||
    !finite(o.shortfall) ||
    !object(o.effect)
  )
    return false;
  switch (o.effect.kind) {
    case "work":
    case "observe":
    case "buy-stall":
    case "cooperate":
    case "sell-investment":
      return true;
    case "consume":
      return (
        typeof o.effect.itemId === "string" &&
        [60, 120].includes(o.effect.amount)
      );
    case "buy-tool":
      return o.effect.quality === "used" || o.effect.quality === "premium";
    case "invest":
      return o.effect.amount === 200 || o.effect.amount === 400;
    default:
      return false;
  }
}
function materialsValid(x: unknown): boolean {
  return (
    Array.isArray(x) &&
    x.every(
      (m) =>
        object(m) &&
        "id" in m &&
        typeof m.id === "string" &&
        "sourceId" in m &&
        typeof m.sourceId === "string" &&
        "text" in m &&
        typeof m.text === "string",
    )
  );
}
function evidenceValid(x: unknown): x is Evidence {
  if (!object(x)) return false;
  const e = x as Partial<Evidence>;
  return (
    typeof e.id === "string" &&
    typeof e.sessionId === "string" &&
    e.rulesVersion === RULES_VERSION &&
    Number.isInteger(e.day) &&
    (e.day ?? 0) >= 1 &&
    (e.day ?? 9) <= 8 &&
    typeof e.eventId === "string" &&
    typeof e.contextId === "string" &&
    typeof e.locationId === "string" &&
    ["inspect", "compare", "answer", "choose"].includes(e.action ?? "") &&
    typeof e.choice === "string" &&
    finite(e.cashBefore) &&
    finite(e.cashAfter) &&
    assetsValid(e.assetsBefore) &&
    Array.isArray(e.options) &&
    e.options.every(optionValid) &&
    materialsValid(e.knownMaterials) &&
    (e.correct === null || typeof e.correct === "boolean")
  );
}
export function restoreSession(raw: string): Session | null {
  const value: unknown = JSON.parse(raw);
  if (!object(value)) return null;
  const s = value as Partial<Session>;
  if (
    !object(s.game) ||
    !LOCATION_IDS.includes(s.position as LocationId) ||
    !Number.isInteger(s.remaining) ||
    (s.remaining ?? -1) < 0 ||
    (s.remaining ?? 7) > 6 ||
    !Number.isInteger(s.die) ||
    (s.die ?? -1) < 0 ||
    (s.die ?? 7) > 6 ||
    typeof s.rolled !== "boolean" ||
    typeof s.branch !== "boolean" ||
    typeof s.sellStall !== "boolean" ||
    typeof s.sellInvestment !== "boolean"
  )
    return null;
  const g = s.game;
  if (
    g.rulesVersion !== RULES_VERSION ||
    typeof g.sessionId !== "string" ||
    !["A", "B"].includes(g.scenario) ||
    !Number.isInteger(g.day) ||
    g.day < 1 ||
    g.day > 8 ||
    !["travel", "decision", "feedback", "settlement", "report"].includes(
      g.phase,
    ) ||
    !finite(g.cash) ||
    g.cash < 0 ||
    !assetsValid(g.assets) ||
    !Array.isArray(g.evidence) ||
    !g.evidence.every(evidenceValid) ||
    !strings(g.inspected) ||
    !strings(g.answered) ||
    !strings(g.processed) ||
    !object(g.opponent) ||
    !finite(g.opponent.cash) ||
    (g.opponent.stallBoughtDay !== null && g.opponent.stallBoughtDay !== 2)
  )
    return null;
  if (
    g.evidence.some((e) => e.sessionId !== g.sessionId || e.day > g.day) ||
    new Set(g.evidence.map((e) => e.id)).size !== g.evidence.length ||
    (s.remaining ?? 0) > (s.die ?? 0) ||
    (!s.rolled && (s.remaining !== 0 || s.branch))
  )
    return null;
  if (g.event !== null) {
    const e = g.event;
    if (
      !object(e) ||
      typeof e.id !== "string" ||
      typeof e.contextId !== "string" ||
      typeof e.locationId !== "string" ||
      e.locationId !== s.position ||
      !Array.isArray(e.options) ||
      !e.options.every(optionValid) ||
      (e.materials !== undefined && !materialsValid(e.materials))
    )
      return null;
    if (
      e.questions !== undefined &&
      (!Array.isArray(e.questions) ||
        !e.questions.every(
          (q) =>
            object(q) &&
            typeof q.id === "string" &&
            typeof q.prompt === "string" &&
            typeof q.correctAnswerId === "string" &&
            typeof q.explanation === "string" &&
            Array.isArray(q.answers) &&
            q.answers.every(
              (a) =>
                object(a) &&
                typeof a.id === "string" &&
                typeof a.label === "string",
            ),
        ))
    )
      return null;
  }
  if (
    ((g.phase === "decision" || g.phase === "feedback") && !g.event) ||
    ((g.phase === "travel" ||
      g.phase === "settlement" ||
      g.phase === "report") &&
      g.event !== null)
  )
    return null;
  if (
    g.result !== null &&
    (!object(g.result) ||
      typeof g.result.opened !== "boolean" ||
      !finite(g.result.cashBeforeOpening) ||
      !finite(g.result.gap))
  )
    return null;
  if (
    (g.phase === "report" && !g.result) ||
    (g.phase !== "report" && g.result !== null) ||
    (g.phase === "settlement" && g.day !== 8)
  )
    return null;
  if (
    s.branch &&
    (!s.rolled ||
      s.remaining === 0 ||
      g.phase !== "travel" ||
      (LOCATIONS.find((p) => p.id === s.position)?.next.length ?? 0) < 2)
  )
    return null;
  return s as Session;
}

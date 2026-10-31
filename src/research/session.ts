import { LOCATIONS, LOCATION_IDS } from "../game/content";
import { DATASET_VERSION } from "./data";
import type {
  ResearchSession,
  ResearchState,
  ResearchEvidence,
  SimulationConfig,
  SimulationResult,
  Trade,
  SimulationOrder,
  EquityPoint,
  QuizAnswer,
} from "./model";

export const RESEARCH_STORAGE_KEY = "panda-town.research.v3";
export const LEGACY_STORAGE_KEY = "panda-town.current.v1";

const object = (x: unknown): x is object => typeof x === "object" && x !== null;
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const text = (x: unknown): x is string =>
  typeof x === "string" && x.length <= 10_000;
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length <= 1000 && x.every(text);
const date = (x: unknown): x is string =>
  text(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);
function oneOf<T extends string>(x: unknown, values: readonly T[]): x is T {
  return typeof x === "string" && values.includes(x as T);
}
function configValid(x: unknown): x is SimulationConfig {
  if (!object(x)) return false;
  const c = x as Partial<SimulationConfig>;
  return (
    oneOf(c.rule, ["trend", "reversion", "hold"]) &&
    [0, 0.3, 0.6, 1].includes(c.allocation ?? -1) &&
    [1, 5].includes(c.frequency ?? -1) &&
    finite(c.feeBps) &&
    c.feeBps >= 0 &&
    c.feeBps <= 1000 &&
    finite(c.slippageBps) &&
    c.slippageBps >= 0 &&
    c.slippageBps <= 1000 &&
    c.initialCash === 1000 &&
    oneOf(c.segment, ["research", "validation"])
  );
}
function pointValid(x: unknown): x is EquityPoint {
  if (!object(x)) return false;
  const p = x as Partial<EquityPoint>;
  return (
    date(p.date) &&
    finite(p.equity) &&
    p.equity >= 0 &&
    finite(p.cash) &&
    p.cash >= -0.000001 &&
    finite(p.benchmark) &&
    p.benchmark >= 0
  );
}
function tradeValid(x: unknown): x is Trade {
  if (!object(x)) return false;
  const t = x as Partial<Trade>;
  return (
    text(t.id) &&
    date(t.signalDate) &&
    date(t.date) &&
    t.signalDate < t.date &&
    oneOf(t.asset, ["bamboo", "pine"]) &&
    oneOf(t.side, ["buy", "sell"]) &&
    finite(t.quantity) &&
    t.quantity > 0 &&
    finite(t.price) &&
    t.price > 0 &&
    finite(t.gross) &&
    t.gross > 0 &&
    finite(t.fee) &&
    t.fee >= 0 &&
    finite(t.cashAfter) &&
    t.cashAfter >= -0.000001
  );
}
function orderValid(x: unknown): x is SimulationOrder {
  if (!object(x)) return false;
  const o = x as Partial<SimulationOrder>;
  return (
    text(o.id) &&
    date(o.signalDate) &&
    date(o.date) &&
    o.signalDate < o.date &&
    oneOf(o.asset, ["bamboo", "pine"]) &&
    oneOf(o.side, ["buy", "sell"]) &&
    finite(o.requestedQuantity) &&
    o.requestedQuantity > 0 &&
    finite(o.filledQuantity) &&
    o.filledQuantity >= 0 &&
    o.filledQuantity <= o.requestedQuantity + 0.000001 &&
    oneOf(o.status, ["filled", "partial", "rejected"]) &&
    text(o.reason)
  );
}
function runValid(x: unknown): x is SimulationResult {
  if (!object(x)) return false;
  const r = x as Partial<SimulationResult>;
  if (
    !text(r.id) ||
    r.datasetVersion !== DATASET_VERSION ||
    !configValid(r.config) ||
    !date(r.startDate) ||
    !date(r.endDate) ||
    r.startDate > r.endDate ||
    !Array.isArray(r.points) ||
    r.points.length < 1 ||
    r.points.length > 300 ||
    !r.points.every(pointValid) ||
    !Array.isArray(r.trades) ||
    r.trades.length > 2000 ||
    !r.trades.every(tradeValid) ||
    !Array.isArray(r.orders) ||
    r.orders.length > 2000 ||
    !r.orders.every(orderValid) ||
    !strings(r.warnings) ||
    !object(r.metrics)
  )
    return false;
  const m = r.metrics;
  return (
    finite(m.finalEquity) &&
    m.finalEquity >= 0 &&
    finite(m.netProfit) &&
    finite(m.netReturn) &&
    m.netReturn >= -1.000001 &&
    finite(m.maxDrawdown) &&
    m.maxDrawdown >= 0 &&
    m.maxDrawdown <= 1.000001 &&
    finite(m.fees) &&
    m.fees >= 0 &&
    Number.isInteger(m.tradeCount) &&
    m.tradeCount === r.trades.length &&
    finite(m.benchmarkReturn) &&
    Math.abs(m.finalEquity - r.points.at(-1)!.equity) < 0.0001 &&
    Math.abs(m.netProfit - (m.finalEquity - 1000)) < 0.0001 &&
    Math.abs(m.netReturn - m.netProfit / 1000) < 0.0001
  );
}
const topics = [
  "source",
  "quality",
  "explanation",
  "rule",
  "comparison",
  "drawdown",
  "trades",
  "validation",
  "cost",
] as const;
const validations = [
  "unseen",
  "checked",
  "deferred",
  "needs-new-data",
] as const;
function evidenceValid(x: unknown): x is ResearchEvidence {
  if (!object(x)) return false;
  const e = x as Partial<ResearchEvidence>;
  return (
    text(e.id) &&
    text(e.sessionId) &&
    Number.isInteger(e.day) &&
    e.day! >= 1 &&
    e.day! <= 8 &&
    text(e.contextId) &&
    oneOf(e.location, LOCATION_IDS) &&
    oneOf(e.action, ["choose", "inspect", "answer", "run"]) &&
    text(e.choice) &&
    text(e.label) &&
    Array.isArray(e.knownTopics) &&
    e.knownTopics.every((topic) => oneOf(topic, topics)) &&
    strings(e.options) &&
    strings(e.runIds) &&
    (e.rule === null || oneOf(e.rule, ["trend", "reversion", "hold"])) &&
    [0, 0.3, 0.6, 1].includes(e.allocation ?? -1) &&
    (e.config === null || configValid(e.config)) &&
    Number.isInteger(e.strategyVersion) &&
    e.strategyVersion! >= 0 &&
    e.datasetVersion === DATASET_VERSION &&
    oneOf(e.validation, validations) &&
    text(e.outcome)
  );
}
function answerValid(x: unknown): x is QuizAnswer {
  if (!object(x)) return false;
  const a = x as Partial<QuizAnswer>;
  return (
    oneOf(a.id, ["backtest", "fees"]) &&
    oneOf(a.answer, ["yes", "no", "unsure"]) &&
    a.correct === (a.answer === "no") &&
    Number.isInteger(a.day) &&
    a.day! >= (a.id === "backtest" ? 4 : 7) &&
    a.day! <= 8
  );
}
function researchValid(x: unknown): x is ResearchState {
  if (!object(x)) return false;
  const s = x as Partial<ResearchState>;
  if (
    s.version !== 3 ||
    !text(s.sessionId) ||
    !s.sessionId ||
    !Number.isInteger(s.day) ||
    s.day! < 1 ||
    s.day! > 8 ||
    !oneOf(s.phase, ["travel", "decision", "feedback", "exhibit", "report"]) ||
    !(s.intent === null || oneOf(s.intent, ["return", "risk", "cost"])) ||
    !(
      s.dataFocus === null ||
      oneOf(s.dataFocus, ["source", "quality", "assisted"])
    ) ||
    !(s.rule === null || oneOf(s.rule, ["trend", "reversion", "hold"])) ||
    ![0, 0.3, 0.6, 1].includes(s.allocation ?? -1) ||
    ![1, 5].includes(s.frequency ?? -1) ||
    !finite(s.feeBps) ||
    s.feeBps < 0 ||
    s.feeBps > 1000 ||
    !finite(s.slippageBps) ||
    s.slippageBps < 0 ||
    s.slippageBps > 1000 ||
    !Number.isInteger(s.strategyVersion) ||
    s.strategyVersion! < 0 ||
    !oneOf(s.validation, validations) ||
    !(
      s.finalDecision === null ||
      oneOf(s.finalDecision, ["simulate", "revise", "defer"])
    ) ||
    !Array.isArray(s.runs) ||
    s.runs.length > 30 ||
    !s.runs.every(runValid) ||
    !Array.isArray(s.evidence) ||
    s.evidence.length > 1000 ||
    !s.evidence.every(evidenceValid) ||
    !Array.isArray(s.answers) ||
    s.answers.length > 2 ||
    !s.answers.every(answerValid) ||
    !strings(s.processed) ||
    new Set(s.processed).size !== s.processed.length ||
    !oneOf(s.location, LOCATION_IDS) ||
    !text(s.feedback)
  )
    return false;
  const ids = new Set(s.runs.map((run) => run.id));
  return (
    s.evidence.every(
      (e) =>
        e.sessionId === s.sessionId &&
        e.day <= s.day! &&
        e.runIds.every((id) => ids.has(id)),
    ) &&
    new Set(s.evidence.map((e) => e.id)).size === s.evidence.length &&
    new Set(s.answers.map((a) => a.id)).size === s.answers.length &&
    s.answers.every((a) => a.day <= s.day!) &&
    (!(s.phase === "exhibit" || s.phase === "report") ||
      (s.day === 8 && s.finalDecision !== null))
  );
}
function sessionValid(x: unknown): x is ResearchSession {
  if (!object(x)) return false;
  const s = x as Partial<ResearchSession>;
  if (
    !researchValid(s.research) ||
    !oneOf(s.position, LOCATION_IDS) ||
    !Number.isInteger(s.remaining) ||
    s.remaining! < 0 ||
    s.remaining! > 6 ||
    !Number.isInteger(s.die) ||
    s.die! < 0 ||
    s.die! > 6 ||
    typeof s.rolled !== "boolean" ||
    typeof s.branch !== "boolean"
  )
    return false;
  if (s.research.phase !== "travel")
    return s.remaining === 0 && !s.branch && s.research.location === s.position;
  if (s.remaining! > s.die! || (s.remaining! > 0 && !s.rolled)) return false;
  return (
    !s.branch ||
    (s.remaining! > 0 &&
      LOCATIONS.find((place) => place.id === s.position)!.next.length === 2)
  );
}

export function restoreResearchSession(raw: string): ResearchSession | null {
  if (raw.length > 4_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return sessionValid(value) ? value : null;
  } catch {
    return null;
  }
}

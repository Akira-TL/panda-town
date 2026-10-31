import type { LocationId } from "../game/content";

export type AssetId = "bamboo" | "pine";
export type StrategyRule = "trend" | "reversion" | "hold";
export type StudySegment = "research" | "validation";
export type Allocation = 0 | 0.3 | 0.6 | 1;
export interface AssetQuote {
  open: number;
  close: number;
  volume: number;
}
export interface MarketBar {
  date: string;
  bamboo: AssetQuote;
  pine: AssetQuote;
}
export interface DataIssue {
  date: string;
  asset: AssetId;
  field: "close" | "volume";
  received: number | null;
  restored: number;
  explanation: string;
}
export interface SimulationConfig {
  rule: StrategyRule;
  allocation: Allocation;
  frequency: 1 | 5;
  feeBps: number;
  slippageBps: number;
  initialCash: number;
  segment: StudySegment;
}
export interface EquityPoint {
  date: string;
  equity: number;
  cash: number;
  benchmark: number;
}
export interface Trade {
  id: string;
  signalDate: string;
  date: string;
  asset: AssetId;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  gross: number;
  fee: number;
  cashAfter: number;
}
export interface SimulationOrder {
  id: string;
  signalDate: string;
  date: string;
  asset: AssetId;
  side: "buy" | "sell";
  requestedQuantity: number;
  filledQuantity: number;
  status: "filled" | "partial" | "rejected";
  reason: string;
}
export interface SimulationMetrics {
  finalEquity: number;
  netProfit: number;
  netReturn: number;
  maxDrawdown: number;
  fees: number;
  tradeCount: number;
  benchmarkReturn: number;
}
export interface SimulationResult {
  id: string;
  datasetVersion: string;
  config: SimulationConfig;
  startDate: string;
  endDate: string;
  points: EquityPoint[];
  orders: SimulationOrder[];
  trades: Trade[];
  metrics: SimulationMetrics;
  warnings: string[];
}
export type ResearchIntent = "return" | "risk" | "cost";
export type ResearchTopic =
  | "source"
  | "quality"
  | "explanation"
  | "rule"
  | "comparison"
  | "drawdown"
  | "trades"
  | "validation"
  | "cost";
export type ValidationStatus =
  "unseen" | "checked" | "deferred" | "needs-new-data";
export type FinalDecision = "simulate" | "revise" | "defer";
export type QuizId = "backtest" | "fees";
export interface QuizAnswer {
  id: QuizId;
  answer: "yes" | "no" | "unsure";
  correct: boolean;
  day: number;
}
export interface ResearchEvidence {
  id: string;
  sessionId: string;
  day: number;
  contextId: string;
  location: LocationId;
  action: "choose" | "inspect" | "answer" | "run";
  choice: string;
  label: string;
  knownTopics: ResearchTopic[];
  options: string[];
  runIds: string[];
  rule: StrategyRule | null;
  allocation: Allocation;
  config: SimulationConfig | null;
  strategyVersion: number;
  datasetVersion: string;
  validation: ValidationStatus;
  outcome: string;
}
export interface ResearchState {
  version: 3;
  sessionId: string;
  day: number;
  phase: "travel" | "decision" | "feedback" | "exhibit" | "report";
  intent: ResearchIntent | null;
  dataFocus: "source" | "quality" | "assisted" | null;
  rule: StrategyRule | null;
  allocation: Allocation;
  frequency: 1 | 5;
  feeBps: number;
  slippageBps: number;
  strategyVersion: number;
  validation: ValidationStatus;
  finalDecision: FinalDecision | null;
  runs: SimulationResult[];
  evidence: ResearchEvidence[];
  answers: QuizAnswer[];
  processed: string[];
  location: LocationId;
  feedback: string;
}
export type ResearchAction =
  | { type: "arrive"; id: string; day: number; location: LocationId }
  | { type: "choose"; id: string; day: number; optionId: string }
  | { type: "inspect"; id: string; day: number; topic: ResearchTopic }
  | {
      type: "answer";
      id: string;
      day: number;
      question: QuizId;
      answer: "yes" | "no" | "unsure";
    }
  | { type: "continue"; id: string; day: number }
  | { type: "report"; id: string; day: number };
export interface ChapterOption {
  id: string;
  label: string;
  detail: string;
}
export interface Chapter {
  day: number;
  title: string;
  speaker: string;
  dialogue: string;
  options: ChapterOption[];
  topics: ResearchTopic[];
}
export interface ResearchSession {
  research: ResearchState;
  position: LocationId;
  remaining: number;
  die: number;
  rolled: boolean;
  branch: boolean;
}

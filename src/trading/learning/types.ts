import type { LocationId } from "../../game/content";
import type { AccountSnapshot, ProductId } from "../model";

export const INDICATOR_IDS = [
  "ema",
  "macd",
  "rsi",
  "kdj",
  "boll",
  "atr",
] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];
export type EntryRule = "manual" | "ma_cross_up" | "breakout20" | IndicatorId;
export type ExitRule = "manual" | "ma_cross_down" | "loss5";
export interface TradingRule {
  entry: EntryRule;
  allocation: 0.25 | 0.5 | 0.75;
  exit: ExitRule;
}
export interface RuleEvaluation {
  entry: boolean | null;
  exit: boolean | null;
  label: string;
  reason: string;
}
export interface LearningContext {
  id: string;
  sessionId: string;
  round: number;
  location: LocationId;
  product: ProductId;
  marketIndex: number;
}
export interface RuleLearningEvent extends LearningContext {
  kind: "rule";
  rule: TradingRule;
}
export interface IndicatorLearningEvent extends LearningContext {
  kind: "indicator";
  indicator: IndicatorId;
  interaction: "view" | "mark";
  index: number;
  triggered: boolean | null;
  explanation: string;
}
export interface KnowledgePrompt {
  kind: "candle" | "rule";
  id: string;
  title: string;
  options: { id: string; label: string }[];
  product: ProductId;
  index: number;
  rule: TradingRule | null;
  ruleEventId: string | null;
  transfer: boolean;
}
export interface KnowledgeLearningEvent extends LearningContext {
  kind: "knowledge";
  prompt: KnowledgePrompt;
  answerId: string | null;
  correct: boolean | null;
  explanation: string;
}
export type LearningEvent =
  RuleLearningEvent | IndicatorLearningEvent | KnowledgeLearningEvent;
export interface LearningState {
  version: 1;
  sessionId: string;
  rule: TradingRule | null;
  events: LearningEvent[];
}
export type LearningAction =
  | { type: "set-rule"; id: string; rule: TradingRule; product: ProductId }
  | {
      type: "indicator";
      id: string;
      indicator: IndicatorId;
      interaction: "view" | "mark";
      index: number;
      product: ProductId;
    }
  | {
      type: "answer";
      id: string;
      promptId: string;
      answerId: string | null;
      product: ProductId;
    };
export interface AccountCurvePoint {
  round: number;
  marketIndex: number;
  date: string;
  stage: "initial" | "arrival" | "action";
  equity: number;
  cash: number;
  holdingsValue: number;
}
export interface OpponentAction {
  round: number;
  product: ProductId;
  action: "buy" | "sell" | "hold";
  quantity: number;
  price: number;
  fee: number;
  reason: string;
}
export interface OpponentSummary {
  label: string;
  description: string;
  actions: OpponentAction[];
  snapshot: AccountSnapshot;
  alignedRounds: number;
}
export interface LearningSummary {
  ruleLabel: string;
  facts: string[];
  question: string;
  copyText: string;
  maximumDrawdown: number;
  equityCurve: AccountCurvePoint[];
  opponentCurve: AccountCurvePoint[];
  opponent: OpponentSummary;
  knowledge: {
    answered: number;
    correct: number;
    skipped: number;
    transferCorrect: number;
  };
}
export interface LearningHookResult {
  state: LearningState | null;
  summary: LearningSummary | null;
  setRule: (rule: TradingRule, product: ProductId) => void;
  inspectIndicator: (
    indicator: IndicatorId,
    kind: "view" | "mark",
    index: number,
    product: ProductId,
  ) => void;
  answerKnowledge: (
    promptId: string,
    answerId: string | null,
    product: ProductId,
  ) => void;
  clear: () => boolean;
  notice: string;
}

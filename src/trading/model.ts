import type { LocationId } from "../game/content";

export const PRODUCT_IDS = [
  "bread",
  "timber",
  "fruit",
  "chips",
  "gold",
  "flowers",
  "coffee",
  "tea",
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];
export type TradingPhase = "travel" | "decision" | "feedback" | "report";
export type TradeSide = "buy" | "sell";
export type TradingTopic = "price" | "risk" | "cost" | "history" | "holdings";

export interface ProductDefinition {
  id: ProductId;
  shop: LocationId;
  name: string;
  symbol: string;
  icon: string;
}
export interface ProductQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface ProductPricePoint {
  index: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  price: number;
  previousClose: number | null;
  change: number | null;
  ma5: number | null;
  ma20: number | null;
}
export interface Holding {
  quantity: number;
  costBasis: number;
}
export type Holdings = Record<ProductId, Holding>;

export interface ShopTrade {
  id: string;
  round: number;
  location: LocationId;
  product: ProductId;
  marketIndex: number;
  date: string;
  side: TradeSide;
  requestedQuantity: number;
  quantity: number;
  price: number;
  gross: number;
  fee: number;
  cashAfter: number;
  holdingAfter: number;
  realizedProfit: number;
}
export interface AccountSnapshot {
  cash: number;
  holdingsValue: number;
  totalAssets: number;
  netProfit: number;
  realizedProfit: number;
  unrealizedProfit: number;
  fees: number;
}
export interface TradingOpportunity {
  buy: boolean;
  sell: boolean;
  hold: boolean;
}
export interface ShopEvidence {
  id: string;
  sessionId: string;
  round: number;
  location: LocationId;
  product: ProductId;
  action: "buy" | "sell" | "hold" | "inspect";
  topic: TradingTopic | null;
  quantity: number;
  quote: number;
  dailyChange: number | null;
  marketIndex: number;
  cashBefore: number;
  cashAfter: number;
  quantityBefore: number;
  quantityAfter: number;
  assetsBefore: number;
  opportunities: TradingOpportunity;
  tradeId: string | null;
}
export interface TradeFeedback {
  kind: "buy" | "sell" | "hold";
  product: ProductId;
  quantity: number;
  cashDelta: number;
  holdingDelta: number;
  fee: number;
  price: number;
}
export interface TradingSettlement {
  round: number;
  date: string;
  snapshot: AccountSnapshot;
}
export interface TradingGame {
  version: 1;
  marketVersion: string;
  sessionId: string;
  phase: TradingPhase;
  round: number;
  marketIndex: number;
  location: LocationId;
  initialCash: number;
  feeBps: number;
  cash: number;
  holdings: Holdings;
  trades: ShopTrade[];
  evidence: ShopEvidence[];
  processed: string[];
  feedback: TradeFeedback | null;
  arrivalDelta: number;
  settlement: TradingSettlement | null;
}
export interface TradePreview {
  enabled: boolean;
  reason: string;
  product: ProductId;
  side: TradeSide;
  requestedQuantity: number;
  quantity: number;
  price: number;
  gross: number;
  fee: number;
  cashDelta: number;
  holdingDelta: number;
  cashAfter: number;
  quantityAfter: number;
}
export type TradingAction =
  | { type: "start-round"; id: string }
  | { type: "arrive"; id: string; location: LocationId }
  | { type: "buy"; id: string; quantity: number }
  | { type: "sell"; id: string; quantity: number; product?: ProductId }
  | { type: "hold"; id: string }
  | { type: "inspect"; id: string; topic: TradingTopic; product?: ProductId }
  | { type: "settle"; id: string };

export interface TradingSession {
  game: TradingGame;
  position: LocationId;
  remaining: number;
  die: number;
  rolled: boolean;
  branch: boolean;
}

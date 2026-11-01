import { LOCATION_IDS } from "../game/content";
import {
  LAST_MARKET_INDEX,
  MARKET_VERSION,
  START_MARKET_INDEX,
  getMarketDate,
  getQuote,
} from "./market";
import { getLocationProduct } from "./products";
import { PRODUCT_IDS } from "./model";
import type {
  AccountSnapshot,
  Holding,
  ProductId,
  ProductQuote,
  ShopEvidence,
  TradePreview,
  TradeSide,
  TradingAction,
  TradingGame,
  TradingOpportunity,
  TradingTopic,
} from "./model";

export interface QuotedTradeInput {
  product: ProductId;
  side: TradeSide;
  requestedQuantity: number;
  quote: ProductQuote;
  cash: number;
  holding: Holding;
  feeBps: number;
}
export interface QuotedTradeResult extends TradePreview {
  costBasisAfter: number;
  realizedProfit: number;
}

/** 已显示收盘价上的纸上成交；独立报价入口供手算核对，不读取未来行情。 */
export function calculateQuotedTrade(
  input: QuotedTradeInput,
): QuotedTradeResult {
  const { product, side, requestedQuantity, quote, cash, holding, feeBps } =
    input;
  const rejected = (reason: string): QuotedTradeResult => ({
    enabled: false,
    reason,
    product,
    side,
    requestedQuantity,
    quantity: 0,
    price: quote.close,
    gross: 0,
    fee: 0,
    cashDelta: 0,
    holdingDelta: 0,
    cashAfter: cash,
    quantityAfter: holding.quantity,
    costBasisAfter: holding.costBasis,
    realizedProfit: 0,
  });
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0)
    return rejected("请输入大于0的有效份数");
  if (
    ![cash, holding.quantity, holding.costBasis, feeBps].every(
      Number.isFinite,
    ) ||
    cash < 0 ||
    holding.quantity < 0 ||
    holding.costBasis < 0 ||
    feeBps < 0
  )
    return rejected("账户或费用参数无效");
  if (
    !Number.isFinite(quote.close) ||
    quote.close <= 0 ||
    !Number.isFinite(quote.volume) ||
    quote.volume <= 0
  )
    return rejected("当前报价没有可成交数量");
  const feeRate = feeBps / 10_000;
  const limit =
    side === "buy" ? cash / (quote.close * (1 + feeRate)) : holding.quantity;
  const quantity = Math.min(requestedQuantity, quote.volume, limit);
  if (!Number.isFinite(quantity) || quantity <= 0)
    return rejected(
      side === "buy" ? "现金不足（含手续费）" : "没有可卖出的持仓",
    );
  const gross = quantity * quote.close;
  const fee = gross * feeRate;
  const cashDelta = side === "buy" ? -gross - fee : gross - fee;
  if (
    ![gross, fee, cashDelta].every(Number.isFinite) ||
    cash + cashDelta < -1e-8
  )
    return rejected("当前金额无法安全计算");
  const fullSale = side === "sell" && quantity === holding.quantity;
  const releasedCost =
    side === "sell"
      ? fullSale
        ? holding.costBasis
        : holding.costBasis * (quantity / holding.quantity)
      : 0;
  return {
    enabled: true,
    reason:
      quantity < requestedQuantity
        ? "按现金、持仓与当日成交量上限部分成交"
        : "按当前显示价格纸上成交",
    product,
    side,
    requestedQuantity,
    quantity,
    price: quote.close,
    gross,
    fee,
    cashDelta,
    holdingDelta: side === "buy" ? quantity : -quantity,
    cashAfter: Math.max(0, cash + cashDelta),
    quantityAfter: fullSale
      ? 0
      : holding.quantity + (side === "buy" ? quantity : -quantity),
    costBasisAfter:
      side === "buy"
        ? holding.costBasis + gross + fee
        : holding.costBasis - releasedCost,
    realizedProfit: side === "sell" ? gross - fee - releasedCost : 0,
  };
}

export interface AccountValuationInput {
  cash: number;
  initialCash: number;
  positions: readonly { holding: Holding; price: number }[];
  realizedProfit: number;
  fees: number;
}

/** 市值结算不卖出、不收假想平仓费；用于独立数字例和真实账户同一估值口径。 */
export function calculateAccountSnapshot(
  input: AccountValuationInput,
): AccountSnapshot {
  const holdingsValue = input.positions.reduce(
    (sum, position) => sum + position.holding.quantity * position.price,
    0,
  );
  const cost = input.positions.reduce(
    (sum, position) => sum + position.holding.costBasis,
    0,
  );
  const totalAssets = input.cash + holdingsValue;
  return {
    cash: input.cash,
    holdingsValue,
    totalAssets,
    netProfit: totalAssets - input.initialCash,
    realizedProfit: input.realizedProfit,
    unrealizedProfit: holdingsValue - cost,
    fees: input.fees,
  };
}

export function createTradingGame(sessionId: string): TradingGame {
  if (!sessionId.trim()) throw new Error("交易局必须有非空标识");
  const empty = (): Holding => ({ quantity: 0, costBasis: 0 });
  return {
    version: 1,
    marketVersion: MARKET_VERSION,
    sessionId,
    phase: "travel",
    round: 0,
    marketIndex: START_MARKET_INDEX,
    location: "square",
    initialCash: 1000,
    feeBps: 10,
    cash: 1000,
    holdings: {
      bread: empty(),
      timber: empty(),
      fruit: empty(),
      chips: empty(),
      gold: empty(),
      flowers: empty(),
      coffee: empty(),
      tea: empty(),
    },
    trades: [],
    evidence: [],
    processed: [],
    feedback: null,
    arrivalDelta: 0,
    settlement: null,
  };
}

export function getAccountSnapshot(game: TradingGame): AccountSnapshot {
  return calculateAccountSnapshot({
    cash: game.cash,
    initialCash: game.initialCash,
    positions: PRODUCT_IDS.map((product) => ({
      holding: game.holdings[product],
      price: getQuote(product, game.marketIndex).close,
    })),
    realizedProfit: game.trades.reduce(
      (sum, trade) => sum + trade.realizedProfit,
      0,
    ),
    fees: game.trades.reduce((sum, trade) => sum + trade.fee, 0),
  });
}

export function previewTrade(
  game: TradingGame,
  side: TradeSide,
  quantity: number,
  selectedProduct?: ProductId,
): TradePreview {
  const shopProduct = getLocationProduct(game.location).id;
  const product = selectedProduct ?? shopProduct;
  const result = calculateQuotedTrade({
    product,
    side,
    requestedQuantity: quantity,
    quote: getQuote(product, game.marketIndex),
    cash: game.cash,
    holding: game.holdings[product],
    feeBps: game.feeBps,
  });
  if (game.phase !== "decision")
    return { ...result, enabled: false, reason: "到达商店后才能交易" };
  if (side === "buy" && product !== shopProduct)
    return { ...result, enabled: false, reason: "买入仅限当前店铺商品" };
  return result;
}

const TOPICS: readonly TradingTopic[] = [
  "price",
  "risk",
  "cost",
  "history",
  "holdings",
];
function opportunities(
  game: TradingGame,
  product: ProductId,
): TradingOpportunity {
  return {
    buy: previewTrade(game, "buy", 1, product).enabled,
    sell: previewTrade(game, "sell", 1, product).enabled,
    hold: true,
  };
}

function evidence(
  before: TradingGame,
  after: TradingGame,
  action: "buy" | "sell" | "hold" | "inspect",
  id: string,
  quantity: number,
  topic: TradingTopic | null,
  tradeId: string | null,
  product: ProductId = getLocationProduct(before.location).id,
): ShopEvidence {
  const quote = getQuote(product, before.marketIndex);
  const previous =
    before.marketIndex > 0
      ? getQuote(product, before.marketIndex - 1).close
      : null;
  return {
    id,
    sessionId: before.sessionId,
    round: before.round,
    location: before.location,
    product,
    action,
    topic,
    quantity,
    quote: quote.close,
    dailyChange: previous === null ? null : quote.close / previous - 1,
    marketIndex: before.marketIndex,
    cashBefore: before.cash,
    cashAfter: after.cash,
    quantityBefore: before.holdings[product].quantity,
    quantityAfter: after.holdings[product].quantity,
    assetsBefore: getAccountSnapshot(before).totalAssets,
    opportunities: opportunities(before, product),
    tradeId,
  };
}

export function dispatchTrading(
  game: TradingGame,
  action: TradingAction,
): TradingGame {
  if (
    game.version !== 1 ||
    game.marketVersion !== MARKET_VERSION ||
    game.phase === "report" ||
    !action.id.trim() ||
    game.processed.includes(action.id)
  )
    return game;
  if (
    action.type === "start-round" &&
    (!(
      game.phase === "feedback" ||
      (game.phase === "travel" && game.round === 0)
    ) ||
      game.marketIndex >= LAST_MARKET_INDEX)
  )
    return game;
  if (
    action.type === "arrive" &&
    (game.phase !== "travel" ||
      game.round === 0 ||
      game.marketIndex >= LAST_MARKET_INDEX ||
      !LOCATION_IDS.includes(action.location))
  )
    return game;
  if (
    (action.type === "buy" ||
      action.type === "sell" ||
      action.type === "hold") &&
    game.phase !== "decision"
  )
    return game;
  if (
    (action.type === "sell" || action.type === "inspect") &&
    action.product !== undefined &&
    !PRODUCT_IDS.includes(action.product)
  )
    return game;
  if (
    action.type === "inspect" &&
    (!(game.phase === "decision" || game.phase === "feedback") ||
      !TOPICS.includes(action.topic) ||
      game.evidence.some(
        (item) =>
          item.round === game.round &&
          item.product ===
            (action.product ?? getLocationProduct(game.location).id) &&
          item.action === "inspect" &&
          item.topic === action.topic,
      ))
  )
    return game;
  const preview =
    action.type === "buy" || action.type === "sell"
      ? previewTrade(
          game,
          action.type,
          action.quantity,
          action.type === "sell" ? action.product : undefined,
        )
      : null;
  if (preview && !preview.enabled) return game;
  const next = structuredClone(game);
  next.processed.push(action.id);
  switch (action.type) {
    case "start-round":
      next.round++;
      next.phase = "travel";
      next.feedback = null;
      next.arrivalDelta = 0;
      break;
    case "arrive": {
      const previousAssets = getAccountSnapshot(game).totalAssets;
      next.marketIndex++;
      next.location = action.location;
      next.phase = "decision";
      next.arrivalDelta = getAccountSnapshot(next).totalAssets - previousAssets;
      break;
    }
    case "buy":
    case "sell": {
      const product =
        action.type === "sell" && action.product !== undefined
          ? action.product
          : getLocationProduct(game.location).id;
      const result = calculateQuotedTrade({
        product,
        side: action.type,
        requestedQuantity: action.quantity,
        quote: getQuote(product, game.marketIndex),
        cash: game.cash,
        holding: game.holdings[product],
        feeBps: game.feeBps,
      });
      next.cash = result.cashAfter;
      next.holdings[product] = {
        quantity: result.quantityAfter,
        costBasis: result.costBasisAfter,
      };
      next.trades.push({
        id: action.id,
        round: game.round,
        location: game.location,
        product,
        marketIndex: game.marketIndex,
        date: getMarketDate(game.marketIndex),
        side: action.type,
        requestedQuantity: action.quantity,
        quantity: result.quantity,
        price: result.price,
        gross: result.gross,
        fee: result.fee,
        cashAfter: next.cash,
        holdingAfter: result.quantityAfter,
        realizedProfit: result.realizedProfit,
      });
      next.feedback = {
        kind: action.type,
        product,
        quantity: result.quantity,
        cashDelta: result.cashDelta,
        holdingDelta: result.holdingDelta,
        fee: result.fee,
        price: result.price,
      };
      next.evidence.push(
        evidence(
          game,
          next,
          action.type,
          action.id,
          result.quantity,
          null,
          action.id,
          product,
        ),
      );
      next.phase = "feedback";
      break;
    }
    case "hold": {
      const product = getLocationProduct(game.location).id;
      next.feedback = {
        kind: "hold",
        product,
        quantity: game.holdings[product].quantity,
        cashDelta: 0,
        holdingDelta: 0,
        fee: 0,
        price: getQuote(product, game.marketIndex).close,
      };
      next.evidence.push(
        evidence(game, next, "hold", action.id, 0, null, null),
      );
      next.phase = "feedback";
      break;
    }
    case "inspect":
      next.evidence.push(
        evidence(
          game,
          next,
          "inspect",
          action.id,
          0,
          action.topic,
          null,
          action.product,
        ),
      );
      break;
    case "settle":
      next.settlement = {
        round: game.round,
        date: getMarketDate(game.marketIndex),
        snapshot: getAccountSnapshot(game),
      };
      next.phase = "report";
      break;
  }
  return next;
}

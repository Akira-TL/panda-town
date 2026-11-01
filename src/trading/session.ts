import { LOCATIONS, LOCATION_IDS } from "../game/content";
import { createTradingGame, dispatchTrading } from "./engine";
import {
  LAST_MARKET_INDEX,
  MARKET_VERSION,
  START_MARKET_INDEX,
} from "./market";
import { PRODUCT_IDS } from "./model";
import type {
  AccountSnapshot,
  Holding,
  Holdings,
  ShopEvidence,
  ShopTrade,
  TradeFeedback,
  TradingAction,
  TradingGame,
  TradingSession,
  TradingSettlement,
} from "./model";

export const TRADING_STORAGE_KEY = "panda-town.trading.v1";
const topics = ["price", "risk", "cost", "history", "holdings"] as const;
const maximumEvidence =
  (LAST_MARKET_INDEX - START_MARKET_INDEX) *
  (PRODUCT_IDS.length * topics.length + 1);
const object = (value: unknown): value is object =>
  typeof value === "object" && value !== null;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const nonnegative = (value: unknown): value is number =>
  finite(value) && value >= 0;
const positive = (value: unknown): value is number =>
  finite(value) && value > 0;
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    finite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function oneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return (
    typeof value === "string" && choices.some((choice) => choice === value)
  );
}
function holdingValid(value: unknown): value is Holding {
  if (!object(value)) return false;
  const holding = value as Partial<Holding>;
  return nonnegative(holding.quantity) && nonnegative(holding.costBasis);
}
function holdingsValid(value: unknown): value is Holdings {
  if (!object(value)) return false;
  const holdings = value as Partial<Holdings>;
  return PRODUCT_IDS.every((id) => holdingValid(holdings[id]));
}
function tradeValid(value: unknown): value is ShopTrade {
  if (!object(value)) return false;
  const trade = value as Partial<ShopTrade>;
  return (
    identifier(trade.id) &&
    integer(trade.round, 1, 180) &&
    oneOf(trade.location, LOCATION_IDS) &&
    oneOf(trade.product, PRODUCT_IDS) &&
    integer(trade.marketIndex, START_MARKET_INDEX + 1, LAST_MARKET_INDEX) &&
    typeof trade.date === "string" &&
    oneOf(trade.side, ["buy", "sell"]) &&
    positive(trade.requestedQuantity) &&
    positive(trade.quantity) &&
    trade.quantity <= trade.requestedQuantity &&
    positive(trade.price) &&
    positive(trade.gross) &&
    nonnegative(trade.fee) &&
    nonnegative(trade.cashAfter) &&
    nonnegative(trade.holdingAfter) &&
    finite(trade.realizedProfit)
  );
}
function evidenceValid(value: unknown): value is ShopEvidence {
  if (!object(value)) return false;
  const record = value as Partial<ShopEvidence>;
  return (
    identifier(record.id) &&
    identifier(record.sessionId) &&
    integer(record.round, 1, 180) &&
    oneOf(record.location, LOCATION_IDS) &&
    oneOf(record.product, PRODUCT_IDS) &&
    oneOf(record.action, ["buy", "sell", "hold", "inspect"]) &&
    (record.topic === null || oneOf(record.topic, topics)) &&
    nonnegative(record.quantity) &&
    positive(record.quote) &&
    (record.dailyChange === null || finite(record.dailyChange)) &&
    integer(record.marketIndex, START_MARKET_INDEX + 1, LAST_MARKET_INDEX) &&
    nonnegative(record.cashBefore) &&
    nonnegative(record.cashAfter) &&
    nonnegative(record.quantityBefore) &&
    nonnegative(record.quantityAfter) &&
    nonnegative(record.assetsBefore) &&
    object(record.opportunities) &&
    typeof record.opportunities.buy === "boolean" &&
    typeof record.opportunities.sell === "boolean" &&
    typeof record.opportunities.hold === "boolean" &&
    (record.tradeId === null || identifier(record.tradeId))
  );
}
function feedbackValid(value: unknown): value is TradeFeedback {
  if (!object(value)) return false;
  const feedback = value as Partial<TradeFeedback>;
  return (
    oneOf(feedback.kind, ["buy", "sell", "hold"]) &&
    oneOf(feedback.product, PRODUCT_IDS) &&
    nonnegative(feedback.quantity) &&
    finite(feedback.cashDelta) &&
    finite(feedback.holdingDelta) &&
    nonnegative(feedback.fee) &&
    positive(feedback.price)
  );
}
function snapshotValid(value: unknown): value is AccountSnapshot {
  if (!object(value)) return false;
  const snapshot = value as Partial<AccountSnapshot>;
  return (
    nonnegative(snapshot.cash) &&
    nonnegative(snapshot.holdingsValue) &&
    nonnegative(snapshot.totalAssets) &&
    finite(snapshot.netProfit) &&
    finite(snapshot.realizedProfit) &&
    finite(snapshot.unrealizedProfit) &&
    nonnegative(snapshot.fees)
  );
}
function settlementValid(value: unknown): value is TradingSettlement {
  if (!object(value)) return false;
  const settlement = value as Partial<TradingSettlement>;
  return (
    integer(settlement.round, 0, 180) &&
    typeof settlement.date === "string" &&
    snapshotValid(settlement.snapshot)
  );
}
function gameShapeValid(value: unknown): value is TradingGame {
  if (!object(value)) return false;
  const game = value as Partial<TradingGame>;
  return (
    game.version === 1 &&
    game.marketVersion === MARKET_VERSION &&
    identifier(game.sessionId) &&
    oneOf(game.phase, ["travel", "decision", "feedback", "report"]) &&
    integer(game.round, 0, 180) &&
    integer(game.marketIndex, START_MARKET_INDEX, LAST_MARKET_INDEX) &&
    oneOf(game.location, LOCATION_IDS) &&
    game.initialCash === 1000 &&
    game.feeBps === 10 &&
    nonnegative(game.cash) &&
    holdingsValid(game.holdings) &&
    Array.isArray(game.trades) &&
    game.trades.length <= 180 &&
    game.trades.every(tradeValid) &&
    Array.isArray(game.evidence) &&
    game.evidence.length <= maximumEvidence &&
    game.evidence.every(evidenceValid) &&
    Array.isArray(game.processed) &&
    game.processed.length <=
      maximumEvidence + (LAST_MARKET_INDEX - START_MARKET_INDEX) * 2 + 1 &&
    game.processed.every(identifier) &&
    (game.feedback === null || feedbackValid(game.feedback)) &&
    finite(game.arrivalDelta) &&
    (game.settlement === null || settlementValid(game.settlement))
  );
}

/** 只比较已收窄的共同类型字段，金额允许序列化后的浮点误差。 */
function sameFields<T extends object>(
  left: T,
  right: T,
  keys: readonly (keyof T)[],
): boolean {
  return keys.every((key) => {
    const a = left[key],
      b = right[key];
    return typeof a === "number" && typeof b === "number"
      ? Math.abs(a - b) <= 1e-8
      : a === b;
  });
}
function sameGame(left: TradingGame, right: TradingGame): boolean {
  if (
    !sameFields(left, right, [
      "version",
      "marketVersion",
      "sessionId",
      "phase",
      "round",
      "marketIndex",
      "location",
      "initialCash",
      "feeBps",
      "cash",
      "arrivalDelta",
    ]) ||
    !PRODUCT_IDS.every((id) =>
      sameFields(left.holdings[id], right.holdings[id], [
        "quantity",
        "costBasis",
      ]),
    ) ||
    left.trades.length !== right.trades.length ||
    left.evidence.length !== right.evidence.length ||
    left.processed.length !== right.processed.length ||
    !left.processed.every((id, index) => id === right.processed[index])
  )
    return false;
  if (
    !left.trades.every((trade, index) =>
      sameFields(trade, right.trades[index]!, [
        "id",
        "round",
        "location",
        "product",
        "marketIndex",
        "date",
        "side",
        "requestedQuantity",
        "quantity",
        "price",
        "gross",
        "fee",
        "cashAfter",
        "holdingAfter",
        "realizedProfit",
      ]),
    )
  )
    return false;
  if (
    !left.evidence.every((record, index) => {
      const expected = right.evidence[index]!;
      return (
        sameFields(record, expected, [
          "id",
          "sessionId",
          "round",
          "location",
          "product",
          "action",
          "topic",
          "quantity",
          "quote",
          "dailyChange",
          "marketIndex",
          "cashBefore",
          "cashAfter",
          "quantityBefore",
          "quantityAfter",
          "assetsBefore",
          "tradeId",
        ]) &&
        sameFields(record.opportunities, expected.opportunities, [
          "buy",
          "sell",
          "hold",
        ])
      );
    })
  )
    return false;
  if (left.feedback === null || right.feedback === null) {
    if (left.feedback !== right.feedback) return false;
  } else if (
    !sameFields(left.feedback, right.feedback, [
      "kind",
      "product",
      "quantity",
      "cashDelta",
      "holdingDelta",
      "fee",
      "price",
    ])
  )
    return false;
  if (left.settlement === null || right.settlement === null)
    return left.settlement === right.settlement;
  return (
    sameFields(left.settlement, right.settlement, ["round", "date"]) &&
    sameFields(left.settlement.snapshot, right.settlement.snapshot, [
      "cash",
      "holdingsValue",
      "totalAssets",
      "netProfit",
      "realizedProfit",
      "unrealizedProfit",
      "fees",
    ])
  );
}

/** 按原动作标识重放公共引擎，避免信任篡改的现金或维护第二份资金公式。 */
function replayValid(game: TradingGame): boolean {
  if (
    new Set(game.processed).size !== game.processed.length ||
    new Set(game.trades.map((trade) => trade.id)).size !== game.trades.length ||
    new Set(game.evidence.map((record) => record.id)).size !==
      game.evidence.length
  )
    return false;
  const arrived = game.marketIndex - START_MARKET_INDEX;
  if (game.round < arrived || game.round > arrived + 1) return false;
  let replay = createTradingGame(game.sessionId);
  let cursor = 0;
  function apply(action: TradingAction): boolean {
    const next = dispatchTrading(replay, action);
    if (next === replay) return false;
    replay = next;
    return true;
  }
  function nextId(): string {
    return game.processed[cursor++] ?? "";
  }
  let previousRound = 0;
  for (const record of game.evidence) {
    if (record.round < previousRound || record.round > arrived) return false;
    previousRound = record.round;
  }
  for (let round = 1; round <= arrived; round++) {
    const records = game.evidence.filter((record) => record.round === round);
    const location =
      records[0]?.location ?? (round === arrived ? game.location : null);
    if (
      location === null ||
      !apply({ type: "start-round", id: nextId() }) ||
      !apply({ type: "arrive", id: nextId(), location })
    )
      return false;
    for (const record of records) {
      if (nextId() !== record.id) return false;
      if (record.action === "buy" || record.action === "sell") {
        const trade = game.trades.find((item) => item.id === record.tradeId);
        if (!trade) return false;
        const action: TradingAction =
          record.action === "sell"
            ? {
                type: "sell",
                id: record.id,
                quantity: trade.requestedQuantity,
                product: record.product,
              }
            : { type: "buy", id: record.id, quantity: trade.requestedQuantity };
        if (!apply(action)) return false;
      } else if (record.action === "inspect") {
        if (
          record.topic === null ||
          !apply({
            type: "inspect",
            id: record.id,
            topic: record.topic,
            product: record.product,
          })
        )
          return false;
      } else if (!apply({ type: "hold", id: record.id })) return false;
    }
  }
  if (
    game.round === arrived + 1 &&
    !apply({ type: "start-round", id: nextId() })
  )
    return false;
  if (game.phase === "report" && !apply({ type: "settle", id: nextId() }))
    return false;
  return cursor === game.processed.length && sameGame(game, replay);
}

function sessionValid(value: unknown): value is TradingSession {
  if (!object(value)) return false;
  const session = value as Partial<TradingSession>;
  if (
    !gameShapeValid(session.game) ||
    !oneOf(session.position, LOCATION_IDS) ||
    !integer(session.remaining, 0, 6) ||
    !integer(session.die, 0, 6) ||
    typeof session.rolled !== "boolean" ||
    typeof session.branch !== "boolean" ||
    session.remaining > session.die ||
    (session.remaining > 0 && !session.rolled)
  )
    return false;
  const { game } = session;
  if (!replayValid(game)) return false;
  if (game.round === 0)
    return (
      session.position === "square" &&
      session.remaining === 0 &&
      session.die === 0 &&
      !session.rolled &&
      !session.branch
    );
  if (
    session.branch &&
    (session.remaining === 0 ||
      LOCATIONS.find((place) => place.id === session.position)!.next.length !==
        2)
  )
    return false;
  if (game.phase === "decision" || game.phase === "feedback")
    return (
      session.remaining === 0 &&
      !session.branch &&
      session.position === game.location &&
      session.rolled &&
      session.die > 0
    );
  if (game.phase === "report")
    return (
      session.remaining === 0 &&
      !session.branch &&
      session.rolled &&
      session.die > 0
    );
  return session.rolled && session.die > 0 && session.remaining > 0;
}

export function freshTradingSession(sessionId: string): TradingSession {
  return {
    game: createTradingGame(sessionId),
    position: "square",
    remaining: 0,
    die: 0,
    rolled: false,
    branch: false,
  };
}

export function restoreTradingSession(raw: string): TradingSession | null {
  if (raw.length > 4_000_000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return sessionValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

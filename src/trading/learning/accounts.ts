import type { LocationId } from "../../game/content";
import {
  createTradingGame,
  dispatchTrading,
  getAccountSnapshot,
  previewTrade,
} from "../engine";
import {
  getMarketDate,
  getQuote,
  getVisibleCandles,
  START_MARKET_INDEX,
} from "../market";
import { getIndicatorSeries } from "../indicators";
import { PRODUCT_IDS } from "../model";
import type { ProductId, TradingGame } from "../model";
import { getLocationProduct } from "../products";
import { evaluateEntry } from "./rules";
import type {
  AccountCurvePoint,
  OpponentAction,
  OpponentSummary,
} from "./types";

interface RoundContext {
  round: number;
  location: LocationId;
  completed: boolean;
}
export function getRoundContexts(game: TradingGame): RoundContext[] {
  const arrived = game.marketIndex - START_MARKET_INDEX;
  return Array.from({ length: arrived }, (_, index) => {
    const round = index + 1;
    const records = game.evidence.filter((record) => record.round === round);
    const location =
      records[0]?.location ?? (round === arrived ? game.location : null);
    if (location === null)
      throw new Error("缺少已到达回合的地点，不能补造比较机会");
    return {
      round,
      location,
      completed: records.some((record) => record.action !== "inspect"),
    };
  });
}
function curvePoint(
  game: TradingGame,
  stage: AccountCurvePoint["stage"],
): AccountCurvePoint {
  const snapshot = getAccountSnapshot(game);
  return {
    round: game.round,
    marketIndex: game.marketIndex,
    date: getMarketDate(game.marketIndex),
    stage,
    equity: snapshot.totalAssets,
    cash: snapshot.cash,
    holdingsValue: snapshot.holdingsValue,
  };
}
function reach(
  game: TradingGame,
  round: number,
  location: LocationId,
): TradingGame {
  const moving = dispatchTrading(game, {
    type: "start-round",
    id: `trace-round:${round}`,
  });
  return dispatchTrading(moving, {
    type: "arrive",
    id: `trace-arrive:${round}`,
    location,
  });
}

/** 只复算已经发生的主要决定；到达前后与费用扣除点分开，日内高低不冒充账户路径。 */
export function replayAccount(game: TradingGame): {
  curve: AccountCurvePoint[];
  account: TradingGame;
  contexts: ReadonlyMap<number, TradingGame>;
} {
  let account = createTradingGame(game.sessionId);
  const contexts = new Map<number, TradingGame>();
  const curve = [curvePoint(account, "initial")];
  for (const context of getRoundContexts(game)) {
    account = reach(account, context.round, context.location);
    contexts.set(context.round, account);
    curve.push(curvePoint(account, "arrival"));
    const trade = game.trades.find((item) => item.round === context.round);
    if (trade)
      account =
        trade.side === "buy"
          ? dispatchTrading(account, {
              type: "buy",
              id: `trace-trade:${context.round}`,
              quantity: trade.requestedQuantity,
            })
          : dispatchTrading(account, {
              type: "sell",
              id: `trace-trade:${context.round}`,
              quantity: trade.requestedQuantity,
              product: trade.product,
            });
    else if (context.completed)
      account = dispatchTrading(account, {
        type: "hold",
        id: `trace-hold:${context.round}`,
      });
    if (context.completed) curve.push(curvePoint(account, "action"));
  }
  return { curve, account, contexts };
}

export function calculateMaximumDrawdown(equities: readonly number[]): number {
  let peak = 0,
    drawdown = 0;
  for (const equity of equities) {
    if (!Number.isFinite(equity) || equity < 0)
      throw new RangeError("账户估值必须为非负有限数");
    peak = Math.max(peak, equity);
    if (peak > 0) drawdown = Math.max(drawdown, (peak - equity) / peak);
  }
  return drawdown;
}

/** 公布的固定政策，全部委托交给同一个纸上交易引擎执行。 */
export function buildOpponent(game: TradingGame): {
  curve: AccountCurvePoint[];
  summary: OpponentSummary;
} {
  let account = createTradingGame(`opponent:${game.sessionId}`);
  const curve = [curvePoint(account, "initial")];
  const actions: OpponentAction[] = [];
  for (const context of getRoundContexts(game)) {
    account = reach(account, context.round, context.location);
    curve.push(curvePoint(account, "arrival"));
    if (!context.completed) continue;
    const shop = getLocationProduct(context.location).id;
    let selected = shop;
    let reason = "当前店没有发生入场上穿，或目标仓位已足；等待";
    let acted = false;
    for (const product of PRODUCT_IDS) {
      if (account.holdings[product].quantity <= 0) continue;
      // 出场以当前收盘低于已知此前均价为条件，避免一轮只能行动一次时错过先前下穿。
      const candles = getQuote(product, account.marketIndex);
      // 均价窗口不重复实现，引用指标模块的相同此前20期口径。
      const below = priorMeanBelow(product, account.marketIndex, candles.close);
      if (
        below &&
        previewTrade(
          account,
          "sell",
          account.holdings[product].quantity,
          product,
        ).enabled
      ) {
        account = dispatchTrading(account, {
          type: "sell",
          id: `opponent-action:${context.round}`,
          quantity: account.holdings[product].quantity,
          product,
        });
        selected = product;
        acted = true;
        reason =
          "已有持仓收盘低于此前20期均价，优先申请卖清；实际数量仍受当日量限制";
        break;
      }
    }
    if (
      !acted &&
      evaluateEntry("ma_cross_up", shop, account.marketIndex).triggered === true
    ) {
      const snapshot = getAccountSnapshot(account),
        price = getQuote(shop, account.marketIndex).close;
      const quantity = Math.max(
        0,
        (snapshot.totalAssets * 0.5 - snapshot.holdingsValue) /
          (price * (1 + (0.5 * account.feeBps) / 10_000)),
      );
      if (previewTrade(account, "buy", quantity).enabled) {
        account = dispatchTrading(account, {
          type: "buy",
          id: `opponent-action:${context.round}`,
          quantity,
        });
        acted = true;
        reason =
          "当前店收盘上穿此前20期均价，申请买至总持仓半仓；现金、费用与成交量真实限制";
      }
    }
    if (!acted)
      account = dispatchTrading(account, {
        type: "hold",
        id: `opponent-action:${context.round}`,
      });
    const trade = account.trades.find((item) => item.round === context.round);
    actions.push({
      round: context.round,
      product: selected,
      action: trade?.side ?? "hold",
      quantity: trade?.quantity ?? 0,
      price: trade?.price ?? getQuote(shop, account.marketIndex).close,
      fee: trade?.fee ?? 0,
      reason,
    });
    curve.push(curvePoint(account, "action"));
  }
  return {
    curve,
    summary: {
      label: "固定规则商人",
      actions,
      alignedRounds: actions.length,
      description:
        "同一1000起点、同轮落点和收盘价。先按商品固定顺序退出低于此前20期均价的持仓，否则当前店上穿时买至总仓位半仓；每轮仅一行动，费用0.1%，数量受限。只随玩家已完成的决定行动，未决定时仅估值，不偷看未来。",
      snapshot: getAccountSnapshot(account),
    },
  };
}

function priorMeanBelow(
  product: ProductId,
  index: number,
  close: number,
): boolean {
  const mean = getIndicatorSeries(getVisibleCandles(product, index)).at(
    -1,
  )!.ma20;
  return mean !== null && close < mean;
}

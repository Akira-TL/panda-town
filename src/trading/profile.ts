import { getAccountSnapshot } from "./engine";
import { getProduct } from "./products";
import { PRODUCT_IDS } from "./model";
import type {
  AccountSnapshot,
  ProductId,
  ShopEvidence,
  TradingGame,
} from "./model";

export interface TradingFact {
  id: string;
  label: string;
  value: string;
  detail: string;
  evidenceIds: string[];
}
export interface ProductActivity {
  product: ProductId;
  buys: number;
  sells: number;
  inspections: number;
  contexts: number;
}
export interface TradingProfile {
  title: string;
  account: AccountSnapshot;
  facts: TradingFact[];
  interests: ProductActivity[];
  evidence: ShopEvidence[];
  unknown: string[];
}

export function buildTradingProfile(game: TradingGame): TradingProfile {
  const ids = new Set<string>();
  const evidence = game.evidence.filter((item) => {
    if (item.sessionId !== game.sessionId || ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
  const account = game.settlement?.snapshot ?? getAccountSnapshot(game);
  const interests = PRODUCT_IDS.map((product) => {
    const rows = evidence.filter((item) => item.product === product);
    return {
      product,
      buys: rows.filter((item) => item.action === "buy").length,
      sells: rows.filter((item) => item.action === "sell").length,
      inspections: rows.filter(
        (item) =>
          item.action === "inspect" &&
          (item.topic === "price" || item.topic === "history"),
      ).length,
      contexts: new Set(rows.map((item) => item.round)).size,
    };
  }).filter((item) => item.buys + item.sells + item.inspections > 0);
  const buying = interests
    .filter((item) => item.buys > 0)
    .sort((a, b) => b.buys - a.buys || a.product.localeCompare(b.product));
  const trades = game.trades;
  const buyRows = evidence.filter((item) => item.action === "buy");
  const higher = buyRows.filter((item) => (item.dailyChange ?? 0) > 0);
  const lower = buyRows.filter((item) => (item.dailyChange ?? 0) < 0);
  const sells = trades.filter((item) => item.side === "sell");
  const winning = sells.filter((item) => item.realizedProfit > 1e-8).length;
  const losing = sells.filter((item) => item.realizedProfit < -1e-8).length;
  const inspected = evidence.filter((item) => item.action === "inspect");
  const inspections = new Set(inspected.map((item) => item.round)).size;
  const weight =
    account.totalAssets > 0 ? account.holdingsValue / account.totalAssets : 0;
  return {
    title: "本局交易画像",
    account,
    interests,
    evidence,
    facts: [
      {
        id: "products",
        label: "买过的商品",
        value: buying.length
          ? buying
              .slice(0, 2)
              .map((item) => getProduct(item.product).name)
              .join(" · ")
          : "还没买过",
        detail: buying.length
          ? buying
              .map(
                (item) => `${getProduct(item.product).name}买入${item.buys}次`,
              )
              .join("；") + "。只记录实际选择，不把随机落点当兴趣。"
          : "本局尚无买入记录，不补默认偏好。",
        evidenceIds: buyRows.map((item) => item.id),
      },
      {
        id: "entries",
        label: "买入时机",
        value: buyRows.length
          ? `涨时${higher.length} · 跌时${lower.length}`
          : "观察不足",
        detail:
          `已见当日报价上涨时买入${higher.length}次，下跌时买入${lower.length}次。` +
          "记录当时已知情境，不据此认定长期交易风格。",
        evidenceIds: [...higher, ...lower].map((item) => item.id),
      },
      {
        id: "allocation",
        label: "现金与持仓",
        value: `持仓${Math.round(weight * 100)}%`,
        detail:
          `现金${account.cash.toFixed(2)}，持仓市值${account.holdingsValue.toFixed(2)}；` +
          "这是当前实际资金分布，不是风险人格评分。",
        evidenceIds: evidence
          .filter((item) => item.action !== "inspect")
          .map((item) => item.id),
      },
      {
        id: "research",
        label: "行情查看",
        value: inspections ? `主动看过${inspections}轮` : "未主动查看",
        detail:
          `在${inspections}个不同回合主动查看资料。` +
          `已卖出记录中盈利${winning}次、亏损${losing}次；不把盈亏换算为能力。`,
        evidenceIds: inspected.map((item) => item.id),
      },
    ],
    unknown: [
      "一般人格未评估；本局交易不等于真实消费、真实投资或经过验证的人格测验。",
      "未设置客观知识题，量化知识水平未评估。",
      "单次决定只记录事实；没有选择机会或没有交易的商品不推断为不喜欢。",
    ],
  };
}

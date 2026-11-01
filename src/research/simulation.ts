import { DATASET_VERSION, getSimulationInput } from "./data";
import type {
  AssetId,
  EquityPoint,
  MarketBar,
  SimulationConfig,
  SimulationOrder,
  SimulationResult,
  StrategyRule,
  Trade,
} from "./model";

const assets: readonly AssetId[] = ["bamboo", "pine"];
const epsilon = 1e-10;
type Weights = Record<AssetId, number>;
interface Portfolio {
  cash: number;
  holdings: Record<AssetId, number>;
  fees: number;
  orders: SimulationOrder[];
  trades: Trade[];
}

export function getRuleDescription(rule: StrategyRule): string {
  switch (rule) {
    case "trend":
      return "趋势：只用上一期及之前的收盘价，5期平均价高于20期平均价时参与，否则退出。";
    case "reversion":
      return "均值回归：上一期收盘价低于20期均价的98%时参与；已持仓且未回到均价时继续持有，回到均价或更高时退出。";
    case "hold":
      return "固定配置：首期开盘将目标投入在两项虚构资产间等额配置，随后持有、不再调仓。";
  }
}

function initialPortfolio(cash: number): Portfolio {
  return {
    cash,
    holdings: { bamboo: 0, pine: 0 },
    fees: 0,
    orders: [],
    trades: [],
  };
}

function equity(
  portfolio: Portfolio,
  bar: MarketBar,
  field: "open" | "close" = "close",
): number {
  return (
    portfolio.cash +
    assets.reduce(
      (sum, asset) => sum + portfolio.holdings[asset] * bar[asset][field],
      0,
    )
  );
}

function execute(
  portfolio: Portfolio,
  bar: MarketBar,
  asset: AssetId,
  side: "buy" | "sell",
  requested: number,
  config: SimulationConfig,
  signalDate: string,
): void {
  if (requested <= epsilon) return;
  const feeRate = config.feeBps / 10_000;
  const price =
    bar[asset].open *
    (side === "buy"
      ? 1 + config.slippageBps / 10_000
      : 1 - config.slippageBps / 10_000);
  const resourceLimit =
    side === "buy"
      ? portfolio.cash / (price * (1 + feeRate))
      : portfolio.holdings[asset];
  const available = Math.max(
    0,
    Math.min(requested, bar[asset].volume, resourceLimit),
  );
  const quantity = available <= epsilon ? 0 : available;
  const status =
    quantity <= epsilon
      ? "rejected"
      : quantity < requested - epsilon
        ? "partial"
        : "filled";
  const id = bar.date + "-" + asset + "-" + String(portfolio.orders.length + 1);
  portfolio.orders.push({
    id,
    signalDate,
    date: bar.date,
    asset,
    side,
    requestedQuantity: requested,
    filledQuantity: quantity,
    status,
    reason:
      status === "filled"
        ? "全部成交"
        : bar[asset].volume < requested
          ? "本期成交量不足；未成交部分不跨期排队"
          : side === "buy"
            ? "可用现金不足以支付含费用金额"
            : "可卖持仓不足",
  });
  if (quantity <= epsilon) return;
  const gross = quantity * price;
  const fee = gross * feeRate;
  portfolio.cash += side === "buy" ? -gross - fee : gross - fee;
  if (portfolio.cash < -1e-8) throw new Error("模拟成交不得产生负现金");
  portfolio.cash = Math.max(0, portfolio.cash);
  portfolio.holdings[asset] += side === "buy" ? quantity : -quantity;
  portfolio.fees += fee;
  portfolio.trades.push({
    id: id + "-trade",
    signalDate,
    date: bar.date,
    asset,
    side,
    quantity,
    price,
    gross,
    fee,
    cashAfter: portfolio.cash,
  });
}

/** 目标比例以扣除本次交易成本后的开盘净值为分母。 */
function postCostEquity(
  portfolio: Portfolio,
  bar: MarketBar,
  weights: Weights,
  config: SimulationConfig,
): number {
  const before = equity(portfolio, bar, "open");
  if (config.feeBps === 0 && config.slippageBps === 0) return before;
  let low = 0,
    high = before;
  for (let iteration = 0; iteration < 60; iteration++) {
    const candidate = (low + high) / 2;
    let cost = 0;
    for (const asset of assets) {
      const quantity =
        (candidate * weights[asset]) / bar[asset].open -
        portfolio.holdings[asset];
      const open = bar[asset].open;
      if (quantity >= 0)
        cost +=
          quantity *
          (open *
            (1 + config.slippageBps / 10_000) *
            (1 + config.feeBps / 10_000) -
            open);
      else
        cost +=
          -quantity *
          (open -
            open *
              (1 - config.slippageBps / 10_000) *
              (1 - config.feeBps / 10_000));
    }
    if (candidate + cost > before) high = candidate;
    else low = candidate;
  }
  return low;
}

function rebalance(
  portfolio: Portfolio,
  bar: MarketBar,
  weights: Weights,
  config: SimulationConfig,
  signalDate: string,
): void {
  const targetEquity = postCostEquity(portfolio, bar, weights, config);
  const targets: Weights = {
    bamboo: (targetEquity * weights.bamboo) / bar.bamboo.open,
    pine: (targetEquity * weights.pine) / bar.pine.open,
  };
  for (const asset of assets)
    execute(
      portfolio,
      bar,
      asset,
      "sell",
      portfolio.holdings[asset] - targets[asset],
      config,
      signalDate,
    );
  for (const asset of assets)
    execute(
      portfolio,
      bar,
      asset,
      "buy",
      targets[asset] - portfolio.holdings[asset],
      config,
      signalDate,
    );
}

function movingAverage(
  history: readonly MarketBar[],
  asset: AssetId,
  window: number,
): number {
  return (
    history.slice(-window).reduce((sum, item) => sum + item[asset].close, 0) /
    window
  );
}

function above(left: number, right: number): boolean {
  return left - right > epsilon * Math.max(1, Math.abs(left), Math.abs(right));
}

function signals(
  history: readonly MarketBar[],
  rule: StrategyRule,
  portfolio: Portfolio,
): Record<AssetId, boolean> {
  const result = { bamboo: false, pine: false };
  if (history.length < 20) return result;
  if (rule === "trend")
    for (const asset of assets)
      result[asset] = above(
        movingAverage(history, asset, 5),
        movingAverage(history, asset, 20),
      );
  if (rule === "reversion")
    for (const asset of assets) {
      const mean = movingAverage(history, asset, 20);
      const last = history.at(-1)![asset].close;
      result[asset] =
        above(mean * 0.98, last) ||
        (portfolio.holdings[asset] > epsilon && above(mean, last));
    }
  return result;
}

function maximumDrawdown(points: readonly EquityPoint[]): number {
  let peak = points[0]!.equity,
    maximum = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    maximum = Math.max(maximum, (peak - point.equity) / peak);
  }
  return maximum;
}

function simulationId(
  config: SimulationConfig,
  bars: readonly MarketBar[],
  warmup: readonly MarketBar[],
  version: string,
): string {
  const encode = (bar: MarketBar) => [
    bar.date,
    ...assets.flatMap((asset) => [
      bar[asset].open,
      bar[asset].close,
      bar[asset].volume,
    ]),
  ];
  const payload = JSON.stringify([warmup.map(encode), bars.map(encode)]);
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index++)
    hash = Math.imul(hash ^ payload.charCodeAt(index), 16777619) >>> 0;
  return (
    version +
    ":" +
    [
      config.segment,
      config.rule,
      config.allocation,
      config.frequency,
      config.feeBps,
      config.slippageBps,
      config.initialCash,
    ].join("-") +
    ":" +
    hash.toString(16)
  );
}

function validateInputs(
  bars: readonly MarketBar[],
  warmup: readonly MarketBar[],
  config: SimulationConfig,
): void {
  if (!Number.isFinite(config.initialCash) || config.initialCash <= 0)
    throw new RangeError("初始资金必须为正有限值");
  if (
    ![0, 0.3, 0.6, 1].includes(config.allocation) ||
    ![1, 5].includes(config.frequency)
  )
    throw new RangeError("仓位或检查频率不在已定义范围");
  if (
    ![config.feeBps, config.slippageBps].every(
      (value) => Number.isFinite(value) && value >= 0 && value < 10_000,
    )
  )
    throw new RangeError("费用与滑点需为0至10000基点之间的有限值，不含10000");
  if (
    !["trend", "reversion", "hold"].includes(config.rule) ||
    !["research", "validation"].includes(config.segment)
  )
    throw new RangeError("规则或数据分段无效");
  let previous = "";
  for (const bar of [...warmup, ...bars]) {
    const timestamp = Date.parse(bar.date);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(bar.date) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== bar.date ||
      bar.date <= previous
    )
      throw new RangeError("报价日期必须有效、严格递增且不重复");
    previous = bar.date;
    for (const asset of assets) {
      const quote = bar[asset];
      if (
        ![quote.open, quote.close, quote.volume].every(Number.isFinite) ||
        quote.open <= 0 ||
        quote.close <= 0 ||
        quote.volume < 0
      )
        throw new RangeError("报价价格必须为正有限数，成交量需为非负有限数");
    }
  }
}

export function simulateBars(
  bars: readonly MarketBar[],
  config: SimulationConfig,
  warmup: readonly MarketBar[] = [],
): SimulationResult {
  if (!bars.length) throw new RangeError("运行段至少需要一根报价");
  const first = bars[0]!;
  if (warmup.some((bar) => bar.date >= first.date))
    throw new RangeError("预热日期必须严格早于运行段");
  validateInputs(bars, warmup, config);
  const initialDate =
    warmup.at(-1)?.date ??
    new Date(Date.parse(first.date) - 86_400_000).toISOString().slice(0, 10);
  const points: EquityPoint[] = [
    {
      date: initialDate,
      cash: config.initialCash,
      equity: config.initialCash,
      benchmark: config.initialCash,
    },
  ];
  const strategy = initialPortfolio(config.initialCash);
  const benchmark = initialPortfolio(config.initialCash);
  const history = [...warmup];
  for (const [index, current] of bars.entries()) {
    const signalDate = history.at(-1)?.date ?? initialDate;
    if (index === 0)
      rebalance(
        benchmark,
        current,
        { bamboo: 0.5, pine: 0.5 },
        config,
        signalDate,
      );
    if (config.rule === "hold") {
      if (index === 0)
        rebalance(
          strategy,
          current,
          { bamboo: config.allocation / 2, pine: config.allocation / 2 },
          config,
          signalDate,
        );
    } else if (index % config.frequency === 0) {
      const active = signals(history, config.rule, strategy);
      const count = Number(active.bamboo) + Number(active.pine);
      const perAsset = count ? config.allocation / count : 0;
      rebalance(
        strategy,
        current,
        {
          bamboo: active.bamboo ? perAsset : 0,
          pine: active.pine ? perAsset : 0,
        },
        config,
        signalDate,
      );
    }
    points.push({
      date: current.date,
      cash: strategy.cash,
      equity: equity(strategy, current),
      benchmark: equity(benchmark, current),
    });
    history.push(current);
  }
  const final = points.at(-1)!;
  const warnings = [
    "PandaAI研究流程演示｜本地计算｜尚未连接PandaData",
    "允许小数份额；无借款、做空或杠杆。委托仅当期有效，未成交部分不排队。",
  ];
  if (benchmark.orders.some((order) => order.status !== "filled"))
    warnings.push(
      "等权固定持有对照有委托未完全成交；曲线按相同成交量和费用约束的实际结果计值。",
    );
  if (config.rule === "hold" && config.frequency !== 1)
    warnings.push("固定配置仅首期建仓；检查频率参数不会增加该规则的调仓。");
  if (config.rule !== "hold" && warmup.length < 20)
    warnings.push("历史不足20期时保留现金，历史窗口足够后才允许按规则参与。");
  return {
    id: simulationId(config, bars, warmup, "provided-bars-v1"),
    datasetVersion: "provided-bars-v1",
    config: { ...config },
    startDate: first.date,
    endDate: bars.at(-1)!.date,
    points,
    orders: strategy.orders,
    trades: strategy.trades,
    metrics: {
      finalEquity: final.equity,
      netProfit: final.equity - config.initialCash,
      netReturn: (final.equity - config.initialCash) / config.initialCash,
      maxDrawdown: maximumDrawdown(points),
      fees: strategy.fees,
      tradeCount: strategy.trades.length,
      benchmarkReturn:
        (final.benchmark - config.initialCash) / config.initialCash,
    },
    warnings,
  };
}

export function runSimulation(config: SimulationConfig): SimulationResult {
  const { bars, warmup } = getSimulationInput(config.segment);
  return {
    ...simulateBars(bars, config, warmup),
    datasetVersion: DATASET_VERSION,
    id: simulationId(config, bars, warmup, DATASET_VERSION),
  };
}

"use client";

import { GameDialog } from "../../ui/GameDialog";
import { getAccountSnapshot } from "../engine";
import { getVisibleCandles } from "../market";
import type {
  ProductId,
  TradingAction,
  TradingGame,
  TradingTopic,
} from "../model";
import type { useLearningSession } from "../useLearningSession";
import { getProduct } from "../products";
import { money, signed } from "./format";
import "./research-cards.css";

interface ResearchCard {
  id: "execution" | "strategy" | "testing" | "performance";
  title: string;
  subtitle: string;
  fact: string;
  topic: TradingTopic;
  lines: readonly string[];
  question: string;
}

export function ResearchCards({
  game,
  product,
  learning,
  onAction,
  onClose,
}: {
  game: TradingGame;
  product: ProductId;
  learning: ReturnType<typeof useLearningSession>;
  onAction: (action: TradingAction) => void;
  onClose: () => void;
}) {
  const candles = getVisibleCandles(product, game.marketIndex);
  const current = candles.at(-1)!;
  const before20 = candles.at(-21);
  const momentum = before20 ? (current.close / before20.close - 1) * 100 : null;
  const account = getAccountSnapshot(game);
  const sells = game.trades.filter((trade) => trade.side === "sell");
  const wins = sells.filter((trade) => trade.realizedProfit > 0).length;
  const losses = sells.filter((trade) => trade.realizedProfit < 0).length;
  const drawdown = learning.summary?.maximumDrawdown;
  const cards: readonly ResearchCard[] = [
    {
      id: "execution",
      title: "订单与成交",
      subtitle: "价差 · 流动性 · 滑点",
      topic: "cost",
      fact: `本局按已知收盘纸上成交；当前费用${game.feeBps / 100}%`,
      lines: [
        "以下数字仅为订单概念示例，不是本局报价或新增订单功能。",
        "买方报100.00、卖方报100.20，买卖价差为0.20。立即买入再卖出，未计费也可能损失这段价差。",
        "市价单优先尝试尽快成交，价格不保证；限价100买入时，卖方报价100.20不会成交，到100或更低也不保证成交。",
        "流动性关系到可成交数量与价格影响；日线成交量上限不等于真实盘口深度。",
        "滑点是参考价与实际执行价的差异。例如参考买价100.20、实际100.30，不利滑点为0.10；本游戏未模拟盘口和滑点。",
      ],
      question: "把我的规则放到真实历史中，费用、价差和滑点会怎样改变结果？",
    },
    {
      id: "strategy",
      title: "从特征到办法",
      subtitle: "因子 · 策略 · 配置",
      topic: "price",
      fact:
        momentum === null
          ? "过去20期涨幅：已知历史不足"
          : `${getProduct(product).name}过去20期涨幅 ${signed(momentum)}%`,
      lines: [
        momentum === null
          ? "需要21个已知收盘，才能比较相隔20期的价格。"
          : `${before20!.date}收盘${money(before20!.close)} → ` +
            `${current.date}收盘${money(current.close)}；涨幅=后者÷前者−1。只用当前已知数据。`,
        "因子是可计算的资产特征，如过去涨幅；单个特征不等于完整策略，也不保证未来收益。策略还要明确入场、投入、退出和成交时点。",
        "动量与趋势跟踪关注强势或趋势延续；均值回归依赖价格向某个均衡水平回归的假设，两者都可能失效。",
        "资产配置决定各类资产和现金的比例；再平衡是在比例漂移后按既定目标调整，不等于每次继续加仓。",
        "对冲旨在抵消特定风险暴露，套利利用价格关系；当前单商品纸上买卖没有实现这两类组合交易。",
      ],
      question:
        "请把我的入场、投入和退出写成固定规则，比较趋势、均值回归与定期再平衡。",
    },
    {
      id: "testing",
      title: "换段行情再验证",
      subtitle: "回测 · 偏差 · 过拟合",
      topic: "history",
      fact: `已知截至 ${current.date}；后续价格尚未揭示`,
      lines: [
        "回测是在历史数据上按明确规则模拟执行；当前账户记录来自你已做的决定，不是已选规则的自动回测结果。",
        "用于选规则和调参数的数据是样本内；规则先固定、未参与开发和选择的数据才适合做样本外检验。重玩已看过的区间不叫样本外。",
        "过拟合是把规则调得过于贴合旧样本的噪声；旧区间最好看，不代表换段行情仍有效。",
        "前视偏差是使用决策当时尚不可知的信息；收盘信号不能倒回同日开盘成交，影线也无法还原日内高低出现顺序。",
        "本地模拟不是真实资金交易。历史检验后仍可用仿真观察执行差异，不能提前宣称实盘有效。",
      ],
      question:
        "固定我的规则后，用未参与调参的数据检验，检查过拟合、前视偏差和成交时点。",
    },
    {
      id: "performance",
      title: "赚多少，也看过程",
      subtitle: "收益 · 回撤 · 比较",
      topic: "risk",
      fact:
        `本局收益 ${signed((account.netProfit / game.initialCash) * 100)}% · 已观察最大回撤 ` +
        (drawdown === undefined ? "未观察" : `${money(drawdown * 100)}%`),
      lines: [
        `本局实际卖出${sells.length}笔：盈利${wins}、亏损${losses}、` +
          `持平${sells.length - wins - losses}；已实现盈亏${signed(account.realizedProfit)}。` +
          `部分卖出可有多笔，这不是完整独立交易的胜率。`,
        "收益要有区间；基准要有相同起点、期间和费用口径。可与资料中的固定规则商人对照，不能直接把他当作无成本市场指数。",
        "回撤是总资产相对先前高点的跌幅；本局最大回撤只覆盖已经观察的账户估值点，不还原日内路径。波动率描述收益的离散程度，不预测涨跌方向。",
        "胜率看盈利次数占比，盈亏比比较平均盈利与平均亏损；需定义完整交易及费用，不能只看哪一项更高。",
        "夏普比率比较超额收益与收益波动；阿尔法（α）与贝塔（β）分别涉及指定风险模型下的未解释收益和市场敏感度。它们都依赖口径、基准和足够样本，本局不硬算成能力分。",
      ],
      question:
        "用充分历史、同一费用和基准，解释收益、最大回撤、波动及风险调整后的表现。",
    },
  ];
  return (
    <GameDialog title="继续研究" onClose={onClose}>
      <section className="research-cards" data-research-cards="true">
        <p className="research-cards-note">
          点开感兴趣的一张；只记录主动查看，不记为掌握。
        </p>
        <div
          className="research-date-boundary"
          aria-label="当前已知与未揭示数据边界"
        >
          <span>
            {candles[0]!.date} → {current.date}
            <small>已知历史</small>
          </span>
          <span>
            后续未揭示<small>不显示未来数值</small>
          </span>
        </div>
        {cards.map((card) => (
          <details
            className="research-card"
            key={card.id}
            data-research-card={card.id}
          >
            <summary
              onClick={(event) => {
                if (!event.currentTarget.parentElement?.hasAttribute("open")) {
                  onAction({
                    type: "inspect",
                    id: crypto.randomUUID(),
                    topic: card.topic,
                    product,
                  });
                }
              }}
            >
              <span>
                <strong>{card.title}</strong>
                <small>{card.subtitle}</small>
              </span>
              <b aria-hidden="true">＋</b>
            </summary>
            <p className="research-card-fact">{card.fact}</p>
            <ul>
              {card.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="research-card-question">
              <small>可以带去PandaAI继续问</small>
              <p>{card.question}</p>
            </div>
          </details>
        ))}
      </section>
    </GameDialog>
  );
}

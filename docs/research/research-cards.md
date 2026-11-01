# 延伸研究卡的来源与计算边界

2026-11-01新增交易资料中的“继续研究”入口，范围仅为按需解释，不增加主要交易次数、
自动委托、知识分数或外部发送。四组卡由 `src/trading/ui/ResearchCards.tsx` 绘制，
打开只调用已有 `inspect`：订单对应费用、因子对应价格、检验对应历史、表现对应风险。
这些是宽类别的主动查看证据，不声称独立记录每个概念已经掌握。

## 订单、流动性与执行

市价单不保证执行价格；限价单限制成交价格，但可能无法成交。价差示例100.00/100.20、
滑点示例100.20/100.30均明确标为概念示例，不进入账本，不冒充本游戏的盘口或订单功能。
当前游戏仍按已知收盘纸上成交，日线量上限不等于盘口深度。

来源：[Investor.gov订单类型](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders)、
[Investor.gov买卖报价与价差](https://www.investor.gov/introduction-investing/investing-basics/glossary/ask-price)、
[SEC交易执行说明](https://www.sec.gov/files/investor/pubs/tradexec.htm)。

## 特征、策略与配置

卡片用当前商品已经公开的21个收盘计算相隔20期涨幅：当前收盘÷20期前收盘−1。
这是特征的实例，不构成经过验证的预测因子或完整买卖策略。趋势与均值回归只解释假设，
配置与再平衡解释资金比例及其调整，不推定玩家采用了某类策略。

来源：[Fidelity因子投资](https://www.fidelity.com/learning-center/investment-products/etf/factor-based-investing)、
[Investor.gov资产配置与再平衡](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)、
[QuantConnect术语表](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/glossary)。

## 检验与偏差

只展示 `getVisibleCandles` 返回的已知日期边界，不读取或显示后续价格、日期、极值。
样本外要求规则事先固定，检验数据未参与开发与选择；重玩已知区间不能叫样本外。
前视偏差、过拟合和信号/执行时点均保留实际边界，不把手动账户重放称为所选规则的自动回测。

来源：[QuantConnect研究指南](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/research-guide)、
[QuantConnect术语表](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/glossary)。

## 表现与风险

本局收益率直接用真实账本总盈亏除以初始现金；最大回撤复用学习汇总中已观察账户估值点的计算。
已实现盈亏和卖出笔数直接取真实账本。分批卖出并非独立完整交易，因此不把卖出盈利笔数比例
包装成策略胜率。不对短局计算夏普比率、阿尔法、贝塔或能力分数；完整定义依赖期间、基准、
风险模型和样本。当前固定规则商人也不冒充无成本市场指数。

来源：[QuantConnect术语表](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/glossary)、
[QuantConnect回测报告](https://www.quantconnect.com/docs/v2/cloud-platform/backtesting/report)。

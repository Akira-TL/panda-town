# 当前研究章节与地点接入

更新：2026-10-31。以[产品规格](../specs/panda-town.md)及[研究合同](../specs/research-core.md)为准。旧E01–E12消费/开店事件不再被新入口调用；它们的历史实现保留，不与新画像混用。

## 路线

主路：square→bakery→grocery→notice→market→research→bridge→bank→gifts→rival→riverside→cafe→square。
支路甲：grocery→repair→garden→market。支路乙：bridge→music→dock→gifts。每条边一步，曲线长度不改骰子；最终落点触发章节，路过不触发。

## 章节

| 回合 | 内容     | 三选项的语义                 |
| ---- | -------- | ---------------------------- |
| 1    | 研究问题 | 收益、风险、减少操作         |
| 2    | 数据检查 | 来源、异常、自动检查解释     |
| 3    | 规则     | 趋势、均值回归、固定持有     |
| 4    | 历史回测 | 优先比较、回撤、交易         |
| 5    | 投入比例 | 30%、60%、保留现金           |
| 6    | 新数据   | 检验、说明后检验、暂缓       |
| 7    | 费用     | 标准费用、降低频率、更高费用 |
| 8    | 策略展   | 模拟、修改、暂缓             |

完整导语、角色职责和按钮文案见[主线文案](quant-story-and-copy.md)。公共章节定义集中在src/research/chapters.ts，地点仅包装当前任务，不再各自选择消费事件。真实后果由campaign.ts调用唯一simulation.ts，不从中文按钮反推金额或重复计算。

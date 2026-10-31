# 公共经济与回合接口

来源为首版规格。T02 的纯状态模块位于 `src/game/engine.ts`，由核心负责人维护；内容任务声明选项，不能直接改现金。

## 接入顺序

1. `createGame(sessionId, scenario)` 建局；情境为 `A` 或 `B`，由外壳独立随机选择。内部状态供存储使用，界面通过 `visibleGame` 读取，避免泄露未来情境。
2. 外壳处理掷骰、路线与动画，到达后用 `dispatch(state, {type:'open-event', id, event})` 冻结事件。事件含地点、基础事件和独立情境标识、选项及资料题目。
3. `dispatch` 接收 `inspect`、`compare`、`answer` 和 `choose`；选择只提交已冻结的 `optionId`，不从按钮传金额。`choose` 后进入 `feedback`，不能再做主要选择。
4. 反馈播放结束调用 `end-turn`；核心统一发基础收入、经营收入、推进日数和交付工具。第八回合进入 `settlement`。
5. `finish` 携带 `sellStall`、`sellInvestment`，一次性变现、支付开店款并进入 `report`。

每个动作有全局唯一 `id`，另含 `day` 防止旧界面跨日提交；已处理标识存入状态。拒绝动作原样返回状态。重开/清除由外壳生成新状态或删除存储。持久化前检查 `RULES_VERSION`，不兼容记录不得继续。

## 内容合同

`Effect` 只允许工作、观察、消费、购摊、普通工具、合购、投资和出售投资。`EventDefinition` 的选项由核心计算 `available`、`cost`、`shortfall`；核心自动保证存在工作选项。一次性物品由 `itemId` 防重，工具和投资另有持有约束。

基础事件编号作为 `contextId` 可防止同一事件变体增加独立证据。资料有稳定 `id/sourceId`；比较必须先展开两个不同来源。题目首次提交后不可改答。记录保留展示选项、现金和资产快照、资料、动作及结果；画像读取 `evidence`，自行按情境去重，不能把重复展开累计为独立线索。

`GameState` 为纯 JSON 可序列化结构；`dispatch` 不修改输入、不调用随机数、时间或浏览器。阶段为 `travel`、`decision`、`feedback`、`settlement`、`report`。路线/镜头由外壳控制，不推进经济阶段。对手账本在 `end-turn` 一次性按固定规则推进。

## 完成边界

本合同和单元测试覆盖经济核心，不代表 T02 三维与完整交互验收完成。公共事件装配及前提判断由内容装配负责，核心仍检查经济前提、余额、日数和幂等。

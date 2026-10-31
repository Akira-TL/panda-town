# 公共经济与回合接口

来源为首版规格。T02 的纯状态模块位于 `src/game/engine.ts`，由核心负责人维护；内容任务声明选项，不能直接改现金。

## 接入顺序

1. `createGame(sessionId, scenario)` 建局；情境为 `A` 或 `B`，由外壳独立随机选择。内部状态供存储使用，界面通过 `visibleGame` 读取，避免泄露未来情境。
2. 外壳处理掷骰、路线与动画，到达后用 `dispatch(state, {type:'open-event', id, day:state.day, event})` 冻结事件。事件含地点、基础事件和独立情境标识、选项及资料题目。
3. `dispatch` 接收 `inspect`、`compare`、`answer` 和 `choose`；选择只提交已冻结的 `optionId`，不从按钮传金额。`choose` 后进入 `feedback`，不能再做主要选择。
4. 反馈播放结束调用 `end-turn`；核心统一发基础收入、经营收入、推进日数和交付工具。第八回合进入 `settlement`。
5. `finish` 携带 `sellStall`、`sellInvestment`，一次性变现、支付开店款并进入 `report`。

每个动作有全局唯一 `id`，另含 `day` 防止旧界面跨日提交；已处理标识存入状态。拒绝动作原样返回状态。重开/清除由外壳生成新状态或删除存储。持久化前检查 `RULES_VERSION`，不兼容记录不得继续。

## 内容合同

`Effect` 只允许工作、观察、消费、购摊、普通工具、合购、投资和出售投资。`EventDefinition` 的选项由核心计算 `available`、`cost`、`shortfall`；核心自动保证存在工作选项。一次性物品由 `itemId` 防重，工具和投资另有持有约束。

基础事件编号作为 `contextId` 可防止同一事件变体增加独立证据。资料有稳定 `id/sourceId`；比较必须先展开两个不同来源。题目首次提交后不可改答。记录保留展示选项、现金和资产快照、资料、动作及结果；画像读取 `evidence`，自行按情境去重，不能把重复展开累计为独立线索。

记录版本为 2：每条证据同时保存 `assetsBefore` 和 `assetsAfter`，二者均为独立快照。投资成交报价、份额与成本直接来自成交后的持仓，不能从玩家未主动展开的资料推测，也不能伪造资料查看动作。版本 1 本局记录不兼容，恢复时提示重开。

`GameState` 为纯 JSON 可序列化结构；`dispatch` 不修改输入、不调用随机数、时间或浏览器。阶段为 `travel`、`decision`、`feedback`、`settlement`、`report`。路线/镜头由外壳控制，不推进经济阶段。对手账本在 `end-turn` 一次性按固定规则推进。

## 最小接入样例

下面的路径均相对于仓库根目录。内容接入选择已定义的 `Effect`，由核心核验余额和生效时机；增加新的经济规则时才扩展核心类型与对应验证。

```ts
import { createGame, dispatch, visibleGame } from "./src/game/engine";
import { getEventForLocation } from "./src/game/content";
import { buildProfile } from "./src/game/profile";

let state = createGame("example-session", "A");
state = dispatch(state, {
  type: "open-event", id: "arrival-1", day: state.day,
  event: getEventForLocation(state, "square"),
});
state = dispatch(state, {
  type: "choose", id: "choice-1", day: state.day, optionId: "work",
});
// 选择后现金1250，仍未领取当天基础收入；界面读取可见状态。
const visible = visibleGame(state);
state = dispatch(state, { type: "end-turn", id: "night-1", day: state.day });
// 次日现金1400；画像只接收真实动作证据，不读取隐藏行情情境。
const report = buildProfile(state.evidence);
```

事件内容插槽由 `getEventForLocation` 返回 `EventDefinition`。例如，摊位购买声明为 `{ id: "buy", label: "接手摊位，支出 600", effect: { kind: "buy-stall" } }`；不在店铺组件中再次扣款。资料使用 `materials: [{ id, sourceId, text }]`，题目使用 `questions: [{ id, prompt, answers, correctAnswerId, explanation }]`，字段类型均来自 `engine.ts`。已实现的完整样例见 `content.ts` 的集市、研究站和银行事件；只有到达事件才能展示这些选项。

场景通过 `TownSceneProps` 接收只读状态。最小值如下；触发资产变化仍通过上面的动作入口。

```ts
import type { TownSceneProps } from "./src/scene/TownScene";
const sceneProps: TownSceneProps = {
  playerLocation: "square", cameraMode: "follow",
  stallOwned: false, cafeOpened: false, reducedMotion: false,
  onAssetStatus: ({ loaded, missing }) => {
    // 界面据实际加载结果提示；不改变账本或画像。
    console.info({ loaded, missing });
  },
};
```

画像插槽返回 `ProfileReport`，每项 `ProfileFact` 含 `text/status/count/opportunities/evidenceIds`；`evidenceIds` 对应本局证据卡，实际渲染见 `ReportPanel.tsx`。买卖后的资产明细由 `deriveAssetChanges` 从独立快照派生。具体去重和不足状态规则见[画像接口](profile-contract.md)。

## 公共装配与修改范围

| 文件或模块 | 唯一负责的状态变化 | 扩展内容的接入点 |
| --- | --- | --- |
| `engine.ts` | 经济效果、阶段、幂等及行为证据 | 选项只声明已有 `Effect` |
| `content.ts` | 地点连接、事件优先级、中文剧情与资料题目 | `LocationId`、`EventDefinition`、资料与题目 |
| `app/page.tsx` | 开局、骰子、剩余步数、岔路、一次到达及界面装配 | `dispatch`、`TownScene`、画像组件 |
| `TownScene.tsx` 与场景子模块 | 模型、镜头、动画和只读资产外观 | `TownSceneProps` 与本地资源 |
| `profile.ts` 与 `ReportPanel.tsx` | 从只读证据派生报告及展开证据 | `buildProfile`、`ProfileFact`、证据卡 |
| `session.ts` | 当前局结构校验与恢复数据契约 | `Session`、`STORAGE_KEY`、`restoreSession` |

页面调用会话存储，解析异常或不兼容数据进入重开提示；`session.ts` 不请求网络。场景、对话和画像均不另建账本。并行任务修改这些公共文件前先向当前负责者交接，细节内容优先放入各自模块。

## 完成边界

本合同和单元测试覆盖经济核心，不代表 T02 三维与完整交互验收完成。公共事件装配及前提判断由内容装配负责，核心仍检查经济前提、余额、日数和幂等。

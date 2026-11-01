# Panda Town

面向 PandaAI 赛道的三维童话小镇交易与学习游戏。玩家掷骰沿弯曲街道自动前进，在八家店观察各自真实历史行情的游戏映射，买入、加仓、持有或卖出商品。现金、持仓、含费成本和盈亏跨轮保留，右上角设置可随时结算。

当前依据为[游玩学习规格](docs/specs/learning-experience.md)与[连续商店交易合同](docs/specs/shop-trading.md)。没有固定八天终局，也不要求开店解锁。旧开店及固定八章记录仅供历史追踪，不能证明当前版本通过。

## 试玩与运行

本机预览：[打开 Panda Town](http://127.0.0.1:3018/)。完整环境要求、启动与停止步骤见[运行说明](docs/运行说明.md)。

克隆仓库并进入项目根目录：

```sh
git clone https://github.com/Akira-TL/panda-town.git
cd panda-town
```

在项目根目录的 Git Bash 中安装、构建、启动：

```sh
npm ci
PANDA_MODE=production npm run build
PANDA_MODE=production PORT=3018 bash scripts/start.sh
```

停止同一生产服务：

```sh
PANDA_MODE=production bash scripts/stop.sh
```

运行脚本使用 `.next-production` 隔离生产构建，日志写入 `logs/production.log` 与 `logs/production-error.log`。已有运行负责人时先协调，避免重复启动。以下为检查命令，浏览器用例应在同一冻结构建上串行执行：

```sh
npm run typecheck
npm test
PANDA_TEST_URL=http://127.0.0.1:3018 npm run test:browser:learning
PANDA_TEST_URL=http://127.0.0.1:3018 npm run test:browser:trading
```

`npm test` 检查当前交易、行情、指标、学习和镜头模块；`test:paths` 是旧玩法路径，不作为当前验收入口。已确认与待补证据见[本地验证](docs/validation/local-validation.md)和[24项任务矩阵](docs/validation/task-status.md)。

## 当前玩法与学习

- 面包、木材、水果、芯片、金券、花束、咖啡豆、茶叶分别映射八份独立历史日线，保留真实开高低收和成交量；只展示截至当前日期的已知数据。
- 每轮到站共同推进一天行情，只做一次主要交易。当前店可买入；已有商品可从背包跨店卖出。费用为成交金额的0.1%，受现金、持仓和当日数量限制。
- K线与收盘折线、成交量、此前均价、真实成交点和当前含费成本相互对应。成交前可看支出、余款与持仓预览，成交后看到真实数量和现金变化。
- 玩家可保存“什么时候买、投入多少、什么时候退出”，规则仍需手动确认交易。挂价牌辨认与新情境规则判断均可跳过，不耗交易机会；查看资料与盈利都不算掌握知识。
- 六项指标研究包含指数移动平均线（Exponential Moving Average, EMA）、指数平滑异同移动平均线（Moving Average Convergence Divergence, MACD）、相对强弱指数（Relative Strength Index, RSI）、随机指标（KDJ）、布林带及平均真实波幅（Average True Range, ATR）。历史不足明确留空，公式与阈值见[指标依据](docs/research/trading-indicators.md)。
- 电脑商人使用公开固定规则、同一起点、同轮落点、同样费用与成交约束，不读取未来择优行动。结算区分总资产、盈亏、费用和从已观察账户估值计算的最大回撤。
- 当前含200日历史，初始公开20期，最多推进180轮；没有八轮限制。历史末尾停止推进，仍可结算。结算按当前市值计价，不假造自动卖出。

## PandaAI 衔接与本机记录

结果页的“去 PandaAI 验证 ↗”主动打开 [PandaAI智能体量化页面](https://www.pandaaiquant.com/agent_quant/)，无附加参数。“复制我的问题”由玩家主动复制本局规则、交易与客观学习事实，再自行粘贴；成功和失败分别提示，不声称已经发送。

交易与学习分别使用 `panda-town.trading.v1`、`panda-town.learning.v1`，保存在当前标签页的 `sessionStorage`，按同一局标识关联。刷新恢复、重开和清除均需同时处理两类记录；设备拒绝读写或删除时保留准确提示。没有自动上传玩家记录。零交易或未答题保留未观察，不生成固定人格或能力结论。

## 规格与制作资料

- [规则索引](docs/specs/panda-town.md)、[24项任务与依赖](docs/plans/task-breakdown.md)
- [知识—操作—反馈—证据映射](docs/validation/learning-knowledge-map.md)、[行情来源与许可](docs/design/shop-market-data-source.md)
- [视觉生产流程](docs/design/visual-production.md)、[学习版用户制作输入](docs/art/production/learning-scenes-20261101-v1/开发执行提示词.md)
- [产品方向](docs/product-brief.md)、[领域概念](CONTEXT.md)、[GitHub任务](https://github.com/Akira-TL/panda-town/issues)

## 美术与开源

![用户选定的童话小镇概念图](docs/art/fairytale-town-reference.png)

概念图由 OpenAI imagegen 生成，是制作参照；十五名新增居民与实际三维世界仍需按同一运行版本对照，模型加载不能替代画面对照。建议5–8分钟体验和实体手机表现待现场验证，不以自动化耗时或模拟视口代替。

源码采用[MIT许可证](LICENSE)，自生成图像和模型来源见[美术资料](docs/art/README.md)。商品是真实历史金融产品的游戏映射，未接入 Panda Data 或真实资金。第三方行情及派生快照保留独立署名与非商业许可，不随源码按 MIT 重新授权。赛事资料包、账号凭据和玩家个人原始记录不进入公开仓库。

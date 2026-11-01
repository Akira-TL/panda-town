# 交易图表指标：来源、计算口径与边界

核实日期：2026-11-01。已实际浏览用户指定的 Fidelity、富途证券帮助资料，
并补查 StockCharts 官方教育资料及 TA-Lib 官方源码。本说明对应
`src/trading/indicators.ts`，不是图像中的示例数值，也不改变交易账本的成交条件。

## 数据和输入边界

`getVisibleCandles(product,lastIndex)` 提供从索引0起的已知四价与量，
`getIndicatorSeries(candles, options?)` 只消费传入前缀，不读取市场全表。
计算不修改输入，不插补未来，不为不足的历史画平滑线。索引从0连续、日期递增，
开收盘必须在高低价之间，价格为正、量非负；无效输入抛出 `RangeError`，空前缀返回空数组。

四价来自原CSV的开盘、最高、最低、收盘字段；它们采用同一个首日开盘缩放比例，
成交量反向换算。官方字段定义见
[Binance公开现货日线说明](https://github.com/binance/binance-public-data#klines)。
八份200日快照的来源、锁定校验值与逐位兼容说明见
[市场数据来源](../design/shop-market-data-source.md)。

以下以当期收盘 `C_t`、最高 `H_t`、最低 `L_t`、成交量 `V_t` 表示数据，
首根索引为0。窗口含不含当期在每项中分别明确。预热只是“可以计算”的最低要求，
递推指标仍受历史起点和初始化方法影响；不保证与采用更长前史或其他种子的终端逐位一致。

## 公式及来源

### 指数移动平均线

指数移动平均线（Exponential Moving Average, EMA）默认12期，可用
`{emaPeriod: n}` 改为2至200的整数。先取首 `n` 个收盘的简单平均为种子，
在索引 `n-1` 输出首值；随后 `EMA_t=EMA_(t-1)+2/(n+1)×(C_t-EMA_(t-1))`。
不从首价立即输出完整指标。
简单均值种子与递推关系已核对
[Fidelity EMA说明](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ema)，
权重 `2/(n+1)` 另核对
[StockCharts均线计算说明](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-overlays/moving-averages-simple-and-exponential)。

### 指数平滑异同移动平均线

指数平滑异同移动平均线（Moving Average Convergence/Divergence, MACD）固定12、26、9期。
`DIF=EMA12-EMA26`，`DEA=EMA9(DIF)`，柱体 `histogram=DIF-DEA`，不乘2。
两条价格EMA分别按上述简单均值种子初始化；首个DIF在索引25可计算，
DEA再积满9个DIF作为种子，因此完整对象在索引33首次输出；此前整个 `macd` 为 `null`。
12/26差值及9期信号线已核对
[Fidelity MACD公式](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd)。
本项目明确采用不乘2的柱体口径，不把其他终端的柱体缩放当成数值错误。

### 相对强弱指数

相对强弱指数（Relative Strength Index, RSI）采用14期 Wilder平滑。
先将14个相邻收盘变动拆为正涨幅及正跌幅，各自平均；后续均值按
`新均值=(旧均值×13+本次涨幅或跌幅)/14` 递推。
`RSI=100-100/(1+平均涨幅/平均跌幅)`；需要15个收盘，索引14首次输出。
公式与平滑初始化已核对
[Fidelity RSI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/rsi)
及[StockCharts Wilder计算说明](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/relative-strength-index-rsi)。

平均跌幅为0且有上涨时为100，平均涨幅为0且有下跌时为0。
两者同时为0造成 `0/0`，本项目明确规定为中性50；这是实现边界选择，
不冒称所有终端采用同一约定。70/30仅是解释时的常见参考，不能直接判断即将反转。

### 随机指标

随机指标（KDJ）固定9、3、3。9根窗口包含当期，
`RSV=100×(C_t-窗口最低)/(窗口最高-窗口最低)`；
`K_t=2/3×K_(t-1)+RSV/3`，`D_t=2/3×D_(t-1)+K_t/3`，`J_t=3K_t-2D_t`。
这些公式已核对[富途证券KDJ帮助](https://www.futuhk.com/hans/support/topic1_149)。
本项目选择K、D初始50，积满9根后在索引8首次递推并输出；零高低区间令RSV为50。
初始值与零区间处理是本项目显式约定。J可以超出0至100，计算和显示均不得裁剪。
KDJ中的K曲线与蜡烛K线是不同概念。

### 布林带

布林带（Bollinger Bands）固定20期、2倍标准差，窗口包含当期。
`middle` 是这20个收盘的简单平均，`σ=sqrt(Σ(C-middle)²/20)`，
`upper=middle+2σ`，`lower=middle-2σ`，索引19首次输出。
20期/2倍关系已核对
[Fidelity布林带](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/bollinger-bands)。
本项目明确选择总体标准差，除以20而非19；
[TA-Lib方差源码](https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_VAR.c)
也以窗口期数为分母。这里只核对口径，未复制该库源码。
上下轨不截断为正数，也不将触轨直接解释成必须买卖。

### 平均真实波幅

平均真实波幅（Average True Range, ATR）固定14期 Wilder平滑。
`TR=max(H-L,abs(H-前收),abs(L-前收))`，首根没有前收时以 `H-L` 为TR。
先平均首14个TR，索引13首次输出，之后 `ATR_t=(ATR_(t-1)×13+TR_t)/14`。
真实波幅及递推关系已核对
[Fidelity ATR公式](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr)，
首根和种子口径核对
[StockCharts ATR计算说明](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/average-true-range-atr.md)。
跳空使用真实前收，不能仅取当根影线长度；ATR是价格单位的幅度，不是方向或收益率。

## 既有参考线与量比

以下是游戏固定窗口的透明计算定义，不作为新发明的技术指标名称：

| 字段           | 计算和边界                                                   |
| -------------- | ------------------------------------------------------------ |
| `ma20`         | 此前20个收盘均价，排除当期，索引20首值；保持原市场接口口径   |
| `priorHigh20`  | 此前20根最高价最大值，排除当期，索引20首值；可供前高突破对照 |
| `volumeRatio5` | 当期数量除以前5根均量，索引5首值；分母为0则空值              |

布林带 `middle` 含当期，与 `ma20` 的排除当期口径不同，不能在图例中混用。
所有参考线只能从当前公开前缀取极值；指标值只说明当前已发生的条件，
不自动改变玩家账户或保证后续价格方向。

## 对接接口

`IndicatorPoint` 包含 `index/date` 以及：

| 字段                  | 类型                  | 最早有效索引 |
| --------------------- | --------------------- | ------------ |
| `ema`                 | `number               | null`        | 默认11；自定周期减1 |
| `macd`                | `{dif,dea,histogram}  | null`        | 33                  |
| `rsi`                 | `number               | null`        | 14                  |
| `kdj`                 | `{k,d,j}              | null`        | 8                   |
| `boll`                | `{middle,upper,lower} | null`        | 19                  |
| `atr`                 | `number               | null`        | 13                  |
| `ma20`、`priorHigh20` | `number               | null`        | 20                  |
| `volumeRatio5`        | `number               | null`        | 5且此前均量非0      |

界面应将 `null` 显示为“历史不足”或“无可用参考”，不补0、不连接未知空段。
初始公开20根时MACD尚不足；继续经历真实日期后自然可计算，不提前开放行情。

## 核对证据及范围

`indicators.test.ts` 使用独立手算例：EMA三期种子2、后值4.5；
等差价格MACD差值7及一次突升；RSI七涨七跌后两次变动；
KDJ种子50及J超过100；1至20价格的总体方差33.25；ATR跳空后的37/14与705/196。
另检查预热、全平/单边/零量、多个真实前缀一致、修改未来不影响过去以及输入不变。

`market.test.ts` 原有开盘/收盘/量预期继续保留，新增八商品原CSV高低价独立抄核和
K线前缀、副本、四价边界。数据导入逐位检查原四列未改变，并复核56个原包的锁定校验值。
这些确定性计算检查不证明研究抽屉、交叉点击或知识互动已经在界面完成；接入和真实浏览器检查另行进行。

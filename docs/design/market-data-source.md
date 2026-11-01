# 真实历史行情来源与游戏映射

本项目使用Binance Vision公开现货日线，BTCUSDT映射为游戏的竹材（bamboo），ETHUSDT映射为松果（pine）。这两种游戏商品只借用真实市场的价格与成交量序列，不代表真实竹材、松果或PandaData行情。没有随机添加波动、平滑、重排日期或按回测收益挑选窗口。

## 数据、日期与许可

- 官方说明：[binance-public-data](https://github.com/binance/binance-public-data)。现货数据自2025-01-01起采用微秒时间戳；CSV每行12列，本项目保留第2列开盘、第5列收盘、第6列基础资产成交量的原始十进制字符串。
- 固定取2025-01-01至2025-07-19，UTC连续200个日历日；加密资产市场每天交易，不能解释为A股交易日。20期预热为01-01至01-20，120期研究为01-21至05-20，60期检验为05-21至07-19；检验前史仅取此前20期。
- 抓取时间：2026-10-31T14:58:46.553Z。月份ZIP及其官方CHECKSUM先做SHA256核验，再解压；七月包有31日，仅按上述固定截止日期保留前19日。原始包、清单、CSV保存在本机忽略目录 logs/market-data-source/。
- [数据条款](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md) 当前版本1.0、更新2026-08-26：数据及派生数据采用[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)，附该数据条款，限非商业教育与研究，商业用途需另获许可。仓库代码的MIT不能替代数据许可。本快照和行情映射不属于本项目自行授权的MIT资产；保留Binance Vision来源和同等数据许可。项目不表示与Binance存在合作或背书。

## 单位转换与人为传输错误

每项资产各自取2025-01-01真实开盘价 P0，价格缩放因子 s=100/P0。模拟开盘/收盘为原价×s，模拟数量为原基础资产数量÷s；因此原价×原数量与模拟价格×模拟数量的数值相同，比例收益和真实涨跌序列保持不变。首期开盘均为100模拟币。使用未四舍五入的数值计算，界面显示另行格式化，不把显示位数写回模拟。

原始报价在 src/research/market-history.ts 按字符串保留，data.ts统一转换。传输副本仍有四个明确人为设置的教学错误：02-12竹材缺收盘，03-12松果缺成交量，03-28松果收盘被改为9999，04-28竹材成交量被改为-4。它们不是交易所实际坏数据；清洗时只重读同日期已核验源恢复，保留收到值、恢复值和解释，不以前日量替代、不引用未来行。

DATASET_VERSION更新为 panda-binance-spot-1d-20250101-20250719-v1。旧模拟版本的保存记录必须被拒绝，避免混用收益或证据。回测规则、成交与费用计算没有因本次换数据改变。历史日成交量仅是教学撮合上限，不等同于实际下单时的盘口流动性。

## 可重复导入

在项目根目录运行：

```powershell
& 'C:/nvm4w/nodejs/node.exe' --import tsx scripts/data/import-binance-history.ts
```

脚本只请求公开静态ZIP与CHECKSUM，不需要登录、密钥或付费；两资产并行、同资产逐月下载，不调用交易接口。先将官方校验值与当前快照HISTORY_ARCHIVES锁定值比对，再核验缓存或下载包，不匹配即停止，不静默覆盖。官方可能修订历史包；发生修订时应审核差异并升级数据版本与锁定清单，不能用同一版本悄悄替换。当前快照同时作为导入的版本清单，因此运行前应保留受版本控制的market-history.ts。再导入会更新抓取时间，其余相同输入保留相同报价。格式化可使用项目已有Prettier。快照进入浏览器包，检验报价的保留由研究流程界面控制，不宣称为服务端秘密。

## 独立抄核样本

以下字段从已核验的解压CSV独立读取，用于data.test.ts的公开报价与清洗预期；不调用生产缩放函数制造预期。缩放后的测试常量另用十进制定点算术计算，容忍二进制浮点末位差异。

| 资产与UTC日期 | 原始开盘        | 原始收盘        | 原始基础资产成交量 |
| ------------- | --------------- | --------------- | ------------------ |
| BTCUSDT 01-01 | 93576.00000000  | 94591.79000000  | 10373.32613000     |
| ETHUSDT 01-01 | 3337.78000000   | 3360.38000000   | 190238.58610000    |
| BTCUSDT 01-21 | 102260.00000000 | 106143.82000000 | 45941.02002000     |
| ETHUSDT 01-21 | 3283.99000000   | 3327.54000000   | 548706.05130000    |
| BTCUSDT 02-12 | 95778.21000000  | 97869.99000000  | 29151.16625000     |
| ETHUSDT 03-12 | 1923.42000000   | 1908.20000000   | 788739.67630000    |
| ETHUSDT 03-28 | 2003.67000000   | 1896.90000000   | 626167.58320000    |
| BTCUSDT 04-28 | 93749.29000000  | 95011.18000000  | 22157.53351000     |
| BTCUSDT 07-19 | 117924.84000000 | 117840.00000000 | 6635.80306000      |
| ETHUSDT 07-19 | 3546.92000000   | 3592.01000000   | 381791.92130000    |

## 下载地址与校验值

每个地址后追加 .CHECKSUM 即官方校验清单。下列为实际成功核验的ZIP SHA256；解压CSV SHA256与原月行数另完整记录在快照 HISTORY_ARCHIVES。

| 月包                                                                                                      | ZIP SHA256                                                       |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [BTCUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-01.zip) | 3a3eb1b723d944deb4dbef5ae361bbe39340a17fe987fe22e397ef03dca268d2 |
| [BTCUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-02.zip) | 27cfde08c9eb8e3801fb049e3be351a3e50ab46abd8553c24023fa98ea5e919e |
| [BTCUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-03.zip) | 5874e405f55c46f040de1a8ea9daae583dc12b5bcaef6078b21aae9c627cedcc |
| [BTCUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-04.zip) | 8068a571425857cb0f5f71f75e733d3bc1e731362a09f84f835bbea6e087aeb2 |
| [BTCUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-05.zip) | 2b87aa0c63641ba1e954855bcfed96d7fc4eb21efe7936f354ff74e8e06cfcea |
| [BTCUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-06.zip) | dc4bbe2c75f04372b909febe8e6b379b053f88423d78cdb3ad8b0be3a66d6ede |
| [BTCUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-07.zip) | 1ea64a346f6be0aaf455eb1ce107e6d38367164d97d0dd3719b9f9bb239796f4 |
| [ETHUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-01.zip) | fb1c6329259282a4174c646629515704da03c713bff9106f8da01ec188112a09 |
| [ETHUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-02.zip) | ed3cf4f55aa296a25e092d73170c6772fa33e089c8ee5bdd379198fa94675361 |
| [ETHUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-03.zip) | 37a2a5d88861944141de683f7584d01cfeb23c0a69ba0aa2613fa6ec14b33960 |
| [ETHUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-04.zip) | 88554fccbad3d445fb7aad16440ef62aeb7b5a0d0d0be26101919753a455e106 |
| [ETHUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-05.zip) | 05f9099dc0225439cdcd08661281bc958f4984a02c5219ff019c7988140a4511 |
| [ETHUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-06.zip) | 1a436c3f4e79c6ef65e06749c7be302800f2bbe84b283f36b670688f1fe8e706 |
| [ETHUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-07.zip) | 507452f08f6df58e28c66a56eb114c274a601908b7a36cca028f4f1fe685c5a0 |

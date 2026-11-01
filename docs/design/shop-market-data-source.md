# 八商品真实历史行情来源

八家商店分别使用八个独立现货产品的历史日线。不是两条曲线改名，不做平滑、随机波动、拼接或按收益挑选窗口。
全部固定取2025-01-01至2025-07-19的200个UTC日历日；市场起点index19，公开初始20期前史，到达推进一日。
最后index199是2025-07-19，之后停止，不循环或补造未来。快照由公开原始CSV导入，运行不请求网络行情。

## 映射、单位与可见边界

商品映射唯一维护于src/trading/products.ts。游戏商品只是虚构名称；其走势来自下列加密资产产品，不代表真实商品市场或PandaData。
市场版本为panda-eight-binance-spot-1d-20250101-20250719-v1，与旧八章研究版本分开，不续接旧局。

| 游戏商品 | 原历史产品 |
| -------- | ---------- |
| 面包     | BTCUSDT    |
| 木材     | ETHUSDT    |
| 水果     | BNBUSDT    |
| 芯片     | SOLUSDT    |
| 金券     | XRPUSDT    |
| 花束     | ADAUSDT    |
| 咖啡豆   | DOGEUSDT   |
| 茶叶     | LINKUSDT   |

每资产首日真实开盘P0，缩放s=100/P0。价格=真实价格×s，数量=原始基础资产成交量÷s，保持价格×数量数值一致。
使用未舍入值计算，原始四价及成交量字符串保存在history/八个文件中。元组原[日期,开,收,量]后追加[高,低]，前四列逐位不变。
本次仅补齐同一批原CSV的最高/最低字段，MARKET_VERSION不变，兼容此前账户与已成交价格，不伪造影线。
公开图表只含0..当前index；此前5/20期均价排除当期收盘，无足够前史返回null。首期前收与涨跌均null，涨跌字段是绝对价差。
getQuote/getMarketDate/getVisibleSeries/getVisibleCandles对负数、非整数或大于199的索引抛RangeError，不读取未来。
getVisibleCandles仅返回索引0至lastIndex的{index,date,open,high,low,close,volume}副本。
getVisibleSeries保留price/previousClose/change/ma5/ma20，并增加相同已知点的四价与量；纵轴不得另取全序列极值。
日成交量只是教学撮合上限，不代表实际下单盘口。交易按当前已公开收盘进行纸上模拟，不是实盘执行。

## 来源、校验与许可

来源：[Binance公开数据说明](https://github.com/binance/binance-public-data)。2025起现货时间戳为微秒，转换到毫秒再按UTC解析。
本次核验时间：2026-10-31T18:23:52.412Z。56个月包均先验证官方CHECKSUM中的SHA256，再解压；每CSV12列，采用开高低收和基础资产成交量。
每个原月文件应覆盖整个日历月；七月31行中只保留截至19日。日期连续性与每产品恰200行实际检查。
ZIP、CHECKSUM和解压CSV保留在本机忽略目录logs/market-data-source/，每文件CSV SHA256与行数也记入各快照ARCHIVES。

[官方数据条款](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md)
当前v1.0、2026-08-26更新，数据及派生数据采用CC BY-NC-SA 4.0与该数据条款，限非商业教育/研究，商业需另获许可。
来源数据与派生快照不按项目MIT重新授权；保留Binance Vision署名及相同数据许可。不表示商业合作或背书。

## 独立CSV抄核样本

下表从已核验原CSV独立读取，用于market.test.ts公开报价预期。归一化常量使用十进制算术另算，不调用市场函数制造预期。

| 原始产品 | 01-01开盘      | 01-21收盘       | 01-21基础资产成交量 |
| -------- | -------------- | --------------- | ------------------- |
| BTCUSDT  | 93576.00000000 | 106143.82000000 | 45941.02002000      |
| ETHUSDT  | 3337.78000000  | 3327.54000000   | 548706.05130000     |
| BNBUSDT  | 702.31000000   | 692.21000000    | 294203.47100000     |
| SOLUSDT  | 189.31000000   | 250.33000000    | 7882737.25700000    |
| XRPUSDT  | 2.08360000     | 3.17380000      | 376423502.00000000  |
| ADAUSDT  | 0.84500000     | 1.00580000      | 303337850.20000000  |
| DOGEUSDT | 0.31600000     | 0.37177000      | 4627964135.00000000 |
| LINKUSDT | 20.02000000    | 26.67000000     | 10509727.17000000   |

以下01-21高低价另从原CSV第3/4列抄核；测试中的归一化预期由独立十进制运算得到。

| 产品     | 原最高          | 原最低          | 归一化最高         | 归一化最低         |
| -------- | --------------- | --------------- | ------------------ | ------------------ |
| BTCUSDT  | 107240.81000000 | 100119.04000000 | 114.60290031632042 | 106.99222022740873 |
| ETHUSDT  | 3368.00000000   | 3204.60000000   | 100.90539220679613 | 96.00992276303411  |
| BNBUSDT  | 697.00000000    | 675.01000000    | 99.24392362347112  | 96.11282766869331  |
| SOLUSDT  | 260.06000000    | 230.00000000    | 137.37256352015213 | 121.49384607257937 |
| XRPUSDT  | 3.24600000      | 3.01240000      | 155.78805912843156 | 144.57669418314456 |
| ADAUSDT  | 1.02880000      | 0.95080000      | 121.75147928994083 | 112.5207100591716  |
| DOGEUSDT | 0.40382000      | 0.33572000      | 127.79113924050633 | 106.24050632911393 |
| LINKUSDT | 27.09000000     | 23.68000000     | 135.3146853146853  | 118.28171828171828 |

## 可重复导入

项目根目录运行node --import tsx scripts/data/import-shop-history.ts。已有各快照ARCHIVES同时作为锁定清单。
首次缺少文件时显式加--initialize；已有文件始终核对锁定值，官方校验变化即停止，审核后需升级版本。
离线复核可加--offline：使用忽略目录中的原ZIP与官方CHECKSUM，仍核对源码锁定SHA256，缺失即停止，不跳过校验。
脚本只下载公开静态ZIP及CHECKSUM，无密钥、登录、付费或交易操作；两产品并行、每产品顺序下载七个月。
源码快照均小于800行且每行不超过120列；单个prettier-ignore保留机器排版。未接入PandaData。

## 实际核验的56个来源包

每个链接追加.CHECKSUM即官方校验文件。CSV校验值与行数见各快照ARCHIVES；下表是ZIP SHA256。

| 产品月份                                                                                                     | ZIP SHA256                                                       |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [ADAUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-01.zip)    | e29683b918b44557aa75ca34398f3304096d91ea56dd59f0f417319ffea56f73 |
| [ADAUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-02.zip)    | 061d3bcdc3b1e121ac3be86099244e47cef6158aa87fed9ec70ea66c052bcdfc |
| [ADAUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-03.zip)    | eea53ca87b72f38fd19f780f14f0c5047aa0440461491445b0a5ef333a1a457d |
| [ADAUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-04.zip)    | 7bb097412040b8182a4031dea4bbf913dc64f1d3ec62faa7cf96e44d84b4f091 |
| [ADAUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-05.zip)    | 288fd60283d11ead7c051cac31bc808696298ca0453f610afa79845adcb1d611 |
| [ADAUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-06.zip)    | dd2e2cf39270f12beb0a46d3be4733926a9228956700fa1d57a96c635c5a7459 |
| [ADAUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/ADAUSDT/1d/ADAUSDT-1d-2025-07.zip)    | 5277f29bd81532bfc60b0632768ccff1885bbc576ac4ed012d2ff21b31b6086b |
| [BNBUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-01.zip)    | 50d7646f9fdeebba62408547b775ca328f85d1464139a1e22a761b6068edcd8d |
| [BNBUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-02.zip)    | ca8f4a9bdf0be827132459db5ab7da08f633456dfb99ae4e3bb1fe54225597ba |
| [BNBUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-03.zip)    | 71231a1cb118abbe98f2a5e330c699afe37e2998f025c13f3e7abbf0b034705b |
| [BNBUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-04.zip)    | a90bca13bf407336c7c5646ba8c54d0cd5bceb923d30a1dd904050b83ae0116b |
| [BNBUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-05.zip)    | 0ec9f578274d77a7a6550a78f60fcb958e53ed4f96dc2e3bfae3bfa8f0f41552 |
| [BNBUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-06.zip)    | 0724ea1a2ca134c138acf4c27f88c99a7271d2ac9f065ca1f2c2ebd1361838ed |
| [BNBUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2025-07.zip)    | 060a89450cfa7baf8b2068962b9d961c63b6a533970256d7fc8356162ba00905 |
| [BTCUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-01.zip)    | 3a3eb1b723d944deb4dbef5ae361bbe39340a17fe987fe22e397ef03dca268d2 |
| [BTCUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-02.zip)    | 27cfde08c9eb8e3801fb049e3be351a3e50ab46abd8553c24023fa98ea5e919e |
| [BTCUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-03.zip)    | 5874e405f55c46f040de1a8ea9daae583dc12b5bcaef6078b21aae9c627cedcc |
| [BTCUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-04.zip)    | 8068a571425857cb0f5f71f75e733d3bc1e731362a09f84f835bbea6e087aeb2 |
| [BTCUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-05.zip)    | 2b87aa0c63641ba1e954855bcfed96d7fc4eb21efe7936f354ff74e8e06cfcea |
| [BTCUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-06.zip)    | dc4bbe2c75f04372b909febe8e6b379b053f88423d78cdb3ad8b0be3a66d6ede |
| [BTCUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-07.zip)    | 1ea64a346f6be0aaf455eb1ce107e6d38367164d97d0dd3719b9f9bb239796f4 |
| [DOGEUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-01.zip) | dcdcd48601bf700c01e0612ccf5ee7b0316a964904d45c7c17fe82c901b5f54d |
| [DOGEUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-02.zip) | a2c0dd3a5450f12cf0974f19ca248d9f7a61a1a8fe7f7abb1ad285e320a53a6a |
| [DOGEUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-03.zip) | da417dcbd9fed3a8f9dffe25e269dfdf4d1821ea1b87ebcb1ddd1e5d2aa1e67d |
| [DOGEUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-04.zip) | f42faa43f436aa4fa2f13946710c2974ed10954ea45890b22d752107a7d8038a |
| [DOGEUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-05.zip) | 26c273c7b51ba35ddbcda8b467d80a106eb47eb1b05dd849c3cd6290aeb6b84d |
| [DOGEUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-06.zip) | dd07195828ff1fbfbab1f9e8655892a125cd98a9e9a0e0ba8e764cec9c977cc7 |
| [DOGEUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/DOGEUSDT/1d/DOGEUSDT-1d-2025-07.zip) | 05aeb6968393c612da3fe9a0e5b16fc94f763cd9fe8460ace1b434f752c714da |
| [ETHUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-01.zip)    | fb1c6329259282a4174c646629515704da03c713bff9106f8da01ec188112a09 |
| [ETHUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-02.zip)    | ed3cf4f55aa296a25e092d73170c6772fa33e089c8ee5bdd379198fa94675361 |
| [ETHUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-03.zip)    | 37a2a5d88861944141de683f7584d01cfeb23c0a69ba0aa2613fa6ec14b33960 |
| [ETHUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-04.zip)    | 88554fccbad3d445fb7aad16440ef62aeb7b5a0d0d0be26101919753a455e106 |
| [ETHUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-05.zip)    | 05f9099dc0225439cdcd08661281bc958f4984a02c5219ff019c7988140a4511 |
| [ETHUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-06.zip)    | 1a436c3f4e79c6ef65e06749c7be302800f2bbe84b283f36b670688f1fe8e706 |
| [ETHUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2025-07.zip)    | 507452f08f6df58e28c66a56eb114c274a601908b7a36cca028f4f1fe685c5a0 |
| [LINKUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-01.zip) | c692b8a5ef03281ac6f09f74e893fd387cefc65029909c99c8d26f45a27c4c42 |
| [LINKUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-02.zip) | f1569de3f2717b230ae244d863bc9538df1d82b8b39b72890b1137867d5c5981 |
| [LINKUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-03.zip) | 3e8d76ee0fd525fe29a2c77255c4b14a6537f469c92e3326023a4c061dd65c8a |
| [LINKUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-04.zip) | 576d792474617361a1ca20195fd05c7d52c61e3dcb3b9f8f5c9c44dc29ddccc6 |
| [LINKUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-05.zip) | 3fd793592713d62e4c99094f66cd5869d0207a78b412239577cec0bc2cc62027 |
| [LINKUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-06.zip) | fb14bbd0b916a603aaebac8641698a8a22477f250f26fa11d7016bc42068ba32 |
| [LINKUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/LINKUSDT/1d/LINKUSDT-1d-2025-07.zip) | 8fdb2f935cdab8889fee7c90f0fe9c45af24ef8c613935eefadeb5fd5ac7e219 |
| [SOLUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-01.zip)    | 48087cf248bb601648b8fe5d942bf5255864bddf08f0e47dcb2622f2cbfe020e |
| [SOLUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-02.zip)    | 3b84382d78bf1e812c907108c26eba2cf485fb40e8fb52f414be550ecf014b5f |
| [SOLUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-03.zip)    | 85fa8662e07bb9ab5ceb7b848022e57c5aa164fb0bfa3ffebfb6cff37dcad5f3 |
| [SOLUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-04.zip)    | bcc78ff9c12dad7d789c63eb907ff8eeb3ed5dfb09a78c63a4c8ac71273da04d |
| [SOLUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-05.zip)    | e941f16df00c40ebdead705ca3579e517474d91bc1bb9f1a6cd228ecf261b260 |
| [SOLUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-06.zip)    | 0f07a118614cbd5e9c87ca21fac821fe204b77e32d776cc7406af945665adfa1 |
| [SOLUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/SOLUSDT/1d/SOLUSDT-1d-2025-07.zip)    | 077cf97a326946b4745492d505757dea1c0fde94e048f77a53264758e484e90c |
| [XRPUSDT 2025-01](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-01.zip)    | ec7b1875fced8764e68cc1d30aeead27c561edfad363d5df6ef3f028f9f5389b |
| [XRPUSDT 2025-02](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-02.zip)    | 9a6c5c28897cb6e86cb61fe4cb7db39280c1e70b3ef5656bf5cbedc13186dbd7 |
| [XRPUSDT 2025-03](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-03.zip)    | c69e081f70180dd104d4b2450df50a82929a68b0624fc8d62be284f81c1c70a9 |
| [XRPUSDT 2025-04](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-04.zip)    | 79a74d1c7983e25e16fcf94b593bf4a4b320a89646c6074408e3a9fa49b1016c |
| [XRPUSDT 2025-05](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-05.zip)    | a0a07682d6614ce92e17311faf4b8f0380432ea542f180c3dd0368c99555345d |
| [XRPUSDT 2025-06](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-06.zip)    | b24e70d686bab388e6ceb1488d123b945b5d5d8d2e2a6fbd0d45b19798a85625 |
| [XRPUSDT 2025-07](https://data.binance.vision/data/spot/monthly/klines/XRPUSDT/1d/XRPUSDT-1d-2025-07.zip)    | 637fbc9a81405f5ef9b5f3ab446f26783c569455e41c36cff0a66926a976d0a1 |

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { HISTORY_ARCHIVES } from "../../src/research/market-history";

interface SourceArchive {
  symbol: string;
  month: string;
  url: string;
  sha256: string;
  csvSha256: string;
  rows: number;
}
interface RawDailyQuote {
  date: string;
  open: string;
  close: string;
  volume: string;
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const cache = resolve(root, "logs/market-data-source");
const snapshots = resolve(root, "src/research/market-history.ts");
const sourceDoc = resolve(root, "docs/design/market-data-source.md");
const start = "2025-01-01";
const end = "2025-07-19";
const dayMicroseconds = 86_400_000_000;
const hash = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** 只接受单CSV、无加密、非ZIP64的官方小型日线月包，校验和先于解压。 */
function extractCsv(zip: Buffer, expectedName: string): Buffer {
  let endOffset = zip.length - 22;
  while (
    endOffset >= Math.max(0, zip.length - 65_557) &&
    zip.readUInt32LE(endOffset) !== 0x06054b50
  )
    endOffset -= 1;
  if (endOffset < 0 || zip.readUInt32LE(endOffset) !== 0x06054b50)
    throw new Error("缺少ZIP结束记录");
  if (zip.readUInt16LE(endOffset + 10) !== 1)
    throw new Error("官方月包应只有一个CSV");
  const central = zip.readUInt32LE(endOffset + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50)
    throw new Error("无效ZIP中央目录");
  const flags = zip.readUInt16LE(central + 8);
  const method = zip.readUInt16LE(central + 10);
  const compressedSize = zip.readUInt32LE(central + 20);
  const size = zip.readUInt32LE(central + 24);
  const nameLength = zip.readUInt16LE(central + 28);
  const name = zip.subarray(central + 46, central + 46 + nameLength).toString();
  if (flags & 1 || name !== expectedName || size > 1_000_000)
    throw new Error(`不支持的ZIP内容：${name}`);
  const local = zip.readUInt32LE(central + 42);
  if (zip.readUInt32LE(local) !== 0x04034b50)
    throw new Error("无效ZIP本地记录");
  const offset =
    local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const compressed = zip.subarray(offset, offset + compressedSize);
  const csv =
    method === 8
      ? inflateRawSync(compressed)
      : method === 0
        ? compressed
        : null;
  if (!csv || csv.length !== size) throw new Error("CSV解压长度或压缩方法无效");
  return csv;
}

function parseCsv(csv: Buffer): RawDailyQuote[] {
  return csv
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split(",");
      if (cells.length !== 12) throw new Error("日线CSV列数应为12");
      const timestamp = Number(cells[0]);
      if (!Number.isSafeInteger(timestamp) || timestamp % dayMicroseconds !== 0)
        throw new Error("2025日线应为UTC午夜的安全整数微秒");
      const date = new Date(timestamp / 1000).toISOString().slice(0, 10);
      const open = cells[1]!;
      const close = cells[4]!;
      const volume = cells[5]!;
      if (![open, close, volume].every((value) => /^\d+(\.\d+)?$/.test(value)))
        throw new Error(`无效数字 ${date}`);
      if (Number(open) <= 0 || Number(close) <= 0 || Number(volume) < 0)
        throw new Error(`无效价格或成交量 ${date}`);
      return { date, open, close, volume };
    });
}

await mkdir(cache, { recursive: true });
const archives: SourceArchive[] = [];
const bySymbol = await Promise.all(
  ["BTCUSDT", "ETHUSDT"].map(async (symbol) => {
    const quotes: RawDailyQuote[] = [];
    for (let month = 1; month <= 7; month += 1) {
      const yearMonth = `2025-${String(month).padStart(2, "0")}`;
      const name = `${symbol}-1d-${yearMonth}`;
      const url = `https://data.binance.vision/data/spot/monthly/klines/${symbol}/1d/${name}.zip`;
      const checksum = (await download(`${url}.CHECKSUM`)).toString("utf8");
      const match = checksum.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
      if (!match || match[2] !== `${name}.zip`)
        throw new Error(`校验清单无效 ${url}`);
      const expected = match[1]!.toLowerCase();
      const pinned = HISTORY_ARCHIVES.find((archive) => archive.url === url);
      if (!pinned || pinned.sha256 !== expected)
        throw new Error(
          `官方校验值与当前数据版本不一致，请审核并升级版本：${url}`,
        );
      let zip: Buffer;
      try {
        zip = await readFile(resolve(cache, `${name}.zip`));
      } catch {
        zip = await download(url);
      }
      if (hash(zip) !== expected) throw new Error(`SHA256不匹配 ${url}`);
      const csv = extractCsv(zip, `${name}.csv`);
      const rows = parseCsv(csv);
      await writeFile(resolve(cache, `${name}.zip`), zip);
      await writeFile(resolve(cache, `${name}.zip.CHECKSUM`), checksum);
      await writeFile(resolve(cache, `${name}.csv`), csv);
      archives.push({
        symbol,
        month: yearMonth,
        url,
        sha256: expected,
        csvSha256: hash(csv),
        rows: rows.length,
      });
      quotes.push(
        ...rows.filter((row) => row.date >= start && row.date <= end),
      );
      process.stdout.write(`已核验 ${name} SHA256 ${expected}\n`);
    }
    if (quotes.length !== 200) throw new Error(`${symbol} 应恰有200期`);
    for (const [index, row] of quotes.entries()) {
      const expected = new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (row.date !== expected)
        throw new Error(`${symbol} 日期缺漏或重复 ${row.date}`);
    }
    return quotes;
  }),
);
archives.sort(
  (a, b) => a.symbol.localeCompare(b.symbol) || a.month.localeCompare(b.month),
);
const rows = bySymbol[0]!.map((btc, index) => {
  const eth = bySymbol[1]![index]!;
  if (btc.date !== eth.date) throw new Error("两资产日期不一致");
  return [
    btc.date,
    btc.open,
    btc.close,
    btc.volume,
    eth.open,
    eth.close,
    eth.volume,
  ];
});
const retrievedAt = new Date().toISOString();
const formattedRows = rows
  .map((row) => {
    const btc = JSON.stringify(row.slice(0, 4)).slice(0, -1);
    const eth = JSON.stringify(row.slice(4)).slice(1);
    return `  ${btc},\n    ${eth},`;
  })
  .join("\n");
const content = `// 由 scripts/data/import-binance-history.ts 生成；原始十进制CSV字段按字符串保留。
// 来源：Binance Vision；数据及其衍生数据采用 CC BY-NC-SA 4.0，非项目MIT许可。
// 详见 docs/design/market-data-source.md；不是PandaData或真实小镇商品价格。
export type HistoricalRow = readonly [
  date: string, btcOpen: string, btcClose: string, btcVolume: string,
  ethOpen: string, ethClose: string, ethVolume: string,
];
export const HISTORY_RETRIEVED_AT = ${JSON.stringify(retrievedAt)};
// prettier-ignore
export const MARKET_HISTORY: readonly HistoricalRow[] = [
${formattedRows}
];
export interface HistoricalArchive {
  symbol: string; month: string; url: string; sha256: string; csvSha256: string; rows: number;
}
export const HISTORY_ARCHIVES: readonly HistoricalArchive[] = ${JSON.stringify(archives, null, 2)};
`;
await writeFile(snapshots, content, "utf8");
await mkdir(dirname(sourceDoc), { recursive: true });
await writeFile(
  sourceDoc,
  `# 真实历史行情来源与游戏映射

本项目使用Binance Vision公开现货日线，BTCUSDT映射为游戏的竹材（bamboo），ETHUSDT映射为松果（pine）。
这两种游戏商品只借用真实市场的价格与成交量序列，不代表真实竹材、松果或PandaData行情。
没有随机添加波动、平滑、重排日期或按回测收益挑选窗口。

## 数据、日期与许可

- 官方说明：[binance-public-data](https://github.com/binance/binance-public-data)。
  现货数据自2025-01-01起采用微秒时间戳；CSV每行12列，本项目保留第2列开盘、第5列收盘、第6列基础资产成交量的原始十进制字符串。
- 固定取2025-01-01至2025-07-19，UTC连续200个日历日；加密资产市场每天交易，不能解释为A股交易日。
  20期预热为01-01至01-20，120期研究为01-21至05-20，60期检验为05-21至07-19；检验前史仅取此前20期。
- 抓取时间：${retrievedAt}。月份ZIP及其官方CHECKSUM先做SHA256核验，再解压；
  七月包有31日，仅按上述固定截止日期保留前19日。原始包、清单、CSV保存在本机忽略目录 logs/market-data-source/。
- [数据条款](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md) 当前版本1.0、更新2026-08-26：
  数据及派生数据采用[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)，附该数据条款，限非商业教育与研究，商业用途需另获许可。
  仓库代码的MIT不能替代数据许可。本快照和行情映射不属于本项目自行授权的MIT资产；保留Binance Vision来源和同等数据许可。
  项目不表示与Binance存在合作或背书。

## 单位转换与人为传输错误

每项资产各自取2025-01-01真实开盘价 P0，价格缩放因子 s=100/P0。
模拟开盘/收盘为原价×s，模拟数量为原基础资产数量÷s；因此原价×原数量与模拟价格×模拟数量的数值相同，比例收益和真实涨跌序列保持不变。
首期开盘均为100模拟币。使用未四舍五入的数值计算，界面显示另行格式化，不把显示位数写回模拟。

原始报价在 src/research/market-history.ts 按字符串保留，data.ts统一转换。
传输副本仍有四个明确人为设置的教学错误：02-12竹材缺收盘，03-12松果缺成交量，03-28松果收盘被改为9999，04-28竹材成交量被改为-4。
它们不是交易所实际坏数据；清洗时只重读同日期已核验源恢复，保留收到值、恢复值和解释，不以前日量替代、不引用未来行。

DATASET_VERSION更新为 panda-binance-spot-1d-20250101-20250719-v1。
旧模拟版本的保存记录必须被拒绝，避免混用收益或证据。回测规则、成交与费用计算没有因本次换数据改变。
历史日成交量仅是教学撮合上限，不等同于实际下单时的盘口流动性。

## 可重复导入

在项目根目录运行：

\x60\x60\x60powershell
& 'C:/nvm4w/nodejs/node.exe' --import tsx scripts/data/import-binance-history.ts
\x60\x60\x60

脚本只请求公开静态ZIP与CHECKSUM，不需要登录、密钥或付费；两资产并行、同资产逐月下载，不调用交易接口。
先将官方校验值与当前快照HISTORY_ARCHIVES锁定值比对，再核验缓存或下载包，不匹配即停止，不静默覆盖。
官方可能修订历史包；发生修订时应审核差异并升级数据版本与锁定清单，不能用同一版本悄悄替换。
当前快照同时作为导入的版本清单，因此运行前应保留受版本控制的market-history.ts。
再导入会更新抓取时间，其余相同输入保留相同报价。格式化可使用项目已有Prettier。
快照进入浏览器包，检验报价的保留由研究流程界面控制，不宣称为服务端秘密。

## 独立抄核样本

以下字段从已核验的解压CSV独立读取，用于data.test.ts的公开报价与清洗预期；不调用生产缩放函数制造预期。缩放后的测试常量另用十进制定点算术计算，容忍二进制浮点末位差异。

| 资产与UTC日期 | 原始开盘 | 原始收盘 | 原始基础资产成交量 |
| --- | --- | --- | --- |
| BTCUSDT 01-01 | 93576.00000000 | 94591.79000000 | 10373.32613000 |
| ETHUSDT 01-01 | 3337.78000000 | 3360.38000000 | 190238.58610000 |
| BTCUSDT 01-21 | 102260.00000000 | 106143.82000000 | 45941.02002000 |
| ETHUSDT 01-21 | 3283.99000000 | 3327.54000000 | 548706.05130000 |
| BTCUSDT 02-12 | 95778.21000000 | 97869.99000000 | 29151.16625000 |
| ETHUSDT 03-12 | 1923.42000000 | 1908.20000000 | 788739.67630000 |
| ETHUSDT 03-28 | 2003.67000000 | 1896.90000000 | 626167.58320000 |
| BTCUSDT 04-28 | 93749.29000000 | 95011.18000000 | 22157.53351000 |
| BTCUSDT 07-19 | 117924.84000000 | 117840.00000000 | 6635.80306000 |
| ETHUSDT 07-19 | 3546.92000000 | 3592.01000000 | 381791.92130000 |

## 下载地址与校验值

每个地址后追加 .CHECKSUM 即官方校验清单。下列为实际成功核验的ZIP SHA256；解压CSV SHA256与原月行数另完整记录在快照 HISTORY_ARCHIVES。

| 月包 | ZIP SHA256 |
| --- | --- |
${archives.map((archive) => `| [${archive.symbol} ${archive.month}](${archive.url}) | ${archive.sha256} |`).join("\n")}
`,
  "utf8",
);
process.stdout.write(`已写入两资产×200日真实快照及来源文档：${snapshots}\n`);

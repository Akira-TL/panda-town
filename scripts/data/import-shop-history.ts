import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";
import { PRODUCTS } from "../../src/trading/products";
import type {
  HistoricalArchive,
  HistoricalRow,
} from "../../src/trading/history/types";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cache = resolve(root, "logs/market-data-source");
const output = resolve(root, "src/trading/history");
const initialize = process.argv.includes("--initialize");
const offline = process.argv.includes("--offline");
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const retrievedAt = new Date().toISOString();
const allArchives: HistoricalArchive[] = [];

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractCsv(zip: Buffer, expectedName: string): Buffer {
  if (zip.length < 22) throw new Error("ZIP长度不足");
  let end = zip.length - 22;
  while (
    end >= Math.max(0, zip.length - 65_557) &&
    zip.readUInt32LE(end) !== 0x06054b50
  )
    end -= 1;
  if (
    end < 0 ||
    zip.readUInt32LE(end) !== 0x06054b50 ||
    zip.readUInt16LE(end + 10) !== 1
  )
    throw new Error("应为单CSV的官方ZIP月包");
  const central = zip.readUInt32LE(end + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50)
    throw new Error("无效ZIP中央目录");
  const nameLength = zip.readUInt16LE(central + 28);
  const name = zip.subarray(central + 46, central + 46 + nameLength).toString();
  if (zip.readUInt16LE(central + 8) & 1 || name !== expectedName)
    throw new Error("无效CSV名或加密包");
  const method = zip.readUInt16LE(central + 10);
  const size = zip.readUInt32LE(central + 24);
  if (size > 1_000_000) throw new Error("CSV超出日线月包大小");
  const local = zip.readUInt32LE(central + 42);
  if (zip.readUInt32LE(local) !== 0x04034b50)
    throw new Error("无效ZIP本地记录");
  const offset =
    local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(offset, offset + zip.readUInt32LE(central + 20));
  const csv = method === 8 ? inflateRawSync(data) : method === 0 ? data : null;
  if (!csv || csv.length !== size) throw new Error("无效CSV解压长度或压缩方法");
  return csv;
}

function parseCsv(csv: Buffer): HistoricalRow[] {
  return csv
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split(",");
      const timestamp = Number(cells[0]);
      if (
        cells.length !== 12 ||
        !Number.isSafeInteger(timestamp) ||
        timestamp % 86_400_000_000 !== 0
      )
        throw new Error("应为12列、UTC午夜微秒日线");
      const date = new Date(timestamp / 1000).toISOString().slice(0, 10);
      const open = cells[1]!;
      const high = cells[2]!;
      const low = cells[3]!;
      const close = cells[4]!;
      const volume = cells[5]!;
      if (
        ![open, high, low, close, volume].every((value) =>
          /^\d+(\.\d+)?$/.test(value),
        )
      )
        throw new Error(`无效十进制字段 ${date}`);
      if (!(
        Number(low) > 0 &&
        Number(high) >= Math.max(Number(open), Number(close)) &&
        Number(low) <= Math.min(Number(open), Number(close)) &&
        Number(volume) >= 0
      ))
        throw new Error(`无效价格或数量 ${date}`);
      return [date, open, close, volume, high, low];
    });
}

async function importSymbol(symbol: string): Promise<void> {
  const target = resolve(output, `${symbol.toLowerCase()}.ts`);
  let pinned: readonly HistoricalArchive[] = [];
  let previousRows: readonly HistoricalRow[] = [];
  if (existsSync(target)) {
    const previous = (await import(pathToFileURL(target).href)) as {
      ARCHIVES: readonly HistoricalArchive[];
      HISTORY: readonly HistoricalRow[];
    };
    pinned = previous.ARCHIVES;
    previousRows = previous.HISTORY;
  } else if (!initialize) {
    throw new Error(`缺少${symbol}版本清单；首次明确导入使用--initialize`);
  }
  const rows: HistoricalRow[] = [];
  const archives: HistoricalArchive[] = [];
  for (let month = 1; month <= 7; month += 1) {
    const yearMonth = `2025-${String(month).padStart(2, "0")}`;
    const name = `${symbol}-1d-${yearMonth}`;
    const url = `https://data.binance.vision/data/spot/monthly/klines/${symbol}/1d/${name}.zip`;
    const checksum = (
      offline
        ? await readFile(resolve(cache, `${name}.zip.CHECKSUM`))
        : await download(`${url}.CHECKSUM`)
    ).toString("utf8");
    const match = checksum.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match || match[2] !== `${name}.zip`)
      throw new Error(`校验清单无效 ${url}`);
    const expected = match[1]!.toLowerCase();
    if (
      pinned.length &&
      pinned.find((archive) => archive.url === url)?.sha256 !== expected
    )
      throw new Error(`历史包被修订，需审核并升级MARKET_VERSION：${url}`);
    let zip: Buffer;
    try {
      zip = await readFile(resolve(cache, `${name}.zip`));
    } catch {
      if (offline) throw new Error(`离线导入缺少已核验ZIP：${name}`);
      zip = await download(url);
    }
    if (sha256(zip) !== expected) throw new Error(`SHA256不匹配 ${url}`);
    const csv = extractCsv(zip, `${name}.csv`);
    const monthRows = parseCsv(csv);
    if (monthRows.length !== new Date(Date.UTC(2025, month, 0)).getUTCDate())
      throw new Error(`官方CSV未覆盖完整月份 ${name}`);
    await writeFile(resolve(cache, `${name}.zip`), zip);
    await writeFile(resolve(cache, `${name}.zip.CHECKSUM`), checksum);
    await writeFile(resolve(cache, `${name}.csv`), csv);
    archives.push({
      symbol,
      month: yearMonth,
      url,
      sha256: expected,
      csvSha256: sha256(csv),
      rows: monthRows.length,
    });
    rows.push(
      ...monthRows.filter(
        ([date]) => date >= "2025-01-01" && date <= "2025-07-19",
      ),
    );
    process.stdout.write(`已核验 ${name} ${expected}\n`);
  }
  if (rows.length !== 200) throw new Error(`${symbol}必须恰有200日`);
  if (previousRows.length && previousRows.length !== rows.length)
    throw new Error(`${symbol}旧快照长度不一致，不允许静默更换市场序列`);
  rows.forEach(([date], index) => {
    const expected = new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (date !== expected) throw new Error(`${symbol}日期缺漏或重复 ${date}`);
    const previous = previousRows[index];
    if (
      previous &&
      rows[index]!.slice(0, 4).some(
        (value, column) => value !== previous[column],
      )
    )
      throw new Error(
        `${symbol}原日期/开盘/收盘/成交量发生变化，需升级市场版本：${date}`,
      );
  });
  process.stdout.write(
    `${symbol}共${rows.length}日：真实高低价有效，原日期/开盘/收盘/量逐位一致。\n`,
  );
  const content = `// Binance Vision真实历史；CC BY-NC-SA 4.0及来源数据条款，非项目MIT。
// 由scripts/data/import-shop-history.ts生成，详见docs/design/shop-market-data-source.md。
import type { HistoricalArchive, HistoricalRow } from "./types";
export const RETRIEVED_AT = ${JSON.stringify(retrievedAt)};
// prettier-ignore
export const HISTORY: readonly HistoricalRow[] = [
${rows.map((row) => `  ${JSON.stringify(row)},`).join("\n")}
];
export const ARCHIVES: readonly HistoricalArchive[] = ${JSON.stringify(archives, null, 2)};
`;
  await writeFile(target, content, "utf8");
  allArchives.push(...archives);
}

await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
for (let offset = 0; offset < PRODUCTS.length; offset += 2)
  await Promise.all(
    PRODUCTS.slice(offset, offset + 2).map(({ symbol }) =>
      importSymbol(symbol),
    ),
  );
const imports = PRODUCTS.map(
  ({ symbol }) =>
    `import { HISTORY as ${symbol}, ARCHIVES as ${symbol}_ARCHIVES } from "./${symbol.toLowerCase()}";`,
).join("\n");
await writeFile(
  resolve(output, "index.ts"),
  `${imports}
import type { HistoricalRow, HistoricalArchive } from "./types";
export const HISTORY_BY_SYMBOL: ReadonlyMap<string, readonly HistoricalRow[]> = new Map([
${PRODUCTS.map(({ symbol }) => `  ["${symbol}", ${symbol}],`).join("\n")}
]);
export const MARKET_ARCHIVES: readonly HistoricalArchive[] = [
${PRODUCTS.map(({ symbol }) => `  ...${symbol}_ARCHIVES,`).join("\n")}
];
`,
);
await writeFile(
  resolve(root, "docs/design/shop-market-data-source.md"),
  `# 八商品真实历史行情来源

八家商店分别使用八个独立现货产品的历史日线。不是两条曲线改名，不做平滑、随机波动、拼接或按收益挑选窗口。
全部固定取2025-01-01至2025-07-19的200个UTC日历日；市场起点index19，公开初始20期前史，到达推进一日。
最后index199是2025-07-19，之后停止，不循环或补造未来。快照由公开原始CSV导入，运行不请求网络行情。

## 映射、单位与可见边界

商品映射唯一维护于src/trading/products.ts。游戏商品只是虚构名称；其走势来自下列加密资产产品，不代表真实商品市场或PandaData。
市场版本为panda-eight-binance-spot-1d-20250101-20250719-v1，与旧八章研究版本分开，不续接旧局。

| 游戏商品 | 原历史产品 |
| --- | --- |
${PRODUCTS.map(({ name, symbol }) => `| ${name} | ${symbol} |`).join("\n")}

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
本次核验时间：${retrievedAt}。56个月包均先验证官方CHECKSUM中的SHA256，再解压；每CSV12列，采用开高低收和基础资产成交量。
每个原月文件应覆盖整个日历月；七月31行中只保留截至19日。日期连续性与每产品恰200行实际检查。
ZIP、CHECKSUM和解压CSV保留在本机忽略目录logs/market-data-source/，每文件CSV SHA256与行数也记入各快照ARCHIVES。

[官方数据条款](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md)
当前v1.0、2026-08-26更新，数据及派生数据采用CC BY-NC-SA 4.0与该数据条款，限非商业教育/研究，商业需另获许可。
来源数据与派生快照不按项目MIT重新授权；保留Binance Vision署名及相同数据许可。不表示商业合作或背书。

## 独立CSV抄核样本

下表从已核验原CSV独立读取，用于market.test.ts公开报价预期。归一化常量使用十进制算术另算，不调用市场函数制造预期。

| 原始产品 | 01-01开盘 | 01-21收盘 | 01-21基础资产成交量 |
| --- | --- | --- | --- |
| BTCUSDT | 93576.00000000 | 106143.82000000 | 45941.02002000 |
| ETHUSDT | 3337.78000000 | 3327.54000000 | 548706.05130000 |
| BNBUSDT | 702.31000000 | 692.21000000 | 294203.47100000 |
| SOLUSDT | 189.31000000 | 250.33000000 | 7882737.25700000 |
| XRPUSDT | 2.08360000 | 3.17380000 | 376423502.00000000 |
| ADAUSDT | 0.84500000 | 1.00580000 | 303337850.20000000 |
| DOGEUSDT | 0.31600000 | 0.37177000 | 4627964135.00000000 |
| LINKUSDT | 20.02000000 | 26.67000000 | 10509727.17000000 |

以下01-21高低价另从原CSV第3/4列抄核；测试中的归一化预期由独立十进制运算得到。

| 产品 | 原最高 | 原最低 | 归一化最高 | 归一化最低 |
| --- | --- | --- | --- | --- |
| BTCUSDT | 107240.81000000 | 100119.04000000 | 114.60290031632042 | 106.99222022740873 |
| ETHUSDT | 3368.00000000 | 3204.60000000 | 100.90539220679613 | 96.00992276303411 |
| BNBUSDT | 697.00000000 | 675.01000000 | 99.24392362347112 | 96.11282766869331 |
| SOLUSDT | 260.06000000 | 230.00000000 | 137.37256352015213 | 121.49384607257937 |
| XRPUSDT | 3.24600000 | 3.01240000 | 155.78805912843156 | 144.57669418314456 |
| ADAUSDT | 1.02880000 | 0.95080000 | 121.75147928994083 | 112.5207100591716 |
| DOGEUSDT | 0.40382000 | 0.33572000 | 127.79113924050633 | 106.24050632911393 |
| LINKUSDT | 27.09000000 | 23.68000000 | 135.3146853146853 | 118.28171828171828 |

## 可重复导入

项目根目录运行node --import tsx scripts/data/import-shop-history.ts。已有各快照ARCHIVES同时作为锁定清单。
首次缺少文件时显式加--initialize；已有文件始终核对锁定值，官方校验变化即停止，审核后需升级版本。
离线复核可加--offline：使用忽略目录中的原ZIP与官方CHECKSUM，仍核对源码锁定SHA256，缺失即停止，不跳过校验。
脚本只下载公开静态ZIP及CHECKSUM，无密钥、登录、付费或交易操作；两产品并行、每产品顺序下载七个月。
源码快照均小于800行且每行不超过120列；单个prettier-ignore保留机器排版。未接入PandaData。

## 实际核验的56个来源包

每个链接追加.CHECKSUM即官方校验文件。CSV校验值与行数见各快照ARCHIVES；下表是ZIP SHA256。

| 产品月份 | ZIP SHA256 |
| --- | --- |
${allArchives
  .sort(
    (a, b) =>
      a.symbol.localeCompare(b.symbol) || a.month.localeCompare(b.month),
  )
  .map(
    ({ symbol, month, url, sha256 }) =>
      `| [${symbol} ${month}](${url}) | ${sha256} |`,
  )
  .join("\n")}
`,
  "utf8",
);
process.stdout.write("八个独立真实历史快照、市场索引与来源文档已写入。\n");

import type {
  AssetId,
  AssetQuote,
  DataIssue,
  MarketBar,
  StudySegment,
} from "./model";
import { MARKET_HISTORY } from "./market-history";

export const DATASET_VERSION = "panda-binance-spot-1d-20250101-20250719-v1";

interface RawQuote {
  open: number;
  close: number | null;
  volume: number | null;
}
interface RawBar {
  date: string;
  bamboo: RawQuote;
  pine: RawQuote;
}

const bambooScale = 100 / Number(MARKET_HISTORY[0]![1]);
const pineScale = 100 / Number(MARKET_HISTORY[0]![4]);
// 真实历史的相对涨跌保持原样；数量反向换算，避免量价单位不一致。
// 原始十进制字符串及第三方数据许可保留在market-history.ts与来源文档。
const source: MarketBar[] = MARKET_HISTORY.map(
  ([date, btcOpen, btcClose, btcVolume, ethOpen, ethClose, ethVolume]) => ({
    date,
    bamboo: {
      open: Number(btcOpen) * bambooScale,
      close: Number(btcClose) * bambooScale,
      volume: Number(btcVolume) / bambooScale,
    },
    pine: {
      open: Number(ethOpen) * pineScale,
      close: Number(ethClose) * pineScale,
      volume: Number(ethVolume) / pineScale,
    },
  }),
);
const received: RawBar[] = source.map(copyBar);
// 以下四项仅是人为设置的教学传输错误，不是交易所原始数据问题。
received[42]!.bamboo.close = null;
received[70]!.pine.volume = null;
received[86]!.pine.close = 9999;
received[117]!.bamboo.volume = -4;

const issues: DataIssue[] = [];
const verified: MarketBar[] = [];
for (const [index, bar] of received.entries()) {
  const original = source[index]!;
  function clean(asset: AssetId): AssetQuote {
    const raw = bar[asset];
    const sameDateSource = original[asset];
    let close = raw.close;
    if (close !== sameDateSource.close) {
      close = sameDateSource.close;
      issues.push({
        date: bar.date,
        asset,
        field: "close",
        received: raw.close,
        restored: close,
        explanation:
          "人为教学传输错误：收盘价缺失或被改写；重读同日期已核验历史源恢复，未读取后续样本；非交易所原始坏数据。",
      });
    }
    let volume = raw.volume;
    if (volume !== sameDateSource.volume) {
      volume = sameDateSource.volume;
      issues.push({
        date: bar.date,
        asset,
        field: "volume",
        received: raw.volume,
        restored: volume,
        explanation:
          "人为教学传输错误：成交量缺失或被改写；重读同日期已核验历史源，不以前日成交量替代本日；非交易所原始坏数据。",
      });
    }
    return { open: raw.open, close, volume };
  }
  verified.push({
    date: bar.date,
    bamboo: clean("bamboo"),
    pine: clean("pine"),
  });
}

function copyBar(bar: MarketBar): MarketBar {
  return { date: bar.date, bamboo: { ...bar.bamboo }, pine: { ...bar.pine } };
}

export function getResearchData(): MarketBar[] {
  return verified.slice(20, 140).map(copyBar);
}

export function getDataIssues(): DataIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

/** 只供模拟入口分段；界面数据表使用getResearchData，不提前展示留出报价。 */
export function getSimulationInput(segment: StudySegment): {
  bars: MarketBar[];
  warmup: MarketBar[];
} {
  const start = segment === "research" ? 20 : 140;
  const end = segment === "research" ? 140 : 200;
  return {
    bars: verified.slice(start, end).map(copyBar),
    warmup: verified.slice(start - 20, start).map(copyBar),
  };
}

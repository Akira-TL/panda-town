import type { AssetId, AssetQuote, DataIssue, MarketBar } from "./model";

export const DATASET_VERSION = "panda-fictional-daily-2025-v1";

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

const wave = [0, 55, 90, 35, -45, -90, -30, 45, 95, 25, -55, -100];
const gaps = [-12, 18, -8, 10, 0];

function closeCents(asset: AssetId, index: number): number {
  const variation =
    wave[(index * 5 + (asset === "pine" ? 3 : 0)) % wave.length]!;
  if (asset === "bamboo") {
    const drift =
      index < 65
        ? 30 * index
        : index < 135
          ? 1950 - 42 * (index - 65)
          : -990 + 18 * (index - 135);
    return 10000 + drift + variation;
  }
  const drift =
    index < 60
      ? -14 * index
      : index < 140
        ? -840 + 24 * (index - 60)
        : 1080 - 12 * (index - 140);
  return 8000 + drift + variation;
}

function quote(asset: AssetId, index: number): AssetQuote {
  return {
    open:
      (closeCents(asset, Math.max(0, index - 1)) + gaps[index % gaps.length]!) /
      100,
    close: closeCents(asset, index) / 100,
    volume: 900 + ((index * 37 + (asset === "pine" ? 113 : 0)) % 600),
  };
}

function marketBar(index: number): MarketBar {
  return {
    date: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
      .toISOString()
      .slice(0, 10),
    bamboo: quote("bamboo", index),
    pine: quote("pine", index),
  };
}

const source = Array.from({ length: 200 }, (_, index) => marketBar(index));
const received: RawBar[] = source.map(copyBar);
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
          "传输收盘价缺失或与原始值不符；重读同日期演示源恢复，未读取后续样本。",
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
          "传输成交量缺失或与原始值不符；重读同日期演示源，不以前日成交量替代本日。",
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

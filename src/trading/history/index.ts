import { HISTORY as BTCUSDT, ARCHIVES as BTCUSDT_ARCHIVES } from "./btcusdt";
import { HISTORY as ETHUSDT, ARCHIVES as ETHUSDT_ARCHIVES } from "./ethusdt";
import { HISTORY as BNBUSDT, ARCHIVES as BNBUSDT_ARCHIVES } from "./bnbusdt";
import { HISTORY as SOLUSDT, ARCHIVES as SOLUSDT_ARCHIVES } from "./solusdt";
import { HISTORY as XRPUSDT, ARCHIVES as XRPUSDT_ARCHIVES } from "./xrpusdt";
import { HISTORY as ADAUSDT, ARCHIVES as ADAUSDT_ARCHIVES } from "./adausdt";
import { HISTORY as DOGEUSDT, ARCHIVES as DOGEUSDT_ARCHIVES } from "./dogeusdt";
import { HISTORY as LINKUSDT, ARCHIVES as LINKUSDT_ARCHIVES } from "./linkusdt";
import type { HistoricalRow, HistoricalArchive } from "./types";
export const HISTORY_BY_SYMBOL: ReadonlyMap<string, readonly HistoricalRow[]> =
  new Map([
    ["BTCUSDT", BTCUSDT],
    ["ETHUSDT", ETHUSDT],
    ["BNBUSDT", BNBUSDT],
    ["SOLUSDT", SOLUSDT],
    ["XRPUSDT", XRPUSDT],
    ["ADAUSDT", ADAUSDT],
    ["DOGEUSDT", DOGEUSDT],
    ["LINKUSDT", LINKUSDT],
  ]);
export const MARKET_ARCHIVES: readonly HistoricalArchive[] = [
  ...BTCUSDT_ARCHIVES,
  ...ETHUSDT_ARCHIVES,
  ...BNBUSDT_ARCHIVES,
  ...SOLUSDT_ARCHIVES,
  ...XRPUSDT_ARCHIVES,
  ...ADAUSDT_ARCHIVES,
  ...DOGEUSDT_ARCHIVES,
  ...LINKUSDT_ARCHIVES,
];

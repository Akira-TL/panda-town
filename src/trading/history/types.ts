/** 原始CSV字段；数据与派生快照采用CC BY-NC-SA 4.0，非项目MIT。 */
export type HistoricalRow = readonly [
  date: string,
  open: string,
  close: string,
  volume: string,
  high: string,
  low: string,
];
export interface HistoricalArchive {
  symbol: string;
  month: string;
  url: string;
  sha256: string;
  csvSha256: string;
  rows: number;
}

import type { ProductId, ProductPricePoint, ProductQuote } from "./model";
import { getProduct } from "./products";
import { HISTORY_BY_SYMBOL } from "./history";

export const MARKET_VERSION =
  "panda-eight-binance-spot-1d-20250101-20250719-v1";
export const START_MARKET_INDEX = 19;
export const LAST_MARKET_INDEX = 199;

export interface CandlePoint extends ProductQuote {
  index: number;
}

function checkIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > LAST_MARKET_INDEX)
    throw new RangeError(
      "行情索引应为0至199的整数；历史末尾不循环或补造未来。",
    );
}

export function getMarketDate(index: number): string {
  checkIndex(index);
  return HISTORY_BY_SYMBOL.get("BTCUSDT")![index]![0];
}

export function getQuote(product: ProductId, index: number): ProductQuote {
  checkIndex(index);
  const rows = HISTORY_BY_SYMBOL.get(getProduct(product).symbol);
  if (!rows) throw new RangeError("该商品没有对应的独立历史行情。");
  const [date, open, close, volume, high, low] = rows[index]!;
  const scale = 100 / Number(rows[0]![1]);
  return {
    date,
    open: Number(open) * scale,
    high: Number(high) * scale,
    low: Number(low) * scale,
    close: Number(close) * scale,
    volume: Number(volume) / scale,
  };
}

export function getVisibleSeries(
  product: ProductId,
  lastIndex: number,
): ProductPricePoint[] {
  checkIndex(lastIndex);
  const points: ProductPricePoint[] = [];
  for (let index = 0; index <= lastIndex; index += 1) {
    const quote = getQuote(product, index);
    const previousClose = index ? points[index - 1]!.price : null;
    const average = (period: number): number | null =>
      index < period
        ? null
        : points
            .slice(index - period, index)
            .reduce((sum, point) => sum + point.price, 0) / period;
    points.push({
      index,
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
      price: quote.close,
      previousClose,
      change: previousClose === null ? null : quote.close - previousClose,
      ma5: average(5),
      ma20: average(20),
    });
  }
  return points;
}

/** 全部四价来自已核验原CSV；只返回调用者已知的历史前缀。 */
export function getVisibleCandles(
  product: ProductId,
  lastIndex: number,
): CandlePoint[] {
  checkIndex(lastIndex);
  return Array.from({ length: lastIndex + 1 }, (_, index) => ({
    index,
    ...getQuote(product, index),
  }));
}

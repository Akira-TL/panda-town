export function money(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
export function units(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
}
export function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

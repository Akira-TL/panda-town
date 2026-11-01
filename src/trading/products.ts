import type { LocationId } from "../game/content";
import type { ProductDefinition, ProductId } from "./model";

export const PRODUCTS: readonly ProductDefinition[] = [
  {
    id: "bread",
    shop: "bakery",
    name: "面包",
    symbol: "BTCUSDT",
    icon: "/art/products/bread.webp",
  },
  {
    id: "timber",
    shop: "grocery",
    name: "木材",
    symbol: "ETHUSDT",
    icon: "/art/products/timber.webp",
  },
  {
    id: "fruit",
    shop: "market",
    name: "水果",
    symbol: "BNBUSDT",
    icon: "/art/products/fruit.webp",
  },
  {
    id: "chips",
    shop: "research",
    name: "芯片",
    symbol: "SOLUSDT",
    icon: "/art/products/chips.webp",
  },
  {
    id: "gold",
    shop: "bank",
    name: "金券",
    symbol: "XRPUSDT",
    icon: "/art/products/gold.webp",
  },
  {
    id: "flowers",
    shop: "gifts",
    name: "花束",
    symbol: "ADAUSDT",
    icon: "/art/products/flowers.webp",
  },
  {
    id: "coffee",
    shop: "rival",
    name: "咖啡豆",
    symbol: "DOGEUSDT",
    icon: "/art/products/coffee.webp",
  },
  {
    id: "tea",
    shop: "cafe",
    name: "茶叶",
    symbol: "LINKUSDT",
    icon: "/art/products/tea.webp",
  },
];
const LOCATION_PRODUCTS: Record<LocationId, ProductId> = {
  square: "bread",
  bakery: "bread",
  grocery: "timber",
  notice: "bread",
  market: "fruit",
  research: "chips",
  bridge: "gold",
  bank: "gold",
  gifts: "flowers",
  rival: "coffee",
  riverside: "tea",
  cafe: "tea",
  repair: "timber",
  garden: "flowers",
  music: "coffee",
  dock: "fruit",
};
export function getProduct(product: ProductId): ProductDefinition {
  return PRODUCTS.find((item) => item.id === product)!;
}
export function getLocationProduct(location: LocationId): ProductDefinition {
  return getProduct(LOCATION_PRODUCTS[location]);
}

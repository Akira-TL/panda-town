import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Panda Town · 熊猫小镇",
  description:
    "逛不同商店，依据历史涨跌买入、持有或卖出商品；随时结算并查看实际交易画像。",
  icons: {
    icon: { url: "/art/panda-tripo-source.webp", type: "image/webp" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
